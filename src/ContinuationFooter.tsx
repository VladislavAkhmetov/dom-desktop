import { AppWindow, ArrowRight, Layers } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Resource } from './types'
import { FileTypeBadge } from './FileTypeBadge'
import { FluidButton } from './FluidMotion'

/*
 * Shared footer of a continuation: [primary] [N вкладок] [stacked file marks · N файлов ▾].
 * Used by the «Мой день» resume card and the space page threshold so both stay identical.
 */
export function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10, mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

type Props = {
  primaryLabel: string
  onPrimary?: () => void
  primaryAttrs?: Record<string, string | boolean>
  pending?: boolean
  tabs: { title?: string; url?: string }[]
  onTabs?: () => void
  documents: Resource[]
  onDocument?: (document: Resource) => void
  documentLabel?: (document: Resource) => ReactNode
}

export function ContinuationFooter({ primaryLabel, onPrimary, primaryAttrs, pending, tabs, onTabs, documents, onDocument, documentLabel }: Props) {
  return (
    <div className="resume-footer-row continuation-footer">
      {onPrimary && (
        <div className="resume-actions">
          <FluidButton className="resume-primary" disabled={pending} onClick={() => onPrimary()} {...primaryAttrs}>
            {pending ? 'Открываем…' : primaryLabel}
            <ArrowRight size={18} />
          </FluidButton>
        </div>
      )}
      {tabs.length > 0 && (
        <button
          type="button"
          className="resume-chip resume-tabs-pill resume-material resume-tab-group"
          disabled={pending || !onTabs}
          onClick={onTabs}
          title={tabs.map(tab => tab.title || tab.url).join('\n')}
        >
          <Layers size={18} aria-hidden="true" />
          <span>{tabs.length} {plural(tabs.length, 'вкладка', 'вкладки', 'вкладок')}</span>
        </button>
      )}
      {documents.length > 0 && (
        <details className="resume-files" aria-label="Состав продолжения">
          <summary className="resume-chip" title={documents.map(document => document.name).join('\n')}>
            <span className="resume-files-stack" aria-hidden="true">
              {documents.slice(0, 4).map(document => <FileTypeBadge key={document.id} name={document.name} />)}
              {documents.length > 4 && <span className="file-badge file-badge-more">+{documents.length - 4}</span>}
            </span>
            <span>{documents.length} {plural(documents.length, 'файл', 'файла', 'файлов')}</span>
          </summary>
          <div className="resume-files-panel">
            {documents.map(document => (
              <button className="resume-material" key={document.id} disabled={pending || !onDocument} onClick={() => onDocument?.(document)} title={`${document.name} · ${document.kind === 'window' ? 'окно программы' : 'программа по умолчанию'}`}>
                {document.kind === 'window' ? <AppWindow size={18} aria-hidden="true" /> : <FileTypeBadge name={document.name} />}
                <span>{documentLabel ? documentLabel(document) : document.name}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
