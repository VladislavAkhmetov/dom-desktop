export interface WeatherDay {
  date: string
  code: number
  high: number
  low: number
  precipitationProbability: number | null
  windSpeed: number | null
}

export interface UfaWeather {
  temperature: number
  code: number
  observedAt: string
  fetchedAt: number
  feelsLike: number | null
  humidity: number | null
  windSpeed: number | null
  forecast: WeatherDay[]
}

// Daily values and current conditions share Ufa's local time; wind is in m/s.
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=54.7388&longitude=55.9721&current=temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&wind_speed_unit=ms&timezone=Asia%2FYekaterinburg&forecast_days=7'
const CACHE_KEY = 'dom-ufa-weather-v1'
const finiteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const optionalNumber = (value: unknown): number | null => finiteNumber(value) ? value : null

function validDay(value: unknown): value is WeatherDay {
  if (!value || typeof value !== 'object') return false
  const day = value as WeatherDay
  return typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isInteger(day.code) && finiteNumber(day.high) && finiteNumber(day.low)
}

export function cachedUfaWeather(): UfaWeather | null {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as UfaWeather | null
    if (saved && finiteNumber(saved.temperature) && Number.isInteger(saved.code) && typeof saved.observedAt === 'string' && finiteNumber(saved.fetchedAt) && Date.now() - saved.fetchedAt >= 0 && Date.now() - saved.fetchedAt < 60 * 60 * 1000) {
      return { ...saved, feelsLike: optionalNumber(saved.feelsLike), humidity: optionalNumber(saved.humidity), windSpeed: optionalNumber(saved.windSpeed), forecast: Array.isArray(saved.forecast) ? saved.forecast.filter(validDay).map(day => ({ ...day, precipitationProbability: optionalNumber(day.precipitationProbability), windSpeed: optionalNumber(day.windSpeed) })) : [] }
    }
  } catch { /* No usable local cache. */ }
  return null
}

export async function fetchUfaWeather(): Promise<UfaWeather> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(WEATHER_URL, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`Weather HTTP ${response.status}`)
    const data = await response.json() as {
      current?: { temperature_2m?: number; weather_code?: number; time?: string; apparent_temperature?: number; relative_humidity_2m?: number; wind_speed_10m?: number }
      daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: (number | null)[]; wind_speed_10m_max?: (number | null)[] }
    }
    const current = data.current
    if (!current || !finiteNumber(current.temperature_2m) || !Number.isInteger(current.weather_code) || !current.time) throw new Error('Invalid weather data')
    const daily = data.daily
    const forecast = (daily?.time || []).map((date, index) => ({ date, code: daily?.weather_code?.[index], high: daily?.temperature_2m_max?.[index], low: daily?.temperature_2m_min?.[index], precipitationProbability: optionalNumber(daily?.precipitation_probability_max?.[index]), windSpeed: optionalNumber(daily?.wind_speed_10m_max?.[index]) })).filter(validDay).slice(0, 7)
    const weather: UfaWeather = { temperature: current.temperature_2m, code: current.weather_code!, observedAt: current.time, fetchedAt: Date.now(), feelsLike: optionalNumber(current.apparent_temperature), humidity: optionalNumber(current.relative_humidity_2m), windSpeed: optionalNumber(current.wind_speed_10m), forecast }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(weather)) } catch { /* Weather still works without a cache. */ }
    return weather
  } finally {
    window.clearTimeout(timeout)
  }
}

export function weatherDescription(code: number): string {
  if (code === 0) return 'Ясно'
  if (code === 1) return 'Преимущественно ясно'
  if (code === 2) return 'Переменная облачность'
  if (code === 3) return 'Облачно'
  if (code === 45 || code === 48) return 'Туман'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Морось'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Дождь'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Снег'
  if ([95, 96, 99].includes(code)) return 'Гроза'
  return 'Погода'
}
