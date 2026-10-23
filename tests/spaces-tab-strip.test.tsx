// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../src/types'
import { newCabinet, upgradeCabinets } from '../src/cabinetModel'
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
        resources: [],
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
  vi.unstubAllGlobals()
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

function labelled(name: string) {
  return document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)
}

describe('полоса вкладок рабочих пространств (Chrome-like Tab Strip)', () => {
  it('отображает все открытые пространства в строке без исчезновения прежних', async () => {
    await mount()

    const homeBtn = document.querySelector('.chrome-spaces-home .chrome-space')
    expect(homeBtn?.textContent?.trim()).toBe('Мой день')

    const spaceButtons = Array.from(document.querySelectorAll('.chrome-spaces-track .chrome-space'))
    const names = spaceButtons.map(b => b.textContent?.trim())

    expect(names).toContain('Первое пространство')
    expect(names).toContain('Второе пространство')
  })

  it('при создании новых пространств добавляет их правее, сохраняя все предыдущие', async () => {
    await mount()

    // Create 3rd space via "+" button
    const plusButton = labelled('Создать пространство')
    expect(plusButton).not.toBeNull()
    await click(plusButton)

    let spaceButtons = Array.from(document.querySelectorAll('.chrome-spaces-track .chrome-space'))
    let names = spaceButtons.map(b => b.textContent?.trim())
    expect(names).toContain('Первое пространство')
    expect(names).toContain('Второе пространство')
    expect(names.some(name => name?.includes('Новое пространство'))).toBe(true)

    // Create 4th space
    await click(plusButton)

    spaceButtons = Array.from(document.querySelectorAll('.chrome-spaces-track .chrome-space'))
    names = spaceButtons.map(b => b.textContent?.trim())
    expect(names).toContain('Первое пространство')
    expect(names).toContain('Второе пространство')
    expect(names.filter(name => name?.includes('Новое пространство')).length).toBe(2)
  })

  it('структура chrome-spaces содержит viewport, трек с вкладками и блок действий Все пространства / Создать / Поиск', async () => {
    await mount()

    const nav = document.querySelector('nav.chrome-spaces')
    expect(nav).not.toBeNull()

    const viewport = nav?.querySelector('.chrome-spaces-viewport')
    expect(viewport).not.toBeNull()

    const track = viewport?.querySelector('.chrome-spaces-track')
    expect(track).not.toBeNull()

    const actions = nav?.querySelector('.chrome-spaces-actions')
    expect(actions).not.toBeNull()

    const allSpacesBtn = actions?.querySelector('.chrome-space')
    expect(allSpacesBtn?.textContent?.trim()).toBe('Все пространства')

    const newSpaceBtn = actions?.querySelector('.chrome-new-space')
    expect(newSpaceBtn).not.toBeNull()

    const searchBtn = actions?.querySelector('.chrome-space-search')
    expect(searchBtn).not.toBeNull()
  })

  it('при клике по стрелкам влево/вправо прокручивает viewport', async () => {
    await mount()

    const viewport = document.querySelector<HTMLDivElement>('.chrome-spaces-viewport')!
    // Simulate scroll overflow
    Object.defineProperty(viewport, 'scrollWidth', { configurable: true, value: 1200 })
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 400 })
    Object.defineProperty(viewport, 'scrollLeft', { configurable: true, writable: true, value: 50 })

    // Trigger scroll/resize observer update
    await act(async () => {
      viewport.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('resize'))
    })

    const leftArrow = document.querySelector<HTMLButtonElement>('.chrome-scroll-left')
    const rightArrow = document.querySelector<HTMLButtonElement>('.chrome-scroll-right')

    expect(leftArrow).not.toBeNull()
    expect(rightArrow).not.toBeNull()

    const scrollBySpy = vi.spyOn(viewport, 'scrollBy')

    await act(async () => {
      leftArrow?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      leftArrow?.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })
    expect(scrollBySpy).toHaveBeenCalledWith(expect.objectContaining({ left: -200 }))

    await act(async () => {
      rightArrow?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      rightArrow?.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })
    expect(scrollBySpy).toHaveBeenCalledWith(expect.objectContaining({ left: 200 }))
  })

  it('не ограничивает количество вкладок до 4 и сохраняет все пространства при большом их числе (например 6+ пространств)', async () => {
    await mount()
    const plusButton = labelled('Создать пространство')
    expect(plusButton).not.toBeNull()
    for (let i = 0; i < 4; i++) {
      await click(plusButton)
    }
    const homeBtn = document.querySelector('.chrome-spaces-home .chrome-space')
    expect(homeBtn?.textContent?.trim()).toBe('Мой день')

    const spaceButtons = Array.from(document.querySelectorAll('.chrome-spaces-track .chrome-space'))
    const names = spaceButtons.map(b => b.textContent?.trim())
    expect(names).toContain('Первое пространство')
    expect(names).toContain('Второе пространство')
    // 2 initial spaces + 4 newly created = 6 spaces in track (plus 'Мой день' pinned on left)
    expect(spaceButtons.length).toBe(6)
  })

  it('содержит градиентные полупрозрачные зоны по краям скролла и защищенный блок действий', async () => {
    await mount()
    const container = document.querySelector('.chrome-spaces-scroll-container')
    expect(container).not.toBeNull()
    const leftFade = container?.querySelector('.chrome-spaces-fade-left')
    const rightFade = container?.querySelector('.chrome-spaces-fade-right')
    expect(leftFade).not.toBeNull()
    expect(rightFade).not.toBeNull()
    expect(leftFade?.querySelector('.chrome-scroll-left')).not.toBeNull()
    expect(rightFade?.querySelector('.chrome-scroll-right')).not.toBeNull()
    const actions = document.querySelector('.chrome-spaces-actions')
    expect(actions).not.toBeNull()
    expect(container?.contains(actions!)).toBe(false)
  })

  it('когда вкладки помещаются без скролла (hasOverflow: false), стрелки скрыты и не имеют класса is-visible, маски не применяются', async () => {
    await mount()
    const viewport = document.querySelector<HTMLDivElement>('.chrome-spaces-viewport')!
    Object.defineProperty(viewport, 'scrollWidth', { configurable: true, value: 300 })
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 800 })
    Object.defineProperty(viewport, 'scrollLeft', { configurable: true, writable: true, value: 0 })

    await act(async () => {
      viewport.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('resize'))
    })

    const leftFade = document.querySelector('.chrome-spaces-fade-left')
    const rightFade = document.querySelector('.chrome-spaces-fade-right')

    expect(leftFade?.classList.contains('is-visible')).toBe(false)
    expect(rightFade?.classList.contains('is-visible')).toBe(false)
    expect(viewport.classList.contains('has-before')).toBe(false)
    expect(viewport.classList.contains('has-after')).toBe(false)

    const leftBtn = leftFade?.querySelector<HTMLButtonElement>('.chrome-scroll-left')
    const rightBtn = rightFade?.querySelector<HTMLButtonElement>('.chrome-scroll-right')
    expect(leftBtn?.disabled).toBe(true)
    expect(rightBtn?.disabled).toBe(true)
  })
})
