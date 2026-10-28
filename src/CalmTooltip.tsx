import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './calm-tooltip.css'

interface TooltipData {
  label: string
  hotkey?: string
  x: number
  y: number
}

export function CalmTooltip() {
  const [data, setData] = useState<TooltipData | null>(null)
  const [visible, setVisible] = useState(false)
  const visibleRef = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const activeElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    visibleRef.current = visible
  }, [visible])

  useEffect(() => {
    function clearTimer() {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }

    function restoreTitle(element: HTMLElement | null) {
      if (element && element.dataset.calmTitle) {
        element.setAttribute('title', element.dataset.calmTitle)
        delete element.dataset.calmTitle
      }
    }

    function hide() {
      clearTimer()
      restoreTitle(activeElement.current)
      activeElement.current = null
      setVisible(false)
    }

    function handlePointerOver(event: MouseEvent | PointerEvent) {
      if ('pointerType' in event && event.pointerType === 'touch') return
      const target = event.target as Element | null
      if (!target) return

      const trigger = target.closest<HTMLElement>(
        'button, [role="button"], a[title], [data-tooltip], input[type="submit"], input[type="button"]'
      )

      if (!trigger) {
        if (activeElement.current) hide()
        return
      }

      if (trigger === activeElement.current) return

      // Restore title on previously hovered element
      restoreTitle(activeElement.current)
      activeElement.current = trigger

      // Rows whose label is already visible (and which may show their own peek) opt out.
      if (trigger.hasAttribute('data-tooltip-off')) {
        hide()
        return
      }

      const titleAttr = trigger.getAttribute('title')
      const tooltipAttr = trigger.getAttribute('data-tooltip')
      const ariaLabel = trigger.getAttribute('aria-label')
      const raw = tooltipAttr || titleAttr || ariaLabel

      if (!raw || !raw.trim()) {
        hide()
        return
      }

      // Suppress native OS tooltip by temporarily removing title
      if (titleAttr) {
        trigger.dataset.calmTitle = titleAttr
        trigger.removeAttribute('title')
      }

      const text = raw.trim()
      const parts = text.split(' · ')
      const label = parts[0]
      const hotkey = parts.length > 1 ? parts.slice(1).join(' · ') : undefined

      const wasVisible = visibleRef.current
      clearTimer()

      const showDelay = wasVisible ? 100 : 200
      timer.current = setTimeout(() => {
        const rect = trigger.getBoundingClientRect()
        const hasRect = rect.width > 0 || rect.height > 0 || rect.left > 0 || rect.top > 0
        const x = hasRect ? Math.round(rect.left + rect.width / 2) : event.clientX
        const y = hasRect ? Math.round(rect.bottom + 6) : event.clientY + 18
        setData({ label, hotkey, x, y })
        setVisible(true)
      }, showDelay)
    }

    function handlePointerMove(_event: MouseEvent | PointerEvent) {
      // Intentionally stationary: does not jitter or chase cursor on hover
    }

    function handlePointerOut(event: MouseEvent | PointerEvent) {
      const related = event.relatedTarget as Element | null
      if (activeElement.current && related && activeElement.current.contains(related)) {
        return
      }
      hide()
    }

    function handlePointerDown() {
      hide()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') hide()
    }

    const onOver = (e: any) => handlePointerOver(e)
    const onMove = (e: any) => handlePointerMove(e)
    const onOut = (e: any) => handlePointerOut(e)
    const onDown = () => handlePointerDown()

    window.addEventListener('pointerover', onOver, true)
    window.addEventListener('mouseover', onOver, true)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('pointerout', onOut, true)
    window.addEventListener('mouseout', onOut, true)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', hide, true)

    return () => {
      clearTimer()
      restoreTitle(activeElement.current)
      window.removeEventListener('pointerover', onOver, true)
      window.removeEventListener('mouseover', onOver, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('pointerout', onOut, true)
      window.removeEventListener('mouseout', onOut, true)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])

  if (!data) return null

  const PADDING = 8
  let left = data.x
  let top = data.y

  if (typeof window !== 'undefined' && tooltipRef.current) {
    const width = tooltipRef.current.offsetWidth
    const height = tooltipRef.current.offsetHeight
    left = Math.max(PADDING, Math.min(left - width / 2, window.innerWidth - width - PADDING))
    if (top + height > window.innerHeight - PADDING) {
      const rect = activeElement.current?.getBoundingClientRect()
      top = rect && (rect.width > 0 || rect.height > 0)
        ? Math.max(PADDING, rect.top - height - 6)
        : Math.max(PADDING, data.y - height - 24)
    }
  }

  return createPortal(
    <div
      ref={tooltipRef}
      className={`calm-tooltip ${visible ? 'is-visible' : ''}`}
      style={{ left: `${left}px`, top: `${top}px` }}
      role="tooltip"
      aria-hidden="true"
    >
      <span className="calm-tooltip-label">{data.label}</span>
      {data.hotkey && <kbd className="calm-tooltip-kbd">{data.hotkey}</kbd>}
    </div>,
    document.body
  )
}
