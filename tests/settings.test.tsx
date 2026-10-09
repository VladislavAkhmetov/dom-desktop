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
  it('сохраняет черновики календаря и RSS при переключении разделов', async () => {
    await mount()
    expect(document.activeElement).toBe(button('Общие'))
    await click(button('Календари'))
    const calendar = panel().querySelectorAll('input')
    await fill(calendar[0], 'Работа')
    await fill(calendar[1], 'webcal://example.com/calendar.ics')
    await click(button('Дайджест'))
    const feed = panel().querySelectorAll<HTMLInputElement>('.news-add-source input')
    await fill(feed[0], 'Дизайн')
    await fill(feed[1], 'https://example.com/design.xml')
    await click(button('Календари'))
    expect(calendar[0].value).toBe('Работа')
    expect(calendar[1].value).toBe('webcal://example.com/calendar.ics')
    await click(button('Дайджест'))
    expect(feed[0].value).toBe('Дизайн')
    await click(button('Добавить'))
    expect(current.feedSources?.[0]).toMatchObject({ name: 'Дизайн', url: 'https://example.com/design.xml' })
    expect(feed[0].value).toBe('')
  })

  it('ищет по ключевым словам и позволяет очистить пустой результат', async () => {
    await mount()
    const search = document.querySelector<HTMLInputElement>('input[type="search"]')!
    await fill(search, 'RSS')
    expect([...document.querySelectorAll('.settings-nav button')].map(item => item.textContent)).toEqual(['Дайджест'])
    await click(button('Дайджест'))
    expect(panel().getAttribute('aria-label')).toBe('Дайджест')
    await fill(search, 'несуществующий раздел')
    expect(document.querySelector('.settings-search-empty')?.textContent).toBe('Раздел не найден')
    await click(document.querySelector('[aria-label="Очистить поиск разделов"]')!)
    expect(document.querySelectorAll('.settings-nav button')).toHaveLength(7)
  })

  it('позволяет редактировать профиль и запускать импорт из Chrome', async () => {
    const onImport = vi.fn()
    let localState = structuredClone(initial)
    await act(async () => root.render(<Settings state={localState} onChange={update => { localState = typeof update === 'function' ? update(localState) : update }} onClose={onClose} onDashboard={onDashboard} autostart={false} onAutostart={vi.fn()} onBackup={onBackup} calendarName="" calendarUrl="" onCalendarName={vi.fn()} onCalendarUrl={vi.fn()} onAddCalendar={vi.fn()} onRemoveCalendar={vi.fn()} onCalendarRefresh={vi.fn()} calendarRefreshing={false} onNewsRefresh={vi.fn()} newsRefreshing={false} initialSection="profile" onImport={onImport} />))
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
    await click(document.querySelector('[aria-label="Анимация напоминаний"]')!)
    expect(current.liveHints).toBe(true)
    await click(button('Настроить'))
    expect(onDashboard).toHaveBeenCalledOnce()
    await click(button('Создать'))
    expect(onBackup).toHaveBeenCalledOnce()
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('изменяет важных отправителей только у выбранного аккаунта', async () => {
    await mount()
    await click(button('Почта Gmail'))
    const select = panel().querySelector('select')!
    await act(async () => { select.value = 'second'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    await fill(panel().querySelector('textarea')!, 'team@example.com')
    expect(current.mailAccounts?.[0].importantSenders).toBeUndefined()
    expect(current.mailAccounts?.[1].importantSenders).toEqual(['team@example.com'])
    expect(current.mailMessages?.map(item => item.important)).toEqual([false, true])
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
