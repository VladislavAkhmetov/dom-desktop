import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import {
  AppWindow,
  Bookmark,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileText,
  Folder,
  Globe2,
  Link2,
  Search,
  X
} from 'lucide-react'
import { ActionMenu, type MenuAction } from './ActionMenu'
import { useContextMenu } from './ContextMenu'
import { plural } from './ContinuationFooter'
import { cabinetContents, readCabinetDrag, type CabinetDrag } from './cabinetInteractions'
import { TabIcon } from './browser/TabIcon'
import { FileTypeBadge, SiteMark } from './FileTypeBadge'
import { documentFormat } from './resourcePresentation'
import { useTabPeek } from './TabPeek'
import type { BookmarkGroup, BrowserTab, RecentFile, Resource, Space } from './types'

function pageDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'Страница'
  } catch {
    return 'Страница'
  }
}

// Keyboard focus gets the peek too; a mouse click's focus does not (the hover already handled it).
function focusVisible(element: HTMLElement) {
  try { return element.matches(':focus-visible') } catch { return false }
}

function ResourceKindIcon({ resource }: { resource: Resource }) {
  if (resource.kind === 'file') return <span className="cabinet-doc-mark"><FileTypeBadge name={resource.target} size={22} /></span>
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
  onDismissRecentFile,
  favorites = [],
  favoriteGroups = [],
  pastDays = [],
  onOpenFavorite,
  onOpenDay
}: {
  space: Space
  /** Day draft «Сегодня»: Избранное (outside spaces) on the right, past days under the tabs on the left. */
  favorites?: Resource[]
  favoriteGroups?: BookmarkGroup[]
  pastDays?: Space[]
  onOpenFavorite?: (resource: Resource) => void
  onOpenDay?: (id: string) => void
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
  // Search stays a magnifier until asked for; it remains open while it holds a query.
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const searchExpanded = searchOpen || Boolean(query)
  const openSearch = () => { setSearchOpen(true); requestAnimationFrame(() => searchInput.current?.focus()) }
  const closeSearch = () => { setQuery(''); setFilter('all'); setSearchOpen(false) }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      event.preventDefault()
      openSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [filter, setFilter] = useState<'all' | 'file' | 'link'>('all')
  const [expanded, setExpanded] = useState(false)
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
  const peek = useTabPeek(covers)
  useEffect(() => peek.hide(), [needle, expanded, filter, peek.hide])

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
      group: 'Также в пространстве',
      label: destination.name,
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
      group: 'Перенести в',
      label: destination.name,
      icon: <Folder size={16} />,
      onSelect: () => onMoveTab(tab.id, destination.id)
    })),
    { label: 'Закрыть вкладку', icon: <X size={16} />, onSelect: () => onCloseTab(tab.id) }
  ]

  // «Сегодня» keeps the space layout even when empty: today on the left, what is always at hand on the right.
  const isDay = space.kind === 'day'
  const pageCount = (day: Space) => (day.activeSession?.tabs || []).filter(tab => tab.url).length
  const groupName = (resource: Resource) => favoriteGroups.find(group => group.id === resource.bookmarkGroupId)?.name || ''
  const shownFavorites = needle ? favorites.filter(item => matches(item.name, item.target)) : favorites
  // A fresh space uses the same two-column card instead of a hero: each column says what lands there.
  const isFresh = !isDay && !hasItems && !needle
  const columns = isDay || isFresh
  const emptyTabs = (isDay || isFresh) && !tabs.length && !needle && (
    <section className="cabinet-content-section" aria-label={isDay ? 'Вкладки дня' : 'Вкладки'}>
      <div className="cabinet-section-heading"><h2>Вкладки</h2></div>
      <button type="button" className="cabinet-day-empty" onClick={onOpenTabs || onAddLink}>
        <Globe2 size={18} aria-hidden="true" />
        <span>{isDay ? 'Открытые сегодня сайты появятся здесь' : 'Сайты для этой задачи появятся здесь'}</span>
      </button>
    </section>
  )
  const emptyMaterials = isFresh && (
    <section className="cabinet-content-section" aria-label="Материалы">
      <div className="cabinet-section-heading"><h2>Материалы</h2></div>
      <div className="cabinet-day-empty-list">
        <button type="button" className="cabinet-day-empty" onClick={onAddDocument}><FileText size={18} aria-hidden="true" /><span>Документ или папка</span></button>
        <button type="button" className="cabinet-day-empty" onClick={onAddLink}><Link2 size={18} aria-hidden="true" /><span>Ссылка</span></button>
        {onAddWindow && <button type="button" className="cabinet-day-empty" onClick={onAddWindow}><AppWindow size={18} aria-hidden="true" /><span>Окно программы</span></button>}
      </div>
    </section>
  )
  const pastDaysSection = isDay && pastDays.length > 0 && !needle && (
    <section className="cabinet-content-section" aria-label="Прошлые дни">
      <div className="cabinet-section-heading"><h2>Прошлые дни <span>{pastDays.length}</span></h2></div>
      <div className="cabinet-tab-grid">
        {pastDays.slice(0, 7).map(day => (
          <div key={day.id} className="cabinet-tab-card card">
            <button type="button" className="cabinet-tab-open" onClick={() => onOpenDay?.(day.id)}>
              <span className="cabinet-tab-copy">
                <span className="cabinet-day-mark" aria-hidden="true"><CalendarDays size={16} /></span>
                <span><strong>{day.name}</strong><small>{pageCount(day)} {plural(pageCount(day), 'вкладка', 'вкладки', 'вкладок')}</small></span>
              </span>
            </button>
          </div>
        ))}
      </div>
    </section>
  )
  const favoritesSection = isDay && shownFavorites.length > 0 && (
    <section className="cabinet-content-section" aria-label="Избранное">
      <div className="cabinet-section-heading"><h2>Избранное <span>{shownFavorites.length}</span></h2></div>
      <div className="cabinet-material-grid">
        {shownFavorites.map(resource => (
          <div key={resource.id} className="cabinet-material-card card">
            <button type="button" className="cabinet-material-open" onClick={() => onOpenFavorite?.(resource)} title={resource.target}>
              <SiteMark url={resource.target} title={resource.name} />
              <span><strong>{resource.name}</strong><small>{[groupName(resource), pageDomain(resource.target)].filter(Boolean).join(' · ')}</small></span>
            </button>
          </div>
        ))}
      </div>
    </section>
  )

  const tabsBlock = (
    <>
        {/* Секция вкладок сессии */}
        {tabs.length > 0 && (
          <section className="cabinet-content-section" aria-label="Вкладки пространства">
            <div className="cabinet-section-heading">
              <h2>Вкладки <span>{tabs.length}</span></h2>
              {!needle && tabs.length > 6 && (
                <button aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
                  {expanded ? 'Свернуть' : `Показать все · ${tabs.length}`}
                  {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              )}
            </div>
            <div className="cabinet-tab-grid">
              {shownTabs.map(tab => {
                const saved = space.resources.some(resource => resource.kind === 'link' && resource.target === tab.url)
                const actions = tabActions(tab)
                const label = `Действия с вкладкой «${tab.title}»`
                return (
                  <div
                    key={tab.id}
                    data-tab-id={tab.id}
                    data-cabinet-owner={space.id}
                    className={`cabinet-tab-card card${dropTab === tab.id || pointerTabTarget === tab.id ? ' is-drop-target' : ''}`}
                    draggable
                    onPointerDown={event => { peek.hide(); onPointerStart?.(event, { kind: 'tab', spaceId: space.id, id: tab.id }) }}
                    onDragStart={event => { peek.hide(); beginDrag(event, { kind: 'tab', spaceId: space.id, id: tab.id }) }}
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
                      data-tooltip-off=""
                      onClick={() => { peek.hide(); onSelectTab(tab.id) }}
                      onMouseEnter={event => peek.show(event.currentTarget.closest<HTMLElement>('.cabinet-tab-card') || event.currentTarget, tab.id, pageDomain(tab.url))}
                      onMouseLeave={peek.hide}
                      onFocus={event => { if (focusVisible(event.currentTarget)) peek.show(event.currentTarget.closest<HTMLElement>('.cabinet-tab-card') || event.currentTarget, tab.id, pageDomain(tab.url)) }}
                      onBlur={peek.hide}
                    >
                      <span className="cabinet-tab-copy">
                        {tab.favicon ? <span className="cabinet-site-icon"><TabIcon tab={tab} /></span> : <SiteMark url={tab.url} title={tab.title} />}
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

    </>
  )
  const restBlock = (
    <>
        {/* Секция документов и приложений */}
        {materials.length > 0 && (
          <section className="cabinet-content-section" aria-label="Документы и материалы">
            <div className="cabinet-section-heading">
              <h2>{materials.some(resource => resource.kind === 'link') ? 'Материалы' : 'Файлы и программы'} <span>{materials.length}</span></h2>
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
        {!isDay && !needle && filter === 'all' && !materials.length && (tabs.length > 0 || tools.length > 0) && (
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
    </>
  )

  return (
    <section className={columns ? 'cabinet-contents is-hug' : 'cabinet-contents'} aria-label={`Содержимое пространства ${space.name}`}>
      {/* Тулбар поиска и фильтрации — только когда есть что искать */}
      {(hasItems || needle) && (
        <div className={`cabinet-content-toolbar${searchExpanded ? ' is-open' : ''}`}>
          {!searchExpanded && (
            <button type="button" className="cabinet-search-toggle" onClick={openSearch} aria-label="Поиск в пространстве" title="Поиск · /">
              <Search size={20} />
            </button>
          )}
          <label className="cabinet-content-search" aria-hidden={!searchExpanded || undefined}>
            <Search size={18} />
            <input
              ref={searchInput}
              aria-label="Найти в пространстве"
              placeholder="Найти вкладку или файл"
              tabIndex={searchExpanded ? 0 : -1}
              value={query}
              onChange={event => { setQuery(event.target.value); if (!event.target.value.trim()) setFilter('all') }}
              onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeSearch() } }}
              onBlur={() => { if (!query.trim()) setSearchOpen(false) }}
            />
            {searchExpanded && (
              <button type="button" onMouseDown={event => event.preventDefault()} onClick={closeSearch} aria-label="Закрыть поиск">
                <X size={18} />
              </button>
            )}
          </label>
          {hasMultipleTypes && needle && (
            <div className="cabinet-content-filters" aria-label="Тип содержимого">
              {([['all', 'Все'], ['file', 'Документы'], ['link', 'Сайты']] as const).map(([value, label]) => (
                <button key={value} aria-pressed={value === filter} onClick={() => setFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Недавний файл в заполненном кабинете */}
      {!isDay && suggestedRecentFile && (
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

        {columns ? (
          <>
            <div className="cabinet-day-column">{tabsBlock}{emptyTabs}{pastDaysSection}</div>
            <div className="cabinet-day-column">{restBlock}{emptyMaterials}{favoritesSection}</div>
          </>
        ) : <>{tabsBlock}{restBlock}</>}
      </div>
      {context.menu}
      {peek.node}
    </section>
  )
}
