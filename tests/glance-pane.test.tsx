// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Workstage, type WorkstageProps } from '../src/browser/Workstage'
import type { BrowserTab } from '../src/types'

// The page itself is native; the stand-in shows the pane label bar the way NativePane draws it.
vi.mock('../src/browser/NativePane', () => ({
  NativePane: (props: { tab?: BrowserTab; isSplit?: boolean; labelActions?: unknown; onCloseSplit?: () => void }) =>
    <section data-pane={props.tab?.id || 'new'}>{props.isSplit && <div className="split-label"><span>{props.tab?.title}</span>{props.labelActions as never}<button aria-label="Закрыть просмотр рядом" onClick={props.onCloseSplit}>x</button></div>}</section>
}))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
const tabs: BrowserTab[] = [{ id: 'a', title: 'Первая', url: 'https://first.test/' }, { id: 'b', title: 'Вторая', url: 'https://second.test/' }]
const space = { id: 'work', name: 'Работа', tone: 'sage' as const, resources: [] }
const glance = { id: 'g1', spaceId: 'work', parentTabId: 'a', url: 'https://example.com/read', title: 'Статья' }
const fns = { keep: vi.fn(), later: vi.fn(), close: vi.fn(), closeSplit: vi.fn() }
const props: WorkstageProps = {
  space, tabs, activeTabId: 'a', splitTabId: 'b', spaces: [space],
  onSelectTab: vi.fn(), onCloseTab: vi.fn(), onAddTab: vi.fn(), onNavigate: vi.fn(), onCloseSplit: fns.closeSplit,
  onOpenSourceInSplit: vi.fn(), onGoHome: vi.fn(), onOpenTab: vi.fn(), onSaveTab: vi.fn(), onOpenResource: vi.fn(),
  onAddLink: vi.fn(), onPark: vi.fn(), onImport: vi.fn(), onBranch: vi.fn(), onSelectContext: vi.fn(),
  onNewContext: vi.fn(), onEditContext: vi.fn(), onReorderTab: vi.fn(), onMoveTab: vi.fn(), onSplitTab: vi.fn()
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
const panes = () => [...document.querySelectorAll<HTMLElement>('[data-pane]')].map(node => node.dataset.pane)

describe('Заглянуть: панель рядом', () => {
  it('занимает место парной страницы и даёт три действия: оставить, отложить, закрыть', async () => {
    await act(async () => root.render(<Workstage {...props} glance={glance} onKeepGlance={fns.keep} onLaterGlance={fns.later} onCloseGlance={fns.close} />))
    expect(panes()).toEqual(['a', 'g1'])
    expect(document.querySelector('.workstage-canvas')!.classList.contains('split')).toBe(true)
    expect(document.querySelector('.split-label span')!.textContent).toBe('Статья')
    await act(async () => document.querySelector<HTMLElement>('[aria-label="Оставить вкладкой"]')!.click())
    await act(async () => document.querySelector<HTMLElement>('[aria-label="Отложить на потом"]')!.click())
    await act(async () => document.querySelector<HTMLElement>('[aria-label="Закрыть просмотр рядом"]')!.click())
    expect(fns.keep).toHaveBeenCalledTimes(1)
    expect(fns.later).toHaveBeenCalledTimes(1)
    expect(fns.close).toHaveBeenCalledTimes(1)
    expect(fns.closeSplit).not.toHaveBeenCalled()
  })

  it('без неё возвращается обычная пара страниц', async () => {
    await act(async () => root.render(<Workstage {...props} glance={null} />))
    expect(panes()).toEqual(['a', 'b'])
  })

  it('не попадает в полосу вкладок', async () => {
    await act(async () => root.render(<Workstage {...props} glance={glance} />))
    expect([...document.querySelectorAll('.horizontal-tab')].map(node => (node as HTMLElement).dataset.tabId)).toEqual(['a', 'b'])
  })
})
