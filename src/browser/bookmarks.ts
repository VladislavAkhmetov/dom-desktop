import type { AppState, BookmarkDestination, BrowserTab, Resource, Space } from '../types'
import { ensureWebSpace, webSpaceId } from './tabModel'

export const BOOKMARKS = '@bookmarks'
export interface SavePageRequest { destination: BookmarkDestination; name: string; newGroupName?: string }

function pageUrl(value: string) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined } catch { return undefined }
}

export function favoriteResources(spaces: Space[], url: string) {
  const target = pageUrl(url)
  return target ? spaces.find(space => space.kind === 'web' && !space.archivedAt)?.resources.filter(item => item.kind === 'link' && pageUrl(item.target) === target) || [] : []
}

export function favoritePage(spaces: Space[], url: string) { return favoriteResources(spaces, url)[0] }

export function removeFavoritePage(state: AppState, url: string): AppState {
  const target = pageUrl(url)
  if (!target) return state
  return { ...state, spaces: state.spaces.map(space => space.kind !== 'web' || space.archivedAt ? space : {
    ...space, resources: space.resources.filter(item => item.kind !== 'link' || pageUrl(item.target) !== target)
  }) }
}

export function defaultBookmarkDestination(state: AppState, currentSpaceId?: string): BookmarkDestination {
  const previous = state.lastBookmarkDestination
  if (previous?.spaceId === BOOKMARKS) {
    const web = state.spaces.find(space => space.kind === 'web' && !space.archivedAt)
    return { spaceId: BOOKMARKS, groupId: web?.bookmarkGroups?.some(group => group.id === previous.groupId) ? previous.groupId : undefined }
  }
  if (previous && state.spaces.some(space => space.id === previous.spaceId && !space.archivedAt)) return { spaceId: previous.spaceId }
  const current = state.spaces.find(space => space.id === currentSpaceId && !space.archivedAt && space.kind !== 'web')
  return { spaceId: current?.id || BOOKMARKS }
}

/** Save a link without mutating any live tab, selected space or work context. */
export function savePageToDestination(state: AppState, tab: BrowserTab, request: SavePageRequest) {
  let url: URL
  try { url = new URL(tab.url) } catch { throw new Error('У этой вкладки нет адреса для сохранения.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Можно сохранить только HTTP- или HTTPS-страницу.')
  const bookmarks = request.destination.spaceId === BOOKMARKS
  const spaceId = bookmarks ? webSpaceId(state) : request.destination.spaceId
  const source = bookmarks ? ensureWebSpace(state, spaceId).state : state
  const space = source.spaces.find(item => item.id === spaceId && !item.archivedAt)
  if (!space) throw new Error('Пространство больше недоступно. Выберите другое место.')
  let groups = space.bookmarkGroups || []
  let groupId = bookmarks ? request.destination.groupId : undefined
  const groupName = request.newGroupName?.trim().slice(0, 80)
  if (bookmarks && groupName) {
    const existing = groups.find(group => group.name.toLocaleLowerCase('ru-RU') === groupName.toLocaleLowerCase('ru-RU'))
    const group = existing || { id: crypto.randomUUID(), name: groupName }
    if (!existing) groups = [...groups, group]
    groupId = group.id
  }
  if (groupId && !groups.some(group => group.id === groupId)) throw new Error('Группа больше недоступна. Выберите другую группу.')
  const target = url.toString()
  const matches = (item: Resource) => item.kind === 'link' && pageUrl(item.target) === target
  const existing = space.resources.find(matches)
  const resource: Resource = existing ? { ...existing, ...(bookmarks ? { bookmarkGroupId: groupId } : {}) }
    : { id: crypto.randomUUID(), kind: 'link', name: request.name.trim().slice(0, 200) || tab.title || url.hostname, target, createdAt: new Date().toISOString(), ...(groupId ? { bookmarkGroupId: groupId } : {}) }
  const destination: BookmarkDestination = { spaceId: bookmarks ? BOOKMARKS : spaceId, ...(groupId ? { groupId } : {}) }
  const label = bookmarks ? `Закладки${groupId ? ` → ${groups.find(group => group.id === groupId)!.name}` : ''}` : space.name
  return { resource, alreadySaved: Boolean(existing), label, state: { ...source,
    lastBookmarkDestination: destination,
    spaces: source.spaces.map(item => item.id === spaceId ? { ...item, ...(bookmarks ? { bookmarkGroups: groups } : {}),
      resources: existing ? item.resources.filter(saved => !matches(saved) || saved.id === existing.id).map(saved => saved.id === existing.id ? resource : saved) : [...item.resources, resource]
    } : item)
  } satisfies AppState }
}
