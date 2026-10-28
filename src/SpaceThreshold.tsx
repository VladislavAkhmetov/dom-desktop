import { FolderPlus } from 'lucide-react'
import type { Resource } from './types'
import { ContinuationFooter } from './ContinuationFooter'
import { NextStepLine } from './NextStepLine'

/*
 * «Порог» пространства: точка возвращения (PRODUCT.md → Продолжение).
 * The space name is the page title; here: the optional next step as a quiet editable line
 * («Дальше: …»), the note, when the space was last open, and the same footer as the «Мой день»
 * resume card. The browser opens only through the explicit «Открыть вкладки».
 */
type Props = {
  nextStep?: string
  note?: string
  lastAt?: string
  tabs: { id: string; title?: string; url?: string }[]
  files: Resource[]
  pending?: boolean
  onOpenTabs: () => void
  onOpenFile: (file: Resource) => void
  onSaveStep?: (step: string) => void
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

export function SpaceThreshold({ nextStep, note, lastAt, tabs, files, pending, onOpenTabs, onOpenFile, onSaveStep, dayNote, dayHint, primaryLabel = 'Открыть вкладки', onPromote }: Props) {
  const when = dayNote ? dayHint : lastOpened(lastAt)
  return (
    <section className="space-threshold" aria-label="Точка возвращения">
      {dayNote ? <p className="space-threshold-day">{dayNote}</p> : <NextStepLine step={nextStep} onSave={onSaveStep} className="space-threshold-next" />}
      {note && <p className="space-threshold-note">{note}</p>}
      {when && <p className="space-threshold-when">{when}</p>}
      {(tabs.length > 0 || files.length > 0 || dayNote) && (
        <div className="space-threshold-actions">
          <ContinuationFooter
            primaryLabel={primaryLabel}
            onPrimary={tabs.length || dayNote ? onOpenTabs : undefined}
            primaryAttrs={{ 'data-workspace-navigation': true }}
            pending={pending}
            tabs={tabs}
            onTabs={onOpenTabs}
            documents={files}
            onDocument={onOpenFile}
          />
          {onPromote && tabs.length > 0 && (
            <button type="button" className="space-threshold-promote" onClick={onPromote}><FolderPlus size={16} aria-hidden="true" />Сделать пространством</button>
          )}
        </div>
      )}
    </section>
  )
}
