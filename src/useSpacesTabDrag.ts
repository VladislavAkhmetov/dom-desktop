import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { Space } from './types'

export function useSpacesTabDrag({
  viewportRef,
  spaces,
  onReorderSpace
}: {
  viewportRef: RefObject<HTMLElement | null>
  spaces: Space[]
  onReorderSpace: (id: string, targetId: string, after: boolean) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [previewIds, setPreviewIds] = useState<string[]>([])
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null)
  const spacesRef = useRef(spaces)
  spacesRef.current = spaces
  const onReorderSpaceRef = useRef(onReorderSpace)
  onReorderSpaceRef.current = onReorderSpace

  const pointerDrag = useRef<{
    id: string
    x: number
    y: number
    pointerId: number
    element: HTMLElement
    started: boolean
  } | null>(null)
  const suppressClick = useRef(false)
  const clickTimer = useRef<number | undefined>(undefined)
  const dragLayout = useRef<{
    id: string
    grabOffset: number
    width: number
    slots: { id: string; left: number; width: number }[]
    preview: string[]
  } | null>(null)

  const finishDrag = () => {
    dragLayout.current = null
    setDragId(null)
    setPreviewIds([])
    setDragPointer(null)
  }

  const captureDrag = (space: Space, clientX: number, source: HTMLElement) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const vBounds = viewport.getBoundingClientRect()
    const sourceBounds = source.getBoundingClientRect()
    const currentSpaces = spacesRef.current
    const elements = [...viewport.querySelectorAll<HTMLElement>('.chrome-space[data-space-id]')]
    const rectMap = new Map(elements.map(el => [el.dataset.spaceId!, el.getBoundingClientRect()]))

    const slots = currentSpaces.map((item, index) => {
      const rect = rectMap.get(item.id)
      const width = rect && rect.width > 0 ? rect.width : 100
      const left = rect && (rect.left || rect.width > 0) ? rect.left - vBounds.left + viewport.scrollLeft : index * (width + 12)
      return {
        id: item.id,
        left,
        width
      }
    })

    const grabOffset = sourceBounds.width > 0 ? clientX - sourceBounds.left : 40
    const dragWidth = sourceBounds.width > 0 ? sourceBounds.width : 100

    dragLayout.current = {
      id: space.id,
      grabOffset,
      width: dragWidth,
      slots,
      preview: slots.map(s => s.id)
    }
    setPreviewIds(dragLayout.current.preview)
    setDragId(space.id)
  }

  const updatePreview = (clientX: number) => {
    const layout = dragLayout.current
    const viewport = viewportRef.current
    if (!layout || !viewport) return
    const vBounds = viewport.getBoundingClientRect()

    if (clientX < vBounds.left + 36) {
      viewport.scrollLeft -= 14
    } else if (clientX > vBounds.right - 36) {
      viewport.scrollLeft += 14
    }

    const center = clientX - vBounds.left + viewport.scrollLeft - layout.grabOffset + layout.width / 2
    const sourceIndex = layout.slots.findIndex(slot => slot.id === layout.id)
    if (sourceIndex < 0) return

    let nearestIndex = 0
    let minDiff = Infinity
    for (let i = 0; i < layout.slots.length; i++) {
      const slot = layout.slots[i]
      const slotCenter = slot.left + slot.width / 2
      const diff = Math.abs(slotCenter - center)
      if (diff < minDiff) {
        minDiff = diff
        nearestIndex = i
      }
    }

    const preview = layout.slots.map(s => s.id)
    preview.splice(sourceIndex, 1)
    preview.splice(nearestIndex, 0, layout.id)
    if (preview.some((id, index) => id !== layout.preview[index])) {
      layout.preview = preview
      setPreviewIds(preview)
    }
  }

  const commitDrag = () => {
    const layout = dragLayout.current
    if (!layout) return
    const sourceIndex = layout.slots.findIndex(s => s.id === layout.id)
    const targetIndex = layout.preview.indexOf(layout.id)
    if (sourceIndex !== targetIndex && targetIndex >= 0) {
      const after = targetIndex > sourceIndex
      const targetId = layout.slots[targetIndex].id
      onReorderSpaceRef.current(layout.id, targetId, after)
    }
  }

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const pointer = pointerDrag.current
      if (!pointer || event.pointerId !== pointer.pointerId) return
      if (!pointer.started) {
        if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 5) return
        const space = spacesRef.current.find(s => s.id === pointer.id)
        if (!space) return
        captureDrag(space, pointer.x, pointer.element)
        pointer.started = true
        try {
          pointer.element.setPointerCapture?.(pointer.pointerId)
        } catch {}
        suppressClick.current = true
      }
      event.preventDefault()
      setDragPointer({ x: event.clientX, y: event.clientY })
      updatePreview(event.clientX)
    }

    const finish = (event: PointerEvent) => {
      const pointer = pointerDrag.current
      if (!pointer || event.pointerId !== pointer.pointerId) return
      pointerDrag.current = null
      if (!pointer.started) return

      const layout = dragLayout.current
      if (layout && event.type !== 'pointercancel') {
        updatePreview(event.clientX)
        commitDrag()
      }
      try {
        if (pointer.element.hasPointerCapture?.(pointer.pointerId)) {
          pointer.element.releasePointerCapture(pointer.pointerId)
        }
      } catch {}
      finishDrag()
      window.clearTimeout(clickTimer.current)
      clickTimer.current = window.setTimeout(() => {
        suppressClick.current = false
      }, 50)
    }

    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !pointerDrag.current) return
      const pointer = pointerDrag.current
      pointerDrag.current = null
      try {
        if (pointer.element.hasPointerCapture?.(pointer.pointerId)) {
          pointer.element.releasePointerCapture(pointer.pointerId)
        }
      } catch {}
      finishDrag()
      suppressClick.current = false
    }

    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    window.addEventListener('keydown', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('keydown', cancel)
    }
  }, [])

  useEffect(() => () => window.clearTimeout(clickTimer.current), [])

  const startDrag = (event: DragEvent<HTMLElement>, space: Space) => {
    if (pointerDrag.current) {
      event.preventDefault()
      return
    }
    captureDrag(space, event.clientX, event.currentTarget)
    event.dataTransfer.setData('application/x-dom-space', JSON.stringify({ spaceId: space.id }))
    event.dataTransfer.effectAllowed = 'move'
  }

  const previewDrag = (event: DragEvent<HTMLElement>) => {
    if (!dragLayout.current) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    updatePreview(event.clientX)
  }

  const dropTab = (event: DragEvent<HTMLElement>) => {
    if (!dragLayout.current) return
    event.preventDefault()
    commitDrag()
    finishDrag()
  }

  const previewStyle = (spaceId: string): CSSProperties | undefined => {
    const layout = dragLayout.current
    if (!layout || !previewIds.length) return undefined
    const original = layout.slots.find(slot => slot.id === spaceId)
    const target = layout.slots[previewIds.indexOf(spaceId)]
    return original && target ? { transform: `translateX(${target.left - original.left}px)` } : undefined
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, space: Space) => {
    if (event.button !== 0 || event.pointerType === 'touch') return
    if (event.target instanceof Element && event.target.closest('.action-menu')) return
    pointerDrag.current = {
      id: space.id,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      element: event.currentTarget,
      started: false
    }
  }

  const draggedSpace = spaces.find(s => s.id === dragId)

  return {
    dragId,
    previewIds,
    dragPointer,
    dragLayout,
    draggedSpace,
    suppressClick,
    previewStyle,
    onPointerDown,
    startDrag,
    previewDrag,
    dropTab,
    finishDrag
  }
}
