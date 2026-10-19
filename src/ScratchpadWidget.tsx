import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Check, Copy, FileText, ListTodo, Trash2 } from 'lucide-react'
import type { AppState } from './types'
import { sound } from './sound'

interface Props {
  state: AppState
  onChange: (update: (prev: AppState) => AppState) => void
  onSaveThought?: (title: string, dueAt: string | null, plannedDate?: string | null, kind?: 'note' | 'task') => unknown
}

export function ScratchpadWidget({ state, onChange, onSaveThought }: Props) {
  const reduced = useReducedMotion()
  const initialText = state.scratchpadNote ?? ''
  const [text, setText] = useState(initialText)
  const [dissolving, setDissolving] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [converted, setConverted] = useState(false)
  const timerRef = useRef<number | null>(null)

  // Sync if external state changes (e.g. cloud or undo)
  useEffect(() => {
    if (state.scratchpadNote !== undefined && state.scratchpadNote !== text) {
      setText(state.scratchpadNote)
    }
  }, [state.scratchpadNote])

  function handleTextChange(value: string) {
    setText(value)
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      onChange(prev => ({ ...prev, scratchpadNote: value }))
    }, 250)
  }

  async function handleCopy() {
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore clipboard error
    }
  }

  function handleClear() {
    if (!text.trim() || dissolving) return
    sound.playCalmExhale()
    const snapshot = text
    setDissolving(snapshot)
    handleTextChange('')
    onChange(prev => ({ ...prev, scratchpadNote: '' }))
    window.setTimeout(() => {
      setDissolving(null)
    }, 320)
  }

  function handleConvertToTask() {
    const trimmed = text.trim()
    if (!trimmed || !onSaveThought) return
    // Take the first non-empty line as task title
    const lines = trimmed.split('\n').map(l => l.replace(/^[-*•]\s*(\[[ x]\]\s*)?/i, '').trim()).filter(Boolean)
    const title = lines[0] || trimmed
    onSaveThought(title, null, null, 'task')
    setConverted(true)
    setTimeout(() => setConverted(false), 2000)
  }

  return (
    <div className="scratchpad-widget" aria-label="Заметки и черновик">
      <div className="scratchpad-header">
        <div className="scratchpad-title">
          <FileText size={17} />
          <strong>Заметки</strong>
        </div>
        <div className="scratchpad-actions">
          {onSaveThought && (
            <button
              type="button"
              className="scratchpad-btn"
              onClick={handleConvertToTask}
              disabled={!text.trim()}
              title="Создать дело из первой строки"
              aria-label="Создать дело из заметки"
            >
              {converted ? <Check size={14} /> : <ListTodo size={14} />}
              <span>{converted ? 'Добавлено' : 'В дела'}</span>
            </button>
          )}
          <button
            type="button"
            className="scratchpad-btn"
            onClick={handleCopy}
            disabled={!text.trim()}
            title="Скопировать текст"
            aria-label="Скопировать текст"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>
          <button
            type="button"
            className="scratchpad-btn icon-only"
            onClick={handleClear}
            disabled={!text.trim() || Boolean(dissolving)}
            title="Очистить заметку"
            aria-label="Очистить заметку"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="scratchpad-body">
        <AnimatePresence>
          {dissolving && (
            <motion.div
              key="dissolving-note"
              className="scratchpad-dissolving"
              aria-hidden="true"
              initial={{ opacity: 1, x: 0, y: 0 }}
              animate={
                reduced
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : {
                      opacity: 0,
                      x: 26,
                      y: -10,
                      filter: 'url(#calm-wind-dissolve) blur(4px)',
                      transition: { duration: 0.28, ease: [0.2, 0, 0, 1] },
                    }
              }
            >
              <pre className="scratchpad-dissolving-text">{dissolving}</pre>
            </motion.div>
          )}
        </AnimatePresence>
        <textarea
          className="scratchpad-textarea"
          value={text}
          onChange={e => handleTextChange(e.target.value)}
          placeholder="Мысли, списки или черновик текста… Всё сохраняется автоматически"
          aria-label="Текст заметки"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
