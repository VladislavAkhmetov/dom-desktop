import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Bell, BellOff, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { localDate } from '../shared/state'
import { toLocalInput } from './reminders'

type Picker = 'date' | 'reminder' | null
interface Props {
  plannedDate: string | null
  dueAt: string | null
  picker: Picker
  disabled: boolean
  onPicker: (picker: Picker) => void
  onClosePicker: (restoreFocus?: boolean) => void
  onDay: (day: string | null) => void
  onReminder: (when: string) => void
}

function dayLabel(day: string | null) {
  if (!day) return 'Без даты'
  const date = new Date(`${day}T12:00:00`)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
}

export function CaptureSchedule({ plannedDate, dueAt, picker, disabled, onPicker, onClosePicker, onDay, onReminder }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [reminderDay, setReminderDay] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const reminderInput = toLocalInput(dueAt)
  const reminderLabel = !dueAt ? 'Без напоминания' : `${reminderInput.split('T')[0] !== plannedDate ? `${dayLabel(reminderInput.split('T')[0])}, ` : ''}${reminderInput.slice(11)}`

  useLayoutEffect(() => {
    if (!picker) return
    const place = () => {
      const anchor = root.current!.querySelector<HTMLButtonElement>(`[data-picker="${picker}"]`)!.getBoundingClientRect()
      const rect = panel.current!.getBoundingClientRect()
      const below = anchor.bottom + 8
      const top = below + rect.height <= window.innerHeight - 12 ? below : anchor.top - rect.height - 8
      setPosition({ top: Math.max(12, Math.min(top, window.innerHeight - rect.height - 12)), left: Math.max(12, Math.min(anchor.left, window.innerWidth - rect.width - 12)) })
    }
    place()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    observer?.observe(panel.current!)
    observer?.observe(root.current!)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { observer?.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [picker, plannedDate, dueAt])

  useEffect(() => {
    if (!picker) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClosePicker(false) }
    const focusOutside = (event: FocusEvent) => { if (!root.current?.contains(event.target as Node)) onClosePicker(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', focusOutside)
    panel.current?.querySelector<HTMLElement>('[data-picker-focus]')?.focus()
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', focusOutside) }
  }, [picker, onClosePicker])

  function open(next: Exclude<Picker, null>) {
    if (picker === next) { onClosePicker(); return }
    if (next === 'reminder') {
      setReminderDay(reminderInput.split('T')[0] || plannedDate || localDate(new Date())!)
      setReminderTime(reminderInput.slice(11))
    }
    onPicker(next)
  }

  function updateReminder(day: string, time: string) {
    setReminderDay(day)
    setReminderTime(time)
    if (day && time) onReminder(`${day}T${time}`)
    else onReminder('')
  }

  return <div className="capture-schedule" ref={root}>
    <div className="capture-metadata" aria-label="Дата и напоминание">
      <button disabled={disabled} data-picker="date" className="capture-meta-button" aria-label={`День выполнения: ${dayLabel(plannedDate)}`} aria-expanded={picker === 'date'} aria-controls={picker === 'date' ? id : undefined} onClick={() => open('date')}><CalendarDays size={16} /><span>{dayLabel(plannedDate)}</span></button>
      <span className="capture-meta-separator" aria-hidden="true">·</span>
      <button disabled={disabled} data-picker="reminder" className={`capture-meta-button ${dueAt ? 'has-reminder' : ''}`} aria-label={dueAt ? `Напоминание: ${reminderLabel}` : 'Включить напоминание'} aria-expanded={picker === 'reminder'} aria-controls={picker === 'reminder' ? id : undefined} onClick={() => open('reminder')}>{dueAt ? <Bell size={16} /> : <BellOff size={16} />}<span>{reminderLabel}</span></button>
    </div>
    <span className="visually-hidden" aria-live="polite">{plannedDate ? `Дело на ${dayLabel(plannedDate)}.` : 'Запись без даты.'} {dueAt ? `Напоминание: ${reminderLabel}.` : 'Без напоминания.'}</span>
    {picker && <div id={id} ref={panel} role="group" aria-label={picker === 'date' ? 'Выбрать дату' : 'Настроить напоминание'} className="capture-picker" style={position} onKeyDown={event => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); onClosePicker() }
    }}>
      {picker === 'date' ? <CaptureCalendar selected={plannedDate} onSelect={day => { onDay(day); onClosePicker() }} /> : <>
        <h3>Напомнить</h3>
        <div className="capture-reminder-fields">
          <label>Дата<input type="date" aria-label="Дата напоминания" min={localDate(new Date())!} value={reminderDay} onInput={event => updateReminder(event.currentTarget.value, reminderTime)} onChange={event => updateReminder(event.target.value, reminderTime)} /></label>
          <label>Время<input type="time" aria-label="Время напоминания" data-picker-focus value={reminderTime} onInput={event => updateReminder(reminderDay, event.currentTarget.value)} onChange={event => updateReminder(reminderDay, event.target.value)} /></label>
        </div>
        <div className="capture-time-presets" aria-label="Быстро выбрать время">
          {['09:00', '12:00', '18:00'].map(time => <button key={time} disabled={!reminderDay || new Date(`${reminderDay}T${time}`).getTime() <= Date.now()} onClick={() => { updateReminder(reminderDay, time); onClosePicker() }}>{time}</button>)}
          {(!plannedDate || plannedDate === localDate(new Date())) && <button onClick={() => { onReminder(toLocalInput(new Date(Date.now() + 60 * 60_000).toISOString())); onClosePicker() }}>Через час</button>}
        </div>
        {dueAt && <button className="capture-picker-clear" onClick={() => { onReminder(''); onClosePicker() }}><BellOff size={15} />Отключить напоминание</button>}
      </>}
    </div>}
  </div>
}

function CaptureCalendar({ selected, onSelect }: { selected: string | null; onSelect: (day: string | null) => void }) {
  const today = localDate(new Date())!
  const [cursor, setCursor] = useState(selected || today)
  const focused = new Date(`${cursor}T12:00:00`)
  const month = new Date(focused.getFullYear(), focused.getMonth(), 1, 12)
  const gridStart = new Date(month)
  gridStart.setDate(1 - (month.getDay() + 6) % 7)
  const count = Math.ceil(((month.getDay() + 6) % 7 + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7
  const days = Array.from({ length: count }, (_, index) => { const day = new Date(gridStart); day.setDate(gridStart.getDate() + index); return day })
  const gridRef = useRef<HTMLDivElement>(null)
  const monthId = useId()
  const focusAfterMove = useRef(false)

  useLayoutEffect(() => {
    if (focusAfterMove.current) { gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus(); focusAfterMove.current = false }
  }, [cursor])

  function moveMonth(offset: number) {
    const next = new Date(month)
    next.setMonth(month.getMonth() + offset)
    next.setDate(Math.min(focused.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
    setCursor(localDate(next)!)
  }

  return <>
    <div className="capture-calendar-heading">
      <button aria-label="Предыдущий месяц" onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button>
      <h3 id={monthId} aria-live="polite">{month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')}</h3>
      <button aria-label="Следующий месяц" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button>
    </div>
    <div className="capture-weekdays" aria-hidden="true">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <span key={day}>{day}</span>)}</div>
    <div className="capture-calendar-days" ref={gridRef} role="group" aria-labelledby={monthId} onKeyDown={event => {
      if (!(event.target instanceof HTMLButtonElement) || !event.target.dataset.day) return
      const day = new Date(`${event.target.dataset.day}T12:00:00`)
      const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -(day.getDay() + 6) % 7, End: 6 - (day.getDay() + 6) % 7 }
      if (event.key in offsets) day.setDate(day.getDate() + offsets[event.key])
      else if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); focusAfterMove.current = true; moveMonth(event.key === 'PageUp' ? -1 : 1); return }
      else return
      event.preventDefault()
      focusAfterMove.current = true
      setCursor(localDate(day)!)
    }}>
      {days.map(date => { const day = localDate(date)!; return <button key={day} data-day={day} data-picker-focus={day === cursor ? '' : undefined} tabIndex={day === cursor ? 0 : -1} aria-label={date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })} aria-pressed={day === selected} aria-current={day === today ? 'date' : undefined} className={date.getMonth() !== month.getMonth() ? 'other-month' : ''} onFocus={() => { if (date.getMonth() === month.getMonth()) setCursor(day) }} onClick={() => onSelect(day)}>{date.getDate()}</button> })}
    </div>
    <button className="capture-picker-clear" onClick={() => onSelect(null)}><CalendarDays size={15} />Без даты</button>
  </>
}
