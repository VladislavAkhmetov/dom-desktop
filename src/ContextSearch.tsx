import { useEffect, useState } from 'react'
import { bridge } from './bridge'
import { Dialog } from './Dialog'
import type { AppState } from './types'
import { searchState, type SearchResult } from './search'
export function ContextSearch({ state, localOnly, onClose, onSelect }: { state: AppState; localOnly: boolean; onClose: () => void; onSelect: (value: SearchResult) => void }) {
  const [query, setQuery] = useState(''), [error, setError] = useState('')
  const [results, setResults] = useState<{ id: string; spaceId: string; title: string; target: string }[]>([])
  useEffect(() => { let active = true; const timer = window.setTimeout(() => { if (!query.trim()) { setResults([]); return } const request = localOnly ? Promise.resolve(searchState(state, query)) : bridge.search(query); request.then(value => { if (active) { setResults(value.filter(item => !item.spaceId || state.spaces.some(space => space.id === item.spaceId && !space.archivedAt))); setError('') } }).catch(error => { if (active) setError(error.message) }) }, 150); return () => { active = false; clearTimeout(timer) } }, [query, state, localOnly])
  return <Dialog title="Найти в Доме" onClose={onClose}><div className="calm-form"><label>Название, сайт или слово из дела<input value={query} onChange={event => setQuery(event.target.value)} /></label></div><div className="calm-digest-list">{results.map(item => <button key={item.id} onClick={() => { onSelect(item); onClose() }}><span><strong>{item.title}</strong><small>{item.target}</small></span></button>)}</div>{query && !results.length && <p>Ничего не найдено.</p>}{error && <p role="alert">{error}</p>}</Dialog>
}
