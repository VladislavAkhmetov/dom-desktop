import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Sun, Wind } from 'lucide-react'
import { weatherDescription, type UfaWeather, type WeatherDay } from './weather'
import './ambient.css'

function WeatherIcon({ code, size = 24 }: { code?: number; size?: number }) {
  const Icon = code === 0 ? Sun
    : code === 1 || code === 2 ? CloudSun
    : code === 45 || code === 48 ? CloudFog
    : [95, 96, 99].includes(code ?? -1) ? CloudLightning
    : [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1) ? CloudRain
    : [71, 73, 75, 77, 85, 86].includes(code ?? -1) ? CloudSnow : Cloud
  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />
}

function HoverCard({ className, triggerClassName, label, trigger, children }: {
  className: string
  triggerClassName: string
  label: string
  trigger: ReactNode
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null } }
  const show = () => { clearTimer(); setOpen(true) }
  const close = () => { clearTimer(); setOpen(false) }
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close() }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopPropagation()
      if (root.current?.contains(document.activeElement)) button.current?.focus()
      close()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  return <div className={`ambient-preview ${className}`} ref={root}
    onPointerEnter={event => { if (event.pointerType === 'touch') return; clearTimer(); timer.current = setTimeout(show, 120) }}
    onPointerLeave={event => { if (event.pointerType === 'touch') return; clearTimer(); timer.current = setTimeout(close, 180) }}
    onFocus={show}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close() }}>
    <button ref={button} className={triggerClassName} aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} onClick={show}>{trigger}</button>
    {open && <div className="ambient-card-anchor"><section className="ambient-card" id={id} aria-label={label}>{children(close)}</section></div>}
  </div>
}

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const fromDateKey = (key: string) => new Date(`${key}T12:00:00`)

function MonthPreview({ now, onOpen }: { now: Date; onOpen: () => void }) {
  const [offset, setOffset] = useState(0)
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const first = (month.getDay() + 6) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const weeks = Math.ceil((first + count) / 7)
  const today = dateKey(now)
  return <>
    <div className="ambient-card-heading">
      <h2>{month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(/\s?г\.$/, '')}</h2>
      <div className="ambient-month-navigation">
        <button aria-label="Предыдущий месяц" onClick={() => setOffset(value => value - 1)}><ChevronLeft size={17} /></button>
        <button aria-label="Следующий месяц" onClick={() => setOffset(value => value + 1)}><ChevronRight size={17} /></button>
      </div>
    </div>
    <div className="ambient-month-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
    <div className="ambient-month-grid" aria-label="Дни месяца">
      {Array.from({ length: weeks * 7 }, (_, index) => {
        const date = new Date(month.getFullYear(), month.getMonth(), index - first + 1)
        const key = dateKey(date)
        const isToday = key === today
        return <time key={key} dateTime={key} aria-current={isToday ? 'date' : undefined}
          aria-label={date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}
          className={`ambient-month-day${date.getMonth() !== month.getMonth() ? ' outside' : ''}${index % 7 > 4 ? ' weekend' : ''}${isToday ? ' today' : ''}`}><span>{date.getDate()}</span></time>
      })}
    </div>
    <div className="ambient-month-caption"><span>{now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</span>{offset !== 0 && <button onClick={() => setOffset(0)}>Сегодня</button>}</div>
    <button className="ambient-card-action" onClick={onOpen}><span>Открыть календарь</span><ArrowRight size={16} /></button>
  </>
}

export function AmbientDate({ now, onOpenCalendar }: { now: Date; onOpenCalendar: () => void }) {
  return <HoverCard className="ambient-date" triggerClassName="hub-date" label={`${now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}. Показать календарь месяца`}
    trigger={<><strong>{now.getDate()}</strong><span className="hub-date-copy"><span>{now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).replace(/^\d+\s/, '')}</span><small>{now.toLocaleDateString('ru-RU', { weekday: 'long' })}</small></span></>}>
    {close => <MonthPreview now={now} onOpen={() => { close(); onOpenCalendar() }} />}
  </HoverCard>
}

function dayLabel(day: WeatherDay, now: Date) {
  if (day.date === dateKey(now)) return 'Сегодня'
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return day.date === dateKey(tomorrow) ? 'Завтра' : fromDateKey(day.date).toLocaleDateString('ru-RU', { weekday: 'short' })
}

const degrees = (value: number) => `${Math.round(value)}°`
const availableForecast = (weather: UfaWeather | null, now: Date) => (weather?.forecast || []).filter(day => day.date >= dateKey(now))

export function AmbientWeather({ weather, now, onOpenForecast }: { weather: UfaWeather | null; now: Date; onOpenForecast: () => void }) {
  const forecast = availableForecast(weather, now).slice(0, 3)
  return <HoverCard className="ambient-weather" triggerClassName="hub-weather" label={`Погода в Уфе${weather ? `: ${degrees(weather.temperature)}, ${weatherDescription(weather.code)}` : ': данные недоступны'}. Показать прогноз на три дня`}
    trigger={<><WeatherIcon code={weather?.code} size={22} /><span>Уфа</span><strong>{weather ? degrees(weather.temperature) : '—°'}</strong></>}>
    {close => <>
      <div className="ambient-card-heading"><h2>Уфа</h2><span className="ambient-card-meta">{forecast.length === 3 ? 'На 3 дня' : 'Погода'}</span></div>
      {weather && <div className="ambient-weather-current"><WeatherIcon code={weather.code} size={32} /><strong>{degrees(weather.temperature)}</strong><span>{weatherDescription(weather.code)}</span></div>}
      {forecast.length ? <div className="ambient-weather-days">{forecast.map(day => <div className="ambient-weather-day" key={day.date}>
        <span>{dayLabel(day, now)}</span><small>{fromDateKey(day.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</small>
        <span className="ambient-weather-symbol" title={weatherDescription(day.code)} aria-label={weatherDescription(day.code)}><WeatherIcon code={day.code} size={27} /></span>
        <div className="ambient-weather-temperatures" aria-label={`Максимум ${degrees(day.high)}, минимум ${degrees(day.low)}`}><strong>{degrees(day.high)}</strong><span>{degrees(day.low)}</span></div>
        <small className="ambient-weather-rain" aria-label={day.precipitationProbability !== null ? `Вероятность осадков ${Math.round(day.precipitationProbability)}%` : 'Вероятность осадков недоступна'}><Droplets size={12} />{day.precipitationProbability !== null ? `${Math.round(day.precipitationProbability)}%` : '—'}</small>
      </div>)}</div> : <p className="ambient-empty">Прогноз пока недоступен. Попробуйте позже.</p>}
      <button className="ambient-card-action" onClick={() => { close(); onOpenForecast() }}><span>Подробный прогноз</span><ArrowRight size={16} /></button>
    </>}
  </HoverCard>
}

export function WeatherDetails({ weather, now, onOpenTraffic }: { weather: UfaWeather | null; now: Date; onOpenTraffic: () => void }) {
  const forecast = availableForecast(weather, now)
  return <div className="weather-details">
    <div className="weather-details-current"><div><span>Уфа</span><strong>{weather ? degrees(weather.temperature) : '—°'}</strong><p>{weather ? weatherDescription(weather.code) : 'Погода пока недоступна'}</p></div><WeatherIcon code={weather?.code} size={64} /></div>
    {weather && <div className="weather-details-metrics">
      <div><span>Ощущается</span><strong>{weather.feelsLike != null ? degrees(weather.feelsLike) : '—'}</strong></div>
      <div><span><Droplets size={13} />Влажность</span><strong>{weather.humidity != null ? `${Math.round(weather.humidity)}%` : '—'}</strong></div>
      <div><span><Wind size={13} />Ветер</span><strong>{weather.windSpeed != null ? `${Math.round(weather.windSpeed)} м/с` : '—'}</strong></div>
    </div>}
    {forecast.length ? <><h3>{forecast.length === 7 ? 'Прогноз на 7 дней' : 'Прогноз по дням'}</h3><div className="weather-details-forecast">{forecast.map(day => <div className="weather-details-day" key={day.date}>
      <div><strong>{dayLabel(day, now)}</strong><small>{fromDateKey(day.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</small></div>
      <span className="weather-details-condition" title={weatherDescription(day.code)}><WeatherIcon code={day.code} size={23} /><small>{weatherDescription(day.code)}</small></span>
      <span className="weather-details-rain" aria-label={day.precipitationProbability !== null ? `Вероятность осадков ${Math.round(day.precipitationProbability)}%` : 'Вероятность осадков недоступна'}><Droplets size={13} />{day.precipitationProbability !== null ? `${Math.round(day.precipitationProbability)}%` : '—'}</span>
      <div className="ambient-weather-temperatures" aria-label={`Максимум ${degrees(day.high)}, минимум ${degrees(day.low)}`}><span>{degrees(day.low)}</span><strong>{degrees(day.high)}</strong></div>
    </div>)}</div></> : <p className="ambient-empty">Прогноз пока недоступен. Попробуйте позже.</p>}
    <div className="weather-details-footer"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>{weather && <span>Обновлено {weather.observedAt.split('T')[1]?.slice(0, 5)}</span>}</div>
    <button className="ambient-card-action" onClick={onOpenTraffic}><span>Пробки на карте</span><ArrowUpRight size={16} /></button>
  </div>
}
