import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'motion/react'
import { Languages, Sparkles, X } from 'lucide-react'
import { FluidSurface } from '../FluidMotion'
import { bridge } from '../bridge'
import './translate.css'

export interface TranslateButtonProps {
  tabId?: string
  lang?: string
  onAiSummary?: () => void
}

export function TranslateButton({ tabId, lang, onAiSummary }: TranslateButtonProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const isForeign = Boolean(lang && lang !== 'ru')

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const menu = popoverRef.current
      if (!anchor || !menu) return
      const width = menu.offsetWidth
      const height = menu.offsetHeight
      const below = anchor.bottom + 7
      const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, anchor.top - height - 7)
      setPosition({
        top: Math.max(8, Math.min(top, window.innerHeight - height - 8)),
        left: Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8))
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  const handleTranslate = async () => {
    if (!tabId || !bridge.browser?.translateTab || pending) return
    setPending(true)
    setStatusText('Переводим страницу…')
    try {
      const res = await bridge.browser.translateTab(tabId)
      if (res.ok) {
        setStatusText('Страница переведена на русский')
      } else {
        setStatusText('Не удалось перевести')
      }
    } catch {
      setStatusText('Ошибка перевода')
    } finally {
      setPending(false)
    }
  }

  if (!isForeign) return null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="translate-btn is-active"
        aria-label="Перевести страницу на русский"
        title="Перевести страницу на русский"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setStatusText('')
          setOpen(prev => !prev)
        }}
      >
        <Languages size={16} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <FluidSurface
              ref={popoverRef}
              id={id}
              role="dialog"
              aria-labelledby={`${id}-title`}
              className="translate-popover"
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                zIndex: 130
              }}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setOpen(false)
                  buttonRef.current?.focus()
                }
              }}
            >
              <div className="translate-popover-header">
                <span id={`${id}-title`} className="translate-popover-title">
                  Язык: {lang?.toUpperCase() || 'EN'}
                </span>
                <button
                  type="button"
                  className="translate-popover-close"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                >
                  <X size={14} />
                </button>
              </div>

              <button
                type="button"
                className="translate-action-btn"
                onClick={handleTranslate}
                disabled={pending}
              >
                <Languages size={15} />
                <span>Перевести на русский</span>
              </button>

              {onAiSummary && (
                <button
                  type="button"
                  className="translate-action-btn"
                  onClick={() => {
                    setOpen(false)
                    onAiSummary()
                  }}
                >
                  <Sparkles size={15} />
                  <span>AI-выжимка на русском</span>
                </button>
              )}

              {statusText && (
                <p className="translate-status-text" aria-live="polite">
                  {statusText}
                </p>
              )}
            </FluidSurface>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
