import { useEffect, useState } from 'react'
import { Check, Loader2, RefreshCw, Search } from 'lucide-react'
import { Dialog } from '../Dialog'
import { bridge } from '../bridge'
import type { OpenWindowItem, Space } from '../types'
import { productIcon } from '../App'

interface Props {
  space: Space
  onClose: () => void
  onSelect: (win: OpenWindowItem) => void
}

export function OpenWindowPickerModal({ space, onClose, onSelect }: Props) {
  const [windows, setWindows] = useState<OpenWindowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const fetchWindows = async () => {
    setLoading(true)
    try {
      const list = await bridge.osWindows?.listOpen()
      setWindows(list || [])
    } catch {
      setWindows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchWindows()
  }, [])

  const existingHwnds = new Set(
    space.resources
      .filter(r => r.kind === 'window' && r.windowHwnd)
      .map(r => r.windowHwnd!.toLowerCase())
  )

  const filtered = windows.filter(win => {
    const text = `${win.title} ${win.exeName}`.toLowerCase()
    return text.includes(query.toLowerCase().trim())
  })

  return (
    <Dialog title="Привязать открытое окно" onClose={onClose} className="window-picker-dialog">
      <div className="window-picker-container">
        <div className="window-picker-toolbar">
          <label className="window-picker-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск по названию окна или программе…"
              autoFocus
              data-dialog-focus
            />
          </label>
          <button
            type="button"
            className="calm-icon-button"
            onClick={fetchWindows}
            disabled={loading}
            title="Обновить список окон"
            aria-label="Обновить список окон"
          >
            <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />
          </button>
        </div>

        <div className="window-picker-list" role="listbox" aria-label="Список открытых окон">
          {loading ? (
            <div className="window-picker-status">
              <Loader2 size={24} className="is-spinning" />
              <span>Опрашиваем запущенные окна…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="window-picker-status">
              <span>{query ? 'Подходящих окон не найдено' : 'Нет доступных окон для привязки'}</span>
            </div>
          ) : (
            filtered.map(win => {
              const isAlreadyAdded = existingHwnds.has(win.hwnd.toLowerCase())
              return (
                <button
                  key={win.hwnd}
                  type="button"
                  className={`window-picker-item ${isAlreadyAdded ? 'is-attached' : ''}`}
                  disabled={isAlreadyAdded}
                  onClick={() => onSelect(win)}
                  title={isAlreadyAdded ? 'Это окно уже привязано к кабинету' : `Привязать «${win.title}»`}
                >
                  <div className="window-picker-icon">
                    {productIcon(win.exeName || win.title)}
                  </div>
                  <div className="window-picker-info">
                    <span className="window-picker-title">{win.title}</span>
                    <span className="window-picker-meta">
                      {win.exeName}
                      {win.isMinimized && ' · Свёрнуто'}
                    </span>
                  </div>
                  <div className="window-picker-action">
                    {isAlreadyAdded ? (
                      <span className="window-picker-badge">
                        <Check size={14} /> Привязано
                      </span>
                    ) : (
                      <span className="window-picker-add-label">+ Привязать</span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </Dialog>
  )
}
