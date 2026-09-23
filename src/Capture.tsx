import { useRef, useState } from 'react'
import { ArrowRight, Clock3, Mic } from 'lucide-react'
import { Dialog } from './Dialog'
import { formatDue, fromLocalInput, parseCapture, toLocalInput } from './reminders'
import { planTime } from './dayModel'

interface Props {
  initialWhen: string
  onClose: () => void
  onSave: (title: string, dueAt: string | null) => void
  onVoiceHint: () => void
}

export function Capture({ initialWhen, onClose, onSave, onVoiceHint }: Props) {
  const [raw, setRaw] = useState('')
  const [manualWhen, setManualWhen] = useState<string>()
  const [manualTitle, setManualTitle] = useState<string>()
  const startedAt = useRef(new Date())
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const parsed = parseCapture(raw, startedAt.current)
  const title = manualTitle ?? parsed.title
  const when = manualWhen ?? (toLocalInput(parsed.dueAt) || initialWhen)
  const dueAt = fromLocalInput(when)
  const save = () => { if (title.trim()) onSave(title.trim(), dueAt) }

  return <Dialog title="Что запомнить?" onClose={onClose}>
    <div className="calm-form capture-simple"><label className="visually-hidden" htmlFor="quick-thought">Мысль или дело</label><textarea id="quick-thought" ref={inputRef} rows={3} value={raw} onChange={event => {
      const next = event.target.value
      const nextParsed = parseCapture(next, startedAt.current)
      if (nextParsed.dueAt !== parsed.dueAt) setManualWhen(undefined)
      setRaw(next); setManualTitle(undefined)
    }} onKeyDown={event => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); save() } }} /></div>
    {!raw && <p className="capture-example">Например: «Завтра в 18 забрать заказ».</p>}
    <div className="capture-options" aria-label="Когда напомнить">
      <button aria-pressed={!when} onClick={() => setManualWhen('')}>Без срока</button>
      <button onClick={() => setManualWhen(toLocalInput(planTime(0).toISOString()))}>Сегодня</button>
      <button onClick={() => setManualWhen(toLocalInput(planTime(1).toISOString()))}>Завтра</button>
    </div>
    <div className="capture-result" aria-live="polite"><Clock3 size={16} /><span>{dueAt ? formatDue(dueAt) : 'Останется в сохранённом'}</span></div>
    <details className="calm-details"><summary>Изменить детали</summary><div className="capture-fields calm-form"><label>Название<input value={title} onChange={event => setManualTitle(event.target.value)} /></label><label>Когда<input type="datetime-local" value={when} onChange={event => setManualWhen(event.target.value)} /></label></div></details>
    <div className="calm-dialog-actions"><button className="calm-text-button" onClick={() => { inputRef.current?.focus(); onVoiceHint() }}><Mic size={17} />Голосом · Win + H</button><button className="calm-primary" onClick={save} disabled={!title.trim()}>Сохранить <ArrowRight size={17} /></button></div>
  </Dialog>
}
