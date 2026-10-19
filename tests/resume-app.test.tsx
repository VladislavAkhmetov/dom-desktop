// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState, NativeBrowserEvent, OpenResult, Resource } from '../src/types'
import { contextSession } from '../src/workContexts'
import App from '../src/App'

const native = vi.hoisted(() => ({ openResource: vi.fn(), pickResource: vi.fn(), show: vi.fn(), hide: vi.fn(), close: vi.fn(), park: vi.fn(), listener: undefined as undefined | ((event: NativeBrowserEvent) => void) }))
vi.mock('../src/bridge', () => ({ isDesktop: true, bridge: {
  platform: 'win32', openResource: native.openResource, pickResource: native.pickResource,
  getAutostart: async () => false, onFocusCapture: () => () => {},
  browser: { show: native.show, hide: native.hide, close: native.close, park: native.park, block: async () => {}, onEvent: (listener: (event: NativeBrowserEvent) => void) => { native.listener = listener; return () => {} } }
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
const missing: Resource = { ...file, id: 'missing', name: 'Паттерны.ai', target: 'D:\\Projects\\Паттерны.ai' }
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  Element.prototype.scrollIntoView = vi.fn()
  native.show.mockResolvedValue(undefined); native.hide.mockResolvedValue(undefined); native.close.mockResolvedValue(true); native.park.mockResolvedValue({ protectedCount: 0 })
  native.openResource.mockReset(); native.pickResource.mockReset(); native.close.mockClear(); native.park.mockClear(); native.listener = undefined
  initial = { version: 2, dismissedUntil: null, reminders: [], activeSpaceId: 'work', spaces: [{
    id: 'work', name: 'Работа', tone: 'sage', resources: [file, missing, { ...file, id: 'later', name: 'На потом.ai', target: 'D:\\Projects\\На потом.ai' }],
    activeContextId: 'other', workContexts: [
      { id: 'brand', title: 'Обновить логотип', documentIds: ['file', 'missing'], activeTabId: 'brand-tab', lastActiveAt: '2026-09-30T10:00:00Z' },
      { id: 'other', title: 'Другой проект', documentIds: [], activeTabId: 'other-tab', lastActiveAt: '2026-09-29T10:00:00Z' }
    ], activeSession: { tabs: [
      { id: 'brand-tab', contextId: 'brand', title: 'Бриф', url: 'https://brief.test/', protected: true, scrollY: 140 },
      { id: 'other-tab', contextId: 'other', title: 'Другой бриф', url: 'https://brief.test/', protected: true }
    ], activeTabId: 'other-tab' }
  }] }
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
async function mount() { await act(async () => root.render(<App />)) }
function button(text: string) {
  const element = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)
  if (!element) throw new Error(`Кнопка не найдена: ${text}`)
  return element
}
async function click(element: HTMLElement) { await act(async () => element.click()) }

describe('карточка продолжения в приложении', () => {
  it('одно нажатие открывает только документы дела и его вкладки, сохраняя другие открытые вкладки', async () => {
    native.openResource.mockResolvedValue({ ok: true })
    await mount()
    expect(document.querySelector('.resume-card')?.textContent).toContain('Обновить логотип')
    expect(document.querySelector('.resume-card')?.textContent).not.toContain('Другие дела')
    await click(button('Продолжить'))
    expect(native.openResource.mock.calls.map(args => args[0].id)).toEqual(['file', 'missing'])
    expect(contextSession(current.spaces[0]).tabs[0]).toMatchObject({ id: 'brand-tab', url: 'https://brief.test/', protected: true, scrollY: 140 })
    expect(current.spaces[0].activeSession?.tabs.map(tab => tab.id).sort()).toEqual(['brand-tab', 'other-tab'])
    expect(native.close).not.toHaveBeenCalled(); expect(native.park).not.toHaveBeenCalled()
    expect(document.querySelector('.workstage-container')?.textContent).toContain('Обновить логотип')
  })
  it('блокирует повторный запуск во время открытия, после частичной ошибки повторяет только неоткрытый документ', async () => {
    let resolveFirst!: (value: OpenResult) => void
    native.openResource.mockImplementationOnce(() => new Promise<OpenResult>(resolve => { resolveFirst = resolve }))
      .mockResolvedValueOnce({ ok: false, error: 'Файл перемещён' }).mockResolvedValueOnce({ ok: true })
    await mount()
    const continueButton = button('Продолжить')
    await act(async () => { continueButton.click(); continueButton.click() })
    expect(native.openResource).toHaveBeenCalledTimes(1)
    expect(continueButton.disabled).toBe(true)
    await act(async () => resolveFirst({ ok: true }))
    expect(current.spaces[0].activeContextId).toBe('brand')
    await click(button('Повторить неоткрытые'))
    expect(native.openResource.mock.calls.map(args => args[0].id)).toEqual(['file', 'missing', 'missing'])
    expect(current.spaces[0].activeSession?.tabs).toHaveLength(2)
  })
  it('завершение убирает предложение, оставляет вкладки и документы и допускает отмену', async () => {
    await mount()
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Действия с продолжением"]')!)
    await click(button('Дело завершено'))
    expect(current.spaces[0].workContexts![0].completedAt).toBeTruthy()
    expect(current.spaces[0].activeSession?.tabs).toHaveLength(2)
    expect(current.spaces[0].resources).toHaveLength(3)
    expect(native.close).not.toHaveBeenCalled()
    await click(button('Вернуть'))
    expect(current.spaces[0].workContexts![0].completedAt).toBeUndefined()
  })
  it('сохраняет новый документ в выбранное пространство, но не включает его в продолжение до открытия или выбора', async () => {
    native.pickResource.mockResolvedValue('D:\\Projects\\Бриф.pdf')
    await mount()
    await click(document.querySelector<HTMLButtonElement>('.chrome-space[title="Продолжить: Работа"]')!)
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Добавить в пространство"]')!)
    await click(button('Документ'))
    const added = current.spaces[0].resources.find(item => item.name === 'Бриф.pdf')!
    expect(added).toBeTruthy()
    expect(current.spaces[0].workContexts!.every(context => !context.documentIds.includes(added.id))).toBe(true)
    expect(native.openResource).not.toHaveBeenCalled()
  })
  it('успешное открытие из материалов относится к явно выбранному делу; ошибка не добавляет документ', async () => {
    native.openResource.mockResolvedValueOnce({ ok: false, error: 'Файл не найден' }).mockResolvedValueOnce({ ok: true })
    await mount()
    await click(document.querySelector<HTMLButtonElement>('.chrome-space[title="Продолжить: Работа"]')!)
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Следующая страница"]')!)
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Следующая страница"]')!)
    const resource = [...document.querySelectorAll<HTMLButtonElement>('.resource-open')].find(item => item.textContent?.includes('На потом.ai'))!
    await click(resource)
    expect(current.spaces[0].workContexts!.find(item => item.id === 'other')!.documentIds).toEqual([])
    await click(button('Обновить логотип'))
    await click(resource)
    expect(current.spaces[0].workContexts!.find(item => item.id === 'brand')!.documentIds).toEqual(['file', 'missing', 'later'])
    expect(current.spaces[0].workContexts!.find(item => item.id === 'other')!.documentIds).toEqual([])
  })
  it('фоновая новая вкладка наследует дело родителя и не меняет выбранное дело', async () => {
    await mount()
    await act(async () => native.listener?.({ type: 'new-tab', spaceId: 'work', parentTabId: 'brand-tab', url: 'https://reference.test/', background: true }))
    expect(current.spaces[0].activeContextId).toBe('other')
    expect(contextSession(current.spaces[0], 'brand').tabs).toHaveLength(2)
    expect(contextSession(current.spaces[0], 'brand').tabs[1]).toMatchObject({ contextId: 'brand', parentTabId: 'brand-tab', url: 'https://reference.test/' })
    expect(current.spaces[0].workContexts!.find(item => item.id === 'brand')!.lastActiveAt).toBe('2026-09-30T10:00:00Z')
  })
})

describe('переход между дашбордом и браузером', () => {
  it('отделяет браузер от пространств, возвращает в выбранное пространство и возобновляет обычный серфинг', async () => {
    await mount()
    expect([...document.querySelectorAll('.chrome-space')].map(item => item.textContent)).not.toContain('Веб')
    await click(button('Работа'))
    await click(document.querySelector<HTMLButtonElement>('.chrome-browser')!)
    expect(document.querySelector('.app-shell.browsing')).toBeTruthy()
    expect(document.querySelector('.browser-space-chip')).toBeNull()
    expect(document.querySelector('.browser-start-card h2')?.textContent).toBe('Новая вкладка')
    await act(async () => {
      const input = document.querySelector<HTMLInputElement>('.browser-omnibox input')!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'reading.test')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => document.querySelector('.browser-omnibox')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    const web = current.spaces.find(space => space.kind === 'web')!
    const tab = web.activeSession!.tabs[0]
    expect(tab.url).toBe('https://reading.test/')
    await click(document.querySelector<HTMLButtonElement>('.brand')!)
    expect(document.querySelector('.chrome-space.selected')?.textContent).toBe('Работа')
    expect(current.activeSpaceId).toBe('work')
    await click(document.querySelector<HTMLButtonElement>('.chrome-browser')!)
    expect(document.querySelector('.horizontal-tab.active')?.getAttribute('data-tab-id')).toBe(tab.id)
    expect(current.spaces.find(space => space.kind === 'web')!.activeSession!.tabs).toHaveLength(1)
    expect(current.spaces.find(space => space.id === 'work')!.activeSession?.tabs).toHaveLength(2)
  })

  it('показывает владельца вкладки проекта и возвращает по нему в пространство', async () => {
    await mount()
    await click(document.querySelector<HTMLButtonElement>('.chrome-tab-desk')!)
    await click(document.querySelector<HTMLButtonElement>('.tab-desk-open[aria-label="Другой бриф · Работа · Другой проект"]')!)
    expect(document.querySelector('.app-shell.browsing')).toBeTruthy()
    const owner = document.querySelector<HTMLButtonElement>('.browser-context-menu .menu-trigger')!
    expect(owner.textContent).toBe('Работа')
    await click(owner)
    await click(button('Материалы пространства'))
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
    expect(document.querySelector('.chrome-space.selected')?.textContent).toBe('Работа')
    expect(current.spaces[0].activeContextId).toBe('other')
  })
})

async function typeAddress(selector: string, value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>(selector)!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('новая вкладка без попапа', () => {
  it('плюс сразу создаёт вкладку; адрес и поиск открываются в ней без дубликатов', async () => {
    await mount()
    await click(document.querySelector<HTMLButtonElement>('.chrome-browser')!)
    await click(document.querySelector<HTMLButtonElement>('.strip-new-tab')!)
    const web = () => current.spaces.find(space => space.kind === 'web')!
    const blank = contextSession(web()).tabs.at(-1)!
    expect(blank.url).toBe('')
    expect(document.querySelector('.horizontal-tab.active')?.getAttribute('data-tab-id')).toBe(blank.id)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.querySelector('.browser-topbar input')).toBeTruthy()
    expect(document.activeElement).toBe(document.querySelector('.browser-omnibox input'))
    await typeAddress('.browser-omnibox input', 'reading.test')
    await click(document.querySelector<HTMLButtonElement>('.browser-omnibox [type="submit"]')!)
    expect(contextSession(web()).tabs).toHaveLength(2)
    expect(contextSession(web()).tabs.at(-1)).toMatchObject({ id: blank.id, url: 'https://reading.test/' })
    await act(async () => native.listener?.({ type: 'shortcut', key: 't', shift: false, alt: false }))
    const searchTab = contextSession(web()).tabs.at(-1)!
    await typeAddress('.browser-omnibox input', 'дизайн вкладок')
    await click(document.querySelector<HTMLButtonElement>('.browser-omnibox [type="submit"]')!)
    expect(contextSession(web()).tabs).toHaveLength(3)
    expect(contextSession(web()).tabs.at(-1)).toMatchObject({ id: searchTab.id, title: 'Поиск: дизайн вкладок', url: `https://www.google.com/search?q=${encodeURIComponent('дизайн вкладок')}` })
  })

  it('Ctrl L из сайта выбирает текущий адрес, Escape отменяет ввод, Enter меняет эту же вкладку', async () => {
    await mount()
    await click(document.querySelector<HTMLButtonElement>('.chrome-tab-desk')!)
    await click(document.querySelector<HTMLButtonElement>('.tab-desk-open[aria-label="Другой бриф · Работа · Другой проект"]')!)
    expect(document.querySelector('.browser-topbar input')).toBeTruthy()
    await act(async () => native.listener?.({ type: 'shortcut', key: 'l', shift: false, alt: false }))
    const input = document.querySelector<HTMLInputElement>('.browser-omnibox input')!
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('https://brief.test/')
    expect(input.selectionEnd! - input.selectionStart!).toBe(input.value.length)
    await typeAddress('.browser-omnibox input', 'cancelled.test')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(input.value).toBe('https://brief.test/')
    expect(contextSession(current.spaces[0]).tabs[0].url).toBe('https://brief.test/')
    await act(async () => input.focus())
    await typeAddress('.browser-omnibox input', 'changed.test')
    await act(async () => document.querySelector('.browser-omnibox')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(contextSession(current.spaces[0]).tabs[0]).toMatchObject({ id: 'other-tab', url: 'https://changed.test/' })
    expect(current.spaces[0].activeSession?.tabs).toHaveLength(2)
    expect(input.value).toBe('https://changed.test/')
  })

  it('создание из Стола сохраняет владельца и дело и переводит фокус в новую вкладку', async () => {
    await mount()
    await click(document.querySelector<HTMLButtonElement>('.chrome-tab-desk')!)
    await click(document.querySelector<HTMLButtonElement>('.tab-desk-scope button')!)
    await click(document.querySelector<HTMLButtonElement>('.tab-desk-new')!)
    const session = contextSession(current.spaces[0])
    expect(current.spaces[0].activeContextId).toBe('other')
    expect(session.tabs).toHaveLength(2)
    expect(session.tabs.at(-1)).toMatchObject({ contextId: 'other', url: '' })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(document.querySelector('.browser-omnibox input'))
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true })))
    expect(contextSession(current.spaces[0]).activeTabId).toBe('other-tab')
    expect(current.spaces[0].activeSession?.tabs).toHaveLength(2)
  })

  it('после закрытия последней вкладки позволяет вводить адрес на стартовой странице', async () => {
    await mount()
    await click(document.querySelector<HTMLButtonElement>('.chrome-browser')!)
    await click(document.querySelector<HTMLButtonElement>('.horizontal-tab-close')!)
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(0)
    expect(document.activeElement).toBe(document.querySelector('.browser-omnibox input'))
    await typeAddress('.browser-omnibox input', 'localhost:8080/docs')
    await click(document.querySelector<HTMLButtonElement>('.browser-omnibox [type="submit"]')!)
    const tabs = contextSession(current.spaces.find(space => space.kind === 'web')!).tabs
    expect(tabs).toHaveLength(1)
    expect(tabs[0].url).toBe('http://localhost:8080/docs')
  })
})
