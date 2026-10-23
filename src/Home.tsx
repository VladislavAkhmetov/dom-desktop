import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, ArrowUpRight, BookmarkPlus, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, FileText, Pencil, Plus, PlusCircle, SlidersHorizontal, Timer, Video, X } from 'lucide-react'
import type { AppState, AIContext, CalendarEvent, Reminder, Resource, WidgetConfig, WidgetType } from './types'
import { formatDue, fromLocalInput, toLocalInput } from './reminders'
import { isRealReminder, postponeReminder, realEvents, remindersForDay, rescheduleTaskToToday } from './dayModel'
import './home.css'
import { Dialog } from './Dialog'
import { QuickEntry } from './QuickEntry'
import { ActionMenu } from './ActionMenu'
import { activeOrRecentContinuation } from './workContexts'
import { ResumeCard } from './ResumeCard'
import type { ResumeResult } from './resumeContext'
import { localDate } from '../shared/state'
import { availableWidgetTypes, computeWidgetPositions, dashboardWidgets, widgetNames, widgetSpan } from './dashboard'
import { ScratchpadWidget } from './ScratchpadWidget'
import { ReadingShelfWidget } from './ReadingShelfWidget'
import { WeatherWidget } from './WeatherWidget'
import { MapWidget } from './MapWidget'
import { HabitsWidget } from './HabitsWidget'
import { useDashboardDrag } from './useDashboardDrag'
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
  onDashboardSettings?: (tab?: 'widgets' | 'presets' | 'wallpaper') => void
  onNewsRefresh?: () => unknown
  newsRefreshing?: boolean
  onCalendarRange: (date: Date) => void
  covers?: Record<string, string>
  onNewSpace?: () => void
}

export function Home({ viewportWidth, viewportHeight: _viewportHeight, calendarRequested, onCalendarHandled, initialReminderId, onSearchHandled, state, now, onChange, onCapture, onFocus, onPlan, onCreateAt, onSpace, onOpen, onAddLink, onOpenWorkstage, onAssistant, onSaveThought, onImport, onNewTab, onSettings, onDashboardSettings, onNewsRefresh, newsRefreshing, onCalendarRange, onResume, onOpenContext, onEditContext, onCompleteContext, onOpenDocument, resumeStatus, covers, onNewSpace }: Props) {
  const [day, setDay] = useState(0)
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null)
  const undoTimerRef = useRef<number | undefined>(undefined)

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = undefined
    }
  }, [])

  const startUndoTimer = useCallback((delay = 6000) => {
    clearUndoTimer()
    undoTimerRef.current = window.setTimeout(() => {
      setUndo(null)
    }, delay)
  }, [clearUndoTimer])

  useEffect(() => {
    if (undo) startUndoTimer(6000)
    else clearUndoTimer()
    return () => clearUndoTimer()
  }, [undo, startUndoTimer, clearUndoTimer])
  const [dialog, setDialog] = useState<'digest' | 'reminder' | 'event' | 'today' | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('day')
  useEffect(() => { if (calendarRequested) { setDay(0); setCalendarMode('day'); setCalendarOpen(true); onCalendarHandled?.() } }, [calendarRequested, onCalendarHandled])
  const [eventId, setEventId] = useState('')
  const [reminderDay, setReminderDay] = useState('')
  const [reminderDeadline, setReminderDeadline] = useState('')
  const [focus, setFocus] = useState(zenTimer.getState())
  useEffect(() => zenTimer.subscribe(setFocus), [])
  const hasSpaceTabs = state.spaces.some(space => !space.archivedAt && space.kind !== 'web')
  const widgets = useMemo(() => {
    let list = dashboardWidgets(state.dashboard?.widgets, state.dashboard?.gridVersion)
    const hasResume = list.some(w => w.type === 'resume')
    if (hasSpaceTabs && !hasResume && !state.dashboard?.resumeDismissed) {
      const resumeWidget: WidgetConfig = {
        id: 'resume',
        type: 'resume',
        size: 'M',
        colSpan: 6,
        rowSpan: 4
      }
      const newsIndex = list.findIndex(w => w.type === 'news')
      if (newsIndex >= 0) {
        list = [...list.slice(0, newsIndex), resumeWidget, ...list.slice(newsIndex)]
      } else {
        list = [resumeWidget, ...list]
      }
    } else if (hasResume && list.some(w => w.type === 'news')) {
      const resumeIndex = list.findIndex(w => w.type === 'resume')
      const newsIndex = list.findIndex(w => w.type === 'news')
      if (newsIndex >= 0 && resumeIndex > newsIndex) {
        const resumeWidget = list[resumeIndex]
        const withoutResume = list.filter((_, i) => i !== resumeIndex)
        const newNewsIndex = withoutResume.findIndex(w => w.type === 'news')
        list = [...withoutResume.slice(0, newNewsIndex), resumeWidget, ...withoutResume.slice(newNewsIndex)]
      }
    }
    return list
  }, [state.dashboard?.widgets, state.dashboard?.gridVersion, state.dashboard?.resumeDismissed, hasSpaceTabs])
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollWrapRef = useRef<HTMLDivElement>(null)
  const [scrollEdges, setScrollEdges] = useState({ before: false, after: false })
  const [showAddPicker, setShowAddPicker] = useState(false)

  const setWidgets = (next: WidgetConfig[]) => {
    const isRemovingResume = widgets.some(w => w.type === 'resume') && !next.some(w => w.type === 'resume')
    const isAddingResume = !widgets.some(w => w.type === 'resume') && next.some(w => w.type === 'resume')
    onChange(previous => ({
      ...previous,
      dashboard: {
        preset: previous.dashboard?.preset || 'custom',
        widgets: next,
        gridVersion: 2,
        customPresets: previous.dashboard?.customPresets,
        resumeDismissed: isRemovingResume ? true : isAddingResume ? false : previous.dashboard?.resumeDismissed
      }
    }))
  }
  const {
    isEditing,
    setIsEditing,
    cancelEditing,
    saveEditing,
    draggingId,
    dragOffset,
    isLandingId,
    resizingId,
    resizingEdge,
    resizeShiftX,
    isSnappingId,
    livePixelSizes,
    ghostSpans,
    liveSpans,
    onCardPointerDown,
    onResizePointerDown,
    removeWidget,
    addWidget
  } = useDashboardDrag({ widgets, onWidgetsChange: setWidgets, gridRef })

  useEffect(() => {
    const el = scrollWrapRef.current
    if (!el) return
    const measure = () => {
      const max = Math.max(0, el.scrollHeight - el.clientHeight)
      const offset = Math.max(0, Math.min(max, el.scrollTop))
      setScrollEdges({
        before: offset > 4,
        after: offset < max - 4
      })
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer) {
      observer.observe(el)
      if (gridRef.current) observer.observe(gridRef.current)
    }
    el.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer?.disconnect()
      el.removeEventListener('scroll', measure)
    }
  }, [widgets, isEditing])

  const narrow = viewportWidth < 760
  const positions = useMemo(() => computeWidgetPositions(widgets, liveSpans), [widgets, liveSpans])
  const getWidget = (type: WidgetType) => widgets.find(item => item.type === type)
  const visible = (type: WidgetType) => Boolean(getWidget(type))
  const widgetStyle = (typeOrWidget: WidgetType | WidgetConfig): CSSProperties => {
    const widget = typeof typeOrWidget === 'string' ? getWidget(typeOrWidget) : typeOrWidget
    if (!widget) return { display: 'none' }
    const pos = positions[widget.id] || { colStart: 1, colSpan: 6, rowSpan: 4 }
    const order = widgets.findIndex(item => item.id === widget.id)
    const columns = narrow ? 12 : pos.colSpan
    const colStart = narrow ? 1 : pos.colStart
    const rows = narrow ? 2 : pos.rowSpan
    const liveSize = livePixelSizes[widget.id]
    const base: CSSProperties & Record<string, any> = {
      order,
      '--widget-col-start': colStart,
      '--widget-col-span': columns,
      '--widget-row-span': rows,
      '--widget-span': columns
    }

    if (liveSize) {
      base.width = `${liveSize.width}px`
      base.height = `${liveSize.height}px`
      base.maxWidth = 'none'
      base.maxHeight = 'none'
    }

    if (resizingId === widget.id && resizingEdge === 'left' && resizeShiftX) {
      base.transform = `translateX(${resizeShiftX}px)`
    }

    if (draggingId === widget.id && dragOffset) {
      base['--drag-x'] = `${dragOffset.x}px`
      base['--drag-y'] = `${dragOffset.y}px`
    }

    return base
  }
  const cardWrapClass = (typeOrWidget: WidgetType | WidgetConfig) => {
    const widget = typeof typeOrWidget === 'string' ? getWidget(typeOrWidget) : typeOrWidget
    if (!widget) return ''
    const isDragging = draggingId === widget.id
    const isLanding = isLandingId === widget.id
    const isResizing = resizingId === widget.id
    const isSnapping = isSnappingId === widget.id
    return `dashboard-card-wrap ${isEditing ? 'is-editing' : ''} ${isDragging ? 'is-dragging' : ''} ${isLanding ? 'is-landing' : ''} ${isResizing ? 'is-resizing' : ''} ${isSnapping ? 'is-snapping' : ''}`
  }
  const renderCardControls = (typeOrWidget: WidgetType | WidgetConfig) => {
    const widget = typeof typeOrWidget === 'string' ? getWidget(typeOrWidget) : typeOrWidget
    if (!isEditing || !widget) return null
    const isBeingResized = resizingId === widget.id || isSnappingId === widget.id
    const ghost = ghostSpans[widget.id]

    return (
      <>
        <button
          type="button"
          className="widget-remove-btn"
          onClick={e => {
            e.stopPropagation()
            removeWidget(widget.id)
          }}
          aria-label={`Убрать виджет ${widgetNames[widget.type]}`}
          title="Убрать виджет"
        >
          <X size={15} />
        </button>

        {isBeingResized && ghost && (
          <div
            className={`widget-ghost-snap-outline ${resizingEdge === 'left' ? 'ghost-from-right' : ''}`}
            style={{
              width: `${ghost.width}px`,
              height: `${ghost.height}px`
            }}
            aria-hidden="true"
          >
            <span className="ghost-snap-badge">
              {ghost.colSpan} × {ghost.rowSpan}
            </span>
          </div>
        )}

        <div
          className="widget-edge-handle widget-edge-left"
          onPointerDown={e => onResizePointerDown(e, widget.id, 'left')}
          title="Потяните за левый край для изменения ширины"
          aria-label="Изменить ширину слева"
        />

        <div
          className="widget-edge-handle widget-edge-right"
          onPointerDown={e => onResizePointerDown(e, widget.id, 'right')}
          title="Потяните за правый край для изменения ширины"
          aria-label="Изменить ширину"
        />

        <div
          className="widget-edge-handle widget-edge-bottom"
          onPointerDown={e => onResizePointerDown(e, widget.id, 'bottom')}
          title="Потяните за нижний край для изменения высоты"
          aria-label="Изменить высоту"
        />

        <div
          className="widget-corner-handle widget-resize-handle"
          onPointerDown={e => onResizePointerDown(e, widget.id, 'corner')}
          title="Потяните за угол для изменения размера"
          aria-label="Изменить размер"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <line x1="10" y1="2" x2="2" y2="10" />
            <line x1="10" y1="6" x2="6" y2="10" />
          </svg>
        </div>
      </>
    )
  }
  const [digestTab, setDigestTab] = useState<'notes' | 'reading' | 'events'>('notes')
  const [page, setPage] = useState(0)
  const [reminderId, setReminderId] = useState('')
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderWhen, setReminderWhen] = useState('')
  useEffect(() => { const reminder = state.reminders.find(item => item.id === initialReminderId); if (reminder) editReminder(reminder); if (initialReminderId) onSearchHandled() }, [initialReminderId])

  const resources = state.spaces.flatMap(space => space.resources.map(resource => ({ ...resource, spaceId: space.id })))
  const continuation = activeOrRecentContinuation(state)
  const hasResume = Boolean(continuation)
  const selectedDay = new Date(now)
  selectedDay.setDate(selectedDay.getDate() + day)
  const plan = remindersForDay(state, selectedDay)
  const realReminders = state.reminders.filter(item => isRealReminder(item) && !item.done)
  const earlier = realReminders.filter(item => {
    if (item.plannedDate) return item.plannedDate < localDate(now)!
    if (item.dueAt) return localDate(new Date(item.dueAt))! < localDate(now)!
    return false
  })
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
    <main className={`calm-home dashboard-home ${isEditing ? 'is-editing' : ''}`} aria-label="Ваш день">
      <div className="dashboard-layout-wrap">
        <div
          ref={scrollWrapRef}
          className={`dashboard-scroll-wrap ${scrollEdges.before ? 'has-before' : ''} ${scrollEdges.after ? 'has-after' : ''} ${isEditing ? 'is-editing' : ''} ${draggingId ? 'is-dragging' : ''}`}
        >
          <div
            ref={gridRef}
            className={`calm-grid dashboard-grid ${isEditing ? 'editing-grid' : 'custom-grid'} ${narrow ? 'narrow-grid' : ''} ${resizingEdge ? `resizing-${resizingEdge}` : ''} ${draggingId ? 'grid-is-dragging' : ''}`}
          >
        {widgets.map(widget => {
          switch (widget.type) {
            case 'resume':
              return (
                <ResumeCard
                  key={widget.id}
                  continuation={continuation}
                  now={now}
                  hidden={!visible('resume')}
                  style={widgetStyle(widget)}
                  className={cardWrapClass(widget)}
                  dataWidgetId={widget.id}
                  colSpan={liveSpans[widget.id]?.colSpan ?? widgetSpan(widget).colSpan}
                  rowSpan={liveSpans[widget.id]?.rowSpan ?? widgetSpan(widget).rowSpan}
                  size={widget.size}
                  covers={covers}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  pending={Boolean(continuation && resumeStatus && resumeStatus.contextId === continuation.context.id && resumeStatus.pending)}
                  result={continuation && resumeStatus && resumeStatus.contextId === continuation.context.id ? resumeStatus.result : undefined}
                  onResume={retry => continuation && onResume(continuation.space.id, continuation.context.id, retry)}
                  onSpace={() => continuation ? onSpace(continuation.space.id) : onNewSpace ? onNewSpace() : onSpace('')}
                  onEdit={() => continuation && onEditContext(continuation.space.id, continuation.context.id)}
                  onComplete={() => continuation && onCompleteContext(continuation.space.id, continuation.context.id)}
                  onDocument={document => continuation && onOpenDocument(document, continuation.context.id)}
                  onTabs={() => continuation && onOpenContext(continuation.space.id, continuation.context.id)}
                  onNewSpace={onNewSpace}
                >
                  {renderCardControls(widget)}
                </ResumeCard>
              )
            case 'day':
              return (
                <section
                  key={widget.id}
                  className={`calm-card plan-card ${cardWrapClass(widget)}`}
                  data-widget="day"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('day')}
                  style={widgetStyle(widget)}
                  aria-label="План дня"
                >
                  <div className="calm-card-heading">
                    <div className="calm-tabs" aria-label="День плана">
                      <button aria-pressed={day === 0} className={day === 0 ? 'selected' : ''} onClick={() => setDay(0)}>Сегодня</button>
                      <button aria-pressed={day === 1} className={day === 1 ? 'selected' : ''} onClick={() => setDay(1)}>Завтра</button>
                      {day !== 0 && day !== 1 && <button className="selected" onClick={() => openCalendar('day')}>{selectedDay.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</button>}
                    </div>
                    <div className="calm-card-heading-actions">
                      <button className="calm-icon" aria-label="Открыть календарь" title="Календарь" onClick={() => openCalendar('week')}><CalendarDays size={18} /></button>
                      <button className="calm-icon" aria-label="Добавить дело" title="Добавить дело" onClick={() => onPlan(day)}><Plus size={18} /></button>
                    </div>
                  </div>
                  <div className="calm-plan-list">
                    {schedule.slice(0, 3).map(item => (
                      <div key={item.id} className={`calm-plan-item task-row ${state.liveHints && item.reminder?.dueAt && Date.parse(item.reminder.dueAt) > now.getTime() && Date.parse(item.reminder.dueAt) - now.getTime() <= 15 * 60000 ? 'live-hint' : ''}`}>
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
                          , { label: 'Убрать из сегодняшнего', icon: <FileText size={16} />, onSelect: () => changeTask(item.reminder!, { plannedDate: null, dueAt: null, notifiedAt: undefined }, 'Убрано из сегодняшнего') }
                        ]} /> : null}
                      </div>
                    ))}
                    {!schedule.length && (
                      <div className="calm-plan-empty-wrap">
                        {day === 0 && earlier.length > 0 ? (
                          <div className="plan-earlier-section">
                            <div className="plan-section-label">С прошлых дней</div>
                            <div className="plan-earlier-list">
                              {earlier.slice(0, 2).map(task => (
                                <div key={task.id} className="calm-plan-item task-row is-overdue-row">
                                  <button className="task-check" aria-label={`Завершить: ${task.title}`} title="Отметить сделанным" onClick={() => changeTask(task, { done: true }, 'Дело завершено')}><Check size={14} /></button>
                                  <button className="plan-item-title" onClick={() => editReminder(task)}>
                                    <span>{task.title}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="plan-move-today-btn"
                                    onClick={() => changeTask(task, rescheduleTaskToToday(task, now), 'Перенесено на сегодня')}
                                    title="Перенести дело на сегодня"
                                  >
                                    <span>На сегодня →</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                            {earlier.length > 2 && (
                              <button type="button" className="calm-text-button plan-earlier-more" onClick={() => showDigest()}>
                                Все дела с прошлых дней · {earlier.length}
                              </button>
                            )}
                            <button type="button" className="plan-add-task-row" onClick={() => onPlan(day)}>
                              <PlusCircle size={20} />
                              <span>{day === 0 ? 'Добавить дело на сегодня' : day === 1 ? 'Добавить дело на завтра' : 'Добавить дело на этот день'}</span>
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="plan-empty-label">{day === 0 ? 'На сегодня дел нет' : day === 1 ? 'На завтра пока нет дел' : 'На этот день дел нет'}</div>
                            <button type="button" className="plan-add-task-row" onClick={() => onPlan(day)}>
                              <PlusCircle size={20} />
                              <span>{day === 0 ? 'Добавить дело на сегодня' : day === 1 ? 'Добавить дело на завтра' : 'Добавить дело на этот день'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {schedule.length > 0 && (
                      <button type="button" className="plan-add-task-row" onClick={() => onPlan(day)}>
                        <PlusCircle size={20} />
                        <span>{day === 0 ? 'Добавить дело на сегодня' : day === 1 ? 'Добавить дело на завтра' : 'Добавить дело на этот день'}</span>
                      </button>
                    )}
                  </div>
                  <div className="plan-bottom">
                    {schedule.length > 3 && <button className="calm-text-button" onClick={() => setDialog('today')}>Все дела на этот день · {schedule.length}<ArrowRight size={16} /></button>}
                    {earlier.length > 0 && (schedule.length > 0 || earlier.length > 2) && <button className="calm-text-button" onClick={() => showDigest()}>Осталось с прошлых дней · {earlier.length}</button>}
                    <button className="plan-undated-pill" onClick={() => showDigest('notes')} title="Открыть мысли и дела без даты">
                      <span className="plan-undated-left">
                        <span className="plan-undated-icon">💭</span>
                        <span>Мысли без даты</span>
                        <span className="plan-undated-count">{state.reminders.filter(item => !item.done && !item.plannedDate && !item.dueAt).length}</span>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  {renderCardControls(widget)}
                </section>
              )
            case 'capture':
              return (
                <div
                  key={widget.id}
                  className={`quick-widget ${cardWrapClass(widget)}`}
                  data-widget="capture"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('capture')}
                  style={widgetStyle(widget)}
                >
                  {!hasResume && <div className="first-run-actions"><button onClick={onNewTab}>Открыть сайт</button><button onClick={onImport}>Перенести вкладки</button></div>}
                  <QuickEntry onSave={onSaveThought} onAssistant={onAssistant} />
                  {renderCardControls(widget)}
                </div>
              )
            case 'spaces':
              return (
                <section
                  key={widget.id}
                  className={`calm-card simple-widget ${cardWrapClass(widget)}`}
                  data-widget="spaces"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('spaces')}
                  style={widgetStyle(widget)}
                >
                  <h2>Пространства</h2>
                  {state.spaces.filter(space => !space.archivedAt && space.kind !== 'web').slice(0, 5).map(space => (
                    <button className="widget-resource" key={space.id} onClick={() => onOpenWorkstage?.(space.id)}>
                      <span>{space.name}<small>{space.checkpoint?.nextStep || `Вкладок: ${space.activeSession?.tabs.length || 0}`}</small></span>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                  {renderCardControls(widget)}
                </section>
              )
            case 'mail':
              return (
                <section
                  key={widget.id}
                  className={`calm-card simple-widget ${cardWrapClass(widget)}`}
                  data-widget="mail"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('mail')}
                  style={widgetStyle(widget)}
                >
                  <MailWidget state={state} widget={widget} onSettings={onSettings} onOpen={onOpen} onChange={onChange} onAssistant={onAssistant} />
                  {renderCardControls(widget)}
                </section>
              )
            case 'news':
              return (
                <section
                  key={widget.id}
                  className={`calm-card news-card ${cardWrapClass(widget)}`}
                  data-widget="news"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('news')}
                  style={widgetStyle(widget)}
                  aria-label="Дайджест новостей"
                >
                  <NewsWidget state={state} widget={widget} onSettings={onSettings} onOpen={onOpen} onChange={onChange} onAssistant={onAssistant} onRefresh={onNewsRefresh} refreshing={newsRefreshing} />
                  {renderCardControls(widget)}
                </section>
              )
            case 'focus':
              return (
                <section
                  key={widget.id}
                  className={`calm-card simple-widget ${cardWrapClass(widget)}`}
                  data-widget="focus"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('focus')}
                  style={widgetStyle(widget)}
                >
                  <h2>Фокус</h2>
                  {focus.status === 'running' && <p>{focus.task?.title}{focus.task && <br />}Осталось {Math.ceil(focus.remainingSeconds / 60)} мин</p>}
                  <button className="calm-primary" onClick={() => onFocus()}>{focus.status === 'running' ? 'Открыть таймер' : 'Выбрать дело'}</button>
                  {renderCardControls(widget)}
                </section>
              )
            case 'reading':
              return (
                <section
                  key={widget.id}
                  className={`calm-card ${cardWrapClass(widget)}`}
                  data-widget="reading"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('reading')}
                  style={widgetStyle(widget)}
                  aria-label="Почитать"
                >
                  <ReadingShelfWidget
                    state={state}
                    onChange={onChange}
                    onOpen={onOpen}
                    onAddLink={onAddLink}
                    colSpan={liveSpans[widget.id]?.colSpan ?? widgetSpan(widget).colSpan}
                    covers={covers}
                  />
                  {renderCardControls(widget)}
                </section>
              )
            case 'notes':
              return (
                <section
                  key={widget.id}
                  className={`calm-card ${cardWrapClass(widget)}`}
                  data-widget="notes"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('notes')}
                  style={widgetStyle(widget)}
                  aria-label="Заметки"
                >
                  <ScratchpadWidget state={state} onChange={onChange} onSaveThought={onSaveThought} />
                  {renderCardControls(widget)}
                </section>
              )
            case 'weather':
              return (
                <section
                  key={widget.id}
                  className={`calm-card ${cardWrapClass(widget)}`}
                  data-widget="weather"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('weather')}
                  style={widgetStyle(widget)}
                  aria-label="Подробная погода"
                >
                  <WeatherWidget
                    onOpenTraffic={() => {
                      const mapWidget = widgets.find(w => w.type === 'map')
                      if (mapWidget) {
                        const el = document.querySelector(`[data-widget-id="${mapWidget.id}"]`)
                        el?.scrollIntoView({ behavior: 'smooth' })
                      } else {
                        onOpen({
                          id: 'traffic',
                          name: 'Пробки',
                          kind: 'link',
                          target: 'https://yandex.ru/maps/?l=trf%2Ctrfe',
                          createdAt: new Date().toISOString()
                        })
                      }
                    }}
                  />
                  {renderCardControls(widget)}
                </section>
              )
            case 'map':
              return (
                <section
                  key={widget.id}
                  className={`calm-card ${cardWrapClass(widget)}`}
                  data-widget="map"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('map')}
                  style={widgetStyle(widget)}
                  aria-label="Карты и дорожная обстановка"
                >
                  <MapWidget
                    onOpenInTab={url =>
                      onOpen({
                        id: 'map-link',
                        name: 'Карта',
                        kind: 'link',
                        target: url,
                        createdAt: new Date().toISOString()
                      })
                    }
                  />
                  {renderCardControls(widget)}
                </section>
              )
            case 'habits':
              return (
                <section
                  key={widget.id}
                  className={`calm-card ${cardWrapClass(widget)}`}
                  data-widget="habits"
                  data-widget-id={widget.id}
                  onPointerDown={e => onCardPointerDown(e, widget.id)}
                  hidden={!visible('habits')}
                  style={widgetStyle(widget)}
                  aria-label="Забота и привычки"
                >
                  <HabitsWidget state={state} onChange={onChange} />
                  {renderCardControls(widget)}
                </section>
              )
            default:
              return null
          }
        })}
          </div>
        </div>

        <aside className="dashboard-floating-controls" role="toolbar" aria-label="Управление дашбордом">
          {!isEditing ? (
            <button
              type="button"
              className="edit-fab edit-fab-toggle dashboard-edit-toggle"
              onClick={() => setIsEditing(true)}
              title="Настроить виджеты (или удерживайте карточку)"
              aria-label="Настроить виджеты"
            >
              <SlidersHorizontal size={17} />
            </button>
          ) : (
            <>
              {/* На месте кнопки настроек — крестик закрытия/отмены! */}
              <button
                type="button"
                className="edit-fab edit-fab-cancel edit-cancel-btn"
                onClick={() => {
                  cancelEditing()
                  setShowAddPicker(false)
                }}
                title="Закрыть (отменить изменения)"
                aria-label="Закрыть настройки"
              >
                <X size={17} />
              </button>

              {/* Добавить виджет */}
              <div className="edit-fab-wrap">
                <button
                  type="button"
                  className={`edit-fab edit-fab-add edit-add-btn ${showAddPicker ? 'is-active' : ''}`}
                  onClick={() => setShowAddPicker(v => !v)}
                  title="Добавить виджет"
                  aria-label="Добавить виджет"
                >
                  <Plus size={18} />
                </button>
                {showAddPicker && (
                  <div className="dashboard-add-floating-picker" role="menu">
                    <div className="picker-header">Добавить виджет</div>
                    {availableWidgetTypes
                      .filter(type => !widgets.some(w => w.type === type))
                      .map(type => (
                        <button
                          key={type}
                          type="button"
                          className="picker-item"
                          onClick={() => {
                            addWidget(type)
                            setShowAddPicker(false)
                          }}
                        >
                          <Plus size={15} /> <span>{widgetNames[type]}</span>
                        </button>
                      ))}
                    {availableWidgetTypes.every(type => widgets.some(w => w.type === type)) && (
                      <span className="picker-empty">Все виджеты уже добавлены</span>
                    )}
                  </div>
                )}
              </div>

              {/* Готово / сохранить */}
              <button
                type="button"
                className="edit-fab edit-fab-done edit-done-btn"
                onClick={() => {
                  saveEditing()
                  setShowAddPicker(false)
                }}
                title="Готово (сохранить)"
                aria-label="Готово"
              >
                <Check size={18} />
              </button>

              {/* Пресеты опущены ниже всего и визуально отделены */}
              <div className="edit-fab-presets-wrap">
                <div className="dashboard-floating-divider" aria-hidden="true" />
                <button
                  type="button"
                  className="edit-fab edit-fab-presets dashboard-presets-quick-btn"
                  onClick={() => {
                    if (onDashboardSettings) {
                      onDashboardSettings('presets')
                    } else {
                      onSettings()
                    }
                  }}
                  title="Пресеты дашборда"
                  aria-label="Пресеты дашборда"
                >
                  <BookmarkPlus size={16} />
                </button>
              </div>
            </>
          )}
        </aside>
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
    {undo && (
      <div
        className="calm-undo"
        role="status"
        onMouseEnter={clearUndoTimer}
        onMouseLeave={() => startUndoTimer(3000)}
      >
        <span>{undo.label}</span>
        <button onClick={() => { undo.restore(); setUndo(null) }}>Вернуть</button>
        <button aria-label="Закрыть" onClick={() => setUndo(null)}><X size={15} /></button>
      </div>
    )}
  </>
}



