import type { AppState } from './types'
import { mailIsImportant } from './mailModel'
export type Attention = { id: string; type: 'task' | 'event' | 'mail' | 'focus'; title: string; label: string; targetId: string; url?: string }
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
