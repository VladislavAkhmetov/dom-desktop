// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Settings } from '../src/Settings'
import { SettingsList } from '../src/SettingsList'
import type { AppState } from '../src/types'

vi.mock('../src/bridge', () => ({ bridge: { platform: 'win32' }, isDesktop: true }))
vi.mock('../src/demo', () => ({ isDemo: false }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root
let current: AppState
let observers: { element?: Element; resize: () => void }[]
const onClose = vi.fn()
const onDashboard = vi.fn()
const onBackup = vi.fn()
const initial: AppState = {
  version: 1, spaces: [], reminders: [], dismissedUntil: null,
  mailAccounts: [{ id: 'first', email: 'first@example.com' }, { id: 'second', email: 'second@example.com' }],
  mailMessages: ['first', 'second'].map(id => ({ id, accountId: id, gmailId: id, threadId: id, from: 'team@example.com', subject: 'Макет', snippet: '', receivedAt: '2026-09-30T10:00:00Z', unread: true, important: false, url: 'https://mail.google.com/' }))
}

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', class {
    record: { element?: Element; resize: () => void }
    constructor(resize: () => void) { this.record = { resize }; observers.push(this.record) }
    observe(element: Element) { this.record.element = element }
    disconnect() {}
  })
  onClose.mockReset(); onDashboard.mockReset(); onBackup.mockReset()
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })

function Harness() {
  const [state, setState] = useState(structuredClone(initial))
  const [name, setName] = useState(''), [url, setUrl] = useState('')
  current = state
  return <Settings state={state} onChange={setState} onClose={onClose} onDashboard={onDashboard} autostart={false} onAutostart={vi.fn()} onBackup={onBackup} calendarName={name} calendarUrl={url} onCalendarName={setName} onCalendarUrl={setUrl} onAddCalendar={vi.fn()} onRemoveCalendar={vi.fn()} onCalendarRefresh={vi.fn()} calendarRefreshing={false} onNewsRefresh={vi.fn()} newsRefreshing={false} />
}
async function mount() { await act(async () => root.render(<Harness />)) }
function button(text: string) {
  const result = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)
  if (!result) throw new Error(`Кнопка не найдена: ${text}`)
  return result
}
async function click(element: HTMLElement) { await act(async () => element.click()) }
async function fill(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function panel() { return document.querySelector<HTMLElement>('.settings-panel:not([hidden])')! }

describe('разделы настроек', () => {
  it('переключает разделы и сохраняет выбранную поисковую систему', async () => {
    await mount()
    expect(document.activeElement).toBe(button('Общие'))
    await click(button('Браузер и память'))
    expect(panel().getAttribute('aria-label')).toBe('Браузер и память')
    const select = panel().querySelector<HTMLSelectElement>('select[aria-label="Поисковая система"]')!
    await act(async () => {
      select.value = 'duckduckgo'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(current.searchEngine).toBe('duckduckgo')
    await click(button('Общие'))
    expect(panel().getAttribute('aria-label')).toBe('Общие')
    await click(button('Браузер и память'))
    expect(panel().querySelector<HTMLSelectElement>('select[aria-label="Поисковая система"]')?.value).toBe('duckduckgo')
  })

  it('ищет по ключевым словам и позволяет очистить пустой результат', async () => {
    await mount()
    const search = document.querySelector<HTMLInputElement>('input[type="search"]')!
    await fill(search, 'обои')
    expect([...document.querySelectorAll('.settings-nav button')].map(item => item.textContent)).toEqual(['Общие'])
    await click(button('Общие'))
    expect(panel().getAttribute('aria-label')).toBe('Общие')
    await fill(search, 'несуществующий раздел')
    expect(document.querySelector('.settings-search-empty')?.textContent).toBe('Раздел не найден')
    await click(document.querySelector('[aria-label="Очистить поиск разделов"]')!)
    expect(document.querySelectorAll('.settings-nav button')).toHaveLength(5)
  })

  it('позволяет редактировать профиль и запускать импорт из Chrome', async () => {
    const onImport = vi.fn()
    let localState = structuredClone(initial)
    await act(async () => root.render(<Settings state={localState} onChange={update => { localState = typeof update === 'function' ? update(localState) : update }} onClose={onClose} onDashboard={onDashboard} autostart={false} onAutostart={vi.fn()} onBackup={onBackup} initialSection="profile" onImport={onImport} />))
    expect(panel().getAttribute('aria-label')).toBe('Профиль')
    const nameInput = panel().querySelector<HTMLInputElement>('input[aria-label="Имя пользователя"]')!
    await fill(nameInput, 'Мария')
    expect(localState.userProfile?.name).toBe('Мария')
    await click(button('Импортировать из Chrome'))
    expect(onImport).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('сохраняет переключатель и действия общих настроек', async () => {
    await mount()
    // On by default; the first press turns reminder motion off, the second back on.
    expect(document.querySelector('[aria-label="Анимация напоминаний"]')?.getAttribute('aria-checked')).toBe('true')
    await click(document.querySelector('[aria-label="Анимация напоминаний"]')!)
    expect(current.liveHints).toBe(false)
    await click(document.querySelector('[aria-label="Анимация напоминаний"]')!)
    expect(current.liveHints).toBe(true)
    await click(button('Браузер и память'))
    await click(button('Настроить'))
    expect(onDashboard).toHaveBeenCalledOnce()
    await click(button('О программе'))
    await click(button('Создать'))
    expect(onBackup).toHaveBeenCalledOnce()
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('управляет блокировкой рекламы и тайм-аутом выгрузки памяти', async () => {
    await mount()
    await click(button('Пароли и защита'))
    const adblockToggle = document.querySelector('[aria-label="Блокировка рекламы"]')!
    expect(adblockToggle.getAttribute('aria-checked')).toBe('true')
    await click(adblockToggle)
    expect(current.adblockEnabled).toBe(false)
    await click(adblockToggle)
    expect(current.adblockEnabled).toBe(true)

    await click(button('Браузер и память'))
    const parkSelect = panel().querySelector<HTMLSelectElement>('select[aria-label="Выгрузка неактивных вкладок"]')!
    await act(async () => {
      parkSelect.value = '15'
      parkSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(current.tabParkingTimeoutMinutes).toBe(15)
  })

  it('прокручивает панель настроек при прокрутке колеса над заголовком', async () => {
    await mount()
    const activePanel = panel()
    activePanel.scrollTop = 0
    const header = document.querySelector<HTMLElement>('.settings-section-heading')!
    await act(async () => {
      header.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }))
    })
    expect(activePanel.scrollTop).toBe(120)
  })
})

describe('списки подключений без длинной страницы', () => {
  it('показывает все записи через страницы и корректирует страницу после удаления и смены высоты', async () => {
    const items = Array.from({ length: 10 }, (_, index) => ({ id: String(index), name: `Источник ${index + 1}` }))
    const render = (values: typeof items) => root.render(<SettingsList items={values} label="Источники" empty="Нет источников" renderItem={item => <span>{item.name}</span>} />)
    await act(async () => render(items))
    const list = document.querySelector<HTMLElement>('.settings-list')!
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 196 })
    await act(async () => observers[0].resize())
    expect(document.querySelectorAll('.settings-list-item')).toHaveLength(2)
    const next = () => document.querySelector<HTMLButtonElement>('[aria-label="Следующая страница: Источники"]')!
    for (let index = 0; index < 4; index++) await click(next())
    expect(list.textContent).toContain('Источник 10')
    expect(next().disabled).toBe(true)
    await act(async () => render(items.slice(0, 3)))
    expect(list.textContent).toContain('Источник 3')
    expect(document.querySelectorAll('.settings-list-item')).toHaveLength(1)
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 424 })
    await act(async () => observers[0].resize())
    expect(document.querySelectorAll('.settings-list-item')).toHaveLength(3)
    expect(document.querySelector('.settings-pagination')).toBeNull()
  })
})
