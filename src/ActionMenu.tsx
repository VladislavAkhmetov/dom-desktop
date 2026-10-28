import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { FluidGroup, FluidSurface } from './FluidMotion'

export interface MenuAction {
  id?: string
  label: string
  icon: ReactNode
  onSelect: () => void
  /** Destructive actions are red and separated from the rest (put them last). */
  tone?: 'danger'
  disabled?: boolean
  /** Consecutive actions with the same group share a heading, e.g. «Перенести в». */
  group?: string
}

/** Menu rows shared by ActionMenu and ContextMenu: group headings, separators, danger and disabled states. */
export function MenuItems({ actions, onPick }: { actions: MenuAction[]; onPick: (action: MenuAction) => void }) {
  return <>{actions.map((action, index) => {
    const previous = actions[index - 1]
    const newGroup = action.group !== undefined && action.group !== previous?.group
    const dangerStart = action.tone === 'danger' && previous && previous.tone !== 'danger'
    const separate = index > 0 && (newGroup || dangerStart || (previous?.group !== undefined && action.group === undefined))
    return <Fragment key={action.id || `${action.group || ''}${action.label}`}>
      {separate && <div className="menu-separator" role="separator" />}
      {newGroup && <div className="menu-group-label" role="presentation">{action.group}</div>}
      <button role="menuitem" type="button" data-tone={action.tone} disabled={action.disabled} aria-disabled={action.disabled || undefined} onClick={() => onPick(action)}>{action.icon}<span>{action.label}</span></button>
    </Fragment>
  })}</>
}

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
    // Capture phase: triggers stop pointerdown propagation (to keep drag from starting), which would otherwise
    // hide the press from an open menu and leave two menus open at once.
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open])
  return <div className={`action-menu ${className}`} ref={root} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
    if (open && event.key === 'Tab') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')]
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
  }}>
    <button type="button" ref={trigger} className={triggerContent ? 'menu-trigger' : 'task-more'} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setOpen(value => !value) }}>{triggerContent || <MoreHorizontal size={18} />}</button>
    {createPortal(<AnimatePresence>{open && <FluidSurface key={id} className={`action-menu-popover ${className}`} ref={menu} style={{ position: 'fixed', ...position, right: 'auto', zIndex: 120, maxHeight: 'calc(100dvh - 16px)', overflowY: 'auto', transformOrigin: 'top right' }} id={id} role="menu" aria-label={label}><FluidGroup className="fluid-menu-items" axis="y"><MenuItems actions={actions} onPick={action => { setOpen(false); trigger.current?.focus(); action.onSelect() }} /></FluidGroup></FluidSurface>}</AnimatePresence>, document.body)}
  </div>
}
