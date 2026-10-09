// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { emptyState } from '../shared/state'
import { selectAttention } from '../src/attentionModel'
import { zenTimer } from '../src/focus/zenTimer'

vi.mock('../src/player/audioStream', () => ({ audioManager: { getIsPlaying: () => false, fadeInAndPlay: vi.fn(), fadeOutAndPause: vi.fn(), pause: vi.fn() } }))
vi.mock('../src/focus/zenSound', () => ({ playZenBowl: vi.fn() }))
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-30T09:00:00Z')) })
afterEach(() => { zenTimer.stop(); vi.useRealTimers() })

it('сохраняет выбранное дело при отсчёте и завершении времени, не отмечая его сделанным', async () => {
  const state = emptyState()
  const task = { id: 'focus-task', title: 'Подготовить макет', createdAt: new Date().toISOString(), dueAt: null, done: false }
  state.reminders.push(task)
  zenTimer.start(1, false, task)
  await vi.advanceTimersByTimeAsync(15_000)
  expect(zenTimer.getState()).toMatchObject({ status: 'running', remainingSeconds: 45, task: { id: task.id, title: task.title } })
  expect(selectAttention(state, new Date(), zenTimer.getState())).toMatchObject({ type: 'focus', targetId: task.id, title: task.title })
  await vi.advanceTimersByTimeAsync(45_000)
  expect(zenTimer.getState()).toMatchObject({ status: 'completed', remainingSeconds: 0, task: { id: task.id } })
  expect(task.done).toBe(false)
})

it('очищает дело после остановки и не переносит его в следующую свободную сессию', async () => {
  zenTimer.start(1, false, { id: 'previous', title: 'Первое дело' })
  zenTimer.stop()
  await vi.advanceTimersByTimeAsync(120_000)
  expect(zenTimer.getState().status).toBe('idle')
  expect(zenTimer.getState().task).toBeUndefined()
  zenTimer.start(15, false)
  expect(zenTimer.getState()).toMatchObject({ status: 'running', remainingSeconds: 900 })
  expect(zenTimer.getState().task).toBeUndefined()
})

it('новая сессия заменяет таймер и выбранное дело предыдущей', async () => {
  zenTimer.start(1, false, { id: 'old', title: 'Первое дело' })
  await vi.advanceTimersByTimeAsync(30_000)
  zenTimer.start(15, false, { id: 'new', title: 'Второе дело' })
  await vi.advanceTimersByTimeAsync(40_000)
  expect(zenTimer.getState()).toMatchObject({ status: 'running', remainingSeconds: 860, task: { id: 'new' } })
})
