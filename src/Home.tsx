import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, FileText, Globe2, Moon, Pencil, Plus, SlidersHorizontal, Video } from 'lucide-react'
import type { AppState, AIContext, CalendarEvent, Reminder, Resource, WidgetType } from './types'
import { formatDue, fromLocalInput, toLocalInput } from './reminders'
import { isRealReminder, postponeReminder, realEvents, remindersForDay } from './dayModel'
import './home.css'
import { Dialog } from './Dialog'
import { QuickEntry } from './QuickEntry'
import { ActionMenu } from './ActionMenu'
import { resourceAppLabel } from './resourcePresentation'
import type { AssistantRole } from './assistantModel'
import { saveCheckpoint as storeCheckpoint } from './checkpoints'
import { localDate } from '../shared/state'
import { defaultWidgets } from './dashboard'
import { DashboardSettings } from './DashboardSettings'
import { CalendarView, eventInDay } from './calendar/CalendarView'
import { zenTimer } from './focus/zenTimer'
import './dashboard.css'
import { MailWidget, NewsWidget } from './FeedWidgets'

function getDocAppType(doc: Resource): 'illustrator' | 'indesign' | 'photoshop' | 'word' | 'figma' | 'link' | 'file' {
  if (doc.kind === 'file') {
    if (/\.(ai|eps|svg|ait)$/i.test(doc.target) || /\.(ai|eps|svg)$/i.test(doc.name) || doc.id.includes('ai-') || /illustrator/i.test(doc.name)) {
      return 'illustrator'
    }
    if (/\.(indd|idml)$/i.test(doc.target) || /\.(indd|idml)$/i.test(doc.name) || /indesign/i.test(doc.name)) {
      return 'indesign'
    }
    if (/\.(psd|psb)$/i.test(doc.target) || /\.(psd|psb)$/i.test(doc.name) || /photoshop/i.test(doc.name)) {
      return 'photoshop'
    }
    if (/\.(docx?|rtf)$/i.test(doc.target) || /\.(docx?)$/i.test(doc.name) || /word/i.test(doc.name)) {
      return 'word'
    }
  }
  if (/figma/i.test(doc.name) || (doc.kind === 'link' && /figma\.com/i.test(doc.target)) || doc.id.includes('figma-')) {
    return 'figma'
  }
  if (doc.kind === 'link') {
    return 'link'
  }
  return 'file'
}

function renderCompactAppIcon(doc: Resource) {
  const type = getDocAppType(doc)
  if (type === 'illustrator') return <span className="doc-compact-app-icon illustrator-mark" aria-hidden="true">Ai</span>
  if (type === 'indesign') return <span className="doc-compact-app-icon indesign-mark" aria-hidden="true">Id</span>
  if (type === 'photoshop') return <span className="doc-compact-app-icon photoshop-mark" aria-hidden="true">Ps</span>
  if (type === 'word') return <span className="doc-compact-app-icon word-mark" aria-hidden="true">W</span>
  if (type === 'figma') {
    return (
      <span className="doc-compact-app-icon figma-mark doc-figma-mark" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </span>
    )
  }
  if (type === 'link') {
    return <span className="doc-compact-app-icon web-mark" aria-hidden="true"><Globe2 size={13} strokeWidth={2} /></span>
  }
  return <span className="doc-compact-app-icon file-mark" aria-hidden="true"><FileText size={13} strokeWidth={2} /></span>
}

interface Props {
  initialReminderId?: string
  onSearchHandled: () => void
  state: AppState
  now: Date
  onChange: (update: (state: AppState) => AppState) => void
  onCapture: () => void
  onPlan: (dayOffset: number) => void
  onSpace: (id: string) => void
  onOpen: (resource: Resource) => void
  onAddLink: () => void
  onAssistant: (draft?: string, contexts?: AIContext[]) => void
  onSaveThought: (title: string, dueAt: string | null, plannedDate?: string | null, kind?: 'note' | 'task') => unknown
  assistantRole: AssistantRole
  onOpenWorkstage?: (spaceId: string, artifactId?: string) => void
  onImport: () => void
  onNewTab: () => void
  onSettings: () => void
  onCalendarRange: (date: Date) => void
}

export function Home({ initialReminderId, onSearchHandled, state, now, onChange, onCapture, onPlan, onSpace, onOpen, onAddLink, onOpenWorkstage, onAssistant, onSaveThought, assistantRole, onImport, onNewTab, onSettings, onCalendarRange }: Props) {
  const [day, setDay] = useState(0)
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null)
  useEffect(() => { if (!undo) return; const timer = window.setTimeout(() => setUndo(null), 8000); return () => window.clearTimeout(timer) }, [undo])
  const [dialog, setDialog] = useState<'checkpoint' | 'digest' | 'reminder' | 'widgets' | 'calendar' | 'event' | 'today' | null>(null)
  const [planView, setPlanView] = useState<'list' | 'week'>('list')
  const [eventId, setEventId] = useState('')
  const [reminderDay, setReminderDay] = useState('')
  const [reminderDeadline, setReminderDeadline] = useState('')
  const [focus, setFocus] = useState(zenTimer.getState())
  useEffect(() => zenTimer.subscribe(setFocus), [])
  const widgets = state.dashboard?.widgets || defaultWidgets
  const quiet = state.dashboard?.preset === 'quiet'
  const standardLayout = !quiet && widgets.length === 3 && widgets.every((widget, index) => widget.type === defaultWidgets[index].type && widget.size === defaultWidgets[index].size)
  const visible = (type: WidgetType) => widgets.some(widget => widget.type === type) && (!quiet || ['resume', 'day', 'capture'].includes(type))
  const widgetStyle = (type: WidgetType): CSSProperties => {
    const widget = widgets.find(item => item.type === type)
    return { order: widgets.findIndex(item => item.type === type), gridColumn: `span ${widget?.size === 'S' ? 2 : widget?.size === 'L' ? 6 : 3}` }
  }
  const [digestTab, setDigestTab] = useState<'notes' | 'reading' | 'events'>('notes')
  const [page, setPage] = useState(0)
  const [spaceId, setSpaceId] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [note, setNote] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [tomorrowTasks, setTomorrowTasks] = useState<string[]>([])
  const [reminderId, setReminderId] = useState('')
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderWhen, setReminderWhen] = useState('')
  useEffect(() => { const reminder = state.reminders.find(item => item.id === initialReminderId); if (reminder) editReminder(reminder); if (initialReminderId) onSearchHandled() }, [initialReminderId])

  const resources = state.spaces.flatMap(space => space.resources.map(resource => ({ ...resource, spaceId: space.id })))
  const recentDocs = resources
    .filter(resource => resource.kind !== 'app' && resource.lastOpenedAt && !resource.completedAt)
    .sort((a, b) => Date.parse(b.lastOpenedAt!) - Date.parse(a.lastOpenedAt!))
  const recent = recentDocs[0]
  const checkpoint = state.spaces.filter(space => !space.archivedAt && space.checkpoint).sort((a, b) => Date.parse(b.checkpoint!.savedAt) - Date.parse(a.checkpoint!.savedAt))[0]?.checkpoint
  const latestSession = state.spaces.filter(space => !space.archivedAt && space.activeSession?.tabs.some(tab => tab.url)).sort((a, b) => Date.parse(b.lastActiveAt || '') - Date.parse(a.lastActiveAt || ''))[0]
  const resumeSpace = state.spaces.find(space => space.id === (checkpoint?.spaceId || recent?.spaceId || latestSession?.id)) || state.spaces[0]
  const displayDocs = recentDocs.filter(item => item.spaceId === resumeSpace?.id).slice(0, 3)
  const savedResearch = (resumeSpace?.researchArtifacts || []).slice(0, 2).map(artifact => ({ ...artifact, spaceId: resumeSpace!.id }))
  const resumeResource = checkpoint ? resources.find(resource => resource.id === checkpoint.resourceId) : recent
  const resumeTitle = checkpoint ? checkpoint.nextStep || `Вернуться в «${resumeSpace?.name}»` : recent ? `Продолжить: ${recent.name}` : latestSession ? `Вернуться в «${latestSession.name}»` : 'Можно начать с малого.'
  const hasResume = Boolean(checkpoint || recent || latestSession)
  function continueWork() {
    if (resumeResource) onOpen(resumeResource)
    else if (resumeSpace?.activeSession?.tabs.some(tab => tab.url) && onOpenWorkstage) onOpenWorkstage(resumeSpace.id)
    else if (resumeSpace) onSpace(resumeSpace.id)
  }
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

  function editCheckpoint() {
    setTomorrowTasks([])
    setSpaceId(resumeSpace?.id || '')
    setResourceId(resumeResource?.id || '')
    setNote(checkpoint?.note || '')
    setNextStep(checkpoint?.nextStep || '')
    setDialog('checkpoint')
  }

  function saveCheckpoint() {
    if (!spaceId) return
    const old = state.spaces.find(item => item.id === spaceId)
    const moved = state.reminders.filter(item => tomorrowTasks.includes(item.id))
    onChange(previous => storeCheckpoint({ ...previous, reminders: previous.reminders.map(item => tomorrowTasks.includes(item.id) ? postponeReminder(item, 'tomorrow', now) : item) }, spaceId, { resourceId: resourceId || undefined, note: note.trim(), nextStep: nextStep.trim() }))
    setUndo({ label: 'Продолжение сохранено', restore: () => onChange(previous => ({ ...previous, spaces: previous.spaces.map(item => item.id === spaceId && old ? { ...item, checkpoint: old.checkpoint, checkpointHistory: old.checkpointHistory } : item), reminders: previous.reminders.map(item => { const original = moved.find(value => value.id === item.id); return original ? { ...item, dueAt: original.dueAt, plannedDate: original.plannedDate, notifiedAt: original.notifiedAt } : item }) })) })
    setDialog(null)
  }

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
  const pickDate = (date: Date) => { const midnight = new Date(now); midnight.setHours(0, 0, 0, 0); const chosen = new Date(date); chosen.setHours(0, 0, 0, 0); setDay(Math.round((chosen.getTime() - midnight.getTime()) / 86400000)); setDialog(null) }

  return <>
    <main className={`calm-home dashboard-home ${quiet ? 'quiet-home' : ''}`} aria-label="Ваш день">
      <div className="calm-heading">
        <button className="date-heading" onClick={() => setDialog('calendar')} title="Открыть календарь" aria-label={`${now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}. Открыть календарь`}>
          <h1><span className="date-number">{now.getDate()}</span><span className="date-caption"><span>{now.toLocaleDateString('ru-RU', { month: 'long', day: 'numeric' }).replace(/^\d+\s/, '')}</span><small>{now.toLocaleDateString('ru-RU', { weekday: 'long' })}</small></span></h1><CalendarDays size={18} className="date-calendar-icon" />
        </button>
        <div className="day-controls"><div className="day-mode-switch" aria-label="Режим главной"><button aria-pressed={!quiet} onClick={() => onChange(previous => ({ ...previous, dashboard: { widgets, preset: 'overview' } }))}>Обзор дня</button><button aria-pressed={quiet} onClick={() => onChange(previous => ({ ...previous, dashboard: { widgets, preset: 'quiet' } }))}>Одно дело</button></div><button className="dashboard-customize" aria-label="Настроить главную" title="Настроить главную" onClick={() => setDialog('widgets')}><SlidersHorizontal size={18} /></button><button className="leave-day" onClick={editCheckpoint}><Moon size={16} /><span>Оставить на завтра</span><ArrowUpRight size={14} /></button></div>
      </div>
      <div className={`calm-grid dashboard-grid ${standardLayout && hasResume ? 'standard-grid' : ''}`}>
        <section className="calm-card resume-card" data-widget="resume" hidden={!visible('resume') || !hasResume} style={widgetStyle('resume')} aria-label="Продолжение работы">
          <div className="resume-eyebrow"><span className="resume-indicator" />{hasResume ? 'С того места, где остановились' : 'Ваше место для нового'}<span className="resume-space-name">{hasResume ? resumeSpace?.name : ''}</span></div>
          <div className="resume-main">
            <h2 className="resume-title">{resumeTitle}</h2>
            <p className="resume-note">{checkpoint?.note || (hasResume ? 'Всё на месте. Можно спокойно продолжить.' : 'Сохраните мысль или дело. Остальное соберётся постепенно.')}</p>
            <div className="resume-actions"><button className="resume-primary" onClick={hasResume ? continueWork : onCapture}>{hasResume ? 'Продолжить' : 'Записать мысль'}<ArrowRight size={18} /></button>{resumeResource && <span className="resume-target">{renderCompactAppIcon(resumeResource)}{resourceAppLabel(resumeResource)}</span>}</div>
          </div>
          {(displayDocs.length > 0 || savedResearch.length > 0) && <div className="resume-recent" aria-label="Недавно открывали"><span className="resume-recent-label">Под рукой</span><div>{displayDocs.map(doc => <button key={doc.id} onClick={() => onOpen(doc)} title={`Открыть ${doc.name}`}>{renderCompactAppIcon(doc)}<span>{doc.name}</span></button>)}{savedResearch.map(artifact => <button key={artifact.id} onClick={() => onOpenWorkstage ? onOpenWorkstage(artifact.spaceId, artifact.id) : onSpace(artifact.spaceId)} title={`Открыть исследование: ${artifact.query}`}><FileText size={14} /><span>{artifact.query}</span></button>)}</div></div>}
          {!displayDocs.length && !savedResearch.length && hasResume && <button className="resume-context-link" onClick={editCheckpoint}>Уточнить следующий шаг<ArrowUpRight size={14} /></button>}
        </section>

        <section className="calm-card plan-card" data-widget="day" hidden={!visible('day')} style={widgetStyle('day')} aria-label="План дня">
          <div className="calm-card-heading"><div className="calm-tabs" aria-label="День плана"><button aria-pressed={day === 0} className={day === 0 ? 'selected' : ''} onClick={() => setDay(0)}>Сегодня</button><button aria-pressed={day === 1} className={day === 1 ? 'selected' : ''} onClick={() => setDay(1)}>Завтра</button></div><button className="calm-icon" aria-label="Добавить дело" title="Добавить дело" onClick={() => onPlan(day)}><Plus size={22} /></button></div>
          {!quiet && <div className="plan-view-switch"><button aria-pressed={planView === 'list'} onClick={() => setPlanView('list')}>Список</button><button aria-pressed={planView === 'week'} onClick={() => setPlanView('week')}>Неделя</button><button onClick={() => setDialog('calendar')}>Месяц</button></div>}
          {planView === 'week' && !quiet ? <CalendarView state={state} date={selectedDay} mode="week" onChange={onChange} onOpenEvent={showEvent} onRange={onCalendarRange} onSelectDate={pickDate} /> : <div className="calm-plan-list">
            {schedule.slice(0, quiet ? 1 : 3).map(item => (
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
                  { label: 'Завтра', icon: <CalendarDays size={16} />, onSelect: () => postponeTask(item.reminder!, 'tomorrow') },
                  { label: 'Через час', icon: <Clock3 size={16} />, onSelect: () => postponeTask(item.reminder!, 'hour') },
                  { label: 'Изменить', icon: <Pencil size={16} />, onSelect: () => editReminder(item.reminder!) }
                  , { label: 'Убрать из сегодняшнего', icon: <FileText size={16} />, onSelect: () => changeTask(item.reminder!, { plannedDate: null }, 'Убрано из сегодняшнего') }
                ]} /> : null}
              </div>
            ))}
            {!schedule.length && <div className="calm-plan-empty"><span className="empty-orbit"><Clock3 size={29} strokeWidth={1.2} /></span><h2>На этот день здесь пока нет дел.</h2><p>Можно выбрать одно важное дело.</p><button className="calm-text-button" onClick={() => onPlan(day)}>Добавить <Plus size={17} /></button></div>}
          </div>}
          <div className="plan-bottom">{schedule.length > (quiet ? 1 : 3) && <button className="calm-text-button" onClick={() => setDialog('today')}>Все дела на этот день · {schedule.length}<ArrowRight size={16} /></button>}{earlier.length > 0 && <button className="calm-text-button" onClick={() => showDigest()}>Осталось с прошлых дней · {earlier.length}</button>}</div>
          <div className="plan-saved" hidden={quiet} aria-label="Сохранённое">
            <div className="plan-saved-heading" title="Материалы, к которым можно вернуться, когда будет время"><span>Сохранённое</span></div>
            <div className="plan-saved-links">
              <button onClick={() => showDigest('notes')}><FileText size={16} /><span>Мысли и дела</span><small>{realReminders.length}</small></button>
              <button onClick={() => showDigest('reading')}><Bookmark size={16} /><span>Почитать</span><small>{links.length}</small></button>
              <button onClick={() => showDigest('events')}><Clock3 size={16} /><span>События</span><small>{events.length}</small></button>
            </div>
          </div>
        </section>

        <div className="quick-widget" data-widget="capture" hidden={!visible('capture')} style={hasResume ? widgetStyle('capture') : { ...widgetStyle('capture'), order: -1, gridColumn: 'span 3' }}>{!hasResume && <div className="first-run-actions"><button onClick={onNewTab}>Открыть сайт</button><button onClick={onImport}>Перенести вкладки</button></div>}<QuickEntry onSave={onSaveThought} onAssistant={onAssistant} assistantRole={assistantRole} /></div>
        <section className="calm-card simple-widget" data-widget="spaces" hidden={!visible('spaces')} style={widgetStyle('spaces')}><h2>Пространства</h2>{state.spaces.filter(space => !space.archivedAt).slice(0, 5).map(space => <button className="widget-resource" key={space.id} onClick={() => onOpenWorkstage?.(space.id)}><span>{space.name}<small>{space.checkpoint?.nextStep || `Вкладок: ${space.activeSession?.tabs.length || 0}`}</small></span><ArrowRight size={17} /></button>)}</section>
        <section className="calm-card simple-widget" data-widget="mail" hidden={!visible('mail')} style={widgetStyle('mail')}><MailWidget state={state} widget={widgets.find(item => item.type === "mail")} onSettings={onSettings} onOpen={onOpen} onChange={onChange} onAssistant={onAssistant} /></section>
        <section className="calm-card simple-widget" data-widget="news" hidden={!visible('news')} style={widgetStyle('news')}><NewsWidget state={state} widget={widgets.find(item => item.type === "news")} onSettings={onSettings} onOpen={onOpen} onChange={onChange} onAssistant={onAssistant} /></section>
        <section className="calm-card simple-widget" data-widget="focus" hidden={!visible('focus')} style={widgetStyle('focus')}><h2>Фокус</h2><p>{focus.status === 'running' ? `Осталось ${Math.ceil(focus.remainingSeconds / 60)} минут` : 'Одно дело, 30 минут.'}</p><button className="calm-primary" onClick={() => focus.status === 'running' ? zenTimer.stop() : zenTimer.start(30)}>{focus.status === 'running' ? 'Завершить фокус' : 'Начать'}</button></section>
      </div>
    </main>

    {dialog === 'widgets' && <DashboardSettings widgets={widgets} onChange={next => onChange(previous => ({ ...previous, dashboard: { preset: previous.dashboard?.preset || 'overview', widgets: next } }))} onClose={() => setDialog(null)} />}
    {dialog === 'calendar' && <Dialog className="calendar-dialog" title="Календарь" onClose={() => setDialog(null)}><CalendarView state={state} date={now} mode="month" onChange={onChange} onOpenEvent={showEvent} onRange={onCalendarRange} onSelectDate={pickDate} /></Dialog>}
    {dialog === 'event' && selectedEvent && <Dialog title={selectedEvent.title} onClose={() => setDialog(null)}><p>{selectedEvent.allDay ? 'Весь день' : formatDue(selectedEvent.startAt)}</p>{selectedEvent.location && <p>{selectedEvent.location}</p>}{selectedEvent.meetingUrl && <button className="calm-primary" onClick={() => onOpen({ id: selectedEvent.id, name: selectedEvent.title, kind: 'link', target: selectedEvent.meetingUrl!, createdAt: now.toISOString() })}>Подключиться</button>}<div className="calm-form"><label>Подсказка перед встречей<select value={selectedEvent.noticeMinutes || 0} onChange={event => onChange(previous => ({ ...previous, events: previous.events?.map(item => item.id === selectedEvent.id ? { ...item, noticeMinutes: Number(event.target.value) } : item) }))}><option value={0}>Не напоминать</option><option value={5}>За 5 минут</option><option value={10}>За 10 минут</option><option value={15}>За 15 минут</option></select></label><label>Материалы встречи<select value={selectedEvent.spaceId || ''} onChange={event => onChange(previous => ({ ...previous, events: previous.events?.map(item => item.id === selectedEvent.id ? { ...item, spaceId: event.target.value || undefined } : item) }))}><option value="">Выбрать пространство</option>{state.spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label></div>{selectedEvent.spaceId && <button className="calm-text-button" onClick={() => { setDialog(null); onOpenWorkstage?.(selectedEvent.spaceId!) }}>Открыть материалы встречи</button>}</Dialog>}

    {dialog === 'checkpoint' && <Dialog title="С чего продолжим?" onClose={() => setDialog(null)}>
      <div className="calm-form"><label>Следующий шаг<input value={nextStep} onChange={event => setNextStep(event.target.value)} maxLength={100} /></label><label>Что стоит помнить · необязательно<textarea rows={2} value={note} onChange={event => setNote(event.target.value)} maxLength={180} /></label></div>
      {remindersForDay(state, now).length > 0 && <details className="calm-details"><summary>Что перенести на завтра · необязательно</summary>{remindersForDay(state, now).map(item => <label className="assistant-check" key={item.id}><input type="checkbox" checked={tomorrowTasks.includes(item.id)} onChange={event => setTomorrowTasks(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} />{item.title}</label>)}</details>}<details className="calm-details"><summary>{state.spaces.find(space => space.id === spaceId)?.name || 'Выбрать пространство'} · контекст</summary><div className="calm-form"><label>Пространство<select value={spaceId} onChange={event => { setSpaceId(event.target.value); setResourceId('') }}>{state.spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label><label>С чего продолжить<select value={resourceId} onChange={event => setResourceId(event.target.value)}><option value="">Открыть пространство</option>{state.spaces.find(space => space.id === spaceId)?.resources.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label></div></details>
      <div className="calm-dialog-actions">{checkpoint && <button className="calm-text-button" onClick={() => { onChange(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === checkpoint.spaceId ? { ...space, checkpoint: undefined } : space) })); setDialog(null) }}>Уже закончено</button>}<button className="calm-primary" disabled={!spaceId} onClick={saveCheckpoint}>Оставить на завтра <Check size={18} /></button></div>
    </Dialog>}
    {dialog === 'today' && <Dialog title={selectedDay.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} onClose={() => setDialog(null)}><div className="calm-digest-list">{schedule.map(item => <button key={item.id} onClick={() => item.reminder ? editReminder(item.reminder) : showEvent(item.event!)}><span><strong>{item.title}</strong><small>{item.time ? formatDue(item.time) : 'Без времени'}</small></span><ArrowRight size={16} /></button>)}</div></Dialog>}
    {dialog === 'reminder' && selectedReminder && <Dialog title="Дело и напоминание" onClose={() => setDialog(null)}>
      <div className="calm-form"><label>Название<input value={reminderTitle} onChange={event => setReminderTitle(event.target.value)} /></label><label>День выполнения<input type="date" value={reminderDay} onChange={event => setReminderDay(event.target.value)} /></label><label>Срок<input type="date" value={reminderDeadline} onChange={event => setReminderDeadline(event.target.value)} /></label><label>Напомнить<input type="datetime-local" value={reminderWhen} onChange={event => setReminderWhen(event.target.value)} /></label></div>
      <div className="calm-postpone"><button onClick={() => updateReminder(item => postponeReminder(item, 'hour'))}>Через час</button><button onClick={() => updateReminder(item => postponeReminder(item, 'tomorrow'))}>Завтра</button><button onClick={() => updateReminder(item => ({ ...item, dueAt: null, notifiedAt: undefined, trigger: undefined }))}>Без напоминания</button></div>
      <details className="calm-details"><summary>При событии или возвращении</summary><div className="calm-form"><label>Когда вернусь в пространство<select value="" onChange={event => { if (event.target.value) updateReminder(item => ({ ...item, dueAt: null, notifiedAt: undefined, trigger: { kind: 'return', spaceId: event.target.value, armedAt: new Date().toISOString() } })) }}><option value="">Выбрать пространство</option>{state.spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label><label>После встречи<select value="" onChange={event => { const meeting = state.events?.find(item => item.id === event.target.value); if (meeting) updateReminder(item => ({ ...item, dueAt: meeting.endAt, notifiedAt: undefined, trigger: { kind: 'event', eventId: meeting.id, offsetMinutes: 0 } })) }}><option value="">Выбрать событие</option>{events.filter(item => !item.allDay).map(event => <option key={event.id} value={event.id}>{event.title} · {formatDue(event.startAt)}</option>)}</select></label></div></details>
      {selectedReminder.sourceUrl && <button className="calm-text-button" onClick={() => onOpen({ id: selectedReminder.id, name: selectedReminder.title, kind: 'link', target: selectedReminder.sourceUrl!, createdAt: now.toISOString() })}>Открыть источник</button>}
      <div className="calm-dialog-actions"><button className="calm-text-button" onClick={() => changeTask(selectedReminder, { done: true }, 'Дело завершено')}><Check size={18} />Сделано</button><button className="calm-primary" disabled={!reminderTitle.trim()} onClick={() => updateReminder(item => ({ ...item, trigger: undefined, title: reminderTitle.trim(), plannedDate: reminderDay || null, deadline: reminderDeadline || null, kind: reminderDay || reminderWhen || reminderDeadline ? 'task' : 'note', dueAt: fromLocalInput(reminderWhen), notifiedAt: item.dueAt === fromLocalInput(reminderWhen) ? item.notifiedAt : undefined }))}>Сохранить</button></div>
    </Dialog>}

    {dialog === 'digest' && <Dialog title="Сохранённое" onClose={() => setDialog(null)}><div className="calm-tabs digest-tabs">{(['notes', 'reading', 'events'] as const).map(tab => <button key={tab} className={digestTab === tab ? 'selected' : ''} onClick={() => { setDigestTab(tab); setPage(0) }}>{tab === 'notes' ? 'Мысли и дела' : tab === 'reading' ? 'Почитать' : 'События'}</button>)}</div><div className="calm-digest-list">
      {digestTab === 'notes' && realReminders.slice(visiblePage * 4, visiblePage * 4 + 4).map(item => <button key={item.id} onClick={() => editReminder(item)}><span><strong>{item.title}</strong><small>{item.dueAt ? formatDue(item.dueAt) : 'Без срока'}</small></span><ArrowUpRight size={18} /></button>)}
      {digestTab === 'reading' && links.slice(visiblePage * 4, visiblePage * 4 + 4).map(item => <div className="calm-reading-row" key={item.id}><button onClick={() => onOpen(item)}><span><strong>{item.name}</strong><small>{state.spaces.find(space => space.id === item.spaceId)?.name}</small></span><ArrowUpRight size={18} /></button><button className="calm-icon" aria-label={`Прочитано: ${item.name}`} onClick={() => onChange(previous => ({ ...previous, spaces: previous.spaces.map(space => ({ ...space, resources: space.resources.map(resource => resource.id === item.id ? { ...resource, completedAt: new Date().toISOString() } : resource) })) }))}><Check size={18} /></button></div>)}
      {digestTab === 'events' && events.slice(visiblePage * 4, visiblePage * 4 + 4).map(event => <div className="calm-event-row" key={event.id}><strong>{event.title}</strong><small>{formatDue(event.startAt)}</small></div>)}
      {(digestTab === 'notes' ? realReminders.length : digestItems.length) === 0 && <p className="calm-digest-empty">{digestTab === 'notes' ? 'Мысли можно записывать без срока.' : digestTab === 'reading' ? 'Сохраните ссылку, к которой хочется вернуться.' : 'Здесь появятся ваши события. Календарь пока не подключён.'}</p>}
    </div><div className="calm-dialog-actions"><div className="calm-pagination">{totalPages > 1 && <><button className="calm-icon" disabled={!visiblePage} onClick={() => setPage(visiblePage - 1)} aria-label="Назад"><ChevronLeft size={18} /></button><span>{visiblePage + 1} / {totalPages}</span><button className="calm-icon" disabled={visiblePage + 1 === totalPages} onClick={() => setPage(visiblePage + 1)} aria-label="Далее"><ChevronRight size={18} /></button></>}</div>{digestTab !== 'events' && <button className="calm-primary" onClick={() => { setDialog(null); digestTab === 'reading' ? onAddLink() : onCapture() }}><Plus size={18} />{digestTab === 'reading' ? 'Сохранить ссылку' : 'Записать'}</button>}</div></Dialog>}
    {undo && <div className="calm-undo" role="status"><span>{undo.label}</span><button onClick={() => { undo.restore(); setUndo(null) }}>Вернуть</button></div>}
  </>
}



