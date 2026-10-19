// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../src/types'
import { newCabinet, upgradeCabinets } from '../src/cabinetModel'
import App from '../src/App'

vi.mock('../src/cabinetMode', () => ({ isCabinetPreview: true }))
const native = vi.hoisted(() => ({ openResource: vi.fn() }))
const persistence = vi.hoisted(() => ({ failNext: false }))
vi.mock('../src/bridge', () => ({ isDesktop: false, bridge: {
  platform: 'browser', openResource: native.openResource, getAutostart: async () => false, onFocusCapture: () => () => {}
} }))
vi.mock('../src/weather', () => ({ cachedUfaWeather: () => null, fetchUfaWeather: async () => null, weatherDescription: () => '' }))
vi.mock('../src/demo', () => ({ isDemo: false }))
vi.mock('../src/news', () => ({ useNews: () => ({ refresh: async () => {}, refreshing: false }) }))
let current: AppState, initial: AppState
vi.mock('../src/statePersistence', () => ({ usePersistentState: () => {
  const [state, setState] = useState(initial)
  current = state
  return { state, commit: (updater: (value: AppState) => AppState) => {
    if (persistence.failNext) { persistence.failNext = false; return Promise.resolve(false) }
    const next = updater(current); current = next; setState(next); return Promise.resolve(true)
  } }
} }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  Element.prototype.scrollIntoView = vi.fn()
  native.openResource.mockReset()
  persistence.failNext = false
  initial = upgradeCabinets({ version: 2, dismissedUntil: null, reminders: [], activeSpaceId: 'work', spaces: [{
    id: 'work', name: 'Логотип', tone: 'sage', resources: [{ id: 'file', name: 'Логотип.ai', kind: 'file', target: 'D:\\Design\\Logo.ai', createdAt: '2026-10-07T10:00:00Z', lastOpenedAt: '2026-10-07T10:00:00Z' }],
    activeSession: { tabs: [{ id: 'brief', title: 'Бриф', url: 'https://brief.test/', protected: true, scrollY: 150 }, { id: 'ref', title: 'Референс', url: 'https://ref.test/' }], activeTabId: 'brief' }
  }] })
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
async function mount() { await act(async () => root.render(<App />)) }
async function click(element: HTMLElement | null) { if (!element) throw new Error('Элемент не найден'); await act(async () => element.click()) }
function button(text: string) { return [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => !item.closest('[inert]') && item.textContent?.trim() === text) || null }
function labelled(name: string) { return document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`) }
async function fill(element: HTMLInputElement | HTMLTextAreaElement | null, value: string) {
  if (!element) throw new Error('Поле не найдено')
  await act(async () => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function continueWork() {
  await click(button('Продолжить'))
  await click(button('Открыть вкладки'))
  await click(labelled('Материалы пространства'))
}
function addSecondCabinet() {
  const updated = newCabinet(initial, 'slides', 'slides-tab', 'blue')
  const space = updated.spaces.at(-1)!
  space.name = 'Презентация'; space.nameOrigin = 'manual'; space.pinned = true
  space.activeSession!.tabs[0] = { ...space.activeSession!.tabs[0], title: 'Слайды', url: 'https://slides.test/' }
  initial = { ...updated, activeSpaceId: 'work' }
}

async function contextMenu(element: HTMLElement | null) {
  if (!element) throw new Error('Элемент не найден')
  await act(async () => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 })))
}
async function dragTo(source: HTMLElement | null, destination: HTMLElement | null) {
  if (!source || !destination) throw new Error('Цель переноса не найдена')
  const data = new Map<string, string>(), transfer = { setData: (type: string, value: string) => data.set(type, value), getData: (type: string) => data.get(type) || '', effectAllowed: '', dropEffect: '' }
  async function dispatch(target: HTMLElement, type: string) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 0 })
    Object.defineProperty(event, 'dataTransfer', { value: transfer })
    await act(async () => target.dispatchEvent(event))
  }
  await dispatch(source, 'dragstart'); await dispatch(destination, 'dragover'); await dispatch(destination, 'drop'); await dispatch(source, 'dragend')
}

async function pointerTo(source: HTMLElement | null, destination: HTMLElement | null, cancel = false) {
  if (!source || !destination) throw new Error('Цель переноса не найдена')
  const original = Object.getOwnPropertyDescriptor(document, 'elementFromPoint')
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => destination })
  const pointer = (type: string, x: number) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 100 })
    Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'mouse' } })
    return event
  }
  try {
    await act(async () => source.dispatchEvent(pointer('pointerdown', 0)))
    await act(async () => window.dispatchEvent(pointer('pointermove', 100)))
    const nativeStart = new MouseEvent('dragstart', { bubbles: true, cancelable: true })
    await act(async () => source.dispatchEvent(nativeStart))
    expect(nativeStart.defaultPrevented).toBe(true)
    await act(async () => {
      if (cancel) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      window.dispatchEvent(pointer('pointerup', 100))
      if (!cancel) source.click()
    })
  } finally {
    if (original) Object.defineProperty(document, 'elementFromPoint', original)
    else Reflect.deleteProperty(document, 'elementFromPoint')
  }
}

describe('браузерный пилот кабинетов', () => {
  it('сохраняет в общее одним нажатием, а вторым переносит ту же запись в категорию', async () => {
    initial.spaces.push({ id: 'favorites', kind: 'web', name: 'Веб', tone: 'sage', resources: [], bookmarkGroups: [{ id: 'refs', name: 'Референсы' }] })
    await mount(); await continueWork()
    await click(labelled('В избранное'))
    const id = current.spaces.find(space => space.kind === 'web')!.resources[0].id
    expect(current.spaces.find(space => space.kind === 'web')!.resources[0].bookmarkGroupId).toBeUndefined()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Найти или создать категорию')
    await click(button('Референсы'))
    expect(current.spaces.find(space => space.kind === 'web')!.resources).toEqual([expect.objectContaining({ id, target: 'https://brief.test/', bookmarkGroupId: 'refs' })])
    expect(document.querySelector('.browser-context-menu .menu-trigger')?.textContent).toBe('Логотип')
    expect(current.spaces[0].activeSession!.tabs[0]).toMatchObject({ id: 'brief', protected: true, scrollY: 150 })
    await click(labelled('Изменить избранное')); await click(button('Удалить из избранного'))
    expect(current.spaces.find(space => space.kind === 'web')!.resources).toHaveLength(0)
    await click(button('Вернуть'))
    expect(current.spaces.find(space => space.kind === 'web')!.resources[0]).toMatchObject({ id, bookmarkGroupId: 'refs' })
  })
  it('создаёт категорию внутри панели и сохраняет ошибку записи без ложного успеха', async () => {
    await mount(); await continueWork()
    persistence.failNext = true
    await click(labelled('В избранное'))
    expect(document.querySelector('.browser-destination-popover [role="alert"]')?.textContent).toContain('не сохранилось')
    expect(current.spaces.some(space => space.kind === 'web')).toBe(false)
    expect(document.querySelector('.browser-favorite-page')?.classList.contains('is-saved')).toBe(false)
    await fill(document.querySelector<HTMLInputElement>('[aria-label="Найти или создать категорию"]'), 'Референсы')
    await click(button('Создать «Референсы» и сохранить'))
    const web = current.spaces.find(space => space.kind === 'web')!
    expect(web.bookmarkGroups).toEqual([{ id: expect.any(String), name: 'Референсы' }])
    expect(web.resources[0].bookmarkGroupId).toBe(web.bookmarkGroups![0].id)
    await click(button('Вернуть'))
    expect(current.spaces.find(space => space.kind === 'web')!.resources).toHaveLength(0)
    expect(current.spaces.find(space => space.kind === 'web')!.bookmarkGroups).toHaveLength(0)
  })
  it('переносит в существующее пространство двумя нажатиями, остаётся в исходном и открывает назначение по запросу', async () => {
    addSecondCabinet(); await mount(); await click(button('Логотип')); await click(labelled('Открыть вкладку «Бриф»'))
    await click(labelled('Перенести в другое пространство'))
    await click([...document.querySelectorAll<HTMLButtonElement>('.browser-destination-popover [data-destination-option]')].find(item => item.textContent === 'Презентация') || null)
    expect(current.spaces[0].activeSession!.tabs.map(tab => tab.id)).toEqual(['ref'])
    expect(current.spaces[1].activeSession!.tabs.find(tab => tab.id === 'brief')).toMatchObject({ protected: true, scrollY: 150 })
    expect(document.querySelector('.browser-context-menu .menu-trigger')?.textContent).toBe('Логотип')
    await click(document.querySelector<HTMLButtonElement>('.calm-undo button'))
    expect(document.querySelector('.browser-context-menu .menu-trigger')?.textContent).toBe('Презентация')
    expect(document.querySelector('.horizontal-tab.active')?.getAttribute('data-tab-id')).toBe('brief')
    await click(button('Вернуть'))
    expect(current.spaces[0].activeSession!.tabs[0]).toMatchObject({ id: 'brief', protected: true, scrollY: 150 })
    expect(document.querySelector('.browser-context-menu .menu-trigger')?.textContent).toBe('Логотип')
  })
  it('создаёт новое пространство в меню переноса и отменяет только созданное назначение', async () => {
    await mount(); await continueWork()
    await click(labelled('Перенести в другое пространство'))
    await fill(document.querySelector<HTMLInputElement>('[aria-label="Найти или создать пространство"]'), 'Новый чекаут')
    await click(button('Создать «Новый чекаут» и перенести'))
    expect(current.spaces).toHaveLength(2)
    expect(current.spaces[1]).toMatchObject({ name: 'Новый чекаут', nameOrigin: 'manual' })
    expect(current.spaces[1].activeSession!.tabs).toEqual([expect.objectContaining({ id: 'brief', protected: true, scrollY: 150 })])
    expect(document.querySelector('.browser-context-menu .menu-trigger')?.textContent).toBe('Логотип')
    await click(button('Вернуть'))
    expect(current.spaces).toHaveLength(1)
    expect(current.spaces[0].activeSession!.tabs.map(tab => tab.id)).toEqual(['brief', 'ref'])
  })
  it('сохраняет по Ctrl D и возвращает фокус звезде по Escape', async () => {
    await mount(); await continueWork()
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true })))
    expect(current.spaces.find(space => space.kind === 'web')!.resources[0].target).toBe('https://brief.test/')
    await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(document.activeElement?.classList.contains('browser-favorite-page')).toBe(true)
    expect(document.querySelector('.browser-favorite-page')?.getAttribute('aria-expanded')).toBe('false')
  })
  it('показывает конкретные вкладки и документы в дашборде без дубля сохранённой ссылки', async () => {
    initial.spaces[0].resources.push({ id: 'saved-ref', kind: 'link', name: 'Сохранённый референс', target: 'https://ref.test/', createdAt: '2026-10-07T10:00:00Z' })
    await mount(); await click(button('Логотип'))
    expect(document.querySelectorAll('.cabinet-tab-card')).toHaveLength(2)
    expect(document.querySelectorAll('.cabinet-material-card')).toHaveLength(1)
    expect(document.querySelector('.cabinet-tab-card[data-tab-id="ref"]')?.textContent).toContain('Сохранено')
    expect(document.querySelector('.cabinet-material-card')?.textContent).toContain('Логотип.ai')
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
    await click(labelled('Открыть вкладку «Референс»'))
    expect(document.querySelector('.horizontal-tab.active')?.getAttribute('data-tab-id')).toBe('ref')
    await click(labelled('Вернуться в дашборд'))
    await contextMenu(document.querySelector('.cabinet-tab-card[data-tab-id="ref"]')); await click(button('Закрыть вкладку'))
    expect(document.querySelectorAll('.cabinet-tab-card')).toHaveLength(1)
    expect(document.querySelector('[data-resource-id="saved-ref"]')).toBeTruthy()
    expect(current.spaces[0].resources.some(item => item.id === 'saved-ref')).toBe(true)
  })
  it('раскрывает и ищет среди 300 вкладок без автоматического открытия браузера', async () => {
    initial.spaces[0].activeSession!.tabs = Array.from({ length: 300 }, (_, index) => ({ id: `many-${index}`, contextId: initial.spaces[0].activeContextId, title: `Материал ${index}`, url: `https://ref.test/${index}` }))
    initial.spaces[0].activeSession!.activeTabId = 'many-0'
    await mount(); await click(button('Логотип'))
    expect(document.querySelectorAll('.cabinet-tab-card')).toHaveLength(6)
    await click(button('Показать все · 300'))
    expect(document.querySelectorAll('.cabinet-tab-card')).toHaveLength(300)
    await fill(document.querySelector<HTMLInputElement>('[aria-label="Найти в пространстве"]'), 'Материал 299')
    expect(document.querySelectorAll('.cabinet-tab-card')).toHaveLength(1)
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
    expect(current.spaces[0].activeSession!.tabs).toHaveLength(300)
  })
  it('открывает действия по правой кнопке и сохраняет порядок пространств после переноса', async () => {
    addSecondCabinet()
    await mount(); await contextMenu(document.querySelector('.chrome-space[data-space-id="slides"]'))
    expect(document.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('Действия с пространством «Презентация»')
    await click(button('Открепить из меню'))
    expect(current.spaces[1].pinned).toBe(false)
    await click(button('Все пространства'))
    await contextMenu(document.querySelector('.overview-space[data-space-id="slides"]'))
    await click(button('Закрепить в меню'))
    const before = structuredClone(current.spaces[0].activeSession)
    await dragTo(document.querySelector('.chrome-space[data-space-id="slides"]'), document.querySelector('.chrome-space[data-space-id="work"]'))
    expect(current.spaces.map(space => space.id)).toEqual(['slides', 'work'])
    expect(current.spaces[1].activeSession).toEqual(before)
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
  })
  it('переносит вкладку на пространство и возвращает её без потери защиты', async () => {
    addSecondCabinet(); await mount(); await click(button('Логотип'))
    await dragTo(document.querySelector('.cabinet-tab-card[data-tab-id="brief"] .cabinet-tab-open'), document.querySelector('.chrome-space[data-space-id="slides"]'))
    expect(current.spaces[0].activeSession!.tabs.map(tab => tab.id)).toEqual(['ref'])
    expect(current.spaces[1].activeSession!.tabs.find(tab => tab.id === 'brief')).toMatchObject({ protected: true, scrollY: 150 })
    expect(document.querySelector('.space-detail')?.getAttribute('aria-label')).toBe('Логотип')
    await click(button('Вернуть'))
    expect(current.spaces[0].activeSession!.tabs[0]).toMatchObject({ id: 'brief', protected: true, scrollY: 150 })
  })
  it('добавляет перетаскиваемый документ во второй кабинет и отменяет только добавленную ссылку', async () => {
    addSecondCabinet(); await mount(); await click(button('Логотип'))
    await dragTo(document.querySelector('.cabinet-material-card[data-resource-id="file"] .cabinet-material-open'), document.querySelector('.chrome-space[data-space-id="slides"]'))
    expect(current.spaces[0].resources).toHaveLength(1)
    expect(current.spaces[1].resources[0]).toMatchObject({ kind: 'file', target: 'D:\\Design\\Logo.ai' })
    expect(current.spaces[1].resources[0].id).not.toBe('file')
    expect(native.openResource).not.toHaveBeenCalled()
    await click(button('Вернуть'))
    expect(current.spaces[1].resources).toHaveLength(0)
    expect(current.spaces[0].resources).toHaveLength(1)
  })
  it('переносит вкладку и документ мышью без случайного открытия после отпускания', async () => {
    addSecondCabinet(); await mount(); await click(button('Логотип'))
    await pointerTo(document.querySelector('.cabinet-tab-card[data-tab-id="brief"] .cabinet-tab-open'), document.querySelector('.chrome-space[data-space-id="slides"]'))
    expect(current.spaces[1].activeSession!.tabs.find(tab => tab.id === 'brief')).toMatchObject({ protected: true, scrollY: 150 })
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
    await pointerTo(document.querySelector('.cabinet-material-open'), document.querySelector('.chrome-space[data-space-id="slides"]'))
    expect(current.spaces[1].resources[0].target).toBe('D:\\Design\\Logo.ai')
    expect(current.spaces[0].resources).toHaveLength(1)
    expect(native.openResource).not.toHaveBeenCalled()
  })
  it('отменяет перенос по Escape и меняет порядок карточек вкладок мышью', async () => {
    await mount(); await click(button('Логотип'))
    await pointerTo(document.querySelector('.cabinet-tab-card[data-tab-id="ref"] .cabinet-tab-open'), document.querySelector('.cabinet-tab-card[data-tab-id="brief"]'), true)
    expect(current.spaces[0].activeSession!.tabs.map(tab => tab.id)).toEqual(['brief', 'ref'])
    expect(document.querySelector('.cabinet-drop-hint')).toBeNull()
    await pointerTo(document.querySelector('.cabinet-tab-card[data-tab-id="brief"] .cabinet-tab-open'), document.querySelector('.cabinet-tab-card[data-tab-id="ref"]'))
    expect(current.spaces[0].activeSession!.tabs.map(tab => tab.id)).toEqual(['ref', 'brief'])
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
  })
  it('переставляет пространства мышью и сохраняет выбранный раздел дашборда', async () => {
    addSecondCabinet(); await mount(); await click(button('Логотип'))
    await pointerTo(document.querySelector('.chrome-space[data-space-id="work"]'), document.querySelector('.chrome-space[data-space-id="slides"]'))
    expect(current.spaces.map(space => space.id)).toEqual(['slides', 'work'])
    expect(document.querySelector('.space-detail')?.getAttribute('aria-label')).toBe('Логотип')
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
  })
  it('переключает пространства из меню и списка внутри дашборда, сохраняя его каркас и вкладки', async () => {
    addSecondCabinet()
    const sessions = initial.spaces.map(space => structuredClone(space.activeSession))
    await mount()
    const ambient = document.querySelector('.hub-ambient'), dock = document.querySelector('.hub-bottom')
    expect(ambient).toBeTruthy(); expect(dock).toBeTruthy()
    await click(button('Логотип'))
    expect(document.querySelector('.hub-content .space-detail')?.getAttribute('aria-label')).toBe('Логотип')
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
    await click(button('Презентация'))
    expect(document.querySelector('.hub-content .space-detail')?.getAttribute('aria-label')).toBe('Презентация')
    expect(document.querySelector('.hub-ambient')).toBe(ambient)
    expect(document.querySelector('.hub-bottom')).toBe(dock)
    await click(button('Все пространства'))
    await click(document.querySelector('.overview-space[data-space-id="work"] .overview-space-open'))
    expect(document.querySelector('.hub-content .space-detail')?.getAttribute('aria-label')).toBe('Логотип')
    expect(document.querySelector('.browser-topbar')).toBeNull()
    expect(current.spaces.map(space => space.activeSession)).toEqual(sessions)
  })
  it('создаёт кабинет из дашборда без смены режима и без формы имени', async () => {
    await mount()
    const before = structuredClone(current.spaces[0].activeSession)
    await click(labelled('Создать пространство'))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
    expect(document.querySelector('.hub-content .space-detail')?.getAttribute('aria-label')).toBe('Новое пространство')
    expect(document.querySelector('.hub-ambient')).toBeTruthy()
    expect(document.querySelector('.hub-bottom')).toBeTruthy()
    expect(current.spaces[0].activeSession).toEqual(before)
    expect(current.spaces[1].activeSession!.tabs[0].url).toBe('')
    await click(button('Все пространства')); await click(button('Создать'))
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
    expect(document.querySelector('.hub-content .space-detail')?.getAttribute('aria-label')).toBe('Новое пространство 2')
  })
  it('открывает продолжение в дашборде и меняет режим только по явному открытию браузера', async () => {
    await mount(); await click(button('Продолжить'))
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
    expect(document.querySelector('.space-detail')?.getAttribute('aria-label')).toBe('Логотип')
    expect(native.openResource).not.toHaveBeenCalled()
    await click(button('Открыть вкладки'))
    expect(document.querySelector('.app-shell.browsing')).toBeTruthy()
    expect(document.querySelector('.horizontal-tab.active')?.getAttribute('data-tab-id')).toBe('brief')
    await click(labelled('Вернуться в дашборд'))
    expect(document.querySelector('.space-detail')?.getAttribute('aria-label')).toBe('Логотип')
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
    await click(labelled('Браузер'))
    expect(document.querySelector('.app-shell.browsing')).toBeTruthy()
  })
  it('оставляет переключатель пространств браузера в браузере и возвращается к прежнему разделу дашборда', async () => {
    addSecondCabinet()
    await mount(); await click(button('Логотип')); await click(button('Открыть вкладки'))
    await click(labelled('Выбрать пространство')); await click(button('Презентация'))
    expect(document.querySelector('.app-shell.browsing')).toBeTruthy()
    expect(document.querySelector('.workstage-container')?.getAttribute('aria-label')).toBe('Браузер · Презентация')
    await click(labelled('Вернуться в дашборд'))
    expect(document.querySelector('.space-detail')?.getAttribute('aria-label')).toBe('Логотип')
    expect(current.activeSpaceId).toBe('work')
    expect(current.spaces[1].activeSession!.tabs[0].url).toBe('https://slides.test/')
    await click(button('Все пространства')); await click(labelled('Браузер')); await click(labelled('Вернуться в дашборд'))
    expect(document.querySelector('.spaces-stage')).toBeTruthy()
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
  })
  it('добавляет ссылку на документ в выбранное пространство прямо в дашборде', async () => {
    addSecondCabinet()
    await mount(); await click(button('Презентация')); await click(button('Документ'))
    await fill(document.querySelector<HTMLInputElement>('.calm-form input'), 'D:\\Design\\Deck.pptx')
    await click(button('Сохранить ссылку'))
    expect(document.querySelector('.app-shell.browsing')).toBeNull()
    expect(current.spaces[1].resources[0]).toMatchObject({ name: 'Deck.pptx', target: 'D:\\Design\\Deck.pptx' })
    expect(current.spaces[0].resources).toHaveLength(1)
    expect(native.openResource).not.toHaveBeenCalled()
  })
  it('возвращает вкладки без попытки открыть файлы и создаёт новый кабинет без диалога имени', async () => {
    await mount(); await continueWork()
    expect(document.querySelector('.space-panel')).toBeTruthy()
    expect(document.querySelector('.context-picker')).toBeNull()
    expect(native.openResource).not.toHaveBeenCalled()
    await click(labelled('Новое пространство'))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(document.querySelector('.browser-omnibox-input'))
    expect(current.spaces).toHaveLength(2)
    expect(current.spaces[0].activeSession!.tabs).toHaveLength(2)
    expect(current.spaces[0].checkpoint).toBeTruthy()
    expect(current.spaces[1].activeSession!.tabs).toHaveLength(1)
    expect(current.spaces[1].activeSession!.tabs[0].url).toBe('')
    expect(current.spaces[1].resources).toEqual([])
  })
  it('сохраняет следующий шаг на пространстве и возвращается к нему после переключения', async () => {
    await mount(); await continueWork(); await click(labelled('Настроить продолжение пространства'))
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Продолжение пространства')
    await fill(document.querySelectorAll<HTMLInputElement>('.calm-form input')[1], 'Проверить контраст')
    await fill(document.querySelector<HTMLTextAreaElement>('.calm-form textarea'), 'Согласован вариант 2')
    await click(button('Сохранить'))
    expect(current.spaces[0].checkpoint).toMatchObject({ nextStep: 'Проверить контраст', note: 'Согласован вариант 2' })
    expect(current.spaces[0].workContexts).toHaveLength(1)
    await click(labelled('Новое пространство')); await click(labelled('Выбрать пространство')); await click(button('Логотип'))
    await click(labelled('Материалы пространства'))
    expect(document.querySelector('.space-panel')?.textContent).toContain('Проверить контраст')
    expect(current.spaces[0].activeSession!.tabs[0]).toMatchObject({ id: 'brief', protected: true, scrollY: 150 })
  })
  it('привязывает ссылку на файл только к выбранному кабинету и не открывает редактор', async () => {
    await mount(); await continueWork(); await click(labelled('Новое пространство')); await click(labelled('Материалы пространства'))
    await click(labelled('Добавить материал')); await click(button('Документ'))
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('В браузерном пилоте сохраняется ссылка на файл')
    await fill(document.querySelector<HTMLInputElement>('.calm-form input'), '/Users/designer/Slides.pptx')
    await click(button('Сохранить ссылку'))
    expect(current.spaces[1].resources[0]).toMatchObject({ kind: 'file', name: 'Slides.pptx', target: '/Users/designer/Slides.pptx' })
    expect(current.spaces[0].resources).toHaveLength(1)
    expect(native.openResource).not.toHaveBeenCalled()
  })
  it('переносит выбранную вкладку в новый кабинет и позволяет вернуть её без потери свойств', async () => {
    await mount(); await continueWork(); await click(labelled('Действия с вкладками')); await click(button('Выделить вкладки в новое пространство'))
    await click(button('Создать и перенести'))
    expect(current.spaces[0].activeSession!.tabs.map(tab => tab.id)).toEqual(['ref'])
    expect(current.spaces[1].activeSession!.tabs[0]).toMatchObject({ id: 'brief', protected: true, scrollY: 150 })
    await click(button('Вернуть'))
    expect(current.spaces[0].activeSession!.tabs.map(tab => tab.id).sort()).toEqual(['brief', 'ref'])
    expect(current.spaces[0].activeSession!.tabs.find(tab => tab.id === 'brief')).toMatchObject({ protected: true, scrollY: 150 })
  })
  it('сохраняет отмену завершения из острова при возвращении в дашборд', async () => {
    const now = new Date().toISOString()
    initial.reminders = [{ id: 'send', title: 'Отправить макет', createdAt: now, dueAt: now, kind: 'task', done: false }]
    await mount(); await continueWork()
    await click(document.querySelector('.browser-day-pulse'))
    await click(button('Сделано'))
    expect(current.reminders[0].done).toBe(true)
    await click(labelled('Вернуться в дашборд'))
    expect(document.querySelector('.browser-topbar')).toBeNull()
    await click(button('Вернуть'))
    expect(current.reminders[0].done).toBe(false)
    expect(current.dismissedNotices).toEqual([])
  })
  it('удаляет кабинет с явным описанием и восстанавливает его через отмену', async () => {
    await mount(); await click(button('Все пространства'))
    await click(labelled('Действия с пространством «Логотип»')); await click(button('Удалить пространство'))
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Файлы на диске, страницы и облачные документы сохранятся')
    await click(button('Удалить пространство'))
    expect(current.spaces).toHaveLength(0)
    expect(native.openResource).not.toHaveBeenCalled()
    await click(button('Вернуть'))
    expect(current.spaces[0].resources[0].target).toBe('D:\\Design\\Logo.ai')
    expect(current.spaces[0].activeSession!.tabs).toHaveLength(2)
  })
  it('закрепляет кабинет и возвращает его из архива вместе с рабочими вкладками', async () => {
    await mount(); await continueWork(); await click(labelled('Открепить пространство'))
    expect(current.spaces[0].pinned).toBe(false)
    await click(labelled('Выбрать пространство')); await click(button('В архив'))
    expect(current.spaces[0].archivedAt).toBeTruthy()
    expect(document.querySelectorAll('.overview-space')).toHaveLength(0)
    await click(button('Архив')); await click(button('Вернуть «Логотип»'))
    expect(current.spaces[0].archivedAt).toBeNull()
    expect(current.spaces[0].activeSession!.tabs).toHaveLength(2)
  })
})
