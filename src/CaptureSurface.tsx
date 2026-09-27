import { useState } from 'react'
import { Capture } from './Capture'
import { usePersistentState } from './statePersistence'
import { bridge } from './bridge'

export function CaptureSurface() {
  const [error, setError] = useState('')
  const [entry, setEntry] = useState(0)
  const { state, commit } = usePersistentState(setError)
  if (!state) return <div className="loading-screen">{error || 'Открываем запись…'}</div>
  return <div className="capture-surface"><Capture key={entry} initialWhen="" onClose={() => bridge.closeCapture?.()} onVoiceHint={() => setError('Для диктовки нажмите Win + H.')} onSave={async (title, dueAt, plannedDate, kind) => {
    const saved = await commit(previous => ({ ...previous, reminders: [{ id: crypto.randomUUID(), title, dueAt, plannedDate, kind, createdAt: new Date().toISOString(), done: false }, ...previous.reminders] }))
    if (saved === true) { bridge.closeCapture?.(); setEntry(value => value + 1) }
    return saved === true
  }} />{error && <p className="capture-surface-error" role="alert">{error}</p>}</div>
}
