// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { emptyState } from '../shared/state'
import { AttentionIsland } from '../src/AttentionIsland'
import { BrowserChrome, type BrowserChromeProps } from '../src/browser/BrowserChrome'
import type { AppState } from '../src/types'

vi.mock('../src/cabinetMode', () => ({ isCabinetPreview: true }))
vi.mock('../src/focus/zenTimer', () => ({ zenTimer: { getState: () => ({ status: 'idle', remainingSeconds: 1800, durationMinutes: 30 }), subscribe: () => () => {} } }))
vi.mock('../src/player/audioStream', () => ({ audioManager: { getIsPlaying: () => false, subscribe: () => () => {}, togglePlay: vi.fn() } }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root, state: AppState
const now = new Date('2026-10-10T10:00:00Z')
const capture = vi.fn(), assistant = vi.fn(), day = vi.fn(), create = vi.fn(), materials = vi.fn()
beforeEach(() => {
  document.body.innerHTML = '<div id="test-root"></div>'
  state = emptyState(); capture.mockReset(); assistant.mockReset(); day.mockReset(); create.mockReset(); materials.mockReset()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
function props(): BrowserChromeProps {
  const noop = () => {}
  return { space: state.spaces[0], spaces: state.spaces, tab: { id: 'tab', title: 'Макет', url: 'https://design.test/' }, nativeNavigation: true,
    attentionIsland: locked => <AttentionIsland browser layoutLocked={locked} state={state} now={now} onChange={noop} onOpen={noop} onSpace={noop} onFocus={noop} onDay={day} />,
    onHome: noop, onSpace: noop, onSpaceDashboard: materials, onWeb: noop, onAllSpaces: noop, onNavigate: noop, onNavigation: noop, onSave: noop,
    onDay: day, onCapture: capture, onAssistant: assistant, onFocus: noop, onSearch: noop, onSettings: noop, onPark: noop, onNewSpace: create }
}
async function render() { await act(async () => root.render(<BrowserChrome {...props()} />)) }
function labelled(label: string) { return document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)! }
async function click(label: string) { await act(async () => labelled(label).click()) }
function notify() { state = { ...state, reminders: [{ id: 'task', title: 'Отправить макет', createdAt: now.toISOString(), dueAt: now.toISOString(), done: false }] } }
function wide() { return document.querySelector('.browser-attention-island')?.getAttribute('data-wide') }

it('сохраняет прямой вход в создание, материалы, запись и ИИ', async () => {
  await render()
  for (const [label, handler] of [['Новое пространство', create], ['Материалы пространства', materials], ['Записать', capture], ['Спросить ИИ', assistant]] as const) {
    await click(label); expect(handler).toHaveBeenCalledOnce()
  }
  expect(labelled('Новое пространство').textContent).toBe('')
  expect(labelled('Выбрать пространство').querySelector('svg.lucide-folder')).toBeNull()
  expect(labelled('Материалы пространства').querySelector('svg.lucide-panel-right')).not.toBeNull()
})
it('удерживает геометрию при вводе адреса и расширяется после ухода из поля', async () => {
  await render()
  const address = document.querySelector<HTMLInputElement>('.browser-omnibox-input')!
  await act(async () => address.focus())
  notify(); await render()
  expect(wide()).toBe('false')
  expect(document.querySelector('.browser-day-pulse')?.getAttribute('title')).toContain('Отправить макет')
  await act(async () => address.blur())
  expect(wide()).toBe('true')
})
it('не сдвигает кнопку под указателем и сохраняет её действие', async () => {
  await render()
  const button = labelled('Записать')
  await act(async () => button.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })))
  notify(); await render()
  expect(wide()).toBe('false')
  await click('Записать'); expect(capture).toHaveBeenCalledOnce()
  await act(async () => button.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })))
  expect(wide()).toBe('true')
})
it('сохраняет меню при новом сигнале и открывает день вторым нажатием', async () => {
  await render(); await click('Меню Дома')
  notify(); await render()
  expect(wide()).toBe('false')
  const item = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(button => button.textContent?.trim() === 'План дня')!
  await act(async () => item.click())
  expect(day).toHaveBeenCalledOnce()
  expect(wide()).toBe('true')
})

it('отображает подсказки при наборе и осуществляет переход по клику или клавиатуре', async () => {
  const navigate = vi.fn()
  state.spaces[0].resources = [{ id: 'ref', name: 'Референс дизайн', kind: 'link', target: 'https://ref.test/', createdAt: now.toISOString() }]
  await act(async () => root.render(<BrowserChrome {...props()} onNavigate={navigate} history={[{ url: 'https://pinterest.com/', title: 'Pinterest', visitedAt: now.toISOString() }]} />))
  const input = document.querySelector<HTMLInputElement>('.browser-omnibox-input')!
  await act(async () => {
    input.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'pin')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(document.querySelector('.omnibox-dropdown')).not.toBeNull()
  const items = document.querySelectorAll('.omnibox-suggestion-item')
  expect(items.length).toBeGreaterThan(0)
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  })
  expect(document.querySelector('.omnibox-suggestion-item.is-selected')).not.toBeNull()
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  expect(document.querySelector('.omnibox-dropdown')).toBeNull()
})
