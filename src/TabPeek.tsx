import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isTabCover } from './tabCover'

/*
 * Hover peek for a tab row: shows the cover Electron already captured when the tab was last hidden.
 * Costs one <img> from an in-memory data URL — no page is loaded or captured for the peek.
 * Tabs without a cover (e.g. not opened since launch) show nothing.
 */
const FIRST_DELAY = 450
const NEXT_DELAY = 90
const WIDTH = 320
const HEIGHT = 244
const GAP = 12
const EDGE = 16

type Peek = { tabId: string; src: string; caption: string; left: number; top: number }

function place(rect: DOMRect) {
  const clampTop = (value: number) => Math.max(EDGE, Math.min(value, window.innerHeight - HEIGHT - EDGE))
  const centred = clampTop(rect.top + rect.height / 2 - HEIGHT / 2)
  if (rect.right + GAP + WIDTH <= window.innerWidth - EDGE) return { left: rect.right + GAP, top: centred }
  if (rect.left - GAP - WIDTH >= EDGE) return { left: rect.left - GAP - WIDTH, top: centred }
  const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - WIDTH - EDGE))
  return { left, top: rect.bottom + GAP + HEIGHT <= window.innerHeight - EDGE ? rect.bottom + GAP : clampTop(rect.top - GAP - HEIGHT) }
}

export function useTabPeek(covers: Record<string, string>) {
  const [peek, setPeek] = useState<Peek | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const visible = useRef(false)
  visible.current = Boolean(peek)

  const hide = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    setPeek(null)
  }, [])

  const show = useCallback((anchor: HTMLElement, tabId: string, caption: string) => {
    window.clearTimeout(timer.current)
    const src = covers[tabId]
    if (!isTabCover(src)) { setPeek(null); return }
    timer.current = window.setTimeout(() => {
      if (anchor.isConnected) setPeek({ tabId, src, caption, ...place(anchor.getBoundingClientRect()) })
    }, visible.current ? NEXT_DELAY : FIRST_DELAY)
  }, [covers])

  useEffect(() => {
    if (!peek) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      window.removeEventListener('keydown', onKey)
    }
  }, [peek, hide])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const node = peek ? createPortal(
    <div className="tab-peek" aria-hidden="true" data-tab-peek={peek.tabId} style={{ left: peek.left, top: peek.top, width: WIDTH }}>
      <span className="tab-peek-frame"><img src={peek.src} alt="" decoding="async" draggable={false} /></span>
      <span className="tab-peek-caption">{peek.caption}</span>
    </div>,
    document.body
  ) : null

  return { show, hide, node }
}
