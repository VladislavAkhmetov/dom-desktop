import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Clock3, Mic } from 'lucide-react'
import { Dialog } from './Dialog'
import { formatDue, fromLocalInput, toLocalInput, parseCapture } from './reminders'
import { planTime } from './dayModel'
import { localDate } from '../shared/state'

interface Props {
  initialWhen: string
  onClose: () => void
  onSave: (title: string, dueAt: string | null, plannedDate?: string | null, kind?: 'note' | 'task') => unknown
  onVoiceHint: () => void
}

export function Capture({ initialWhen, onClose, onSave, onVoiceHint }: Props) {
  const [draft] = useState(() => { try { const value = JSON.parse(sessionStorage.getItem('dom-capture-details') || 'null'); if (!value || typeof value.raw !== 'string') return null; return { raw: value.raw as string, manualDay: typeof value.manualDay === 'string' ? value.manualDay : undefined, manualWhen: typeof value.manualWhen === 'string' ? value.manualWhen : undefined, manualTitle: typeof value.manualTitle === 'string' ? value.manualTitle : undefined, defaultDay: typeof value.defaultDay === 'string' ? value.defaultDay : undefined, startedAt: typeof value.startedAt === 'string' ? value.startedAt : undefined } } catch { return null } })
  const [raw, setRaw] = useState(() => draft?.raw ?? sessionStorage.getItem('dom-capture-draft') ?? '')
  const [manualDay, setManualDay] = useState<string | undefined>(draft?.manualDay)
  const [manualWhen, setManualWhen] = useState<string | undefined>(draft?.manualWhen)
  const [saving, setSaving] = useState(false)
  const [manualTitle, setManualTitle] = useState<string | undefined>(draft?.manualTitle)
  const startedAt = useRef(draft?.startedAt && Number.isFinite(Date.parse(draft.startedAt)) ? new Date(draft.startedAt) : new Date())
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const parsed = parseCapture(raw, startedAt.current)
  const title = manualTitle ?? parsed.title
  const defaultDay = draft && (draft.raw.trim() || draft.manualTitle) ? draft.defaultDay ?? initialWhen.split('T')[0] : initialWhen.split('T')[0]
  const plannedDate = (manualDay ?? parsed.plannedDate ?? defaultDay) || null
  const dueAt = manualWhen === undefined ? parsed.dueAt : fromLocalInput(manualWhen)
  useEffect(() => { sessionStorage.setItem('dom-capture-draft', raw); sessionStorage.setItem('dom-capture-details', JSON.stringify({ raw, manualDay, manualWhen, manualTitle, defaultDay, startedAt: startedAt.current.toISOString() })) }, [raw, manualDay, manualWhen, manualTitle, defaultDay])
  const save = async () => { if (!title.trim() || saving) return; setSaving(true); try { const result = await onSave(title.trim(), dueAt, plannedDate, plannedDate || dueAt ? 'task' : 'note'); if (result !== false) { sessionStorage.removeItem('dom-capture-draft'); sessionStorage.removeItem('dom-capture-details') } } finally { setSaving(false) } }

  return <Dialog title="Что запомнить?" onClose={onClose}>
    <div className="calm-form capture-simple"><label className="visually-hidden" htmlFor="quick-thought">Мысль или дело</label><textarea id="quick-thought" ref={inputRef} rows={3} value={raw} onChange={event => {
      const next = event.target.value
      if (!raw && next) startedAt.current = new Date()
      const nextParsed = parseCapture(next, startedAt.current)
      if (nextParsed.dueAt !== parsed.dueAt) setManualWhen(undefined)
      sessionStorage.setItem('dom-capture-draft', next)
      setRaw(next); setManualTitle(undefined)
    }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); save() } }} /></div>
    {!raw && <p className="capture-example">Например: «Завтра в 18 забрать заказ».</p>}
    <div className="capture-options" aria-label="Когда напомнить">
      <button aria-pressed={!plannedDate && !dueAt} onClick={() => { setManualDay(''); setManualWhen(''); setRaw(title) }}>Запись</button>
      <button aria-pressed={plannedDate === localDate(planTime(0))} onClick={() => setManualDay(localDate(planTime(0))!)}>Сегодня</button>
      <button aria-pressed={plannedDate === localDate(planTime(1))} onClick={() => setManualDay(localDate(planTime(1))!)}>Завтра</button>
    </div>
    <div className="capture-result" aria-live="polite"><Clock3 size={16} /><span>{dueAt ? `Напомнить: ${formatDue(dueAt)}` : plannedDate ? `Дело на ${new Date(`${plannedDate}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · без напоминания` : 'Останется в сохранённом'}</span></div>
    <details className="calm-details"><summary>Изменить детали</summary><div className="capture-fields calm-form"><label>Название<input value={title} onChange={event => setManualTitle(event.target.value)} /></label><label>День выполнения<input type="date" value={plannedDate || ''} onChange={event => setManualDay(event.target.value)} /></label><label>Напомнить<input type="datetime-local" value={manualWhen ?? toLocalInput(parsed.dueAt)} onChange={event => setManualWhen(event.target.value)} /></label></div></details>
    <div className="calm-dialog-actions"><button className="calm-text-button" onClick={() => { inputRef.current?.focus(); onVoiceHint() }}><Mic size={17} />Голосом · Win + H</button><button className="calm-primary" onClick={save} disabled={!title.trim() || saving}>Сохранить <ArrowRight size={17} /></button></div>
  </Dialog>
}
