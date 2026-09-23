import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current!
    ;(root.querySelector<HTMLElement>('textarea, input') || root.querySelector<HTMLElement>('button'))?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current() }
      if (event.key !== 'Tab') return
      const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, summary, [href]')].filter(item => item.getClientRects().length > 0)
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    root.addEventListener('keydown', keyboard)
    return () => { root.removeEventListener('keydown', keyboard); if (previous?.isConnected) previous.focus() }
  }, [])
  return <div className="calm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="calm-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby="calm-dialog-title">
      <div className="calm-dialog-heading"><h2 id="calm-dialog-title">{title}</h2><button className="calm-icon" aria-label="Закрыть" onClick={onClose}><X size={20} /></button></div>
      {children}
    </div>
  </div>
}
