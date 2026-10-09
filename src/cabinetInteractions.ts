import type { DragEvent } from 'react'
import type { AppState, Space } from './types'
import { contextSession } from './workContexts'

export type CabinetDrag = { kind: 'space' | 'tab' | 'resource'; spaceId: string; id: string }
export const cabinetDragType = 'application/x-dombro-cabinet'

export function writeCabinetDrag(event: DragEvent<HTMLElement>, value: CabinetDrag) {
  event.dataTransfer.setData(cabinetDragType, JSON.stringify(value))
  event.dataTransfer.effectAllowed = value.kind === 'resource' ? 'copy' : 'move'
}

export function readCabinetDrag(event: DragEvent<HTMLElement>): CabinetDrag | null {
  try {
    const raw = event.dataTransfer.getData(cabinetDragType)
    if (raw.length > 2048) return null
    const value = JSON.parse(raw)
    return value && ['space', 'tab', 'resource'].includes(value.kind) && typeof value.id === 'string' && typeof value.spaceId === 'string'
      ? { kind: value.kind, id: value.id, spaceId: value.spaceId } : null
  } catch { return null }
}

export function reorderCabinets(state: AppState, id: string, targetId: string, after = false, pin = false): AppState {
  const source = state.spaces.find(space => space.id === id && !space.archivedAt && space.kind !== 'web')
  const target = state.spaces.find(space => space.id === targetId && !space.archivedAt && space.kind !== 'web')
  if (!source || !target || id === targetId) return state
  const spaces = state.spaces.filter(space => space.id !== id)
  spaces.splice(spaces.findIndex(space => space.id === targetId) + Number(after), 0, pin ? { ...source, pinned: true } : source)
  return { ...state, spaces }
}

/** Keep saved links in storage; only omit their duplicate presentation while a tab exists. */
export function cabinetContents(space: Space) {
  const tabs = contextSession(space).tabs.filter(tab => Boolean(tab.url))
  const urls = new Set(tabs.map(tab => tab.url))
  return { tabs, materials: space.resources.filter(resource => resource.kind !== 'app' && !(resource.kind === 'link' && urls.has(resource.target))), tools: space.resources.filter(resource => resource.kind === 'app') }
}
