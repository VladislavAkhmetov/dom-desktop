import { useLayoutEffect, useRef, useState, type HTMLAttributes, type Ref } from 'react'
import { motion, useIsPresent, type HTMLMotionProps } from 'motion/react'
import { calmTween, enterOffset, fluidExit, fluidInstant, fluidSpring, motionDuration, pressOpacity, useFluidReducedMotion } from './motion'

type Rect = { x: number; y: number; width: number; height: number }
type Item = Rect & { element: HTMLButtonElement; selected: boolean }
type GroupProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'nav'
  axis?: 'x' | 'y'
  itemSelector?: string
  selectedSelector?: string
}

/** Adds moving highlights to existing controls without changing their actions or layout. */
export function FluidGroup({ as: Tag = 'div', axis = 'x', itemSelector = ':scope > button', selectedSelector = '.selected, [aria-selected="true"], [aria-pressed="true"], [aria-current="page"]', children, className = '', onPointerMove, onPointerLeave, onFocus, onBlur, ...props }: GroupProps) {
  const ref = useRef<HTMLElement>(null)
  const pointerInside = useRef(false)
  const [items, setItems] = useState<Item[]>([])
  const [hovered, setHovered] = useState<HTMLButtonElement | null>(null)
  const reduced = useFluidReducedMotion()

  useLayoutEffect(() => {
    const root = ref.current!
    let frame = 0, disposed = false
    const measure = () => {
      if (disposed) return
      const bounds = root.getBoundingClientRect()
      const scaleX = root.offsetWidth ? bounds.width / root.offsetWidth : 1
      const scaleY = root.offsetHeight ? bounds.height / root.offsetHeight : 1
      if (!scaleX || !scaleY) return
      const next = [...root.querySelectorAll<HTMLButtonElement>(itemSelector)]
        .filter(element => !element.disabled && element.getClientRects().length > 0)
        .map(element => {
          const box = element.getBoundingClientRect()
          return { element, selected: element.matches(selectedSelector),
            x: (box.left - bounds.left) / scaleX + root.scrollLeft - root.clientLeft,
            y: (box.top - bounds.top) / scaleY + root.scrollTop - root.clientTop,
            width: box.width / scaleX, height: box.height / scaleY }
        })
      setItems(previous => previous.length === next.length && previous.every((item, index) => {
        const other = next[index]
        return item.element === other.element && item.selected === other.selected && item.x === other.x && item.y === other.y && item.width === other.width && item.height === other.height
      }) ? previous : next)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    measure()
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
    resize?.observe(root)
    root.querySelectorAll(itemSelector).forEach(element => resize?.observe(element))
    const mutations = new MutationObserver(schedule)
    mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-selected', 'aria-pressed', 'aria-current', 'disabled', 'hidden'] })
    const parent = root.parentElement
    parent?.addEventListener('scroll', schedule, { passive: true })
    root.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    document.fonts?.ready.then(() => { if (!disposed) schedule() })
    return () => { disposed = true; cancelAnimationFrame(frame); resize?.disconnect(); mutations.disconnect(); parent?.removeEventListener('scroll', schedule); root.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule) }
  }, [children, itemSelector, selectedSelector])

  const selected = items.find(item => item.selected)
  const lastHovered = useRef<Item | null>(null)
  const currentHoveredItem = hovered ? items.find(item => item.element === hovered) : null
  if (currentHoveredItem) {
    lastHovered.current = currentHoveredItem
  } else if (lastHovered.current) {
    const updated = items.find(item => item.element === lastHovered.current?.element)
    if (updated) lastHovered.current = updated
  }
  const hover = currentHoveredItem || lastHovered.current || selected
  const preview = Boolean(currentHoveredItem && currentHoveredItem !== selected)
  const target = (item: Rect) => ({ x: item.x, y: item.y, width: item.width, height: item.height })

  return <Tag {...props} ref={ref as Ref<HTMLElement & HTMLDivElement>} className={`fluid-group ${className}`} onPointerMove={event => {
    onPointerMove?.(event)
    if (event.pointerType === 'touch' || !event.currentTarget.contains(event.target as Node)) return
    pointerInside.current = true
    const bounds = event.currentTarget.getBoundingClientRect()
    const horizontal = axis === 'x'
    const scale = horizontal ? bounds.width / (event.currentTarget.offsetWidth || 1) : bounds.height / (event.currentTarget.offsetHeight || 1)
    const crossScale = horizontal ? bounds.height / (event.currentTarget.offsetHeight || 1) : bounds.width / (event.currentTarget.offsetWidth || 1)
    const point = (horizontal ? event.clientX - bounds.left : event.clientY - bounds.top) / (scale || 1)
      + (horizontal ? event.currentTarget.scrollLeft - event.currentTarget.clientLeft : event.currentTarget.scrollTop - event.currentTarget.clientTop)
    const crossPoint = (horizontal ? event.clientY - bounds.top : event.clientX - bounds.left) / (crossScale || 1)
      + (horizontal ? event.currentTarget.scrollTop - event.currentTarget.clientTop : event.currentTarget.scrollLeft - event.currentTarget.clientLeft)

    let closest: Item | undefined
    for (const item of items) {
      const start = horizontal ? item.x : item.y, size = horizontal ? item.width : item.height
      const crossStart = horizontal ? item.y : item.x, crossSize = horizontal ? item.height : item.width
      if (point >= start && point <= start + size && crossPoint >= crossStart && crossPoint <= crossStart + crossSize) {
        closest = item
        break
      }
    }
    if (!closest) {
      let minDistance = Infinity
      for (const item of items) {
        const start = horizontal ? item.x : item.y, size = horizontal ? item.width : item.height
        const crossStart = horizontal ? item.y : item.x, crossSize = horizontal ? item.height : item.width
        const inCross = crossPoint >= crossStart - 6 && crossPoint <= crossStart + crossSize + 6
        const inNearMain = point >= start - 10 && point <= start + size + 10
        if (inCross && inNearMain) {
          const dist = Math.abs(point - (start + size / 2))
          if (dist < minDistance) {
            minDistance = dist
            closest = item
          }
        }
      }
    }
    setHovered(closest?.element || null)
  }} onPointerLeave={event => { onPointerLeave?.(event); pointerInside.current = false; setHovered(null) }} onFocus={event => {
    onFocus?.(event)
    const item = items.find(item => item.element.contains(event.target as Node))
    if (item && item.element.matches(':focus-visible')) setHovered(item.element)
  }} onBlur={event => {
    onBlur?.(event)
    if (!event.currentTarget.contains(event.relatedTarget as Node) && !pointerInside.current) setHovered(null)
  }}>
    {selected && <motion.span aria-hidden="true" className="fluid-selection" initial={false} animate={{ ...target(selected), opacity: preview ? .85 : 1 }} transition={reduced ? fluidInstant : { ...fluidSpring.moderate, opacity: calmTween(motionDuration.hover) }} />}
    {hover && <motion.span aria-hidden="true" className="fluid-hover" initial={false} animate={{ ...target(hover), opacity: preview ? 1 : 0 }} transition={reduced ? fluidInstant : { ...fluidSpring.moderate, opacity: calmTween(motionDuration.hover) }} />}
    {children}
  </Tag>
}

export function FluidButton({ className = '', ...props }: HTMLMotionProps<'button'>) {
  const reduced = useFluidReducedMotion()
  return <motion.button initial={false} whileHover={undefined} whileTap={props.disabled ? undefined : { opacity: pressOpacity }} transition={reduced ? fluidInstant : { ...fluidSpring.fast, duration: motionDuration.press }} {...props} className={`fluid-button ${className}`} />
}

/** Exiting panels become inert immediately while their visual exit completes. */
export function FluidSurface({ className = '', style, role, ...props }: HTMLMotionProps<'div'>) {
  const reduced = useFluidReducedMotion()
  const present = useIsPresent()
  return <motion.div initial={reduced ? false : { opacity: 0, y: enterOffset.y, scale: enterOffset.scale }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduced ? 0 : enterOffset.y / 2, transition: reduced ? fluidInstant : fluidExit }} transition={reduced ? fluidInstant : calmTween()} {...props} role={present ? role : undefined} inert={!present || undefined} aria-hidden={!present || undefined} className={`fluid-surface ${className}`} style={{ ...style, pointerEvents: present ? style?.pointerEvents : 'none' }} />
}
