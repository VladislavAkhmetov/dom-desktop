import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronLeft, ChevronRight, Clock3, FileText, Globe2, Plus, Timer, Video } from 'lucide-react'
import type { AppState, Reminder, Resource } from './types'
import { formatDue, fromLocalInput, toLocalInput } from './reminders'
import { isRealReminder, postponeReminder, realEvents, remindersForDay } from './dayModel'
import './home.css'
import { Dialog } from './Dialog'
import { PlayerIsland } from './player/PlayerIsland'
import { zenTimer } from './focus/zenTimer'
import { AppLauncherPopover } from './AppLauncherPopover'

function getDocAppType(doc: Resource): 'illustrator' | 'figma' | 'link' | 'file' {
  if (doc.kind === 'file' && (/\.(ai|eps|svg|ait)$/i.test(doc.target) || /\.(ai|eps|svg)$/i.test(doc.name) || doc.id.includes('ai-') || /illustrator/i.test(doc.name))) {
    return 'illustrator'
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
  if (type === 'illustrator') {
    return <span className="doc-compact-app-icon illustrator-mark" aria-hidden="true">Ai</span>
  }
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

function getDocPreviewClass(doc: Resource): string {
  const type = getDocAppType(doc)
  if (type === 'illustrator') {
    if (doc.name.includes('паттерн')) return 'preview-pattern'
    return 'preview-vector'
  }
  if (type === 'figma') return 'preview-ui'
  if (type === 'link') return 'preview-web'
  return 'preview-doc'
}

function renderDocPreview(doc: Resource) {
  const type = getDocAppType(doc)
  if (type === 'illustrator') {
    if (doc.name.includes('паттерн')) {
      return (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="8" y="8" width="10" height="10" rx="3" fill="#50695a" opacity="0.6"/>
          <rect x="22" y="8" width="10" height="10" rx="3" fill="#50695a" opacity="0.3"/>
          <rect x="8" y="22" width="10" height="10" rx="3" fill="#50695a" opacity="0.3"/>
          <rect x="22" y="22" width="10" height="10" rx="3" fill="#50695a" opacity="0.6"/>
        </svg>
      )
    }
    return (
      <svg width="68" height="48" viewBox="0 0 80 60" fill="none">
        <circle cx="40" cy="30" r="22" fill="#587d50" opacity="0.85"/>
        <circle cx="40" cy="30" r="10" fill="#f0f4ea"/>
      </svg>
    )
  }
  if (type === 'figma') {
    return (
      <div className="preview-figma-mock">
        <div style={{ width: '42%', height: '5px', background: '#617366', opacity: 0.6, borderRadius: '3px' }} />
        <div style={{ width: '85%', height: '4px', background: '#96a69a', opacity: 0.4, borderRadius: '2px' }} />
        <div style={{ width: '60%', height: '4px', background: '#96a69a', opacity: 0.4, borderRadius: '2px' }} />
      </div>
    )
  }
  if (type === 'link') {
    return (
      <div className="preview-mosaic">
        <div style={{ background: 'rgba(110, 128, 94, 0.25)', borderRadius: '6px' }} />
        <div style={{ background: 'rgba(180, 160, 130, 0.3)', borderRadius: '6px' }} />
        <div style={{ background: 'rgba(100, 130, 150, 0.25)', borderRadius: '6px' }} />
        <div style={{ background: 'rgba(120, 140, 110, 0.2)', borderRadius: '6px' }} />
      </div>
    )
  }
  return (
    <div className="preview-doc-mock">
      <FileText size={26} strokeWidth={1.2} color="#617366" />
    </div>
  )
}

function formatRelativeDocTime(isoDate?: string): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  state: AppState
  now: Date
  onChange: (update: (state: AppState) => AppState) => void
  onCapture: () => void
  onPlan: (dayOffset: number) => void
  onSpace: (id: string) => void
  onOpen: (resource: Resource) => void
  onAddLink: () => void
  onAddFile?: () => void
  onOpenSettings?: () => void
  appIcon: (name: string) => ReactNode
}

export function Home({ state, now, onChange, onCapture, onPlan, onSpace, onOpen, onAddLink, onAddFile, onOpenSettings, appIcon }: Props) {
  const [day, setDay] = useState(0)
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null)
  const [zenState, setZenState] = useState(zenTimer.getState())
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  useEffect(() => {
    zenTimer.setOnComplete(() => {
      setDialog('checkpoint')
    })
    return zenTimer.subscribe(setZenState)
  }, [])
  useEffect(() => { if (!undo) return; const timer = window.setTimeout(() => setUndo(null), 8000); return () => window.clearTimeout(timer) }, [undo])
  const [dialog, setDialog] = useState<'checkpoint' | 'digest' | 'reminder' | null>(null)
  const [digestTab, setDigestTab] = useState<'notes' | 'reading' | 'events'>('notes')
  const [page, setPage] = useState(0)
  const [spaceId, setSpaceId] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [note, setNote] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [reminderId, setReminderId] = useState('')
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderWhen, setReminderWhen] = useState('')

  const carouselRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const hasDragged = useRef(false)

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        el.scrollBy({ left: e.deltaY * 1.15, behavior: 'auto' })
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function handleMouseDown(e: React.MouseEvent) {
    if (!carouselRef.current) return
    isDragging.current = true
    hasDragged.current = false
    startX.current = e.pageX - carouselRef.current.offsetLeft
    scrollLeft.current = carouselRef.current.scrollLeft
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !carouselRef.current) return
    const x = e.pageX - carouselRef.current.offsetLeft
    const walk = (x - startX.current) * 1.2
    if (Math.abs(walk) > 4) {
      hasDragged.current = true
    }
    carouselRef.current.scrollLeft = scrollLeft.current - walk
  }

  function handleMouseUp() {
    isDragging.current = false
  }

  function handleDocClick(doc: Resource) {
    if (hasDragged.current) return
    onOpen(doc)
  }

  const resources = state.spaces.flatMap(space => space.resources.map(resource => ({ ...resource, spaceId: space.id })))
  const recentDocs = resources
    .filter(resource => resource.kind !== 'app' && resource.lastOpenedAt && !resource.completedAt)
    .sort((a, b) => Date.parse(b.lastOpenedAt!) - Date.parse(a.lastOpenedAt!))
  const displayDocs = recentDocs.length > 0
    ? recentDocs.slice(0, 6)
    : resources.filter(resource => resource.kind !== 'app').slice(0, 4)
  const recent = recentDocs[0]
  const checkpoint = state.checkpoint && state.spaces.some(space => space.id === state.checkpoint?.spaceId) ? state.checkpoint : undefined
  const resumeSpace = state.spaces.find(space => space.id === (checkpoint?.spaceId || recent?.spaceId)) || state.spaces[0]
  const resumeResource = checkpoint ? resources.find(resource => resource.id === checkpoint.resourceId) : recent
  const apps = resources.filter(resource => resource.kind === 'app').slice(0, 4)
  const selectedDay = new Date(now)
  selectedDay.setDate(selectedDay.getDate() + day)
  const plan = remindersForDay(state, selectedDay)
  const realReminders = state.reminders.filter(item => isRealReminder(item) && !item.done)
  const earlier = realReminders.filter(item => item.dueAt && new Date(item.dueAt).toDateString() !== now.toDateString() && Date.parse(item.dueAt) < now.getTime())
  const links = resources.filter(resource => resource.kind === 'link' && !resource.completedAt && !/figma\.com\/(design|file)/i.test(resource.target))
  const events = realEvents(state).filter(event => Date.parse(event.endAt) >= now.getTime()).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
  const dayEvents = events.filter(event => new Date(event.startAt).toDateString() === selectedDay.toDateString())
  const schedule = [
    ...plan.map(item => ({ id: item.id, title: item.title, time: item.dueAt!, reminder: item as Reminder | undefined, event: undefined })),
    ...dayEvents.map(event => ({ id: event.id, title: event.title, time: event.startAt, reminder: undefined, event }))
  ].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
  const selectedReminder = state.reminders.find(item => item.id === reminderId)
  const digestItems = digestTab === 'notes' ? realReminders : digestTab === 'reading' ? links : events
  const totalPages = Math.max(1, Math.ceil(digestItems.length / 4))
  const visiblePage = Math.min(page, totalPages - 1)

  function getAppDocuments(appResource: Resource) {
    const isFigma = /figma/i.test(appResource.name)
    const isIllustrator = /illustrator/i.test(appResource.name)

    const allDocs = state.spaces.flatMap(space =>
      space.resources
        .filter(res => res.id !== appResource.id && res.kind !== 'app')
        .map(res => ({ ...res, spaceName: space.name }))
    )

    const filtered = allDocs.filter(doc => {
      if (isFigma) {
        return doc.kind === 'link' && (/figma\.com/i.test(doc.target) || /figma/i.test(doc.name) || doc.id.startsWith('starter-figma') || doc.id.startsWith('figma-'))
      }
      if (isIllustrator) {
        return doc.kind === 'file' && (/\.(ai|eps|svg|ait)$/i.test(doc.target) || /\.(ai|eps|svg)$/i.test(doc.name) || doc.id.startsWith('starter-ai') || doc.id.startsWith('ai-'))
      }
      return doc.target.toLowerCase().includes(appResource.name.toLowerCase())
    })

    return filtered.sort((a, b) => {
      const timeA = Date.parse(a.lastOpenedAt || a.createdAt) || 0
      const timeB = Date.parse(b.lastOpenedAt || b.createdAt) || 0
      return timeB - timeA
    })
  }

  function handleNewDocument(appResource: Resource) {
    if (/figma/i.test(appResource.name)) {
      onOpen({
        id: crypto.randomUUID(),
        name: 'Новый холст Figma',
        kind: 'link',
        target: 'https://figma.new',
        createdAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString()
      })
    } else {
      onOpen(appResource)
    }
  }

  function handleAddDocument(appResource: Resource) {
    if (/figma/i.test(appResource.name)) {
      onAddLink()
    } else if (/illustrator/i.test(appResource.name)) {
      if (onAddFile) onAddFile()
      else onSpace(resumeSpace?.id || state.spaces[0]?.id || '')
    } else {
      onSpace(resumeSpace?.id || state.spaces[0]?.id || '')
    }
  }

  function editCheckpoint() {
    setSpaceId(resumeSpace?.id || '')
    setResourceId(resumeResource?.id || '')
    setNote(checkpoint?.note || '')
    setNextStep(checkpoint?.nextStep || '')
    setDialog('checkpoint')
  }

  function saveCheckpoint() {
    if (!spaceId || (!note.trim() && !nextStep.trim())) return
    onChange(previous => ({ ...previous, checkpoint: { spaceId, resourceId: resourceId || undefined, note: note.trim(), nextStep: nextStep.trim(), savedAt: new Date().toISOString() } }))
    setDialog(null)
  }

  function editReminder(item: Reminder) {
    setReminderId(item.id)
    setReminderTitle(item.title)
    setReminderWhen(toLocalInput(item.dueAt))
    setDialog('reminder')
  }

  function updateReminder(update: (item: Reminder) => Reminder) {
    onChange(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === reminderId ? update(item) : item) }))
    setDialog(null)
  }

  function showDigest(tab: typeof digestTab = 'notes') { setDigestTab(tab); setPage(0); setDialog('digest') }

  return <>
    <main className="calm-home" aria-label="Ваш день">
      <div className="calm-heading"><h1>{now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</h1><button className="calm-text-button" onClick={editCheckpoint}>Оставить на завтра <ArrowUpRight size={17} /></button></div>
      <div className="calm-grid">
        <section className="calm-card resume-card" aria-label="Остановились вчера">
          <div className="resume-heading-wrap">
            <span className="empty-orbit resume-orbit">
              <Clock3 size={28} strokeWidth={1.2} />
            </span>
            <h2 className="resume-title">Остановились вчера.</h2>
          </div>

          <div className="resume-carousel-wrap">
            <div
              className="resume-carousel-track"
              ref={carouselRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {displayDocs.map(doc => (
                <button
                  key={doc.id}
                  className="resume-doc-item"
                  onClick={() => handleDocClick(doc)}
                  title={`Открыть ${doc.name}`}
                >
                  <div className={`resume-doc-preview ${getDocPreviewClass(doc)}`}>
                    {renderDocPreview(doc)}
                  </div>
                  <div className="resume-doc-info">
                    <div className="resume-doc-name-row">
                      {renderCompactAppIcon(doc)}
                      <span className="resume-doc-title">{doc.name}</span>
                    </div>
                    <span className="resume-doc-time">{formatRelativeDocTime(doc.lastOpenedAt || doc.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="calm-card plan-card" aria-label="План дня">
          <div className="calm-card-heading"><div className="calm-tabs" aria-label="День плана"><button aria-pressed={day === 0} className={day === 0 ? 'selected' : ''} onClick={() => setDay(0)}>Сегодня</button><button aria-pressed={day === 1} className={day === 1 ? 'selected' : ''} onClick={() => setDay(1)}>Завтра</button></div><button className="calm-icon" aria-label="Добавить дело" onClick={() => onPlan(day)}><Plus size={22} /></button></div>
          <div className="calm-plan-list">
            {schedule.slice(0, 3).map(item => (
              <div key={item.id} className="calm-plan-item">
                <span className="calm-time">{new Date(item.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                <span
                  style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
                  onClick={() => item.reminder ? editReminder(item.reminder) : showDigest('events')}
                >
                  {item.title}
                </span>
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
                ) : (
                  <button
                    style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'grid', placeItems: 'center' }}
                    onClick={() => item.reminder ? editReminder(item.reminder) : showDigest('events')}
                    aria-label="Подробнее"
                  >
                    <ArrowUpRight size={16} />
                  </button>
                )}
              </div>
            ))}
            {!schedule.length && <div className="calm-plan-empty"><span className="empty-orbit"><Clock3 size={29} strokeWidth={1.2} /></span><h2>День пока свободен.</h2><p>Можно выбрать одно важное дело.</p><button className="calm-text-button" onClick={() => onPlan(day)}>Добавить <Plus size={17} /></button></div>}
          </div>
          <div className="plan-bottom">{schedule.length > 3 ? <button className="calm-text-button" onClick={() => showDigest(plan.length > 0 ? 'notes' : 'events')}>Остальное — в обзоре <ArrowRight size={16} /></button> : <span className="calm-meta">Планы можно менять.</span>}{earlier.length > 0 && <button className="calm-text-button" onClick={() => showDigest()}>Осталось с прошлых дней · {earlier.length}</button>}</div>
        </section>

        <section className="calm-card digest-card" aria-labelledby="digest-title">
          <div className="digest-intro"><span className="calm-eyebrow">Когда будет время</span><h2 id="digest-title">Сохранённое</h2></div>
          <div className="digest-choices"><button onClick={() => showDigest('notes')}><FileText size={20} strokeWidth={1.5} /><span>Мысли и дела</span><span className="calm-count">{realReminders.length}</span></button><button onClick={() => showDigest('reading')}><Bookmark size={20} strokeWidth={1.5} /><span>Почитать</span><span className="calm-count">{links.length}</span></button><button onClick={() => showDigest('events')}><Clock3 size={20} strokeWidth={1.5} /><span>События</span><span className="calm-count">{events.length}</span></button></div>
        </section>
      </div>
      <footer className="calm-dock">
        <div className="calm-dock-left">
          <button className="calm-capture" onClick={onCapture}>
            <Plus size={19} />
            Записать
            <kbd>Ctrl Alt Space</kbd>
          </button>
          {zenState.status === 'running' ? (
            <button className="calm-dock-timer active" onClick={() => zenTimer.stop()} title="Остановить сессию фокуса">
              <Timer size={18} />
              <span>Фокус {Math.ceil(zenState.remainingSeconds / 60)} мин</span>
              <small>Завершить</small>
            </button>
          ) : (
            <button className="calm-dock-timer" onClick={() => zenTimer.start(30)} title="Сесть за дело на 30 минут с фоновой музыкой">
              <Timer size={18} />
              <span>Фокус • 30 мин</span>
            </button>
          )}
        </div>
        <PlayerIsland onOpenSettings={onOpenSettings} />
        <div className="calm-apps" aria-label="Приложения">
          {apps.map(resource => (
            <div className="calm-app-wrapper" key={resource.id}>
              <button
                className={`calm-app-btn ${activeAppId === resource.id ? 'active' : ''}`}
                onClick={() => setActiveAppId(current => current === resource.id ? null : resource.id)}
                title={resource.name}
                aria-expanded={activeAppId === resource.id}
              >
                <span className="calm-app-icon">{appIcon(resource.name)}</span>
                <span>{resource.name}</span>
              </button>

              {activeAppId === resource.id && (
                <AppLauncherPopover
                  app={resource}
                  recentDocuments={getAppDocuments(resource)}
                  now={now}
                  appIcon={appIcon}
                  onOpenDocument={(doc) => {
                    onOpen(doc)
                    setActiveAppId(null)
                  }}
                  onOpenApp={(appRes) => {
                    onOpen(appRes)
                    setActiveAppId(null)
                  }}
                  onNewDocument={() => {
                    handleNewDocument(resource)
                    setActiveAppId(null)
                  }}
                  onAddDocument={() => {
                    handleAddDocument(resource)
                    setActiveAppId(null)
                  }}
                  onClose={() => setActiveAppId(null)}
                />
              )}
            </div>
          ))}
        </div>
      </footer>
    </main>

    {dialog === 'checkpoint' && <Dialog title="С чего продолжим?" onClose={() => setDialog(null)}>
      <div className="calm-form"><label>Следующий шаг<input value={nextStep} onChange={event => setNextStep(event.target.value)} maxLength={100} /></label><label>Что стоит помнить · необязательно<textarea rows={2} value={note} onChange={event => setNote(event.target.value)} maxLength={180} /></label></div>
      <details className="calm-details"><summary>{state.spaces.find(space => space.id === spaceId)?.name || 'Выбрать пространство'} · контекст</summary><div className="calm-form"><label>Пространство<select value={spaceId} onChange={event => { setSpaceId(event.target.value); setResourceId('') }}>{state.spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label><label>С чего продолжить<select value={resourceId} onChange={event => setResourceId(event.target.value)}><option value="">Открыть пространство</option>{state.spaces.find(space => space.id === spaceId)?.resources.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label></div></details>
      <div className="calm-dialog-actions">{checkpoint && <button className="calm-text-button" onClick={() => { onChange(previous => ({ ...previous, checkpoint: undefined })); setDialog(null) }}>Уже закончено</button>}<button className="calm-primary" disabled={!spaceId || (!note.trim() && !nextStep.trim())} onClick={saveCheckpoint}>Оставить на завтра <Check size={18} /></button></div>
    </Dialog>}
    {dialog === 'reminder' && selectedReminder && <Dialog title="Как удобно вам" onClose={() => setDialog(null)}><div className="calm-form"><label>Дело<input value={reminderTitle} onChange={event => setReminderTitle(event.target.value)} /></label><label>Когда<input type="datetime-local" value={reminderWhen} onChange={event => setReminderWhen(event.target.value)} /></label></div><div className="calm-postpone"><button onClick={() => updateReminder(item => postponeReminder(item, 'hour'))}>Через час</button><button onClick={() => updateReminder(item => postponeReminder(item, 'tomorrow'))}>Завтра в 9:00</button><button onClick={() => updateReminder(item => ({ ...item, dueAt: null, notifiedAt: undefined }))}>Без времени</button></div><div className="calm-dialog-actions"><button className="calm-text-button" onClick={() => { const saved = selectedReminder; updateReminder(item => ({ ...item, done: true })); setUndo({ label: 'Дело отмечено сделанным', restore: () => onChange(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === saved.id ? saved : item) })) }) }}><Check size={18} />Сделано</button><button className="calm-primary" disabled={!reminderTitle.trim()} onClick={() => updateReminder(item => ({ ...item, title: reminderTitle.trim(), dueAt: fromLocalInput(reminderWhen), notifiedAt: item.dueAt === fromLocalInput(reminderWhen) ? item.notifiedAt : undefined }))}>Сохранить</button></div></Dialog>}

    {dialog === 'digest' && <Dialog title="Сохранённое" onClose={() => setDialog(null)}><div className="calm-tabs digest-tabs">{(['notes', 'reading', 'events'] as const).map(tab => <button key={tab} className={digestTab === tab ? 'selected' : ''} onClick={() => { setDigestTab(tab); setPage(0) }}>{tab === 'notes' ? 'Мысли и дела' : tab === 'reading' ? 'Почитать' : 'События'}</button>)}</div><div className="calm-digest-list">
      {digestTab === 'notes' && realReminders.slice(visiblePage * 4, visiblePage * 4 + 4).map(item => <button key={item.id} onClick={() => editReminder(item)}><span><strong>{item.title}</strong><small>{item.dueAt ? formatDue(item.dueAt) : 'Без срока'}</small></span><ArrowUpRight size={18} /></button>)}
      {digestTab === 'reading' && links.slice(visiblePage * 4, visiblePage * 4 + 4).map(item => <div className="calm-reading-row" key={item.id}><button onClick={() => onOpen(item)}><span><strong>{item.name}</strong><small>{state.spaces.find(space => space.id === item.spaceId)?.name}</small></span><ArrowUpRight size={18} /></button><button className="calm-icon" aria-label={`Прочитано: ${item.name}`} onClick={() => onChange(previous => ({ ...previous, spaces: previous.spaces.map(space => ({ ...space, resources: space.resources.map(resource => resource.id === item.id ? { ...resource, completedAt: new Date().toISOString() } : resource) })) }))}><Check size={18} /></button></div>)}
      {digestTab === 'events' && events.slice(visiblePage * 4, visiblePage * 4 + 4).map(event => <div className="calm-event-row" key={event.id}><strong>{event.title}</strong><small>{formatDue(event.startAt)}</small></div>)}
      {(digestTab === 'notes' ? realReminders.length : digestItems.length) === 0 && <p className="calm-digest-empty">{digestTab === 'notes' ? 'Мысли можно записывать без срока.' : digestTab === 'reading' ? 'Сохраните ссылку, к которой хочется вернуться.' : 'Здесь появятся ваши события. Календарь пока не подключён.'}</p>}
    </div><div className="calm-dialog-actions"><div className="calm-pagination">{totalPages > 1 && <><button className="calm-icon" disabled={!visiblePage} onClick={() => setPage(visiblePage - 1)} aria-label="Назад"><ChevronLeft size={18} /></button><span>{visiblePage + 1} / {totalPages}</span><button className="calm-icon" disabled={visiblePage + 1 === totalPages} onClick={() => setPage(visiblePage + 1)} aria-label="Далее"><ChevronRight size={18} /></button></>}</div>{digestTab !== 'events' && <button className="calm-primary" onClick={() => { setDialog(null); digestTab === 'reading' ? onAddLink() : onCapture() }}><Plus size={18} />{digestTab === 'reading' ? 'Сохранить ссылку' : 'Записать'}</button>}</div></Dialog>}
    {undo && <div className="calm-undo" role="status"><span>{undo.label}</span><button onClick={() => { undo.restore(); setUndo(null) }}>Вернуть</button></div>}
  </>
}



