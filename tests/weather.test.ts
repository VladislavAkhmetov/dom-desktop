// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cachedUfaWeather, fetchUfaWeather } from '../src/weather'

const now = new Date('2026-10-01T07:00:00Z')
const response = () => ({
  current: { temperature_2m: 5, weather_code: 2, time: '2026-10-01T12:00', apparent_temperature: 3, relative_humidity_2m: 70, wind_speed_10m: 2.5 },
  daily: { time: ['2026-10-01', '2026-10-02', '2026-10-03'], weather_code: [0, 3, 61], temperature_2m_max: [12, 10, 8], temperature_2m_min: [2, 0, -1], precipitation_probability_max: [0, null, 80], wind_speed_10m_max: [3, 4, 5] }
})
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); localStorage.clear() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('данные прогноза погоды', () => {
  it('запрашивает недельный прогноз в часовом поясе Уфы и сохраняет нулевую вероятность осадков', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => response() })
    vi.stubGlobal('fetch', fetch)
    const weather = await fetchUfaWeather()
    const url = new URL(fetch.mock.calls[0][0])
    expect(url.searchParams.get('forecast_days')).toBe('7')
    expect(url.searchParams.get('timezone')).toBe('Asia/Yekaterinburg')
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms')
    expect(weather).toMatchObject({ temperature: 5, feelsLike: 3, humidity: 70, windSpeed: 2.5 })
    expect(weather.forecast).toHaveLength(3)
    expect(weather.forecast[0]).toMatchObject({ date: '2026-10-01', high: 12, low: 2, precipitationProbability: 0 })
    expect(weather.forecast[1].precipitationProbability).toBeNull()
    expect(cachedUfaWeather()).toEqual(weather)
  })
  it('сохраняет текущую погоду при неполных суточных данных без выдуманных температур', async () => {
    const data = response()
    data.daily.temperature_2m_max = [12]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }))
    const weather = await fetchUfaWeather()
    expect(weather.temperature).toBe(5)
    expect(weather.forecast).toHaveLength(1)
  })
  it('читает прежний кеш с текущей температурой и отбрасывает просроченный', () => {
    localStorage.setItem('dom-ufa-weather-v1', JSON.stringify({ temperature: 5, code: 2, observedAt: '2026-10-01T12:00', fetchedAt: now.getTime() }))
    expect(cachedUfaWeather()).toMatchObject({ temperature: 5, feelsLike: null, humidity: null, windSpeed: null, forecast: [] })
    vi.setSystemTime(new Date(now.getTime() + 60 * 60 * 1000))
    expect(cachedUfaWeather()).toBeNull()
  })
  it('ошибка сети не перезаписывает предыдущий рабочий кеш', async () => {
    const cached = { temperature: 5, code: 2, observedAt: '2026-10-01T12:00', fetchedAt: now.getTime() }
    localStorage.setItem('dom-ufa-weather-v1', JSON.stringify(cached))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(fetchUfaWeather()).rejects.toThrow('Weather HTTP 503')
    expect(JSON.parse(localStorage.getItem('dom-ufa-weather-v1')!)).toEqual(cached)
  })
})
