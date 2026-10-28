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
  vi.clearAllMocks()
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
        name: 'Первое',
        tone: 'sage',
        resources: [],
        activeSession: { tabs: [{ id: 'tab-1', title: 'Вкладка 1', url: 'https://example1.com/' }], activeTabId: 'tab-1' }
      },
      {
        id: 'space-2',
        name: 'Второе',
        tone: 'blue',
        resources: [],
        activeSession: { tabs: [{ id: 'tab-2', title: 'Вкладка 2', url: 'https://example2.com/' }], activeTabId: 'tab-2' }
      },
      {
        id: 'space-3',
        name: 'Третье',
        tone: 'warm',
        resources: [],
        activeSession: { tabs: [{ id: 'tab-3', title: 'Вкладка 3', url: 'https://example3.com/' }], activeTabId: 'tab-3' }
      }
    ]
  })

  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const spaceId = this.dataset.spaceId
    const spaces = ['space-1', 'space-2', 'space-3']
    const index = spaces.indexOf(spaceId || '')
    if (index >= 0) {
      const left = 20 + index * 120
      return { x: left, y: 10, left, right: left + 100, top: 10, bottom: 42, width: 100, height: 32, toJSON: () => ({}) }
    }
    if (this.classList.contains('chrome-spaces-viewport')) {
      return { x: 0, y: 10, left: 0, right: 800, top: 10, bottom: 42, width: 800, height: 32, toJSON: () => ({}) }
    }
    return { x: 0, y: 0, left: 0, right: 100, top: 0, bottom: 32, width: 100, height: 32, toJSON: () => ({}) }
  })

  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function mount() {
  await act(async () => root.render(<App />))
}

const spaceTabNode = (id: string) => document.querySelector<HTMLElement>(`.chrome-spaces-track [data-space-id="${id}"]`)!
const getTabOrder = () => [...document.querySelectorAll<HTMLElement>('.chrome-spaces-track [data-space-id]')].map(n => n.dataset.spaceId)

async function pointer(type: string, target: HTMLElement | Window, clientX: number, clientY = 20) {
  await act(async () => {
    const event = new MouseEvent(type, { clientX, clientY, button: 0, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'pointerId', { value: 1 })
    target.dispatchEvent(event)
  })
}

async function drag(type: string, target: HTMLElement, clientX: number) {
  await act(async () => {
    const event = new MouseEvent(type, { clientX, clientY: 20, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        setData: vi.fn(),
        getData: () => JSON.stringify({ spaceId: target.dataset.spaceId }),
        effectAllowed: 'move',
        dropEffect: 'move'
      }
    })
    target.dispatchEvent(event)
  })
}

describe('перетаскивание табов пространств в верхней полосе (spaces tab drag & drop)', () => {
  it('отображает плавающее превью и сдвигает соседние табы при перемещении указателя', async () => {
    await mount()

    const tab1 = spaceTabNode('space-1')
    const tab2 = spaceTabNode('space-2')
    expect(tab1).not.toBeNull()
    expect(tab2).not.toBeNull()

    // Start dragging first tab rightwards past the second tab
    await pointer('pointerdown', tab1, 70)
    await pointer('pointermove', window, 200)

    // Preview should exist
    const preview = document.querySelector('.chrome-space-drag-preview')
    expect(preview).not.toBeNull()
    expect(preview?.textContent).toContain('Первое')

    // Track should have is-reordering
    expect(document.querySelector('.chrome-spaces-track')?.classList.contains('is-reordering')).toBe(true)

    // Dragged tab has is-dragging
    expect(tab1.classList.contains('is-dragging')).toBe(true)

    // Neighbor tab2 shifts left
    expect(tab2.style.transform).toBe('translateX(-120px)')

    // Release mouse at target position
    await pointer('pointerup', window, 200)

    // Preview disappears
    expect(document.querySelector('.chrome-space-drag-preview')).toBeNull()

    // State updated with new order
    const stateOrder = current.spaces.filter(s => !s.archivedAt && s.kind !== 'web' && s.kind !== 'day').map(s => s.id)
    expect(stateOrder).toEqual(['space-2', 'space-1', 'space-3'])
  })

  it('клавиша Escape отменяет перетаскивание без сохранения нового порядка', async () => {
    await mount()

    const tab1 = spaceTabNode('space-1')
    await pointer('pointerdown', tab1, 70)
    await pointer('pointermove', window, 200)

    expect(document.querySelector('.chrome-space-drag-preview')).not.toBeNull()

    // Press Escape
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(document.querySelector('.chrome-space-drag-preview')).toBeNull()

    // Pointer up should not commit reordering
    await pointer('pointerup', window, 200)

    const stateOrder = current.spaces.filter(s => !s.archivedAt && s.kind !== 'web' && s.kind !== 'day').map(s => s.id)
    expect(stateOrder).toEqual(['space-1', 'space-2', 'space-3'])
  })

  it('обычный клик без смещения активирует пространство и не запускает drag', async () => {
    await mount()

    const tab2 = spaceTabNode('space-2')
    // Pointer down and up on the same position (distance < 5px)
    await pointer('pointerdown', tab2, 180)
    await pointer('pointerup', tab2, 180)
    await act(async () => {
      tab2.click()
    })

    expect(document.querySelector('.chrome-space-drag-preview')).toBeNull()
    // Current active space should be space-2
    expect(current.activeSpaceId).toBe('space-2')
  })

  it('поддерживает HTML5 drag & drop для табов пространств', async () => {
    await mount()

    const tab1 = spaceTabNode('space-1')
    const tab2 = spaceTabNode('space-2')
    const viewport = document.querySelector('.chrome-spaces-viewport')!

    await drag('dragstart', tab1, 70)
    await drag('dragover', tab2, 200)

    expect(tab2.style.transform).toBe('translateX(-120px)')

    await drag('drop', viewport, 200)

    const stateOrder = current.spaces.filter(s => !s.archivedAt && s.kind !== 'web' && s.kind !== 'day').map(s => s.id)
    expect(stateOrder).toEqual(['space-2', 'space-1', 'space-3'])
  })
})
