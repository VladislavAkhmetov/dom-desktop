import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookmarkPlus, Check, Globe2,
  FileText, Plus, RotateCw, X
} from 'lucide-react'
import type { BrowserTab, Resource, Space } from '../types'
import { isDesktop } from '../bridge'
import { recentMaterials, resourceAppLabel } from '../resourcePresentation'

export interface BrowserPaneProps {
  tab?: BrowserTab
  space: Space
  isSplit?: boolean
  onCloseSplit?: () => void
  onUpdateTab?: (tabId: string, updates: Partial<BrowserTab>) => void
  onSaveTab: (tab: BrowserTab) => void
  onOpenExternal: (tab: BrowserTab) => void
  onOpenResource: (resource: Resource) => void
  onAddLink: () => void
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

export function BrowserPane({
  tab,
  space,
  isSplit = false,
  onCloseSplit,
  onUpdateTab,
  onSaveTab,
  onOpenExternal,
  onOpenResource,
  onAddLink,
  onSelectQuickUrl
}: BrowserPaneProps) {
  const webviewRef = useRef<WebviewElement | null>(null)
  const currentUrlRef = useRef<string>(tab?.url || '')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

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
      {(tab?.url || isSplit) && <div className="browser-pane-toolbar">
        {isDesktop && <div className="browser-pane-nav-buttons">
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
        </div>}

        {tab?.url ? (
          <div className="browser-pane-address-badge" title={tab.url}>
            <Globe2 size={14} />
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
              {isDesktop && <button
                className="browser-action-btn external"
                onClick={() => onOpenExternal(tab)}
                title="Открыть в браузере по умолчанию"
              >
                <span>В браузере</span> <ArrowUpRight size={14} />
              </button>}
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
      </div>}

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
            <div className="browser-handoff">
              <Globe2 size={28} strokeWidth={1.5} />
              <h2>{tab.title || displayHost}</h2>
              <p>В веб-прототипе сайт откроется в соседней вкладке.<br />Материалы пространства останутся здесь.</p>
              <button className="resume-primary" onClick={() => onOpenExternal(tab)}>Открыть сайт <ArrowUpRight size={17} /></button>
            </div>
          )
        ) : (
          /* Empty / New Tab Start Screen */
          <div className="browser-start-screen">
            <div className="browser-start-card">
              <span className="browser-start-eyebrow">Материалы пространства</span>
              <h2>{space.name}</h2>
              <p className="browser-start-sub">Поиск и адрес сайта — в строке сверху. Или вернитесь к своему материалу.</p>
              <div className="browser-materials">
                {recentMaterials(space.resources).filter(resource => !resource.completedAt).slice(0, 6).map(resource => <button key={resource.id}
                  className="browser-material" onClick={() => resource.kind === 'link' ? onSelectQuickUrl?.(resource.target, resource.name) : onOpenResource(resource)}>
                  {resource.kind === 'link' ? <Globe2 size={19} /> : <FileText size={19} />}
                  <span><strong>{resource.name}</strong><small>{resourceAppLabel(resource)}</small></span><ArrowUpRight size={15} />
                </button>)}
              </div>
              <button className="browser-add-material" onClick={onAddLink}><Plus size={17} /> Сохранить ссылку</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
