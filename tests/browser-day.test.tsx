// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyState, localDate } from '../shared/state'
import { browserDayModel } from '../src/browser/browserDayModel'
import { BrowserDayPanel, type BrowserDayPanelProps } from '../src/browser/BrowserDayPanel'
import type { ZenTimerState } from '../src/focus/zenTimer'

const now = new Date(2026, 9, 2, 9, 18)
const focus: ZenTimerState = { status: 'running', durationMinutes: 30, remainingSeconds: 1080, progress: .4 }
const idle: ZenTimerState = { ...focus, status: 'idle' }

describe('пульс и данные дня', () => {
  it('использует общий приоритет: напоминание, встреча с напоминанием, фокус; скрытое событие не возвращается в пульс', () => {
    const state = emptyState()
    const start = new Date(now.getTime() + 12 * 60000).toISOString()
    state.events = [{ id: 'meeting', title: 'Обсудить браузинг', category: 'meeting', startAt: start, endAt: new Date(now.getTime() + 42 * 60000).toISOString(), noticeMinutes: 15 }]
    state.reminders = [{ id: 'task', title: 'Отправить макет', createdAt: now.toISOString(), dueAt: now.toISOString(), done: false }]
    expect(browserDayModel(state, now, focus).pulse.kind).toBe('task')
    state.reminders[0].done = true
    expect(browserDayModel(state, now, focus).pulse).toMatchObject({ kind: 'event', title: 'Встреча через 12 мин', urgent: true })
    state.dismissedNotices = [`event:meeting:${start}`]
    expect(browserDayModel(state, now, focus).pulse.kind).toBe('focus')
    expect(browserDayModel(state, now, idle).pulse.kind).toBe('day')
    expect(browserDayModel(state, now, idle).events).toHaveLength(1)
  })

  it('исключает закончившиеся и завтрашние события, учитывает исключительную дату окончания события на весь день', () => {
    const state = emptyState()
    const event = { title: 'Событие', category: 'personal' as const, startAt: new Date(2026, 9, 1).toISOString(), endAt: new Date(2026, 9, 3).toISOString() }
    state.events = [
      { ...event, id: 'today', allDay: true, startDate: '2026-10-02', endDate: '2026-10-03' },
      { ...event, id: 'yesterday', allDay: true, startDate: '2026-10-01', endDate: '2026-10-02' },
      { ...event, id: 'tomorrow', startAt: new Date(2026, 9, 3, 9).toISOString(), endAt: new Date(2026, 9, 3, 10).toISOString() },
      { ...event, id: 'finished', startAt: new Date(2026, 9, 2, 8).toISOString(), endAt: new Date(2026, 9, 2, 9).toISOString() }
    ]
    expect(browserDayModel(state, now, idle).events.map(event => event.id)).toEqual(['today'])
  })

  it('не выдаёт ошибку календаря за спокойный день и не включает старые демонстрационные напоминания', () => {
    const state = emptyState()
    state.reminders = [{ id: 'starter-meeting', title: 'Старый пример', createdAt: now.toISOString(), dueAt: now.toISOString(), done: false }]
    state.calendarSubscriptions = [{ id: 'calendar', name: 'Рабочий', url: 'https://example.com/calendar.ics', error: 'Нет сети' }]
    const model = browserDayModel(state, now, idle)
    expect(model.tasks).toHaveLength(0)
    expect(model.pulse).toMatchObject({ kind: 'day', detail: 'Календарь требует внимания' })
  })
})

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let props: BrowserDayPanelProps
beforeEach(() => {
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
  const state = emptyState()
  state.reminders = [{ id: 'task', title: 'Обновить панель', createdAt: now.toISOString(), dueAt: null, plannedDate: localDate(now), done: false }]
  props = { state, model: browserDayModel(state, now, idle), now, focus: idle, pinned: false,
    onPin: vi.fn(), onClose: vi.fn(), onHome: vi.fn(), onCalendar: vi.fn(), onFocus: vi.fn(), onCapture: vi.fn(), onAssistant: vi.fn(), onOpen: vi.fn(), onSpace: vi.fn(), onComplete: vi.fn(async () => true), onAddTask: vi.fn(async () => true) }
})
afterEach(async () => { await act(async () => root.unmount()) })

describe('действия в панели дня', () => {
  it('сохраняет введённый текст при ошибке и не отправляет повторно во время ожидания', async () => {
    let finish!: (result: boolean) => void
    props.onAddTask = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve }))
    await act(async () => root.render(<BrowserDayPanel {...props} />))
    const input = document.querySelector<HTMLInputElement>('#browser-day-task')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Проверить макет')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const submit = () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await act(async () => { submit(); submit() })
    expect(props.onAddTask).toHaveBeenCalledExactlyOnceWith('Проверить макет')
    await act(async () => finish(false))
    expect(input.value).toBe('Проверить макет')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Не удалось сохранить')
    await act(async () => submit())
    await act(async () => finish(true))
    expect(input.value).toBe('')
  })

  it('завершает указанное дело и оставляет закреплённую панель открытой по Escape', async () => {
    await act(async () => root.render(<BrowserDayPanel {...props} pinned />))
    await act(async () => document.querySelector<HTMLButtonElement>('.browser-task-check')!.click())
    expect(props.onComplete).toHaveBeenCalledExactlyOnceWith('task')
    await act(async () => document.querySelector('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(props.onClose).not.toHaveBeenCalled()
  })
})
