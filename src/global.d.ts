import type React from 'react'
import type { DomBridge } from './types'

declare global {
  interface Window {
    dom?: DomBridge
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        allowpopups?: string | boolean
        partition?: string
        preload?: string
        httpreferrer?: string
        useragent?: string
        webpreferences?: string
        disablewebsecurity?: string | boolean
      }
    }
  }
}

export {}
