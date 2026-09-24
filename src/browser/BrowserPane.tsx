import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookmarkPlus, Check, Globe2,
  Lock, RotateCw, Search, X
} from 'lucide-react'
import type { BrowserTab, Space } from '../types'
import { isDesktop } from '../bridge'

export interface BrowserPaneProps {
  tab?: BrowserTab
  space: Space
  isSplit?: boolean
  onCloseSplit?: () => void
  onUpdateTab?: (tabId: string, updates: Partial<BrowserTab>) => void
  onSaveTab: (tab: BrowserTab) => void
  onOpenExternal: (tab: BrowserTab) => void
  onSelectQuickUrl?: (url: string, title?: string) => void
}

interface WebviewElement extends HTMLElement {
  src: string
  canGoBack: () => boolean
  canGoForward: () => boolean
  goBack: () => void
  goForward: () => void
  reload: () => void
  stop: () => void
  getURL: () => string
  getTitle: () => string
  isLoading: () => boolean
}

const QUICK_SITES = [
  { name: 'ВКонтакте', url: 'https://vk.ru', icon: 'vk' },
  { name: 'Яндекс', url: 'https://ya.ru', icon: 'yandex' },
  { name: 'Telegram Web', url: 'https://web.telegram.org', icon: 'tg' },
  { name: 'Figma', url: 'https://www.figma.com', icon: 'figma' },
  { name: 'GitHub', url: 'https://github.com', icon: 'github' },
  { name: 'Погода (Gismeteo)', url: 'https://www.gismeteo.ru', icon: 'weather' },
]

export function BrowserPane({
  tab,
  space,
  isSplit = false,
  onCloseSplit,
  onUpdateTab,
  onSaveTab,
  onOpenExternal,
  onSelectQuickUrl
}: BrowserPaneProps) {
  const webviewRef = useRef<WebviewElement | null>(null)
  const currentUrlRef = useRef<string>(tab?.url || '')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [customSearch, setCustomSearch] = useState('')

  const isSaved = Boolean(tab?.url && space.resources.some(r => r.kind === 'link' && r.target === tab.url))

  // Update webview src when tab.url changes externally (e.g. via Omnibox)
  useEffect(() => {
    if (!tab?.url) return
    if (tab.url !== currentUrlRef.current && webviewRef.current) {
      currentUrlRef.current = tab.url
      try {
        webviewRef.current.src = tab.url
      } catch {
        // Fallback
      }
    }
  }, [tab?.url])

  // Attach event listeners to electron webview
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview || !isDesktop || !tab) return

    const handleNavigate = (e: any) => {
      const newUrl = e.url || webview.getURL?.() || ''
      if (newUrl && newUrl !== currentUrlRef.current) {
        currentUrlRef.current = newUrl
        onUpdateTab?.(tab.id, { url: newUrl })
      }
      setCanGoBack(Boolean(webview.canGoBack?.()))
      setCanGoForward(Boolean(webview.canGoForward?.()))
    }

    const handleTitleUpdated = (e: any) => {
      const newTitle = e.title || webview.getTitle?.() || ''
      if (newTitle && newTitle !== tab.title) {
        onUpdateTab?.(tab.id, { title: newTitle })
      }
    }

    const handleStartLoading = () => setIsLoading(true)
    const handleStopLoading = () => {
      setIsLoading(false)
      setCanGoBack(Boolean(webview.canGoBack?.()))
      setCanGoForward(Boolean(webview.canGoForward?.()))
    }

    const handleNewWindow = (e: any) => {
      if (e.url) {
        webview.src = e.url
      }
    }

    webview.addEventListener('did-navigate', handleNavigate)
    webview.addEventListener('did-navigate-in-page', handleNavigate)
    webview.addEventListener('page-title-updated', handleTitleUpdated)
    webview.addEventListener('did-start-loading', handleStartLoading)
    webview.addEventListener('did-stop-loading', handleStopLoading)
    webview.addEventListener('new-window', handleNewWindow)

    return () => {
      webview.removeEventListener('did-navigate', handleNavigate)
      webview.removeEventListener('did-navigate-in-page', handleNavigate)
      webview.removeEventListener('page-title-updated', handleTitleUpdated)
      webview.removeEventListener('did-start-loading', handleStartLoading)
      webview.removeEventListener('did-stop-loading', handleStopLoading)
      webview.removeEventListener('new-window', handleNewWindow)
    }
  }, [tab?.id, isDesktop])

  const handleBack = () => {
    if (webviewRef.current?.canGoBack?.()) {
      webviewRef.current.goBack()
    }
  }

  const handleForward = () => {
    if (webviewRef.current?.canGoForward?.()) {
      webviewRef.current.goForward()
    }
  }

  const handleReload = () => {
    if (webviewRef.current?.reload) {
      webviewRef.current.reload()
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const query = customSearch.trim()
    if (!query) return
    let target = query
    if (/^https?:\/\//i.test(query)) {
      target = query
    } else if (/^[^\s]+\.[^\s]+$/.test(query)) {
      target = `https://${query}`
    } else {
      target = `https://yandex.ru/search/?text=${encodeURIComponent(query)}`
    }
    onSelectQuickUrl?.(target)
    setCustomSearch('')
  }

  // Display domain or formatted URL
  let displayHost = ''
  try {
    if (tab?.url) displayHost = new URL(tab.url).hostname.replace(/^www\./, '')
  } catch {
    displayHost = tab?.url || ''
  }

  return (
    <section className="browser-pane-container" aria-label={isSplit ? 'Вкладка рядом' : 'Текущая вкладка'}>
      {/* Pane Toolbar */}
      <div className="browser-pane-toolbar">
        <div className="browser-pane-nav-buttons">
          <button
            className="browser-nav-btn"
            onClick={handleBack}
            disabled={!canGoBack}
            title="Назад"
            aria-label="Назад"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            className="browser-nav-btn"
            onClick={handleForward}
            disabled={!canGoForward}
            title="Вперёд"
            aria-label="Вперёд"
          >
            <ArrowRight size={16} />
          </button>
          <button
            className={`browser-nav-btn ${isLoading ? 'spinning' : ''}`}
            onClick={handleReload}
            title="Обновить страницу"
            aria-label="Обновить"
          >
            <RotateCw size={15} />
          </button>
        </div>

        {tab?.url ? (
          <div className="browser-pane-address-badge" title={tab.url}>
            <Lock size={13} className="lock-icon" />
            <span className="badge-host">{displayHost}</span>
            {isLoading && <span className="loading-dot" />}
          </div>
        ) : (
          <div className="browser-pane-address-badge empty">
            <Globe2 size={14} />
            <span>Новая вкладка</span>
          </div>
        )}

        <div className="browser-pane-right-actions">
          {tab?.url && (
            <>
              {isSaved ? (
                <span className="browser-saved-chip" title="Сохранено в материалах пространства">
                  <Check size={14} /> В материалах
                </span>
              ) : (
                <button
                  className="browser-action-btn"
                  onClick={() => onSaveTab(tab)}
                  title="Добавить страницу в материалы этого пространства"
                >
                  <BookmarkPlus size={15} /> <span>В материалы</span>
                </button>
              )}
              <button
                className="browser-action-btn external"
                onClick={() => onOpenExternal(tab)}
                title="Открыть в браузере по умолчанию"
              >
                <span>В браузере</span> <ArrowUpRight size={14} />
              </button>
            </>
          )}

          {isSplit && (
            <button
              className="browser-nav-btn close-split"
              onClick={onCloseSplit}
              title="Закрыть раздельный просмотр"
              aria-label="Закрыть раздельный просмотр"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Pane Content Area */}
      <div className="browser-pane-viewport">
        {tab?.url ? (
          isDesktop ? (
            <webview
              ref={webviewRef as any}
              src={tab.url}
              className="browser-webview-frame"
              partition="persist:dom-browser"
              allowpopups={true}
              webpreferences="contextIsolation=yes"
            />
          ) : (
            <div className="browser-iframe-wrap">
              <iframe
                src={tab.url}
                className="browser-iframe-frame"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title={tab.title || 'Просмотр страницы'}
              />
              <div className="browser-web-notice">
                <span>В режиме веб-демо сайт отображается во фрейме. В Electron-версии страницы открываются без ограничений.</span>
                <button onClick={() => onOpenExternal(tab)}>Открыть во вкладке <ArrowUpRight size={13} /></button>
              </div>
            </div>
          )
        ) : (
          /* Empty / New Tab Start Screen */
          <div className="browser-start-screen">
            <div className="browser-start-card">
              <div className="browser-start-brand">
                <span className="browser-start-mark">✳</span>
                <h2>Спокойный поиск и сайты</h2>
              </div>
              <p className="browser-start-sub">
                Введите адрес или запрос в поисковой строке выше, либо выберите один из быстрых переходов:
              </p>

              <form onSubmit={handleSearchSubmit} className="browser-start-search-form">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  value={customSearch}
                  onChange={e => setCustomSearch(e.target.value)}
                  placeholder="Найти в Яндексе или открыть адрес сайта…"
                  className="browser-start-input"
                  autoFocus
                />
                <button type="submit" className="browser-start-submit-btn">Перейти</button>
              </form>

              <div className="browser-quick-grid">
                {QUICK_SITES.map(site => (
                  <button
                    key={site.url}
                    className="browser-quick-card"
                    onClick={() => onSelectQuickUrl?.(site.url, site.name)}
                  >
                    <span className="quick-card-icon"><Globe2 size={20} /></span>
                    <span className="quick-card-name">{site.name}</span>
                  </button>
                ))}
              </div>

              {space.resources.filter(r => r.kind === 'link').length > 0 && (
                <div className="browser-space-links-section">
                  <h3>Закладки пространства «{space.name}»</h3>
                  <div className="browser-quick-grid">
                    {space.resources.filter(r => r.kind === 'link').slice(0, 4).map(res => (
                      <button
                        key={res.id}
                        className="browser-quick-card space-link"
                        onClick={() => onSelectQuickUrl?.(res.target, res.name)}
                      >
                        <span className="quick-card-icon"><BookmarkPlus size={18} /></span>
                        <span className="quick-card-name">{res.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
