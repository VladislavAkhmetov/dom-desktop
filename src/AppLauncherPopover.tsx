import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, FolderOpen, Plus } from 'lucide-react'
import type { Resource } from './types'

interface Props {
  app: Resource
  recentDocuments: Array<Resource & { spaceName?: string }>
  now: Date
  appIcon: (name: string) => ReactNode
  onOpenDocument: (resource: Resource) => void
  onOpenApp: (appResource: Resource) => void
  onNewDocument: () => void
  onAddDocument: () => void
  onClose: () => void
}

function formatRelativeTime(isoDate?: string, now: Date = new Date()): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return ''

  const nowDate = new Date(now)
  nowDate.setHours(0, 0, 0, 0)

  const targetDate = new Date(d)
  targetDate.setHours(0, 0, 0, 0)

  const diffDays = Math.round((nowDate.getTime() - targetDate.getTime()) / (24 * 60 * 60 * 1000))
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (diffDays === 0) return `Сегодня, ${time}`
  if (diffDays === 1) return `Вчера, ${time}`
  if (diffDays === 2) return `Позавчера, ${time}`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function AppLauncherPopover({
  app,
  recentDocuments,
  now,
  appIcon,
  onOpenDocument,
  onOpenApp,
  onNewDocument,
  onAddDocument,
  onClose
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const isFigma = /figma/i.test(app.name)
  const isIllustrator = /illustrator/i.test(app.name)
  const [quickLinkUrl, setQuickLinkUrl] = useState('')
  const [showQuickLink, setShowQuickLink] = useState(false)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  function handleSaveQuickLink(e: React.FormEvent) {
    e.preventDefault()
    const target = quickLinkUrl.trim()
    if (!target) return
    let name = 'Макет Figma'
    try {
      const url = new URL(target)
      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2) {
        name = decodeURIComponent(pathParts[pathParts.length - 1].replace(/[-_]/g, ' '))
      }
    } catch {
      // Keep default name if parsing fails
    }
    const docResource: Resource = {
      id: crypto.randomUUID(),
      name,
      kind: 'link',
      target,
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString()
    }
    onOpenDocument(docResource)
  }

  return (
    <div
      className="calm-app-popover"
      ref={popoverRef}
      role="dialog"
      aria-label={`Документы ${app.name}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Шапка поповера */}
      <div className="app-popover-header">
        <div className="app-popover-title">
          <span className="calm-app-icon">{appIcon(app.name)}</span>
          <strong>{app.name}</strong>
        </div>
        <button
          className="app-popover-open-app"
          onClick={() => onOpenApp(app)}
          title={isFigma ? 'Открыть файлы на figma.com' : 'Запустить главное окно приложения'}
        >
          <span>{isFigma ? 'Все файлы' : 'Главная'}</span>
          <ArrowUpRight size={13} />
        </button>
      </div>

      {/* Быстрое действие: Создать новый */}
      <div className="app-popover-actions">
        <button
          className="app-new-btn"
          onClick={onNewDocument}
          title={isFigma ? 'Создать новый черновик в Figma (figma.new)' : 'Открыть новый документ'}
        >
          <Plus size={15} strokeWidth={2.4} />
          <span>{isFigma ? 'Новый холст' : isIllustrator ? 'Новый документ' : 'Создать'}</span>
        </button>
      </div>

      {/* Список недавних документов */}
      <div className="app-doc-section">
        <div className="app-doc-heading">
          <span className="app-doc-eyebrow">Недавние</span>
        </div>

        <div className="app-doc-list">
          {recentDocuments.slice(0, 5).map((doc) => (
            <button
              key={doc.id}
              className="app-doc-item"
              onClick={() => onOpenDocument(doc)}
              title={`Открыть: ${doc.name}`}
            >
              <div className="app-doc-item-text">
                <span className="app-doc-name">{doc.name}</span>
                <span className="app-doc-meta">
                  {formatRelativeTime(doc.lastOpenedAt || doc.createdAt, now)}
                </span>
              </div>
              <ArrowUpRight size={13} className="app-doc-arrow" />
            </button>
          ))}

          {recentDocuments.length === 0 && (
            <div className="app-doc-empty">
              <span>Документы появятся после открытия</span>
            </div>
          )}
        </div>
      </div>

      {/* Нижняя панель действий */}
      <div className="app-popover-footer">
        {isFigma && (
          <>
            {!showQuickLink ? (
              <button
                className="app-footer-btn"
                onClick={() => setShowQuickLink(true)}
              >
                <Plus size={13} />
                <span>Вставить ссылку на макет</span>
              </button>
            ) : (
              <form className="app-quick-link-form" onSubmit={handleSaveQuickLink}>
                <input
                  type="url"
                  placeholder="Ссылка на макет figma.com/..."
                  value={quickLinkUrl}
                  onChange={(e) => setQuickLinkUrl(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className="app-quick-link-submit"
                  disabled={!quickLinkUrl.trim()}
                >
                  Открыть
                </button>
              </form>
            )}
          </>
        )}

        {isIllustrator && (
          <button
            className="app-footer-btn"
            onClick={onAddDocument}
          >
            <FolderOpen size={14} />
            <span>Выбрать файл...</span>
          </button>
        )}

        {!isFigma && !isIllustrator && (
          <button
            className="app-footer-btn"
            onClick={onAddDocument}
          >
            <Plus size={13} />
            <span>Добавить</span>
          </button>
        )}
      </div>
    </div>
  )
}
