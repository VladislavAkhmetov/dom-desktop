import { useState } from 'react'
import { FileText, Folder, Globe2, AppWindow, Pencil, Plus, Pin, Search, X } from 'lucide-react'
import { ActionMenu } from '../ActionMenu'
import type { RecentFile, Resource, ResourceKind, Space } from '../types'
import { currentContext } from '../workContexts'
import { resourceAppLabel } from '../resourcePresentation'
import '../cabinet.css'

export function SpacePanel({
  space,
  onClose,
  onOpen,
  onEdit,
  onPin,
  onAddLink,
  onAddDocument,
  onAddWindow,
  onRemove,
  onCopy,
  destinations,
  suggestedRecentFile,
  onAddRecentFile,
  onDismissRecentFile
}: {
  space: Space
  onClose: () => void
  onOpen: (resource: Resource) => void
  onEdit: () => void
  onPin: () => void
  onAddLink: () => void
  onAddDocument: () => void
  onAddWindow?: () => void
  onRemove: (id: string) => void
  onCopy: (resource: Resource, spaceId: string) => void
  destinations: Space[]
  suggestedRecentFile?: RecentFile | null
  onAddRecentFile?: (file: RecentFile) => void
  onDismissRecentFile?: (target: string) => void
}) {
  const [filter, setFilter] = useState<ResourceKind | 'all'>('all')
  const [query, setQuery] = useState('')
  const checkpoint = currentContext(space).checkpoint
  const resources = space.resources.filter(resource => (filter === 'all' || resource.kind === filter)
    && `${resource.name} ${resource.target}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')))

  return (
    <aside className="space-panel" aria-label={`Материалы пространства ${space.name}`}>
      <div className="space-panel-heading">
        <Folder size={18} />
        <h2>{space.name}</h2>
        <button
          className={space.pinned ? 'is-selected' : ''}
          onClick={onPin}
          aria-pressed={Boolean(space.pinned)}
          title={space.pinned ? 'Открепить от меню' : 'Закрепить в меню'}
          aria-label={space.pinned ? 'Открепить пространство' : 'Закрепить пространство'}
        >
          <Pin size={17} />
        </button>
        <button onClick={onClose} aria-label="Закрыть материалы"><X size={18} /></button>
      </div>
      <div className="space-panel-scroll">
        <div className="space-panel-continuation">
          <div>
            <span>Продолжение</span>
            <button onClick={onEdit} aria-label="Настроить продолжение пространства"><Pencil size={15} /></button>
          </div>
          {checkpoint?.nextStep ? <p>{checkpoint.nextStep}</p> : <button className="space-panel-add-step" onClick={onEdit}>Оставить следующий шаг</button>}
          {checkpoint?.note && <small>{checkpoint.note}</small>}
        </div>

        <div className="space-panel-section-heading">
          <h3>Материалы <small>{space.resources.length}</small></h3>
          <ActionMenu
            label="Добавить материал"
            triggerContent={<><Plus size={16} /><span>Добавить</span></>}
            actions={[
              { label: 'Ссылка', icon: <Globe2 size={17} />, onSelect: onAddLink },
              { label: 'Документ', icon: <FileText size={17} />, onSelect: onAddDocument },
              ...(onAddWindow ? [{ label: 'Открытое окно', icon: <AppWindow size={17} />, onSelect: onAddWindow }] : [])
            ]}
          />
        </div>

        {suggestedRecentFile && (
          <div style={{ margin: '8px 0 4px' }}>
            <div className="cabinet-recent-chip" title={suggestedRecentFile.target}>
              <button
                type="button"
                className="cabinet-recent-chip-btn"
                onClick={() => onAddRecentFile?.(suggestedRecentFile)}
                aria-label={`Добавить недавний файл «${suggestedRecentFile.name}»`}
              >
                <FileText size={14} />
                <span className="cabinet-recent-chip-name">{suggestedRecentFile.name}</span>
                <span className="cabinet-recent-chip-add" title="Добавить в материалы">+</span>
              </button>
              {onDismissRecentFile && (
                <button
                  type="button"
                  className="cabinet-recent-chip-dismiss"
                  onClick={() => onDismissRecentFile(suggestedRecentFile.target)}
                  aria-label="Скрыть"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        <label className="space-panel-search">
          <Search size={16} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="Найти материал"
            placeholder="Найти материал"
          />
        </label>

        <div className="space-panel-filters" aria-label="Тип материалов">
          {([
            ['all', 'Все'],
            ['link', 'Ссылки'],
            ['file', 'Документы'],
            ['window', 'Окна'],
            ['app', 'Приложения']
          ] as const).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-panel-materials">
          {resources.map(resource => (
            <div key={resource.id} className="space-panel-material">
              <button onClick={() => onOpen(resource)} title={resource.target}>
                {resource.kind === 'link' ? <Globe2 size={18} /> : resource.kind === 'file' ? <FileText size={18} /> : <AppWindow size={18} />}
                <span>
                  <strong>{resource.name}</strong>
                  <small>{resourceAppLabel(resource)}</small>
                </span>
              </button>
              <ActionMenu
                label={`Действия с материалом ${resource.name}`}
                actions={[
                  ...destinations.map(destination => ({
                    label: `Также в «${destination.name}»`,
                    icon: <Folder size={16} />,
                    onSelect: () => onCopy(resource, destination.id)
                  })),
                  { label: 'Убрать из пространства', icon: <X size={16} />, onSelect: () => onRemove(resource.id) }
                ]}
              />
            </div>
          ))}
        </div>

        {!resources.length && (
          <p className="space-panel-empty">
            {query || filter !== 'all' ? 'Подходящих материалов нет.' : 'Ссылки, референсы, окна и документы для этой задачи появятся здесь.'}
          </p>
        )}
      </div>
    </aside>
  )
}
