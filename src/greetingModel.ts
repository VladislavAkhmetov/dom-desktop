import type { AppState, Reminder } from './types'
import { isRealReminder, realEvents, remindersForDay, sameDay } from './dayModel'
import { localDate } from '../shared/state'
import { getUserProfile } from './userProfile'

export interface GreetingAction {
  label: string
  type: 'focus' | 'day'
}

export interface GreetingInfo {
  text: string
  action?: GreetingAction
}

function declensionTasks(count: number): string {
  const rem10 = count % 10
  const rem100 = count % 100
  if (rem100 >= 11 && rem100 <= 19) return 'дел'
  if (rem10 === 1) return 'дело'
  if (rem10 >= 2 && rem10 <= 4) return 'дела'
  return 'дел'
}

export function selectGreeting(state: AppState, now: Date): GreetingInfo {
  const profile = getUserProfile(state)
  const rawName = profile.name?.trim() || ''
  const name = rawName && rawName.toLowerCase() !== 'пользователь' ? rawName.split(/\s+/)[0] : ''
  const hours = now.getHours()

  const todayStr = localDate(now) || ''
  const earlier = state.reminders.filter(
    (item: Reminder) => isRealReminder(item) && !item.done && item.plannedDate && item.plannedDate < todayStr
  )
  const todayTasks = remindersForDay(state, now)
  const todayEvents = realEvents(state).filter(event => {
    return (
      sameDay(event.startAt, now) ||
      (event.endAt && sameDay(event.endAt, now))
    )
  })
  const todayCount = todayTasks.length + todayEvents.length

  // 1. Поздний вечер / глухая ночь (23:00 – 04:59)
  if (hours >= 23 || hours < 5) {
    if (earlier.length > 0) {
      return {
        text: name ? `Засиделись допоздна, ${name}? Дела подождут утра.` : 'Засиделись допоздна? Дела подождут утра.',
        action: { label: 'Тихий фокус', type: 'focus' }
      }
    }
    return {
      text: name ? `Засиделись допоздна, ${name}?` : 'Засиделись допоздна?',
      action: { label: 'Тихий фокус', type: 'focus' }
    }
  }

  // 2. Раннее утро (05:00 – 07:59)
  if (hours >= 5 && hours < 8) {
    return {
      text: name ? `Ранний подъём, ${name}.` : 'Ранний подъём.',
      action: { label: 'План дня', type: 'day' }
    }
  }

  // 3. Хвосты с прошлых дней (связка со списком дел)
  if (earlier.length > 0) {
    return {
      text: earlier.length === 1 ? 'Осталась 1 мысль с прошлых дней' : `Осталось дел с прошлых дней: ${earlier.length}`,
      action: { label: 'В план дня', type: 'day' }
    }
  }

  // 4. Анализ дел на сегодня
  if (todayCount === 0) {
    const completedToday = state.reminders.filter(
      (item: Reminder) =>
        isRealReminder(item) &&
        item.done &&
        (item.plannedDate === todayStr || (item.dueAt && sameDay(item.dueAt, now)))
    )
    if (completedToday.length > 0) {
      return {
        text: 'Все дела закрыты. Отличная работа.'
      }
    }
    return {
      text: 'На этот день нет дел — чистый лист',
      action: { label: 'Добавить дело', type: 'day' }
    }
  }

  // 5. Дневные контекстные приветствия при наличии задач
  if (hours >= 8 && hours < 12) {
    return {
      text: name ? `Доброе утро, ${name}.` : 'Доброе утро.',
      action: { label: 'План дня', type: 'day' }
    }
  }

  if (hours >= 12 && hours < 18) {
    return {
      text: todayCount === 1 ? 'В плане на сегодня 1 дело' : `В плане на сегодня: ${todayCount} ${declensionTasks(todayCount)}`,
      action: { label: 'План дня', type: 'day' }
    }
  }

  // 18:00 – 22:59
  return {
    text: name ? `Добрый вечер, ${name}.` : 'Добрый вечер.',
    action: { label: 'План дня', type: 'day' }
  }
}
