import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current!
    const focusFirst = () => (root.querySelector<HTMLElement>('textarea:not(:disabled), input:not(:disabled):not([type="checkbox"])') || root.querySelector<HTMLElement>('button:not(:disabled)'))?.focus()
    const isTop = () => [...document.querySelectorAll('[role="dialog"]')].at(-1) === root
    focusFirst()
    const keepFocus = () => { if (isTop() && !root.contains(document.activeElement)) focusFirst() }
    const observer = new MutationObserver(keepFocus)
    observer.observe(root, { childList: true, subtree: true })
    document.addEventListener('focusin', keepFocus)
    const keyboard = (event: KeyboardEvent) => {
      if (!isTop()) return
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
  return <div className="calm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className={`calm-dialog ${className}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="calm-dialog-heading"><h2 id={titleId}>{title}</h2><button className="calm-icon" aria-label="Закрыть" onClick={onClose}><X size={20} /></button></div>
      {children}
    </div>
  </div>
}
