import { useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { AppState, CalendarEvent, Reminder } from '../types'
import { localDate } from '../../shared/state'
import { realEvents, remindersForDay } from '../dayModel'
import { layoutIntervals } from './layout'
import { calendarDates, HOUR_HEIGHT, rescheduleCalendarTask, slotTime, type CalendarMode } from './model'
import './calendar.css'

export function eventInDay(event: CalendarEvent, date: Date) {
  if (event.allDay && event.startDate) return event.endDate ? event.startDate <= localDate(date)! && event.endDate > localDate(date)! : event.startDate === localDate(date)
  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return Date.parse(event.startAt) < end.getTime() && Date.parse(event.endAt) > start.getTime()
}

interface Props {
  state: AppState
  date: Date
  mode: CalendarMode
  onModeChange: (mode: CalendarMode) => void
  onChange: (update: (state: AppState) => AppState) => void
  onOpenEvent: (event: CalendarEvent) => void
  onOpenTask: (task: Reminder) => void
  onCreate: (date: Date, timed: boolean) => void
  onRange?: (date: Date) => void
  onSelectDate?: (date: Date) => void
}
const dayLabel = (day: Date) => day.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
const clock = (iso: string | Date) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

export function CalendarView({ state, date, mode, onModeChange, onChange, onOpenEvent, onOpenTask, onCreate, onRange, onSelectDate }: Props) {
  const [reference, setReference] = useState(() => new Date(date))
  const scroller = useRef<HTMLDivElement>(null)
  const dates = calendarDates(reference, mode)
  const today = new Date()
  const todayKey = localDate(today)
  const referenceKey = localDate(reference)
  const events = realEvents(state)
  useLayoutEffect(() => {
    if (!scroller.current || mode === 'month') return
    const range = calendarDates(reference, mode)
    const containsToday = range.some(day => localDate(day) === localDate(new Date()))
    const hour = containsToday ? Math.max(0, new Date().getHours() - 1) : 8
    scroller.current.scrollTop = Math.max(0, hour * HOUR_HEIGHT - 10)
    const column = scroller.current.querySelectorAll<HTMLElement>('.calendar-time-day')[range.findIndex(day => localDate(day) === referenceKey)]
    scroller.current.scrollLeft = column && scroller.current.scrollWidth > scroller.current.clientWidth ? Math.max(0, column.getBoundingClientRect().left - scroller.current.getBoundingClientRect().left + scroller.current.scrollLeft - 56) : 0
  }, [mode, referenceKey])
  function navigate(target: Date) { setReference(target); onRange?.(target) }
  function move(amount: number) {
    const target = new Date(reference)
    if (mode === 'month') { target.setDate(1); target.setMonth(target.getMonth() + amount) }
    else target.setDate(target.getDate() + amount * (mode === 'week' ? 7 : 1))
    navigate(target)
    if (mode === 'day') onSelectDate?.(target)
  }
  function selectDay(day: Date) { navigate(day); onModeChange('day'); onSelectDate?.(day) }
  function drop(event: DragEvent, target: Date, timed = false) {
    event.preventDefault()
    const id = event.dataTransfer.getData('application/x-dom-task')
    if (!state.reminders.some(task => task.id === id)) return
    onChange(previous => ({ ...previous, reminders: previous.reminders.map(task => task.id === id ? rescheduleCalendarTask(task, target, timed) : task) }))
  }
  function drag(event: DragEvent, task: Reminder) { event.dataTransfer.setData('application/x-dom-task', task.id) }
  const taskChip = (task: Reminder) => <button key={task.id} className="calendar-task" draggable onDragStart={event => drag(event, task)} onClick={() => onOpenTask(task)} title={task.title}><span className="calendar-chip-dot" /><span>{task.title}</span></button>
  const eventChip = (event: CalendarEvent) => <button key={event.id} className="calendar-event-chip" onClick={() => onOpenEvent(event)} title={event.title}><span className="calendar-chip-dot" /><span>{event.title}</span></button>
  function monthDate(day: Date) {
    const dayEvents = events.filter(event => eventInDay(event, day))
    const tasks = remindersForDay(state, day)
    const entries = [...dayEvents.map(event => ({ id: event.id, time: event.allDay ? '' : event.startAt, chip: eventChip(event) })), ...tasks.map(task => ({ id: task.id, time: task.dueAt || '', chip: taskChip(task) }))].sort((a, b) => a.time.localeCompare(b.time))
    return <div className={`calendar-date${day.getMonth() !== reference.getMonth() ? ' outside-month' : ''}`} key={localDate(day)} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, day)}>
      <button className="calendar-cell-add" aria-label={`Добавить дело: ${dayLabel(day)}`} onClick={() => onCreate(day, false)}><Plus size={17} /></button>
      <button className="calendar-date-number" aria-label={`Открыть день: ${dayLabel(day)}`} aria-current={localDate(day) === todayKey ? 'date' : undefined} onClick={() => selectDay(day)}>{day.getDate()}</button>
      <div className="calendar-date-items">{entries.slice(0, 2).map(entry => entry.chip)}{entries.length > 2 && <button className="calendar-more" onClick={() => selectDay(day)} aria-label={`Все дела: ${dayLabel(day)}, ${entries.length}`}>+{entries.length - 2}</button>}</div>
    </div>
  }
  function intervals(day: Date) {
    const scheduledEvents = events.filter(event => !event.allDay && eventInDay(event, day)).map(event => ({ ...event, event, task: undefined as Reminder | undefined }))
    const tasks = remindersForDay(state, day).filter(task => task.dueAt && localDate(new Date(task.dueAt)) === localDate(day)).map(task => ({ id: task.id, title: task.title, startAt: task.dueAt!, endAt: new Date(Date.parse(task.dueAt!) + 30 * 60000).toISOString(), event: undefined, task }))
    return layoutIntervals([...scheduledEvents, ...tasks], day).map(({ item, from, to, column, columns }) => <button className={`calendar-interval${item.task ? ' task-interval' : ''}`} key={item.id} style={{ top: from / 60 * HOUR_HEIGHT, height: Math.max(22, (to - from) / 60 * HOUR_HEIGHT), left: `calc(${column / columns * 100}% + 4px)`, width: `calc(${100 / columns}% - 8px)` }} draggable={Boolean(item.task)} onDragStart={event => { if (item.task) drag(event, item.task) }} onClick={() => item.event ? onOpenEvent(item.event) : onOpenTask(item.task!)} title={`${clock(item.startAt)} · ${item.title}`}><strong>{item.title}</strong><time>{clock(item.startAt)}</time></button>)
  }
  const end = dates[dates.length - 1]
  const title = mode === 'month' ? reference.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : mode === 'day' ? reference.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : `${dates[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const hasAllDay = dates.some(day => events.some(event => event.allDay && eventInDay(event, day)) || remindersForDay(state, day).some(task => !task.dueAt || localDate(new Date(task.dueAt)) !== localDate(day)))
  return <div className={`calendar-view ${mode}`} style={{ '--calendar-days': dates.length, '--calendar-hour': `${HOUR_HEIGHT}px` } as CSSProperties}>
    <div className="calendar-toolbar"><div className="calendar-navigation"><button onClick={() => move(-1)} aria-label="Предыдущий период"><ChevronLeft size={19} /></button><button onClick={() => move(1)} aria-label="Следующий период"><ChevronRight size={19} /></button><strong>{title.charAt(0).toUpperCase() + title.slice(1)}</strong></div><button className="calendar-today" onClick={() => { const target = new Date(); navigate(target); onSelectDate?.(target) }}>Сегодня</button><div className="calendar-modes" role="group" aria-label="Вид календаря">{([['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']] as const).map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => onModeChange(value)}>{label}</button>)}</div></div>
    {mode === 'month' ? <><div className="calendar-days">{['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-month" style={{ '--calendar-weeks': dates.length / 7 } as CSSProperties}>{dates.map(monthDate)}</div></> : <div className="calendar-timeline-scroll" ref={scroller}><div className="calendar-timeline">
      <div className="calendar-day-headings"><span className="calendar-axis-cell" />{dates.map(day => <button key={localDate(day)} className="calendar-day-heading" aria-label={`Открыть день: ${dayLabel(day)}`} onClick={() => selectDay(day)}><span>{day.toLocaleDateString('ru-RU', { weekday: mode === 'day' ? 'long' : 'short' })}</span><strong aria-current={localDate(day) === todayKey ? 'date' : undefined}>{day.getDate()}</strong></button>)}</div>
      {hasAllDay && <div className="calendar-all-day"><span className="calendar-axis-cell">Без времени</span>{dates.map(day => <div className="calendar-untimed-day" key={localDate(day)} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, day)}>{events.filter(event => event.allDay && eventInDay(event, day)).map(eventChip)}{remindersForDay(state, day).filter(task => !task.dueAt || localDate(new Date(task.dueAt)) !== localDate(day)).map(taskChip)}<button className="calendar-untimed-add" aria-label={`Добавить дело без времени: ${dayLabel(day)}`} onClick={() => onCreate(day, false)}><Plus size={15} /></button></div>)}</div>}
      <div className="calendar-time-grid"><div className="calendar-time-axis">{Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ top: hour * HOUR_HEIGHT }}>{String(hour).padStart(2, '0')}:00</span>)}</div>{dates.map(day => <div key={localDate(day)} className="calendar-time-day">{Array.from({ length: 48 }, (_, slot) => { const time = slotTime(day, slot); return <button className="calendar-time-slot" key={slot} style={{ top: slot * HOUR_HEIGHT / 2 }} aria-label={`Добавить дело: ${dayLabel(day)}, ${clock(time)}`} onClick={() => onCreate(time, true)} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, time, true)}><span>{clock(time)}<Plus size={14} /></span></button> })}{intervals(day)}{localDate(day) === todayKey && <div className="calendar-now-line" style={{ top: (today.getHours() + today.getMinutes() / 60) * HOUR_HEIGHT }} aria-hidden="true"><i /></div>}</div>)}</div>
    </div></div>}
  </div>
}
