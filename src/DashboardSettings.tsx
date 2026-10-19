import { useState } from 'react'
import { ArrowDown, ArrowUp, BookmarkPlus, Check, Plus, Trash2, X } from 'lucide-react'
import type { DashboardCustomPreset, WidgetConfig, WidgetType } from './types'
import { Dialog } from './Dialog'
import { builtinDashboardPresets, defaultWidgets, widgetDefaultSpan, widgetNames } from './dashboard'
import { WallpaperPicker } from './WallpaperPicker'

const PRESET_ICONS: Record<string, string> = {
  calm: '🧘',
  work: '⚡',
  overview: '☕',
  city: '🌤️',
  balance: '🌱'
}

export function DashboardSettings({
  widgets,
  preset,
  customPresets = [],
  backgroundImage,
  onChange,
  onPresetChange,
  onSaveCustomPreset,
  onDeleteCustomPreset,
  onBackgroundChange,
  onClose,
  initialTab = 'widgets'
}: {
  widgets: WidgetConfig[]
  preset?: string
  customPresets?: DashboardCustomPreset[]
  backgroundImage?: string
  onChange: (widgets: WidgetConfig[]) => void
  onPresetChange?: (presetId: string, widgets: WidgetConfig[]) => void
  onSaveCustomPreset?: (name: string, widgets: WidgetConfig[]) => void
  onDeleteCustomPreset?: (presetId: string) => void
  onBackgroundChange?: (url: string) => void
  onClose: () => void
  initialTab?: 'widgets' | 'presets' | 'wallpaper'
}) {
  const [tab, setTab] = useState<'widgets' | 'presets' | 'wallpaper'>(initialTab)
  const [undo, setUndo] = useState<WidgetConfig[] | null>(null)
  const [newPresetName, setNewPresetName] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  const change = (next: WidgetConfig[]) => {
    setUndo(widgets)
    onChange(next)
  }

  function move(index: number, direction: number) {
    const next = [...widgets]
    const target = index + direction
    if (!next[target]) return
    ;[next[index], next[target]] = [next[target], next[index]]
    change(next)
  }

  function handleApplyPreset(presetId: string, presetWidgets: WidgetConfig[]) {
    setUndo(widgets)
    if (onPresetChange) {
      onPresetChange(presetId, structuredClone(presetWidgets))
    } else {
      onChange(structuredClone(presetWidgets))
    }
  }

  function handleCreatePreset(e: React.FormEvent) {
    e.preventDefault()
    const formInput = (e.currentTarget as HTMLFormElement)?.querySelector('input')
    const trimmed = (newPresetName || formInput?.value || '').trim()
    if (!trimmed || !onSaveCustomPreset) return
    onSaveCustomPreset(trimmed, widgets)
    setNewPresetName('')
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  return (
    <Dialog title="Настроить главную" className="app-dialog dashboard-settings-dialog" onClose={onClose}>
      <div className="calm-tabs" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={tab === 'widgets' ? 'selected' : ''}
          onClick={() => setTab('widgets')}
        >
          Виджеты
        </button>
        <button
          type="button"
          className={tab === 'presets' ? 'selected' : ''}
          onClick={() => setTab('presets')}
        >
          Пресеты
        </button>
        <button
          type="button"
          className={tab === 'wallpaper' ? 'selected' : ''}
          onClick={() => setTab('wallpaper')}
        >
          Фон и оформление
        </button>
      </div>

      {tab === 'widgets' && (
        <>
          <div className="widget-settings">
            {widgets.map((widget, index) => (
              <div
                className="widget-settings-row"
                key={widget.id}
                draggable
                onDragStart={event => event.dataTransfer.setData('text/plain', String(index))}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault()
                  const from = Number(event.dataTransfer.getData('text/plain'))
                  if (!Number.isInteger(from) || !widgets[from]) return
                  const next = [...widgets]
                  const [item] = next.splice(from, 1)
                  next.splice(index, 0, item)
                  change(next)
                }}
              >
                <strong>{widgetNames[widget.type]}</strong>
                <select
                  aria-label={`Размер: ${widgetNames[widget.type]}`}
                  value={widget.size}
                  onChange={event =>
                    change(
                      widgets.map(item =>
                        item.id === widget.id
                          ? { ...item, size: event.target.value as WidgetConfig['size'] }
                          : item
                      )
                    )
                  }
                >
                  {['S', 'M', 'L'].map(size => (
                    <option key={size}>{size}</option>
                  ))}
                </select>
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Выше: ${widgetNames[widget.type]}`}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === widgets.length - 1}
                  aria-label={`Ниже: ${widgetNames[widget.type]}`}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  onClick={() => change(widgets.filter(item => item.id !== widget.id))}
                  aria-label={`Скрыть: ${widgetNames[widget.type]}`}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="widget-add-list">
            {(Object.keys(widgetNames) as WidgetType[])
              .filter(type => !widgets.some(item => item.type === type))
              .map(type => (
                <button
                  key={type}
                  onClick={() =>
                    change([
                      ...widgets,
                      {
                        id: crypto.randomUUID ? crypto.randomUUID() : `w-${Date.now()}`,
                        type,
                        size: 'M',
                        ...widgetDefaultSpan(type)
                      }
                    ])
                  }
                >
                  <Plus size={15} />
                  {widgetNames[type]}
                </button>
              ))}
          </div>

          <div className="calm-dialog-actions">
            <button
              className="calm-text-button"
              disabled={!undo}
              onClick={() => {
                if (undo) {
                  onChange(undo)
                  setUndo(null)
                }
              }}
            >
              Отменить изменение
            </button>
            <button
              className="calm-text-button"
              onClick={() => change(structuredClone(defaultWidgets))}
            >
              Стандартный вид
            </button>
            <button className="calm-primary" onClick={onClose}>
              Готово
            </button>
          </div>
        </>
      )}

      {tab === 'presets' && (
        <div className="preset-settings-section">
          <div className="preset-group-card">
            <h4>Готовые варианты</h4>
            <div className="preset-card-list" role="radiogroup" aria-label="Готовые пресеты">
              {builtinDashboardPresets.map(p => {
                const isActive = preset === p.id
                return (
                  <div
                    key={p.id}
                    className={`preset-card-item ${isActive ? 'is-selected' : ''}`}
                    role="radio"
                    aria-checked={isActive}
                    tabIndex={0}
                    onClick={() => handleApplyPreset(p.id, p.widgets)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleApplyPreset(p.id, p.widgets)
                      }
                    }}
                  >
                    <div className="preset-icon-badge" aria-hidden="true">
                      {PRESET_ICONS[p.id] || '✨'}
                    </div>
                    <div className="preset-card-info">
                      <strong>{p.name}</strong>
                      <small>{p.description}</small>
                    </div>
                    <div className="preset-card-actions">
                      {isActive ? (
                        <span className="preset-active-badge calm-tag">
                          <Check size={13} strokeWidth={2.4} /> Активен
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="preset-apply-btn soft-button"
                          onClick={e => {
                            e.stopPropagation()
                            handleApplyPreset(p.id, p.widgets)
                          }}
                        >
                          Применить
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {customPresets.length > 0 && (
            <div className="preset-group-card">
              <h4>Ваши сохранённые пресеты</h4>
              <div className="preset-card-list" role="radiogroup" aria-label="Сохранённые пресеты">
                {customPresets.map(cp => {
                  const isActive = preset === cp.id
                  return (
                    <div
                      key={cp.id}
                      className={`preset-card-item ${isActive ? 'is-selected' : ''}`}
                      role="radio"
                      aria-checked={isActive}
                      tabIndex={0}
                      onClick={() => handleApplyPreset(cp.id, cp.widgets)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleApplyPreset(cp.id, cp.widgets)
                        }
                      }}
                    >
                      <div className="preset-icon-badge" aria-hidden="true">
                        🔖
                      </div>
                      <div className="preset-card-info">
                        <strong>{cp.name}</strong>
                        <small>Карточек: {cp.widgets.length}</small>
                      </div>
                      <div className="preset-card-actions">
                        {isActive ? (
                          <span className="preset-active-badge calm-tag">
                            <Check size={13} strokeWidth={2.4} /> Активен
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="preset-apply-btn soft-button"
                            onClick={e => {
                              e.stopPropagation()
                              handleApplyPreset(cp.id, cp.widgets)
                            }}
                          >
                            Применить
                          </button>
                        )}
                        {onDeleteCustomPreset && (
                          <button
                            type="button"
                            className="preset-delete-btn"
                            onClick={e => {
                              e.stopPropagation()
                              onDeleteCustomPreset(cp.id)
                            }}
                            title="Удалить пресет"
                            aria-label={`Удалить пресет ${cp.name}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {onSaveCustomPreset && (
            <div className="preset-create-card">
              <h4>Сохранить текущую раскладку</h4>
              <form className="preset-create-form" onSubmit={handleCreatePreset}>
                <input
                  type="text"
                  placeholder="Название нового пресета…"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  maxLength={40}
                  aria-label="Название нового пресета"
                />
                <button
                  type="submit"
                  className="preset-save-btn soft-button"
                  disabled={!newPresetName.trim()}
                >
                  <BookmarkPlus size={15} />
                  <span>{savedSuccess ? 'Сохранено!' : 'Сохранить'}</span>
                </button>
              </form>
            </div>
          )}

          <div className="calm-dialog-actions" style={{ marginTop: 16 }}>
            <button className="calm-primary" onClick={onClose}>
              Готово
            </button>
          </div>
        </div>
      )}

      {tab === 'wallpaper' && (
        <>
          {onBackgroundChange && (
            <WallpaperPicker current={backgroundImage} onChange={onBackgroundChange} />
          )}
          <div className="calm-dialog-actions" style={{ marginTop: 20 }}>
            <button className="calm-primary" onClick={onClose}>
              Готово
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
