import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'

interface Action { label: string; icon: ReactNode; onSelect: () => void }

export function ActionMenu({ label, actions, triggerContent }: { label: string; actions: Action[]; triggerContent?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="action-menu" ref={root} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
    if (event.key === 'Tab') setOpen(false)
    if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const items = [...root.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
  }}>
    <button ref={trigger} className={triggerContent ? 'menu-trigger' : 'task-more'} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>{triggerContent || <MoreHorizontal size={18} />}</button>
    {open && <div className="action-menu-popover" id={id} role="menu" aria-label={label}>{actions.map(action => <button role="menuitem" key={action.label} onClick={() => { setOpen(false); trigger.current?.focus(); action.onSelect() }}>{action.icon}<span>{action.label}</span></button>)}</div>}
  </div>
}
