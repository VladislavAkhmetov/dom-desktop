import { normalizeSpace } from '../../shared/state'
import type { AppState, BrowserTab } from '../types'
import { updateContextSession } from '../workContexts'

/**
 * «Заглянуть»: a link opened beside the current page without becoming a tab.
 * Lives only in the renderer (never persisted, not in the tab strip, the Desk, history or closed tabs)
 * until the user keeps it. The page itself is an ordinary native view created by NativePane.
 */
export interface Glance {
  id: string
  spaceId: string
  parentTabId: string
  url: string
  title: string
  favicon?: string
}

/** A stand-in tab for NativePane; it is never written to the state. */
export function glanceTab(glance: Glance): BrowserTab {
  return { id: glance.id, title: glance.title || glance.url, url: glance.url, favicon: glance.favicon, parentTabId: glance.parentTabId }
}

/** The glance is on screen only next to the page it was opened from (the current or the split one). */
export function isGlanceVisible(glance: Pick<Glance, 'spaceId' | 'parentTabId'> | null, view: { open: boolean; spaceId?: string; activeTabId: string; splitTabId?: string | null }): boolean {
  return Boolean(glance && view.open && view.spaceId === glance.spaceId && [view.activeTabId, view.splitTabId].includes(glance.parentTabId))
}

/** «Оставить вкладкой»: the same page (same id, no reload) becomes a tab right after its parent. */
export function keepGlance(state: AppState, glance: Glance, now = new Date().toISOString()): AppState {
  const owner = state.spaces.find(space => space.id === glance.spaceId && !space.archivedAt)
  if (!owner) return state
  const parent = normalizeSpace(owner).activeSession?.tabs.find(tab => tab.id === glance.parentTabId)
  const tab: BrowserTab = { ...glanceTab(glance), branchId: parent?.branchId, lastActiveAt: now }
  return { ...state, activeSpaceId: owner.id, spaces: state.spaces.map(space => space.id !== owner.id ? space : updateContextSession(space, session => {
    if (session.tabs.some(item => item.id === tab.id)) return session
    const tabs = [...session.tabs]
    const at = tabs.findIndex(item => item.id === glance.parentTabId)
    tabs.splice(at < 0 ? tabs.length : at + 1, 0, tab)
    return { ...session, tabs, activeTabId: tab.id, splitTabId: null }
  }, now, parent?.contextId)) }
}
