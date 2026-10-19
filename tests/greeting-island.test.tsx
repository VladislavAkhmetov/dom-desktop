// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyState } from '../shared/state'
import { AttentionIsland } from '../src/AttentionIsland'
import type { AppState } from '../src/types'

const timer = vi.hoisted(() => ({
  state: { status: 'idle', remainingSeconds: 1800, durationMinutes: 30, progress: 0 },
  stop: vi.fn(),
  reset: vi.fn()
}))
vi.mock('../src/focus/zenTimer', () => ({
  zenTimer: { getState: () => timer.state, subscribe: () => () => undefined, stop: timer.stop, reset: timer.reset }
}))
vi.mock('../src/player/audioStream', () => ({
  audioManager: { getIsPlaying: () => false, subscribe: () => () => undefined }
}))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root
let stored: AppState
const onSpace = vi.fn(), onOpen = vi.fn(), onFocus = vi.fn(), onDay = vi.fn()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  stored = emptyState()
  timer.state = { status: 'idle', remainingSeconds: 1800, durationMinutes: 30, progress: 0 }
  onSpace.mockReset()
  onOpen.mockReset()
  onFocus.mockReset()
  onDay.mockReset()
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
})

function IslandHarness({ now = new Date(2026, 9, 12, 23, 35) }: { now?: Date }) {
  const [state, setState] = useState(stored)
  return (
    <AttentionIsland
      state={state}
      now={now}
      onOpen={onOpen}
      onSpace={onSpace}
      onFocus={onFocus}
      onDay={onDay}
      onChange={async update => {
        stored = update(stored)
        setState(stored)
        return true
      }}
    />
  )
}

describe('Приветствие в динамическом острове (Ambient Companion)', () => {
  it('показывает ночное приветствие при старте без иконки клода, остров скрыт', async () => {
    stored.userProfile = { name: 'Vlad', avatarTone: 'sage', status: '' }
    const night = new Date(2026, 9, 12, 23, 35)
    await act(async () => root.render(<IslandHarness now={night} />))

    const greetingText = document.querySelector('.ambient-greeting-text')
    expect(greetingText).not.toBeNull()
    expect(greetingText?.textContent).toBe('Засиделись допоздна, Vlad?')
    // Никакой иконки / звездочки
    expect(document.querySelector('.island-greeting-mark')).toBeNull()
    // Плашка острова полностью скрыта до исчезновения приветствия
    const trigger = document.querySelector('.island-trigger')
    expect(trigger?.classList.contains('is-hidden-for-greeting')).toBe(true)
    // Остров не имеет модификатора ширины
    expect(document.querySelector('.universal-island.is-greeting')).toBeNull()
  })

  it('при наведении курсора удерживает приветствие и показывает микро-действие', async () => {
    stored.userProfile = { name: 'Vlad', avatarTone: 'sage', status: '' }
    const night = new Date(2026, 9, 12, 23, 35)
    await act(async () => root.render(<IslandHarness now={night} />))

    const island = document.querySelector<HTMLElement>('.universal-island')!
    await act(async () => {
      island.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })

    // Таймер продвигается, но приветствие не должно исчезнуть
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(document.querySelector('.ambient-greeting-text')?.textContent).toBe('Засиделись допоздна, Vlad?')

    const action = document.querySelector<HTMLElement>('.ambient-greeting-action')
    expect(action).not.toBeNull()
    expect(action?.getAttribute('title')).toBe('Тихий фокус')
    expect(action?.querySelector('svg')).not.toBeNull()

    await act(async () => {
      action?.click()
    })

    expect(onFocus).toHaveBeenCalledOnce()
  })

  it('растворяет приветствие, не показывая плашку до полного растворения, затем проявляет стандартный остров', async () => {
    stored.userProfile = { name: 'Vlad', avatarTone: 'sage', status: '' }
    const night = new Date(2026, 9, 12, 23, 35)
    await act(async () => root.render(<IslandHarness now={night} />))

    expect(document.querySelector('.ambient-greeting')).not.toBeNull()

    // Продвигаем начальный таймер 4.5с
    await act(async () => {
      vi.advanceTimersByTime(4600)
    })

    // В фазе dissolving появляется класс is-dissolving, но плашка острова ВСЁ ЕЩЁ СКРЫТА
    expect(document.querySelector('.ambient-greeting.is-dissolving')).not.toBeNull()
    expect(document.querySelector('.island-trigger')?.classList.contains('is-hidden-for-greeting')).toBe(true)

    // Продвигаем время полного растворения (~1.25с)
    await act(async () => {
      vi.advanceTimersByTime(1300)
    })

    // Приветствие полностью исчезло!
    expect(document.querySelector('.ambient-greeting')).toBeNull()
    // Плашка перешла в manifesting
    expect(document.querySelector('.island-trigger')?.classList.contains('is-manifesting')).toBe(true)

    // Завершаем проявление (ещё 400мс)
    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    // Остров полностью готов и стабилен
    expect(document.querySelector('.island-trigger')?.classList.contains('is-manifesting')).toBe(false)
    expect(document.querySelector('.island-trigger')?.classList.contains('is-hidden-for-greeting')).toBe(false)
    expect(document.querySelector('.island-summary strong')?.textContent).toBe('Уведомления')
  })

  it('клик по тексту приветствия сразу переводит к проявлению стандартного острова', async () => {
    stored.userProfile = { name: 'Vlad', avatarTone: 'sage', status: '' }
    const night = new Date(2026, 9, 12, 23, 35)
    await act(async () => root.render(<IslandHarness now={night} />))

    const greeting = document.querySelector<HTMLElement>('.ambient-greeting')!
    await act(async () => {
      greeting.click()
    })

    expect(document.querySelector('.ambient-greeting')).toBeNull()
    expect(document.querySelector('.island-trigger')?.classList.contains('is-manifesting')).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    const trigger = document.querySelector<HTMLButtonElement>('.island-trigger')!
    await act(async () => {
      trigger.click()
    })

    expect(document.querySelector('.island-details')).not.toBeNull()
  })
})
