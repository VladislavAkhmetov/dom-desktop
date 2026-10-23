import type { AppState, Reminder } from './types'
import { localDate } from '../shared/state'

// These IDs belong to the old prototype fixtures, not connected accounts.
export const isRealReminder = (item: Reminder) => !['starter-meeting', 'starter-design'].includes(item.id)
export const realEvents = (state: AppState) => (state.events || []).filter(event => !/^ev-[123]$/.test(event.id))

export function sameDay(iso: string, date: Date) {
  return new Date(iso).toDateString() === date.toDateString()
}

export function planTime(dayOffset: number, now = new Date()) {
  const date = new Date(now)
  date.setDate(date.getDate() + dayOffset)
  date.setHours(0, 0, 0, 0)
  return date
}

export function remindersForDay(state: AppState, date: Date) {
  const targetKey = localDate(date)
  return state.reminders.filter(item =>
    isRealReminder(item) &&
    !item.done &&
    (item.plannedDate ? item.plannedDate === targetKey : Boolean(item.dueAt && sameDay(item.dueAt, date)))
  ).sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity))
}

export function postponeReminder(item: Reminder, choice: 'hour' | 'tomorrow', now = new Date()): Reminder {
  const due = new Date(now)
  if (choice === 'hour') due.setTime(due.getTime() + 60 * 60 * 1000)
  else {
    due.setDate(due.getDate() + 1)
    if (item.dueAt) { const previous = new Date(item.dueAt); due.setHours(previous.getHours(), previous.getMinutes(), 0, 0) }
  }
  return { ...item, kind: 'task', plannedDate: localDate(due), dueAt: choice === 'hour' || item.dueAt ? due.toISOString() : null, notifiedAt: undefined, done: false }
}

export function rescheduleTaskToToday(item: Reminder, now = new Date()): Reminder {
  let dueAt: string | null = null
  if (item.dueAt) {
    const previous = new Date(item.dueAt)
    const next = new Date(now)
    next.setHours(previous.getHours(), previous.getMinutes(), 0, 0)
    dueAt = next.toISOString()
  }
  return {
    ...item,
    kind: 'task',
    plannedDate: localDate(now),
    dueAt,
    notifiedAt: undefined,
    done: false
  }
}
