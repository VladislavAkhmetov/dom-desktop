import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { MenuAction } from './ActionMenu'
import { AnimatePresence, useIsPresent } from 'motion/react'
import { FluidGroup, FluidSurface } from './FluidMotion'

type MenuRequest = { label: string; actions: MenuAction[]; x: number; y: number; origin: HTMLElement }

/** A second entry point to the same actions as the visible overflow menu. */
export function useContextMenu() {
  const [request, setRequest] = useState<MenuRequest | null>(null)
  function open(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, label: string, actions: MenuAction[]) {
    if ('key' in event && !(event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey)) return
    event.preventDefault(); event.stopPropagation()
    const origin = event.target instanceof HTMLElement ? event.target.closest('button') || event.currentTarget : event.currentTarget
    const bounds = origin.getBoundingClientRect()
    setRequest({ label, actions, origin, x: 'clientX' in event ? event.clientX : bounds.left + 12, y: 'clientY' in event ? event.clientY : bounds.bottom })
  }
  return { open, menu: <AnimatePresence>{request && <ContextMenu request={request} onClose={() => setRequest(null)} />}</AnimatePresence> }
}

function ContextMenu({ request, onClose }: { request: MenuRequest; onClose: () => void }) {
  const present = useIsPresent()
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: request.x, top: request.y })
  useLayoutEffect(() => {
    const element = menu.current!
    setPosition({ left: Math.max(8, Math.min(request.x, window.innerWidth - element.offsetWidth - 8)), top: Math.max(8, Math.min(request.y, window.innerHeight - element.offsetHeight - 8)) })
    element.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [request])
  useEffect(() => {
    if (!present) return
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) onClose() }
    const dismiss = () => onClose()
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', dismiss); window.addEventListener('blur', dismiss)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', dismiss); window.removeEventListener('blur', dismiss) }
  }, [onClose, present])
  function finish() { onClose(); request.origin.focus({ preventScroll: true }) }
  return createPortal(<FluidSurface ref={menu} role="menu" aria-label={request.label} className="action-menu-popover cabinet-context-menu" style={{ position: 'fixed', ...position, zIndex: 130, maxHeight: 'calc(100dvh - 16px)', overflowY: 'auto', transformOrigin: 'top left' }} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); finish() }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
  }}><FluidGroup className="fluid-menu-items" axis="y">{request.actions.map(action => <button role="menuitem" key={action.id || action.label} onClick={() => { finish(); action.onSelect() }}>{action.icon}<span>{action.label}</span></button>)}</FluidGroup></FluidSurface>, document.body)
}
