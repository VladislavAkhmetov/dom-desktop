// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Capture } from '../src/Capture'
import { toLocalInput } from '../src/reminders'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
const now = new Date(2026, 8, 30, 10, 0)
const onSave = vi.fn(() => true)
const onClose = vi.fn()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  sessionStorage.clear()
  onSave.mockReset().mockReturnValue(true)
  onClose.mockReset()
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers() })

async function mount(initialWhen = '', initialReminderAt?: string) {
  await act(async () => { root.render(<Capture initialWhen={initialWhen} initialReminderAt={initialReminderAt} onClose={onClose} onSave={onSave} />) })
}
function button(text: string) {
  const result = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)
  if (!result) throw new Error(`Кнопка не найдена: ${text}`)
  return result
}
async function click(element: HTMLElement) { await act(async () => element.click()) }
async function escape() { await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))) }
async function fill(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
function seed(raw: string) { sessionStorage.setItem('dom-capture-draft', raw) }

describe('прямое управление датой и напоминанием', () => {
  it('сохраняет запись без даты и напоминания из единственного поля', async () => {
    seed('Идея для новой страницы')
    await mount()
    expect(document.querySelector('h2')?.textContent).toBe('Новая запись')
    expect(document.querySelector('details')).toBeNull()
    expect(document.querySelectorAll('input')).toHaveLength(0)
    await click(button('Сохранить'))
    expect(onSave).toHaveBeenCalledWith('Идея для новой страницы', null, null, 'note')
    expect(sessionStorage.getItem('dom-capture-details')).toBeNull()
  })

  it('выбор даты сразу закрывает календарь и не включает напоминание', async () => {
    seed('Проверить макет')
    await mount('2026-09-30T00:00')
    await click(document.querySelector('[data-picker="date"]')!)
    await click(document.querySelector('[data-day="2026-10-02"]')!)
    expect(document.querySelector('.capture-picker')).toBeNull()
    await click(button('Сохранить'))
    expect(onSave).toHaveBeenCalledWith('Проверить макет', null, '2026-10-02', 'task')
  })

  it('включает напоминание выбором времени и переносит его вместе с делом', async () => {
    seed('Проверить макет')
    await mount('2026-09-30T00:00')
    await click(document.querySelector('[data-picker="reminder"]')!)
    expect(document.activeElement?.getAttribute('type')).toBe('time')
    await click(button('18:00'))
    expect(document.querySelector('.capture-picker')).toBeNull()
    await click(button('Завтра'))
    await click(button('Сохранить'))
    expect(onSave).toHaveBeenCalledWith('Проверить макет', new Date(2026, 9, 1, 18).toISOString(), '2026-10-01', 'task')
  })

  it('отключает напоминание, сохраняя выбранный день', async () => {
    seed('Позвонить')
    await mount('2026-10-01T00:00', '2026-10-01T18:00')
    await click(document.querySelector('[data-picker="reminder"]')!)
    await click(button('Отключить напоминание'))
    await click(button('Сохранить'))
    expect(onSave).toHaveBeenCalledWith('Позвонить', null, '2026-10-01', 'task')
  })

  it('применяет произвольное время на событие ввода без подтверждения', async () => {
    seed('Позвонить')
    await mount('2026-10-01T00:00')
    await click(document.querySelector('[data-picker="reminder"]')!)
    await act(async () => {
      const input = document.querySelector<HTMLInputElement>('input[type="time"]')!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '17:45')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(document.querySelector('[data-picker="reminder"]')?.textContent).toBe('17:45')
    await escape()
    await click(button('Сохранить'))
    expect(onSave).toHaveBeenCalledWith('Позвонить', new Date(2026, 9, 1, 17, 45).toISOString(), '2026-10-01', 'task')
  })

  it('Escape закрывает сначала выбор даты и возвращает фокус', async () => {
    await mount()
    await click(document.querySelector('[data-picker="date"]')!)
    await escape()
    expect(document.querySelector('.capture-picker')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(document.querySelector('[data-picker="date"]'))
    await escape()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('сохраняет ручное время при редактировании текста', async () => {
    seed('Проверить макет')
    await mount('2026-10-01T00:00')
    await click(document.querySelector('[data-picker="reminder"]')!)
    await click(button('18:00'))
    await fill(document.querySelector('textarea')!, 'Завтра в 12 проверить новый макет')
    await click(button('Сохранить'))
    expect(onSave).toHaveBeenCalledWith('проверить новый макет', new Date(2026, 9, 1, 18).toISOString(), '2026-10-01', 'task')
  })

  it('подставляет вручную выбранный день для времени, распознанного в тексте', async () => {
    seed('Проверить макет')
    await mount()
    await click(document.querySelector('[data-picker="date"]')!)
    await click(document.querySelector('[data-day="2026-10-02"]')!)
    await fill(document.querySelector('textarea')!, 'Завтра в 12 проверить макет')
    await click(button('Сохранить'))
    expect(onSave).toHaveBeenCalledWith('проверить макет', new Date(2026, 9, 2, 12).toISOString(), '2026-10-02', 'task')
  })

  it('напоминание из записи назначает день и сохраняется без отдельного включателя', async () => {
    seed('Позвонить')
    await mount()
    await click(document.querySelector('[data-picker="reminder"]')!)
    await click(button('Через час'))
    await click(button('Сохранить'))
    expect(onSave).toHaveBeenCalledWith('Позвонить', new Date(2026, 8, 30, 11).toISOString(), '2026-09-30', 'task')
  })

  it('восстанавливает старый черновик, показывая изменённое название в основном поле', async () => {
    sessionStorage.setItem('dom-capture-details', JSON.stringify({ raw: 'Завтра в 18 старый текст', manualTitle: 'Обновлённый текст', startedAt: now.toISOString() }))
    await mount()
    expect(document.querySelector('textarea')?.value).toBe('Обновлённый текст')
    await click(button('Сохранить'))
    expect(onSave).toHaveBeenCalledWith('Обновлённый текст', new Date(2026, 9, 1, 18).toISOString(), '2026-10-01', 'task')
  })

  it('ошибка сохранения оставляет черновик и даёт повторить действие', async () => {
    seed('Идея')
    onSave.mockReturnValue(false)
    await mount()
    await click(button('Сохранить'))
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Не удалось сохранить')
    expect(sessionStorage.getItem('dom-capture-draft')).toBe('Идея')
    expect(button('Сохранить').disabled).toBe(false)
  })

  it('не сохраняет время, которое успело пройти, и позволяет его отключить', async () => {
    seed('Позвонить')
    await mount('2026-09-30T00:00', toLocalInput(new Date(now.getTime() + 60_000).toISOString()))
    vi.setSystemTime(new Date(now.getTime() + 120_000))
    await click(button('Сохранить'))
    expect(onSave).not.toHaveBeenCalled()
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('уже прошло')
    await click(document.querySelector('[data-picker="reminder"]')!)
    await click(button('Отключить напоминание'))
    await click(button('Сохранить'))
    expect(onSave).toHaveBeenCalledWith('Позвонить', null, '2026-09-30', 'task')
  })
})
