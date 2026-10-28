import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Columns2, FolderInput, Globe2, LayoutGrid, Plus, X, Pin, Archive, BookmarkPlus, GitBranch, FileInput, Pencil, Shield } from 'lucide-react'
import type { BrowserTab, HistoryItem, ReaderArticle, ResearchSource, Resource, Space } from '../types'
import { NativePane } from './NativePane'
import { ReaderView } from './ReaderView'
import './browser.css'
import { ActionMenu } from '../ActionMenu'
import { contextTitle, currentContext } from '../workContexts'
import { normalizeSpace } from '../../shared/state'
import { orderedTabs, tabTitle } from './tabModel'
import { TabIcon } from './TabIcon'
import { isCabinetPreview } from '../cabinetMode'

export interface WorkstageProps {
  space: Space
  tabs: BrowserTab[]
  activeTabId: string
  splitTabId: string | null
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onAddTab: () => void
  onNavigate: (address: string, title?: string, tabId?: string) => void
  addressEditor?: ReactNode
  sidePanel?: ReactNode
  onFocusAddress?: () => void
  onOverview?: () => void
  onCloseSplit: () => void
  onOpenSourceInSplit: (source: ResearchSource) => void
  onGoHome: () => void
  onOpenTab: (tab: BrowserTab) => void
  onSaveTab: (tab: BrowserTab) => void
  onOpenResource: (resource: Resource) => void
  onAddLink: () => void
  onUpdateTab?: (tabId: string, updates: Partial<BrowserTab>) => void
  onPark: () => void
  onImport: () => void
  onBranch: () => void
  onSelectContext: (contextId: string) => void
  onNewContext: () => void
  onEditContext: () => void
  spaces: Space[]
  history?: HistoryItem[]
  onReorderTab: (tabId: string, targetId: string, after: boolean) => void
  onMoveTab: (tabId: string, spaceId: string) => void
  onSplitTab: (tabId: string) => void
  covers?: Record<string, string>
  readerArticle?: ReaderArticle | null
  onCloseReader?: () => void
}

export function Workstage({
  space,
  tabs,
  activeTabId,
  splitTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
  onNavigate,
  addressEditor,
  sidePanel,
  onFocusAddress,
  onOverview,
  onCloseSplit,
  onOpenSourceInSplit,
  onOpenTab,
  onSaveTab,
  onOpenResource,
  onAddLink,
  onUpdateTab,
  onPark,
  onImport,
  onBranch,
  onSelectContext,
  onNewContext,
  onEditContext,
  spaces,
  history,
  onReorderTab,
  onMoveTab,
  onSplitTab,
  covers,
  readerArticle,
  onCloseReader
}: WorkstageProps) {
  const strip = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [tabWidth, setTabWidth] = useState(210)
  const [previewIds, setPreviewIds] = useState<string[]>([])
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null)
  const pointerDrag = useRef<{ id: string; x: number; y: number; pointerId: number; element: HTMLElement; started: boolean } | null>(null)
  const suppressClick = useRef(false)
  const clickTimer = useRef<number | undefined>(undefined)
  const dragLayout = useRef<{
    id: string
    grabOffset: number
    width: number
    slots: { id: string; left: number; width: number; pinned: boolean }[]
    preview: string[]
  } | null>(null)
  const [dropAction, setDropAction] = useState('')
  const sortedTabs = orderedTabs(tabs)
  useLayoutEffect(() => {
    const element = strip.current!
    const resizeTabs = () => {
      if (dragLayout.current || element.clientWidth <= 0) return
      const list = element.querySelector<HTMLElement>('.horizontal-tabs')!
      const plus = element.querySelector<HTMLElement>('.strip-new-tab')!
      const tab = list.querySelector<HTMLElement>('.horizontal-tab')
      const listStyle = getComputedStyle(list), plusStyle = getComputedStyle(plus)
      const minimum = tab ? parseFloat(getComputedStyle(tab).minWidth) : 64
      // Pinned tabs are icon-only with a fixed width; only the others share the remaining room.
      const pinnedTabs = [...list.querySelectorAll<HTMLElement>('.horizontal-tab.is-pinned')]
      const pinnedWidth = pinnedTabs.reduce((sum, node) => sum + node.offsetWidth, 0)
      const available = element.clientWidth - plus.offsetWidth - parseFloat(plusStyle.marginLeft) - parseFloat(plusStyle.marginRight)
        - parseFloat(listStyle.paddingLeft) - parseFloat(listStyle.paddingRight) - parseFloat(listStyle.columnGap) * Math.max(0, tabs.length - 1) - pinnedWidth
      setTabWidth(Math.max(minimum, Math.min(210, available / Math.max(1, tabs.length - pinnedTabs.length))))
    }
    resizeTabs()
    const observer = new ResizeObserver(resizeTabs)
    observer.observe(element)
    return () => observer.disconnect()
  }, [tabs.length, tabs.filter(tab => tab.pinned).length, dragId])
  useEffect(() => {
    const element = strip.current!
    const revealActive = () => {
      if (dragLayout.current) return
      const active = element.querySelector('[aria-selected="true"]')?.closest<HTMLElement>('.horizontal-tab')
      const plus = element.querySelector<HTMLElement>('.strip-new-tab')
      if (!active || !plus) return
      const viewport = element.getBoundingClientRect(), bounds = active.getBoundingClientRect()
      const plusStyle = getComputedStyle(plus)
      const right = viewport.right - plus.offsetWidth - parseFloat(plusStyle.marginLeft) - parseFloat(plusStyle.marginRight) - 8
      if (bounds.right > right) element.scrollLeft += bounds.right - right
      else if (bounds.left < viewport.left + 8) element.scrollLeft += bounds.left - viewport.left - 8
    }
    revealActive()
    const observer = new ResizeObserver(revealActive)
    observer.observe(element)
    return () => observer.disconnect()
  }, [activeTabId, tabWidth])
  useEffect(() => {
    const element = strip.current!
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || element.scrollWidth <= element.clientWidth) return
      const previous = element.scrollLeft
      element.scrollLeft += event.deltaY
      if (element.scrollLeft !== previous) event.preventDefault()
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [])
  useEffect(() => { pointerDrag.current = null; dragLayout.current = null; setDragId(null); setPreviewIds([]); setDragPointer(null); setDropAction('') }, [space.id, space.activeContextId])
  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0]
  const draggedTab = tabs.find(tab => tab.id === dragId)
  const splitTab = tabs.find(tab => tab.id === splitTabId && tab.id !== activeTab?.id)
  const context = currentContext(space)
  const activeIndex = sortedTabs.findIndex(tab => tab.id === activeTab?.id)
  // «Избранное» lives outside spaces: the hidden bookmarks space, shown on every new tab.
  const favorites = isCabinetPreview ? spaces.find(item => item.kind === 'web' && !item.archivedAt) : undefined
  const destinations = spaces.filter(item => item.id !== space.id && !item.archivedAt && !(item.kind === 'day' && item.dayRetired))
  const canShowContext = !isCabinetPreview && space.kind !== 'web' && (Boolean(context.title) || normalizeSpace(space).workContexts!.length > 1)
  const finishDrag = () => { dragLayout.current = null; setDragId(null); setPreviewIds([]); setDragPointer(null); setDropAction('') }

  useEffect(() => {
    const targetAction = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-tab-drop-action]')?.dataset.tabDropAction
    const move = (event: PointerEvent) => {
      const pointer = pointerDrag.current
      if (!pointer || event.pointerId !== pointer.pointerId) return
      if (!pointer.started) {
        if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 4) return
        const tab = tabs.find(tab => tab.id === pointer.id)
        if (!tab) return
        captureDrag(tab, pointer.x, pointer.element)
        pointer.started = true
        pointer.element.setPointerCapture?.(pointer.pointerId)
        suppressClick.current = true
      }
      event.preventDefault()
      setDragPointer({ x: event.clientX, y: event.clientY })
      const action = targetAction(event.clientX, event.clientY)
      setDropAction(action === 'split' || action === 'save' ? action : action?.slice('space:'.length) || '')
      if (!action) updatePreview(event.clientX)
    }
    const finish = (event: PointerEvent) => {
      const pointer = pointerDrag.current
      if (!pointer || event.pointerId !== pointer.pointerId) return
      pointerDrag.current = null
      if (!pointer.started) return
      const action = event.type === 'pointercancel' ? undefined : targetAction(event.clientX, event.clientY)
      const bounds = strip.current!.getBoundingClientRect()
      if (action === 'split') onSplitTab(pointer.id)
      else if (action === 'save') { const tab = tabs.find(tab => tab.id === pointer.id); if (tab) onSaveTab(tab) }
      else if (action?.startsWith('space:')) onMoveTab(pointer.id, action.slice('space:'.length))
      else if (event.type !== 'pointercancel' && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
        updatePreview(event.clientX)
        commitDrag()
      }
      if (pointer.element.hasPointerCapture?.(pointer.pointerId)) pointer.element.releasePointerCapture(pointer.pointerId)
      finishDrag()
      window.clearTimeout(clickTimer.current)
      clickTimer.current = window.setTimeout(() => { suppressClick.current = false }, 0)
    }
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !pointerDrag.current) return
      const pointer = pointerDrag.current
      pointerDrag.current = null
      if (pointer.element.hasPointerCapture?.(pointer.pointerId)) pointer.element.releasePointerCapture(pointer.pointerId)
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
  }, [tabs, onReorderTab, onMoveTab, onSplitTab, onSaveTab])
  useEffect(() => () => window.clearTimeout(clickTimer.current), [])

  function captureDrag(tab: BrowserTab, clientX: number, source: HTMLElement) {
    const element = strip.current!, viewport = element.getBoundingClientRect()
    const bounds = source.getBoundingClientRect()
    const rectangles = new Map([...element.querySelectorAll<HTMLElement>('[data-tab-id]')].map(node => [node.dataset.tabId, node.getBoundingClientRect()]))
    const slots = sortedTabs.map(item => {
      const rect = rectangles.get(item.id)!
      return { id: item.id, left: rect.left - viewport.left + element.scrollLeft, width: rect.width, pinned: Boolean(item.pinned) }
    })
    dragLayout.current = { id: tab.id, grabOffset: clientX - bounds.left, width: bounds.width, slots, preview: slots.map(slot => slot.id) }
    setPreviewIds(dragLayout.current.preview)
    setDragId(tab.id)
  }

  function startDrag(event: DragEvent<HTMLDivElement>, tab: BrowserTab) {
    if (pointerDrag.current) { event.preventDefault(); return }
    captureDrag(tab, event.clientX, event.currentTarget)
    event.dataTransfer.setData('application/x-dom-tab', JSON.stringify({ spaceId: space.id, tabId: tab.id }))
    event.dataTransfer.effectAllowed = 'move'
  }

  function previewDrag(event: DragEvent<HTMLDivElement>) {
    if (!dragLayout.current) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropAction('')
    updatePreview(event.clientX)
  }

  function updatePreview(clientX: number) {
    const layout = dragLayout.current, element = strip.current!
    if (!layout) return
    const viewport = element.getBoundingClientRect()
    if (clientX < viewport.left + 24) element.scrollLeft -= 16
    else if (clientX > viewport.right - 64) element.scrollLeft += 16
    const center = clientX - viewport.left + element.scrollLeft - layout.grabOffset + layout.width / 2
    const sourceIndex = layout.slots.findIndex(slot => slot.id === layout.id), source = layout.slots[sourceIndex]
    const candidates = layout.slots.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.pinned === source.pinned)
    const nearest = candidates.reduce((best, candidate) => Math.abs(candidate.slot.left + candidate.slot.width / 2 - center) < Math.abs(best.slot.left + best.slot.width / 2 - center) ? candidate : best)
    const preview = layout.slots.map(slot => slot.id)
    preview.splice(sourceIndex, 1)
    preview.splice(nearest.index, 0, layout.id)
    if (preview.some((id, index) => id !== layout.preview[index])) {
      layout.preview = preview
      setPreviewIds(preview)
    }
  }

  function dropTab(event: DragEvent<HTMLDivElement>) {
    if (!dragLayout.current) return
    event.preventDefault()
    commitDrag()
    finishDrag()
  }

  function commitDrag() {
    const layout = dragLayout.current
    if (!layout) return
    const sourceIndex = layout.slots.findIndex(slot => slot.id === layout.id), targetIndex = layout.preview.indexOf(layout.id)
    if (sourceIndex !== targetIndex) onReorderTab(layout.id, layout.slots[targetIndex].id, targetIndex > sourceIndex)
  }

  function previewStyle(tabId: string): CSSProperties | undefined {
    const layout = dragLayout.current
    if (!layout || !previewIds.length) return undefined
    const original = layout.slots.find(slot => slot.id === tabId), target = layout.slots[previewIds.indexOf(tabId)]
    return original && target ? { transform: `translateX(${target.left - original.left}px)` } : undefined
  }

  function pane(tab?: BrowserTab, secondary = false) {
    if (!tab) return <NativePane space={space} spaces={spaces} history={history} favorites={favorites} isSplit={false} onCloseSplit={onCloseSplit} onSaveTab={onSaveTab} onOpenExternal={onOpenTab} onOpenResource={onOpenResource} onAddLink={onAddLink} onNavigate={onNavigate} onFocusAddress={onFocusAddress} />

    if (tab.url.startsWith('research://')) {
      const artifact = space.researchArtifacts?.find(item => item.id === tab.url.slice('research://'.length))
      return (
        <section className="canvas-pane" aria-label="Сохранённое исследование">
          <div className="canvas-link-content">
            <span className="canvas-kicker">{space.name} · исследование</span>
            <h1 className="canvas-page-title">{artifact?.query || 'Исследование'}</h1>
            {artifact ? (
              <>
                <p className="canvas-body-text">{artifact.summary}</p>
                <p className="canvas-body-text">{artifact.conclusion}</p>
                <div className="canvas-actions">
                  {artifact.sources.map(source => (
                    <button className="canvas-save-link" key={source.url} onClick={() => onOpenSourceInSplit(source)}>
                      {source.domain} <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="canvas-body-text">Нет сохранённых материалов</p>
            )}
          </div>
        </section>
      )
    }

    return (
      <NativePane
        spaces={spaces}
        history={history}
        favorites={favorites}
        key={tab.id}
        tab={tab}
        space={space}
        coverImage={covers?.[tab.id]}
        isSplit={secondary}
        isPaired={Boolean(splitTab)}
        onCloseSplit={onCloseSplit}
        onUpdateTab={onUpdateTab}
        onSaveTab={onSaveTab}
        onOpenExternal={onOpenTab}
        onOpenResource={onOpenResource}
        onAddLink={onAddLink}
        onAddTab={onAddTab}
        onFocusAddress={secondary ? undefined : onFocusAddress}
        onNavigate={(address, title) => onNavigate(address, title, tab.id)}
        onSelectQuickUrl={(url, title) => {
          onUpdateTab?.(tab.id, { url, title: title || new URL(url).hostname })
        }}
      />
    )
  }

  return (
    <main className="workstage-container compact-stage browser-workstage" aria-label={`Браузер · ${space.name}`}>
      <div className="browser-tab-strip">
        {canShowContext && <div className="context-picker"><ActionMenu className="browser-menu" label="Дела в пространстве" triggerContent={<><span>{contextTitle(space, context)}</span><ChevronDown size={18} /></>} actions={[
          ...normalizeSpace(space).workContexts!.map(item => ({ id: item.id, label: contextTitle(space, item), icon: item.id === context.id ? <Check size={20} /> : <Globe2 size={20} />, onSelect: () => onSelectContext(item.id) })),
          { label: 'Новое дело', icon: <Plus size={20} />, onSelect: onNewContext },
          { label: 'Продолжение', icon: <Pencil size={20} />, onSelect: onEditContext }
        ]} /></div>}
        <div className="tab-strip-scroll" ref={strip} onDragOver={previewDrag} onDrop={dropTab}><div className={`horizontal-tabs ${dragId ? 'is-reordering' : ''}`} style={{ '--browser-tab-width': `${tabWidth}px` } as CSSProperties} role="tablist" aria-label="Открытые вкладки" onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
            const item = (event.target as HTMLElement).closest<HTMLElement>('[data-tab-id]')
            const index = sortedTabs.findIndex(tab => tab.id === item?.dataset.tabId), target = sortedTabs[index + (event.key === 'ArrowRight' ? 1 : -1)]
            if (item && target) { event.preventDefault(); onReorderTab(item.dataset.tabId!, target.id, event.key === 'ArrowRight') }
            return
          }
          const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
          const index = items.indexOf(document.activeElement as HTMLButtonElement)
          if (index < 0) return
          event.preventDefault()
          const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
          items[nextIndex]?.focus(); items[nextIndex]?.click()
        }}>
          {sortedTabs.map(tab => <div key={tab.id} data-tab-id={tab.id} draggable style={previewStyle(tab.id)} className={`horizontal-tab ${tab.pinned ? 'is-pinned' : ''} ${tab.id === activeTab?.id ? 'active' : ''} ${tab.id === splitTab?.id ? 'split-active' : ''} ${dragId === tab.id ? 'is-dragging' : ''}`}
            onPointerDown={event => {
              if (event.button !== 0 || (event.target as HTMLElement).closest('.horizontal-tab-close')) return
              event.preventDefault()
              suppressClick.current = false
              pointerDrag.current = { id: tab.id, x: event.clientX, y: event.clientY, pointerId: event.pointerId, element: event.currentTarget, started: false }
            }}
            onDragStart={event => startDrag(event, tab)} onDragEnd={finishDrag}>
            <button role="tab" aria-selected={tab.id === activeTab?.id} tabIndex={tab.id === activeTab?.id ? 0 : -1} onClick={() => { if (!suppressClick.current) onSelectTab(tab.id) }} title={tabTitle(tab)}><TabIcon tab={tab} /><span>{tabTitle(tab)}</span>{tab.pinned && <Pin size={16} aria-label="Закреплено" />}{tab.protected && <Shield size={16} aria-label="Незавершённая работа" />}</button>
            <button className="horizontal-tab-close" onClick={() => onCloseTab(tab.id)} aria-label={`Закрыть ${tabTitle(tab)}`}><X size={18} /></button>
          </div>)}
        </div>
        <button className="strip-new-tab" onClick={onAddTab} title="Новая вкладка · Ctrl T" aria-label="Новая вкладка"><Plus size={22} /></button>
        </div>
        {onOverview && <button className="browser-tabs-overview" onClick={onOverview} title="Обзор и поиск вкладок · Ctrl Shift A" aria-label="Обзор и поиск вкладок"><LayoutGrid size={16} /><span>Вкладки</span><small>{tabs.length}</small></button>}
        <ActionMenu className="browser-menu" label="Действия с вкладками" actions={[
          ...(activeTab && tabs.length > 1 ? [{ label: 'Открыть рядом', icon: <Columns2 size={20} />, onSelect: () => onSplitTab(activeTab.id) }] : []),
          ...(activeTab?.parentTabId && tabs.some(tab => tab.id === activeTab.parentTabId) ? [{ label: 'К исходной вкладке', icon: <ArrowUpRight size={16} />, onSelect: () => onSelectTab(activeTab.parentTabId!) }] : []),
          ...(activeTab?.url ? [
            { label: 'Сохранить в материалы', icon: <BookmarkPlus size={16} />, onSelect: () => onSaveTab(activeTab) },
            { label: activeTab.pinned ? 'Открепить вкладку' : 'Закрепить вкладку', icon: <Pin size={16} />, onSelect: () => onUpdateTab?.(activeTab.id, { pinned: !activeTab.pinned }) },
            { label: 'Отдельная ветка', icon: <GitBranch size={16} />, onSelect: onBranch }
          ] : []),
          ...(activeTab && activeIndex > 0 && Boolean(sortedTabs[activeIndex - 1].pinned) === Boolean(activeTab.pinned) ? [{ label: 'Передвинуть раньше', icon: <ArrowLeft size={20} />, onSelect: () => onReorderTab(activeTab.id, sortedTabs[activeIndex - 1].id, false) }] : []),
          ...(activeTab && activeIndex < sortedTabs.length - 1 && Boolean(sortedTabs[activeIndex + 1].pinned) === Boolean(activeTab.pinned) ? [{ label: 'Передвинуть позже', icon: <ArrowRight size={20} />, onSelect: () => onReorderTab(activeTab.id, sortedTabs[activeIndex + 1].id, true) }] : []),
          ...(activeTab ? destinations.map(destination => ({ label: destination.kind === 'web' ? 'В браузер' : `В ${destination.name}`, icon: <FolderInput size={20} />, onSelect: () => onMoveTab(activeTab.id, destination.id) })) : []),
          ...(activeTab && !spaces.some(item => item.kind === 'web' && !item.archivedAt) ? [{ label: 'В браузер', icon: <FolderInput size={20} />, onSelect: () => onMoveTab(activeTab.id, '@web') }] : []),
          ...(!isCabinetPreview && space.kind !== 'web' ? [
            ...normalizeSpace(space).workContexts!.map(item => ({ id: item.id, label: contextTitle(space, item), icon: item.id === context.id ? <Check size={20} /> : <Globe2 size={20} />, onSelect: () => onSelectContext(item.id) })),
            { label: 'Новое дело', icon: <Plus size={20} />, onSelect: onNewContext }, { label: 'Продолжение', icon: <Pencil size={20} />, onSelect: onEditContext }
          ] : []),
          ...(isCabinetPreview && space.kind !== 'web' ? [
            { label: 'Настроить продолжение пространства', icon: <Pencil size={20} />, onSelect: onEditContext },
            { label: 'Выделить вкладки в новое пространство', icon: <FolderInput size={20} />, onSelect: onNewContext }
          ] : []),
          { label: 'Сохранить и вернуться', icon: <Archive size={16} />, onSelect: onPark },
          { label: 'Импорт вкладок', icon: <FileInput size={16} />, onSelect: onImport }
        ]} />
      </div>
      {addressEditor}
      <div className="browser-stage-body">
      <div className={`workstage-canvas ${splitTab ? 'split' : ''}`} style={{ position: 'relative' }}>
        {pane(activeTab)}
        {splitTab && pane(splitTab, true)}
        {readerArticle && onCloseReader && <ReaderView article={readerArticle} onClose={onCloseReader} />}
        {dragId && <div className="browser-drag-layer" data-browser-drag-layer>
          {tabs.length > 1 && <div data-tab-drop-action="split" className={`browser-drop-split ${dropAction === 'split' ? 'is-over' : ''}`} onDragOver={event => { event.preventDefault(); setDropAction('split') }} onDrop={event => { event.preventDefault(); onSplitTab(dragId); finishDrag() }}><Columns2 size={26} /><span>Рядом</span></div>}
          <div className="browser-drop-tray">{[...destinations.map(item => ({ id: item.id, name: item.kind === 'web' ? 'Браузер' : item.name })), ...(!spaces.some(item => item.kind === 'web' && !item.archivedAt) ? [{ id: '@web', name: 'Браузер' }] : [])].map(destination => <div key={destination.id} data-tab-drop-action={`space:${destination.id}`} className={`browser-drop-space ${dropAction === destination.id ? 'is-over' : ''}`} onDragOver={event => { event.preventDefault(); setDropAction(destination.id) }} onDrop={event => { event.preventDefault(); onMoveTab(dragId, destination.id); finishDrag() }}><FolderInput size={22} /><span>{destination.name}</span></div>)}<div data-tab-drop-action="save" className={`browser-drop-space ${dropAction === 'save' ? 'is-over' : ''}`} onDragOver={event => { event.preventDefault(); setDropAction('save') }} onDrop={event => { event.preventDefault(); const tab = tabs.find(item => item.id === dragId); if (tab) onSaveTab(tab); finishDrag() }}><BookmarkPlus size={22} /><span>Сохранить</span></div></div>
        </div>}
      </div>
      {sidePanel}
      </div>
      {dragPointer && dragLayout.current && draggedTab && createPortal(<div className={`tab-drag-preview ${dragLayout.current.width <= 86 ? 'compact' : ''}`} aria-hidden="true" style={{ left: dragPointer.x - dragLayout.current.grabOffset, top: dragPointer.y - 19, width: dragLayout.current.width }}><TabIcon tab={draggedTab} /><span>{tabTitle(draggedTab)}</span><X size={18} /></div>, document.body)}
    </main>
  )
}
