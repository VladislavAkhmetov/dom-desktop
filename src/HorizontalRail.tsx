import { useId, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

export function HorizontalRail({ children, label, itemCount, resetKey }: { children: ReactNode; label: string; itemCount: number; resetKey: string }) {
  const id = useId()
  const viewport = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  const previousKey = useRef(resetKey)
  const drag = useRef<{ pointerId: number; grabOffset: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [position, setPosition] = useState({ offset: 0, max: 0, ratio: 1 })
  useLayoutEffect(() => {
    const element = viewport.current!
    if (previousKey.current !== resetKey) element.scrollLeft = 0
    previousKey.current = resetKey
    const measure = () => {
      const max = Math.max(0, element.scrollWidth - element.clientWidth)
      const offset = Math.max(0, Math.min(max, element.scrollLeft))
      const ratio = element.scrollWidth ? element.clientWidth / element.scrollWidth : 1
      setPosition(previous => previous.offset === offset && previous.max === max && previous.ratio === ratio ? previous : { offset, max, ratio })
    }
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY) || event.ctrlKey) return
      const distance = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1)
      if (distance > 0 ? element.scrollLeft >= element.scrollWidth - element.clientWidth - 1 : element.scrollLeft <= 0) return
      event.preventDefault()
      element.scrollBy({ left: distance, behavior: 'instant' })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    element.addEventListener('scroll', measure, { passive: true })
    element.addEventListener('wheel', wheel, { passive: false })
    return () => { observer.disconnect(); element.removeEventListener('scroll', measure); element.removeEventListener('wheel', wheel) }
  }, [itemCount, resetKey])

  function moveThumb(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId || !thumb.current || !viewport.current) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const travel = bounds.width - thumb.current.getBoundingClientRect().width
    if (travel <= 0) return
    const progress = Math.max(0, Math.min(1, (event.clientX - bounds.left - drag.current.grabOffset) / travel))
    viewport.current.scrollTo({ left: progress * position.max, behavior: 'instant' })
  }
  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null; setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const progress = position.max ? position.offset / position.max : 0
  return <div className={`horizontal-rail${position.offset > 2 ? ' has-before' : ''}${position.offset < position.max - 2 ? ' has-after' : ''}`}>
    <div className="horizontal-rail-viewport" ref={viewport} id={id} role="list" aria-label={label} tabIndex={0} onKeyDown={event => {
      if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const element = viewport.current!
      const step = (element.querySelector<HTMLElement>('[data-rail-item]')?.offsetWidth || element.clientWidth) + 16
      const left = event.key === 'Home' ? 0 : event.key === 'End' ? position.max : element.scrollLeft + (event.key === 'ArrowRight' ? step : -step)
      element.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }}>{children}</div>
    {position.max > 2 && <div className={`horizontal-rail-scrollbar${dragging ? ' is-dragging' : ''}`} role="scrollbar" aria-label={`Прокрутка: ${label}`} aria-orientation="horizontal" aria-controls={id} aria-valuemin={0} aria-valuemax={Math.round(position.max)} aria-valuenow={Math.round(position.offset)} tabIndex={0} onPointerDown={event => {
      if (event.button !== 0 || !thumb.current) return
      event.preventDefault(); event.currentTarget.focus({ preventScroll: true })
      const bounds = thumb.current.getBoundingClientRect()
      drag.current = { pointerId: event.pointerId, grabOffset: event.clientX >= bounds.left && event.clientX <= bounds.right ? event.clientX - bounds.left : bounds.width / 2 }
      event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); moveThumb(event)
    }} onPointerMove={moveThumb} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={() => { drag.current = null; setDragging(false) }} onKeyDown={event => {
      const element = viewport.current!
      const positions: Record<string, number> = { ArrowLeft: element.scrollLeft - 40, ArrowRight: element.scrollLeft + 40, PageUp: element.scrollLeft - element.clientWidth, PageDown: element.scrollLeft + element.clientWidth, Home: 0, End: position.max }
      if (!(event.key in positions)) return
      event.preventDefault(); element.scrollTo({ left: positions[event.key], behavior: 'instant' })
    }}><span className="horizontal-rail-thumb" ref={thumb} style={{ width: `max(32px, ${position.ratio * 100}%)`, left: `${progress * 100}%`, transform: `translateX(-${progress * 100}%)` }} /></div>}
  </div>
}
