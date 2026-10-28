import { useLayoutEffect, type RefObject } from 'react'
import { calmEase, enterOffset, motionDuration, motionStagger } from './motion'

// Blocks of a hub screen in reading order. Each block animates itself: opacity on a shared wrapper
// would make it a backdrop root and switch off the glass (backdrop-filter) of the cards inside it.
const BLOCKS = '.collection-header, .space-threshold, .cabinet-contents, .overview-space, .dashboard-card-wrap'
const MAX_STEPS = 6

/** Calm entrance of a hub screen when the route changes: blocks rise 8px and fade in one after another. */
export function useScreenEntrance(root: RefObject<HTMLElement | null>, screenKey: string, enabled: boolean) {
  useLayoutEffect(() => {
    const element = root.current
    if (!enabled || !element || typeof element.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    // The spatial dashboard ↔ browser transition already moves this screen.
    if (document.querySelector('.workspace-transition')) return
    const blocks = [...element.querySelectorAll<HTMLElement>(BLOCKS)].filter(block => !block.parentElement?.closest(BLOCKS))
    const easing = `cubic-bezier(${calmEase.join(', ')})`
    const animations = blocks.map((block, index) => block.animate(
      [{ opacity: 0, translate: `0 ${enterOffset.y}px` }, { opacity: 1, translate: '0 0' }],
      { duration: motionDuration.layout * 1000, delay: Math.min(index, MAX_STEPS) * motionStagger * 1000, easing, fill: 'backwards' }
    ))
    return () => animations.forEach(animation => animation.cancel())
  }, [screenKey, enabled])
}
