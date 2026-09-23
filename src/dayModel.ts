import type { AppState, Reminder } from './types'

// These IDs belong to the old prototype fixtures, not connected accounts.
export const isRealReminder = (item: Reminder) => !['starter-meeting', 'starter-design'].includes(item.id)
export const realEvents = (state: AppState) => (state.events || []).filter(event => !/^ev-[123]$/.test(event.id))

export function sameDay(iso: string, date: Date) {
  return new Date(iso).toDateString() === date.toDateString()
}

export function planTime(dayOffset: number, now = new Date()) {
  const date = new Date(now)
  if (dayOffset) { date.setDate(date.getDate() + dayOffset); date.setHours(9, 0, 0, 0) }
  else if (date.getHours() === 23) date.setHours(23, 59, 0, 0)
  else date.setHours(date.getHours() + 1, 0, 0, 0)
  return date
}

export function remindersForDay(state: AppState, date: Date) {
  return state.reminders.filter(item => isRealReminder(item) && !item.done && item.dueAt && sameDay(item.dueAt, date))
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!))
}

export function postponeReminder(item: Reminder, choice: 'hour' | 'tomorrow', now = new Date()): Reminder {
  const due = new Date(now)
  if (choice === 'hour') due.setTime(due.getTime() + 60 * 60 * 1000)
  else { due.setDate(due.getDate() + 1); due.setHours(9, 0, 0, 0) }
  return { ...item, dueAt: due.toISOString(), notifiedAt: undefined, done: false }
}
