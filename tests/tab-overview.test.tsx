// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../src/types'
import { TabOverview } from '../src/browser/TabOverview'
import { NewPage } from '../src/browser/NewPage'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
const state: AppState = { version: 2, reminders: [], dismissedUntil: null, spaces: [
  { id: 'trip', name: 'Поездка', tone: 'sand', resources: [], activeContextId: 'now', workContexts: [
    { id: 'now', title: 'Маршрут', documentIds: [], activeTabId: 'lake' }, { id: 'later', title: 'Отпуск', documentIds: [], activeTabId: 'sea' }
  ], activeSession: { activeTabId: 'lake', tabs: [
    { id: 'lake', title: 'Отель у озера', contextId: 'now', url: 'https://stay.test/lake' },
    { id: 'sea', title: 'Отель у моря', contextId: 'later', url: 'https://stay.test/sea' }
  ] } },
  { id: 'work', name: 'Работа', tone: 'sage', resources: [], activeSession: { activeTabId: 'city', tabs: [{ id: 'city', title: 'Отель в городе', url: 'https://stay.test/city' }] } }
] }
const actions = { onClose: vi.fn(), onSelect: vi.fn(), onCloseTab: vi.fn(), onSplit: vi.fn(), onSave: vi.fn(), onPin: vi.fn(), onMove: vi.fn(), onReorder: vi.fn(), onNew: vi.fn(), onImport: vi.fn() }
beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
  document.body.innerHTML = '<button id="trigger">Вкладки</button><div id="test-root"></div>'
  document.getElementById('trigger')!.focus()
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()) })
async function desk() { await act(async () => root.render(<TabOverview state={state} currentSpaceId="trip" {...actions} />)) }
async function click(element: HTMLElement) { await act(async () => element.click()) }
async function type(text: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>('.tab-desk-search input')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function key(key: string) { await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))) }

describe('Стол и быстрый поиск', () => {
  it('сразу фокусирует поиск, сохраняет запрос при смене области и открывает стрелками и Enter', async () => {
    await desk()
    const input = document.querySelector<HTMLInputElement>('.tab-desk-search input')!
    expect(document.activeElement).toBe(input)
    expect(document.querySelectorAll('.tab-desk-card')).toHaveLength(2)
    await type('отель')
    expect(document.querySelectorAll('.is-result')).toHaveLength(2)
    await click([...document.querySelectorAll<HTMLButtonElement>('.tab-desk-scope button')].find(button => button.textContent === 'Все')!)
    expect(input.value).toBe('отель')
    expect(document.querySelectorAll('.is-result')).toHaveLength(3)
    expect([...document.querySelectorAll('.tab-desk-caption span')].map(element => element.textContent)).toContain('Работа')
    await key('ArrowDown'); await key('Enter')
    expect(actions.onSelect).toHaveBeenCalledWith('trip', 'sea')
    expect(document.activeElement).toBe(input)
  })
  it('доступно управляет меню внутри диалога и закрывает Escape только меню', async () => {
    await desk()
    const trigger = document.querySelector<HTMLButtonElement>('.tab-desk-actions button')!
    await click(trigger)
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem')
    expect(document.activeElement?.textContent).toBe('Открыть рядом')
    await key('ArrowDown')
    expect(document.activeElement?.textContent).toBe('Сохранить в материалы')
    await key('Escape')
    expect(document.querySelector('[role=menu]')).toBeNull()
    expect(actions.onClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
    await key('Escape')
    expect(actions.onClose).toHaveBeenCalledOnce()
  })
  it('закрытие карточки не открывает страницу и передаёт её владельца', async () => {
    await desk()
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Закрыть Отель у моря"]')!)
    expect(actions.onCloseTab).toHaveBeenCalledWith('trip', 'sea')
    expect(actions.onSelect).not.toHaveBeenCalled()
    await act(async () => root.unmount())
    expect(document.activeElement).toBe(document.getElementById('trigger'))
    root = createRoot(document.getElementById('test-root')!)
  })
})

describe('новая страница', () => {
  it('показывает ввод внутри страницы, сразу фокусирует его и открывает адрес', async () => {
    const open = vi.fn()
    await act(async () => root.render(<NewPage space={state.spaces[0]} onOpen={open} onOpenResource={vi.fn()} onAddLink={vi.fn()} />))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(document.querySelector('.new-page-form input'))
    await key('Escape')
    expect(document.querySelector('.new-page-form')).toBeTruthy(); expect(open).not.toHaveBeenCalled()
    await act(async () => {
      const input = document.querySelector<HTMLInputElement>('.new-page-form input')!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'example.test')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(open).toHaveBeenCalledWith('example.test')
  })
})
