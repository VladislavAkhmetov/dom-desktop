import { useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { AppWindow, Bookmark, ChevronDown, ChevronUp, FileText, Folder, Globe2, Image, Search, X } from 'lucide-react'
import { ActionMenu, type MenuAction } from './ActionMenu'
import { useContextMenu } from './ContextMenu'
import { cabinetContents, readCabinetDrag, type CabinetDrag } from './cabinetInteractions'
import { TabIcon } from './browser/TabIcon'
import { resourceAppLabel } from './resourcePresentation'
import type { BrowserTab, Resource, Space } from './types'

function pageDomain(url: string) { try { return new URL(url).hostname.replace(/^www\./, '') || 'Страница' } catch { return 'Страница' } }
function documentFormat(resource: Resource) { const extension = resource.target.match(/\.([a-z0-9]+)$/i)?.[1]; return extension ? `.${extension.toLowerCase()}` : 'Файл' }

export function CabinetContents({ space, destinations, covers, drag, pointerTabTarget, onPointerStart, onSelectTab, onCloseTab, onSaveTab, onMoveTab, onReorderTab, onOpen, onRemove, onCopy, onAddDocument, onAddLink, onStartDrag, onFinishDrag }: {
  space: Space; destinations: Space[]; covers: Record<string, string>; drag: CabinetDrag | null
  onSelectTab: (id: string) => void; onCloseTab: (id: string) => void; onSaveTab: (tab: BrowserTab) => void
  onMoveTab: (id: string, spaceId: string) => void; onReorderTab: (id: string, targetId: string, after: boolean) => void
  onOpen: (resource: Resource) => void; onRemove: (id: string) => void; onCopy: (resource: Resource, spaceId: string) => void
  onAddDocument: () => void; onAddLink: () => void
  onStartDrag: (event: DragEvent<HTMLElement>, value: CabinetDrag) => void; onFinishDrag: () => void
  pointerTabTarget?: string; onPointerStart?: (event: PointerEvent<HTMLElement>, value: CabinetDrag) => void
}) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<'all' | 'file' | 'link'>('all')
  const [expanded, setExpanded] = useState(false), [previews, setPreviews] = useState(false), [dropTab, setDropTab] = useState('')
  const localDrag = useRef<CabinetDrag | null>(null)
  function beginDrag(event: DragEvent<HTMLElement>, value: CabinetDrag) { onStartDrag(event, value); if (!event.defaultPrevented) localDrag.current = value }
  function finishDrag() { localDrag.current = null; setDropTab(''); onFinishDrag() }
  const context = useContextMenu()
  const contents = cabinetContents(space), needle = query.trim().toLocaleLowerCase('ru')
  const matches = (name: string, target: string) => `${name} ${target}`.toLocaleLowerCase('ru').includes(needle)
  const tabs = filter === 'file' ? [] : contents.tabs.filter(tab => matches(tab.title, tab.url))
  const materials = contents.materials.filter(resource => (filter === 'all' || resource.kind === filter) && matches(resource.name, resource.target))
    .sort((a, b) => Number(b.kind === 'file') - Number(a.kind === 'file'))
  const tools = filter === 'all' ? contents.tools.filter(resource => matches(resource.name, resource.target)) : []
  const shownTabs = expanded || needle ? tabs : tabs.slice(0, 6)
  const hasCovers = tabs.some(tab => /^data:image\/(png|jpeg|webp);base64,/i.test(covers[tab.id] || ''))
  const materialActions = (resource: Resource): MenuAction[] => [
    { label: resource.kind === 'file' ? 'Открыть документ' : resource.kind === 'app' ? 'Открыть приложение' : 'Открыть сайт', icon: resource.kind === 'file' ? <FileText size={16} /> : resource.kind === 'app' ? <AppWindow size={16} /> : <Globe2 size={16} />, onSelect: () => onOpen(resource) },
    ...destinations.map(destination => ({ id: destination.id, label: `Также в «${destination.name}»`, icon: <Folder size={16} />, onSelect: () => onCopy(resource, destination.id) })),
    { label: 'Убрать из пространства', icon: <X size={16} />, onSelect: () => onRemove(resource.id) }
  ]
  const tabActions = (tab: BrowserTab): MenuAction[] => [
    { label: 'Открыть вкладку', icon: <Globe2 size={16} />, onSelect: () => onSelectTab(tab.id) },
    { label: 'Сохранить ссылку', icon: <Bookmark size={16} />, onSelect: () => onSaveTab(tab) },
    ...destinations.map(destination => ({ id: destination.id, label: `Перенести в «${destination.name}»`, icon: <Folder size={16} />, onSelect: () => onMoveTab(tab.id, destination.id) })),
    { label: 'Закрыть вкладку', icon: <X size={16} />, onSelect: () => onCloseTab(tab.id) }
  ]
  return <section className="cabinet-contents" aria-label={`Содержимое пространства ${space.name}`}>
    <div className="cabinet-content-toolbar">
      <label className="cabinet-content-search"><Search size={17} /><input aria-label="Найти в пространстве" placeholder="Найти в пространстве" value={query} onChange={event => setQuery(event.target.value)} />{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск"><X size={15} /></button>}</label>
      <div className="cabinet-content-filters" aria-label="Тип содержимого">{([['all', 'Все'], ['file', 'Документы'], ['link', 'Сайты']] as const).map(([value, label]) => <button key={value} aria-pressed={value === filter} onClick={() => setFilter(value)}>{label}</button>)}</div>
      {hasCovers && <button className="cabinet-preview-toggle" aria-pressed={previews} onClick={() => setPreviews(value => !value)} title="Снимки ранее просмотренных страниц"><Image size={16} />Миниатюры</button>}
    </div>
    <div className="cabinet-contents-scroll">
      {tabs.length > 0 && <section className="cabinet-content-section" aria-label="Вкладки пространства">
        <div className="cabinet-section-heading"><h2>Вкладки <span>{tabs.length}</span></h2>{!needle && tabs.length > 6 && <button aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Свернуть' : `Показать все · ${tabs.length}`}{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>}</div>
        <div className={`cabinet-tab-grid${previews ? ' with-previews' : ''}`}>{shownTabs.map(tab => {
          const saved = space.resources.some(resource => resource.kind === 'link' && resource.target === tab.url)
          const cover = previews && /^data:image\/(png|jpeg|webp);base64,/i.test(covers[tab.id] || '') ? covers[tab.id] : ''
          const actions = tabActions(tab), label = `Действия с вкладкой «${tab.title}»`
          return <div key={tab.id} data-tab-id={tab.id} data-cabinet-owner={space.id} className={`cabinet-tab-card card${dropTab === tab.id || pointerTabTarget === tab.id ? ' is-drop-target' : ''}`} draggable onPointerDown={event => onPointerStart?.(event, { kind: 'tab', spaceId: space.id, id: tab.id })} onDragStart={event => beginDrag(event, { kind: 'tab', spaceId: space.id, id: tab.id })} onDragEnd={finishDrag} onDragOver={event => {
            const dragging = localDrag.current || drag
            if (dragging?.kind !== 'tab' || dragging.spaceId !== space.id || dragging.id === tab.id) return
            event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setDropTab(tab.id)
          }} onDragLeave={() => setDropTab('')} onDrop={event => {
            const value = readCabinetDrag(event)
            if (value?.kind !== 'tab' || value.spaceId !== space.id || value.id === tab.id) return
            event.preventDefault(); event.stopPropagation()
            onReorderTab(value.id, tab.id, event.clientX > event.currentTarget.getBoundingClientRect().left + event.currentTarget.getBoundingClientRect().width / 2)
            finishDrag()
          }} onContextMenu={event => context.open(event, label, actions)} onKeyDown={event => context.open(event, label, actions)}>
            <button draggable className="cabinet-tab-open" aria-label={`Открыть вкладку «${tab.title}»`} onClick={() => onSelectTab(tab.id)}>
              {cover && <span className="cabinet-page-fragment"><img src={cover} alt="" loading="lazy" decoding="async" draggable={false} /></span>}
              <span className="cabinet-tab-copy"><TabIcon tab={tab} /><span><strong title={tab.title}>{tab.title || pageDomain(tab.url)}</strong><small>{pageDomain(tab.url)}{saved && <span className="cabinet-saved-mark" title="Ссылка сохранена"><Bookmark size={12} />Сохранено</span>}</small></span></span>
            </button><ActionMenu label={label} actions={actions} />
          </div>
        })}</div>
      </section>}
      {materials.length > 0 && <section className="cabinet-content-section" aria-label="Документы и материалы">
        <div className="cabinet-section-heading"><h2>Документы и материалы <span>{materials.length}</span></h2></div>
        <div className="cabinet-material-grid">{materials.map(resource => {
          const actions = materialActions(resource), label = `Действия с материалом «${resource.name}»`
          return <div key={resource.id} data-resource-id={resource.id} data-resource-kind={resource.kind} className="cabinet-material-card card" draggable onPointerDown={event => onPointerStart?.(event, { kind: 'resource', spaceId: space.id, id: resource.id })} onDragStart={event => onStartDrag(event, { kind: 'resource', spaceId: space.id, id: resource.id })} onDragEnd={onFinishDrag} onContextMenu={event => context.open(event, label, actions)} onKeyDown={event => context.open(event, label, actions)}>
            <button draggable className="cabinet-material-open" onClick={() => onOpen(resource)} title={resource.target}>{resource.kind === 'file' ? <FileText size={22} /> : <Globe2 size={22} />}<span><strong>{resource.name}</strong><small>{resource.kind === 'file' ? `${documentFormat(resource)} · Открыть документ` : resourceAppLabel(resource)}</small></span></button>
            <ActionMenu label={label} actions={actions} />
          </div>
        })}</div>
      </section>}
      {!needle && filter === 'all' && !materials.length && (tabs.length > 0 || tools.length > 0) && <div className="cabinet-add-material"><button onClick={onAddLink}><Globe2 size={16} />Сохранить сайт</button><button onClick={onAddDocument}><FileText size={16} />Документ</button></div>}
      {tools.length > 0 && <section className="cabinet-content-section" aria-label="Инструменты пространства"><div className="cabinet-section-heading"><h2>Инструменты <span>{tools.length}</span></h2></div><div className="cabinet-tool-list">{tools.map(resource => {
        const actions = materialActions(resource), label = `Действия с материалом «${resource.name}»`
        return <div key={resource.id} data-resource-id={resource.id} className="cabinet-tool" draggable onPointerDown={event => onPointerStart?.(event, { kind: 'resource', spaceId: space.id, id: resource.id })} onDragStart={event => onStartDrag(event, { kind: 'resource', spaceId: space.id, id: resource.id })} onDragEnd={onFinishDrag} onContextMenu={event => context.open(event, label, actions)} onKeyDown={event => context.open(event, label, actions)}><button draggable onClick={() => onOpen(resource)}><AppWindow size={18} /><span>{resource.name}</span></button><ActionMenu label={label} actions={actions} /></div>
      })}</div></section>}
      {!tabs.length && !materials.length && !tools.length && <div className="cabinet-content-empty card"><Folder size={28} /><h2>{needle || filter !== 'all' ? 'Ничего не найдено' : 'Начните с нужного материала'}</h2>{!needle && filter === 'all' && <div><button onClick={onAddLink}><Globe2 size={17} />Сохранить сайт</button><button onClick={onAddDocument}><FileText size={17} />Документ</button></div>}</div>}
    </div>
    {context.menu}
  </section>
}
