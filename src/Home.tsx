import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, FileText, Pencil, Plus, Timer, Video } from 'lucide-react'
import type { AppState, AIContext, CalendarEvent, Reminder, Resource, WidgetType } from './types'
import { formatDue, fromLocalInput, toLocalInput } from './reminders'
import { isRealReminder, postponeReminder, realEvents, remindersForDay } from './dayModel'
import './home.css'
import { Dialog } from './Dialog'
import { QuickEntry } from './QuickEntry'
import { ActionMenu } from './ActionMenu'
import { latestContinuation } from './workContexts'
import { ResumeCard } from './ResumeCard'
import type { ResumeResult } from './resumeContext'
import { localDate } from '../shared/state'
import { dashboardWidgets, defaultWidgets } from './dashboard'
import { CalendarView, eventInDay } from './calendar/CalendarView'
import type { CalendarMode } from './calendar/model'
import { zenTimer } from './focus/zenTimer'
import './dashboard.css'
import { MailWidget, NewsWidget } from './FeedWidgets'

interface Props {
  viewportWidth: number
  viewportHeight: number
  calendarRequested?: boolean
  onCalendarHandled?: () => void
  initialReminderId?: string
  onSearchHandled: () => void
  state: AppState
  now: Date
  onChange: (update: (state: AppState) => AppState) => void
  onCapture: () => void
  onFocus: (taskId?: string) => void
  onPlan: (dayOffset: number) => void
  onCreateAt: (date: Date, timed: boolean) => void
  onSpace: (id: string) => void
  onOpen: (resource: Resource) => void
  onAddLink: () => void
  onAssistant: (draft?: string, contexts?: AIContext[]) => void
  onSaveThought: (title: string, dueAt: string | null, plannedDate?: string | null, kind?: 'note' | 'task') => unknown
  onOpenWorkstage?: (spaceId: string, artifactId?: string) => void
  onResume: (spaceId: string, contextId: string, retry?: boolean) => void
  onOpenContext: (spaceId: string, contextId: string) => void
  onEditContext: (spaceId: string, contextId: string) => void
  onCompleteContext: (spaceId: string, contextId: string) => void
  onOpenDocument: (resource: Resource, contextId: string) => void
  resumeStatus?: { spaceId: string; contextId: string; pending: boolean; result?: ResumeResult } | null
  onImport: () => void
  onNewTab: () => void
  onSettings: () => void
  onNewsRefresh?: () => unknown
  newsRefreshing?: boolean
  onCalendarRange: (date: Date) => void
}

export function Home({ viewportWidth, viewportHeight, calendarRequested, onCalendarHandled, initialReminderId, onSearchHandled, state, now, onChange, onCapture, onFocus, onPlan, onCreateAt, onSpace, onOpen, onAddLink, onOpenWorkstage, onAssistant, onSaveThought, onImport, onNewTab, onSettings, onNewsRefresh, newsRefreshing, onCalendarRange, onResume, onOpenContext, onEditContext, onCompleteContext, onOpenDocument, resumeStatus }: Props) {
  const [day, setDay] = useState(0)
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null)
  useEffect(() => { if (!undo) return; const timer = window.setTimeout(() => setUndo(null), 8000); return () => window.clearTimeout(timer) }, [undo])
  const [dialog, setDialog] = useState<'digest' | 'reminder' | 'event' | 'today' | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('day')
  useEffect(() => { if (calendarRequested) { setDay(0); setCalendarMode('day'); setCalendarOpen(true); onCalendarHandled?.() } }, [calendarRequested, onCalendarHandled])
  const [eventId, setEventId] = useState('')
  const [reminderDay, setReminderDay] = useState('')
  const [reminderDeadline, setReminderDeadline] = useState('')
  const [focus, setFocus] = useState(zenTimer.getState())
  useEffect(() => zenTimer.subscribe(setFocus), [])
  const widgets = dashboardWidgets(state.dashboard?.widgets)
  const [widgetPage, setWidgetPage] = useState(0)
  const narrow = viewportWidth < 760
  const standardLayout = !narrow && viewportHeight >= 340 && widgets.length >= 3 && defaultWidgets.every((widget, index) => widget.type === widgets[index].type && widget.size === widgets[index].size)
  const visible = (type: WidgetType) => widgetPages[visibleWidgetPage].includes(type)
  const widgetStyle = (type: WidgetType): CSSProperties => {
    const widget = widgets.find(item => item.type === type)
    const columns = narrow ? 6 : widget?.size === 'S' ? 2 : widget?.size === 'L' ? 6 : 3
    return { order: widgets.findIndex(item => item.type === type), '--widget-span': columns } as CSSProperties
  }
  const [digestTab, setDigestTab] = useState<'notes' | 'reading' | 'events'>('notes')
  const [page, setPage] = useState(0)
  const [reminderId, setReminderId] = useState('')
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderWhen, setReminderWhen] = useState('')
  useEffect(() => { const reminder = state.reminders.find(item => item.id === initialReminderId); if (reminder) editReminder(reminder); if (initialReminderId) onSearchHandled() }, [initialReminderId])

  const resources = state.spaces.flatMap(space => space.resources.map(resource => ({ ...resource, spaceId: space.id })))
  const continuation = latestContinuation(state)
  const hasResume = Boolean(continuation)
  const isAvailable = (type: WidgetType) => type !== 'resume' || hasResume
  const widgetPages: WidgetType[][] = standardLayout ? [widgets.slice(0, 3).filter(widget => isAvailable(widget.type)).map(widget => widget.type)] : []
  let row: WidgetType[] = [], usedColumns = 0
  for (const widget of widgets.slice(standardLayout ? 3 : 0).filter(widget => isAvailable(widget.type))) {
    const columns = narrow ? 6 : widget.size === 'S' ? 2 : widget.size === 'L' ? 6 : 3
    if (usedColumns + columns > 6) { widgetPages.push(row); row = []; usedColumns = 0 }
    row.push(widget.type)
    usedColumns += columns
  }
  if (row.length) widgetPages.push(row)
  if (!widgetPages.length) widgetPages.push([])
  const visibleWidgetPage = Math.min(widgetPage, widgetPages.length - 1)
  const isStandardPage = standardLayout && visibleWidgetPage === 0
  const selectedDay = new Date(now)
  selectedDay.setDate(selectedDay.getDate() + day)
  const plan = remindersForDay(state, selectedDay)
  const realReminders = state.reminders.filter(item => isRealReminder(item) && !item.done)
  const earlier = realReminders.filter(item => item.plannedDate && item.plannedDate < localDate(now)!)
  const links = resources.filter(resource => resource.kind === 'link' && !resource.completedAt && !/figma\.com\/(design|file)/i.test(resource.target))
  const events = realEvents(state).filter(event => Date.parse(event.endAt) >= now.getTime()).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
  const dayEvents = realEvents(state).filter(event => eventInDay(event, selectedDay))
  const schedule = [
    ...plan.map(item => ({ id: item.id, title: item.title, time: item.dueAt || '', reminder: item as Reminder | undefined, event: undefined })),
    ...dayEvents.map(event => ({ id: event.id, title: event.title, time: event.allDay ? '' : event.startAt, reminder: undefined, event }))
  ].sort((a, b) => (a.event?.allDay ? -Infinity : a.time ? Date.parse(a.time) : Infinity) - (b.event?.allDay ? -Infinity : b.time ? Date.parse(b.time) : Infinity))
  const selectedReminder = state.reminders.find(item => item.id === reminderId)
  const digestItems = digestTab === 'notes' ? realReminders : digestTab === 'reading' ? links : events
  const totalPages = Math.max(1, Math.ceil(digestItems.length / 4))
  const visiblePage = Math.min(page, totalPages - 1)

  function editReminder(item: Reminder) {
    setReminderId(item.id)
    setReminderTitle(item.title)
    setReminderWhen(toLocalInput(item.dueAt))
    setReminderDay(item.plannedDate || '')
    setReminderDeadline(item.deadline || '')
    setDialog('reminder')
  }

  function updateReminder(update: (item: Reminder) => Reminder) {
    onChange(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === reminderId ? update(item) : item) }))
    setDialog(null)
  }

  function changeTask(item: Reminder, patch: Partial<Reminder>, label: string) {
    const restore = Object.fromEntries(Object.keys(patch).map(key => [key, item[key as keyof Reminder]]))
    onChange(previous => ({ ...previous, reminders: previous.reminders.map(value => value.id === item.id ? { ...value, ...patch } : value) }))
    setUndo({ label, restore: () => onChange(previous => ({ ...previous, reminders: previous.reminders.map(value => value.id === item.id ? { ...value, ...restore } : value) })) })
  }

  function postponeTask(item: Reminder, choice: 'hour' | 'tomorrow') {
    const postponed = postponeReminder(item, choice)
    changeTask(item, { dueAt: postponed.dueAt, plannedDate: postponed.plannedDate, kind: 'task', notifiedAt: undefined }, choice === 'hour' ? 'Перенесено на час' : 'Перенесено на завтра')
  }

  function showDigest(tab: typeof digestTab = 'notes') { setDigestTab(tab); setPage(0); setDialog('digest') }
  function showEvent(event: CalendarEvent) { setEventId(event.id); setDialog('event') }
  const selectedEvent = state.events?.find(event => event.id === eventId)
  const pickDate = (date: Date) => { const midnight = new Date(now); midnight.setHours(0, 0, 0, 0); const chosen = new Date(date); chosen.setHours(0, 0, 0, 0); setDay(Math.round((chosen.getTime() - midnight.getTime()) / 86400000)) }
  function openCalendar(mode: CalendarMode) { setCalendarMode(mode); setCalendarOpen(true) }

  return <>
    <main className="calm-home dashboard-home" aria-label="Ваш день">
      {widgetPages.length > 1 && <div className="calm-heading"><nav className="widget-pagination" aria-label="Страницы виджетов"><button className="calm-icon" aria-label="Предыдущие виджеты" disabled={visibleWidgetPage === 0} onClick={() => setWidgetPage(visibleWidgetPage - 1)}><ChevronLeft size={17} /></button><span aria-live="polite">{visibleWidgetPage + 1} / {widgetPages.length}</span><button className="calm-icon" aria-label="Следующие виджеты" disabled={visibleWidgetPage === widgetPages.length - 1} onClick={() => setWidgetPage(visibleWidgetPage + 1)}><ChevronRight size={17} /></button></nav></div>}
      <div className={`calm-grid dashboard-grid ${isStandardPage ? `standard-grid ${!hasResume ? 'starter-grid' : ''}` : 'paged-grid'} ${narrow ? 'narrow-grid' : ''}`}>
        {continuation && <ResumeCard continuation={continuation} now={now} hidden={!visible('resume')} style={widgetStyle('resume')}
          pending={resumeStatus?.contextId === continuation.context.id && resumeStatus.pending}
          result={resumeStatus?.contextId === continuation.context.id ? resumeStatus.result : undefined}
          onResume={retry => onResume(continuation.space.id, continuation.context.id, retry)}
          onSpace={() => onSpace(continuation.space.id)} onEdit={() => onEditContext(continuation.space.id, continuation.context.id)} onComplete={() => onCompleteContext(continuation.space.id, continuation.context.id)}
          onDocument={document => onOpenDocument(document, continuation.context.id)} onTabs={() => onOpenContext(continuation.space.id, continuation.context.id)} />}


        <section className="calm-card plan-card" data-widget="day" hidden={!visible('day')} style={widgetStyle('day')} aria-label="План дня">
          <div className="calm-card-heading"><div className="calm-tabs" aria-label="День плана"><button aria-pressed={day === 0} className={day === 0 ? 'selected' : ''} onClick={() => setDay(0)}>Сегодня</button><button aria-pressed={day === 1} className={day === 1 ? 'selected' : ''} onClick={() => setDay(1)}>Завтра</button>{day !== 0 && day !== 1 && <button className="selected" onClick={() => openCalendar('day')}>{selectedDay.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</button>}</div><button className="calm-icon" aria-label="Добавить дело" title="Добавить дело" onClick={() => onPlan(day)}><Plus size={22} /></button></div>
          <div className="plan-view-switch" aria-label="Открыть календарь">{([['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']] as const).map(([mode, label]) => <button key={mode} aria-haspopup="dialog" onClick={() => openCalendar(mode)}>{label}</button>)}</div>
          <div className="calm-plan-list">
            {schedule.slice(0, 3).map(item => (
              <div key={item.id} className={`calm-plan-item task-row ${state.liveHints && item.reminder?.dueAt && Date.parse(item.reminder.dueAt) > now.getTime() && Date.parse(item.reminder.dueAt) - now.getTime() <= 5 * 60000 ? 'live-hint' : ''}`}>
                {item.reminder ? <button className="task-check" aria-label={`Завершить: ${item.title}`} title="Отметить сделанным" onClick={() => changeTask(item.reminder!, { done: true }, 'Дело завершено')}><Check size={14} /></button> : <span className="task-event-icon"><CalendarDays size={18} /></span>}
                <button className="plan-item-title" onClick={() => item.reminder ? editReminder(item.reminder) : showEvent(item.event!)}><span>{item.title}</span><time className="calm-time" dateTime={item.time || undefined}>{item.event?.allDay ? 'Весь день' : item.time ? new Date(item.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : 'Без времени'}{item.event ? ' · Событие' : ''}</time></button>
                {item.event?.meetingUrl ? (
                  <button
                    className="plan-meeting-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen({ id: item.id, name: item.title, kind: 'link', target: item.event!.meetingUrl!, createdAt: new Date().toISOString() })
                    }}
                    title={item.event.meetingUrl}
                  >
                    <Video size={13} />
                    <span>Войти</span>
                    <ArrowUpRight size={13} />
                  </button>
                ) : item.reminder ? <ActionMenu label={`Действия: ${item.title}`} actions={[
                  { label: focus.status === 'idle' ? 'Сосредоточиться' : 'К сессии фокуса', icon: <Timer size={16} />, onSelect: () => onFocus(item.id) },
                  { label: 'Завтра', icon: <CalendarDays size={16} />, onSelect: () => postponeTask(item.reminder!, 'tomorrow') },
                  { label: 'Через час', icon: <Clock3 size={16} />, onSelect: () => postponeTask(item.reminder!, 'hour') },
                  { label: 'Изменить', icon: <Pencil size={16} />, onSelect: () => editReminder(item.reminder!) }
                  , { label: 'Убрать из сегодняшнего', icon: <FileText size={16} />, onSelect: () => changeTask(item.reminder!, { plannedDate: null }, 'Убрано из сегодняшнего') }
                ]} /> : null}
              </div>
            ))}
            {!schedule.length && <div className="calm-plan-empty"><h2>На этот день нет дел</h2><button className="calm-text-button" onClick={() => onPlan(day)}>Добавить дело <Plus size={17} /></button></div>}
          </div>
          <div className="plan-bottom">{schedule.length > 3 && <button className="calm-text-button" onClick={() => setDialog('today')}>Все дела на этот день · {schedule.length}<ArrowRight size={16} /></button>}{earlier.length > 0 && <button className="calm-text-button" onClick={() => showDigest()}>Осталось с прошлых дней · {earlier.length}</button>}</div>
          <div className="plan-saved" aria-label="Сохранённое">
            <div className="plan-saved-heading"><span>Сохранённое</span></div>
            <div className="plan-saved-links">
              <button onClick={() => showDigest('notes')}><FileText size={16} /><span>Мысли и дела</span><small>{realReminders.length}</small></button>
              <button onClick={() => showDigest('reading')}><Bookmark size={16} /><span>Почитать</span><small>{links.length}</small></button>
              <button onClick={() => showDigest('events')}><Clock3 size={16} /><span>События</span><small>{events.length}</small></button>
            </div>
          </div>
        </section>

        <div className="quick-widget" data-widget="capture" hidden={!visible('capture')} style={widgetStyle('capture')}>{!hasResume && <div className="first-run-actions"><button onClick={onNewTab}>Открыть сайт</button><button onClick={onImport}>Перенести вкладки</button></div>}<QuickEntry onSave={onSaveThought} onAssistant={onAssistant} /></div>
        <section className="calm-card simple-widget" data-widget="spaces" hidden={!visible('spaces')} style={widgetStyle('spaces')}><h2>Пространства</h2>{state.spaces.filter(space => !space.archivedAt && space.kind !== 'web').slice(0, 5).map(space => <button className="widget-resource" key={space.id} onClick={() => onOpenWorkstage?.(space.id)}><span>{space.name}<small>{space.checkpoint?.nextStep || `Вкладок: ${space.activeSession?.tabs.length || 0}`}</small></span><ArrowRight size={17} /></button>)}</section>
        <section className="calm-card simple-widget" data-widget="mail" hidden={!visible('mail')} style={widgetStyle('mail')}><MailWidget state={state} widget={widgets.find(item => item.type === "mail")} onSettings={onSettings} onOpen={onOpen} onChange={onChange} onAssistant={onAssistant} /></section>
        <section className="calm-card news-card" data-widget="news" hidden={!visible('news')} style={widgetStyle('news')} aria-label="Дайджест новостей"><NewsWidget state={state} widget={widgets.find(item => item.type === "news")} onSettings={onSettings} onOpen={onOpen} onChange={onChange} onAssistant={onAssistant} onRefresh={onNewsRefresh} refreshing={newsRefreshing} /></section>
        <section className="calm-card simple-widget" data-widget="focus" hidden={!visible('focus')} style={widgetStyle('focus')}><h2>Фокус</h2>{focus.status === 'running' && <p>{focus.task?.title}{focus.task && <br />}Осталось {Math.ceil(focus.remainingSeconds / 60)} мин</p>}<button className="calm-primary" onClick={() => onFocus()}>{focus.status === 'running' ? 'Открыть таймер' : 'Выбрать дело'}</button></section>
      </div>
    </main>

    {calendarOpen && <Dialog className="planner-dialog" title="Календарь" onClose={() => setCalendarOpen(false)}><CalendarView state={state} date={selectedDay} mode={calendarMode} onModeChange={setCalendarMode} onChange={onChange} onOpenEvent={showEvent} onOpenTask={editReminder} onCreate={onCreateAt} onRange={onCalendarRange} onSelectDate={pickDate} /></Dialog>}
    {dialog === 'event' && selectedEvent && <Dialog title={selectedEvent.title} onClose={() => setDialog(null)}><p>{selectedEvent.allDay ? 'Весь день' : formatDue(selectedEvent.startAt)}</p>{selectedEvent.location && <p>{selectedEvent.location}</p>}{selectedEvent.meetingUrl && <button className="calm-primary" onClick={() => onOpen({ id: selectedEvent.id, name: selectedEvent.title, kind: 'link', target: selectedEvent.meetingUrl!, createdAt: now.toISOString() })}>Войти во встречу</button>}<div className="calm-form"><label>Напоминание<select value={selectedEvent.noticeMinutes || 0} onChange={event => onChange(previous => ({ ...previous, events: previous.events?.map(item => item.id === selectedEvent.id ? { ...item, noticeMinutes: Number(event.target.value) } : item) }))}><option value={0}>Не напоминать</option><option value={5}>За 5 минут</option><option value={10}>За 10 минут</option><option value={15}>За 15 минут</option></select></label><label>Материалы встречи<select value={selectedEvent.spaceId || ''} onChange={event => onChange(previous => ({ ...previous, events: previous.events?.map(item => item.id === selectedEvent.id ? { ...item, spaceId: event.target.value || undefined } : item) }))}><option value="">Выбрать пространство</option>{state.spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label></div>{selectedEvent.spaceId && <button className="calm-text-button" onClick={() => { setDialog(null); onOpenWorkstage?.(selectedEvent.spaceId!) }}>Открыть материалы встречи</button>}</Dialog>}

    {dialog === 'today' && <Dialog title={selectedDay.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} onClose={() => setDialog(null)}><div className="calm-digest-list">{schedule.map(item => <button key={item.id} onClick={() => item.reminder ? editReminder(item.reminder) : showEvent(item.event!)}><span><strong>{item.title}</strong><small>{item.time ? formatDue(item.time) : 'Без времени'}</small></span><ArrowRight size={16} /></button>)}</div></Dialog>}
    {dialog === 'reminder' && selectedReminder && <Dialog title="Дело и напоминание" onClose={() => setDialog(null)}>
      <div className="calm-form"><label>Название<input value={reminderTitle} onChange={event => setReminderTitle(event.target.value)} /></label><label>День выполнения<input type="date" value={reminderDay} onChange={event => setReminderDay(event.target.value)} /></label><label>Срок<input type="date" value={reminderDeadline} onChange={event => setReminderDeadline(event.target.value)} /></label><label>Напомнить<input type="datetime-local" value={reminderWhen} onChange={event => setReminderWhen(event.target.value)} /></label></div>
      <div className="calm-postpone"><button onClick={() => updateReminder(item => postponeReminder(item, 'hour'))}>Через час</button><button onClick={() => updateReminder(item => postponeReminder(item, 'tomorrow'))}>Завтра</button><button onClick={() => updateReminder(item => ({ ...item, dueAt: null, notifiedAt: undefined, trigger: undefined }))}>Без напоминания</button></div>
      <details className="calm-details"><summary>При событии или возвращении</summary><div className="calm-form"><label>Когда вернусь в пространство<select value="" onChange={event => { if (event.target.value) updateReminder(item => ({ ...item, dueAt: null, notifiedAt: undefined, trigger: { kind: 'return', spaceId: event.target.value, armedAt: new Date().toISOString() } })) }}><option value="">Выбрать пространство</option>{state.spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label><label>После встречи<select value="" onChange={event => { const meeting = state.events?.find(item => item.id === event.target.value); if (meeting) updateReminder(item => ({ ...item, dueAt: meeting.endAt, notifiedAt: undefined, trigger: { kind: 'event', eventId: meeting.id, offsetMinutes: 0 } })) }}><option value="">Выбрать событие</option>{events.filter(item => !item.allDay).map(event => <option key={event.id} value={event.id}>{event.title} · {formatDue(event.startAt)}</option>)}</select></label></div></details>
      {selectedReminder.sourceUrl && <button className="calm-text-button" onClick={() => onOpen({ id: selectedReminder.id, name: selectedReminder.title, kind: 'link', target: selectedReminder.sourceUrl!, createdAt: now.toISOString() })}>Открыть источник</button>}
      <div className="calm-dialog-actions"><button className="calm-text-button" onClick={() => { changeTask(selectedReminder, { done: true }, 'Дело завершено'); setDialog(null) }}><Check size={18} />Сделано</button><button className="calm-primary" disabled={!reminderTitle.trim()} onClick={() => updateReminder(item => ({ ...item, trigger: undefined, title: reminderTitle.trim(), plannedDate: reminderDay || null, deadline: reminderDeadline || null, kind: reminderDay || reminderWhen || reminderDeadline ? 'task' : 'note', dueAt: fromLocalInput(reminderWhen), notifiedAt: item.dueAt === fromLocalInput(reminderWhen) ? item.notifiedAt : undefined }))}>Сохранить</button></div>
    </Dialog>}

    {dialog === 'digest' && <Dialog title="Сохранённое" onClose={() => setDialog(null)}><div className="calm-tabs digest-tabs">{(['notes', 'reading', 'events'] as const).map(tab => <button key={tab} className={digestTab === tab ? 'selected' : ''} onClick={() => { setDigestTab(tab); setPage(0) }}>{tab === 'notes' ? 'Мысли и дела' : tab === 'reading' ? 'Почитать' : 'События'}</button>)}</div><div className="calm-digest-list">
      {digestTab === 'notes' && realReminders.slice(visiblePage * 4, visiblePage * 4 + 4).map(item => <button key={item.id} onClick={() => editReminder(item)}><span><strong>{item.title}</strong><small>{item.dueAt ? formatDue(item.dueAt) : 'Без срока'}</small></span><ArrowUpRight size={18} /></button>)}
      {digestTab === 'reading' && links.slice(visiblePage * 4, visiblePage * 4 + 4).map(item => <div className="calm-reading-row" key={item.id}><button onClick={() => onOpen(item)}><span><strong>{item.name}</strong><small>{state.spaces.find(space => space.id === item.spaceId)?.name}</small></span><ArrowUpRight size={18} /></button><button className="calm-icon" aria-label={`Прочитано: ${item.name}`} onClick={() => onChange(previous => ({ ...previous, spaces: previous.spaces.map(space => ({ ...space, resources: space.resources.map(resource => resource.id === item.id ? { ...resource, completedAt: new Date().toISOString() } : resource) })) }))}><Check size={18} /></button></div>)}
      {digestTab === 'events' && events.slice(visiblePage * 4, visiblePage * 4 + 4).map(event => <div className="calm-event-row" key={event.id}><strong>{event.title}</strong><small>{formatDue(event.startAt)}</small></div>)}
      {(digestTab === 'notes' ? realReminders.length : digestItems.length) === 0 && <p className="calm-digest-empty">{digestTab === 'notes' ? 'Нет записей' : digestTab === 'reading' ? 'Нет сохранённых ссылок' : 'Нет событий'}</p>}
    </div><div className="calm-dialog-actions"><div className="calm-pagination">{totalPages > 1 && <><button className="calm-icon" disabled={!visiblePage} onClick={() => setPage(visiblePage - 1)} aria-label="Назад"><ChevronLeft size={18} /></button><span>{visiblePage + 1} / {totalPages}</span><button className="calm-icon" disabled={visiblePage + 1 === totalPages} onClick={() => setPage(visiblePage + 1)} aria-label="Далее"><ChevronRight size={18} /></button></>}</div>{digestTab !== 'events' && <button className="calm-primary" onClick={() => { setDialog(null); digestTab === 'reading' ? onAddLink() : onCapture() }}><Plus size={18} />{digestTab === 'reading' ? 'Сохранить ссылку' : 'Записать'}</button>}</div></Dialog>}
    {undo && <div className="calm-undo" role="status"><span>{undo.label}</span><button onClick={() => { undo.restore(); setUndo(null) }}>Вернуть</button></div>}
  </>
}



