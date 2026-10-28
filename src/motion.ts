import { useSyncExternalStore } from 'react'

// Motion DNA (docs/motion.md) — the JS mirror of the tokens in src/motion.css. Keep both in sync.
export const calmEase = [0.32, 0.72, 0, 1] as const // --ease-calm
export const exitEase = [0.4, 0, 0.7, 0.2] as const // --ease-exit
export const motionDuration = { press: .12, hover: .24, state: .32, enter: .42, exit: .24, layout: .48 } as const
export const motionStagger = .05                            // --motion-stagger
export const enterOffset = { y: 8, scale: .97 } as const    // --enter-y, --enter-scale
export const pressOpacity = .88                              // --press-opacity (no scale: it blurs text)

// Springs without bounce for things that follow the pointer or change layout (perceptual durations).
export const fluidSpring = {
  fast: { type: 'spring', duration: motionDuration.hover, bounce: 0 },
  moderate: { type: 'spring', duration: motionDuration.state, bounce: 0 },
  slow: { type: 'spring', duration: motionDuration.layout, bounce: 0 },
} as const

export const calmTween = (duration: number = motionDuration.enter) => ({ duration, ease: calmEase })
export const fluidExit = { duration: motionDuration.exit, ease: exitEase } as const
export const fluidInstant = { duration: 0 } as const

const query = '(prefers-reduced-motion: reduce)'
function reducedMotion() { return typeof window.matchMedia === 'function' && window.matchMedia(query).matches }
function subscribe(callback: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia(query)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

export function useFluidReducedMotion() { return useSyncExternalStore(subscribe, reducedMotion, () => true) }
