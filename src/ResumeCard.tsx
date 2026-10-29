import type { CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { enterOffset, fluidInstant, fluidSpring } from './motion'
import { ArrowRight, ArrowUpRight, Check, Folder, Pencil, Plus } from 'lucide-react'
import { ActionMenu } from './ActionMenu'
import { FluidButton } from './FluidMotion'
import type { Resource } from './types'
import type { ResumeResult } from './resumeContext'
import type { latestContinuation } from './workContexts'
import './resume.css'
import { isCabinetPreview } from './cabinetMode'
import { formatSpaceDisplayName } from './cabinetModel'
import type { BrowserTab } from './types'
import { ContinuationFooter } from './ContinuationFooter'
import { NextStepLine } from './NextStepLine'

function tabSubtitle(tabs: BrowserTab[], documents: Resource[], contextTitle: string, spaceDisplayName: string) {
  const parts: string[] = []
  if (contextTitle && contextTitle !== spaceDisplayName && contextTitle !== 'Новое пространство') {
    parts.push(contextTitle)
  }
  const active = tabs.find(t => t.url)
  if (active?.url) {
    try {
      const u = new URL(active.url)
      const rawDomain = u.hostname.replace(/^www\./, '')
      const domain = rawDomain === 'localhost' || rawDomain === '127.0.0.1' ? '' : rawDomain
      const extra = tabs.length - 1
      if (domain) {
        if (extra > 0) {
          const word = extra === 1 ? 'вкладка' : (extra >= 2 && extra <= 4) ? 'вкладки' : 'вкладок'
          parts.push(`${domain} · ещё ${extra} ${word}`)
        } else {
          parts.push(domain)
        }
      } else if (extra > 0) {
        const totalWord = tabs.length === 1 ? 'вкладка' : (tabs.length >= 2 && tabs.length <= 4) ? 'вкладки' : 'вкладок'
        parts.push(`${tabs.length} ${totalWord}`)
      }
    } catch {
      if (tabs.length > 0) parts.push(`${tabs.length} вкл.`)
    }
  } else if (tabs.length > 0) {
    const word = tabs.length === 1 ? 'вкладка' : (tabs.length >= 2 && tabs.length <= 4) ? 'вкладки' : 'вкладок'
    parts.push(`${tabs.length} ${word}`)
  }
  if (documents.length > 0) {
    parts.push(`${documents.length} док.`)
  }
  return parts.filter(Boolean).join(' · ') || 'Готово к продолжению'
}

export function ParkedCoversStack({ spaceId, covers }: { spaceId: string; covers: { id: string; dataUrl: string }[] }) {
  const reduced = useReducedMotion()
  const visibleCovers = covers.slice(0, 3)
  if (!visibleCovers.length) return null

  return (
    <div className="resume-cover-stack select-none pointer-events-none" aria-hidden="true">
      {visibleCovers.map((cover, i) => {
        const rotate = i === 0 ? 0 : i === 1 ? -4 : 4
        const yOffset = i * 3

        return (
          <motion.img
            key={cover.id}
            layoutId={reduced ? undefined : `tab-cover-${spaceId}-${cover.id}`}
            src={cover.dataUrl}
            alt=""
            style={{ zIndex: 10 - i }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: yOffset - enterOffset.y * 2, rotate }}
            animate={{ opacity: 1 - i * 0.18, y: yOffset, rotate }}
            transition={reduced ? fluidInstant : fluidSpring.slow}
            className="resume-cover-stack-img"
          />
        )
      })}
    </div>
  )
}

type Continuation = NonNullable<ReturnType<typeof latestContinuation>>
interface Props {
  continuation?: Continuation | null
  now: Date
  hidden: boolean
  style: CSSProperties
  pending: boolean
  result?: ResumeResult
  onResume: (retry?: boolean) => void
  onSpace: () => void
  onEdit: () => void
  /** Saves the next step typed in place on the card (cabinet mode). */
  onSaveStep?: (step: string) => void
  onComplete: () => void
  onDocument: (resource: Resource) => void
  onTabs: () => void
  covers?: Record<string, string>
  children?: import('react').ReactNode
  onPointerDown?: import('react').PointerEventHandler<HTMLElement>
  dataWidgetId?: string
  className?: string
  rowSpan?: number
  colSpan?: number
  size?: import('./types').WidgetSize
  onNewSpace?: () => void
}

function activityLabel(at: string | undefined, now: Date) {
  if (!at || Number.isNaN(Date.parse(at))) return ''
  const date = new Date(at)
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const day = date >= today ? 'Сегодня' : date >= yesterday ? 'Вчера' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  return `${day}, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
}

export function ResumeCard({ continuation, now, hidden, style, pending, result, onResume, onSpace, onEdit, onSaveStep, onComplete, onDocument, onTabs, covers, children, onPointerDown, dataWidgetId, className, rowSpan, colSpan, size, onNewSpace }: Props) {
  const reduced = useReducedMotion()
  const isCompactRow = rowSpan !== undefined && rowSpan <= 2
  const isSmall = (rowSpan !== undefined && rowSpan <= 3) || (colSpan !== undefined && colSpan <= 4) || size === 'S'

  if (!continuation) {
    const handleCreate = () => {
      if (onNewSpace) onNewSpace()
      else onSpace()
    }

    return (
      <motion.section
        layout="position"
        initial={reduced ? undefined : { opacity: 0 }}
        animate={reduced ? undefined : { opacity: 1 }}
        transition={reduced ? fluidInstant : fluidSpring.slow}
        className={`calm-card resume-card context-resume resume-card-empty ${isCompactRow ? 'is-compact-row' : ''} ${isSmall ? 'is-small-card' : ''} ${className || ''}`}
        data-widget="resume"
        data-widget-id={dataWidgetId}
        data-row-span={rowSpan}
        data-col-span={colSpan}
        data-widget-size={size}
        onPointerDown={onPointerDown}
        hidden={hidden}
        style={style}
        aria-label="Продолжить"
      >
        {isCompactRow ? (
          <div className="resume-compact-wrap">
            <div className="resume-compact-main">
              <div className="resume-compact-meta">
                <span className="resume-space-link" style={{ cursor: 'default' }}>
                  <Folder size={14} aria-hidden="true" />
                  <span>Пространства</span>
                </span>
              </div>
              <h2 className="resume-compact-title">Нет открытых пространств</h2>
              <p className="resume-compact-sub">Создайте пространство для продолжения работы</p>
            </div>
            <div className="resume-compact-actions">
              <FluidButton className="resume-primary resume-compact-btn" onClick={handleCreate}>
                Создать
                <Plus size={16} />
              </FluidButton>
            </div>
          </div>
        ) : (
          <>
            <div className="resume-card-heading">
              <div className="resume-heading-context">
                <div className="resume-space-link" style={{ cursor: 'default' }}>
                  <Folder size={18} aria-hidden="true" />
                  <h2 className="resume-space-title">Продолжить работу</h2>
                </div>
              </div>
            </div>
            <div className="resume-body-content">
              <div className="resume-main">
                <div className="resume-subtitle-row">
                  <span className="resume-subtitle">Нет открытых пространств</span>
                </div>
                <p className="resume-next-step" title="Создайте пространство для организации вкладок, документов и контекста">Создайте пространство для организации вкладок, документов и контекста</p>
                <div className="resume-footer-row">
                  <div />
                  <div className="resume-actions">
                    <FluidButton className="resume-primary" onClick={handleCreate}>
                      Создать пространство
                      <Plus size={18} />
                    </FluidButton>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        {children}
      </motion.section>
    )
  }

  const { space, context, documents, tabs, at, title } = continuation
  const checkpoint = context.checkpoint
  const failures = result?.failures.filter(failure => documents.some(document => document.id === failure.id)) || []
  const spaceDisplayName = formatSpaceDisplayName(space)
  const isBlank = !checkpoint?.nextStep && !checkpoint?.note && documents.length === 0 && tabs.length === 0
  const subtitle = tabSubtitle(tabs, documents, context.title, spaceDisplayName)
  const showStep = Boolean(checkpoint?.nextStep && (isCabinetPreview || checkpoint.nextStep !== spaceDisplayName))
  const accent = isBlank ? 'Чистый лист' : showStep ? checkpoint!.nextStep : subtitle
  const visibleCovers = tabs
    .map(tab => ({ id: tab.id, dataUrl: covers?.[tab.id] || '' }))
    .filter(item => Boolean(item.dataUrl))
    .slice(0, 3)

  return <motion.section
    layout="position"
    initial={reduced ? undefined : { opacity: 0 }}
    animate={reduced ? undefined : { opacity: 1 }}
    transition={reduced ? fluidInstant : fluidSpring.slow}
    className={`calm-card resume-card context-resume ${isCompactRow ? 'is-compact-row' : ''} ${isSmall ? 'is-small-card' : ''} ${className || ''}`}
    data-widget="resume"
    data-widget-id={dataWidgetId}
    data-row-span={rowSpan}
    data-col-span={colSpan}
    data-widget-size={size}
    onPointerDown={onPointerDown}
    hidden={hidden}
    style={style}
    aria-label="Продолжить"
    aria-busy={pending}
  >
    {isCompactRow ? (
      <div className="resume-compact-wrap">
        <div className="resume-compact-main">
          <div className="resume-compact-meta">
            <button className="resume-space-link" onClick={onSpace} title={`Открыть пространство «${spaceDisplayName}»`}>
              <Folder size={14} aria-hidden="true" />
              <span>{spaceDisplayName}</span>
            </button>
            {tabs.length > 0 && <span className="resume-compact-pill">{tabs.length} вкл.</span>}
            {documents.length > 0 && <span className="resume-compact-pill">{documents.length} док.</span>}
          </div>
          <h2 className="resume-compact-title">{spaceDisplayName}</h2>
          <p className="resume-compact-sub">{checkpoint?.nextStep || subtitle}</p>
        </div>
        <div className="resume-compact-actions">
          {visibleCovers.length > 0 && <ParkedCoversStack spaceId={space.id} covers={visibleCovers} />}
          <FluidButton className="resume-primary resume-compact-btn" disabled={pending} onClick={() => onResume()}>
            {pending ? 'Открываем…' : 'Продолжить'}
            <ArrowRight size={16} />
          </FluidButton>
          <ActionMenu label="Действия с продолжением" actions={[{ label: 'Настроить продолжение', icon: <Pencil size={16} />, onSelect: onEdit }, { label: isCabinetPreview ? 'Убрать пространство в архив' : 'Дело завершено', icon: <Check size={16} />, onSelect: onComplete }]} />
        </div>
      </div>
    ) : (
      <>
        <div className="resume-card-heading">
          <div className="resume-heading-context">
            {isCabinetPreview ? (
              // The space name is the accent below; the heading only says what the card is.
              <span className="resume-space-link is-label">
                <Folder size={18} aria-hidden="true" />
                <h2 className="resume-space-title">{space.kind === 'day' ? 'Без пространства' : 'Пространство'}</h2>
              </span>
            ) : (
              <button className="resume-space-link" onClick={onSpace} title={`Открыть пространство «${spaceDisplayName}»`}>
                <Folder size={18} aria-hidden="true" />
                <h2 className="resume-space-title">{spaceDisplayName}</h2>
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="resume-heading-actions">
            <ActionMenu label="Действия с продолжением" actions={[{ label: 'Настроить продолжение', icon: <Pencil size={16} />, onSelect: onEdit }, { label: isCabinetPreview ? 'Убрать пространство в архив' : 'Дело завершено', icon: <Check size={16} />, onSelect: onComplete }]} />
          </div>
        </div>
        <div className="resume-body-content">
          <div className="resume-main">
            <div className="resume-subtitle-row">
              {isCabinetPreview
                ? <button type="button" className="resume-subtitle card-accent resume-space-name" onClick={onSpace} title={`Открыть пространство «${spaceDisplayName}»`}>{spaceDisplayName}</button>
                : <span className="resume-subtitle card-accent">{accent}</span>}
              {activityLabel(at, now) && (
                <time className="resume-time" dateTime={at}>
                  Открывали · {activityLabel(at, now)}
                </time>
              )}
            </div>
            {isCabinetPreview && space.kind !== 'day' && <NextStepLine step={checkpoint?.nextStep} onSave={onSaveStep} className="resume-next" />}
            {checkpoint?.note && <p className="resume-note">{checkpoint.note}</p>}
            {isBlank && (
              <p className="resume-next-step" title="Откройте вкладки или добавьте файлы — всё сохранится здесь">Откройте вкладки или добавьте файлы — всё сохранится здесь</p>
            )}
            <ContinuationFooter
              primaryLabel="Продолжить"
              onPrimary={() => onResume()}
              pending={pending}
              tabs={tabs}
              onTabs={onTabs}
              documents={documents}
              onDocument={onDocument}
              documentLabel={document => (!isCabinetPreview && document.name === title ? 'Документ' : document.name)}
            />
            {failures.length > 0 && (
              <div className="resume-errors" role="status">
                <details>
                  <summary>Не удалось открыть документов: {failures.length}</summary>
                  {failures.map(failure => <p key={failure.id}><strong>{failure.name}</strong><span>{failure.error}</span></p>)}
                </details>
                <button className="calm-text-button" disabled={pending} onClick={() => onResume(true)}>
                  Повторить неоткрытые <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
          {visibleCovers.length > 0 && (
            <div className="resume-center-covers" aria-hidden="true">
              <ParkedCoversStack spaceId={space.id} covers={visibleCovers} />
            </div>
          )}
        </div>
      </>
    )}
    {children}
  </motion.section>
}
