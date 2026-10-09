import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, Check, Clock3, PenLine, Sparkles } from 'lucide-react'
import { formatDue, parseCapture } from './reminders'

interface Props {
  onSave: (title: string, dueAt: string | null, plannedDate?: string | null, kind?: 'note' | 'task') => unknown
  onAssistant: (draft?: string) => void
  mode?: 'note' | 'ai'
  onModeChange?: (mode: 'note' | 'ai') => void
  autoFocus?: boolean
  showModes?: boolean
}

export function QuickEntry({ onSave, onAssistant, mode: controlledMode, onModeChange, autoFocus = false, showModes = true }: Props) {
  const [localMode, setMode] = useState<'note' | 'ai'>('note')
  const mode = controlledMode ?? localMode
  const [error, setError] = useState('')
  const [note, setNote] = useState(() => sessionStorage.getItem('dom-quick-draft') || '')
  const [saving, setSaving] = useState(false)
  const [question, setQuestion] = useState(() => sessionStorage.getItem('dom-ai-draft') || '')
  useEffect(() => { sessionStorage.setItem('dom-ai-draft', question) }, [question])
  const [saved, setSaved] = useState(false)
  const [draftAnchor] = useState(() => { const saved = sessionStorage.getItem('dom-quick-anchor'); return saved && Number.isFinite(Date.parse(saved)) ? new Date(saved) : new Date() })
  const startedAt = useRef(draftAnchor)
  useEffect(() => { if (note.trim()) sessionStorage.setItem('dom-quick-anchor', startedAt.current.toISOString()); else sessionStorage.removeItem('dom-quick-anchor') }, [note])
  const input = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!autoFocus) return
    const frame = requestAnimationFrame(() => input.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [autoFocus, mode])
  const draft = mode === 'note' ? note : question
  const parsed = parseCapture(note, startedAt.current)
  function selectMode(next: typeof mode) { setMode(next); onModeChange?.(next); setSaved(false); setError(''); input.current?.focus() }

  return <section className={`quick-entry ${mode === 'ai' ? 'ai-mode' : ''}`} aria-label="Быстрый ввод">
    {showModes && <div className="quick-entry-heading">
      <div className="entry-modes" aria-label="Действие с текстом">
        <button aria-pressed={mode === 'note'} onClick={() => selectMode('note')}><PenLine size={16} /> Записать</button>
        <button aria-pressed={mode === 'ai'} onClick={() => selectMode('ai')}><Sparkles size={16} /> Спросить ИИ</button>
      </div>
    </div>}
    <form className="entry-form" onSubmit={async event => {
      event.preventDefault()
      if (!draft.trim() || saving) return
      if (mode === 'ai') { onAssistant(question); return }
      setSaving(true)
      setError('')
      try { const result = await onSave(parsed.title, parsed.dueAt, parsed.plannedDate, parsed.kind); if (result !== false) { setNote(''); sessionStorage.removeItem('dom-quick-draft'); setSaved(true); startedAt.current = new Date(); input.current?.focus() } else setError('Не удалось сохранить. Попробуйте ещё раз.') }
      catch { setError('Не удалось сохранить. Попробуйте ещё раз.') }
      finally { setSaving(false) }
    }}>
      <textarea id="quick-entry" ref={input} value={draft} rows={1} autoComplete="off" aria-label={mode === 'note' ? 'Мысль или дело' : 'Запрос помощнику'}
        placeholder={mode === 'note' ? 'Мысль, дело, напоминание…' : 'Вопрос или задача…'}
        title={mode === 'note' ? 'Сохранить · Enter' : 'Отправить · Enter'}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && (!draft.includes('\n') || event.ctrlKey || event.metaKey)) { event.preventDefault(); if (!saving) event.currentTarget.form?.requestSubmit() } }}
        onChange={event => { if (!note.trim()) startedAt.current = new Date(); setSaved(false); if (mode === 'note') { setNote(event.target.value); sessionStorage.setItem('dom-quick-draft', event.target.value) } else setQuestion(event.target.value) }} />
      <button type="submit" disabled={!draft.trim() || saving} aria-label={mode === 'note' ? 'Сохранить запись' : 'Открыть запрос в помощнике'} title={mode === 'note' ? 'Сохранить · Enter' : 'Открыть помощника'}>{mode === 'note' ? <ArrowRight size={20} /> : <ArrowUp size={20} />}</button>
    </form>
    {error && <p className="entry-error" role="alert">{error}</p>}
    {mode === 'note' && (saved || parsed.dueAt || parsed.plannedDate) ? <div className="entry-footnote" aria-live="polite">
      {saved ? <span className="entry-saved"><Check size={14} /> Сохранено.</span>
        : <span className="entry-due"><Clock3 size={16} />{parsed.dueAt ? formatDue(parsed.dueAt) : parsed.plannedDate ? `Дело на ${parsed.plannedDate}` : 'Запись'}</span>}
    </div> : null}
  </section>
}
