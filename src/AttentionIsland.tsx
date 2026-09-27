import { useEffect, useState } from 'react'
import { Check, Clock3, Video, X } from 'lucide-react'
import type { AppState, Resource } from './types'
import { selectAttention } from './attentionModel'
import { zenTimer } from './focus/zenTimer'
import './attention.css'

export function AttentionIsland({ state, now, onChange, onOpen, onSpace }: { state: AppState; now: Date; onChange: (update: (state: AppState) => AppState) => void; onOpen: (resource: Resource) => void; onSpace: (id: string) => void }) {
  const [focus, setFocus] = useState(zenTimer.getState())
  const [undo, setUndo] = useState<{ taskId: string; noticeId: string } | null>(null)
  useEffect(() => zenTimer.subscribe(setFocus), [])
  useEffect(() => { if (!undo) return; const timer = window.setTimeout(() => setUndo(null), 8000); return () => window.clearTimeout(timer) }, [undo])
  const signal = selectAttention(state, now, focus)
  const undoBanner = undo && <div className="calm-undo" role="status"><span>Дело завершено</span><button onClick={() => { onChange(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === undo.taskId ? { ...item, done: false } : item), dismissedNotices: previous.dismissedNotices?.filter(item => item !== undo.noticeId) })); setUndo(null) }}>Вернуть</button><button aria-label="Закрыть" onClick={() => setUndo(null)}><X size={15} /></button></div>
  if (!signal) return <><span className="island-idle" aria-hidden="true" />{undoBanner}</>
  function dismiss() { onChange(previous => ({ ...previous, dismissedNotices: [...(previous.dismissedNotices || []), signal!.id].slice(-500) })) }
  const event = signal.type === 'event' ? state.events?.find(item => item.id === signal.targetId) : undefined
  return <><div className={`attention-island ${state.liveHints && signal.type !== 'focus' ? 'live-hint' : ''}`} key={signal.id} aria-label={`${signal.label}: ${signal.title}`}><span>{signal.type === 'event' ? <Video size={14} /> : <Clock3 size={14} />}</span><div><strong title={signal.title}>{signal.title}</strong><small>{signal.label}</small></div>{signal.type === 'task' ? <button aria-label={`Готово: ${signal.title}`} onClick={() => { onChange(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === signal.targetId ? { ...item, done: true } : item), dismissedNotices: [...(previous.dismissedNotices || []), signal.id].slice(-500) })); setUndo({ taskId: signal.targetId, noticeId: signal.id }) }}><Check size={16} /></button> : signal.type === 'focus' ? <button onClick={() => zenTimer.stop()} aria-label="Завершить фокус"><X size={15} /></button> : <><button onClick={() => { if (signal.url) onOpen({ id: signal.targetId, name: signal.title, kind: 'link', target: signal.url, createdAt: now.toISOString() }); else if (event?.spaceId) onSpace(event.spaceId); dismiss() }}>{signal.url ? signal.type === 'mail' ? 'Открыть' : 'Войти' : event?.spaceId ? 'Материалы' : 'Увидел'}</button><button aria-label="Убрать подсказку" onClick={dismiss}><X size={13} /></button></>}</div>{undoBanner}</>
}
