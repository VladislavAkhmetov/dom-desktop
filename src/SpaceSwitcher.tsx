import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, LayoutGrid, Pin, Plus } from 'lucide-react'
import type { Space } from './types'
import { plural } from './ContinuationFooter'
import './space-switcher.css'

type Props = {
  spaces: Space[]
  currentId?: string | null
  onOpen: (id: string) => void
  onShowAll: () => void
  onCreate: () => void
  /** Retired day drafts, newest first (src/dayDraft.ts → pastDays). */
  pastDays?: Space[]
}

// Pinned first, then most recently active. Same order at 5 or 100 spaces.
export function orderSpacesForSwitcher(spaces: Space[]) {
  return [...spaces].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '')
  })
}

export function SpaceSwitcher({ spaces, currentId, onOpen, onShowAll, onCreate, pastDays = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru')
    const ordered = orderSpacesForSwitcher(spaces)
    return needle ? ordered.filter(space => space.name.toLocaleLowerCase('ru').includes(needle)) : ordered
  }, [spaces, query])
  const days = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru')
    return needle ? pastDays.filter(space => space.name.toLocaleLowerCase('ru').includes(needle)) : pastDays
  }, [pastDays, query])
  const pageCount = (space: Space) => (space.activeSession?.tabs || []).filter(tab => tab.url).length

  useEffect(() => { setCursor(0) }, [query, open])

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const finish = (action: () => void) => {
    setOpen(false)
    setQuery('')
    action()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(value => Math.min(items.length - 1, value + 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(value => Math.max(0, value - 1)) }
    if (event.key === 'Enter' && items[cursor]) { event.preventDefault(); finish(() => onOpen(items[cursor].id)) }
  }

  return (
    <div className="space-switcher" ref={rootRef}>
      <button
        type="button"
        className={`space-switcher-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(value => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>Пространства</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="space-switcher-panel" role="dialog" aria-label="Пространства" onKeyDown={onKeyDown}>
          <input
            className="space-switcher-search"
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Найти пространство"
            aria-label="Найти пространство"
          />
          <ul className="space-switcher-list" role="listbox">
            {items.map((space, index) => (
              <li key={space.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === cursor}
                  className={`space-switcher-item ${index === cursor ? 'is-active' : ''}`}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => finish(() => onOpen(space.id))}
                >
                  <span className="space-switcher-name">{space.name}</span>
                  {space.id === currentId ? <Check size={16} aria-label="Открыто" /> : space.pinned ? <Pin size={15} aria-label="Закреплено" /> : null}
                </button>
              </li>
            ))}
            {!items.length && !days.length && <li className="space-switcher-empty">Ничего не нашлось</li>}
          </ul>
          {days.length > 0 && (
            <div className="space-switcher-days" role="group" aria-label="Прошлые дни">
              <span className="space-switcher-days-title">Прошлые дни</span>
              {days.map(space => (
                <button key={space.id} type="button" className="space-switcher-day" onClick={() => finish(() => onOpen(space.id))}>
                  <span className="space-switcher-name">{space.name}</span>
                  <small>{pageCount(space)} {plural(pageCount(space), 'вкладка', 'вкладки', 'вкладок')}</small>
                </button>
              ))}
            </div>
          )}
          <div className="space-switcher-footer">
            <button type="button" onClick={() => finish(onShowAll)}><LayoutGrid size={17} />Все</button>
            <button type="button" onClick={() => finish(onCreate)}><Plus size={17} />Новое</button>
          </div>
        </div>
      )}
    </div>
  )
}
