import { useEffect, useState } from 'react'
import { ArrowRight, Check, Timer } from 'lucide-react'
import type { AppState, Reminder } from '../types'
import { Dialog } from '../Dialog'
import { isRealReminder, remindersForDay } from '../dayModel'
import { zenTimer } from './zenTimer'
import './focus.css'

interface Props {
  state: AppState
  now: Date
  initialTaskId?: string
  onClose: () => void
  onDay: () => void
  onCapture: () => void
  onComplete: (task: Reminder) => Promise<unknown> | undefined
}

export function FocusPanel({ state, now, initialTaskId, onClose, onDay, onCapture, onComplete }: Props) {
  const [focus, setFocus] = useState(zenTimer.getState())
  const [taskId, setTaskId] = useState(initialTaskId || '')
  const [minutes, setMinutes] = useState(30)
  const [saving, setSaving] = useState(false)
  useEffect(() => zenTimer.subscribe(setFocus), [])
  const todayIds = new Set(remindersForDay(state, now).map(task => task.id))
  const tasks = state.reminders.filter(task => isRealReminder(task) && !task.done && (task.kind === 'task' || task.plannedDate || task.dueAt || task.deadline))
    .sort((a, b) => Number(todayIds.has(b.id)) - Number(todayIds.has(a.id)) || (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity))
  const task = state.reminders.find(item => item.id === focus.task?.id)
  const active = focus.status !== 'idle'
  const canStart = taskId === 'free' || tasks.some(item => item.id === taskId)
  function start() {
    const selected = tasks.find(item => item.id === taskId)
    zenTimer.start(minutes, false, selected ? { id: selected.id, title: selected.title } : undefined)
  }
  function finish() { zenTimer.stop(); onClose() }
  async function completeTask() {
    if (!task || saving) return
    setSaving(true)
    try { if (await onComplete(task) !== false) finish() }
    finally { setSaving(false) }
  }
  const remaining = `${String(Math.floor(focus.remainingSeconds / 60)).padStart(2, '0')}:${String(focus.remainingSeconds % 60).padStart(2, '0')}`
  return <Dialog className={`focus-dialog${active ? ' is-active' : ''}`} title={active ? 'Фокус' : 'На чём сосредоточиться?'} onClose={onClose}>
    {active ? <div className="focus-session">
      {focus.task && <h3>{task?.title || focus.task.title}</h3>}
      <div className="focus-clock">
        <time aria-label={`Оставшееся время ${remaining}`}>{remaining}</time>
        <span>{focus.status === 'completed' ? 'Сессия завершена' : `${focus.durationMinutes} минут`}</span>
        <div className="focus-progress" role="progressbar" aria-label="Сессия фокуса" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(focus.progress * 100)}><i style={{ width: `${focus.progress * 100}%` }} /></div>
      </div>
      <div className="focus-session-actions">
        {task && !task.done && <button className="calm-primary" disabled={saving} onClick={completeTask}><Check size={18} />Дело сделано</button>}
        <button className="calm-text-button" disabled={saving} onClick={finish}>Завершить сессию</button>
        <button className="calm-text-button" onClick={onDay}>К дню<ArrowRight size={17} /></button>
      </div>
    </div> : <>
      <div className="focus-task-list" role="radiogroup" aria-label="Дело для фокуса">
        {tasks.map(item => <label className={`focus-task${taskId === item.id ? ' selected' : ''}`} key={item.id}>
          <input type="radio" name="focus-task" value={item.id} checked={taskId === item.id} onChange={() => setTaskId(item.id)} />
          <span><strong>{item.title}</strong>{todayIds.has(item.id) && <small>Сегодня</small>}</span>
        </label>)}
        <label className={`focus-task${taskId === 'free' ? ' selected' : ''}`}><input type="radio" name="focus-task" value="free" checked={taskId === 'free'} onChange={() => setTaskId('free')} /><span><strong>Свободная сессия</strong></span></label>
      </div>
      {!tasks.length && <button className="calm-text-button focus-add-task" onClick={onCapture}>Записать дело<ArrowRight size={17} /></button>}
      <div className="focus-picker-actions">
        <div className="focus-durations" role="group" aria-label="Длительность сессии">{[15, 30, 60].map(value => <button key={value} aria-pressed={minutes === value} onClick={() => setMinutes(value)}>{value} мин</button>)}</div>
        <button className="calm-primary" disabled={!canStart} onClick={start}><Timer size={18} />Начать</button>
      </div>
    </>}
  </Dialog>
}
