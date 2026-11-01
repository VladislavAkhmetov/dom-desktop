import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AppWindow, CheckSquare, FileText, Folder, Globe2, Search, Zap } from 'lucide-react'
import { bridge } from './bridge'
import { Dialog } from './Dialog'
import type { AppState } from './types'
import { matchActions, searchState, searchTabs, withTabs, type SearchResult } from './search'
import './search.css'

/** A command of the palette: appears when the typed words match its name. */
export interface PaletteAction { id: string; label: string; keywords?: string; icon?: ReactNode; onSelect: () => void }
type Row = SearchResult & { action?: PaletteAction }

export function ContextSearch({ state, localOnly, actions = [], onClose, onSelect }: { state: AppState; localOnly: boolean; actions?: PaletteAction[]; onClose: () => void; onSelect: (value: SearchResult) => void }) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const [results, setResults] = useState<SearchResult[]>([])
  const resultList = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let active = true
    if (!query.trim()) { setResults([]); setLoading(false); setError(''); return }
    setLoading(true); setResults([]); setError('')
    const timer = window.setTimeout(() => {
      const request = localOnly ? Promise.resolve(searchState(state, query)) : bridge.search(query)
      request.then(value => { if (active) { setResults(withTabs(value.filter(item => !item.spaceId || state.spaces.some(space => space.id === item.spaceId && !space.archivedAt)), searchTabs(state, query))); setSelected(0); setError(''); setLoading(false) } }).catch(error => { if (active) { setError(error.message); setLoading(false) } })
    }, 150)
    return () => { active = false; clearTimeout(timer) }
  }, [query, state, localOnly])
  const spaces = state.spaces.filter(space => !space.archivedAt)
  const recent: SearchResult[] = spaces.flatMap(space => space.resources.filter(resource => resource.lastOpenedAt).map(resource => ({ id: resource.id, spaceId: space.id, title: resource.name, target: resource.target, at: resource.lastOpenedAt! }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6)
  const commands: Row[] = matchActions(actions, query).map(action => ({ id: `action:${action.id}`, spaceId: '', title: action.label, target: '', action }))
  const shown: Row[] = [...commands, ...(query.trim() ? results : recent.length ? recent : spaces.map(space => ({ id: space.id, spaceId: space.id, title: space.name, target: '' })))]
  const active = Math.min(selected, shown.length - 1)
  useEffect(() => { resultList.current?.querySelectorAll<HTMLButtonElement>('button')[active]?.scrollIntoView({ block: 'nearest' }) }, [active, results])
  // The dialog is gone before an action runs, so actions that refuse to start over an open dialog (new tab, save) work.
  function open(item: Row) { onClose(); if (item.action) window.setTimeout(item.action.onSelect, 0); else onSelect(item) }
  function presentation(item: Row) {
    if (item.action) return { icon: item.action.icon || <Zap size={20} />, label: 'Действие' }
    const tab = state.spaces.find(space => space.id === item.spaceId)?.activeSession?.tabs.some(value => value.id === item.id)
    const owner = state.spaces.find(space => space.id === item.spaceId)
    const resource = owner?.resources.find(resource => resource.id === item.id)
    const reminder = state.reminders.find(task => task.id === item.id)
    const label = tab ? 'Вкладка' : reminder ? reminder.kind === 'note' || !reminder.kind && !reminder.dueAt && !reminder.plannedDate ? 'Запись' : 'Дело' : item.id === owner?.id ? 'Пространство' : resource?.kind === 'file' ? 'Документ' : resource?.kind === 'app' ? 'Приложение' : 'Сайт'
    const icon = reminder ? <CheckSquare size={20} /> : item.id === owner?.id ? <Folder size={20} /> : resource?.kind === 'file' ? <FileText size={20} /> : resource?.kind === 'app' ? <AppWindow size={20} /> : <Globe2 size={20} />
    return { icon, label: [label, owner?.id !== item.id ? owner?.name : ''].filter(Boolean).join(' · ') }
  }
  return <Dialog className="search-dialog" title="Поиск в Доме" onClose={onClose}>
    <div className="search-field"><Search size={20} /><input aria-label="Поиск в Доме" placeholder="Пространства, вкладки, дела, действия" value={query} aria-controls="dom-search-results" aria-activedescendant={active >= 0 ? `search-result-${active}` : undefined} onChange={event => { setQuery(event.target.value); setSelected(0) }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelected(previous => Math.max(0, Math.min(shown.length - 1, previous + (event.key === 'ArrowDown' ? 1 : -1)))) }
      if (event.key === 'Enter' && !loading && shown[active]) { event.preventDefault(); open(shown[active]) }
    }} /></div>
    {!query.trim() && shown.length > 0 && <div className="search-section-title">{recent.length ? 'Недавнее' : 'Пространства'}</div>}
    <div className="search-results" ref={resultList} role="listbox" id="dom-search-results" aria-label="Результаты поиска">{shown.map((item, index) => { const detail = presentation(item); return <button key={item.id} role="option" aria-selected={active === index} id={`search-result-${index}`} onClick={() => open(item)}><span className="search-result-icon">{detail.icon}</span><span><strong>{item.title}</strong><small>{detail.label}</small></span></button> })}</div>
    {loading && <p className="search-status" role="status">Поиск…</p>}{query.trim() && !loading && !shown.length && !error && <p className="search-status" role="status">Ничего не найдено</p>}{error && <p className="search-status" role="alert">{error}</p>}
  </Dialog>
}
