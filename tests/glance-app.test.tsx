// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState, NativeBrowserEvent, Resource } from '../src/types'
import { contextSession } from '../src/workContexts'
import App from '../src/App'

const native = vi.hoisted(() => ({ openResource: vi.fn(), show: vi.fn(), hide: vi.fn(), close: vi.fn(), move: vi.fn(), park: vi.fn(), listeners: new Set<(event: NativeBrowserEvent) => void>() }))
// App and every NativePane subscribe to the same event stream.
const emit = (event: NativeBrowserEvent) => [...native.listeners].forEach(listener => listener(event))
vi.mock('../src/cabinetMode', () => ({ isCabinetPreview: false }))
vi.mock('../src/bridge', () => ({ isDesktop: true, bridge: {
  platform: 'win32', openResource: native.openResource, getAutostart: async () => false, onFocusCapture: () => () => {},
  browser: { show: native.show, hide: native.hide, close: native.close, move: native.move, park: native.park, block: async () => {}, onEvent: (listener: (event: NativeBrowserEvent) => void) => { native.listeners.add(listener); return () => { native.listeners.delete(listener) } } }
} }))
vi.mock('../src/weather', () => ({ cachedUfaWeather: () => null, fetchUfaWeather: async () => null, weatherDescription: () => '' }))
vi.mock('../src/demo', () => ({ isDemo: false }))
vi.mock('../src/news', () => ({ useNews: () => ({ refresh: async () => {}, refreshing: false }) }))
let current: AppState
let initial: AppState
vi.mock('../src/statePersistence', () => ({ usePersistentState: () => {
  const [state, setState] = useState(initial)
  current = state
  return { state, commit: (updater: (value: AppState) => AppState) => { setState(previous => updater(previous)); return Promise.resolve(true) } }
} }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
const file: Resource = { id: 'file', name: 'Логотип.ai', kind: 'file', target: 'D:\\Projects\\Логотип.ai', createdAt: '2026-09-30T10:00:00Z' }
const glance = { type: 'glance' as const, id: 'g1', spaceId: 'work', parentTabId: 'brand-tab', url: 'https://example.com/read', title: 'Статья' }
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  Element.prototype.scrollIntoView = vi.fn()
  for (const fn of [native.show, native.hide, native.move]) fn.mockReset().mockResolvedValue(undefined)
  native.close.mockReset().mockResolvedValue(true); native.park.mockReset().mockResolvedValue({ protectedCount: 0 })
  native.openResource.mockReset().mockResolvedValue({ ok: true }); native.listeners.clear()
  initial = { version: 2, dismissedUntil: null, reminders: [], activeSpaceId: 'work', spaces: [{
    id: 'work', name: 'Работа', tone: 'sage', resources: [file], activeContextId: 'brand',
    workContexts: [{ id: 'brand', title: 'Обновить логотип', documentIds: ['file'], activeTabId: 'brand-tab', lastActiveAt: '2026-09-30T10:00:00Z' }],
    activeSession: { tabs: [
      { id: 'brand-tab', contextId: 'brand', title: 'Бриф', url: 'https://brief.test/' },
      { id: 'second', contextId: 'brand', title: 'Вторая', url: 'https://second.test/' }
    ], activeTabId: 'brand-tab' }
  }] }
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
function button(text: string) {
  const element = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)
  if (!element) throw new Error(`Кнопка не найдена: ${text}`)
  return element
}
async function click(element: HTMLElement) { await act(async () => element.click()) }
async function openBrowser() {
  await act(async () => root.render(<App />))
  await click(button('Продолжить'))
  expect(document.querySelector('.workstage-container')).toBeTruthy()
}
const label = () => [...document.querySelectorAll('.split-label')].map(node => node.textContent).join(' / ')
const tabIds = () => contextSession(current.spaces[0], 'brand').tabs.map(tab => tab.id)

describe('Заглянуть и «Отложить на потом» в приложении', () => {
  it('открывает ссылку рядом со страницей, не добавляя вкладку и не записывая её в состояние', async () => {
    await openBrowser()
    await act(async () => emit(glance))
    expect(label()).toContain('Статья')
    expect(tabIds()).toEqual(['brand-tab', 'second'])
    expect(document.querySelectorAll('.horizontal-tab')).toHaveLength(2)
    expect(native.show.mock.calls.some(([value]) => value.tab.id === 'g1' && value.tab.url === glance.url)).toBe(true)
    await act(async () => emit({ type: 'update', tabId: 'g1', spaceId: 'work', updates: { title: 'Новое имя' } }))
    expect(label()).toContain('Новое имя')
    expect(tabIds()).toEqual(['brand-tab', 'second'])
  })

  it('«Оставить вкладкой» ставит ту же страницу после исходной и сообщает главному процессу, что она больше не временная', async () => {
    await openBrowser()
    await act(async () => emit(glance))
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Оставить вкладкой"]')!)
    expect(native.move).toHaveBeenCalledWith('g1', 'work')
    expect(tabIds()).toEqual(['brand-tab', 'g1', 'second'])
    expect(contextSession(current.spaces[0], 'brand').activeTabId).toBe('g1')
    expect(label()).not.toContain('Статья')
    expect(native.close).not.toHaveBeenCalledWith('g1')
  })

  it('закрывается Esc из страницы и при выборе другой вкладки', async () => {
    await openBrowser()
    await act(async () => emit(glance))
    await act(async () => emit({ type: 'glance-close', tabId: 'g1' }))
    expect(native.close).toHaveBeenCalledWith('g1')
    expect(label()).not.toContain('Статья')
    native.close.mockClear()
    await act(async () => emit(glance))
    expect(label()).toContain('Статья')
    await click(document.querySelector<HTMLElement>('[data-tab-id="second"] [role="tab"]')!)
    expect(native.close).toHaveBeenCalledWith('g1')
    expect(label()).not.toContain('Статья')
  })

  it('если страница просит остаться, окно рядом остаётся', async () => {
    await openBrowser()
    await act(async () => emit(glance))
    native.close.mockResolvedValue(false)
    await act(async () => emit({ type: 'glance-close', tabId: 'g1' }))
    expect(label()).toContain('Статья')
  })

  it('«Отложить на потом» сохраняет ссылку в материалы пространства без вкладки и закрывает окно рядом', async () => {
    await openBrowser()
    await act(async () => emit(glance))
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Отложить на потом"]')!)
    expect(current.spaces[0].resources.find(item => item.target === glance.url)).toMatchObject({ kind: 'link', name: 'Статья' })
    expect(tabIds()).toEqual(['brand-tab', 'second'])
    expect(native.close).toHaveBeenCalledWith('g1')
    expect(label()).not.toContain('Статья')
  })

  it('«Отложить» из меню страницы работает без окна рядом и не дублирует ссылку', async () => {
    await openBrowser()
    await act(async () => emit({ type: 'save-later', spaceId: 'work', url: 'https://example.com/a', title: '' }))
    await act(async () => emit({ type: 'save-later', spaceId: 'work', url: 'https://example.com/a', title: '' }))
    const saved = current.spaces[0].resources.filter(item => item.target === 'https://example.com/a')
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('example.com')
    expect(document.body.textContent).toContain('уже отложена')
  })

  it('ссылка, открытая из окна рядом, становится вкладкой исходной страницы', async () => {
    await openBrowser()
    await act(async () => emit(glance))
    await act(async () => emit({ type: 'new-tab', spaceId: 'work', parentTabId: 'g1', url: 'https://example.com/next', background: true }))
    const added = contextSession(current.spaces[0], 'brand').tabs.find(tab => tab.url === 'https://example.com/next')
    expect(added).toMatchObject({ parentTabId: 'brand-tab', contextId: 'brand' })
  })

  it('следующая ссылка из окна рядом заменяет его, оставаясь привязанной к исходной странице', async () => {
    await openBrowser()
    await act(async () => emit(glance))
    await act(async () => emit({ ...glance, id: 'g2', parentTabId: 'g1', url: 'https://example.com/second', title: 'Вторая статья' }))
    expect(native.close).toHaveBeenCalledWith('g1')
    expect(label()).toContain('Вторая статья')
    expect(label()).not.toContain(' Статья')
    expect(tabIds()).toEqual(['brand-tab', 'second'])
  })

  it('игнорирует окно рядом для страницы, которой нет на экране', async () => {
    await openBrowser()
    await act(async () => emit({ ...glance, parentTabId: 'not-visible' }))
    expect(label()).not.toContain('Статья')
  })
})
