import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AppState, CalendarEvent, Reminder } from '../types'
import { localDate } from '../../shared/state'
import { remindersForDay } from '../dayModel'
import './calendar.css'
import { layoutIntervals } from './layout'

export function eventInDay(event: CalendarEvent, date: Date) {
  if (event.allDay && event.startDate) return event.endDate ? event.startDate <= localDate(date)! && event.endDate > localDate(date)! : event.startDate === localDate(date)
  const start = new Date(date); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return Date.parse(event.startAt) < end.getTime() && Date.parse(event.endAt) > start.getTime()
}

export function CalendarView({ state, date, mode, onChange, onOpenEvent, onRange, onSelectDate }: { state: AppState; date: Date; mode: 'week' | 'month'; onChange: (update: (state: AppState) => AppState) => void; onOpenEvent: (event: CalendarEvent) => void; onRange?: (date: Date) => void; onSelectDate?: (date: Date) => void }) {
  const [offset, setOffset] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const reference = new Date(date)
  if (mode === 'month') { reference.setDate(1); reference.setMonth(reference.getMonth() + offset) }
  else reference.setDate(reference.getDate() + offset * 7)
  const first = new Date(reference)
  if (mode === 'month') first.setDate(1)
  first.setDate(first.getDate() - (first.getDay() + 6) % 7)
  first.setHours(0, 0, 0, 0)
  const dates = Array.from({ length: mode === 'month' ? 42 : 7 }, (_, index) => { const value = new Date(first); value.setDate(first.getDate() + index); return value })
  useEffect(() => { if (scroller.current && mode === 'week') scroller.current.scrollTop = 7 * 24 }, [mode])
  const move = (amount: number) => { const target = new Date(date); if (mode === 'month') { target.setDate(1); target.setMonth(target.getMonth() + offset + amount) } else target.setDate(target.getDate() + (offset + amount) * 7); setOffset(offset + amount); onRange?.(target) }
  function drop(event: React.DragEvent, target: Date, timed = false) {
    event.preventDefault()
    const id = event.dataTransfer.getData('application/x-dom-task')
    const task = state.reminders.find(item => item.id === id)
    if (!task) return
    const day = localDate(target)
    if (!timed) { onChange(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === id ? { ...item, plannedDate: day, kind: 'task' } : item) })); return }
    const minutes = Math.max(0, Math.min(1410, Math.round((event.clientY - event.currentTarget.getBoundingClientRect().top) / 24 * 2) * 30))
    const due = new Date(target); due.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
    if (window.confirm(`Запланировать «${task.title}» и напомнить ${due.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}?`)) onChange(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === id ? { ...item, plannedDate: day, dueAt: due.toISOString(), kind: 'task', notifiedAt: undefined } : item) }))
  }
  const taskChip = (task: Reminder) => <button key={task.id} className="calendar-task" draggable onDragStart={event => event.dataTransfer.setData('application/x-dom-task', task.id)} onClick={() => onSelectDate?.(new Date(`${task.plannedDate}T12:00:00`))}>{task.title}</button>
  function monthDate(day: Date) {
    const events = (state.events || []).filter(item => eventInDay(item, day))
    const tasks = remindersForDay(state, day)
    const hidden = Math.max(0, events.length - 2) + Math.max(0, tasks.length - 2)
    return <div className={`calendar-date ${day.getMonth() !== reference.getMonth() ? 'outside-month' : ''}`} key={day.toISOString()} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, day)}>
      <button className="calendar-date-number" aria-label={day.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} aria-current={localDate(day) === localDate(new Date()) ? 'date' : undefined} onClick={() => onSelectDate?.(day)}>{day.getDate()}</button>
      {events.slice(0, 2).map(item => <button className="calendar-event-chip" key={item.id} onClick={() => onOpenEvent(item)}>{item.title}</button>)}
      {tasks.slice(0, 2).map(taskChip)}
      {hidden > 0 && <button className="calendar-more" onClick={() => onSelectDate?.(day)}>Ещё {hidden}</button>}
    </div>
  }
  function intervals(day: Date) {
    const events = (state.events || []).filter(item => !item.allDay && eventInDay(item, day)).map(item => ({ ...item, event: item, task: undefined as Reminder | undefined }))
    const tasks = remindersForDay(state, day).filter(item => item.dueAt && new Date(item.dueAt).toDateString() === day.toDateString()).map(item => ({ id: item.id, title: item.title, startAt: item.dueAt!, endAt: new Date(Date.parse(item.dueAt!) + 30 * 60000).toISOString(), event: undefined, task: item }))
    return layoutIntervals([...events, ...tasks], day).map(({ item, from, to, column, columns }) => <button className={`calendar-interval ${item.task ? 'task-interval' : ''}`} key={item.id} style={{ top: from / 60 * 24, height: Math.max(22, (to - from) / 60 * 24), left: `calc(${column / columns * 100}% + 1px)`, width: `calc(${100 / columns}% - 2px)`, right: 'auto' }} draggable={Boolean(item.task)} onDragStart={event => { if (item.task) event.dataTransfer.setData('application/x-dom-task', item.id) }} onClick={() => item.event ? onOpenEvent(item.event) : onSelectDate?.(day)} title={item.title}>{new Date(item.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} {item.title}</button>)
  }
  return <div className={`calendar-view ${mode}`}><div className="calendar-navigation"><button onClick={() => move(-1)} aria-label="Предыдущий период"><ChevronLeft size={17} /></button><strong>{reference.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</strong><button onClick={() => move(1)} aria-label="Следующий период"><ChevronRight size={17} /></button><button onClick={() => { setOffset(0); onRange?.(date) }}>Сегодня</button></div>
    <div className="calendar-days">{dates.slice(0, 7).map(day => <span key={day.toISOString()}>{day.toLocaleDateString('ru-RU', { weekday: 'short' })}</span>)}</div>
    {mode === 'month' ? <div className="calendar-month">{dates.map(monthDate)}</div>
    : <><div className="calendar-all-day">{dates.map(day => <div key={day.toISOString()} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, day)}><strong>{day.getDate()}</strong>{(state.events || []).filter(item => item.allDay && eventInDay(item, day)).map(item => <button className="calendar-event-chip" key={item.id} onClick={() => onOpenEvent(item)}>{item.title}</button>)}{remindersForDay(state, day).filter(item => !item.dueAt).map(taskChip)}</div>)}</div><div className="calendar-scroll" ref={scroller}><div className="calendar-time-axis">{Array.from({ length: 24 }, (_, hour) => <span key={hour}>{String(hour).padStart(2, '0')}</span>)}</div><div className="calendar-week">{dates.map(day => <div key={day.toISOString()} className="calendar-time-day" onDragOver={event => event.preventDefault()} onDrop={event => drop(event, day, true)}>{intervals(day)}</div>)}</div></div></>}
  </div>
}
