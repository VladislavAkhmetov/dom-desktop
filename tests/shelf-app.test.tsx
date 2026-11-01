// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../src/types'
import { upgradeCabinets } from '../src/cabinetModel'
import { contextSession } from '../src/workContexts'
import App from '../src/App'
import { openSpaceFromSwitcher } from './helpers/spaceSwitcher'

vi.mock('../src/cabinetMode', () => ({ isCabinetPreview: true }))
vi.mock('../src/bridge', () => ({ isDesktop: false, bridge: { platform: 'browser', openResource: vi.fn(), getAutostart: async () => false, onFocusCapture: () => () => {} } }))
vi.mock('../src/weather', () => ({ cachedUfaWeather: () => null, fetchUfaWeather: async () => null, weatherDescription: () => '' }))
vi.mock('../src/demo', () => ({ isDemo: false }))
vi.mock('../src/news', () => ({ useNews: () => ({ refresh: async () => {}, refreshing: false }) }))
let current: AppState, initial: AppState
vi.mock('../src/statePersistence', () => ({ usePersistentState: () => {
  const [state, setState] = useState(initial)
  current = state
  return { state, commit: (updater: (value: AppState) => AppState) => { const next = updater(current); current = next; setState(next); return Promise.resolve(true) } }
} }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
const space = () => current.spaces.find(item => item.id === 'work')!
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  Element.prototype.scrollIntoView = vi.fn()
  initial = upgradeCabinets({ version: 2, dismissedUntil: null, reminders: [], activeSpaceId: 'work', spaces: [{
    id: 'work', name: 'Логотип', tone: 'sage', resources: [],
    activeSession: { tabs: [
      { id: 'brief', title: 'Бриф', url: 'https://brief.test/', lastActiveAt: daysAgo(1) },
      { id: 'old', title: 'Старый референс', url: 'https://old.test/', lastActiveAt: daysAgo(40) },
      { id: 'pinned', title: 'Закреплённая', url: 'https://pinned.test/', pinned: true, lastActiveAt: daysAgo(40) },
      { id: 'recent', title: 'Недавняя', url: 'https://recent.test/', lastActiveAt: daysAgo(3) }
    ], activeTabId: 'brief' }
  }] })
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
async function click(element: HTMLElement | null) { if (!element) throw new Error('Элемент не найден'); await act(async () => element.click()) }

describe('тихая уборка в приложении', () => {
  it('на главной убирает давнюю вкладку на полку пространства, не трогая закреплённую и свежие', async () => {
    await act(async () => root.render(<App />))
    expect(space().shelf?.map(tab => tab.id)).toEqual(['old'])
    expect(space().activeSession!.tabs.map(tab => tab.id)).toEqual(['brief', 'pinned', 'recent'])
  })

  it('не трогает пространство на экране и при «Никогда»', async () => {
    initial = { ...initial, shelveAfterDays: 0 }
    await act(async () => root.render(<App />))
    expect(space().shelf).toBeUndefined()
    expect(space().activeSession!.tabs).toHaveLength(4)
  })

  it('на странице пространства «Отложено» возвращает вкладку в работу одним нажатием', async () => {
    await act(async () => root.render(<App />))
    await openSpaceFromSwitcher('Логотип')
    const section = document.querySelector<HTMLElement>('.cabinet-shelf')!
    expect(section.textContent).toContain('Старый референс')
    await click(section.querySelector<HTMLElement>('.cabinet-tab-open'))
    expect(space().shelf).toEqual([])
    expect(contextSession(space()).tabs.map(tab => tab.id)).toContain('old')
    expect(contextSession(space()).activeTabId).toBe('old')
    expect(document.querySelector('.cabinet-shelf')).toBeNull()
  })
})
