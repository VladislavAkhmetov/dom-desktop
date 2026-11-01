// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../src/types'
import { upgradeCabinets } from '../src/cabinetModel'
import { contextSession } from '../src/workContexts'
import App from '../src/App'

vi.mock('../src/cabinetMode', () => ({ isCabinetPreview: true }))
const native = vi.hoisted(() => ({ open: undefined as undefined | ((url: string) => void), subscriptions: 0 }))
vi.mock('../src/bridge', () => ({ isDesktop: false, bridge: { platform: 'browser', openResource: vi.fn(), getAutostart: async () => false, onFocusCapture: () => () => {},
  onOpenUrl: (callback: (url: string) => void) => { native.open = callback; native.subscriptions++; return () => { native.open = undefined } } } }))
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
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  Element.prototype.scrollIntoView = vi.fn()
  native.open = undefined; native.subscriptions = 0
  initial = upgradeCabinets({ version: 2, dismissedUntil: null, reminders: [], activeSpaceId: 'work', spaces: [{ id: 'work', name: 'Логотип', tone: 'sage', resources: [], activeSession: { tabs: [{ id: 'brief', title: 'Бриф', url: 'https://brief.test/' }], activeTabId: 'brief' } }] })
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })

describe('адрес из другого приложения', () => {
  it('подписывается один раз, когда состояние загружено, и открывает адрес в «Сегодня», не трогая пространства', async () => {
    await act(async () => root.render(<App />))
    expect(native.subscriptions).toBe(1)
    await act(async () => native.open?.('https://example.com/article'))
    const today = current.spaces.find(space => space.kind === 'day' && !space.dayRetired)!
    expect(contextSession(today).tabs.map(tab => tab.url)).toEqual(['https://example.com/article'])
    expect(contextSession(today).tabs[0].title).toBe('example.com')
    expect(contextSession(today).activeTabId).toBe(contextSession(today).tabs[0].id)
    expect(current.spaces.find(space => space.id === 'work')!.activeSession!.tabs.map(tab => tab.id)).toEqual(['brief'])
    expect(document.querySelector('.workstage-container')).toBeTruthy()
  })

  it('открывает тот же адрес повторно в уже открытой вкладке и отбрасывает всё, кроме http и https', async () => {
    await act(async () => root.render(<App />))
    await act(async () => native.open?.('https://example.com/a'))
    await act(async () => native.open?.('https://example.com/a'))
    await act(async () => native.open?.('javascript:alert(1)'))
    await act(async () => native.open?.('file:///C:/secret.txt'))
    const today = current.spaces.find(space => space.kind === 'day' && !space.dayRetired)!
    expect(contextSession(today).tabs.map(tab => tab.url)).toEqual(['https://example.com/a'])
  })
})
