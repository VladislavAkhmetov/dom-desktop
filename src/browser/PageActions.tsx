import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'motion/react'
import { Check, Folder, FolderInput, FolderPlus, Globe2, Plus, Search, Star, StarOff, X } from 'lucide-react'
import type { BrowserTab, Space } from '../types'
import { FluidGroup, FluidSurface } from '../FluidMotion'
import { favoritePage } from './bookmarks'
import './page-actions.css'

export interface FavoritePageRequest { groupId?: string; newGroupName?: string }
export interface PageActionsProps {
  spaceId: string
  spaces: Space[]
  tab?: BrowserTab
  onFavorite: (tab: BrowserTab, request: FavoritePageRequest) => Promise<boolean>
  onRemoveFavorite: (tab: BrowserTab) => Promise<boolean>
  onMove: (tabId: string, spaceId: string, newSpaceName?: string) => Promise<boolean>
}

export function PageActions({ spaceId, spaces, tab, onFavorite, onRemoveFavorite, onMove }: PageActionsProps) {
  const [kind, setKind] = useState<'favorite' | 'move' | null>(null)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const favoriteButton = useRef<HTMLButtonElement>(null)
  const moveButton = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)
  const operation = useRef(0)
  const id = useId()
  const favorite = favoritePage(spaces, tab?.url || '')
  const groups = spaces.find(space => space.kind === 'web' && !space.archivedAt)?.bookmarkGroups || []
  const destinationName = favorite?.bookmarkGroupId ? groups.find(group => group.id === favorite.bookmarkGroupId)?.name || 'Общее' : 'Общее'
  const available = spaces.filter(space => !space.archivedAt)
  const normalized = query.trim().toLocaleLowerCase('ru')
  const matches = (name: string) => name.toLocaleLowerCase('ru').includes(normalized)
  const spaceName = (space: Space) => space.kind === 'web' ? 'Браузинг' : space.name
  const canCreateSpace = Boolean(normalized && !available.some(space => spaceName(space).trim().toLocaleLowerCase('ru') === normalized))
  const canCreateGroup = Boolean(normalized && !groups.some(group => group.name.trim().toLocaleLowerCase('ru') === normalized) && normalized !== 'общее')
  const canSave = Boolean(tab?.url && /^https?:\/\//i.test(tab.url))

  useEffect(() => {
    operation.current++; inFlight.current = false
    setKind(null); setQuery(''); setError(''); setPending(false)
  }, [spaceId, tab?.id, tab?.url])
  useEffect(() => () => { operation.current++ }, [])

  function close(focus = true) {
    setKind(null)
    if (focus) (kind === 'favorite' ? favoriteButton : moveButton).current?.focus()
  }

  useLayoutEffect(() => {
    if (!kind) return
    const place = () => {
      const anchor = (kind === 'favorite' ? favoriteButton : moveButton).current?.getBoundingClientRect()
      const menu = popover.current
      if (!anchor || !menu) return
      const width = menu.offsetWidth, height = menu.offsetHeight
      const below = anchor.bottom + 7
      const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, anchor.top - height - 7)
      setPosition({ top: Math.max(8, Math.min(top, window.innerHeight - height - 8)), left: Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8)) })
    }
    place()
    const observer = new ResizeObserver(place)
    if (popover.current) observer.observe(popover.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [kind])

  useEffect(() => {
    if (!kind) return
    search.current?.focus()
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!popover.current?.contains(target) && !favoriteButton.current?.contains(target) && !moveButton.current?.contains(target)) close(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [kind])

  async function perform(action: () => Promise<boolean>, dismiss = true) {
    if (inFlight.current) return
    const token = ++operation.current
    inFlight.current = true; setPending(true); setError('')
    try {
      const saved = await action()
      if (token !== operation.current) return
      if (saved) { if (dismiss) close() }
      else setError('Изменение не сохранилось. Попробуйте ещё раз.')
    } catch (cause) {
      if (token === operation.current) setError(cause instanceof Error ? cause.message : 'Не удалось сохранить изменение.')
    } finally {
      if (token === operation.current) { inFlight.current = false; setPending(false) }
    }
  }

  const save = (request: FavoritePageRequest = {}) => { if (tab) void perform(() => onFavorite(tab, request)) }
  const move = (destination: string, name?: string) => { if (tab) void perform(() => onMove(tab.id, destination, name)) }
  const heading = kind === 'favorite' ? 'Избранное' : 'Перенести в пространство'

  return <div className="browser-page-actions" role="group" aria-label="Действия со страницей">
    <button ref={favoriteButton} type="button" className={`browser-save-page browser-favorite-page ${favorite ? 'is-saved' : ''}`} disabled={!canSave}
      aria-label={favorite ? 'Изменить избранное' : 'В избранное'} title={canSave ? `${favorite ? `Избранное · ${destinationName}` : 'В избранное'} · Ctrl D` : 'Сначала откройте страницу'}
      aria-haspopup="dialog" aria-expanded={kind === 'favorite'} aria-controls={kind === 'favorite' ? id : undefined} onClick={() => {
        if (kind === 'favorite') { close(); return }
        setKind('favorite'); setQuery(''); setError('')
        if (tab && !favorite) void perform(() => onFavorite(tab, {}), false)
      }}><Star size={17} /></button>
    <button ref={moveButton} type="button" className={`browser-move-page ${kind === 'move' ? 'is-selected' : ''}`} disabled={!tab?.url} aria-label="Перенести в другое пространство" title="Перенести в другое пространство"
      aria-haspopup="dialog" aria-expanded={kind === 'move'} aria-controls={kind === 'move' ? id : undefined} onClick={() => {
        if (kind === 'move') { close(); return }
        setKind('move'); setQuery(''); setError('')
      }}><FolderInput size={17} /></button>
    {createPortal(<AnimatePresence>{kind && <FluidSurface key={id} ref={popover} id={id} role="dialog" aria-labelledby={`${id}-heading`}
      className="browser-menu action-menu-popover browser-destination-popover" style={{ position: 'fixed', ...position, right: 'auto', zIndex: 120, transformOrigin: 'top right' }} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
        const input = event.target instanceof HTMLInputElement
        if (input && event.key === 'Enter') {
          if (!event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); popover.current?.querySelector<HTMLButtonElement>('[data-destination-option]:not(:disabled)')?.click() }
          return
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || input && ['Home', 'End'].includes(event.key)) return
        const options = [...popover.current!.querySelectorAll<HTMLButtonElement>('[data-destination-option]:not(:disabled)')]
        if (!options.length) return
        event.preventDefault()
        const current = options.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
        options[next]?.focus()
      }}>
      <div className="page-destination-heading"><div><h2 id={`${id}-heading`}>{heading}</h2>{kind === 'favorite' && <p aria-live="polite">{pending ? 'Сохраняем…' : favorite ? `Сохранено: ${destinationName}` : 'Выберите категорию'}</p>}</div><button type="button" className="page-destination-close" onClick={() => close()} aria-label="Закрыть выбор места"><X size={16} /></button></div>
      <label className="page-destination-search" htmlFor={`${id}-search`}><Search size={16} /><input id={`${id}-search`} ref={search} value={query} maxLength={80} autoComplete="off" spellCheck={false}
        aria-label={kind === 'favorite' ? 'Найти или создать категорию' : 'Найти или создать пространство'} placeholder={kind === 'favorite' ? 'Найти или создать категорию' : 'Найти или создать пространство'} onChange={event => setQuery(event.target.value)} /></label>
      <FluidGroup className="fluid-menu-items page-destination-list" axis="y">
        {kind === 'favorite' ? <>
          {matches('Общее') && <button type="button" data-destination-option disabled={pending} aria-pressed={Boolean(favorite && !favorite.bookmarkGroupId)} onClick={() => save()}><Star size={17} /><span>Общее</span>{favorite && !favorite.bookmarkGroupId && <Check size={16} />}</button>}
          {groups.filter(group => matches(group.name)).map(group => <button type="button" data-destination-option key={group.id} disabled={pending} aria-pressed={favorite?.bookmarkGroupId === group.id} onClick={() => save({ groupId: group.id })}><Folder size={17} /><span>{group.name}</span>{favorite?.bookmarkGroupId === group.id && <Check size={16} />}</button>)}
          {canCreateGroup && <button type="button" data-destination-option className="page-destination-create" disabled={pending} onClick={() => save({ newGroupName: query.trim() })}><Plus size={17} /><span>Создать «{query.trim()}» и сохранить</span></button>}
        </> : <>
          {available.filter(space => matches(spaceName(space))).map(space => <button type="button" data-destination-option key={space.id} disabled={pending || space.id === spaceId} onClick={() => move(space.id)}>{space.kind === 'web' ? <Globe2 size={17} /> : <Folder size={17} />}<span>{spaceName(space)}</span>{space.id === spaceId && <small>Текущее</small>}</button>)}
          {canCreateSpace && <button type="button" data-destination-option className="page-destination-create" disabled={pending} onClick={() => move('', query.trim())}><FolderPlus size={17} /><span>Создать «{query.trim()}» и перенести</span></button>}
          {!normalized && <p className="page-destination-hint">Введите имя, чтобы создать новое пространство.</p>}
        </>}
      </FluidGroup>
      {kind === 'favorite' && favorite && <div className="page-destination-footer"><button type="button" disabled={pending} onClick={() => { if (tab) void perform(() => onRemoveFavorite(tab)) }}><StarOff size={17} /><span>Удалить из избранного</span></button></div>}
      {error && <p className="page-destination-error" role="alert">{error}</p>}
    </FluidSurface>}</AnimatePresence>, document.body)}
  </div>
}
