import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { FluidGroup, FluidSurface } from './FluidMotion'

export interface MenuAction { id?: string; label: string; icon: ReactNode; onSelect: () => void }

export function ActionMenu({ label, actions, triggerContent, className = '' }: { label: string; actions: MenuAction[]; triggerContent?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const id = useId()
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = trigger.current!.getBoundingClientRect()
      const width = menu.current!.offsetWidth, height = menu.current!.offsetHeight
      const below = anchor.bottom + 6
      const top = below + height <= window.innerHeight - 8 ? below : anchor.top - height - 6
      setPosition({ top: Math.max(8, Math.min(top, window.innerHeight - height - 8)), left: Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8)) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className={`action-menu ${className}`} ref={root} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
    if (open && event.key === 'Tab') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
  }}>
    <button ref={trigger} className={triggerContent ? 'menu-trigger' : 'task-more'} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>{triggerContent || <MoreHorizontal size={18} />}</button>
    {createPortal(<AnimatePresence>{open && <FluidSurface key={id} className={`action-menu-popover ${className}`} ref={menu} style={{ position: 'fixed', ...position, right: 'auto', zIndex: 120, maxHeight: 'calc(100dvh - 16px)', overflowY: 'auto', transformOrigin: 'top right' }} id={id} role="menu" aria-label={label}><FluidGroup className="fluid-menu-items" axis="y">{actions.map(action => <button role="menuitem" key={action.id || action.label} onClick={() => { setOpen(false); trigger.current?.focus(); action.onSelect() }}>{action.icon}<span>{action.label}</span></button>)}</FluidGroup></FluidSurface>}</AnimatePresence>, document.body)}
  </div>
}
