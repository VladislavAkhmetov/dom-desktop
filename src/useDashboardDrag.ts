import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { WidgetConfig, WidgetType } from './types'
import { adaptRowSpans, groupWidgetsIntoRows, widgetConstraints, widgetDefaultSpan, widgetSpan } from './dashboard'
import { sound } from './sound'

export type ResizeEdge = 'right' | 'bottom' | 'corner' | 'left'

export interface LivePixelSize {
  width: number
  height: number
}

export interface GhostSpan {
  colSpan: number
  rowSpan: number
  width: number
  height: number
}

interface Options {
  widgets: WidgetConfig[]
  onWidgetsChange: (next: WidgetConfig[]) => void
  gridRef: React.RefObject<HTMLElement | null>
}

interface ResizeStartInfo {
  widgetId: string
  edge: ResizeEdge
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startColSpan: number
  startRowSpan: number
  colWidth: number
  rowHeight: number
  gap: number
  minCol: number
  maxCol: number
  minRow: number
  maxRow: number
}

export function useDashboardDrag({ widgets, onWidgetsChange, gridRef }: Options) {
  const [isEditing, setIsEditing] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [isLandingId, setIsLandingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [resizingEdge, setResizingEdge] = useState<ResizeEdge | null>(null)
  const [isSnappingId, setIsSnappingId] = useState<string | null>(null)
  const [livePixelSizes, setLivePixelSizes] = useState<Record<string, LivePixelSize>>({})
  const [ghostSpans, setGhostSpans] = useState<Record<string, GhostSpan>>({})
  const [liveSpans, setLiveSpans] = useState<Record<string, { colSpan: number; rowSpan: number }>>({})
  const [resizeShiftX, setResizeShiftX] = useState<number>(0)

  const longPressTimerRef = useRef<number | null>(null)
  const snapTimeoutRef = useRef<number | null>(null)
  const landingTimeoutRef = useRef<number | null>(null)
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartRef = useRef<{ widgetId: string; startX: number; startY: number } | null>(null)
  const resizeStartRef = useRef<ResizeStartInfo | null>(null)
  const lastAdaptedSpansRef = useRef<Record<string, number>>({})
  const lastGhostTargetRef = useRef<{ id: string; colSpan: number; rowSpan: number } | null>(null)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const snapshotWidgetsRef = useRef<WidgetConfig[] | null>(null)

  // Capture snapshot whenever entering edit mode if not already captured
  useEffect(() => {
    if (isEditing && snapshotWidgetsRef.current === null) {
      snapshotWidgetsRef.current = widgets.map(w => ({ ...w }))
    } else if (!isEditing) {
      snapshotWidgetsRef.current = null
    }
  }, [isEditing, widgets])

  const cancelEditing = useCallback(() => {
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current)
      snapTimeoutRef.current = null
    }
    if (landingTimeoutRef.current) {
      window.clearTimeout(landingTimeoutRef.current)
      landingTimeoutRef.current = null
    }
    if (snapshotWidgetsRef.current) {
      onWidgetsChange(snapshotWidgetsRef.current)
      snapshotWidgetsRef.current = null
    }
    setIsEditing(false)
    setDraggingId(null)
    setDragOffset(null)
    setIsLandingId(null)
    setResizingId(null)
    setResizingEdge(null)
    setIsSnappingId(null)
    setLivePixelSizes({})
    setGhostSpans({})
    setLiveSpans({})
    setResizeShiftX(0)
    dragStartRef.current = null
    lastGhostTargetRef.current = null
  }, [onWidgetsChange])

  const saveEditing = useCallback(() => {
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current)
      snapTimeoutRef.current = null
    }
    if (landingTimeoutRef.current) {
      window.clearTimeout(landingTimeoutRef.current)
      landingTimeoutRef.current = null
    }
    snapshotWidgetsRef.current = null
    setIsEditing(false)
    setDraggingId(null)
    setDragOffset(null)
    setIsLandingId(null)
    setResizingId(null)
    setResizingEdge(null)
    setIsSnappingId(null)
    setLivePixelSizes({})
    setGhostSpans({})
    setLiveSpans({})
    setResizeShiftX(0)
    dragStartRef.current = null
    lastGhostTargetRef.current = null
  }, [])

  // Keyboard shortcut: Escape cancels edit mode and rolls back to snapshot
  useEffect(() => {
    if (!isEditing) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelEditing()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelEditing, isEditing])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current)
      if (landingTimeoutRef.current) window.clearTimeout(landingTimeoutRef.current)
      clearLongPress()
    }
  }, [clearLongPress])

  // Card pointer down (supports hold-to-edit and dragging in edit mode)
  const onCardPointerDown = useCallback((e: ReactPointerEvent, widgetId: string) => {
    // Only respond to primary button (left click / touch)
    if (e.button !== 0) return

    const target = e.target as HTMLElement
    // Resize handles and delete buttons have their own handlers
    if (target.closest('.widget-edge-handle, .widget-corner-handle, .widget-resize-handle, .widget-remove-btn')) {
      return
    }

    // When NOT in edit mode, clicks on buttons/inputs should work normally without starting hold-to-edit
    if (!isEditing && target.closest('button, input, textarea, select, a')) {
      return
    }

    startPosRef.current = { x: e.clientX, y: e.clientY }

    if (isEditing) {
      dragStartRef.current = { widgetId, startX: e.clientX, startY: e.clientY }
      setDraggingId(widgetId)
      setDragOffset({ x: 0, y: 0 })
      return
    }

    // Start long-press timer to enter edit mode (650ms)
    clearLongPress()
    longPressTimerRef.current = window.setTimeout(() => {
      setIsEditing(true)
      dragStartRef.current = { widgetId, startX: e.clientX, startY: e.clientY }
      setDraggingId(widgetId)
      setDragOffset({ x: 0, y: 0 })
      longPressTimerRef.current = null
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(30) } catch {}
      }
    }, 650)
  }, [clearLongPress, isEditing])

  // Resize handle pointer down (supports edge: right, bottom, corner)
  const onResizePointerDown = useCallback((
    e: ReactPointerEvent,
    widgetId: string,
    edge: ResizeEdge = 'corner'
  ) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.button !== 0) return

    const widget = widgets.find(w => w.id === widgetId)
    if (!widget) return

    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current)
      snapTimeoutRef.current = null
    }

    const span = widgetSpan(widget)
    const bounds = widgetConstraints[widget.type] || { minCol: 2, maxCol: 12, minRow: 1, maxRow: 8 }
    const grid = gridRef.current
    const gridWidth = (grid && grid.clientWidth > 0) ? grid.clientWidth : 1200
    const gap = 18
    const colWidth = Math.max(1, (gridWidth - 11 * gap) / 12)
    const rowHeight = 56

    // Measure actual rendered pixel size from DOM (or fallback if unmeasured/jsdom)
    const cardEl = (e.currentTarget as HTMLElement).closest('[data-widget-id]') as HTMLElement | null
    const rect = cardEl?.getBoundingClientRect()
    const fallbackWidth = span.colSpan * colWidth + (span.colSpan - 1) * gap
    const fallbackHeight = span.rowSpan * rowHeight + (span.rowSpan - 1) * gap
    const startWidth = (rect && rect.width > 0) ? rect.width : fallbackWidth
    const startHeight = (rect && rect.height > 0) ? rect.height : fallbackHeight

    // Calculate gesture-specific maxCol based on position in row
    const allRows = groupWidgetsIntoRows(widgets)
    const widgetRow = allRows.find(r => r.some(w => w.id === widgetId)) || [widget]
    const widgetIdx = widgetRow.findIndex(w => w.id === widgetId)

    const rowTotalCols = widgetRow.reduce((sum, item) => sum + widgetSpan(item).colSpan, 0)
    const emptyColsInRow = Math.max(0, 12 - rowTotalCols)

    let gestureMaxCol = bounds.maxCol
    if (edge === 'right' || edge === 'corner') {
      if (widgetIdx >= widgetRow.length - 1) {
        // Rightmost card in row: can only expand into empty row space to the right
        gestureMaxCol = Math.min(bounds.maxCol, span.colSpan + emptyColsInRow)
      } else {
        // Can expand into right neighbor(s) + any empty space
        const rightNeighbors = widgetRow.slice(widgetIdx + 1)
        const rightCanShrink = rightNeighbors.reduce((sum, n) => {
          const nb = widgetConstraints[n.type] || { minCol: 2, maxCol: 12, minRow: 1, maxRow: 8 }
          return sum + Math.max(0, widgetSpan(n).colSpan - nb.minCol)
        }, 0)
        gestureMaxCol = Math.min(bounds.maxCol, span.colSpan + rightCanShrink + emptyColsInRow)
      }
    } else if (edge === 'left') {
      if (widgetIdx <= 0) {
        // Leftmost card in row: cannot expand beyond its current span (hits left dashboard boundary)
        gestureMaxCol = span.colSpan
      } else {
        // Can expand into left neighbor(s)
        const leftNeighbors = widgetRow.slice(0, widgetIdx)
        const leftCanShrink = leftNeighbors.reduce((sum, n) => {
          const nb = widgetConstraints[n.type] || { minCol: 2, maxCol: 12, minRow: 1, maxRow: 8 }
          return sum + Math.max(0, widgetSpan(n).colSpan - nb.minCol)
        }, 0)
        gestureMaxCol = Math.min(bounds.maxCol, span.colSpan + leftCanShrink)
      }
    }

    resizeStartRef.current = {
      widgetId,
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startWidth,
      startHeight,
      startColSpan: span.colSpan,
      startRowSpan: span.rowSpan,
      colWidth,
      rowHeight,
      gap,
      minCol: bounds.minCol,
      maxCol: gestureMaxCol,
      minRow: bounds.minRow,
      maxRow: bounds.maxRow
    }

    lastAdaptedSpansRef.current = { [widgetId]: span.colSpan }

    setResizingId(widgetId)
    setResizingEdge(edge)
    setIsSnappingId(null)

    setLivePixelSizes(prev => ({
      ...prev,
      [widgetId]: { width: Math.round(startWidth), height: Math.round(startHeight) }
    }))

    const initialTargetWidth = span.colSpan * colWidth + (span.colSpan - 1) * gap
    const initialTargetHeight = span.rowSpan * rowHeight + (span.rowSpan - 1) * gap

    setGhostSpans(prev => ({
      ...prev,
      [widgetId]: {
        colSpan: span.colSpan,
        rowSpan: span.rowSpan,
        width: Math.round(initialTargetWidth),
        height: Math.round(initialTargetHeight)
      }
    }))

    setLiveSpans(prev => ({ ...prev, [widgetId]: span }))
    lastGhostTargetRef.current = { id: widgetId, colSpan: span.colSpan, rowSpan: span.rowSpan }

    if (e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    }
  }, [gridRef, widgets])

  // Global window pointer move for dragging and resizing
  useEffect(() => {
    const handlePointerMove = (e: globalThis.PointerEvent) => {
      // 1. Check long-press cancellation if moved > 8px
      if (longPressTimerRef.current) {
        const dx = Math.abs(e.clientX - startPosRef.current.x)
        const dy = Math.abs(e.clientY - startPosRef.current.y)
        if (dx > 8 || dy > 8) {
          clearLongPress()
        }
      }

      // 2. Handle card continuous pixel resize tracking with neighbor row adaptation and soft rubber-band resistance
      if (resizeStartRef.current && resizingId) {
        const {
          widgetId,
          edge,
          startX,
          startY,
          startWidth,
          startHeight,
          colWidth,
          rowHeight,
          gap,
          minCol,
          maxCol,
          minRow,
          maxRow
        } = resizeStartRef.current

        const deltaX = e.clientX - startX
        const deltaY = e.clientY - startY

        const minWidth = minCol * colWidth + (minCol - 1) * gap
        const maxWidth = maxCol * colWidth + (maxCol - 1) * gap
        const minHeight = minRow * rowHeight + (minRow - 1) * gap
        const maxHeight = maxRow * rowHeight + (maxRow - 1) * gap

        let curWidth = startWidth
        let curHeight = startHeight

        if (edge === 'right' || edge === 'corner') {
          const rawW = startWidth + deltaX
          if (rawW > maxWidth) {
            const over = rawW - maxWidth
            curWidth = maxWidth + Math.pow(over, 0.55) * 1.5
          } else if (rawW < minWidth) {
            const under = minWidth - rawW
            curWidth = minWidth - Math.pow(under, 0.55) * 1.5
          } else {
            curWidth = rawW
          }
        }
        if (edge === 'left') {
          const rawW = startWidth - deltaX
          if (rawW > maxWidth) {
            const over = rawW - maxWidth
            curWidth = maxWidth + Math.pow(over, 0.55) * 1.5
          } else if (rawW < minWidth) {
            const under = minWidth - rawW
            curWidth = minWidth - Math.pow(under, 0.55) * 1.5
          } else {
            curWidth = rawW
          }
          setResizeShiftX(startWidth - curWidth)
        }
        if (edge === 'bottom' || edge === 'corner') {
          const rawH = startHeight + deltaY
          if (rawH > maxHeight) {
            const over = rawH - maxHeight
            curHeight = maxHeight + Math.pow(over, 0.55) * 1.5
          } else if (rawH < minHeight) {
            const under = minHeight - rawH
            curHeight = minHeight - Math.pow(under, 0.55) * 1.5
          } else {
            curHeight = rawH
          }
        }

        // Calculate target snapped spans for the resizing card
        const targetColSpan = Math.max(minCol, Math.min(maxCol, Math.round((curWidth + gap) / (colWidth + gap))))
        const targetRowSpan = Math.max(minRow, Math.min(maxRow, Math.round((curHeight + gap) / (rowHeight + gap))))

        if (
          !lastGhostTargetRef.current ||
          lastGhostTargetRef.current.id !== widgetId ||
          lastGhostTargetRef.current.colSpan !== targetColSpan ||
          lastGhostTargetRef.current.rowSpan !== targetRowSpan
        ) {
          if (lastGhostTargetRef.current && lastGhostTargetRef.current.id === widgetId) {
            sound.playWoodSnap('hover')
          }
          lastGhostTargetRef.current = { id: widgetId, colSpan: targetColSpan, rowSpan: targetRowSpan }
        }

        // Adapt neighbor cards in the same row
        const adapted = adaptRowSpans(widgets, widgetId, targetColSpan, edge)
        lastAdaptedSpansRef.current = adapted

        const finalTargetColSpan = adapted[widgetId] ?? targetColSpan
        const targetWidth = finalTargetColSpan * colWidth + (finalTargetColSpan - 1) * gap
        const targetHeight = targetRowSpan * rowHeight + (targetRowSpan - 1) * gap

        // 1-to-1 immediate pixel tracking for resizing card
        setLivePixelSizes(prev => {
          const nextSizes: Record<string, LivePixelSize> = {
            ...prev,
            [widgetId]: { width: Math.round(curWidth), height: Math.round(curHeight) }
          }
          // Also adapt neighbor cards continuously in pixels
          for (const [id, col] of Object.entries(adapted)) {
            if (id !== widgetId) {
              const nw = col * colWidth + (col - 1) * gap
              const wObj = widgets.find(w => w.id === id)
              const nr = wObj ? widgetSpan(wObj).rowSpan : 4
              const nh = nr * rowHeight + (nr - 1) * gap
              nextSizes[id] = { width: Math.round(nw), height: Math.round(nh) }
            }
          }
          return nextSizes
        })

        // Target ghost outline for resizing card and neighbors
        setGhostSpans(prev => {
          const nextGhosts: Record<string, GhostSpan> = {
            ...prev,
            [widgetId]: {
              colSpan: finalTargetColSpan,
              rowSpan: targetRowSpan,
              width: Math.round(targetWidth),
              height: Math.round(targetHeight)
            }
          }
          for (const [id, col] of Object.entries(adapted)) {
            if (id !== widgetId) {
              const nw = col * colWidth + (col - 1) * gap
              const wObj = widgets.find(w => w.id === id)
              const nr = wObj ? widgetSpan(wObj).rowSpan : 4
              const nh = nr * rowHeight + (nr - 1) * gap
              nextGhosts[id] = {
                colSpan: col,
                rowSpan: nr,
                width: Math.round(nw),
                height: Math.round(nh)
              }
            }
          }
          return nextGhosts
        })

        setLiveSpans(prev => {
          const nextSpans = { ...prev, [widgetId]: { colSpan: finalTargetColSpan, rowSpan: targetRowSpan } }
          for (const [id, col] of Object.entries(adapted)) {
            if (id !== widgetId) {
              const wObj = widgets.find(w => w.id === id)
              const nr = wObj ? widgetSpan(wObj).rowSpan : 4
              nextSpans[id] = { colSpan: col, rowSpan: nr }
            }
          }
          return nextSpans
        })

        return
      }

      // 3. Handle card drag reordering with live floating preview offset
      if (dragStartRef.current && draggingId && isEditing) {
        const dx = e.clientX - dragStartRef.current.startX
        const dy = e.clientY - dragStartRef.current.startY
        setDragOffset({ x: dx, y: dy })

        const targetElement = typeof document !== 'undefined' && typeof document.elementFromPoint === 'function'
          ? document.elementFromPoint(e.clientX, e.clientY)
          : null
        const cardElement = targetElement?.closest('[data-widget-id]') as HTMLElement | null
        if (cardElement) {
          const hoverId = cardElement.getAttribute('data-widget-id')
          if (hoverId && hoverId !== draggingId) {
            const dragIndex = widgets.findIndex(w => w.id === draggingId)
            const hoverIndex = widgets.findIndex(w => w.id === hoverId)
            if (dragIndex !== -1 && hoverIndex !== -1) {
              // Measure relative slot shift between dragged card and hovered card
              const dragEl = gridRef.current?.querySelector(`[data-widget-id="${draggingId}"]`) as HTMLElement | null
              const hoverEl = cardElement
              const dragRect = dragEl?.getBoundingClientRect()
              const hoverRect = hoverEl.getBoundingClientRect()

              if (dragRect && hoverRect && dragRect.width > 0 && hoverRect.width > 0) {
                // dragRect includes active translation, so the actual grid slot is (dragRect.left - dx)
                const currentSlotLeft = dragRect.left - dx
                const currentSlotTop = dragRect.top - dy
                const shiftX = hoverRect.left - currentSlotLeft
                const shiftY = hoverRect.top - currentSlotTop
                dragStartRef.current.startX += shiftX
                dragStartRef.current.startY += shiftY
                setDragOffset({
                  x: e.clientX - dragStartRef.current.startX,
                  y: e.clientY - dragStartRef.current.startY
                })
              }

              const next = [...widgets]
              const [moved] = next.splice(dragIndex, 1)
              next.splice(hoverIndex, 0, moved)
              sound.playWoodSnap('hover')
              onWidgetsChange(next)
            }
          }
        }
      }
    }

    const handlePointerUp = () => {
      clearLongPress()

      // Handle resize release & snap landing
      if (resizeStartRef.current && resizingId) {
        sound.playWoodSnap('land')
        lastGhostTargetRef.current = null
        const currentWidgetId = resizingId
        const { colWidth, rowHeight, gap } = resizeStartRef.current
        const currentGhost = ghostSpans[currentWidgetId]
        const adapted = lastAdaptedSpansRef.current

        const widget = widgets.find(w => w.id === currentWidgetId)
        const fallbackSpan = widget ? widgetSpan(widget) : { colSpan: 6, rowSpan: 4 }
        const finalColSpan = adapted[currentWidgetId] ?? (currentGhost ? currentGhost.colSpan : fallbackSpan.colSpan)
        const finalRowSpan = currentGhost ? currentGhost.rowSpan : fallbackSpan.rowSpan

        const snappedWidth = Math.round(finalColSpan * colWidth + (finalColSpan - 1) * gap)
        const snappedHeight = Math.round(finalRowSpan * rowHeight + (finalRowSpan - 1) * gap)

        resizeStartRef.current = null
        setResizingEdge(null)
        setResizeShiftX(0)

        const isReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

        if (isReduced) {
          onWidgetsChange(widgets.map(w => {
            const col = adapted[w.id] !== undefined ? adapted[w.id] : w.colSpan
            const row = w.id === currentWidgetId ? finalRowSpan : w.rowSpan
            return { ...w, colSpan: col, rowSpan: row }
          }))
          setResizingId(null)
          setLivePixelSizes({})
          setGhostSpans({})
          setLiveSpans({})
        } else {
          // Smooth kinematic snap landing (card smoothly animates from current px to snapped px in 220ms)
          setIsSnappingId(currentWidgetId)
          setLivePixelSizes(prev => {
            const nextSizes: Record<string, LivePixelSize> = {
              ...prev,
              [currentWidgetId]: { width: snappedWidth, height: snappedHeight }
            }
            for (const [id, col] of Object.entries(adapted)) {
              if (id !== currentWidgetId) {
                const nw = Math.round(col * colWidth + (col - 1) * gap)
                const wObj = widgets.find(w => w.id === id)
                const nr = wObj ? widgetSpan(wObj).rowSpan : 4
                const nh = Math.round(nr * rowHeight + (nr - 1) * gap)
                nextSizes[id] = { width: nw, height: nh }
              }
            }
            return nextSizes
          })

          if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current)
          snapTimeoutRef.current = window.setTimeout(() => {
            onWidgetsChange(widgets.map(w => {
              const col = adapted[w.id] !== undefined ? adapted[w.id] : w.colSpan
              const row = w.id === currentWidgetId ? finalRowSpan : w.rowSpan
              return { ...w, colSpan: col, rowSpan: row }
            }))
            setIsSnappingId(null)
            setResizingId(null)
            setLivePixelSizes({})
            setGhostSpans({})
            setLiveSpans({})
            snapTimeoutRef.current = null
          }, 220)
        }
      }

      // Handle drag release & landing animation
      if (draggingId) {
        sound.playWoodSnap('land')
        const currentDragId = draggingId
        setIsLandingId(currentDragId)
        setDragOffset({ x: 0, y: 0 })

        if (landingTimeoutRef.current) window.clearTimeout(landingTimeoutRef.current)
        landingTimeoutRef.current = window.setTimeout(() => {
          setIsLandingId(null)
          setDraggingId(null)
          setDragOffset(null)
          landingTimeoutRef.current = null
        }, 220)
        dragStartRef.current = null
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [clearLongPress, draggingId, ghostSpans, isEditing, onWidgetsChange, resizingId, widgets])

  const removeWidget = useCallback((id: string) => {
    onWidgetsChange(widgets.filter(w => w.id !== id))
  }, [onWidgetsChange, widgets])

  const addWidget = useCallback((type: WidgetType) => {
    const defaultSpan = widgetDefaultSpan(type)
    const newWidget: WidgetConfig = {
      id: crypto.randomUUID ? crypto.randomUUID() : `widget-${Date.now()}`,
      type,
      size: 'M',
      colSpan: defaultSpan.colSpan,
      rowSpan: defaultSpan.rowSpan
    }
    onWidgetsChange([...widgets, newWidget])
  }, [onWidgetsChange, widgets])

  return {
    isEditing,
    setIsEditing,
    cancelEditing,
    saveEditing,
    draggingId,
    dragOffset,
    isLandingId,
    resizingId,
    resizingEdge,
    resizeShiftX,
    isSnappingId,
    livePixelSizes,
    ghostSpans,
    liveSpans,
    onCardPointerDown,
    onResizePointerDown,
    removeWidget,
    addWidget
  }
}
