import { useRef, useState } from 'react'
import { ArrowRight, ArrowUp, Check, Clock3, PenLine, Sparkles } from 'lucide-react'
import { formatDue, parseCapture } from './reminders'
import { assistantRoles, type AssistantRole } from './assistantModel'

interface Props {
  onSave: (title: string, dueAt: string | null) => void
  onAssistant: (draft?: string) => void
  assistantRole: AssistantRole
}

export function QuickEntry({ onSave, onAssistant, assistantRole }: Props) {
  const [mode, setMode] = useState<'note' | 'ai'>('note')
  const [note, setNote] = useState('')
  const [question, setQuestion] = useState('')
  const [saved, setSaved] = useState(false)
  const startedAt = useRef(new Date())
  const input = useRef<HTMLInputElement>(null)
  const draft = mode === 'note' ? note : question
  const parsed = parseCapture(note, startedAt.current)
  function selectMode(next: typeof mode) { setMode(next); setSaved(false); input.current?.focus() }

  return <section className={`quick-entry ${mode === 'ai' ? 'ai-mode' : ''}`} aria-label="Быстрый ввод">
    <div className="quick-entry-heading">
      <div className="entry-modes" aria-label="Действие с текстом">
        <button aria-pressed={mode === 'note'} onClick={() => selectMode('note')}><PenLine size={16} /> Записать</button>
        <button aria-pressed={mode === 'ai'} onClick={() => selectMode('ai')}><Sparkles size={16} /> Спросить ИИ</button>
      </div>
      {mode === 'ai' && <button className="entry-connect" onClick={() => onAssistant()}>{assistantRoles[assistantRole].label} <ArrowRight size={14} /></button>}
    </div>
    <form className="entry-form" onSubmit={event => {
      event.preventDefault()
      if (!draft.trim()) return
      if (mode === 'ai') { onAssistant(question); return }
      onSave(parsed.title, parsed.dueAt)
      setNote(''); setSaved(true); startedAt.current = new Date(); input.current?.focus()
    }}>
      <input id="quick-entry" ref={input} value={draft} autoComplete="off" aria-label={mode === 'note' ? 'Мысль или дело' : 'Запрос помощнику'}
        placeholder={mode === 'note' ? 'Мысль, дело, напоминание…' : 'Что хочется упростить?'}
        onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }}
        onChange={event => { if (!note.trim()) startedAt.current = new Date(); setSaved(false); mode === 'note' ? setNote(event.target.value) : setQuestion(event.target.value) }} />
      <button type="submit" disabled={!draft.trim()} aria-label={mode === 'note' ? 'Сохранить запись' : 'Открыть запрос в помощнике'} title={mode === 'note' ? 'Сохранить · Enter' : 'Открыть помощника'}>{mode === 'note' ? <ArrowRight size={20} /> : <ArrowUp size={20} />}</button>
    </form>
    <div className="entry-footnote" aria-live="polite">
      {mode === 'ai' ? <span>Модель не подключена. Роль и контекст выбираете вы.</span>
        : saved ? <span className="entry-saved"><Check size={14} /> Сохранено. Можно отпустить эту мысль.</span>
        : note.trim() ? <><span className="entry-parsed-title" title={parsed.title}>{parsed.title}</span><span className="entry-due"><Clock3 size={14} />{parsed.dueAt ? formatDue(parsed.dueAt) : 'Без срока'}</span></>
        : <><span>Например: завтра в 18 забрать заказ</span><kbd>Enter ↵</kbd></>}
    </div>
  </section>
}
