import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import type { WidgetConfig, WidgetType } from './types'
import { Dialog } from './Dialog'
import { defaultWidgets, widgetNames } from './dashboard'
import { WallpaperPicker } from './WallpaperPicker'

export function DashboardSettings({
  widgets,
  backgroundImage,
  onChange,
  onBackgroundChange,
  onClose
}: {
  widgets: WidgetConfig[]
  backgroundImage?: string
  onChange: (widgets: WidgetConfig[]) => void
  onBackgroundChange?: (url: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'widgets' | 'wallpaper'>('widgets')
  const [undo, setUndo] = useState<WidgetConfig[] | null>(null)
  const change = (next: WidgetConfig[]) => { setUndo(widgets); onChange(next) }
  function move(index: number, direction: number) {
    const next = [...widgets]
    const target = index + direction
    if (!next[target]) return
    [next[index], next[target]] = [next[target], next[index]]
    change(next)
  }

  return (
    <Dialog title="Настроить главную" onClose={onClose}>
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
          className={tab === 'wallpaper' ? 'selected' : ''}
          onClick={() => setTab('wallpaper')}
        >
          Фон и оформление
        </button>
      </div>

      {tab === 'widgets' ? (
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
                  onChange={event => change(widgets.map(item => item.id === widget.id ? { ...item, size: event.target.value as WidgetConfig['size'] } : item))}
                >
                  {['S', 'M', 'L'].map(size => <option key={size}>{size}</option>)}
                </select>
                <button onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Выше: ${widgetNames[widget.type]}`}>
                  <ArrowUp size={16} />
                </button>
                <button onClick={() => move(index, 1)} disabled={index === widgets.length - 1} aria-label={`Ниже: ${widgetNames[widget.type]}`}>
                  <ArrowDown size={16} />
                </button>
                <button onClick={() => change(widgets.filter(item => item.id !== widget.id))} aria-label={`Скрыть: ${widgetNames[widget.type]}`}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="widget-add-list">
            {(Object.keys(widgetNames) as WidgetType[]).filter(type => !widgets.some(item => item.type === type)).map(type => (
              <button key={type} onClick={() => change([...widgets, { id: crypto.randomUUID(), type, size: 'M' }])}>
                <Plus size={15} />{widgetNames[type]}
              </button>
            ))}
          </div>
          <div className="calm-dialog-actions">
            <button className="calm-text-button" disabled={!undo} onClick={() => { if (undo) { onChange(undo); setUndo(null) } }}>
              Отменить изменение
            </button>
            <button className="calm-text-button" onClick={() => change(structuredClone(defaultWidgets))}>
              Стандартный вид
            </button>
            <button className="calm-primary" onClick={onClose}>
              Готово
            </button>
          </div>
        </>
      ) : (
        <>
          {onBackgroundChange && (
            <WallpaperPicker
              current={backgroundImage}
              onChange={onBackgroundChange}
            />
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
