import type { AppState } from './types'
import { mailIsImportant } from './mailModel'
export type Attention = { id: string; type: 'task' | 'event' | 'mail' | 'focus'; title: string; label: string; targetId: string; url?: string }
export type AttentionSignal = Omit<Attention, 'type'> & { type: Attention['type'] | 'music' | 'activity'; detail?: string }
type FocusState = { status: string; remainingSeconds: number; durationMinutes?: number; task?: { id: string; title: string } }

/** Both surfaces share notices and dismissals; browsing omits ambient playback/work. */
export function selectAttentionSignal(state: AppState, now: Date, focus: FocusState, options: { ambient?: boolean; music?: string } = {}): AttentionSignal | null {
  const attention = selectAttention(state, now, options.ambient ? focus : { ...focus, status: 'idle' })
  if (attention) return attention
  const activity = [...(state.aiJournal || [])].reverse().find(item =>
    !state.dismissedNotices?.includes('activity:' + item.id) &&
    (options.ambient && item.status === 'running' || (item.status === 'done' || item.status === 'error') && now.getTime() - Date.parse(item.at) >= 0 && now.getTime() - Date.parse(item.at) < 5 * 60000))
  if (activity) return { id: 'activity:' + activity.id, targetId: activity.id, type: 'activity', title: activity.status === 'running' ? 'Помощник работает' : activity.status === 'error' ? 'Ошибка запроса' : 'Ответ готов', label: activity.model, detail: activity.result || activity.error }
  if (options.ambient && options.music) return { id: 'music', targetId: '', type: 'music', title: options.music, label: 'Сейчас играет' }
  if (focus.status === 'completed') return { id: 'focus-completed', targetId: '', type: 'focus', title: 'Фокус завершён', label: focus.task?.title || `${focus.durationMinutes || 30} мин` }
  return null
}

export function attentionLine(signal: AttentionSignal | null, sender?: string): string {
  if (!signal) return ''
  if (signal.type === 'task') return `Сейчас · ${signal.title}`
  if (signal.type === 'event') return `${signal.label} · ${signal.title}`
  if (signal.type === 'mail') return `${sender?.replace(/\s*<[^>]*>\s*$/, '').trim() || 'Важное письмо'} · ${signal.title}`
  return signal.type === 'focus' && signal.id === 'focus-completed' ? `${signal.title}${signal.label ? ' · ' + signal.label : ''}` : signal.title
}
export function selectAttention(state: AppState, now: Date, focus: { status: string; remainingSeconds: number; task?: { id: string; title: string } }): Attention | null {
  const pending = state.reminders.filter(item => !item.done && item.dueAt && Date.parse(item.dueAt) <= now.getTime() && Date.parse(item.dueAt) >= now.getTime() - 30 * 60000 && !state.dismissedNotices?.includes(`task:${item.id}:${item.dueAt}`)).sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!))[0]
  if (pending) return { id: `task:${pending.id}:${pending.dueAt}`, type: 'task', targetId: pending.id, title: pending.title, label: 'Сейчас' }
  const event = state.events?.filter(item => !item.allDay && item.noticeMinutes && Date.parse(item.startAt) - now.getTime() <= item.noticeMinutes * 60000 && Date.parse(item.startAt) >= now.getTime() - 5 * 60000 && !state.dismissedNotices?.includes(`event:${item.id}:${item.startAt}`)).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))[0]
  if (event) return { id: `event:${event.id}:${event.startAt}`, type: 'event', targetId: event.id, title: event.title, label: Date.parse(event.startAt) > now.getTime() ? `Через ${Math.ceil((Date.parse(event.startAt) - now.getTime()) / 60000)} мин` : 'Начинается', url: event.meetingUrl }
  if (focus.status === 'running') return { id: 'focus', type: 'focus', title: focus.task?.title || 'Фокус', label: `Фокус · ${Math.ceil(focus.remainingSeconds / 60)} мин`, targetId: focus.task?.id || '' }
  const mail = state.mailMessages?.filter(item => item.unread && mailIsImportant(state, item) && Date.parse(item.receivedAt) >= now.getTime() - 30 * 60000 && !state.dismissedNotices?.includes(`mail:${item.id}`)).sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))[0]
  if (mail) return { id: `mail:${mail.id}`, type: 'mail', title: mail.subject, label: 'Важное письмо', targetId: mail.id, url: mail.url }
  return null
}
