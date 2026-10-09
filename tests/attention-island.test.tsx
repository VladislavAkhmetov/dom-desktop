// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyState } from '../shared/state'
import { AttentionIsland } from '../src/AttentionIsland'
import type { AppState } from '../src/types'

const timer = vi.hoisted(() => ({ state: { status: 'idle', remainingSeconds: 1800, durationMinutes: 30, progress: 0 }, stop: vi.fn(), reset: vi.fn() }))
vi.mock('../src/focus/zenTimer', () => ({ zenTimer: { getState: () => timer.state, subscribe: () => () => undefined, stop: timer.stop, reset: timer.reset } }))
vi.mock('../src/player/audioStream', () => ({ audioManager: { getIsPlaying: () => false, subscribe: () => () => undefined } }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const now = new Date(2026, 8, 30, 20, 0)
let root: Root
let stored: AppState
let saveSucceeds: boolean
const onSpace = vi.fn(), onOpen = vi.fn(), onFocus = vi.fn()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
  stored = emptyState(); saveSucceeds = true
  timer.state = { status: 'idle', remainingSeconds: 1800, durationMinutes: 30, progress: 0 }
  timer.reset.mockReset(); timer.stop.mockReset(); onSpace.mockReset(); onOpen.mockReset(); onFocus.mockReset()
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers() })

function Surface() {
  const [state, setState] = useState(stored)
  return <AttentionIsland state={state} now={now} onOpen={onOpen} onSpace={onSpace} onFocus={onFocus} onChange={async update => {
    if (!saveSucceeds) return false
    stored = update(stored); setState(stored); return true
  }} />
}
async function mount() { await act(async () => root.render(<Surface />)); await click(document.querySelector<HTMLButtonElement>('.island-trigger')!) }
async function click(element: HTMLElement) { await act(async () => element.click()) }
function button(text: string) {
  const result = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)
  if (!result) throw new Error(`Кнопка не найдена: ${text}`)
  return result
}
function task() { stored.reminders.push({ id: 'order', title: 'Забрать заказ', createdAt: now.toISOString(), dueAt: now.toISOString(), plannedDate: '2026-09-30', kind: 'task', done: false, notifiedAt: now.toISOString() }) }
function meeting(spaceId?: string) { stored.events = [{ id: 'meeting', title: 'Обсудить макет', startAt: new Date(now.getTime() + 5 * 60_000).toISOString(), endAt: new Date(now.getTime() + 65 * 60_000).toISOString(), category: 'meeting', noticeMinutes: 10, spaceId, meetingUrl: 'https://meet.google.com/abc-defg-hij' }] }

describe('контекстные действия уведомления', () => {
  it('показывает в напоминании только завершение и повтор, без общих переходов и демо', async () => {
    task(); await mount()
    expect([...document.querySelectorAll('.island-actions button')].map(item => item.textContent)).toEqual(['Сделано', 'Напомнить через 15 мин'])
    expect(document.querySelector('.island-shortcuts')).toBeNull()
    expect(document.querySelector('.island-examples')).toBeNull()
    expect(document.querySelector('.island-details')?.textContent).not.toContain('Вернуться к делу')
  })
  it('завершает конкретное дело и позволяет его вернуть', async () => {
    task(); await mount(); await click(button('Сделано'))
    expect(stored.reminders[0].done).toBe(true)
    expect(document.querySelector('.island-details')).toBeNull()
    await click(button('Вернуть'))
    expect(stored.reminders[0].done).toBe(false)
    expect(stored.dismissedNotices).toEqual([])
  })
  it('повторное напоминание отсчитывает 15 минут от нажатия', async () => {
    task(); await mount()
    vi.setSystemTime(new Date(now.getTime() + 2 * 60_000))
    await click(button('Напомнить через 15 мин'))
    expect(stored.reminders[0]).toMatchObject({ done: false, plannedDate: '2026-09-30', dueAt: new Date(now.getTime() + 17 * 60_000).toISOString(), notifiedAt: undefined })
  })
  it('не показывает завершение и отмену, если запись не сохранилась', async () => {
    task(); saveSucceeds = false; await mount(); await click(button('Сделано'))
    expect(stored.reminders[0].done).toBe(false)
    expect(document.querySelector('.island-details')).not.toBeNull()
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Не удалось сохранить')
    expect(document.querySelector('.calm-undo')).toBeNull()
  })
  it('не подставляет случайное пространство в материалы встречи', async () => {
    stored.activeSpaceId = stored.spaces[0].id; meeting(); await mount()
    expect(document.querySelector('.island-details')?.textContent).not.toContain('Открыть материалы')
    await click(button('Войти во встречу'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ target: 'https://meet.google.com/abc-defg-hij' }))
  })
  it('открывает только связанное со встречей пространство', async () => {
    meeting(stored.spaces[0].id); await mount(); await click(button('Открыть материалы'))
    expect(onSpace).toHaveBeenCalledWith(stored.spaces[0].id)
  })
  it('показывает таймер и действия с текущей сессией', async () => {
    timer.state = { status: 'running', remainingSeconds: 1250, durationMinutes: 30, progress: .3 }
    await mount()
    expect(document.querySelector('.island-focus-clock')?.textContent).toBe('20:50')
    await click(button('Открыть таймер'))
    expect(onFocus).toHaveBeenCalledOnce()
  })
  it('крестик закрывает карточку без изменения напоминания', async () => {
    task(); await mount(); await click(document.querySelector<HTMLButtonElement>('[aria-label="Свернуть уведомление"]')!)
    expect(stored.reminders[0]).toMatchObject({ done: false, dueAt: now.toISOString() })
    expect(stored.dismissedNotices || []).toEqual([])
    expect(document.querySelector('.island-details')).toBeNull()
  })
})
