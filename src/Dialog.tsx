import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { fluidInstant, fluidSpring, useFluidReducedMotion } from './motion'

export function Dialog({ title, children, onClose, onEscape = onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; onEscape?: () => void; className?: string }) {
  const titleId = useId()
  const reduced = useFluidReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const previousFocus = useRef(document.activeElement as HTMLElement | null)
  const closeRef = useRef(onClose)
  closeRef.current = onEscape
  useEffect(() => {
    const previous = previousFocus.current
    const root = ref.current!
    const focusFirst = () => (root.querySelector<HTMLElement>('[data-dialog-focus]') || root.querySelector<HTMLElement>('textarea:not(:disabled), input:not(:disabled):not([type="checkbox"])') || root.querySelector<HTMLElement>('button:not(:disabled)'))?.focus()
    const isTop = () => [...document.querySelectorAll('[role="dialog"]')].at(-1) === root
    const ownedMenus = () => [...root.querySelectorAll<HTMLElement>('[aria-haspopup="menu"][aria-expanded="true"][aria-controls]')]
      .map(trigger => document.getElementById(trigger.getAttribute('aria-controls')!)).filter((menu): menu is HTMLElement => Boolean(menu))
    focusFirst()
    const keepFocus = () => { if (isTop() && !root.contains(document.activeElement) && !ownedMenus().some(menu => menu.contains(document.activeElement))) focusFirst() }
    const observer = new MutationObserver(keepFocus)
    observer.observe(root, { childList: true, subtree: true })
    document.addEventListener('focusin', keepFocus)
    const keyboard = (event: KeyboardEvent) => {
      if (!isTop()) return
      if (ownedMenus().length) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current() }
      if (event.key !== 'Tab') return
      const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [href]')].filter(item => item.getClientRects().length > 0)
      const first = items[0], last = items[items.length - 1]
      if (!root.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyboard, true)
    return () => { observer.disconnect(); document.removeEventListener('focusin', keepFocus); document.removeEventListener('keydown', keyboard, true); if (previous?.isConnected) previous.focus() }
  }, [])
  return createPortal(<div className="calm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <motion.div className={`calm-dialog fluid-surface ${className}`} initial={reduced ? false : { opacity: 0, y: 6, scale: .992 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={reduced ? fluidInstant : fluidSpring.slow} ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="calm-dialog-heading"><h2 id={titleId}>{title}</h2><button className="calm-icon" aria-label="Закрыть" onClick={onClose}><X size={20} /></button></div>
      {children}
    </motion.div>
  </div>, document.body)
}
