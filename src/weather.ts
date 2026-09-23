export interface UfaWeather {
  temperature: number
  code: number
  observedAt: string
  fetchedAt: number
}

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=54.7388&longitude=55.9721&current=temperature_2m,weather_code&timezone=Asia%2FYekaterinburg&forecast_days=1'
const CACHE_KEY = 'dom-ufa-weather-v1'

export function cachedUfaWeather(): UfaWeather | null {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as UfaWeather | null
    if (saved && Number.isFinite(saved.temperature) && Date.now() - saved.fetchedAt < 60 * 60 * 1000) return saved
  } catch { /* No usable local cache. */ }
  return null
}

export async function fetchUfaWeather(): Promise<UfaWeather> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(WEATHER_URL, { signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`Weather HTTP ${response.status}`)
    const data = await response.json() as { current?: { temperature_2m?: number; weather_code?: number; time?: string } }
    const current = data.current
    if (!current || typeof current.temperature_2m !== 'number' || !Number.isFinite(current.temperature_2m) || typeof current.weather_code !== 'number' || !Number.isInteger(current.weather_code) || !current.time) throw new Error('Invalid weather data')
    const weather: UfaWeather = { temperature: current.temperature_2m, code: current.weather_code, observedAt: current.time, fetchedAt: Date.now() }
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
