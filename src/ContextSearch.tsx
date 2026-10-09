import { useEffect, useRef, useState } from 'react'
import { AppWindow, CheckSquare, FileText, Folder, Globe2, Search } from 'lucide-react'
import { bridge } from './bridge'
import { Dialog } from './Dialog'
import type { AppState } from './types'
import { searchState, type SearchResult } from './search'
import './search.css'

export function ContextSearch({ state, localOnly, onClose, onSelect }: { state: AppState; localOnly: boolean; onClose: () => void; onSelect: (value: SearchResult) => void }) {
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
      request.then(value => { if (active) { setResults(value.filter(item => !item.spaceId || state.spaces.some(space => space.id === item.spaceId && !space.archivedAt))); setSelected(0); setError(''); setLoading(false) } }).catch(error => { if (active) { setError(error.message); setLoading(false) } })
    }, 150)
    return () => { active = false; clearTimeout(timer) }
  }, [query, state, localOnly])
  const spaces = state.spaces.filter(space => !space.archivedAt)
  const recent: SearchResult[] = spaces.flatMap(space => space.resources.filter(resource => resource.lastOpenedAt).map(resource => ({ id: resource.id, spaceId: space.id, title: resource.name, target: resource.target, at: resource.lastOpenedAt! }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6)
  const shown = query.trim() ? results : recent.length ? recent : spaces.map(space => ({ id: space.id, spaceId: space.id, title: space.name, target: '' }))
  const active = Math.min(selected, shown.length - 1)
  useEffect(() => { resultList.current?.querySelectorAll<HTMLButtonElement>('button')[active]?.scrollIntoView({ block: 'nearest' }) }, [active, results])
  function open(item: SearchResult) { onSelect(item); onClose() }
  function presentation(item: SearchResult) {
    const owner = state.spaces.find(space => space.id === item.spaceId)
    const resource = owner?.resources.find(resource => resource.id === item.id)
    const reminder = state.reminders.find(task => task.id === item.id)
    const label = reminder ? reminder.kind === 'note' || !reminder.kind && !reminder.dueAt && !reminder.plannedDate ? 'Запись' : 'Дело' : item.id === owner?.id ? 'Пространство' : resource?.kind === 'file' ? 'Документ' : resource?.kind === 'app' ? 'Приложение' : 'Сайт'
    const icon = reminder ? <CheckSquare size={20} /> : item.id === owner?.id ? <Folder size={20} /> : resource?.kind === 'file' ? <FileText size={20} /> : resource?.kind === 'app' ? <AppWindow size={20} /> : <Globe2 size={20} />
    return { icon, label: [label, owner?.id !== item.id ? owner?.name : ''].filter(Boolean).join(' · ') }
  }
  return <Dialog className="search-dialog" title="Поиск в Доме" onClose={onClose}>
    <div className="search-field"><Search size={20} /><input aria-label="Поиск в Доме" placeholder="Пространства, материалы, дела" value={query} aria-controls="dom-search-results" aria-activedescendant={active >= 0 ? `search-result-${active}` : undefined} onChange={event => { setQuery(event.target.value); setSelected(0) }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelected(previous => Math.max(0, Math.min(shown.length - 1, previous + (event.key === 'ArrowDown' ? 1 : -1)))) }
      if (event.key === 'Enter' && !loading && shown[active]) { event.preventDefault(); open(shown[active]) }
    }} /></div>
    {!query.trim() && shown.length > 0 && <div className="search-section-title">{recent.length ? 'Недавнее' : 'Пространства'}</div>}
    <div className="search-results" ref={resultList} role="listbox" id="dom-search-results" aria-label="Результаты поиска">{shown.map((item, index) => { const detail = presentation(item); return <button key={item.id} role="option" aria-selected={active === index} id={`search-result-${index}`} onClick={() => open(item)}><span className="search-result-icon">{detail.icon}</span><span><strong>{item.title}</strong><small>{detail.label}</small></span></button> })}</div>
    {loading && <p className="search-status" role="status">Поиск…</p>}{query.trim() && !loading && !shown.length && !error && <p className="search-status" role="status">Ничего не найдено</p>}{error && <p className="search-status" role="alert">{error}</p>}
  </Dialog>
}
