import { normalizeSpace } from '../../shared/state'
import type { AppState, BrowserTab, Space, SpaceTone } from '../types'
import { activateContext, currentContext, updateContextSession } from '../workContexts'

export interface TabEntry {
  tab: BrowserTab
  space: Space
  contextId: string
  contextName: string
}

export function tabHost(tab: BrowserTab): string {
  try { return new URL(tab.url).hostname.replace(/^www\./, '') || '' } catch { return '' }
}

export function tabTitle(tab: BrowserTab): string {
  return tab.title.trim() || tabHost(tab) || 'Новая вкладка'
}

export function orderedTabs(tabs: BrowserTab[]): BrowserTab[] {
  return [...tabs].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
}

export function tabEntries(state: AppState): TabEntry[] {
  return state.spaces.filter(space => !space.archivedAt).flatMap(original => {
    const space = normalizeSpace(original)
    const current = currentContext(space)
    const contexts = [current, ...space.workContexts!.filter(context => context.id !== current.id)]
    const tabs = contexts.flatMap(context => orderedTabs((space.activeSession?.tabs || []).filter(tab => (tab.contextId || current.id) === context.id)))
    return tabs.map(tab => {
      const context = space.workContexts!.find(context => context.id === tab.contextId) || currentContext(space)
      return { tab, space, contextId: context.id, contextName: context.title }
    })
  })
}

const searchText = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

export function findTabs(entries: TabEntry[], query: string, spaceId?: string): TabEntry[] {
  const scoped = spaceId ? entries.filter(entry => entry.space.id === spaceId) : entries
  const text = searchText(query), words = text.split(' ').filter(Boolean)
  if (!text) return scoped
  return scoped.map((entry, order) => {
    const title = searchText(tabTitle(entry.tab)), host = searchText(tabHost(entry.tab))
    const haystack = searchText(`${title} ${entry.tab.url} ${entry.space.kind === 'web' ? 'Браузер ' : ''}${entry.space.name} ${entry.contextName}`)
    const matches = words.every(word => haystack.includes(word))
    const score = title === text || host === text ? 0 : title.startsWith(text) ? 1 : host.startsWith(text) ? 2 : title.includes(text) ? 3 : 4
    return { entry, order, matches, score }
  }).filter(item => item.matches).sort((a, b) => a.score - b.score || a.order - b.order).map(item => item.entry)
}

export function webSpaceId(state: AppState): string {
  const existing = state.spaces.find(space => space.kind === 'web')
  if (existing) return existing.id
  let id = 'dom-web'
  while (state.spaces.some(space => space.id === id)) id += ':web'
  return id
}

export function ensureWebSpace(state: AppState, id = webSpaceId(state)): { state: AppState; space: Space } {
  const existing = state.spaces.find(space => space.kind === 'web')
  if (existing) {
    const space = normalizeSpace({ ...existing, archivedAt: null })
    return { state: { ...state, spaces: state.spaces.map(item => item.id === space.id ? space : item) }, space }
  }
  const space = normalizeSpace({ id, name: 'Веб', kind: 'web', tone: 'sage', resources: [] })
  return { state: { ...state, spaces: [...state.spaces, space] }, space }
}

export function selectBrowserTab(state: AppState, spaceId: string, tabId: string): AppState {
  const owner = state.spaces.find(space => space.id === spaceId && !space.archivedAt)
  const entry = owner && tabEntries({ ...state, spaces: [owner] }).find(entry => entry.tab.id === tabId)
  if (!entry) return state
  return { ...state, activeSpaceId: spaceId, spaces: state.spaces.map(space => space.id !== spaceId ? space
    : updateContextSession(activateContext(space, entry.contextId), session => ({ ...session, activeTabId: tabId,
      splitTabId: session.splitTabId === tabId ? session.activeTabId || null : session.splitTabId }))) }
}

export function removeBrowserTab(state: AppState, spaceId: string, tabId: string, remember = true): AppState {
  const owner = state.spaces.find(space => space.id === spaceId)
  const entry = owner && tabEntries({ ...state, spaces: [{ ...owner, archivedAt: null }] }).find(entry => entry.tab.id === tabId)
  if (!entry) return state
  return { ...state, spaces: state.spaces.map(space => space.id !== spaceId ? space : updateContextSession(space, session => {
    const list = orderedTabs(session.tabs), index = list.findIndex(tab => tab.id === tabId)
    const tabs = session.tabs.filter(tab => tab.id !== tabId)
    const remaining = list.filter(tab => tab.id !== tabId)
    const activeTabId = session.activeTabId === tabId ? remaining[Math.max(0, index - 1)]?.id || '' : session.activeTabId
    const splitTabId = session.splitTabId === tabId || session.splitTabId === activeTabId ? null : session.splitTabId
    const closed = { ...entry.tab, closedIndex: index }
    return { ...session, tabs, activeTabId, splitTabId, closedTabs: remember ? [closed, ...(session.closedTabs || [])].slice(0, 30) : session.closedTabs }
  }, undefined, entry.contextId)) }
}

export function restoreBrowserTab(state: AppState, spaceId: string, tab: BrowserTab): AppState {
  if (!state.spaces.some(space => space.id === spaceId)) return state
  return { ...state, spaces: state.spaces.map(space => {
    if (space.id !== spaceId) return space
    const normalized = normalizeSpace(space), contextId = normalized.workContexts!.some(context => context.id === tab.contextId) ? tab.contextId! : currentContext(normalized).id
    return updateContextSession(normalized, session => {
      if (session.tabs.some(item => item.id === tab.id)) return session
      const tabs = orderedTabs(session.tabs), { closedIndex, ...restored } = tab
      tabs.splice(Math.min(closedIndex ?? tabs.length, tabs.length), 0, { ...restored, protected: false, error: undefined })
      return { ...session, tabs, activeTabId: tab.id, closedTabs: session.closedTabs?.filter(item => item.id !== tab.id) }
    }, undefined, contextId)
  }) }
}

export function reorderBrowserTabs(tabs: BrowserTab[], tabId: string, targetId: string, after = false): BrowserTab[] {
  const list = orderedTabs(tabs), source = list.find(tab => tab.id === tabId), target = list.find(tab => tab.id === targetId)
  if (!source || !target || source.id === target.id || Boolean(source.pinned) !== Boolean(target.pinned)) return tabs
  const next = list.filter(tab => tab.id !== tabId), index = next.findIndex(tab => tab.id === targetId)
  next.splice(index + Number(after), 0, source)
  return next
}

export function moveBrowserTab(state: AppState, fromSpaceId: string, tabId: string, toSpaceId: string, toContextId?: string, index?: number): AppState {
  const source = state.spaces.find(space => space.id === fromSpaceId), target = state.spaces.find(space => space.id === toSpaceId && !space.archivedAt)
  const entry = source && tabEntries({ ...state, spaces: [{ ...source, archivedAt: null }] }).find(entry => entry.tab.id === tabId)
  if (!entry || !target || target.activeSession?.tabs.some(tab => tab.id === tabId)) return state
  const destination = normalizeSpace(target), contextId = toContextId || currentContext(destination).id
  if (!destination.workContexts!.some(context => context.id === contextId)) return state
  const removed = removeBrowserTab(state, fromSpaceId, tabId, false)
  return { ...removed, spaces: removed.spaces.map(space => space.id !== toSpaceId ? space : updateContextSession(space, session => {
    const tabs = [...session.tabs]
    tabs.splice(Math.min(index ?? tabs.length, tabs.length), 0, { ...entry.tab, contextId })
    return { ...session, tabs, activeTabId: tabId }
  }, undefined, contextId)) }
}

/** Create the destination and move the live tab in one persistent change. */
export function createSpaceAndMoveTab(state: AppState, fromSpaceId: string, tabId: string, id: string, name: string, tone: SpaceTone): AppState {
  const title = name.trim().slice(0, 80)
  const source = state.spaces.find(space => space.id === fromSpaceId && !space.archivedAt)
  if (!title || !source?.activeSession?.tabs.some(tab => tab.id === tabId) || state.spaces.some(space => space.id === id)) return state
  const existing = state.spaces.find(space => !space.archivedAt && space.kind !== 'web' && space.name.trim().toLocaleLowerCase('ru') === title.toLocaleLowerCase('ru'))
  if (existing) return existing.id === fromSpaceId ? state : moveBrowserTab(state, fromSpaceId, tabId, existing.id)
  const space = normalizeSpace({ id, name: title, nameOrigin: 'manual', pinned: false, kind: 'base', tone, resources: [], activeSession: { tabs: [], activeTabId: '' } })
  return moveBrowserTab({ ...state, spaces: [...state.spaces, space] }, fromSpaceId, tabId, id)
}
