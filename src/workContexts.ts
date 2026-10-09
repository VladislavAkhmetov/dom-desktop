import { normalizeSpace } from '../shared/state'
import type { AppState, BrowserSession, Resource, Space, WorkContext } from './types'

export function currentContext(space: Space): WorkContext {
  const value = normalizeSpace(space)
  return value.workContexts!.find(item => item.id === value.activeContextId) || value.workContexts![0]
}

export function contextSession(space: Space, contextId = currentContext(space).id): BrowserSession {
  const value = normalizeSpace(space)
  const context = value.workContexts!.find(item => item.id === contextId)
  const session = value.activeSession
  const tabs = (session?.tabs || []).filter(tab => tab.contextId === contextId)
  const activeTabId = tabs.some(tab => tab.id === context?.activeTabId) ? context!.activeTabId! : tabs[0]?.id || ''
  return { tabs, activeTabId, splitTabId: tabs.some(tab => tab.id === context?.splitTabId && tab.id !== activeTabId) ? context!.splitTabId : null, savedAt: session?.savedAt, closedTabs: session?.closedTabs?.filter(tab => tab.contextId === contextId) }
}

export function contextTitle(space: Space, context: WorkContext): string {
  return context.title || space.resources.find(item => context.documentIds.includes(item.id) && !item.completedAt)?.name || contextSession(space, context.id).tabs.find(tab => tab.url)?.title || context.checkpoint?.nextStep || 'Новое дело'
}

export function updateContextSession(space: Space, updater: (session: BrowserSession) => BrowserSession, now = new Date().toISOString(), contextId = currentContext(space).id, touch = true): Space {
  const value = normalizeSpace(space)
  if (!value.workContexts!.some(item => item.id === contextId)) return value
  const updated = updater(contextSession(value, contextId))
  const tabs = updated.tabs.map(tab => ({ ...tab, contextId }))
  const otherTabs = (value.activeSession?.tabs || []).filter(tab => tab.contextId !== contextId)
  const isCurrent = value.activeContextId === contextId
  const hasMaterial = tabs.some(tab => tab.url)
  return { ...value, lastActiveAt: touch && hasMaterial ? now : value.lastActiveAt,
    workContexts: value.workContexts!.map(item => item.id === contextId ? { ...item, activeTabId: updated.activeTabId, splitTabId: updated.splitTabId, lastActiveAt: touch && hasMaterial ? now : item.lastActiveAt, completedAt: touch && hasMaterial ? undefined : item.completedAt } : item),
    activeSession: { ...value.activeSession, tabs: [...otherTabs, ...tabs], activeTabId: isCurrent ? updated.activeTabId : value.activeSession?.activeTabId || '', splitTabId: isCurrent ? updated.splitTabId : value.activeSession?.splitTabId, savedAt: now, closedTabs: [...(value.activeSession?.closedTabs || []).filter(tab => tab.contextId !== contextId), ...(updated.closedTabs || []).map(tab => ({ ...tab, contextId }))] }
  }
}

export function activateContext(space: Space, contextId: string, now = new Date().toISOString()): Space {
  const value = normalizeSpace(space)
  if (!value.workContexts!.some(item => item.id === contextId)) return value
  const session = contextSession(value, contextId)
  const context = value.workContexts!.find(item => item.id === contextId)!
  const meaningful = session.tabs.some(tab => tab.url) || context.documentIds.length > 0 || Boolean(context.checkpoint)
  return { ...value, activeContextId: contextId, lastActiveAt: meaningful ? now : value.lastActiveAt,
    workContexts: value.workContexts!.map(item => item.id === contextId && meaningful ? { ...item, lastActiveAt: now, completedAt: undefined } : item),
    activeSession: { ...value.activeSession, tabs: value.activeSession?.tabs || [], activeTabId: session.activeTabId, splitTabId: session.splitTabId } }
}

export function createContext(space: Space, id: string, title: string): Space {
  const value = normalizeSpace(space)
  return { ...value, activeContextId: id, workContexts: [...value.workContexts!, { id, title: title.trim(), documentIds: [], activeTabId: '', splitTabId: null }], activeSession: { ...value.activeSession, tabs: value.activeSession?.tabs || [], activeTabId: '', splitTabId: null } }
}

export function recordDocumentOpen(space: Space, resource: Resource, contextId = currentContext(space).id, now = new Date().toISOString()): Space {
  const value = normalizeSpace(space)
  if (resource.kind !== 'file' || !value.resources.some(item => item.id === resource.id)) return value
  return { ...value, lastActiveAt: now, resources: value.resources.map(item => item.id === resource.id ? { ...item, lastOpenedAt: now, completedAt: undefined } : item),
    workContexts: value.workContexts!.map(item => item.id === contextId ? { ...item, lastActiveAt: now, completedAt: undefined, documentIds: item.excludedDocumentIds?.includes(resource.id) || item.documentIds.includes(resource.id) ? item.documentIds : [...item.documentIds, resource.id] } : item) }
}

export function contextDocuments(space: Space, context: WorkContext): Resource[] {
  const paths = new Set<string>()
  return context.documentIds.flatMap(id => {
    const item = space.resources.find(resource => resource.id === id && resource.kind === 'file' && !resource.completedAt)
    if (!item || /\.(exe|com|msi|cmd|bat|ps1|vbs|js|lnk|url)$/i.test(item.target)) return []
    const path = documentPathKey(item.target)
    if (paths.has(path)) return []
    paths.add(path)
    return [item]
  })
}

export function documentPathKey(target: string): string {
  const value = target.replace(/\\/g, '/')
  return /^[a-z]:\//i.test(value) || value.startsWith('//') ? value.toLocaleLowerCase('en-US') : value
}

export function latestContinuation(state: AppState) {
  return state.spaces.filter(space => !space.archivedAt && space.kind !== 'web').flatMap(original => {
    const space = normalizeSpace(original)
    return space.workContexts!.flatMap(context => {
      if (context.completedAt) return []
      const documents = contextDocuments(space, context)
      const tabs = contextSession(space, context.id).tabs.filter(tab => tab.url)
      if (!documents.length && !tabs.length && !context.checkpoint) return []
      const at = [context.lastActiveAt, context.checkpoint?.savedAt].filter(Boolean).sort((a, b) => Date.parse(b!) - Date.parse(a!))[0]
      return [{ space, context, documents, tabs, at, title: contextTitle(space, context) }]
    })
  }).sort((a, b) => (Date.parse(b.at || '') || 0) - (Date.parse(a.at || '') || 0))[0]
}
