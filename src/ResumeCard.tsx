import type { CSSProperties } from 'react'
import { ArrowRight, ArrowUpRight, Check, FileText, Folder, Globe2, Pencil } from 'lucide-react'
import { ActionMenu } from './ActionMenu'
import { FluidButton } from './FluidMotion'
import type { Resource } from './types'
import type { ResumeResult } from './resumeContext'
import type { latestContinuation } from './workContexts'
import './resume.css'
import { isCabinetPreview } from './cabinetMode'

type Continuation = NonNullable<ReturnType<typeof latestContinuation>>
interface Props {
  continuation: Continuation
  now: Date
  hidden: boolean
  style: CSSProperties
  pending: boolean
  result?: ResumeResult
  onResume: (retry?: boolean) => void
  onSpace: () => void
  onEdit: () => void
  onComplete: () => void
  onDocument: (resource: Resource) => void
  onTabs: () => void
}

function activityLabel(at: string | undefined, now: Date) {
  if (!at || Number.isNaN(Date.parse(at))) return ''
  const date = new Date(at)
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const day = date >= today ? 'Сегодня' : date >= yesterday ? 'Вчера' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  return `${day}, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
}

export function ResumeCard({ continuation: { space, context, documents, tabs, at, title }, now, hidden, style, pending, result, onResume, onSpace, onEdit, onComplete, onDocument, onTabs }: Props) {
  const checkpoint = context.checkpoint
  const failures = result?.failures.filter(failure => documents.some(document => document.id === failure.id)) || []
  return <section className="calm-card resume-card context-resume" data-widget="resume" hidden={hidden} style={style} aria-label="Продолжить" aria-busy={pending}>
    <div className="resume-card-heading">
      <div className="resume-heading-context"><button className="resume-space-link" onClick={onSpace} title={`Открыть пространство «${space.name}»`}><Folder size={16} aria-hidden="true" /><span>{space.name}</span><ArrowUpRight size={14} aria-hidden="true" /></button>{activityLabel(at, now) && <time className="resume-time" dateTime={at}>{activityLabel(at, now)}</time>}</div>
      <ActionMenu label="Действия с продолжением" actions={[{ label: 'Настроить продолжение', icon: <Pencil size={16} />, onSelect: onEdit }, { label: isCabinetPreview ? 'Убрать пространство в архив' : 'Дело завершено', icon: <Check size={16} />, onSelect: onComplete }]} />
    </div>
    <div className="resume-main"><h2 className="resume-title">{isCabinetPreview ? 'Продолжить работу' : title}</h2>{checkpoint?.nextStep && (isCabinetPreview || checkpoint.nextStep !== title) && <p className="resume-next-step">{checkpoint.nextStep}</p>}{checkpoint?.note && <p className="resume-note">{checkpoint.note}</p>}</div>
    {(documents.length > 0 || tabs.length > 0) && <div className="resume-contents" aria-label="Состав продолжения">
      {documents.slice(0, 2).map(document => <button className="resume-material" key={document.id} disabled={pending} onClick={() => onDocument(document)} title={`${document.name} · программа по умолчанию`}><FileText size={16} aria-hidden="true" /><span>{!isCabinetPreview && document.name === title ? 'Документ' : document.name}</span></button>)}
      {documents.length > 2 && <details className="resume-more-documents"><summary>Ещё документов: {documents.length - 2}</summary>{documents.slice(2).map(document => <button className="resume-material" key={document.id} disabled={pending} onClick={() => onDocument(document)}><FileText size={16} /><span>{document.name}</span></button>)}</details>}
      {tabs.length > 0 && <button className="resume-material resume-tab-group" disabled={pending} onClick={onTabs} title={tabs.map(tab => tab.title || tab.url).join('\n')}><Globe2 size={16} aria-hidden="true" /><span>{isCabinetPreview ? 'Вкладки пространства' : 'Вкладки дела'}</span><small>{tabs.length}</small></button>}
    </div>}
    <div className="resume-actions"><FluidButton className="resume-primary" disabled={pending} onClick={() => onResume()}>{pending ? 'Открываем…' : 'Продолжить'}<ArrowRight size={18} /></FluidButton></div>
    {failures.length > 0 && <div className="resume-errors" role="status"><details><summary>Не удалось открыть документов: {failures.length}</summary>{failures.map(failure => <p key={failure.id}><strong>{failure.name}</strong><span>{failure.error}</span></p>)}</details><button className="calm-text-button" disabled={pending} onClick={() => onResume(true)}>Повторить неоткрытые <ArrowRight size={15} /></button></div>}
  </section>
}
