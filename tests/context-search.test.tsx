// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContextSearch } from '../src/ContextSearch'
import { matchActions, searchTabs, withTabs } from '../src/search'
import type { AppState } from '../src/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
const state: AppState = { version: 2, reminders: [], dismissedUntil: null, spaces: [
  { id: 'trip', name: 'Поездка', tone: 'sand', resources: [], activeContextId: 'now', workContexts: [
    { id: 'now', title: 'Маршрут', documentIds: [], activeTabId: 'lake' }, { id: 'later', title: 'Отпуск', documentIds: [], activeTabId: 'sea' }
  ], activeSession: { activeTabId: 'lake', tabs: [
    { id: 'lake', title: 'Отель у озера', contextId: 'now', url: 'https://stay.test/lake' },
    { id: 'sea', title: 'Отель у моря', contextId: 'later', url: 'https://stay.test/sea' }
  ] } }
] }
const actions = [
  { id: 'new-tab', label: 'Новая вкладка', keywords: 'открыть страница', onSelect: vi.fn() },
  { id: 'park', label: 'Сохранить и вернуться', keywords: 'пауза', onSelect: vi.fn() }
]
beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()) })
async function open(onSelect = vi.fn(), onClose = vi.fn()) {
  await act(async () => root.render(<ContextSearch state={state} localOnly actions={actions} onClose={onClose} onSelect={onSelect} />))
  return { onSelect, onClose }
}
async function type(text: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>('.search-field input')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)) })
}
const rows = () => [...document.querySelectorAll<HTMLElement>('.search-results [role="option"]')].map(node => node.querySelector('strong')!.textContent)

describe('Ctrl+K: вкладки и действия', () => {
  it('сопоставляет действия по словам названия и ключевым словам, ничего не показывая для пустого запроса', () => {
    expect(matchActions(actions, '')).toEqual([])
    expect(matchActions(actions, 'нов вкл').map(item => item.id)).toEqual(['new-tab'])
    expect(matchActions(actions, 'ПАУЗА').map(item => item.id)).toEqual(['park'])
    expect(matchActions(actions, 'сохранить вернуться').map(item => item.id)).toEqual(['park'])
    expect(matchActions(actions, 'ничего')).toEqual([])
  })

  it('ищет вкладки всех дел пространства и не повторяет уже найденное', () => {
    expect(searchTabs(state, 'отель').map(item => item.id)).toEqual(['lake', 'sea'])
    expect(searchTabs(state, '')).toEqual([])
    const stored = [{ id: 'sea', spaceId: 'trip', title: 'Отель у моря', target: 'https://stay.test/sea' }]
    expect(withTabs(stored, searchTabs(state, 'отель')).map(item => item.id)).toEqual(['sea', 'lake'])
  })

  it('показывает действие выше результатов и выполняет его после закрытия окна', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    try {
      const { onSelect, onClose } = await open()
      expect(rows()).not.toContain('Новая вкладка')
      vi.useRealTimers()
      await type('нов')
      expect(rows()[0]).toBe('Новая вкладка')
      expect(document.querySelector('.search-results [role="option"]')!.textContent).toContain('Действие')
      vi.useFakeTimers({ toFake: ['setTimeout'] })
      await act(async () => document.querySelector<HTMLElement>('.search-results [role="option"]')!.click())
      expect(onClose).toHaveBeenCalled()
      expect(onSelect).not.toHaveBeenCalled()
      expect(actions[0].onSelect).not.toHaveBeenCalled()
      await act(async () => { vi.advanceTimersByTime(1) })
      expect(actions[0].onSelect).toHaveBeenCalledTimes(1)
    } finally { vi.useRealTimers() }
  })

  it('находит вкладку из другого дела и открывает её как обычный результат', async () => {
    const { onSelect } = await open()
    await type('моря')
    expect(rows()).toEqual(['Отель у моря'])
    expect(document.querySelector('.search-results [role="option"]')!.textContent).toContain('Вкладка')
    await act(async () => document.querySelector<HTMLElement>('.search-results [role="option"]')!.click())
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'sea', spaceId: 'trip' }))
  })
})
