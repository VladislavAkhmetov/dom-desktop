// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AmbientDate, AmbientWeather, WeatherDetails } from '../src/AmbientPreviews'
import type { UfaWeather } from '../src/weather'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
const now = new Date(2026, 9, 1, 12)
const weather: UfaWeather = {
  temperature: 5, code: 2, observedAt: '2026-10-01T12:00', fetchedAt: now.getTime(), feelsLike: 3, humidity: 72, windSpeed: 2,
  forecast: Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-0${index + 1}`, code: 2, high: 10 + index, low: 2 + index, precipitationProbability: index * 10, windSpeed: 3 }))
}
beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = '<div id="test-root"></div><button id="outside">Вне карточки</button>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers() })
function get<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing ${selector}`)
  return element
}
async function click(selector: string) { await act(async () => get(selector).click()) }
async function advance(ms: number) { await act(async () => vi.advanceTimersByTime(ms)) }
async function pointer(selector: string, type: string, pointerType = 'mouse') {
  await act(async () => {
    const event = new MouseEvent(type, { bubbles: true, relatedTarget: document.body })
    Object.defineProperty(event, 'pointerType', { value: pointerType })
    get(selector).dispatchEvent(event)
  })
}

describe('компактные карточки даты и погоды', () => {
  it('открывает месяц при ховере, сохраняет карточку при переходе курсора внутрь и закрывает после ухода', async () => {
    const open = vi.fn()
    await act(async () => root.render(<AmbientDate now={now} onOpenCalendar={open} />))
    expect(document.querySelector('.hub-date svg')).toBeNull()
    await pointer('.hub-date', 'pointerover'); await advance(120)
    expect(get('.ambient-card-heading').textContent).toContain('октябрь 2026')
    expect(get('.ambient-month-day[aria-current="date"]').getAttribute('datetime')).toBe('2026-10-01')
    expect(open).not.toHaveBeenCalled()
    await pointer('.hub-date', 'pointerout'); await advance(100)
    await pointer('.ambient-card', 'pointerover'); await advance(300)
    expect(document.querySelector('.ambient-card')).not.toBeNull()
    await pointer('.ambient-card', 'pointerout'); await advance(180)
    expect(document.querySelector('.ambient-card')).toBeNull()
  })
  it('показывает февраль високосного года и переключает декабрь на январь следующего года', async () => {
    await act(async () => root.render(<AmbientDate now={new Date(2028, 1, 29)} onOpenCalendar={vi.fn()} />))
    await click('.hub-date')
    expect(get('[datetime="2028-02-29"]').getAttribute('aria-current')).toBe('date')
    expect(document.querySelector('[datetime="2028-02-30"]')).toBeNull()
    await act(async () => root.render(<AmbientDate now={new Date(2026, 11, 31)} onOpenCalendar={vi.fn()} />))
    await click('[aria-label="Следующий месяц"]')
    expect(get('.ambient-card-heading').textContent).toContain('январь 2027')
    await click('.ambient-month-caption button')
    expect(get('.ambient-card-heading').textContent).toContain('декабрь 2026')
  })
  it('открывает полный календарь только кнопкой внутри компактной карточки', async () => {
    const open = vi.fn()
    await act(async () => root.render(<AmbientDate now={now} onOpenCalendar={open} />))
    await click('.hub-date')
    expect(open).not.toHaveBeenCalled()
    await click('.ambient-card-action')
    expect(open).toHaveBeenCalledOnce()
    expect(document.querySelector('.ambient-card')).toBeNull()
  })
  it('поддерживает фокус с клавиатуры, Escape с возвратом на дату и закрытие вне карточки', async () => {
    await act(async () => root.render(<AmbientDate now={now} onOpenCalendar={vi.fn()} />))
    await act(async () => get('.hub-date').focus())
    expect(get('.hub-date').getAttribute('aria-expanded')).toBe('true')
    await act(async () => get('[aria-label="Следующий месяц"]').focus())
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.activeElement).toBe(get('.hub-date'))
    expect(document.querySelector('.ambient-card')).toBeNull()
    await click('.hub-date')
    await pointer('#outside', 'pointerdown')
    expect(document.querySelector('.ambient-card')).toBeNull()
  })
  it('показывает три дня и открывает подробный прогноз только действием внутри карточки', async () => {
    const open = vi.fn()
    await act(async () => root.render(<AmbientWeather weather={weather} now={now} onOpenForecast={open} />))
    await pointer('.hub-weather', 'pointerover'); await advance(120)
    expect(document.querySelectorAll('.ambient-weather-day')).toHaveLength(3)
    expect(get('.ambient-weather-days').textContent).toContain('Сегодня')
    expect(get('.ambient-weather-days').textContent).toContain('Завтра')
    expect(get('.ambient-weather-rain').textContent).toBe('0%')
    expect(open).not.toHaveBeenCalled()
    await click('.ambient-card-action')
    expect(open).toHaveBeenCalledOnce()
    expect(document.querySelector('.ambient-card')).toBeNull()
  })
  it('не включает вчерашний прогноз и честно показывает отсутствие данных', async () => {
    await act(async () => root.render(<AmbientWeather weather={weather} now={new Date(2026, 9, 2)} onOpenForecast={vi.fn()} />))
    await click('.hub-weather')
    expect(get('.ambient-weather-days').textContent).not.toContain('1 окт.')
    expect(get('.ambient-weather-days').textContent).toContain('2 окт.')
    await act(async () => root.render(<AmbientWeather weather={null} now={now} onOpenForecast={vi.fn()} />))
    expect(get('.ambient-empty').textContent).toContain('Прогноз пока недоступен')
    expect(document.querySelector('.ambient-weather-days')).toBeNull()
  })
  it('отображает недельный прогноз и текущие показатели в подробностях', async () => {
    await act(async () => root.render(<WeatherDetails weather={weather} now={now} onOpenTraffic={vi.fn()} />))
    expect(document.querySelectorAll('.weather-details-day')).toHaveLength(7)
    expect(get('.weather-details-metrics').textContent).toContain('Ощущается3°')
    expect(get('.weather-details-metrics').textContent).toContain('Влажность72%')
    expect(get('.weather-details-metrics').textContent).toContain('Ветер2 м/с')
  })
})
