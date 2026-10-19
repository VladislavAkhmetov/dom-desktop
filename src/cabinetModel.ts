import { normalizeSpace } from '../shared/state'
import type { AppState, BrowserSession, Checkpoint, Resource, Space, SpaceTone } from './types'
import { contextSession, currentContext, documentPathKey } from './workContexts'
import { moveBrowserTab } from './browser/tabModel'

/** Runs only on a copy in the pilot store. The source store is never rewritten. */
export function upgradeCabinets(input: AppState): AppState {
  if (input.cabinetVersion === 1) return input
  const state = structuredClone(input)
  const occupied = new Set(state.spaces.map(space => space.id))
  const spaces: Space[] = []
  let activeSpaceId = state.activeSpaceId
  for (const original of state.spaces) {
    let space = normalizeSpace(original)
    if (space.kind === 'web') { spaces.push(space); continue }
    const contexts = space.workContexts!
    // Retain the original ID for the active context, including reminder links.
    const active = currentContext(space)
    const contextIds = new Set(contexts.map(context => context.id))
    // Older or partial data can contain tabs without a valid context. Preserve
    // them in the retained cabinet instead of silently dropping them.
    if (space.activeSession) {
      const adopt = <T extends { contextId?: string }>(tab: T): T => contextIds.has(tab.contextId || '') ? tab : { ...tab, contextId: active.id }
      space = { ...space, activeSession: { ...space.activeSession,
        tabs: space.activeSession.tabs.map(adopt), closedTabs: space.activeSession.closedTabs?.map(adopt) } }
    }
    const ordered = [active, ...contexts.filter(context => context.id !== active.id)]
    for (const [index, context] of ordered.entries()) {
      let id = index === 0 ? space.id : `${space.id}:cabinet:${context.id}`
      if (index > 0) { while (occupied.has(id)) id += ':copy'; occupied.add(id) }
      const session = contextSession(space, context.id)
      if (index === 0) {
        if (session.tabs.some(tab => tab.id === space.activeSession?.activeTabId)) session.activeTabId = space.activeSession!.activeTabId
        if (session.tabs.some(tab => tab.id === space.activeSession?.splitTabId && tab.id !== session.activeTabId)) session.splitTabId = space.activeSession!.splitTabId
      }
      // Keep the entire old library on the original ID. Additional cabinets get
      // only their documents, saved tab links and application shortcuts.
      const urls = new Set(session.tabs.map(tab => tab.url))
      const relevant = index === 0 ? space.resources : space.resources.filter(resource =>
        resource.kind === 'app' || context.documentIds.includes(resource.id)
        || context.excludedDocumentIds?.includes(resource.id) || urls.has(resource.target))
      const resourceIds = new Map(relevant.map(resource => [resource.id, index === 0 ? resource.id : `${id}:resource:${resource.id}`]))
      const resources = relevant.map(resource => ({ ...resource, id: resourceIds.get(resource.id)! }))
      const remapCheckpoint = (point: Checkpoint): Checkpoint => ({ ...point, spaceId: id, contextId: context.id,
        resourceId: point.resourceId ? resourceIds.get(point.resourceId) || point.resourceId : undefined })
      const point = context.checkpoint || (index === 0 && space.checkpoint && (!space.checkpoint.contextId || !contextIds.has(space.checkpoint.contextId) || space.checkpoint.contextId === context.id) ? space.checkpoint : undefined)
      const checkpoint = point ? remapCheckpoint(point) : undefined
      const history = (space.checkpointHistory || []).filter(point => point.contextId === context.id
        || (index === 0 && (!point.contextId || !contextIds.has(point.contextId)))).map(remapCheckpoint)
      spaces.push({ ...space, id, name: context.title.trim() || space.name, pinned: space.pinned ?? true,
        nameOrigin: 'manual', legacyOrigin: { spaceId: space.id, spaceName: space.name, contextId: context.id },
        archivedAt: space.archivedAt || context.completedAt || null,
        resources, activeSession: session, activeContextId: context.id,
        lastActiveAt: context.lastActiveAt || space.lastActiveAt, checkpoint, checkpointHistory: history,
        workContexts: [{ ...context, title: '', checkpoint, completedAt: undefined, activeTabId: session.activeTabId, splitTabId: session.splitTabId,
          documentIds: context.documentIds.map(resourceId => resourceIds.get(resourceId) || resourceId),
          excludedDocumentIds: context.excludedDocumentIds?.map(resourceId => resourceIds.get(resourceId) || resourceId) }] })
      if (state.activeSpaceId === space.id && context.id === active.id) activeSpaceId = id
    }
  }
  return { ...state, spaces, activeSpaceId, cabinetVersion: 1 }
}

export function newCabinet(state: AppState, id: string, tabId: string, tone: SpaceTone, now = new Date().toISOString()): AppState {
  const tab = { id: tabId, title: 'Новая вкладка', url: '' }
  let name = 'Новое пространство', suffix = 2
  while (state.spaces.some(space => space.name === name && !space.archivedAt)) name = `Новое пространство ${suffix++}`
  const space = normalizeSpace({ id, name, nameOrigin: 'temporary', pinned: false,
    tone, resources: [], activeSession: { tabs: [tab], activeTabId: tab.id }, lastActiveAt: now })
  return { ...state, activeSpaceId: id, spaces: [...state.spaces, space] }
}

export function formatSpaceDisplayName(space: Space): string {
  const rawName = space.name?.trim() || ''
  const isGeneric = !rawName || /^(Поток:\s*\d|Поток$|Новое пространство)/i.test(rawName) || space.nameOrigin === 'temporary' || space.nameOrigin === 'suggested'
  if (!isGeneric) {
    return rawName
  }
  const session = contextSession(space)
  const tab = (session?.tabs || []).find(t => t.id === session?.activeTabId && t.url) || (session?.tabs || []).find(t => t.url)
  if (tab && tab.url) {
    try {
      const u = new URL(tab.url)
      const host = u.hostname.replace(/^www\./, '').toLowerCase()
      let domainLabel = ''
      if (host.includes('vk.com')) domainLabel = 'VK'
      else if (host.includes('figma.com')) domainLabel = 'Figma'
      else if (host.includes('youtube.com')) domainLabel = 'YouTube'
      else if (host.includes('github.com')) domainLabel = 'GitHub'
      else if (host.includes('google.com')) domainLabel = 'Google'
      else if (host.includes('yandex.ru') || host.includes('ya.ru')) domainLabel = 'Яндекс'
      else if (tab.title && !/^(Новая вкладка|vk\.com|https?:\/\/)/i.test(tab.title)) {
        domainLabel = tab.title.slice(0, 24)
      } else {
        domainLabel = host
      }
      return `Поток · ${domainLabel}`
    } catch {}
  }
  const material = space.resources?.find(r => r.kind !== 'app')
  if (material) {
    const label = material.name.replace(/\.[a-z0-9]+$/i, '').trim()
    if (label) return `Поток · ${label}`
  }
  return rawName || 'Новое пространство'
}

/** A transparent metadata fallback; it does not call or pretend to be AI. */
export function nameFromMaterials(space: Space): string | undefined {
  const session = contextSession(space)
  const active = session.tabs.find(tab => tab.id === session.activeTabId && tab.url)
  const material = space.resources.find(resource => resource.kind !== 'app')
  const title = active?.title.trim() || session.tabs.find(tab => tab.url)?.title.trim()
    || (material?.kind === 'file' ? material.name.replace(/\.(?:psd|psb|ai|pptx?|docx?|xlsx?|pdf|fig|sketch)$/i, '').trim() : material?.name.trim())
  if (!title || /^(Новая вкладка|Новое пространство)$/i.test(title)) return undefined
  return title.replace(/\s+/g, ' ').slice(0, 70)
}

export function suggestInitialName(space: Space): Space {
  if (space.kind === 'web' || space.nameOrigin !== 'temporary') return space
  const name = nameFromMaterials(space)
  return name ? { ...space, name, nameOrigin: 'suggested' } : space
}

export function copyMaterial(state: AppState, resource: Resource, destinationId: string, id: string): AppState {
  const target = state.spaces.find(space => space.id === destinationId && !space.archivedAt)
  if (!target || target.resources.some(item => item.kind === resource.kind && (resource.kind === 'file' ? documentPathKey(item.target) === documentPathKey(resource.target) : item.target === resource.target))) return state
  return { ...state, spaces: state.spaces.map(space => space.id !== destinationId ? space
    : suggestInitialName({ ...space, resources: [...space.resources, { ...resource, id, lastOpenedAt: undefined, pinnedToDock: false }] })) }
}

/** Preserve tab IDs and saved links; move only the explicitly chosen tabs. */
export function cabinetFromTabs(state: AppState, sourceId: string, tabIds: string[], id: string, tone: SpaceTone): AppState {
  const source = state.spaces.find(space => space.id === sourceId && !space.archivedAt)
  const chosen = (source?.activeSession?.tabs || []).filter(tab => tabIds.includes(tab.id))
  if (!source || !chosen.length) return state
  const space = normalizeSpace({ id, name: 'Новое пространство', nameOrigin: 'temporary', pinned: false,
    tone, resources: [], activeSession: { tabs: [], activeTabId: '' } })
  let next: AppState = { ...state, spaces: [...state.spaces, space], activeSpaceId: id }
  for (const tab of chosen) next = moveBrowserTab(next, sourceId, tab.id, id)
  for (const resource of source.resources.filter(item => item.kind === 'link' && chosen.some(tab => tab.url === item.target))) {
    next = copyMaterial(next, resource, id, `${id}:resource:${resource.id}`)
  }
  return { ...next, spaces: next.spaces.map(item => item.id === id ? suggestInitialName(item) : item) }
}

export function hasCabinetWork(space: Space): boolean {
  const session: BrowserSession = contextSession(space)
  return session.tabs.some(tab => tab.url) || Boolean(currentContext(space).documentIds.length
    || currentContext(space).checkpoint?.note || currentContext(space).checkpoint?.nextStep)
}
