import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useSpring, useTransform, useReducedMotion } from 'motion/react'
import { calmTween, motionDuration } from './motion'
import { ArrowRight, Bell, CalendarDays, Check, ChevronDown, Clock3, Mail, Music2, Pause, Sparkles, Timer, Video, X } from 'lucide-react'
import type { AppState, AppUpdate, Resource } from './types'
import { attentionLine, selectAttentionSignal, type AttentionSignal } from './attentionModel'
import { snoozeReminder } from './dayModel'
import { isRealReminder, realEvents } from './dayModel'
import { selectGreeting } from './greetingModel'
import { zenTimer } from './focus/zenTimer'
import { audioManager } from './player/audioStream'
import { sound } from './sound'
import { bridge } from './bridge'
import './attention.css'

import { useUpdateReady } from './useUpdateReady'
export { useUpdateReady }

export function MemoryReliefSignal({ freedMB }: { freedMB: number }) {
  const reduced = useReducedMotion()
  const springValue = useSpring(0, { stiffness: 120, damping: 22 })
  const displayMB = useTransform(springValue, val =>
    val >= 1024 ? `${(val / 1024).toFixed(1)} ГБ` : `${Math.round(val)} МБ`
  )
  const [text, setText] = useState('0 МБ')

  useEffect(() => {
    if (reduced) {
      setText(freedMB >= 1024 ? `${(freedMB / 1024).toFixed(1)} ГБ` : `${Math.round(freedMB)} МБ`)
      return
    }
    const unsub = displayMB.on('change', v => setText(v))
    springValue.set(freedMB)
    return () => unsub()
  }, [freedMB, reduced, springValue, displayMB])

  useEffect(() => {
    sound.playCalmExhale()
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={calmTween(motionDuration.state)}
      className="island-memory-relief"
    >
      <span className="island-relief-dot" aria-hidden="true" />
      <span>Кабинет на паузе · Освобождено {text} ОЗУ</span>
    </motion.div>
  )
}

type Signal = AttentionSignal

// Signals that already rang this session (shared by the dashboard and browser islands, so a reminder rings once).
const rungSignals = new Set<string>()
const ringStarted = new Map<string, number>()
const RING_MS = 2400
/** A reminder rings when it has just become due (≤ 2 min ago, the clock ticks every 30 s) — not when an old one is restored. */
export function shouldRing(signal: Signal | null, state: AppState, now: Date) {
  if (!signal || rungSignals.has(signal.id)) return false
  if (signal.type === 'event') return true
  if (signal.type !== 'task' || signal.id.endsWith(':soon')) return false
  const due = state.reminders.find(item => item.id === signal.targetId)?.dueAt
  return Boolean(due) && now.getTime() - Date.parse(due!) <= 120_000
}

const categories: Record<Signal['type'], string> = { task: 'Напоминание', mail: 'Письмо', event: 'Встреча', focus: 'Фокус', music: 'Музыка', activity: 'Помощник', update: 'Обновление' }

export function AttentionIsland({ state, now, onChange, onOpen, onSpace, onFocus, compact = false, browser = false, layoutLocked = false, onDay, onAssistant, onUndo, memoryRelief, update: propUpdate }: { state: AppState; now: Date; onChange: (update: (state: AppState) => AppState) => unknown; onOpen: (resource: Resource) => void; onSpace: (id: string) => void; onFocus: () => void; compact?: boolean; browser?: boolean; layoutLocked?: boolean; onDay?: () => void; onAssistant?: () => void; onUndo?: (taskId: string, noticeId: string) => void; memoryRelief?: { freedMB: number; id: string } | null; update?: AppUpdate | null }) {
  const activeUpdate = propUpdate !== undefined ? propUpdate : null
  const [focus, setFocus] = useState(zenTimer.getState())
  const [playing, setPlaying] = useState(audioManager.getIsPlaying())
  const [expanded, setExpanded] = useState(false)
  const [openedSignal, setOpenedSignal] = useState<Signal | null>(null)
  const [wide, setWide] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<{ taskId: string; noticeId: string } | null>(null)
  const [greetingPhase, setGreetingPhase] = useState<'active' | 'dissolving' | 'manifesting' | 'settled'>(() => {
    if (browser || compact) return 'settled'
    return 'active'
  })
  const [isHovered, setIsHovered] = useState(false)
  const hasBeenHovered = useRef(false)
  const hoverLeaveTimer = useRef<number | null>(null)
  const [greeting] = useState(() => selectGreeting(state, now))
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const detailsId = useId()
  const [position, setPosition] = useState({ top: 0, left: 0 })
  useEffect(() => zenTimer.subscribe(setFocus), [])
  useEffect(() => audioManager.subscribe(() => setPlaying(audioManager.getIsPlaying())), [])
  const islandUndoTimerRef = useRef<number | undefined>(undefined)
  const clearIslandUndoTimer = useCallback(() => {
    if (islandUndoTimerRef.current) {
      window.clearTimeout(islandUndoTimerRef.current)
      islandUndoTimerRef.current = undefined
    }
  }, [])
  const startIslandUndoTimer = useCallback((delay = 6000) => {
    clearIslandUndoTimer()
    islandUndoTimerRef.current = window.setTimeout(() => setUndo(null), delay)
  }, [clearIslandUndoTimer])

  useEffect(() => {
    if (undo) startIslandUndoTimer(6000)
    else clearIslandUndoTimer()
    return () => clearIslandUndoTimer()
  }, [undo, startIslandUndoTimer, clearIslandUndoTimer])
  useEffect(() => {
    if (greetingPhase === 'settled') return
    if (isHovered) return

    if (greetingPhase === 'active') {
      const delay = hasBeenHovered.current ? 2000 : 4500
      const timer = window.setTimeout(() => {
        setGreetingPhase('dissolving')
      }, delay)
      return () => window.clearTimeout(timer)
    }

    if (greetingPhase === 'dissolving') {
      const dissolveDuration = Math.round(greeting.text.length * 16 + 680) + 120
      const timer = window.setTimeout(() => {
        setGreetingPhase('manifesting')
      }, dissolveDuration)
      return () => window.clearTimeout(timer)
    }

    if (greetingPhase === 'manifesting') {
      const timer = window.setTimeout(() => {
        setGreetingPhase('settled')
      }, 380)
      return () => window.clearTimeout(timer)
    }
  }, [greetingPhase, isHovered, greeting.text.length])

  function handleMouseEnter() {
    if (hoverLeaveTimer.current) {
      window.clearTimeout(hoverLeaveTimer.current)
      hoverLeaveTimer.current = null
    }
    setIsHovered(true)
    hasBeenHovered.current = true
    if (greetingPhase === 'dissolving') {
      setGreetingPhase('active')
    }
  }

  function handleMouseLeave(event?: React.MouseEvent) {
    if (event?.currentTarget && event?.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)) {
      return
    }
    if (hoverLeaveTimer.current) window.clearTimeout(hoverLeaveTimer.current)
    hoverLeaveTimer.current = window.setTimeout(() => {
      setIsHovered(false)
    }, 150)
  }

  useEffect(() => {
    if (!expanded) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setExpanded(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [expanded])
  const attentionState = browser ? { ...state, reminders: state.reminders.filter(isRealReminder), events: realEvents(state) } : state
  const liveSignal = selectAttentionSignal(attentionState, now, focus, { ambient: !browser, music: playing ? audioManager.getStation().name : undefined, update: activeUpdate })
  const hasSignal = Boolean(liveSignal)
  useLayoutEffect(() => { if (!layoutLocked && !expanded) setWide(hasSignal) }, [hasSignal, layoutLocked, expanded])
  useLayoutEffect(() => {
    if (!browser || !expanded) return
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect(), content = panel.current
      if (!anchor || !content) return
      const width = content.offsetWidth, height = content.offsetHeight
      setPosition({ left: Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8)), top: Math.max(8, Math.min(anchor.bottom + 10, window.innerHeight - height - 8)) })
    }
    place()
    const observer = new ResizeObserver(place)
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [browser, expanded])
  const signal = expanded ? openedSignal : liveSignal
  const [ringingId, setRingingId] = useState<string | null>(null)
  useEffect(() => {
    if (!liveSignal) return
    if (!rungSignals.has(liveSignal.id)) {
      const ring = shouldRing(liveSignal, state, now)
      rungSignals.add(liveSignal.id)
      if (ring) {
        if (liveSignal.type === 'event') sound.playEventSoon(); else sound.playReminderChime()
        ringStarted.set(liveSignal.id, Date.now())
      }
    }
    // Derived from the start time, so a re-run (StrictMode, signal flicker) keeps or ends the sway correctly.
    const left = (ringStarted.get(liveSignal.id) || 0) + RING_MS - Date.now()
    if (left <= 0) return
    setRingingId(liveSignal.id)
    const timer = window.setTimeout(() => setRingingId(null), left)
    return () => window.clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSignal?.id])
  const ringing = ringingId !== null && ringingId === liveSignal?.id
  const mail = signal?.type === 'mail' ? state.mailMessages?.find(item => item.id === signal.targetId) : undefined
  const event = signal?.type === 'event' ? state.events?.find(item => item.id === signal.targetId) : undefined
  const eventSpace = event?.spaceId ? state.spaces.find(space => space.id === event.spaceId && !space.archivedAt) : undefined
  const icon = signal?.type === 'mail' ? <Mail size={17} /> : signal?.type === 'event' ? <Video size={17} /> : signal?.type === 'focus' ? <Timer size={17} /> : signal?.type === 'music' ? <Music2 size={17} /> : signal?.type === 'task' ? <Clock3 size={17} /> : signal ? <Sparkles size={17} /> : <Bell size={17} />
  const liveMail = liveSignal?.type === 'mail' ? state.mailMessages?.find(item => item.id === liveSignal.targetId) : undefined
  const line = attentionLine(liveSignal, liveMail?.from)
  function close() { setExpanded(false); setError(''); trigger.current?.focus() }
  function toggle() {
    if (greetingPhase !== 'settled') {
      setGreetingPhase('settled')
    }
    if (expanded) close()
    else {
      setOpenedSignal(liveSignal)
      setError('')
      setExpanded(true)
    }
  }
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
    sound.playTaskDone()
    void change(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === current.targetId ? { ...item, done: true } : item), dismissedNotices: [...(previous.dismissedNotices || []), current.id].slice(-500) }), () => { if (onUndo) onUndo(current.targetId, current.id); else setUndo({ taskId: current.targetId, noticeId: current.id }); close() })
  }
  function snooze() {
    if (signal?.type !== 'task') return
    const id = signal.targetId
    sound.playReminderLater()
    void change(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === id ? snoozeReminder(item, 15) : item) }))
  }
  const details = expanded && <section ref={panel} className={'island-details' + (browser ? ' browser-island-details' : '')} style={browser ? { position: 'fixed', ...position, transform: 'none' } : undefined} id={detailsId} role="dialog" aria-modal="false" aria-label="Сейчас">
        <div className="island-detail-heading"><span>{signal ? categories[signal.type] : browser ? 'Сейчас' : 'Уведомления'}</span><button aria-label="Свернуть уведомление" onClick={close}><X size={16} /></button></div>
        <h2>{signal?.title || (browser ? 'Нет срочного' : 'Нет уведомлений')}</h2>
        {(signal?.detail || mail?.snippet || event?.location) && <p>{signal?.detail || mail?.snippet || event?.location}</p>}
        {signal?.type === 'mail' && mail && <div className="island-context">{mail.from}</div>}
        {signal?.type === 'event' && event && <div className="island-context"><time dateTime={event.startAt}>{new Date(event.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>{eventSpace && <span>{eventSpace.name}</span>}</div>}
        {signal?.type === 'focus' && focus.status === 'running' && <time className="island-focus-clock" aria-label="Осталось времени">{String(Math.floor(focus.remainingSeconds / 60)).padStart(2, '0')}:{String(focus.remainingSeconds % 60).padStart(2, '0')}</time>}
        {signal && <div className="island-actions">
          {signal.type === 'task' ? (
            <>
              <button className="island-primary" disabled={saving} onClick={completeTask}><Check size={16} />Сделано</button>
              <button disabled={saving} onClick={snooze}><Clock3 size={15} />Напомнить через 15 мин</button>
              {(browser || signal.id.endsWith(':soon')) && <button disabled={saving} onClick={dismiss}>Скрыть</button>}
            </>
          ) : signal.type === 'focus' ? (
            focus.status === 'running' ? (
              <>
                <button className="island-primary" onClick={() => { close(); onFocus() }}>Открыть таймер<ArrowRight size={16} /></button>
                <button onClick={() => { zenTimer.stop(); close() }}>Завершить сессию</button>
              </>
            ) : (
              <button className="island-primary" onClick={() => { zenTimer.reset(); close() }}>Закрыть</button>
            )
          ) : signal.type === 'music' ? (
            <button onClick={() => { audioManager.pause(); close() }}><Pause size={16} />Пауза</button>
          ) : signal.type === 'update' ? (
            signal.manual ? (
              <>
                <button className="island-primary" onClick={() => { void bridge.openReleasePage?.(); dismiss() }}>Скачать<ArrowRight size={15} /></button>
                <button disabled={saving} onClick={dismiss}>Позже</button>
              </>
            ) : <button disabled={saving} onClick={dismiss}>Понятно</button>
          ) : (
            <>
              {signal.url && (
                <button className="island-primary" disabled={saving} onClick={() => { onOpen({ id: signal.targetId, name: signal.title, kind: 'link', target: signal.url!, createdAt: now.toISOString() }); dismiss() }}>
                  {signal.type === 'mail' ? 'Открыть письмо' : 'Войти во встречу'}<ArrowRight size={15} />
                </button>
              )}
              {signal.type === 'event' && eventSpace && (
                <button onClick={() => { onSpace(eventSpace.id); close() }}>Открыть материалы<ArrowRight size={15} /></button>
              )}
              {signal.type === 'activity' && onAssistant && (
                <button className="island-primary" onClick={() => { close(); onAssistant() }}>Открыть ИИ<ArrowRight size={15} /></button>
              )}
              <button disabled={saving} onClick={dismiss}>Скрыть</button>
            </>
          )}
        </div>}
        {error && <p className="island-error" role="alert">{error}</p>}
        {browser && onDay && <button className="browser-island-day" onClick={() => { close(); onDay() }}>План дня<ArrowRight size={15} /></button>}
      </section>
  const undoNotice = undo && (
    <div
      className={'calm-undo' + (browser ? ' browser-island-undo' : '')}
      role="status"
      onMouseEnter={clearIslandUndoTimer}
      onMouseLeave={() => startIslandUndoTimer(3000)}
    >
      <span>Дело завершено</span>
      <button
        disabled={saving}
        onClick={() => {
          const current = undo
          void change(
            previous => ({
              ...previous,
              reminders: previous.reminders.map(item => item.id === current.taskId ? { ...item, done: false } : item),
              dismissedNotices: previous.dismissedNotices?.filter(item => item !== current.noticeId)
            }),
            () => setUndo(null)
          )
        }}
      >
        Вернуть
      </button>
      <button aria-label="Закрыть" onClick={() => setUndo(null)}>
        <X size={15} />
      </button>
    </div>
  )
  const showGreeting = (greetingPhase === 'active' || greetingPhase === 'dissolving') && !browser && !compact && !memoryRelief
  const isManifesting = greetingPhase === 'manifesting' && !browser && !compact && !memoryRelief
  return <>
    <div
      className={'universal-island' + (compact ? ' is-compact' : '') + (browser ? ' browser-attention-island' : '') + (expanded ? ' is-expanded' : '')}
      data-wide={browser ? wide : undefined}
      data-signal={browser ? hasSignal : undefined}
      ref={root}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseOver={handleMouseEnter}
      onMouseOut={handleMouseLeave}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !panel.current?.contains(event.relatedTarget)) setExpanded(false) }}
    >
      {showGreeting && (
        <div
          className={`ambient-greeting ${greetingPhase === 'dissolving' ? 'is-dissolving' : ''}`}
          aria-live="polite"
          onClick={event => {
            if ((event.target as HTMLElement).closest('.ambient-greeting-action')) return
            setGreetingPhase('manifesting')
          }}
        >
          <span className="ambient-greeting-text">
            {greeting.text.split('').map((char, index) => (
              <span
                key={index}
                className="ambient-greeting-char"
                style={{
                  transitionDelay: greetingPhase === 'dissolving' ? `${index * 16}ms` : '0ms'
                }}
              >
                {char}
              </span>
            ))}
          </span>
          {greeting.action && (
            <button
              type="button"
              className="ambient-greeting-action"
              title={greeting.action.label}
              aria-label={greeting.action.label}
              onClick={event => {
                event.stopPropagation()
                setGreetingPhase('settled')
                if (greeting.action?.type === 'focus') {
                  onFocus()
                } else if (greeting.action?.type === 'day' && onDay) {
                  onDay()
                }
              }}
            >
              {greeting.action.type === 'focus' ? <Timer size={16} /> : <CalendarDays size={16} />}
            </button>
          )}
        </div>
      )}
      <button
        ref={trigger}
        className={
          'island-trigger' +
          (browser ? ' browser-day-pulse' : '') +
          (showGreeting ? ' is-hidden-for-greeting' : '') +
          (isManifesting ? ' is-manifesting' : '') +
          (ringing && !expanded && state.liveHints !== false ? ' is-ringing' : '')
        }
        aria-label={memoryRelief ? `Кабинет на паузе · Освобождено ${memoryRelief.freedMB} МБ ОЗУ` : browser ? line ? 'Центр внимания: ' + line : 'Открыть центр внимания' : signal ? 'Сейчас: ' + signal.title : 'Уведомления'}
        aria-expanded={expanded}
        aria-controls={expanded ? detailsId : undefined}
        tabIndex={showGreeting ? -1 : 0}
        aria-hidden={showGreeting ? true : undefined}
        onClick={toggle}
        title={memoryRelief ? `Освобождено памяти: ${memoryRelief.freedMB} МБ` : browser ? line || 'Центр внимания · план дня' : compact ? signal?.title || 'Уведомления' : undefined}
      >
        {memoryRelief ? (
          <MemoryReliefSignal freedMB={memoryRelief.freedMB} />
        ) : browser ? (
          <>
            <span className="browser-island-icon" aria-hidden="true">{icon}{hasSignal && <span className="browser-island-dot" />}</span>
            <span className="browser-island-line" aria-live="polite">{line || (wide ? 'Нет срочного' : '')}</span>
          </>
        ) : (
          <>
            <span className={'island-symbol' + (signal?.type === 'focus' && focus.status === 'running' ? ' is-running' : '')}>{icon}</span>
            <span className="island-summary"><strong>{signal?.title || 'Уведомления'}</strong>{signal?.label && <small>{signal.label}</small>}</span>
            <ChevronDown size={13} className="island-chevron" />
          </>
        )}
      </button>
      {browser ? createPortal(details, document.body) : details}
    </div>
    {browser ? createPortal(undoNotice, document.body) : undoNotice}
  </>
}
