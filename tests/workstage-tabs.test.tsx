// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Workstage, type WorkstageProps } from '../src/browser/Workstage'
import { reorderBrowserTabs } from '../src/browser/tabModel'
import type { BrowserTab } from '../src/types'

vi.mock('../src/browser/NativePane', () => ({ NativePane: () => <div>Страница</div> }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
const tabs: BrowserTab[] = [
  { id: 'pin', title: 'Закреплённая', url: 'https://pinned.test/', pinned: true },
  { id: 'a', title: 'Первая', url: 'https://first.test/' },
  { id: 'b', title: 'Вторая', url: 'https://second.test/' },
  { id: 'c', title: 'Третья', url: 'https://third.test/' }
]
const reorder = vi.fn(), move = vi.fn(), split = vi.fn()
const props: WorkstageProps = {
  space: { id: 'web', kind: 'web', name: 'Веб', tone: 'sage', resources: [] },
  tabs, activeTabId: 'a', splitTabId: null,
  spaces: [{ id: 'web', kind: 'web', name: 'Веб', tone: 'sage', resources: [] }, { id: 'work', name: 'Работа', tone: 'sage', resources: [] }],
  onSelectTab: vi.fn(), onCloseTab: vi.fn(), onAddTab: vi.fn(), onNavigate: vi.fn(), onCloseSplit: vi.fn(),
  onOpenSourceInSplit: vi.fn(), onGoHome: vi.fn(), onOpenTab: vi.fn(), onSaveTab: vi.fn(), onOpenResource: vi.fn(),
  onAddLink: vi.fn(), onPark: vi.fn(), onImport: vi.fn(), onBranch: vi.fn(), onSelectContext: vi.fn(),
  onNewContext: vi.fn(), onEditContext: vi.fn(), onReorderTab: reorder, onMoveTab: move, onSplitTab: split
}
function Scene() {
  const [current, setCurrent] = useState(tabs)
  return <Workstage {...props} tabs={current} onReorderTab={(id, target, after) => {
    reorder(id, target, after)
    setCurrent(previous => reorderBrowserTabs(previous, id, target, after))
  }} />
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  document.elementFromPoint = vi.fn(() => document.querySelector('.tab-strip-scroll'))
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const index = tabs.findIndex(tab => tab.id === this.dataset.tabId)
    const x = index < 0 ? 0 : 16 + index * 108
    const width = index < 0 ? 1000 : 100
    return { x, y: 0, left: x, right: x + width, top: 0, bottom: 38, width, height: 38, toJSON: () => ({}) }
  })
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const tabNode = (id: string) => document.querySelector<HTMLElement>(`[data-tab-id="${id}"]`)!
const order = () => [...document.querySelectorAll<HTMLElement>('[data-tab-id]')].map(node => node.dataset.tabId)
async function drag(type: string, target: HTMLElement, clientX: number) {
  await act(async () => {
    const event = new MouseEvent(type, { clientX, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: { setData: vi.fn(), effectAllowed: 'move', dropEffect: 'move' } })
    target.dispatchEvent(event)
  })
}
async function mount() { await act(async () => root.render(<Scene />)) }
async function pointer(type: string, target: HTMLElement | Window, clientX: number) {
  await act(async () => {
    const event = new MouseEvent(type, { clientX, clientY: 10, button: 0, bubbles: true, cancelable: true })
    Object.defineProperty(event, 'pointerId', { value: 1 })
    target.dispatchEvent(event)
  })
}

describe('перестановка вкладок в Ленте', () => {
  it('ведёт вкладку за указателем и фиксирует порядок при отпускании мыши', async () => {
    await mount()
    await pointer('pointerdown', tabNode('a'), 144)
    await pointer('pointermove', window, 360)
    expect(document.querySelector('.tab-drag-preview')?.textContent).toContain('Первая')
    expect(tabNode('b').style.transform).toBe('translateX(-108px)')
    expect(reorder).not.toHaveBeenCalled()
    await pointer('pointerup', window, 360)
    expect(reorder).toHaveBeenCalledExactlyOnceWith('a', 'c', true)
    expect(order()).toEqual(['pin', 'b', 'c', 'a'])
    expect(document.querySelector('.tab-drag-preview')).toBeNull()
  })

  it('Escape отменяет перетаскивание указателем и возвращает исходные позиции', async () => {
    await mount()
    await pointer('pointerdown', tabNode('a'), 144)
    await pointer('pointermove', window, 360)
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    await pointer('pointerup', window, 360)
    expect(reorder).not.toHaveBeenCalled()
    expect(order()).toEqual(['pin', 'a', 'b', 'c'])
    expect(document.querySelector('.tab-drag-preview')).toBeNull()
    expect(tabNode('b').style.transform).toBe('')
  })

  it('смещает соседей во время перетаскивания и сохраняет порядок только при отпускании', async () => {
    await mount()
    await drag('dragstart', tabNode('b'), 252)
    await drag('dragover', tabNode('c'), 360)
    expect(tabNode('b').style.transform).toBe('translateX(108px)')
    expect(tabNode('c').style.transform).toBe('translateX(-108px)')
    expect(order()).toEqual(['pin', 'a', 'b', 'c'])
    expect(reorder).not.toHaveBeenCalled()
    await drag('drop', tabNode('c'), 360)
    expect(reorder).toHaveBeenCalledExactlyOnceWith('b', 'c', true)
    expect(order()).toEqual(['pin', 'a', 'c', 'b'])
    expect(tabNode('b').style.transform).toBe('')
    expect(document.querySelector('[data-browser-drag-layer]')).toBeNull()
  })

  it('показывает перескок через несколько вкладок в обе стороны и отменяет предпросмотр без записи', async () => {
    await mount()
    await drag('dragstart', tabNode('c'), 360)
    await drag('dragover', tabNode('a'), 144)
    expect(tabNode('c').style.transform).toBe('translateX(-216px)')
    expect(tabNode('a').style.transform).toBe('translateX(108px)')
    expect(tabNode('b').style.transform).toBe('translateX(108px)')
    await drag('dragover', tabNode('b'), 252)
    expect(tabNode('c').style.transform).toBe('translateX(-108px)')
    expect(tabNode('a').style.transform).toBe('translateX(0px)')
    await drag('dragend', tabNode('c'), 252)
    expect(order()).toEqual(['pin', 'a', 'b', 'c'])
    expect(reorder).not.toHaveBeenCalled()
    expect(tabNode('c').style.transform).toBe('')
  })

  it('сохраняет границу закреплённых вкладок при переносе влево', async () => {
    await mount()
    await drag('dragstart', tabNode('c'), 360)
    await drag('dragover', tabNode('pin'), 36)
    await drag('drop', tabNode('pin'), 36)
    expect(reorder).toHaveBeenCalledExactlyOnceWith('c', 'a', false)
    expect(order()).toEqual(['pin', 'c', 'a', 'b'])
  })

  it('перенос в пространство после предпросмотра не записывает промежуточный порядок', async () => {
    await mount()
    await drag('dragstart', tabNode('b'), 252)
    await drag('dragover', tabNode('c'), 360)
    const destination = [...document.querySelectorAll<HTMLElement>('.browser-drop-space')].find(node => node.textContent === 'Работа')!
    await drag('dragover', destination, 360)
    await drag('drop', destination, 360)
    expect(move).toHaveBeenCalledExactlyOnceWith('b', 'work')
    expect(reorder).not.toHaveBeenCalled()
    expect(tabNode('c').style.transform).toBe('')
  })
})
