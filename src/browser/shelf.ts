import { normalizeSpace } from '../../shared/state'
import type { AppState, BrowserTab, Space } from '../types'
import { updateContextSession } from '../workContexts'

/**
 * Quiet shelving: a tab of a space that nobody opened for a while moves to Space.shelf.
 * It stays restorable and costs nothing (no page, no process). Day drafts are not touched
 * (they have the 04:00 reset, src/dayDraft.ts), neither are pinned, protected or visible tabs.
 */
export const DEFAULT_SHELVE_DAYS = 14
export const SHELF_LIMIT = 100
/** A stamp is refreshed at most this often, so an open tab does not rewrite the state on every pass. */
const STAMP_STEP_MS = 60 * 60_000
const DAY_MS = 24 * 60 * 60_000

export function shelveAfterDays(state: Pick<AppState, 'shelveAfterDays'>): number {
  const value = state.shelveAfterDays
  return value === 0 ? 0 : typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : DEFAULT_SHELVE_DAYS
}

const shelvable = (space: Space) => !space.archivedAt && (space.kind === undefined || space.kind === 'base' || space.kind === 'stream')
const samePage = (a: BrowserTab, b: BrowserTab) => Boolean(a.url) && a.url === b.url

/**
 * One pass. Returns the same object when nothing changes, so a pass that finds nothing never writes.
 *
 * lastActiveAt is stamped here, not on every click: the active and split tab of each work context
 * count as «used now», so a tab keeps the time of the last pass at which it was still the active one.
 * A tab without a stamp gets «now» (no mass shelving right after an update).
 * `skipSpaceIds`: spaces on screen are left alone.
 */
export function shelveStaleTabs(state: AppState, now = new Date(), days = shelveAfterDays(state), skipSpaceIds: string[] = []): AppState {
  if (days <= 0) return state
  const stamp = now.toISOString()
  const limit = now.getTime() - days * DAY_MS
  let changed = false
  const spaces = state.spaces.map(original => {
    if (!shelvable(original) || skipSpaceIds.includes(original.id) || !original.activeSession?.tabs.length) return original
    const space = normalizeSpace(original)
    const session = space.activeSession!
    const inUse = new Set<string>([session.activeTabId, session.splitTabId || ''])
    for (const context of space.workContexts || []) { inUse.add(context.activeTabId || ''); inUse.add(context.splitTabId || '') }
    const kept: BrowserTab[] = []
    const moved: BrowserTab[] = []
    let touched = false
    for (const tab of session.tabs) {
      const last = Date.parse(tab.lastActiveAt || '')
      if (inUse.has(tab.id)) {
        if (!Number.isFinite(last) || now.getTime() - last >= STAMP_STEP_MS) { kept.push({ ...tab, lastActiveAt: stamp }); touched = true } else kept.push(tab)
      } else if (!Number.isFinite(last)) { kept.push({ ...tab, lastActiveAt: stamp }); touched = true }
      else if (tab.url && !tab.pinned && !tab.protected && last < limit) { moved.push({ ...tab, shelvedAt: stamp }); touched = true }
      else kept.push(tab)
    }
    if (!touched) return original
    changed = true
    const shelf = moved.length ? [...moved, ...(space.shelf || []).filter(old => !moved.some(tab => samePage(tab, old)))].slice(0, SHELF_LIMIT) : space.shelf
    return { ...space, activeSession: { ...session, tabs: kept }, ...(shelf ? { shelf } : {}) }
  })
  return changed ? { ...state, spaces } : state
}

/** «Вернуть»: the shelved tab becomes the active tab of the space's current work context. */
export function unshelveTab(state: AppState, spaceId: string, tabId: string, now = new Date().toISOString()): AppState {
  const owner = state.spaces.find(space => space.id === spaceId && !space.archivedAt)
  const tab = owner?.shelf?.find(item => item.id === tabId)
  if (!owner || !tab) return state
  const { shelvedAt: _shelvedAt, ...restored } = tab
  return { ...state, spaces: state.spaces.map(space => {
    if (space.id !== spaceId) return space
    const next = updateContextSession(space, session => session.tabs.some(item => item.id === tab.id) ? session
      : { ...session, tabs: [...session.tabs, { ...restored, protected: false, error: undefined, lastActiveAt: now }], activeTabId: tab.id, splitTabId: null }, now)
    return { ...next, shelf: next.shelf?.filter(item => item.id !== tabId) }
  }) }
}

/** «Забыть»: drop one shelved tab for good (the app offers an undo). */
export function forgetShelvedTab(state: AppState, spaceId: string, tabId: string): AppState {
  if (!state.spaces.some(space => space.id === spaceId && space.shelf?.some(item => item.id === tabId))) return state
  return { ...state, spaces: state.spaces.map(space => space.id !== spaceId ? space : { ...space, shelf: space.shelf?.filter(item => item.id !== tabId) }) }
}
