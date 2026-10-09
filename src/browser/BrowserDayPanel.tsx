import { useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, Mail, Pin, Plus, Sparkles, Timer, X } from 'lucide-react'
import type { AppState, Resource } from '../types'
import type { ZenTimerState } from '../focus/zenTimer'
import { eventTime, type BrowserDayModel } from './browserDayModel'

export interface BrowserDayPanelProps {
  state: AppState
  model: BrowserDayModel
  now: Date
  focus: ZenTimerState
  pinned: boolean
  onPin: () => void
  onClose: () => void
  onHome: () => void
  onCalendar: () => void
  onFocus: () => void
  onCapture: () => void
  onAssistant: () => void
  onOpen: (resource: Resource) => unknown
  onSpace: (id: string) => void
  onComplete: (id: string) => Promise<boolean>
  onAddTask: (title: string) => Promise<boolean>
}

export function BrowserDayPanel({ state, model, now, focus, pinned, onPin, onClose, onHome, onCalendar, onFocus, onCapture, onAssistant, onOpen, onSpace, onComplete, onAddTask }: BrowserDayPanelProps) {
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  async function save(id: string, action: () => Promise<boolean>, complete?: () => void) {
    if (inFlight.current) return
    inFlight.current = true; setPending(id); setError('')
    try { if (await action()) complete?.(); else setError('Не удалось сохранить. Попробуйте ещё раз.') }
    catch { setError('Не удалось сохранить. Попробуйте ещё раз.') }
    finally { inFlight.current = false; setPending(null) }
  }
  const mail = model.attention?.type === 'mail' ? state.mailMessages?.find(item => item.id === model.attention!.targetId) : undefined
  const urgentTask = model.attention?.type === 'task' ? state.reminders.find(item => item.id === model.attention!.targetId) : undefined
  const displayedTasks = urgentTask && !model.tasks.some(item => item.id === urgentTask.id) ? [urgentTask, ...model.tasks] : model.tasks
  return <aside className="browser-day-panel" id="browser-day-panel" aria-label="Мой день" onKeyDown={event => { if (event.key === 'Escape' && !pinned) { event.stopPropagation(); onClose() } }}>
    <div className="browser-day-heading"><div><h2>Мой день</h2><p>{now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><button className={pinned ? 'is-selected' : ''} onClick={onPin} aria-pressed={pinned} aria-label={pinned ? 'Открепить панель дня' : 'Закрепить панель дня'} title={pinned ? 'Панель будет открыта при возврате в браузинг' : 'Закрепить панель дня'}><Pin size={17} /></button><button onClick={onClose} aria-label="Закрыть панель дня"><X size={18} /></button></div>
    <div className="browser-day-scroll">
      <section className="browser-day-events" aria-label="События сегодня"><div className="browser-day-section-heading"><h3>Ближайшее</h3><button onClick={onCalendar}>Календарь <ArrowUpRight size={13} /></button></div>
        {model.events.length ? model.events.slice(0, 3).map(event => {
          const space = state.spaces.find(item => item.id === event.spaceId && !item.archivedAt)
          return <article className="browser-day-event" key={event.id}><div className="browser-day-event-time"><Clock3 size={14} /><time dateTime={event.startAt}>{eventTime(event, now)}</time></div><h4>{event.title}</h4>{(space || event.location) && <p>{space?.name || event.location}</p>}<div className="browser-day-event-actions">{event.meetingUrl && <button onClick={() => onOpen({ id: event.id, name: event.title, kind: 'link', target: event.meetingUrl!, createdAt: now.toISOString() })}>Войти во встречу <ArrowUpRight size={15} /></button>}{space && <button onClick={() => onSpace(space.id)}>Материалы <ArrowRight size={15} /></button>}{!space && !event.meetingUrl && <button onClick={onCalendar}>Открыть календарь <ArrowRight size={15} /></button>}</div></article>
        }) : <div className="browser-day-empty"><CalendarDays size={21} /><span>Больше нет событий на сегодня</span></div>}
        {model.events.length > 3 && <button className="browser-day-more" onClick={onCalendar}>Все события · {model.events.length} <ArrowRight size={14} /></button>}
        {model.calendarErrors.length > 0 && <p className="browser-day-warning">Не обновился календарь: {model.calendarErrors.map(source => source.name).join(', ')}. Показаны сохранённые события.</p>}
      </section>
      <section className="browser-day-tasks" aria-label="Дела на сегодня"><div className="browser-day-section-heading"><h3>Сегодня</h3><span>{model.tasks.length ? `${model.tasks.length} осталось` : 'Свободный день'}</span></div>
        {displayedTasks.length ? displayedTasks.slice(0, 5).map(task => <div className="browser-day-task" key={task.id}><button className="browser-task-check" disabled={Boolean(pending)} onClick={() => void save(task.id, () => onComplete(task.id))} aria-label={`Завершить дело: ${task.title}`}><Check size={14} /></button><div><strong>{task.title}</strong><small>{task.dueAt && <time dateTime={task.dueAt}>{new Date(task.dueAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · </time>}{state.spaces.find(space => space.id === task.spaceId)?.name || 'Мой день'}</small></div></div>) : <p className="browser-day-empty-text">Можно выбрать одно дело или оставить время свободным.</p>}
        {displayedTasks.length > 5 && <button className="browser-day-more" onClick={onHome}>Все дела · {displayedTasks.length} <ArrowRight size={14} /></button>}
        {model.overdue.length > 0 && <button className="browser-day-earlier" onClick={onHome}>С прошлых дней · {model.overdue.length}<ArrowUpRight size={14} /></button>}
      </section>
      {mail && <button className="browser-day-mail" onClick={() => onOpen({ id: mail.id, name: mail.subject, kind: 'link', target: mail.url, createdAt: now.toISOString() })}><Mail size={18} /><span><small>Важное письмо</small><strong>{mail.subject}</strong></span><ArrowUpRight size={15} /></button>}
      <button className={`browser-day-focus ${focus.status === 'running' ? 'is-active' : ''}`} onClick={onFocus}><Timer size={20} /><span><strong>{focus.status === 'running' ? `Фокус · ${Math.ceil(focus.remainingSeconds / 60)} мин` : focus.status === 'completed' ? 'Фокус завершён' : 'Сосредоточиться'}</strong><small>{focus.task?.title || (focus.status === 'completed' ? 'Можно сделать перерыв' : 'Выберите одно дело')}</small></span><ArrowRight size={16} /></button>
      <form className="browser-day-capture" onSubmit={event => { event.preventDefault(); const title = draft.trim(); if (title) void save('capture', () => onAddTask(title), () => setDraft('')) }}><label htmlFor="browser-day-task">Добавить дело на сегодня</label><div><input id="browser-day-task" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Что нужно сделать?" maxLength={500} disabled={pending === 'capture'} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }} /><button type="submit" disabled={!draft.trim() || Boolean(pending)} aria-label="Добавить дело на сегодня"><Plus size={18} /></button></div></form>
      {error && <p className="browser-day-warning" role="alert">{error}</p>}
      <div className="browser-day-quick"><button onClick={onCapture}>Записать мысль</button><button onClick={onAssistant}><Sparkles size={15} />Спросить ИИ</button></div>
    </div>
    <button className="browser-day-dashboard" onClick={onHome}>Открыть дашборд <ArrowUpRight size={17} /></button>
  </aside>
}
