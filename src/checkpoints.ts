import type { AppState, Checkpoint } from './types'

export function saveCheckpoint(state: AppState, spaceId: string, details: { note?: string; nextStep?: string; resourceId?: string } = {}, now = new Date()): AppState {
  const space = state.spaces.find(item => item.id === spaceId)
  if (!space) return state
  const checkpoint: Checkpoint = {
    id: crypto.randomUUID(), spaceId, note: details.note ?? space.checkpoint?.note ?? '', nextStep: details.nextStep ?? space.checkpoint?.nextStep ?? '',
    resourceId: details.resourceId, savedAt: now.toISOString(), session: structuredClone(space.activeSession)
  }
  return { ...state, spaces: state.spaces.map(item => item.id === spaceId ? { ...item, checkpoint, checkpointHistory: [checkpoint, ...(item.checkpointHistory || [])].slice(0, 20) } : item) }
}
