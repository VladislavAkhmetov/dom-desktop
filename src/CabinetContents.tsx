import { useRef, useState, type DragEvent, type PointerEvent } from 'react'
import {
  AppWindow,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Compass,
  FileText,
  Folder,
  Globe2,
  Image,
  Link2,
  Search,
  X
} from 'lucide-react'
import { ActionMenu, type MenuAction } from './ActionMenu'
import { useContextMenu } from './ContextMenu'
import { cabinetContents, readCabinetDrag, type CabinetDrag } from './cabinetInteractions'
import { TabIcon } from './browser/TabIcon'
import { resourceAppLabel } from './resourcePresentation'
import type { BrowserTab, RecentFile, Resource, Space } from './types'

function pageDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'Страница'
  } catch {
    return 'Страница'
  }
}

function documentFormat(resource: Resource) {
  const extension = resource.target.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  if (extension) {
    switch (extension) {
      case 'psd': return '.psd · Photoshop'
      case 'ai': return '.ai · Illustrator'
      case 'fig': return 'Figma · Документ'
      case 'pdf': return '.pdf · Документ'
      case 'docx':
      case 'doc': return `.${extension} · Word`
      case 'xlsx':
      case 'xls': return `.${extension} · Excel`
      case 'pptx':
      case 'ppt': return `.${extension} · PowerPoint`
      default: return `.${extension} · Документ`
    }
  }
  return resourceAppLabel(resource)
}

function ResourceKindIcon({ resource }: { resource: Resource }) {
  if (resource.kind === 'file') {
    const ext = resource.target.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
    if (ext === 'psd' || ext === 'ai' || ext === 'sketch') {
      return <Image size={22} className="cabinet-doc-icon creative" />
    }
    return <FileText size={22} className="cabinet-doc-icon" />
  }
  if (resource.kind === 'window' || resource.kind === 'app') {
    return <AppWindow size={22} className="cabinet-doc-icon window" />
  }
  return <Globe2 size={22} className="cabinet-doc-icon link" />
}

export function CabinetContents({
  space,
  destinations,
  covers,
  drag,
  pointerTabTarget,
  onPointerStart,
  onSelectTab,
  onCloseTab,
  onSaveTab,
  onMoveTab,
  onReorderTab,
  onOpen,
  onRemove,
  onCopy,
  onAddDocument,
  onAddLink,
  onAddWindow,
  onOpenTabs,
  onStartDrag,
  onFinishDrag,
  suggestedRecentFile,
  onAddRecentFile,
  onDismissRecentFile
}: {
  space: Space
  destinations: Space[]
  covers: Record<string, string>
  drag: CabinetDrag | null
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onSaveTab: (tab: BrowserTab) => void
  onMoveTab: (id: string, spaceId: string) => void
  onReorderTab: (id: string, targetId: string, after: boolean) => void
  onOpen: (resource: Resource) => void
  onRemove: (id: string) => void
  onCopy: (resource: Resource, spaceId: string) => void
  onAddDocument: () => void
  onAddLink: () => void
  onAddWindow?: () => void
  onOpenTabs?: () => void
  onStartDrag: (event: DragEvent<HTMLElement>, value: CabinetDrag) => void
  onFinishDrag: () => void
  pointerTabTarget?: string
  onPointerStart?: (event: PointerEvent<HTMLElement>, value: CabinetDrag) => void
  suggestedRecentFile?: RecentFile | null
  onAddRecentFile?: (file: RecentFile) => void
  onDismissRecentFile?: (target: string) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'file' | 'link'>('all')
  const [expanded, setExpanded] = useState(false)
  const [previews, setPreviews] = useState(false)
  const [dropTab, setDropTab] = useState('')
  const localDrag = useRef<CabinetDrag | null>(null)

  function beginDrag(event: DragEvent<HTMLElement>, value: CabinetDrag) {
    onStartDrag(event, value)
    if (!event.defaultPrevented) localDrag.current = value
  }
  function finishDrag() {
    localDrag.current = null
    setDropTab('')
    onFinishDrag()
  }

  const context = useContextMenu()
  const contents = cabinetContents(space)
  const needle = query.trim().toLocaleLowerCase('ru')
  const matches = (name: string, target: string) => `${name} ${target}`.toLocaleLowerCase('ru').includes(needle)

  const rawTabs = contents.tabs
  const rawMaterials = contents.materials
  const rawTools = contents.tools

  const hasItems = rawTabs.length > 0 || rawMaterials.length > 0 || rawTools.length > 0
  const hasMultipleTypes = rawTabs.length > 0 && rawMaterials.length > 0

  const tabs = filter === 'file' ? [] : rawTabs.filter(tab => matches(tab.title, tab.url))
  const materials = rawMaterials
    .filter(resource => (filter === 'all' || resource.kind === filter) && matches(resource.name, resource.target))
    .sort((a, b) => Number(b.kind === 'file') - Number(a.kind === 'file'))
  const tools = filter === 'all' ? rawTools.filter(resource => matches(resource.name, resource.target)) : []

  const shownTabs = expanded || needle ? tabs : tabs.slice(0, 6)
  const hasCovers = rawTabs.some(tab => /^data:image\/(png|jpeg|webp);base64,/i.test(covers[tab.id] || ''))

  const materialActions = (resource: Resource): MenuAction[] => [
    {
      label: resource.kind === 'file'
        ? 'Открыть документ'
        : resource.kind === 'window'
          ? 'Показать окно'
          : resource.kind === 'app'
            ? 'Открыть приложение'
            : 'Открыть сайт',
      icon: resource.kind === 'file'
        ? <FileText size={16} />
        : resource.kind === 'window' || resource.kind === 'app'
          ? <AppWindow size={16} />
          : <Globe2 size={16} />,
      onSelect: () => onOpen(resource)
    },
    ...destinations.map(destination => ({
      id: destination.id,
      label: `Также в «${destination.name}»`,
      icon: <Folder size={16} />,
      onSelect: () => onCopy(resource, destination.id)
    })),
    { label: 'Убрать из пространства', icon: <X size={16} />, onSelect: () => onRemove(resource.id) }
  ]

  const tabActions = (tab: BrowserTab): MenuAction[] => [
    { label: 'Открыть вкладку', icon: <Globe2 size={16} />, onSelect: () => onSelectTab(tab.id) },
    { label: 'Сохранить ссылку', icon: <Bookmark size={16} />, onSelect: () => onSaveTab(tab) },
    ...destinations.map(destination => ({
      id: destination.id,
      label: `Перенести в «${destination.name}»`,
      icon: <Folder size={16} />,
      onSelect: () => onMoveTab(tab.id, destination.id)
    })),
    { label: 'Закрыть вкладку', icon: <X size={16} />, onSelect: () => onCloseTab(tab.id) }
  ]

  // Состояние 1: Полностью чистое пространство (0 вкладок и 0 материалов)
  if (!hasItems && !needle) {
    return (
      <section className="cabinet-contents cabinet-contents-empty-state" aria-label={`Содержимое пространства ${space.name}`}>
        <div className="cabinet-content-empty card">
          <div className="cabinet-empty-icon" aria-hidden="true">
            <Compass size={32} strokeWidth={1.5} />
          </div>
          <div className="cabinet-empty-copy">
            <h2>Кабинет готов к работе</h2>
            <p>Рабочее пространство объединяет всё, что нужно для задачи: вкладки браузера, файлы проекта (Photoshop, Figma, документы) и окна программ Windows. Всё сохранится здесь и уснёт при переключении.</p>
          </div>
          <div className="cabinet-empty-actions">
            <button
              type="button"
              className="cabinet-hero-start primary-button"
              onClick={onOpenTabs || onAddLink}
            >
              <Globe2 size={18} />
              <span>Открыть вкладки</span>
            </button>
            <div className="cabinet-secondary-actions">
              <button
                type="button"
                className="cabinet-hero-action"
                onClick={onAddDocument}
              >
                <FileText size={16} />
                <span>Документ</span>
              </button>
              <button
                type="button"
                className="cabinet-hero-action"
                onClick={onAddLink}
              >
                <Link2 size={16} />
                <span>Ссылка</span>
              </button>
              {onAddWindow && (
                <button
                  type="button"
                  className="cabinet-hero-action"
                  onClick={onAddWindow}
                >
                  <AppWindow size={16} />
                  <span>Окно программы</span>
                </button>
              )}
            </div>
          </div>
          {suggestedRecentFile && (
            <div className="cabinet-empty-recent">
              <span className="cabinet-empty-recent-label">Недавно открывали в системе:</span>
              <div className="cabinet-recent-chip" title={suggestedRecentFile.target}>
                <button
                  type="button"
                  className="cabinet-recent-chip-btn"
                  onClick={() => onAddRecentFile?.(suggestedRecentFile)}
                  aria-label={`Добавить недавний файл «${suggestedRecentFile.name}»`}
                >
                  <FileText size={15} />
                  <span className="cabinet-recent-chip-name">{suggestedRecentFile.name}</span>
                  <span className="cabinet-recent-chip-add" title="Добавить в материалы">+</span>
                </button>
                {onDismissRecentFile && (
                  <button
                    type="button"
                    className="cabinet-recent-chip-dismiss"
                    onClick={() => onDismissRecentFile(suggestedRecentFile.target)}
                    aria-label="Скрыть подсказку"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="cabinet-contents" aria-label={`Содержимое пространства ${space.name}`}>
      {/* Тулбар поиска и фильтрации — только когда есть что искать */}
      {(hasItems || needle) && (
        <div className="cabinet-content-toolbar">
          <label className="cabinet-content-search">
            <Search size={17} />
            <input
              aria-label="Найти в пространстве"
              placeholder="Найти в пространстве"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Очистить поиск">
                <X size={15} />
              </button>
            )}
          </label>
          {hasMultipleTypes && (
            <div className="cabinet-content-filters" aria-label="Тип содержимого">
              {([['all', 'Все'], ['file', 'Документы'], ['link', 'Сайты']] as const).map(([value, label]) => (
                <button key={value} aria-pressed={value === filter} onClick={() => setFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {hasCovers && (
            <button
              className="cabinet-preview-toggle"
              aria-pressed={previews}
              onClick={() => setPreviews(value => !value)}
              title="Снимки ранее просмотренных страниц"
            >
              <Image size={16} />
              Миниатюры
            </button>
          )}
        </div>
      )}

      {/* Недавний файл в заполненном кабинете */}
      {suggestedRecentFile && (
        <div className="cabinet-recent-banner">
          <span className="cabinet-empty-recent-label">Недавний документ на компьютере:</span>
          <div className="cabinet-recent-chip" title={suggestedRecentFile.target}>
            <button
              type="button"
              className="cabinet-recent-chip-btn"
              onClick={() => onAddRecentFile?.(suggestedRecentFile)}
              aria-label={`Добавить недавний файл «${suggestedRecentFile.name}»`}
            >
              <FileText size={15} />
              <span className="cabinet-recent-chip-name">{suggestedRecentFile.name}</span>
              <span className="cabinet-recent-chip-add" title="Добавить в материалы">+</span>
            </button>
            {onDismissRecentFile && (
              <button
                type="button"
                className="cabinet-recent-chip-dismiss"
                onClick={() => onDismissRecentFile(suggestedRecentFile.target)}
                aria-label="Скрыть подсказку"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="cabinet-contents-scroll">
        {/* Поиск ничего не нашёл */}
        {needle && !tabs.length && !materials.length && !tools.length && (
          <div className="cabinet-content-empty no-results card">
            <Search size={28} />
            <h2>Ничего не найдено</h2>
            <p>По запросу «{query}» совпадений не обнаружено</p>
            <button
              type="button"
              className="cabinet-hero-action"
              onClick={() => { setQuery(''); setFilter('all') }}
            >
              Сбросить поиск
            </button>
          </div>
        )}

        {/* Секция вкладок сессии */}
        {tabs.length > 0 && (
          <section className="cabinet-content-section" aria-label="Вкладки пространства">
            <div className="cabinet-section-heading">
              <h2>Вкладки сессии <span>{tabs.length}</span></h2>
              {!needle && tabs.length > 6 && (
                <button aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
                  {expanded ? 'Свернуть' : `Показать все · ${tabs.length}`}
                  {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              )}
            </div>
            <div className={`cabinet-tab-grid${previews ? ' with-previews' : ''}`}>
              {shownTabs.map(tab => {
                const saved = space.resources.some(resource => resource.kind === 'link' && resource.target === tab.url)
                const cover = previews && /^data:image\/(png|jpeg|webp);base64,/i.test(covers[tab.id] || '') ? covers[tab.id] : ''
                const actions = tabActions(tab)
                const label = `Действия с вкладкой «${tab.title}»`
                return (
                  <div
                    key={tab.id}
                    data-tab-id={tab.id}
                    data-cabinet-owner={space.id}
                    className={`cabinet-tab-card card${dropTab === tab.id || pointerTabTarget === tab.id ? ' is-drop-target' : ''}`}
                    draggable
                    onPointerDown={event => onPointerStart?.(event, { kind: 'tab', spaceId: space.id, id: tab.id })}
                    onDragStart={event => beginDrag(event, { kind: 'tab', spaceId: space.id, id: tab.id })}
                    onDragEnd={finishDrag}
                    onDragOver={event => {
                      const dragging = localDrag.current || drag
                      if (dragging?.kind !== 'tab' || dragging.spaceId !== space.id || dragging.id === tab.id) return
                      event.preventDefault()
                      event.stopPropagation()
                      event.dataTransfer.dropEffect = 'move'
                      setDropTab(tab.id)
                    }}
                    onDragLeave={() => setDropTab('')}
                    onDrop={event => {
                      const value = readCabinetDrag(event)
                      if (value?.kind !== 'tab' || value.spaceId !== space.id || value.id === tab.id) return
                      event.preventDefault()
                      event.stopPropagation()
                      onReorderTab(value.id, tab.id, event.clientX > event.currentTarget.getBoundingClientRect().left + event.currentTarget.getBoundingClientRect().width / 2)
                      finishDrag()
                    }}
                    onContextMenu={event => context.open(event, label, actions)}
                    onKeyDown={event => context.open(event, label, actions)}
                  >
                    <button
                      draggable
                      className="cabinet-tab-open"
                      aria-label={`Открыть вкладку «${tab.title}»`}
                      onClick={() => onSelectTab(tab.id)}
                    >
                      {cover && (
                        <span className="cabinet-page-fragment">
                          <img src={cover} alt="" loading="lazy" decoding="async" draggable={false} />
                        </span>
                      )}
                      <span className="cabinet-tab-copy">
                        <TabIcon tab={tab} />
                        <span>
                          <strong title={tab.title}>{tab.title || pageDomain(tab.url)}</strong>
                          <small>
                            {pageDomain(tab.url)}
                            {saved && (
                              <span className="cabinet-saved-mark" title="Ссылка сохранена">
                                <Bookmark size={13} />
                                Сохранено
                              </span>
                            )}
                          </small>
                        </span>
                      </span>
                    </button>
                    <ActionMenu label={label} actions={actions} />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Секция документов и приложений */}
        {materials.length > 0 && (
          <section className="cabinet-content-section" aria-label="Документы и материалы">
            <div className="cabinet-section-heading">
              <h2>Документы и программы <span>{materials.length}</span></h2>
            </div>
            <div className="cabinet-material-grid">
              {materials.map(resource => {
                const actions = materialActions(resource)
                const label = `Действия с материалом «${resource.name}»`
                return (
                  <div
                    key={resource.id}
                    data-resource-id={resource.id}
                    data-resource-kind={resource.kind}
                    className="cabinet-material-card card"
                    draggable
                    onPointerDown={event => onPointerStart?.(event, { kind: 'resource', spaceId: space.id, id: resource.id })}
                    onDragStart={event => onStartDrag(event, { kind: 'resource', spaceId: space.id, id: resource.id })}
                    onDragEnd={onFinishDrag}
                    onContextMenu={event => context.open(event, label, actions)}
                    onKeyDown={event => context.open(event, label, actions)}
                  >
                    <button
                      draggable
                      className="cabinet-material-open"
                      onClick={() => onOpen(resource)}
                      title={resource.target}
                    >
                      <ResourceKindIcon resource={resource} />
                      <span>
                        <strong>{resource.name}</strong>
                        <small>{documentFormat(resource)}</small>
                      </span>
                    </button>
                    <ActionMenu label={label} actions={actions} />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Быстрое добавление материала, когда есть вкладки, но нет документов */}
        {!needle && filter === 'all' && !materials.length && (tabs.length > 0 || tools.length > 0) && (
          <div className="cabinet-add-material">
            <button type="button" onClick={onAddDocument}>
              <FileText size={16} />
              Документ
            </button>
            <button type="button" onClick={onAddLink}>
              <Globe2 size={16} />
              Сохранить сайт
            </button>
            {onAddWindow && (
              <button type="button" onClick={onAddWindow}>
                <AppWindow size={16} />
                Окно программы
              </button>
            )}
          </div>
        )}

        {/* Секция инструментов */}
        {tools.length > 0 && (
          <section className="cabinet-content-section" aria-label="Инструменты пространства">
            <div className="cabinet-section-heading">
              <h2>Инструменты <span>{tools.length}</span></h2>
            </div>
            <div className="cabinet-tool-list">
              {tools.map(resource => {
                const actions = materialActions(resource)
                const label = `Действия с материалом «${resource.name}»`
                return (
                  <div
                    key={resource.id}
                    data-resource-id={resource.id}
                    className="cabinet-tool"
                    draggable
                    onPointerDown={event => onPointerStart?.(event, { kind: 'resource', spaceId: space.id, id: resource.id })}
                    onDragStart={event => onStartDrag(event, { kind: 'resource', spaceId: space.id, id: resource.id })}
                    onDragEnd={onFinishDrag}
                    onContextMenu={event => context.open(event, label, actions)}
                    onKeyDown={event => context.open(event, label, actions)}
                  >
                    <button draggable onClick={() => onOpen(resource)}>
                      <AppWindow size={18} />
                      <span>{resource.name}</span>
                    </button>
                    <ActionMenu label={label} actions={actions} />
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
      {context.menu}
    </section>
  )
}
