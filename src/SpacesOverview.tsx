import { type HTMLAttributes } from 'react'
import { Archive, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import type { Space } from './types'
import './spaces.css'
import { ActionMenu, type MenuAction } from './ActionMenu'
import { plural } from './ContinuationFooter'
import { FileTypeBadge, SiteMark } from './FileTypeBadge'
import { lastOpened } from './SpaceThreshold'

/** What brings you back to a space: its next step, otherwise the pages it holds. */
function spaceLead(space: Space, tabs: { title: string }[]) {
  if (space.checkpoint?.nextStep) return { label: 'Дальше:', text: space.checkpoint.nextStep }
  if (tabs.length) return { label: '', text: tabs.slice(0, 2).map(tab => tab.title).join(' · ') }
  if (space.resources.length) return { label: '', text: space.resources.slice(0, 2).map(resource => resource.name).join(' · ') }
  return { label: '', text: 'Пока пусто' }
}

export function SpacesOverview({ spaces, hasArchive, onOpen, onCreate, onArchive, onPin, onRename, onArchiveSpace, onDelete, interactions, actionsForSpace, dropSpaceId }: { spaces: Space[]; hasArchive: boolean; onOpen: (id: string) => void; onCreate: () => void; onArchive: () => void; onPin?: (space: Space) => void; onRename?: (space: Space) => void; onArchiveSpace?: (space: Space) => void; onDelete?: (space: Space) => void; interactions?: (space: Space) => HTMLAttributes<HTMLElement>; actionsForSpace?: (space: Space) => MenuAction[]; dropSpaceId?: string }) {
  return <main className="collection-stage spaces-stage" aria-label="Пространства">
    <div className="collection-header spaces-header">
      <div className="spaces-title"><h1>Пространства</h1><span>{spaces.length}</span></div>
      <div className="spaces-header-actions">
        {hasArchive && <button className="soft-button" title="Архив пространств" onClick={onArchive}><Archive size={17} /><span>Архив</span></button>}
        <button className="primary-button" onClick={onCreate}><Plus size={18} /><span>Создать</span></button>
      </div>
    </div>
    <div className="spaces-grid" aria-label="Список пространств">
      {spaces.map(space => {
        const tabs = (space.activeSession?.tabs || []).filter(tab => tab.url)
        const files = space.resources.filter(resource => resource.kind === 'file' && !resource.completedAt)
        const lead = spaceLead(space, tabs)
        const when = lastOpened(space.checkpoint?.savedAt || space.lastActiveAt)
        return (
          <div
            {...interactions?.(space)}
            data-cabinet-space-target
            className={`overview-space cabinet-card tone-${space.tone}${dropSpaceId === space.id ? ' is-drop-target' : ''}`}
            key={space.id}
            data-space-id={space.id}
          >
            <button
              draggable={Boolean(interactions && interactions(space)?.draggable)}
              className="overview-space-open"
              title={space.name}
              onClick={() => onOpen(space.id)}
            >
              <span className="overview-space-name"><i aria-hidden="true" /><span>{space.name}</span></span>
              <span className={`overview-space-lead${lead.label ? '' : ' is-quiet'}`}>{lead.label && <em>{lead.label}</em>} {lead.text}</span>
              {when && <span className="overview-space-when">{when}</span>}
              <span className="overview-space-foot">
                {tabs.length > 0 && (
                  <span className="overview-space-chip">
                    <span className="overview-space-marks">{tabs.slice(0, 3).map(tab => <SiteMark key={tab.id} url={tab.url} title={tab.title} />)}</span>
                    {tabs.length} {plural(tabs.length, 'вкладка', 'вкладки', 'вкладок')}
                  </span>
                )}
                {files.length > 0 && (
                  <span className="overview-space-chip">
                    <span className="overview-space-marks">{files.slice(0, 3).map(file => <FileTypeBadge key={file.id} name={file.target || file.name} />)}</span>
                    {files.length} {plural(files.length, 'файл', 'файла', 'файлов')}
                  </span>
                )}
              </span>
            </button>
            <ActionMenu
              className="overview-space-menu"
              label={`Действия с пространством «${space.name}»`}
              actions={actionsForSpace?.(space) || [
                { label: space.pinned ? 'Открепить из меню' : 'Закрепить в меню', icon: <Pin size={16} />, onSelect: () => onPin?.(space) },
                { label: 'Переименовать', icon: <Pencil size={16} />, onSelect: () => onRename?.(space) },
                { label: 'В архив', icon: <Archive size={16} />, onSelect: () => onArchiveSpace?.(space) },
                { label: 'Удалить пространство', icon: <Trash2 size={16} />, tone: 'danger', onSelect: () => onDelete?.(space) }
              ]}
            />
          </div>
        )
      })}
    </div>
  </main>
}
