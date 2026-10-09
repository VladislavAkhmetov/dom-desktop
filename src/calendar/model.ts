import type { Reminder } from '../types'
import { localDate } from '../../shared/state'

export type CalendarMode = 'day' | 'week' | 'month'
export const HOUR_HEIGHT = 80

export function calendarDates(reference: Date, mode: CalendarMode) {
  const first = new Date(reference)
  first.setHours(0, 0, 0, 0)
  if (mode === 'month') first.setDate(1)
  const leading = (first.getDay() + 6) % 7
  if (mode !== 'day') first.setDate(first.getDate() - leading)
  const monthEnd = new Date(reference.getFullYear(), reference.getMonth() + 1, 0)
  const count = mode === 'day' ? 1 : mode === 'week' ? 7 : Math.ceil((leading + monthEnd.getDate()) / 7) * 7
  return Array.from({ length: count }, (_, index) => { const day = new Date(first); day.setDate(first.getDate() + index); return day })
}

export function slotTime(day: Date, slot: number) {
  const result = new Date(day)
  const minutes = Math.max(0, Math.min(47, Math.floor(slot))) * 30
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return result
}

export function rescheduleCalendarTask(task: Reminder, target: Date, timed = false): Reminder {
  const due = new Date(target)
  if (!timed && task.dueAt) { const previous = new Date(task.dueAt); due.setHours(previous.getHours(), previous.getMinutes(), 0, 0) }
  return { ...task, plannedDate: localDate(target), kind: 'task', dueAt: timed || task.dueAt ? due.toISOString() : null, notifiedAt: undefined }
}
