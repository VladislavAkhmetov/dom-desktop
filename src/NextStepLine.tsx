import { useEffect, useRef, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'

/*
 * Optional next step of a space, shown as a quiet line under the space name («Дальше: …»).
 * Click to edit in place: Enter or leaving the field saves, Escape cancels, an empty value removes
 * the step. Without onSave it is read-only. Used on the «Мой день» card, the space page and the new tab.
 */
type Props = { step?: string; onSave?: (step: string) => void; className?: string }

export function NextStepLine({ step = '', onSave, className = '' }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(step)
  const input = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)
  useEffect(() => { if (!editing) setDraft(step) }, [step, editing])
  useEffect(() => { if (editing) input.current?.focus() }, [editing])

  if (editing && onSave) {
    const commit = () => {
      setEditing(false)
      if (cancelled.current) { cancelled.current = false; return }
      if (draft.trim() !== step.trim()) onSave(draft.trim())
    }
    return (
      <label className={`next-step-line is-editing ${className}`}>
        <span className="next-step-label">Дальше:</span>
        <input
          ref={input}
          value={draft}
          maxLength={160}
          placeholder="Что сделать, когда вернётесь"
          aria-label="Следующий шаг"
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); input.current?.blur() }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelled.current = true; input.current?.blur() }
          }}
        />
      </label>
    )
  }
  if (!step) {
    return onSave ? (
      <button type="button" className={`next-step-line is-empty ${className}`} onClick={() => setEditing(true)}>
        <Plus size={16} aria-hidden="true" />Следующий шаг
      </button>
    ) : null
  }
  const text = <><span className="next-step-label">Дальше:</span><span className="next-step-text">{step}</span></>
  return onSave ? (
    <button type="button" className={`next-step-line ${className}`} onClick={() => setEditing(true)} aria-label={`Следующий шаг: ${step}. Изменить`}>
      {text}<Pencil size={14} className="next-step-edit" aria-hidden="true" />
    </button>
  ) : <p className={`next-step-line ${className}`}>{text}</p>
}
