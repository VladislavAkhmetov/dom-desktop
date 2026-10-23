import { useRef, useState, type DragEvent, type RefObject } from 'react'
import { writeCabinetDrag, type CabinetDrag } from './cabinetInteractions'
import { useCabinetPointerDrag } from './useCabinetPointerDrag'
import type { Resource, Space } from './types'
import { currentContext } from './workContexts'

export type CabinetDragActions = {
  spaces: () => Space[] | undefined
  reorderTab: (spaceId: string, contextId: string, tabId: string, targetId: string, after: boolean) => void
  reorderSpace: (id: string, targetId: string, after?: boolean, pin?: boolean) => void
  moveTab: (fromSpaceId: string, tabId: string, requestedSpaceId: string) => void | Promise<unknown>
  copyToCabinet: (resource: Resource, destinationId: string) => void | Promise<unknown>
}

export function useCabinetDrag(actions: RefObject<CabinetDragActions | null>) {
  const [cabinetDrag, setCabinetDrag] = useState<CabinetDrag | null>(null)
  const cabinetDragRef = useRef<CabinetDrag | null>(null)
  const [cabinetDrop, setCabinetDrop] = useState<{ id: string; after: boolean; pin: boolean } | null>(null)
  const [cabinetTabDrop, setCabinetTabDrop] = useState('')

  function finishCabinetDrag() {
    cabinetDragRef.current = null
    setCabinetDrag(null)
    setCabinetDrop(null)
    setCabinetTabDrop('')
  }

  const pointerCabinet = useCabinetPointerDrag({
    onStart: value => { cabinetDragRef.current = value; setCabinetDrag(value) },
    onOver: (value, x, y) => {
      const target = document.elementFromPoint(x, y)
      const tab = target?.closest<HTMLElement>('.cabinet-tab-card')
      setCabinetTabDrop(value.kind === 'tab' && tab?.dataset.cabinetOwner === value.spaceId && tab.dataset.tabId !== value.id ? tab.dataset.tabId || '' : '')
      const item = target?.closest<HTMLElement>('[data-cabinet-space-target]'), id = item?.dataset.spaceId
      if (!item || !id || id === value.spaceId) { setCabinetDrop(null); return }
      const bounds = item.getBoundingClientRect(), after = x > bounds.left + bounds.width / 2, pin = item.classList.contains('chrome-space')
      setCabinetDrop(previous => previous?.id === id && previous.after === after && previous.pin === pin ? previous : { id, after, pin })
    },
    onDrop: (value, x, y) => {
      const current = actions.current
      if (!current) return
      const spaces = current.spaces()
      const target = document.elementFromPoint(x, y), tab = target?.closest<HTMLElement>('.cabinet-tab-card')
      if (value.kind === 'tab' && tab?.dataset.cabinetOwner === value.spaceId && tab.dataset.tabId && tab.dataset.tabId !== value.id) {
        const source = spaces?.find(space => space.id === value.spaceId), bounds = tab.getBoundingClientRect()
        if (source) current.reorderTab(source.id, currentContext(source).id, value.id, tab.dataset.tabId, x > bounds.left + bounds.width / 2)
        return
      }
      const item = target?.closest<HTMLElement>('[data-cabinet-space-target]'), destination = item?.dataset.spaceId
      const source = spaces?.find(space => space.id === value.spaceId && !space.archivedAt)
      if (!source || !item || !destination || source.id === destination) return
      if (value.kind === 'space') { const bounds = item.getBoundingClientRect(); current.reorderSpace(source.id, destination, x > bounds.left + bounds.width / 2, item.classList.contains('chrome-space')) }
      else if (value.kind === 'tab') void current.moveTab(source.id, value.id, destination)
      else { const resource = source.resources.find(resource => resource.id === value.id); if (resource) void current.copyToCabinet(resource, destination) }
    },
    onFinish: finishCabinetDrag
  })

  function startCabinetDrag(event: DragEvent<HTMLElement>, value: CabinetDrag) {
    if (pointerCabinet.isPending()) { event.preventDefault(); return }
    event.stopPropagation(); writeCabinetDrag(event, value); cabinetDragRef.current = value; setCabinetDrag(value)
  }

  return { cabinetDrag, cabinetDragRef, cabinetDrop, setCabinetDrop, cabinetTabDrop, pointerCabinet, startCabinetDrag, finishCabinetDrag }
}
