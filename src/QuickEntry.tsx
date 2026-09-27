import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, Check, Clock3, PenLine, Sparkles } from 'lucide-react'
import { formatDue, parseCapture } from './reminders'
import { assistantRoles, type AssistantRole } from './assistantModel'

interface Props {
  onSave: (title: string, dueAt: string | null, plannedDate?: string | null, kind?: 'note' | 'task') => unknown
  onAssistant: (draft?: string) => void
  assistantRole: AssistantRole
}

export function QuickEntry({ onSave, onAssistant, assistantRole }: Props) {
  const [mode, setMode] = useState<'note' | 'ai'>('note')
  const [note, setNote] = useState(() => sessionStorage.getItem('dom-quick-draft') || '')
  const [saving, setSaving] = useState(false)
  const [question, setQuestion] = useState('')
  const [saved, setSaved] = useState(false)
  const [draftAnchor] = useState(() => { const saved = sessionStorage.getItem('dom-quick-anchor'); return saved && Number.isFinite(Date.parse(saved)) ? new Date(saved) : new Date() })
  const startedAt = useRef(draftAnchor)
  useEffect(() => { if (note.trim()) sessionStorage.setItem('dom-quick-anchor', startedAt.current.toISOString()); else sessionStorage.removeItem('dom-quick-anchor') }, [note])
  const input = useRef<HTMLTextAreaElement>(null)
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
    <form className="entry-form" onSubmit={async event => {
      event.preventDefault()
      if (!draft.trim()) return
      if (mode === 'ai') { onAssistant(question); return }
      setSaving(true)
      try { const result = await onSave(parsed.title, parsed.dueAt, parsed.plannedDate, parsed.kind); if (result !== false) { setNote(''); sessionStorage.removeItem('dom-quick-draft'); setSaved(true); startedAt.current = new Date(); input.current?.focus() } }
      finally { setSaving(false) }
    }}>
      <textarea id="quick-entry" ref={input} value={draft} rows={1} autoComplete="off" aria-label={mode === 'note' ? 'Мысль или дело' : 'Запрос помощнику'}
        placeholder={mode === 'note' ? 'Мысль, дело, напоминание…' : 'Что хочется упростить?'}
        title={mode === 'note' ? 'Например: завтра в 18 забрать заказ · Нажмите Enter для сохранения' : 'Нажмите Enter для отправки запроса'}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && (!draft.includes('\n') || event.ctrlKey || event.metaKey)) { event.preventDefault(); if (!saving) event.currentTarget.form?.requestSubmit() } }}
        onChange={event => { if (!note.trim()) startedAt.current = new Date(); setSaved(false); if (mode === 'note') { setNote(event.target.value); sessionStorage.setItem('dom-quick-draft', event.target.value) } else setQuestion(event.target.value) }} />
      <button type="submit" disabled={!draft.trim() || saving} aria-label={mode === 'note' ? 'Сохранить запись' : 'Открыть запрос в помощнике'} title={mode === 'note' ? 'Сохранить · Enter' : 'Открыть помощника'}>{mode === 'note' ? <ArrowRight size={20} /> : <ArrowUp size={20} />}</button>
    </form>
    {(mode === 'ai' || saved || note.trim()) ? <div className="entry-footnote" aria-live="polite">
      {mode === 'ai' ? <span>Роль и контекст выбираете в помощнике.</span>
        : saved ? <span className="entry-saved"><Check size={14} /> Сохранено. Можно отпустить эту мысль.</span>
        : <><span className="entry-parsed-title" title={parsed.title}>{parsed.title}</span><span className="entry-due"><Clock3 size={14} />{parsed.dueAt ? formatDue(parsed.dueAt) : parsed.plannedDate ? `Дело на ${parsed.plannedDate}` : 'Запись'}</span></>}
    </div> : null}
  </section>
}
