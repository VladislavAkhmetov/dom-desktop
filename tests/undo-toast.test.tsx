// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../src/types'
import { upgradeCabinets } from '../src/cabinetModel'
import App from '../src/App'

vi.mock('../src/cabinetMode', () => ({ isCabinetPreview: true }))
const native = vi.hoisted(() => ({ openResource: vi.fn() }))
vi.mock('../src/bridge', () => ({
  isDesktop: false,
  bridge: {
    platform: 'browser',
    openResource: native.openResource,
    getAutostart: async () => false,
    onFocusCapture: () => () => {}
  }
}))
vi.mock('../src/weather', () => ({ cachedUfaWeather: () => null, fetchUfaWeather: async () => null, weatherDescription: () => '' }))
vi.mock('../src/demo', () => ({ isDemo: false }))
vi.mock('../src/news', () => ({ useNews: () => ({ refresh: async () => {}, refreshing: false }) }))

let current: AppState, initial: AppState
vi.mock('../src/statePersistence', () => ({
  usePersistentState: () => {
    const [state, setState] = useState(initial)
    current = state
    return {
      state,
      commit: (updater: (value: AppState) => AppState) => {
        const next = updater(current)
        current = next
        setState(next)
        return Promise.resolve(true)
      }
    }
  }
}))

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.scrollBy = vi.fn()
  Element.prototype.scrollTo = vi.fn()

  initial = upgradeCabinets({
    version: 2,
    dismissedUntil: null,
    reminders: [],
    activeSpaceId: 'space-1',
    spaces: [
      {
        id: 'space-1',
        name: 'Первое пространство',
        tone: 'sage',
        resources: [
          { id: 'res-1', kind: 'link', name: 'Статья для чтения', target: 'https://example.com/article', createdAt: new Date().toISOString() }
        ],
        activeSession: { tabs: [{ id: 'tab-1', title: 'Вкладка 1', url: 'https://example1.com/' }], activeTabId: 'tab-1' }
      },
      {
        id: 'space-2',
        name: 'Второе пространство',
        tone: 'blue',
        resources: [],
        activeSession: { tabs: [{ id: 'tab-2', title: 'Вкладка 2', url: 'https://example2.com/' }], activeTabId: 'tab-2' }
      }
    ]
  })

  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function mount() {
  await act(async () => root.render(<App />))
}

async function click(element: HTMLElement | null) {
  if (!element) throw new Error('Элемент не найден')
  await act(async () => element.click())
}

function button(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => !item.closest('[inert]') && item.textContent?.trim() === text) || null
}

describe('Временные плашки отмены и возврата (calm-undo auto-dismiss)', () => {
  it('плашка отмены автоматически исчезает через 6 секунд', async () => {
    await mount()

    // Go to "Все пространства"
    const allSpacesBtn = [...document.querySelectorAll<HTMLButtonElement>('.chrome-spaces-actions button')].find(b => b.textContent?.includes('Все пространства'))
    await click(allSpacesBtn!)

    // Open three dots menu on first card
    const menuBtn = document.querySelector<HTMLButtonElement>('.overview-space-menu button')
    expect(menuBtn).not.toBeNull()
    await click(menuBtn!)

    // Click "Удалить пространство"
    const deleteBtn = button('Удалить пространство')
    expect(deleteBtn).not.toBeNull()
    await click(deleteBtn!)

    // Confirm deletion in dialog
    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.calm-dialog-actions button')].find(b => b.textContent?.includes('Удалить пространство'))
    expect(confirmBtn).not.toBeNull()
    await click(confirmBtn!)

    // Banner "Пространство удалено" appears with "Вернуть" and close button
    const undoBanner = document.querySelector('.calm-undo')
    expect(undoBanner).not.toBeNull()
    expect(undoBanner?.textContent).toContain('Пространство удалено')
    expect(undoBanner?.textContent).toContain('Вернуть')

    // Fast-forward 4 seconds: still visible
    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    expect(document.querySelector('.calm-undo')).not.toBeNull()

    // Fast-forward another 2.5 seconds (total > 6s): auto-dismissed!
    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    expect(document.querySelector('.calm-undo')).toBeNull()
  })

  it('наведение курсора мыши приостанавливает таймер скрытия, а уход курсора возобновляет таймер', async () => {
    await mount()

    const allSpacesBtn = [...document.querySelectorAll<HTMLButtonElement>('.chrome-spaces-actions button')].find(b => b.textContent?.includes('Все пространства'))
    await click(allSpacesBtn!)

    const menuBtn = document.querySelector<HTMLButtonElement>('.overview-space-menu button')
    await click(menuBtn!)

    const deleteBtn = button('Удалить пространство')
    await click(deleteBtn!)

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.calm-dialog-actions button')].find(b => b.textContent?.includes('Удалить пространство'))
    await click(confirmBtn!)

    const undoBanner = document.querySelector<HTMLElement>('.calm-undo')!
    expect(undoBanner).not.toBeNull()

    // Hover over banner at 3s
    await act(async () => {
      vi.advanceTimersByTime(3000)
      undoBanner.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      undoBanner.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
    })

    // Advance 10 seconds while hovering: banner remains visible
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })
    expect(document.querySelector('.calm-undo')).not.toBeNull()

    // Mouse leaves banner
    await act(async () => {
      undoBanner.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
      undoBanner.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }))
    })

    // Advance grace period (3.5s)
    await act(async () => {
      vi.advanceTimersByTime(3500)
    })
    expect(document.querySelector('.calm-undo')).toBeNull()
  })

  it('клик по кнопке крестик (✕) мгновенно закрывает плашку', async () => {
    await mount()

    const allSpacesBtn = [...document.querySelectorAll<HTMLButtonElement>('.chrome-spaces-actions button')].find(b => b.textContent?.includes('Все пространства'))
    await click(allSpacesBtn!)

    const menuBtn = document.querySelector<HTMLButtonElement>('.overview-space-menu button')
    await click(menuBtn!)

    const deleteBtn = button('Удалить пространство')
    await click(deleteBtn!)

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.calm-dialog-actions button')].find(b => b.textContent?.includes('Удалить пространство'))
    await click(confirmBtn!)

    const closeBtn = document.querySelector<HTMLButtonElement>('.calm-undo button[aria-label="Закрыть"]')
    expect(closeBtn).not.toBeNull()

    await click(closeBtn!)
    expect(document.querySelector('.calm-undo')).toBeNull()
  })

  it('клик по кнопке "Вернуть" восстанавливает удалённый элемент и закрывает плашку', async () => {
    await mount()

    expect(current.spaces.some(s => s.id === 'space-1')).toBe(true)

    const allSpacesBtn = [...document.querySelectorAll<HTMLButtonElement>('.chrome-spaces-actions button')].find(b => b.textContent?.includes('Все пространства'))
    await click(allSpacesBtn!)

    const menuBtn = document.querySelector<HTMLButtonElement>('.overview-space-menu button')
    await click(menuBtn!)

    const deleteBtn = button('Удалить пространство')
    await click(deleteBtn!)

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.calm-dialog-actions button')].find(b => b.textContent?.includes('Удалить пространство'))
    await click(confirmBtn!)

    expect(current.spaces.some(s => s.id === 'space-1')).toBe(false)

    const restoreBtn = button('Вернуть')
    expect(restoreBtn).not.toBeNull()

    await click(restoreBtn!)
    // Restored in state
    expect(current.spaces.some(s => s.id === 'space-1')).toBe(true)
    // Banner dismissed immediately
    expect(document.querySelector('.calm-undo')).toBeNull()
  })
})
