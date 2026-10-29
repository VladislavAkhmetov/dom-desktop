import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpCircle, Download, RefreshCw, X } from 'lucide-react'
import type { AppUpdate } from './types'
import { useUpdateReady } from './useUpdateReady'
import { bridge } from './bridge'
import './updateNotice.css'

export interface UpdateNoticeButtonProps {
  update?: AppUpdate | null
  className?: string
}

export function UpdateNoticeButton({ update: propUpdate, className = '' }: UpdateNoticeButtonProps) {
  const readyUpdate = useUpdateReady()
  const update = propUpdate !== undefined ? propUpdate : readyUpdate
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const dialogId = useId()

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const updatePosition = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      if (!anchor) return
      const popover = popoverRef.current
      const width = popover?.offsetWidth || 320
      const height = popover?.offsetHeight || 170

      const below = anchor.bottom + 8
      const top = below + height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - height - 8)
      const left = Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12))
      setPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  if (!update) return null

  const isManual = Boolean(update.manual)

  const handlePrimary = () => {
    setOpen(false)
    if (isManual) {
      void bridge.openReleasePage?.()
    } else {
      void bridge.installUpdate?.()
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`chrome-button chrome-update-notice ${open ? 'active' : ''} ${className}`}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Доступно обновление dombro v${update.version}`}
        title={`Доступно обновление v${update.version}`}
      >
        <ArrowUpCircle size={17} className="update-notice-icon" aria-hidden="true" />
        <span className="update-notice-pill">v{update.version}</span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-labelledby={`${dialogId}-title`}
          className="update-popover"
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
          <div className="update-popover-header">
            <div className="update-popover-title-row">
              <span id={`${dialogId}-title`} className="update-popover-title">Обновление dombro</span>
              <span className="update-popover-badge">v{update.version}</span>
            </div>
            <button
              type="button"
              className="update-popover-close"
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>

          <p className="update-popover-body">
            {isManual
              ? `Для dombro доступна новая версия v${update.version}. Портативную сборку можно скачать со страницы выпуска.`
              : `Версия v${update.version} загружена в фоне и будет установлена при закрытии приложения.`}
          </p>

          <div className="update-popover-actions">
            <button
              type="button"
              className="soft-button"
              onClick={() => setOpen(false)}
            >
              {isManual ? 'Позже' : 'При выходе'}
            </button>
            <button
              type="button"
              className="calm-primary"
              onClick={handlePrimary}
            >
              {isManual ? (
                <>
                  <Download size={15} aria-hidden="true" />
                  <span>Скачать выпуск</span>
                </>
              ) : (
                <>
                  <RefreshCw size={15} aria-hidden="true" />
                  <span>Перезапустить</span>
                </>
              )}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
