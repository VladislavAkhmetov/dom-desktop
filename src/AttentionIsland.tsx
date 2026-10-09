import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bell, Check, ChevronDown, Clock3, Mail, Music2, Pause, Sparkles, Timer, Video, X } from 'lucide-react'
import type { AppState, Resource } from './types'
import { selectAttention, type Attention } from './attentionModel'
import { zenTimer } from './focus/zenTimer'
import { audioManager } from './player/audioStream'
import './attention.css'

type Signal = Omit<Attention, 'type'> & { type: Attention['type'] | 'music' | 'activity'; detail?: string }
const categories: Record<Signal['type'], string> = { task: 'Напоминание', mail: 'Письмо', event: 'Встреча', focus: 'Фокус', music: 'Музыка', activity: 'Помощник' }

export function AttentionIsland({ state, now, onChange, onOpen, onSpace, onFocus, compact = false }: { state: AppState; now: Date; onChange: (update: (state: AppState) => AppState) => unknown; onOpen: (resource: Resource) => void; onSpace: (id: string) => void; onFocus: () => void; compact?: boolean }) {
  const [focus, setFocus] = useState(zenTimer.getState())
  const [playing, setPlaying] = useState(audioManager.getIsPlaying())
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<{ taskId: string; noticeId: string } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => zenTimer.subscribe(setFocus), [])
  useEffect(() => audioManager.subscribe(() => setPlaying(audioManager.getIsPlaying())), [])
  useEffect(() => { if (!undo) return; const timer = window.setTimeout(() => setUndo(null), 8000); return () => window.clearTimeout(timer) }, [undo])
  useEffect(() => {
    if (!expanded) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setExpanded(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [expanded])
  let signal: Signal | null = selectAttention(state, now, focus)
  const activity = [...(state.aiJournal || [])].reverse().find(item => !state.dismissedNotices?.includes('activity:' + item.id) && (item.status === 'running' || item.status !== 'cancelled' && now.getTime() - Date.parse(item.at) < 5 * 60000))
  if (!signal && activity) signal = { id: 'activity:' + activity.id, targetId: activity.id, type: 'activity', title: activity.status === 'running' ? 'Помощник работает' : activity.status === 'error' ? 'Ошибка запроса' : 'Ответ готов', label: activity.model, detail: activity.result || activity.error }
  if (!signal && playing) signal = { id: 'music', targetId: '', type: 'music', title: audioManager.getStation().name, label: 'Сейчас играет' }
  if (!signal && focus.status === 'completed') signal = { id: 'focus-completed', targetId: '', type: 'focus', title: 'Фокус завершён', label: focus.task?.title || `${focus.durationMinutes} мин` }
  const mail = signal?.type === 'mail' ? state.mailMessages?.find(item => item.id === signal.targetId) : undefined
  const event = signal?.type === 'event' ? state.events?.find(item => item.id === signal.targetId) : undefined
  const eventSpace = event?.spaceId ? state.spaces.find(space => space.id === event.spaceId && !space.archivedAt) : undefined
  const icon = signal?.type === 'mail' ? <Mail size={17} /> : signal?.type === 'event' ? <Video size={17} /> : signal?.type === 'focus' ? <Timer size={17} /> : signal?.type === 'music' ? <Music2 size={17} /> : signal?.type === 'task' ? <Clock3 size={17} /> : signal ? <Sparkles size={17} /> : <Bell size={17} />
  function close() { setExpanded(false); setError(''); trigger.current?.focus() }
  async function change(update: (state: AppState) => AppState, complete: () => void = close) {
    if (saving) return
    setSaving(true); setError('')
    try { if (await onChange(update) === false) setError('Не удалось сохранить'); else complete() }
    catch { setError('Не удалось сохранить') }
    finally { setSaving(false) }
  }
  function dismiss() {
    if (!signal) return
    const id = signal.id
    void change(previous => ({ ...previous, dismissedNotices: [...(previous.dismissedNotices || []), id].slice(-500) }))
  }
  function completeTask() {
    if (signal?.type !== 'task') return
    const current = signal
    void change(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === current.targetId ? { ...item, done: true } : item), dismissedNotices: [...(previous.dismissedNotices || []), current.id].slice(-500) }), () => { setUndo({ taskId: current.targetId, noticeId: current.id }); close() })
  }
  function snooze() {
    if (signal?.type !== 'task') return
    const id = signal.targetId
    const dueAt = new Date(Date.now() + 15 * 60000).toISOString()
    void change(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === id ? { ...item, dueAt, notifiedAt: undefined, trigger: undefined } : item) }))
  }
  return <>
    <div className={'universal-island' + (compact ? ' is-compact' : '') + (expanded ? ' is-expanded' : '')} ref={root} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false) }}>
      <button ref={trigger} className="island-trigger" aria-label={signal ? 'Сейчас: ' + signal.title : 'Уведомления'} aria-expanded={expanded} aria-controls={expanded ? 'island-details' : undefined} onClick={() => setExpanded(value => !value)} title={compact ? signal?.title || 'Уведомления' : undefined}>
        <span className={'island-symbol' + (signal?.type === 'focus' && focus.status === 'running' ? ' is-running' : '')}>{icon}</span>
        <span className="island-summary"><strong>{signal?.title || 'Уведомления'}</strong>{signal?.label && <small>{signal.label}</small>}</span><ChevronDown size={13} className="island-chevron" />
      </button>
      {expanded && <section className="island-details" id="island-details" role="dialog" aria-modal="false" aria-label="Сейчас">
        <div className="island-detail-heading"><span>{signal ? categories[signal.type] : 'Уведомления'}</span><button aria-label="Свернуть уведомление" onClick={close}><X size={16} /></button></div>
        <h2>{signal?.title || 'Нет уведомлений'}</h2>
        {(signal?.detail || mail?.snippet || event?.location) && <p>{signal?.detail || mail?.snippet || event?.location}</p>}
        {signal?.type === 'mail' && mail && <div className="island-context">{mail.from}</div>}
        {signal?.type === 'event' && event && <div className="island-context"><time dateTime={event.startAt}>{new Date(event.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>{eventSpace && <span>{eventSpace.name}</span>}</div>}
        {signal?.type === 'focus' && focus.status === 'running' && <time className="island-focus-clock" aria-label="Осталось времени">{String(Math.floor(focus.remainingSeconds / 60)).padStart(2, '0')}:{String(focus.remainingSeconds % 60).padStart(2, '0')}</time>}
        {signal && <div className="island-actions">
          {signal.type === 'task' ? <><button className="island-primary" disabled={saving} onClick={completeTask}><Check size={16} />Сделано</button><button disabled={saving} onClick={snooze}><Clock3 size={15} />Напомнить через 15 мин</button></>
          : signal.type === 'focus' ? focus.status === 'running' ? <><button className="island-primary" onClick={() => { close(); onFocus() }}>Открыть таймер<ArrowRight size={16} /></button><button onClick={() => { zenTimer.stop(); close() }}>Завершить сессию</button></> : <button className="island-primary" onClick={() => { zenTimer.reset(); close() }}>Закрыть</button>
          : signal.type === 'music' ? <button onClick={() => { audioManager.pause(); close() }}><Pause size={16} />Пауза</button>
          : <>{signal.url && <button className="island-primary" disabled={saving} onClick={() => { onOpen({ id: signal.targetId, name: signal.title, kind: 'link', target: signal.url!, createdAt: now.toISOString() }); dismiss() }}>{signal.type === 'mail' ? 'Открыть письмо' : 'Войти во встречу'}<ArrowRight size={15} /></button>}{signal.type === 'event' && eventSpace && <button onClick={() => { onSpace(eventSpace.id); close() }}>Открыть материалы<ArrowRight size={15} /></button>}<button disabled={saving} onClick={dismiss}>Скрыть</button></>}
        </div>}
        {error && <p className="island-error" role="alert">{error}</p>}
      </section>}
    </div>
    {undo && <div className="calm-undo" role="status"><span>Дело завершено</span><button disabled={saving} onClick={() => { const current = undo; void change(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === current.taskId ? { ...item, done: false } : item), dismissedNotices: previous.dismissedNotices?.filter(item => item !== current.noticeId) }), () => setUndo(null)) }}>Вернуть</button><button aria-label="Закрыть" onClick={() => setUndo(null)}><X size={15} /></button></div>}
  </>
}
