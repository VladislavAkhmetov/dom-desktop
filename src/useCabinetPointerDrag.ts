import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { CabinetDrag } from './cabinetInteractions'

/** Internal moves use pointer events so a card can be dragged from its main button. */
export function useCabinetPointerDrag(callbacks: {
  onStart: (value: CabinetDrag) => void
  onOver: (value: CabinetDrag, x: number, y: number) => void
  onDrop: (value: CabinetDrag, x: number, y: number) => void
  onFinish: () => void
}) {
  const handlers = useRef(callbacks); handlers.current = callbacks
  const pending = useRef<{ value: CabinetDrag; pointerId: number; x: number; y: number; active: boolean } | null>(null)
  useEffect(() => {
    let blockClick = false, clickTimer = 0
    const finish = () => { if (pending.current?.active) handlers.current.onFinish(); pending.current = null }
    const move = (event: PointerEvent) => {
      const record = pending.current
      if (!record || record.pointerId !== event.pointerId) return
      if (!record.active && Math.hypot(event.clientX - record.x, event.clientY - record.y) < 6) return
      if (!record.active) { record.active = true; handlers.current.onStart(record.value) }
      event.preventDefault(); handlers.current.onOver(record.value, event.clientX, event.clientY)
    }
    const up = (event: PointerEvent) => {
      const record = pending.current
      if (!record || record.pointerId !== event.pointerId) return
      if (record.active) {
        blockClick = true; clickTimer = window.setTimeout(() => { blockClick = false }, 0)
        handlers.current.onDrop(record.value, event.clientX, event.clientY)
      }
      finish()
    }
    const click = (event: MouseEvent) => { if (blockClick) { event.preventDefault(); event.stopImmediatePropagation(); blockClick = false } }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') finish() }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', finish)
    window.addEventListener('blur', finish); window.addEventListener('keydown', key)
    window.addEventListener('click', click, true)
    return () => { window.clearTimeout(clickTimer); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', finish); window.removeEventListener('blur', finish); window.removeEventListener('keydown', key); window.removeEventListener('click', click, true) }
  }, [])
  return {
    start: (event: ReactPointerEvent<HTMLElement>, value: CabinetDrag) => {
      if (event.button !== 0 || event.pointerType === 'touch' || event.target instanceof Element && event.target.closest('.action-menu')) return
      pending.current = { value, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false }
    },
    isPending: () => Boolean(pending.current)
  }
}
