import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'motion/react'
import { RotateCw, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { FluidSurface } from '../FluidMotion'
import { bridge } from '../bridge'
import type { AdblockStatus } from '../types'
import './adblock-shield.css'

export interface AdblockShieldProps {
  tabId?: string
  url?: string
  blockedCount?: number
  onReload?: () => void
}

export function AdblockShield({ tabId, url, blockedCount = 0, onReload }: AdblockShieldProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<AdblockStatus | null>(null)
  const [pending, setPending] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const id = useId()

  let hostname = ''
  try {
    if (url && /^https?:\/\//i.test(url)) {
      hostname = new URL(url).hostname
    }
  } catch {}

  const loadStatus = async () => {
    if (!hostname || !bridge.browser?.getAdblockStatus) return
    try {
      const res = await bridge.browser.getAdblockStatus(tabId, hostname)
      setStatus(res)
    } catch {
      // safe fallback
    }
  }

  useEffect(() => {
    loadStatus()
  }, [tabId, hostname])

  const isEnabled = status ? status.enabled && !status.siteDisabled : true

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const menu = popoverRef.current
      if (!anchor || !menu) return
      const width = menu.offsetWidth
      const height = menu.offsetHeight
      const below = anchor.bottom + 7
      const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, anchor.top - height - 7)
      setPosition({
        top: Math.max(8, Math.min(top, window.innerHeight - height - 8)),
        left: Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8))
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  const handleToggleSite = async () => {
    if (!hostname || !bridge.browser?.toggleAdblockSite || pending) return
    setPending(true)
    try {
      const nextDisabled = !status?.siteDisabled
      const updated = await bridge.browser.toggleAdblockSite(hostname, nextDisabled)
      setStatus(updated)
      onReload?.()
    } finally {
      setPending(false)
    }
  }

  const handleToggleCookies = async () => {
    if (!bridge.browser?.toggleAdblockCookies || pending) return
    setPending(true)
    try {
      const next = !status?.blockCookies
      const updated = await bridge.browser.toggleAdblockCookies(next)
      setStatus(prev => prev ? { ...prev, blockCookies: updated.blockCookies } : null)
    } finally {
      setPending(false)
    }
  }

  const handleToggleDark = async () => {
    if (!tabId || !hostname || !bridge.browser?.toggleDarkSite || pending) return
    setPending(true)
    try {
      const nextDark = !status?.isDark
      const updated = await bridge.browser.toggleDarkSite(tabId, hostname, nextDark)
      setStatus(prev => prev ? { ...prev, isDark: updated.isDark } : null)
    } finally {
      setPending(false)
    }
  }

  if (!hostname) return null

  const displayCount = status?.blockedCount || blockedCount || 0

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`adblock-shield-btn ${isEnabled ? 'is-active' : 'is-disabled'}`}
        aria-label={isEnabled ? `Защита активна на ${hostname}` : `Защита отключена на ${hostname}`}
        title={isEnabled ? `Защита активна на ${hostname} (скрыто: ${displayCount})` : `Защита отключена на ${hostname}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) loadStatus()
          setOpen(prev => !prev)
        }}
      >
        {isEnabled ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <FluidSurface
              ref={popoverRef}
              id={id}
              role="dialog"
              aria-labelledby={`${id}-host`}
              className="adblock-popover"
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                zIndex: 130
              }}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setOpen(false)
                  buttonRef.current?.focus()
                }
              }}
            >
              <div className="adblock-popover-header">
                <div className="adblock-popover-title">
                  <span id={`${id}-host`} className="adblock-popover-host">{hostname}</span>
                  <span className="adblock-popover-badge">
                    {isEnabled ? 'Защита включена' : 'Защита приостановлена'}
                  </span>
                </div>
                <button
                  type="button"
                  className="adblock-popover-close"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                >
                  <X size={15} />
                </button>
              </div>

              <div
                className={`adblock-main-toggle ${isEnabled ? 'is-on' : 'is-off'}`}
                role="switch"
                aria-checked={isEnabled}
                tabIndex={0}
                onClick={handleToggleSite}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggleSite() } }}
              >
                <div className="adblock-toggle-label">
                  <span className="adblock-toggle-title">Блокировка рекламы</span>
                  <span className="adblock-toggle-desc">
                    {isEnabled ? 'Реклама и трекеры скрыты' : 'Сайт в белом списке'}
                  </span>
                </div>
                <div className={`adblock-switch ${isEnabled ? 'is-on' : ''}`}>
                  <div className="adblock-switch-knob" />
                </div>
              </div>

              <div className="adblock-stats-row">
                <span>Заблокировано элементов:</span>
                <span className="adblock-stats-count">{displayCount}</span>
              </div>

              <div className="adblock-sub-options">
                <label className="adblock-option-item">
                  <input
                    type="checkbox"
                    checked={status?.blockCookies ?? true}
                    onChange={handleToggleCookies}
                  />
                  <span>Блокировать плашки Cookies</span>
                </label>

                <label className="adblock-option-item">
                  <input
                    type="checkbox"
                    checked={status?.isDark ?? false}
                    onChange={handleToggleDark}
                  />
                  <span>Умная тёмная тема для сайта</span>
                </label>
              </div>

              <button
                type="button"
                className="adblock-reload-btn"
                onClick={() => {
                  onReload?.()
                  setOpen(false)
                }}
              >
                <RotateCw size={13} />
                <span>Обновить страницу</span>
              </button>
            </FluidSurface>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
