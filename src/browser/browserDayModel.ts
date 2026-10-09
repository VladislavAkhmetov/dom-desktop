import type { AppState, CalendarEvent } from '../types'
import type { ZenTimerState } from '../focus/zenTimer'
import { selectAttention } from '../attentionModel'
import { isRealReminder, realEvents, remindersForDay } from '../dayModel'
import { localDate } from '../../shared/state'

export interface BrowserPulse {
  kind: 'task' | 'event' | 'mail' | 'focus' | 'day'
  title: string
  detail: string
  urgent: boolean
}

export function eventTime(event: CalendarEvent, now: Date) {
  if (event.allDay) return 'Весь день'
  const minutes = Math.ceil((Date.parse(event.startAt) - now.getTime()) / 60_000)
  const time = new Date(event.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return minutes <= 0 ? `${time} · идёт сейчас` : minutes <= 60 ? `${time} · через ${minutes} мин` : time
}

/** A presentation adapter over the same reminders, calendar and attention rules as Home. */
export function browserDayModel(state: AppState, now: Date, focus: ZenTimerState) {
  const today = localDate(now)!
  const end = new Date(now); end.setHours(24, 0, 0, 0)
  const events = realEvents(state).filter(event => {
    if (!event.allDay) return Date.parse(event.startAt) < end.getTime() && Date.parse(event.endAt) > now.getTime()
    const startDate = event.startDate || localDate(new Date(event.startAt))
    const endDate = event.endDate || localDate(new Date(event.endAt))
    return Boolean(startDate && endDate && startDate <= today && endDate > today)
  })
    .sort((a, b) => Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || Date.parse(a.startAt) - Date.parse(b.startAt))
  const tasks = remindersForDay(state, now)
  const overdue = state.reminders.filter(item => isRealReminder(item) && !item.done && item.plannedDate && item.plannedDate < today)
  const attention = selectAttention({ ...state, reminders: state.reminders.filter(isRealReminder), events: realEvents(state) }, now, focus)
  const nextEvent = events.find(event => !event.allDay && !state.dismissedNotices?.includes(`event:${event.id}:${event.startAt}`))
  const calendarErrors = (state.calendarSubscriptions || []).filter(source => source.error)
  let pulse: BrowserPulse
  if (attention) {
    const minutes = attention.type === 'event' ? attention.label.toLocaleLowerCase('ru-RU') : ''
    pulse = {
      kind: attention.type,
      title: attention.type === 'event' ? `Встреча ${minutes}` : attention.type === 'focus' ? attention.label : attention.title,
      detail: attention.type === 'event' || attention.type === 'focus' ? attention.title : attention.type === 'task' ? 'Напоминание · сейчас' : 'Важное письмо',
      urgent: attention.type === 'task' || attention.type === 'event'
    }
  } else if (focus.status === 'completed') {
    pulse = { kind: 'focus', title: 'Фокус завершён', detail: focus.task?.title || 'Можно сделать перерыв', urgent: false }
  } else if (nextEvent) {
    pulse = { kind: 'event', title: eventTime(nextEvent, now), detail: nextEvent.title, urgent: false }
  } else {
    pulse = { kind: 'day', title: 'Мой день', detail: calendarErrors.length ? 'Календарь требует внимания' : tasks.length ? `Дел на сегодня: ${tasks.length}` : overdue.length ? `Осталось с прошлых дней: ${overdue.length}` : 'На сегодня нет дел', urgent: false }
  }
  return { pulse, tasks, overdue, events, attention, calendarErrors }
}

export type BrowserDayModel = ReturnType<typeof browserDayModel>
