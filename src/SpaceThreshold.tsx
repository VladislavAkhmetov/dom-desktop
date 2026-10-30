import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FolderPlus, Pencil, Plus, Timer } from 'lucide-react'
import type { Resource } from './types'
import { FluidButton } from './FluidMotion'
import { NextStepLine } from './NextStepLine'

/*
 * «Порог» пространства: фокус и точка возвращения к задаче (PRODUCT.md → Продолжение).
 * Главный экран контекста:
 * - Свежесть (когда открывали / статус активности)
 * - Следующий шаг (ключевая опора Calm Tech)
 * - Контекстная памятка / заметка по задаче
 * - Действия возобновления (продолжить в браузере, войти в фокус)
 * Вкладки и файлы живут в нижней карточке-кабинете и здесь больше не дублируются.
 */
type Props = {
  nextStep?: string
  note?: string
  lastAt?: string
  tabs: { id: string; title?: string; url?: string }[]
  files?: Resource[]
  pending?: boolean
  onOpenTabs: () => void
  onOpenFile?: (file: Resource) => void
  onSaveStep?: (step: string) => void
  onSaveNote?: (note: string) => void
  onFocus?: () => void
  /** Day drafts: the date (title size) and a quiet hint instead of the next step; the browser opens even when empty. */
  dayNote?: string
  dayHint?: string
  primaryLabel?: string
  onPromote?: () => void
}

export function lastOpened(at?: string) {
  if (!at || Number.isNaN(Date.parse(at))) return ''
  const date = new Date(at)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (date >= today) return `Открывали сегодня в ${time}`
  if (date >= yesterday) return `Открывали вчера в ${time}`
  return `Открывали ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
}

function ThresholdNote({ note = '', onSave }: { note?: string; onSave?: (note: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(note || '')
  }, [note, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (editing && onSave) {
    const commit = () => {
      setEditing(false)
      if (draft.trim() !== (note || '').trim()) {
        onSave(draft.trim())
      }
    }
    return (
      <div className="space-threshold-note-edit">
        <input
          ref={inputRef}
          value={draft}
          maxLength={300}
          placeholder="Памятка или важные детали по задаче…"
          aria-label="Заметка пространства"
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              inputRef.current?.blur()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setDraft(note || '')
              setEditing(false)
            }
          }}
        />
      </div>
    )
  }

  if (note) {
    return onSave ? (
      <button
        type="button"
        className="space-threshold-note-bubble"
        onClick={() => setEditing(true)}
        title="Кликните, чтобы изменить заметку"
        aria-label={`Заметка: ${note}. Изменить`}
      >
        <span className="space-threshold-note-text">{note}</span>
        <Pencil size={13} className="space-threshold-note-edit-icon" aria-hidden="true" />
      </button>
    ) : (
      <p className="space-threshold-note">{note}</p>
    )
  }

  if (onSave) {
    return (
      <button
        type="button"
        className="space-threshold-add-note"
        onClick={() => setEditing(true)}
      >
        <Plus size={14} aria-hidden="true" />
        <span>Заметка</span>
      </button>
    )
  }

  return null
}

export function SpaceThreshold({
  nextStep,
  note,
  lastAt,
  tabs,
  pending,
  onOpenTabs,
  onSaveStep,
  onSaveNote,
  onFocus,
  dayNote,
  dayHint,
  primaryLabel = 'Открыть вкладки',
  onPromote
}: Props) {
  const when = dayNote ? dayHint : lastOpened(lastAt)
  const hasTabs = tabs.length > 0
  const actionLabel = hasTabs ? primaryLabel : (dayNote ? primaryLabel : 'Открыть браузер')

  return (
    <section className="space-threshold" aria-label="Точка возвращения">
      {(when || dayNote) && (
        <div className="space-threshold-header">
          {dayNote ? (
            <p className="space-threshold-day">{dayNote}</p>
          ) : (
            when && <span className="space-threshold-when">{when}</span>
          )}
        </div>
      )}

      {dayNote ? null : (
        <NextStepLine step={nextStep} onSave={onSaveStep} className="space-threshold-next" />
      )}

      {!dayNote && <ThresholdNote note={note} onSave={onSaveNote} />}

      <div className="space-threshold-actions">
        <FluidButton
          className="resume-primary space-threshold-primary"
          disabled={pending}
          onClick={onOpenTabs}
          data-workspace-navigation={true}
        >
          {pending ? 'Открываем…' : actionLabel}
          <ArrowRight size={18} />
        </FluidButton>

        {onFocus && !dayNote && (
          <button
            type="button"
            className="space-threshold-focus"
            onClick={onFocus}
            title="Запустить 25-минутный фокус для этой задачи"
          >
            <Timer size={16} aria-hidden="true" />
            <span>Фокус</span>
          </button>
        )}

        {onPromote && (
          <button
            type="button"
            className="space-threshold-promote"
            onClick={onPromote}
          >
            <FolderPlus size={16} aria-hidden="true" />
            <span>Сделать пространством</span>
          </button>
        )}
      </div>
    </section>
  )
}
