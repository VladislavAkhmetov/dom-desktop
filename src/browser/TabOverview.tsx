import { useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { SiteMark } from '../FileTypeBadge'
import { ArrowRight, BookmarkPlus, Check, Columns2, FileInput, FolderInput, Pin, Plus, Search, X } from 'lucide-react'
import type { AppState } from '../types'
import { ActionMenu } from '../ActionMenu'
import { Dialog } from '../Dialog'
import { findTabs, tabEntries, tabHost, tabTitle, type TabEntry } from './tabModel'
import { TabIcon } from './TabIcon'

interface TabOverviewProps {
  state: AppState
  currentSpaceId?: string
  initialScope?: 'space' | 'all'
  covers?: Record<string, string>
  undo?: { label: string; onRestore: () => void; onDismiss: () => void }
  onClose: () => void
  onSelect: (spaceId: string, tabId: string) => void
  onCloseTab: (spaceId: string, tabId: string) => void
  onSplit: (spaceId: string, tabId: string) => void
  onSave: (spaceId: string, tabId: string) => void
  onPin: (spaceId: string, tabId: string) => void
  onMove: (spaceId: string, tabId: string, toSpaceId: string) => void
  onReorder: (spaceId: string, contextId: string, tabId: string, targetId: string, after: boolean) => void
  onNew: (spaceId?: string) => void
  onImport: () => void
}
const entryId = (entry: TabEntry) => `${entry.space.id}:${entry.tab.id}`

export function TabOverview({ state, currentSpaceId, initialScope = 'space', covers = {}, undo, onClose, onSelect, onCloseTab, onSplit, onSave, onPin, onMove, onReorder, onNew, onImport }: TabOverviewProps) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState(initialScope)
  const [selected, setSelected] = useState('')
  const [drag, setDrag] = useState<TabEntry | null>(null)
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null)
  const input = useRef<HTMLInputElement>(null), results = useRef<HTMLDivElement>(null)
  const resultsId = useId()
  const currentSpace = state.spaces.find(space => space.id === currentSpaceId && !space.archivedAt)
  const entries = useMemo(() => tabEntries(state), [state.spaces])
  const matches = useMemo(() => findTabs(entries, query, scope === 'space' ? currentSpace?.id : undefined), [entries, query, scope, currentSpace?.id])
  const searching = Boolean(query.trim())
  const selectedEntry = matches.find(entry => entryId(entry) === selected) || (!searching && matches.find(entry => entry.space.id === currentSpaceId && entry.tab.id === entry.space.activeSession?.activeTabId)) || matches[0]
  const selectedKey = selectedEntry && entryId(selectedEntry)
  const groups = [...new Set(matches.map(entry => entry.space.id))].map(id => ({ space: matches.find(entry => entry.space.id === id)!.space, entries: matches.filter(entry => entry.space.id === id) }))
  function choose(entry: TabEntry) { onSelect(entry.space.id, entry.tab.id) }
  function changeScope(value: 'space' | 'all') { setScope(value); setSelected(''); input.current?.focus() }
  function keyboard(event: KeyboardEvent) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key) || !matches.length || (event.target as HTMLElement).closest('.tab-desk-scope,.action-menu,.action-menu-popover')) return
    if (event.key === 'Enter') { if (event.target === input.current) { event.preventDefault(); if (selectedEntry) choose(selectedEntry) } return }
    if (['Home', 'End'].includes(event.key) && event.target === input.current && !event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const index = Math.max(0, matches.findIndex(entry => entryId(entry) === selectedKey))
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? matches.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length
    setSelected(entryId(matches[next]))
    results.current?.querySelector<HTMLElement>(`[data-result-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
    if (event.target !== input.current) results.current?.querySelector<HTMLButtonElement>(`[data-result-index="${next}"] .tab-desk-open`)?.focus()
  }
  function dragOver(event: DragEvent, entry: TabEntry) {
    if (!drag || drag.tab.id === entry.tab.id || drag.space.id !== entry.space.id || drag.contextId !== entry.contextId || Boolean(drag.tab.pinned) !== Boolean(entry.tab.pinned)) return
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'
    const bounds = event.currentTarget.getBoundingClientRect()
    setDrop({ id: entryId(entry), after: event.clientX > bounds.left + bounds.width / 2 })
  }
  function card(entry: TabEntry, index: number) {
    const { tab, space, contextName } = entry, key = entryId(entry)
    const active = tab.id === space.activeSession?.activeTabId
    const destinations = state.spaces.filter(item => !item.archivedAt && item.id !== space.id && !(item.kind === 'day' && item.dayRetired))
    const owner = space.kind === 'web' ? 'Браузер' : space.name
    const contextLabel = contextName && space.kind !== 'web' && space.workContexts!.length > 1 ? contextName : ''
    const subtitle = searching && scope === 'all' ? [owner, contextLabel].filter(Boolean).join(' · ') : contextLabel || tabHost(tab)
    const hasCover = !searching && Boolean(covers[tab.id])
    return <article key={key} className={`tab-desk-card ${hasCover ? 'has-cover' : ''} ${searching ? 'is-result' : ''} ${selectedKey === key ? 'is-selected' : ''} ${active ? 'is-current' : ''} ${drop?.id === key ? drop.after ? 'drop-after' : 'drop-before' : ''} ${drag?.tab.id === tab.id ? 'is-dragging' : ''}`} data-result-index={index} draggable={!searching}
      onDragStart={event => { event.dataTransfer.setData('application/x-dom-tab', JSON.stringify({ spaceId: space.id, tabId: tab.id })); event.dataTransfer.effectAllowed = 'move'; setDrag(entry) }}
      onDragOver={event => dragOver(event, entry)}
      onDrop={event => { event.preventDefault(); if (drag && drop?.id === key) onReorder(space.id, entry.contextId, drag.tab.id, tab.id, drop.after); setDrag(null); setDrop(null) }}
      onDragEnd={() => { setDrag(null); setDrop(null) }}>
      <button className="tab-desk-open" onClick={() => choose(entry)} aria-label={`${tabTitle(tab)} · ${space.name}${contextName ? ` · ${contextName}` : ''}`} aria-current={active ? 'page' : undefined}>
        {!searching && <div className={`tab-desk-preview${hasCover ? '' : ' is-placeholder'}`}>{hasCover ? <img className="tab-desk-cover" src={covers[tab.id]} alt="" loading="lazy" draggable={false} /> : <SiteMark className="tab-desk-mark" url={tab.url} title={tabTitle(tab)} />}</div>}
        <div className="tab-desk-caption"><TabIcon tab={tab} /><div><strong>{tabTitle(tab)}</strong>{subtitle && <span>{subtitle}</span>}</div>{tab.pinned && <Pin size={18} aria-label="Закреплено" />}{active && <Check size={18} aria-label="Текущая вкладка" />}{searching && <ArrowRight size={20} aria-hidden="true" />}</div>
      </button>
      <button className="tab-desk-close" onClick={() => onCloseTab(space.id, tab.id)} aria-label={`Закрыть ${tabTitle(tab)}`}><X size={18} /></button>
      <div className="tab-desk-actions"><ActionMenu className="browser-menu" label={`Действия · ${tabTitle(tab)}`} actions={[
        { label: 'Открыть рядом', icon: <Columns2 size={20} />, onSelect: () => onSplit(space.id, tab.id) },
        ...(tab.url ? [{ label: 'Сохранить в материалы', icon: <BookmarkPlus size={20} />, onSelect: () => onSave(space.id, tab.id) }] : []),
        { label: tab.pinned ? 'Открепить' : 'Закрепить', icon: <Pin size={20} />, onSelect: () => onPin(space.id, tab.id) },
        ...destinations.map(destination => ({ label: destination.kind === 'web' ? 'В браузер' : `В ${destination.name}`, icon: <FolderInput size={20} />, onSelect: () => onMove(space.id, tab.id, destination.id) })),
        ...(!state.spaces.some(item => item.kind === 'web' && !item.archivedAt) && space.kind !== 'web' ? [{ label: 'В браузер', icon: <FolderInput size={20} />, onSelect: () => onMove(space.id, tab.id, '@web') }] : [])
      ]} /></div>
    </article>
  }
  return <Dialog title="Стол" onClose={onClose} className="tab-desk-dialog">
    <div className="tab-desk" onKeyDown={keyboard}>
      <div className="tab-desk-toolbar">
        <label className="tab-desk-search"><Search size={22} aria-hidden="true" /><input ref={input} data-dialog-focus autoFocus type="search" value={query} onChange={event => { setQuery(event.target.value); setSelected('') }} placeholder="Найти вкладку" aria-label="Найти вкладку" aria-controls={resultsId} autoComplete="off" spellCheck={false} />{query && <button onClick={() => { setQuery(''); setSelected(''); input.current?.focus() }} aria-label="Очистить поиск"><X size={20} /></button>}</label>
        <div className="tab-desk-scope" role="group" aria-label="Где искать">{currentSpace && <button aria-pressed={scope === 'space'} onClick={() => changeScope('space')}>{currentSpace.kind === 'web' ? 'Браузер' : currentSpace.name}</button>}<button aria-pressed={scope === 'all' || !currentSpace} onClick={() => changeScope('all')}>Все</button></div>
        <button className="tab-desk-new" onClick={() => onNew(scope === 'space' ? currentSpace?.id : undefined)} aria-label="Новая вкладка" title="Новая вкладка"><Plus size={22} /></button>
        <ActionMenu className="browser-menu" label="Действия с вкладками" actions={[{ label: 'Импорт вкладок', icon: <FileInput size={20} />, onSelect: onImport }]} />
      </div>
      <div className="tab-desk-content" id={resultsId} ref={results} aria-label={searching ? 'Найденные вкладки' : 'Открытые вкладки'}>
        {searching ? <div className="tab-desk-results">{matches.map(card)}</div> : groups.map(group => <section className="tab-desk-group" key={group.space.id}>{scope === 'all' && <h3>{group.space.kind === 'web' ? 'Браузер' : group.space.name}</h3>}<div className="tab-desk-grid">{group.entries.map(entry => card(entry, matches.indexOf(entry)))}</div></section>)}
        {!matches.length && <div className="tab-desk-empty">{searching ? 'Ничего не найдено' : 'Нет открытых вкладок'}{!searching && <button className="primary-button" onClick={() => onNew(scope === 'space' ? currentSpace?.id : undefined)}><Plus size={20} />Открыть страницу</button>}</div>}
      </div>
      <span className="tab-search-announcement" role="status">{searching ? `${matches.length} вкладок${selectedEntry ? ` · ${tabTitle(selectedEntry.tab)}` : ''}` : ''}</span>
      {undo && <div className="tab-desk-undo" role="status"><span>{undo.label}</span><button onClick={undo.onRestore}>Вернуть</button><button onClick={undo.onDismiss} aria-label="Скрыть уведомление"><X size={18} /></button></div>}
    </div>
  </Dialog>
}
