import type { AppState } from './types'
import { saveCheckpoint } from './checkpoints'
export type AssistantAction = { type: 'create_task'; title: string; plannedDate?: string } | { type: 'save_link'; title: string; url: string; spaceId: string } | { type: 'checkpoint'; spaceId: string; nextStep: string }
const validDay = (day: unknown) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T12:00:00`)) && new Date(`${day}T12:00:00`).getDate() === Number(day.slice(8))
export function proposedActions(text: string): AssistantAction[] {
  try {
    const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(match => { try { return JSON.parse(match[1]) } catch { return null } })
    const data = blocks.find(value => Array.isArray(value?.actions)) || JSON.parse(text)
    return (data.actions || []).slice(0, 20).filter((item: AssistantAction) => {
      if (!item || typeof item !== 'object') return false
      if (item.type === 'create_task') return typeof item.title === 'string' && Boolean(item.title.trim()) && item.title.length <= 500 && (item.plannedDate === undefined || validDay(item.plannedDate))
      if (item.type === 'checkpoint') return typeof item.spaceId === 'string' && typeof item.nextStep === 'string' && item.nextStep.length > 0 && item.nextStep.length <= 500
      if (item.type === 'save_link') { try { const url = new URL(item.url); return typeof item.spaceId === 'string' && typeof item.title === 'string' && item.title.length <= 500 && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false } }
      return false
    })
  } catch { return [] }
}
export function applyAssistantAction(state: AppState, action: AssistantAction): AppState {
  if (action.type === 'create_task') return { ...state, reminders: [{ id: crypto.randomUUID(), title: action.title.trim(), kind: 'task', dueAt: null, plannedDate: action.plannedDate || null, createdAt: new Date().toISOString(), done: false }, ...state.reminders] }
  const space = state.spaces.find(item => item.id === action.spaceId && !item.archivedAt)
  if (!space) throw new Error('Указанное пространство недоступно')
  if (action.type === 'checkpoint') return saveCheckpoint(state, space.id, { nextStep: action.nextStep })
  const url = new URL(action.url).toString()
  if (space.resources.some(item => item.target === url)) return state
  return { ...state, spaces: state.spaces.map(item => item.id === space.id ? { ...item, resources: [...item.resources, { id: crypto.randomUUID(), kind: 'link', name: action.title || new URL(url).hostname, target: url, createdAt: new Date().toISOString() }] } : item) }
}
