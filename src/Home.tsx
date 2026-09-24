import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, FileText, Globe2, Pencil, Plus, Video } from 'lucide-react'
import type { AppState, Reminder, Resource } from './types'
import { formatDue, fromLocalInput, toLocalInput } from './reminders'
import { isRealReminder, postponeReminder, realEvents, remindersForDay } from './dayModel'
import './home.css'
import { Dialog } from './Dialog'
import { QuickEntry } from './QuickEntry'
import { ActionMenu } from './ActionMenu'
import { resourceAppLabel } from './resourcePresentation'
import type { AssistantRole } from './assistantModel'

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
  state: AppState
  now: Date
  onChange: (update: (state: AppState) => AppState) => void
  onCapture: () => void
  onPlan: (dayOffset: number) => void
  onSpace: (id: string) => void
  onOpen: (resource: Resource) => void
  onAddLink: () => void
  onAssistant: (draft?: string) => void
  onSaveThought: (title: string, dueAt: string | null) => void
  assistantRole: AssistantRole
  onOpenWorkstage?: (spaceId: string, artifactId?: string) => void
}

export function Home({ state, now, onChange, onCapture, onPlan, onSpace, onOpen, onAddLink, onOpenWorkstage, onAssistant, onSaveThought, assistantRole }: Props) {
  const [day, setDay] = useState(0)
  const [undo, setUndo] = useState<{ label: string; restore: () => void } | null>(null)
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

  const resources = state.spaces.flatMap(space => space.resources.map(resource => ({ ...resource, spaceId: space.id })))
  const recentDocs = resources
    .filter(resource => resource.kind !== 'app' && resource.lastOpenedAt && !resource.completedAt)
    .sort((a, b) => Date.parse(b.lastOpenedAt!) - Date.parse(a.lastOpenedAt!))
  const displayDocs = recentDocs.slice(0, 3)
  const savedResearch = state.spaces.flatMap(space => (space.researchArtifacts || []).map(artifact => ({ ...artifact, spaceId: space.id }))).slice(0, 2)
  const recent = recentDocs[0]
  const checkpoint = state.checkpoint && state.spaces.some(space => space.id === state.checkpoint?.spaceId) ? state.checkpoint : undefined
  const latestSession = state.spaces.filter(space => space.activeSession?.tabs.some(tab => tab.url)).sort((a, b) => Date.parse(b.lastActiveAt || '') - Date.parse(a.lastActiveAt || ''))[0]
  const resumeSpace = state.spaces.find(space => space.id === (checkpoint?.spaceId || recent?.spaceId || latestSession?.id)) || state.spaces[0]
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

  function changeTask(item: Reminder, patch: Partial<Reminder>, label: string) {
    const restore = Object.fromEntries(Object.keys(patch).map(key => [key, item[key as keyof Reminder]]))
    onChange(previous => ({ ...previous, reminders: previous.reminders.map(value => value.id === item.id ? { ...value, ...patch } : value) }))
    setUndo({ label, restore: () => onChange(previous => ({ ...previous, reminders: previous.reminders.map(value => value.id === item.id ? { ...value, ...restore } : value) })) })
  }

  function postponeTask(item: Reminder, choice: 'hour' | 'tomorrow') {
    const postponed = postponeReminder(item, choice)
    changeTask(item, { dueAt: postponed.dueAt, notifiedAt: undefined }, choice === 'hour' ? 'Перенесено на час' : 'Перенесено на завтра')
  }

  function showDigest(tab: typeof digestTab = 'notes') { setDigestTab(tab); setPage(0); setDialog('digest') }

  return <>
    <main className="calm-home" aria-label="Ваш день">
      <div className="calm-heading"><h1>{now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</h1><button className="calm-text-button" onClick={editCheckpoint}>Оставить на завтра <ArrowUpRight size={17} /></button></div>
      <div className="calm-grid">
        <section className="calm-card resume-card" aria-label="Продолжение работы">
          <div className="resume-eyebrow"><span className="resume-indicator" />{hasResume ? 'С того места, где остановились' : 'Ваше место для нового'}<span className="resume-space-name">{hasResume ? resumeSpace?.name : ''}</span></div>
          <div className="resume-main">
            <h2 className="resume-title">{resumeTitle}</h2>
            <p className="resume-note">{checkpoint?.note || (hasResume ? 'Всё на месте. Можно спокойно продолжить.' : 'Сохраните мысль или дело. Остальное соберётся постепенно.')}</p>
            <div className="resume-actions"><button className="resume-primary" onClick={hasResume ? continueWork : onCapture}>{hasResume ? 'Продолжить' : 'Записать мысль'}<ArrowRight size={18} /></button>{resumeResource && <span className="resume-target">{renderCompactAppIcon(resumeResource)}{resourceAppLabel(resumeResource)}</span>}</div>
          </div>
          {(displayDocs.length > 0 || savedResearch.length > 0) && <div className="resume-recent" aria-label="Недавно открывали"><span className="resume-recent-label">Под рукой</span><div>{displayDocs.map(doc => <button key={doc.id} onClick={() => onOpen(doc)} title={`Открыть ${doc.name}`}>{renderCompactAppIcon(doc)}<span>{doc.name}</span></button>)}{savedResearch.map(artifact => <button key={artifact.id} onClick={() => onOpenWorkstage ? onOpenWorkstage(artifact.spaceId, artifact.id) : onSpace(artifact.spaceId)} title={`Открыть исследование: ${artifact.query}`}><FileText size={14} /><span>{artifact.query}</span></button>)}</div></div>}
          {!displayDocs.length && !savedResearch.length && hasResume && <button className="resume-context-link" onClick={editCheckpoint}>Уточнить следующий шаг<ArrowUpRight size={14} /></button>}
        </section>

        <section className="calm-card plan-card" aria-label="План дня">
          <div className="calm-card-heading"><div className="calm-tabs" aria-label="День плана"><button aria-pressed={day === 0} className={day === 0 ? 'selected' : ''} onClick={() => setDay(0)}>Сегодня</button><button aria-pressed={day === 1} className={day === 1 ? 'selected' : ''} onClick={() => setDay(1)}>Завтра</button></div><button className="calm-icon" aria-label="Добавить дело" title="Добавить дело" onClick={() => onPlan(day)}><Plus size={22} /></button></div>
          <div className="calm-plan-list">
            {schedule.slice(0, 3).map(item => (
              <div key={item.id} className="calm-plan-item task-row">
                {item.reminder ? <button className="task-check" aria-label={`Завершить: ${item.title}`} title="Отметить сделанным" onClick={() => changeTask(item.reminder!, { done: true }, 'Дело завершено')}><Check size={14} /></button> : <span className="task-event-icon"><CalendarDays size={18} /></span>}
                <button className="plan-item-title" onClick={() => item.reminder ? editReminder(item.reminder) : showDigest('events')}><span>{item.title}</span><time className="calm-time" dateTime={item.time}>{new Date(item.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}{item.event ? ' · Событие' : ''}</time></button>
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
                  { label: 'Завтра в 9:00', icon: <CalendarDays size={16} />, onSelect: () => postponeTask(item.reminder!, 'tomorrow') },
                  { label: 'Через час', icon: <Clock3 size={16} />, onSelect: () => postponeTask(item.reminder!, 'hour') },
                  { label: 'Изменить', icon: <Pencil size={16} />, onSelect: () => editReminder(item.reminder!) }
                ]} /> : null}
              </div>
            ))}
            {!schedule.length && <div className="calm-plan-empty"><span className="empty-orbit"><Clock3 size={29} strokeWidth={1.2} /></span><h2>День пока свободен.</h2><p>Можно выбрать одно важное дело.</p><button className="calm-text-button" onClick={() => onPlan(day)}>Добавить <Plus size={17} /></button></div>}
          </div>
          <div className="plan-bottom">{schedule.length > 3 && <button className="calm-text-button" onClick={() => showDigest(plan.length > 0 ? 'notes' : 'events')}>Ещё {schedule.length - 3} в обзоре <ArrowRight size={16} /></button>}{earlier.length > 0 && <button className="calm-text-button" onClick={() => showDigest()}>С прошлых дней · {earlier.length}</button>}</div>
          <div className="plan-saved" aria-label="Сохранённое">
            <div className="plan-saved-heading"><span>Сохранённое</span><small>Когда будет время</small></div>
            <div className="plan-saved-links">
              <button onClick={() => showDigest('notes')}><FileText size={16} /><span>Мысли и дела</span><small>{realReminders.length}</small></button>
              <button onClick={() => showDigest('reading')}><Bookmark size={16} /><span>Почитать</span><small>{links.length}</small></button>
              <button onClick={() => showDigest('events')}><Clock3 size={16} /><span>События</span><small>{events.length}</small></button>
            </div>
          </div>
        </section>

        <QuickEntry onSave={onSaveThought} onAssistant={onAssistant} assistantRole={assistantRole} />
      </div>
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



