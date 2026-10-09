import { useEffect, useId, useRef, useState, type PointerEvent, type HTMLAttributes } from 'react'
import { Archive, ArrowUpRight, ChevronLeft, ChevronRight, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import type { Space } from './types'
import { SpacePreview, spaceContents } from './SpacePreview'
import './spaces.css'
import { ActionMenu, type MenuAction } from './ActionMenu'
import { isCabinetPreview } from './cabinetMode'

export function SpacesOverview({ spaces, hasArchive, onOpen, onCreate, onArchive, onPin, onRename, onArchiveSpace, onDelete, interactions, actionsForSpace, dropSpaceId }: { spaces: Space[]; hasArchive: boolean; onOpen: (id: string) => void; onCreate: () => void; onArchive: () => void; onPin?: (space: Space) => void; onRename?: (space: Space) => void; onArchiveSpace?: (space: Space) => void; onDelete?: (space: Space) => void; interactions?: (space: Space) => HTMLAttributes<HTMLElement>; actionsForSpace?: (space: Space) => MenuAction[]; dropSpaceId?: string }) {
  const scroller = useRef<HTMLDivElement>(null)
  const scrollbarId = useId()
  const thumb = useRef<HTMLSpanElement>(null)
  const drag = useRef<{ pointerId: number; grabOffset: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [edges, setEdges] = useState({ before: false, after: false, offset: 0, max: 0, ratio: 1, peekingId: '' })
  useEffect(() => {
    const element = scroller.current!
    const measure = () => {
      const max = Math.max(0, element.scrollWidth - element.clientWidth)
      const offset = Math.max(0, Math.min(max, element.scrollLeft))
      const right = element.getBoundingClientRect().right
      const peeking = [...element.querySelectorAll<HTMLElement>('.overview-space')].find(card => { const bounds = card.getBoundingClientRect(); return bounds.left < right - 2 && bounds.right > right + 2 })
      setEdges({ before: offset > 2, after: offset < max - 2, offset, max, ratio: element.scrollWidth ? element.clientWidth / element.scrollWidth : 1, peekingId: peeking?.dataset.spaceId || '' })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    element.addEventListener('scroll', measure, { passive: true })
    return () => { observer.disconnect(); element.removeEventListener('scroll', measure) }
  }, [spaces.length])
  function move(direction: number) {
    const element = scroller.current!
    const card = element.querySelector<HTMLElement>('.overview-space')
    element.scrollBy({ left: direction * ((card?.offsetWidth || element.clientWidth) + 16), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  function moveThumb(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId || !thumb.current || !scroller.current) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const travel = bounds.width - thumb.current.getBoundingClientRect().width
    if (travel <= 0) return
    const progress = Math.max(0, Math.min(1, (event.clientX - bounds.left - drag.current.grabOffset) / travel))
    scroller.current.scrollTo({ left: progress * (scroller.current.scrollWidth - scroller.current.clientWidth), behavior: 'instant' })
  }
  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null; setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const progress = edges.max ? edges.offset / edges.max : 0
  return <main className="collection-stage spaces-stage" aria-label="Пространства">
    <div className="collection-header spaces-header"><div className="spaces-title"><h1>Пространства</h1><span>{spaces.length}</span></div><div className="spaces-header-actions">
      {(edges.before || edges.after) && <div className="spaces-navigation" aria-label="Прокрутка пространств"><button className="calm-icon" disabled={!edges.before} aria-label="Предыдущие пространства" onClick={() => move(-1)}><ChevronLeft size={19} /></button><button className="calm-icon" disabled={!edges.after} aria-label="Следующие пространства" onClick={() => move(1)}><ChevronRight size={19} /></button></div>}
      {hasArchive && <button className="soft-button" title="Архив пространств" onClick={onArchive}><Archive size={17} /><span>Архив</span></button>}
      <button className="primary-button" onClick={onCreate}><Plus size={18} /><span>Создать</span></button>
    </div></div>
    <div className={`spaces-rail${edges.before ? ' has-before' : ''}${edges.after ? ' has-after' : ''}`}>
      <div className="spaces-scroller" ref={scroller} id={scrollbarId} aria-label="Список пространств" tabIndex={0} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1) } }}>
        {spaces.map(space => isCabinetPreview ? <div {...interactions?.(space)} data-cabinet-space-target className={`overview-space cabinet-card card tone-${space.tone}${edges.peekingId === space.id ? ' is-peeking' : ''}${dropSpaceId === space.id ? ' is-drop-target' : ''}`} key={space.id} data-space-id={space.id}>
          <button draggable={Boolean(interactions)} className="overview-space-open" title={space.name} onClick={() => onOpen(space.id)}>
            <SpacePreview space={space} />
            <span className="space-card-copy"><strong>{space.name}</strong><small>{space.checkpoint?.nextStep || spaceContents(space) || 'Пустое пространство'}</small></span>
            <span className="overview-arrow"><ArrowUpRight size={19} /></span>
          </button>
          <ActionMenu className="overview-space-menu" label={`Действия с пространством «${space.name}»`} actions={actionsForSpace?.(space) || [
            { label: space.pinned ? 'Открепить из меню' : 'Закрепить в меню', icon: <Pin size={16} />, onSelect: () => onPin?.(space) },
            { label: 'Переименовать', icon: <Pencil size={16} />, onSelect: () => onRename?.(space) },
            { label: 'В архив', icon: <Archive size={16} />, onSelect: () => onArchiveSpace?.(space) },
            { label: 'Удалить пространство', icon: <Trash2 size={16} />, onSelect: () => onDelete?.(space) }
          ]} />
        </div> : <button className={`overview-space card tone-${space.tone}${edges.peekingId === space.id ? ' is-peeking' : ''}`} key={space.id} data-space-id={space.id} title={space.name} onClick={() => onOpen(space.id)}>
          <SpacePreview space={space} />
          <span className="space-card-copy"><strong>{space.name}</strong>{(space.checkpoint?.nextStep || spaceContents(space)) && <small>{space.checkpoint?.nextStep || spaceContents(space)}</small>}</span>
          <span className="overview-arrow"><ArrowUpRight size={19} /></span>
        </button>)}
      </div>
    </div>
    {edges.max > 2 && <div className={`spaces-scrollbar${dragging ? ' is-dragging' : ''}`} role="scrollbar" aria-label="Прокрутка пространств" aria-orientation="horizontal" aria-controls={scrollbarId} aria-valuemin={0} aria-valuemax={Math.round(edges.max)} aria-valuenow={Math.round(edges.offset)} tabIndex={0} onPointerDown={event => {
      if (event.button !== 0 || !thumb.current) return
      event.preventDefault(); event.currentTarget.focus({ preventScroll: true })
      const bounds = thumb.current.getBoundingClientRect()
      drag.current = { pointerId: event.pointerId, grabOffset: event.clientX >= bounds.left && event.clientX <= bounds.right ? event.clientX - bounds.left : bounds.width / 2 }
      event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); moveThumb(event)
    }} onPointerMove={moveThumb} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={() => { drag.current = null; setDragging(false) }} onKeyDown={event => {
      const element = scroller.current!
      const positions: Record<string, number> = { ArrowLeft: element.scrollLeft - 40, ArrowRight: element.scrollLeft + 40, PageUp: element.scrollLeft - element.clientWidth, PageDown: element.scrollLeft + element.clientWidth, Home: 0, End: edges.max }
      if (!(event.key in positions)) return
      event.preventDefault(); element.scrollTo({ left: positions[event.key], behavior: 'instant' })
    }}><span className="spaces-scroll-thumb" ref={thumb} style={{ width: `max(32px, ${edges.ratio * 100}%)`, left: `${progress * 100}%`, transform: `translateX(-${progress * 100}%)` }} /></div>}
  </main>
}
