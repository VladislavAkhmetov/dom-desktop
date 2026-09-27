import type { AppState } from './types'

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
