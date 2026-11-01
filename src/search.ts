import type { AppState } from './types'
import { findTabs, tabEntries, tabTitle } from './browser/tabModel'

export interface SearchResult { id: string; spaceId: string; title: string; target: string }

export function searchState(state: AppState, query: string): SearchResult[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const spaces = state.spaces.filter(space => !space.archivedAt)
  const items = spaces.flatMap(space => [
    { id: space.id, spaceId: space.id, title: space.name, target: '', text: `${space.checkpoint?.nextStep || ''} ${space.checkpoint?.note || ''}` },
    ...space.resources.map(item => ({ id: item.id, spaceId: space.id, title: item.name, target: item.target, text: '' })),
    ...(space.activeSession?.tabs || []).map(item => ({ id: item.id, spaceId: space.id, title: item.title, target: item.url, text: '' }))
  ])
  items.push(...state.reminders.filter(item => !item.done && (!item.spaceId || spaces.some(space => space.id === item.spaceId))).map(item => ({ id: item.id, spaceId: item.spaceId || '', title: item.title, target: '', text: '' })))
  return items.filter(item => words.every(word => `${item.title} ${item.target} ${item.text}`.toLocaleLowerCase().includes(word))).slice(0, 50).map(({ text: _text, ...item }) => item)
}

const fold = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е')

/** Palette actions whose name (or keywords) contain every word of the query. Nothing for an empty query. */
export function matchActions<T extends { label: string; keywords?: string }>(actions: T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return actions.filter(action => words.every(word => fold(`${action.label} ${action.keywords || ''}`).includes(word)))
}

/** Open tabs of every work context, best title/host matches first (the Desk ranking). */
export function searchTabs(state: AppState, query: string, limit = 8): SearchResult[] {
  if (!query.trim()) return []
  return findTabs(tabEntries(state), query).slice(0, limit).map(entry => ({ id: entry.tab.id, spaceId: entry.space.id, title: tabTitle(entry.tab), target: entry.tab.url }))
}

/** Tab matches go after the stored results; a tab already found there is not repeated. */
export function withTabs(results: SearchResult[], tabs: SearchResult[]): SearchResult[] {
  const known = new Set(results.map(item => item.id))
  return [...results, ...tabs.filter(item => !known.has(item.id))]
}
