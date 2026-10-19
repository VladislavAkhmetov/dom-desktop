import { useEffect, useState } from 'react'
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, RefreshCw, Sun, Wind, MapPin } from 'lucide-react'
import { cachedCityWeather, fetchCityWeather, WEATHER_CITIES, weatherDescription, type UfaWeather, type WeatherCity, type WeatherDay } from './weather'

function WeatherIcon({ code, size = 24 }: { code?: number; size?: number }) {
  const Icon = code === 0 ? Sun
    : code === 1 || code === 2 ? CloudSun
    : code === 45 || code === 48 ? CloudFog
    : [95, 96, 99].includes(code ?? -1) ? CloudLightning
    : [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1) ? CloudRain
    : [71, 73, 75, 77, 85, 86].includes(code ?? -1) ? CloudSnow : Cloud
  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />
}

const degrees = (value: number) => `${Math.round(value)}°`
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const fromDateKey = (key: string) => new Date(`${key}T12:00:00`)

function formatDayName(day: WeatherDay, now: Date): string {
  if (day.date === dateKey(now)) return 'Сегодня'
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (day.date === dateKey(tomorrow)) return 'Завтра'
  return fromDateKey(day.date).toLocaleDateString('ru-RU', { weekday: 'short' })
}

interface Props {
  onOpenTraffic?: () => void
}

export function WeatherWidget({ onOpenTraffic }: Props) {
  const [selectedCityId, setSelectedCityId] = useState<string>(() => {
    try {
      return localStorage.getItem('dom-weather-selected-city') || 'ufa'
    } catch {
      return 'ufa'
    }
  })
  const [weather, setWeather] = useState<UfaWeather | null>(() => cachedCityWeather(selectedCityId))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const city = WEATHER_CITIES.find(c => c.id === selectedCityId) || WEATHER_CITIES[0]
  const now = new Date()

  async function loadWeather(targetCity: WeatherCity, force = false) {
    if (!force) {
      const cached = cachedCityWeather(targetCity.id)
      if (cached) {
        setWeather(cached)
        return
      }
    }
    setLoading(true)
    setError(null)
    try {
      const fresh = await fetchCityWeather(targetCity)
      setWeather(fresh)
    } catch (err: any) {
      setError('Не удалось загрузить данные')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWeather(city)
  }, [selectedCityId])

  function handleCityChange(newCityId: string) {
    setSelectedCityId(newCityId)
    try {
      localStorage.setItem('dom-weather-selected-city', newCityId)
    } catch {
      // ignore
    }
  }

  const forecast = (weather?.forecast || []).filter(day => day.date >= dateKey(now)).slice(0, 5)

  return (
    <div className="weather-widget" aria-label={`Погода в городе ${city.name}`}>
      <div className="weather-widget-header">
        <div className="weather-city-select-wrap">
          <MapPin size={15} className="weather-pin-icon" />
          <select
            className="weather-city-select"
            value={selectedCityId}
            onChange={e => handleCityChange(e.target.value)}
            aria-label="Выбрать город"
          >
            {WEATHER_CITIES.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="weather-header-actions">
          {onOpenTraffic && (
            <button
              type="button"
              className="weather-traffic-btn"
              onClick={onOpenTraffic}
              title="Дорожная ситуация и пробки на карте"
              aria-label="Пробки на карте"
            >
              Пробки
            </button>
          )}
          <button
            type="button"
            className={`weather-refresh-btn ${loading ? 'is-spinning' : ''}`}
            onClick={() => loadWeather(city, true)}
            title="Обновить погоду"
            aria-label="Обновить погоду"
            disabled={loading}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {weather ? (
        <div className="weather-widget-content">
          <div className="weather-primary-row">
            <div className="weather-temp-badge">
              <WeatherIcon code={weather.code} size={36} />
              <strong className="weather-temp-value">{degrees(weather.temperature)}</strong>
            </div>
            <div className="weather-status-meta">
              <span className="weather-condition-title">{weatherDescription(weather.code)}</span>
              {weather.feelsLike != null && (
                <small className="weather-feels-like">
                  Ощущается как {degrees(weather.feelsLike)}
                </small>
              )}
            </div>
          </div>

          <div className="weather-metrics-pill-row">
            {weather.humidity != null && (
              <div className="weather-metric-pill" title="Влажность">
                <Droplets size={13} />
                <span>{Math.round(weather.humidity)}%</span>
              </div>
            )}
            {weather.windSpeed != null && (
              <div className="weather-metric-pill" title="Скорость ветра">
                <Wind size={13} />
                <span>{Math.round(weather.windSpeed)} м/с</span>
              </div>
            )}
            {forecast[0]?.precipitationProbability != null && (
              <div className="weather-metric-pill" title="Вероятность осадков">
                <Droplets size={13} />
                <span>Осадки: {Math.round(forecast[0].precipitationProbability)}%</span>
              </div>
            )}
          </div>

          {forecast.length > 0 && (
            <div className="weather-forecast-strip" aria-label="Прогноз на ближайшие дни">
              {forecast.map(day => (
                <div className="weather-forecast-col" key={day.date}>
                  <span className="weather-forecast-day">{formatDayName(day, now)}</span>
                  <div className="weather-forecast-icon">
                    <WeatherIcon code={day.code} size={20} />
                  </div>
                  <div className="weather-forecast-temps">
                    <strong>{degrees(day.high)}</strong>
                    <span>{degrees(day.low)}</span>
                  </div>
                  {day.precipitationProbability != null && day.precipitationProbability > 15 && (
                    <span className="weather-forecast-pop">
                      {Math.round(day.precipitationProbability)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="weather-widget-empty">
          {error ? (
            <span className="weather-error-text">{error}</span>
          ) : (
            <span className="weather-loading-text">Загрузка прогноза…</span>
          )}
        </div>
      )}
    </div>
  )
}
