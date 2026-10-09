import { useMemo, useState } from 'react'
import { Globe2, History, Search, Trash2, X } from 'lucide-react'
import { Dialog } from '../Dialog'
import type { HistoryItem } from '../types'
import {
  filterHistory,
  formatHistoryDomain,
  formatHistoryTime,
  groupHistoryByDate
} from './historyModel'
import './browser-history.css'

export interface BrowserHistoryProps {
  history?: HistoryItem[]
  onClose: () => void
  onNavigate: (url: string, newTab?: boolean) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function BrowserHistory({ history = [], onClose, onNavigate, onRemove, onClear }: BrowserHistoryProps) {
  const [query, setQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const filtered = useMemo(() => filterHistory(history, query), [history, query])
  const groups = useMemo(() => groupHistoryByDate(filtered), [filtered])

  function handleItemClick(event: React.MouseEvent, url: string) {
    const isNewTab = event.ctrlKey || event.metaKey || event.button === 1
    onNavigate(url, isNewTab)
    if (!isNewTab) onClose()
  }

  return (
    <Dialog className="browser-history-dialog" title="История браузера" onClose={onClose}>
      <div className="browser-history-header">
        <div className="browser-history-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="text"
            placeholder="Поиск по истории (название или адрес)…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            aria-label="Поиск по истории"
          />
          {Boolean(query) && (
            <button
              className="browser-history-search-clear"
              onClick={() => setQuery('')}
              title="Очистить поиск"
              aria-label="Очистить поиск"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {history.length > 0 && !confirmClear && (
          <button
            className="browser-history-clear-btn"
            onClick={() => setConfirmClear(true)}
            title="Очистить всю историю"
          >
            <Trash2 size={15} />
            <span>Очистить</span>
          </button>
        )}
      </div>

      {confirmClear && (
        <div className="browser-history-confirm-banner" role="alert">
          <span>Очистить всю историю просмотров? Это действие нельзя отменить.</span>
          <div className="browser-history-confirm-actions">
            <button
              className="browser-history-confirm-btn is-cancel"
              onClick={() => setConfirmClear(false)}
            >
              Отмена
            </button>
            <button
              className="browser-history-confirm-btn is-danger"
              onClick={() => {
                onClear()
                setConfirmClear(false)
              }}
            >
              Очистить историю
            </button>
          </div>
        </div>
      )}

      <div className="browser-history-list" role="feed" aria-label="Записи истории">
        {filtered.length === 0 ? (
          <div className="browser-history-empty">
            <History size={40} strokeWidth={1.5} />
            <p>{query ? 'Ничего не найдено' : 'История просмотров пуста'}</p>
            <small>{query ? 'Попробуйте изменить поисковый запрос' : 'Посещённые страницы будут появляться здесь'}</small>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label} className="browser-history-group">
              <div className="browser-history-group-title">{group.label}</div>
              <div className="browser-history-group-items">
                {group.items.map(item => (
                  <div
                    key={item.id}
                    className="browser-history-item"
                    onClick={e => handleItemClick(e, item.url)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        onNavigate(item.url, e.ctrlKey || e.metaKey)
                        onClose()
                      }
                    }}
                  >
                    <div className="browser-history-item-icon">
                      {item.favicon ? (
                        <img
                          src={item.favicon}
                          alt=""
                          onError={e => {
                            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <Globe2 size={15} />
                      )}
                    </div>
                    <div className="browser-history-item-details">
                      <div className="browser-history-item-title" title={item.title}>
                        {item.title}
                      </div>
                      <div className="browser-history-item-url" title={item.url}>
                        {formatHistoryDomain(item.url)}
                      </div>
                    </div>
                    <span className="browser-history-time">
                      {formatHistoryTime(item.visitedAt)}
                    </span>
                    <button
                      className="browser-history-remove-btn"
                      onClick={e => {
                        e.stopPropagation()
                        onRemove(item.id)
                      }}
                      title="Удалить запись"
                      aria-label={`Удалить ${item.title} из истории`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {history.length > 0 && (
        <div className="browser-history-footer">
          <span>{query ? `Найдено: ${filtered.length}` : `Всего записей: ${history.length}`}</span>
          <span>Нажмите Ctrl+клик для открытия в новой вкладке</span>
        </div>
      )}
    </Dialog>
  )
}
