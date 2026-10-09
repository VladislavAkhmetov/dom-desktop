import { useSyncExternalStore } from 'react'

// Fluid Functionalism motion tiers adapted to dombro's quieter rhythm.
// https://www.fluidfunctionalism.com/docs/motion
export const fluidSpring = {
  fast: { type: 'spring', duration: .14, bounce: 0 },
  moderate: { type: 'spring', duration: .22, bounce: 0 },
  slow: { type: 'spring', duration: .24, bounce: 0 },
} as const

export const fluidExit = { duration: .16, ease: 'easeOut' } as const
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
