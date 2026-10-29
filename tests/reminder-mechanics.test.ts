// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { AppState, Reminder } from '../src/types'
import { postponeReminder, quietIfPast, remindersForDay, rescheduleTaskToToday, snoozeReminder } from '../src/dayModel'
import { rescheduleCalendarTask } from '../src/calendar/model'
import { selectAttention } from '../src/attentionModel'
import { shouldRing } from '../src/AttentionIsland'
import { parseCapture } from '../src/reminders'

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m)
const task = (patch: Partial<Reminder> = {}): Reminder => ({ id: 'r', title: 'Позвонить в типографию', createdAt: at(20, 8).toISOString(), dueAt: null, done: false, kind: 'task', ...patch })
const state = (reminders: Reminder[]) => ({ reminders, events: [], dismissedNotices: [], spaces: [] } as unknown as AppState)
const idle = { status: 'idle', remainingSeconds: 0 }

describe('Напоминания и откладывание', () => {
  it('«Напомнить через 15 мин» в 23:50 переносит и день плана на завтра', () => {
    const snoozed = snoozeReminder(task({ plannedDate: '2026-10-27', dueAt: at(27, 23, 45).toISOString(), notifiedAt: at(27, 23, 45).toISOString() }), 15, at(27, 23, 50))
    expect(new Date(snoozed.dueAt!).getTime()).toBe(at(28, 0, 5).getTime())
    expect(snoozed.plannedDate).toBe('2026-10-28')
    expect(snoozed.notifiedAt).toBeUndefined()
    expect(remindersForDay(state([snoozed]), at(27, 12)).length).toBe(0)
    expect(remindersForDay(state([snoozed]), at(28, 12)).length).toBe(1)
  })
  it('отложенное не висит в острове как «Сейчас», пока не наступит новый срок', () => {
    const now = at(27, 15, 0)
    const snoozed = snoozeReminder(task({ dueAt: at(27, 14, 55).toISOString() }), 15, now)
    expect(selectAttention(state([snoozed]), now, idle)?.label).not.toBe('Сейчас')
    expect(selectAttention(state([snoozed]), at(27, 15, 16), idle)?.label).toBe('Сейчас')
  })
  it('перенос просроченного дела на сегодня не звонит сразу, если время уже прошло', () => {
    const now = at(27, 15, 0)
    const moved = rescheduleTaskToToday(task({ plannedDate: '2026-10-24', dueAt: at(24, 9).toISOString() }), now)
    expect(moved.plannedDate).toBe('2026-10-27')
    expect(new Date(moved.dueAt!).getHours()).toBe(9)
    expect(moved.notifiedAt).toBe(now.toISOString())
    const later = rescheduleTaskToToday(task({ plannedDate: '2026-10-24', dueAt: at(24, 18).toISOString() }), now)
    expect(later.notifiedAt).toBeUndefined()
  })
  it('перетаскивание в календаре на прошедшее время — тоже тихо, на будущее — звонит', () => {
    const now = at(27, 15, 0)
    expect(rescheduleCalendarTask(task({ dueAt: at(24, 9).toISOString() }), at(27, 0), false, now).notifiedAt).toBe(now.toISOString())
    expect(rescheduleCalendarTask(task({ dueAt: at(24, 9).toISOString() }), at(28, 0), false, now).notifiedAt).toBeUndefined()
    expect(rescheduleCalendarTask(task(), at(27, 16, 30), true, now).notifiedAt).toBeUndefined()
  })
  it('«Через час» в 23:40 и «Завтра» с сохранением времени', () => {
    const hour = postponeReminder(task({ plannedDate: '2026-10-27', dueAt: at(27, 23, 30).toISOString() }), 'hour', at(27, 23, 40))
    expect(hour.plannedDate).toBe('2026-10-28')
    const tomorrow = postponeReminder(task({ plannedDate: '2026-10-27', dueAt: at(27, 10, 30).toISOString() }), 'tomorrow', at(27, 12))
    expect(new Date(tomorrow.dueAt!).getTime()).toBe(at(28, 10, 30).getTime())
    const untimed = postponeReminder(task({ plannedDate: '2026-10-20' }), 'tomorrow', at(27, 12))
    expect(untimed).toMatchObject({ plannedDate: '2026-10-28', dueAt: null })
  })
  it('выполненное дело quietIfPast не трогает', () => {
    const done = task({ done: true, dueAt: at(27, 9).toISOString() })
    expect(quietIfPast(done, at(27, 15))).toBe(done)
  })
  it('свежее напоминание не прячется за более старым, которое ещё висит', () => {
    const older = task({ id: 'older', title: 'Старое', dueAt: at(27, 14, 50).toISOString() })
    const fresh = task({ id: 'fresh', title: 'Новое', dueAt: at(27, 15, 0).toISOString() })
    expect(selectAttention(state([older, fresh]), at(27, 15, 1), idle)?.title).toBe('Новое')
  })
  it('остров звенит один раз и только на свежем сроке', () => {
    const now = at(27, 15, 1)
    const fresh = task({ id: 'fresh', dueAt: at(27, 15, 0).toISOString() })
    const old = task({ id: 'old', dueAt: at(27, 14, 40).toISOString() })
    const freshSignal = { id: `task:fresh:${fresh.dueAt}`, type: 'task', targetId: 'fresh', title: fresh.title, label: 'Сейчас' } as const
    const oldSignal = { id: `task:old:${old.dueAt}`, type: 'task', targetId: 'old', title: old.title, label: 'Сейчас' } as const
    const soonSignal = { id: `task:fresh:${fresh.dueAt}:soon`, type: 'task', targetId: 'fresh', title: fresh.title, label: 'Через 5 мин' } as const
    expect(shouldRing(freshSignal as never, state([fresh, old]), now)).toBe(true)
    expect(shouldRing(oldSignal as never, state([fresh, old]), now)).toBe(false)
    expect(shouldRing(soonSignal as never, state([fresh, old]), now)).toBe(false)
  })

  it('автоматически распознаёт ссылки на созвоны и время при вводе фразы', () => {
    const fixedNow = at(27, 10, 0)
    // 1. Google Meet со временем
    const parsedMeet = parseCapture('Созвон в 14:00 https://meet.google.com/abc-defg-hij', fixedNow)
    expect(parsedMeet.title).toBe('Созвон')
    expect(parsedMeet.meetingUrl).toBe('https://meet.google.com/abc-defg-hij')
    expect(parsedMeet.kind).toBe('task')
    expect(new Date(parsedMeet.dueAt!).getHours()).toBe(14)
    expect(new Date(parsedMeet.dueAt!).getMinutes()).toBe(0)
    expect(parsedMeet.plannedDate).toBe('2026-10-27')

    // 2. В кавычках с пунктуацией
    const parsedQuotes = parseCapture('«Созвон по проекту в 15:30 https://meet.google.com/xyz-uvwx-rst»', fixedNow)
    expect(parsedQuotes.title).toBe('Созвон по проекту')
    expect(parsedQuotes.meetingUrl).toBe('https://meet.google.com/xyz-uvwx-rst')

    // 3. Zoom
    const parsedZoom = parseCapture('Встреча с клиентом https://us02web.zoom.us/j/1234567890?pwd=secret', fixedNow)
    expect(parsedZoom.title).toBe('Встреча с клиентом')
    expect(parsedZoom.meetingUrl).toBe('https://us02web.zoom.us/j/1234567890?pwd=secret')
    expect(parsedZoom.kind).toBe('task')

    // 4. Яндекс.Телемост
    const parsedTelemost = parseCapture('Синхрон команды https://telemost.yandex.ru/j/98765432101234', fixedNow)
    expect(parsedTelemost.title).toBe('Синхрон команды')
    expect(parsedTelemost.meetingUrl).toBe('https://telemost.yandex.ru/j/98765432101234')

    // 5. Только ссылка без темы
    const parsedBare = parseCapture('https://meet.google.com/foo-bar-baz', fixedNow)
    expect(parsedBare.title).toBe('Созвон')
    expect(parsedBare.meetingUrl).toBe('https://meet.google.com/foo-bar-baz')
  })

  it('передаёт meetingUrl задачи в сигнал островка внимания', () => {
    const now = at(27, 14, 55)
    const meetingTask = task({
      id: 'task-meet',
      title: 'Созвон по дизайну',
      dueAt: at(27, 15, 5).toISOString(),
      meetingUrl: 'https://meet.google.com/abc-defg-hij'
    })
    const signal = selectAttention(state([meetingTask]), now, idle)
    expect(signal?.type).toBe('task')
    expect(signal?.url).toBe('https://meet.google.com/abc-defg-hij')
  })
})
