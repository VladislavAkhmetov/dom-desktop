import type { DomBridge } from './types'

declare global {
  interface Window { dom?: DomBridge }
}

export {}
