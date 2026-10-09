import type { AppState, Checkpoint } from './types'
import { normalizeSpace } from '../shared/state'
import { contextSession, currentContext } from './workContexts'

export function saveCheckpoint(state: AppState, spaceId: string, details: { note?: string; nextStep?: string; resourceId?: string; contextId?: string } = {}, now = new Date()): AppState {
  const original = state.spaces.find(item => item.id === spaceId)
  if (!original) return state
  const space = normalizeSpace(original)
  const context = space.workContexts!.find(item => item.id === details.contextId) || currentContext(space)
  const checkpoint: Checkpoint = {
    id: crypto.randomUUID(), spaceId, contextId: context.id, note: details.note ?? context.checkpoint?.note ?? '', nextStep: details.nextStep ?? context.checkpoint?.nextStep ?? '',
    resourceId: details.resourceId, savedAt: now.toISOString(), session: structuredClone(contextSession(space, context.id))
  }
  return { ...state, spaces: state.spaces.map(item => item.id === spaceId ? { ...space, checkpoint, workContexts: space.workContexts!.map(value => value.id === context.id ? { ...value, checkpoint, lastActiveAt: checkpoint.savedAt, completedAt: undefined, documentIds: details.resourceId && space.resources.some(resource => resource.id === details.resourceId && resource.kind === 'file') ? [...new Set([...value.documentIds, details.resourceId])] : value.documentIds } : value), checkpointHistory: [checkpoint, ...(item.checkpointHistory || [])].slice(0, 20) } : item) }
}
