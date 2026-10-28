// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { CabinetContents } from '../src/CabinetContents'
import { normalizeSpace } from '../shared/state'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

it('при наведении показывает готовый снимок вкладки, не открывая страницу и не меняя материалы', async () => {
  const space = normalizeSpace({ id: 'logo', name: 'Логотип', tone: 'sage', resources: [], activeSession: { tabs: [{ id: 'ref', title: 'Референс', url: 'https://ref.test/' }, { id: 'fresh', title: 'Без снимка', url: 'https://fresh.test/' }], activeTabId: 'ref' } })
  const before = structuredClone(space)
  const open = vi.fn(), close = vi.fn(), save = vi.fn(), move = vi.fn(), reorder = vi.fn(), remove = vi.fn(), copy = vi.fn(), add = vi.fn(), drag = vi.fn(), finish = vi.fn()
  const image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const row = (id: string) => container.querySelector<HTMLElement>(`[data-tab-id="${id}"] .cabinet-tab-open`)!
  const hover = (element: HTMLElement) => element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }))
  const leave = (element: HTMLElement) => element.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
  vi.useFakeTimers()
  try {
    await act(async () => root.render(<CabinetContents space={space} destinations={[]} covers={{ ref: image }} drag={null} onSelectTab={open} onCloseTab={close} onSaveTab={save} onMoveTab={move} onReorderTab={reorder} onOpen={open} onRemove={remove} onCopy={copy} onAddDocument={add} onAddLink={add} onStartDrag={drag} onFinishDrag={finish} />))
    expect(container.querySelector('.cabinet-preview-toggle')).toBeNull()
    expect(row('ref').hasAttribute('data-tooltip-off')).toBe(true)

    await act(async () => { hover(row('ref')); vi.advanceTimersByTime(200) })
    expect(document.querySelector('.tab-peek')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(document.querySelector('.tab-peek img')?.getAttribute('src')).toBe(image)
    expect(document.querySelector('.tab-peek-caption')?.textContent).toBe('ref.test')

    await act(async () => { leave(row('ref')) })
    expect(document.querySelector('.tab-peek')).toBeNull()

    await act(async () => { hover(row('fresh')); vi.advanceTimersByTime(1000) })
    expect(document.querySelector('.tab-peek')).toBeNull()

    await act(async () => { hover(row('ref')); vi.advanceTimersByTime(600) })
    expect(document.querySelector('.tab-peek')).not.toBeNull()
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(document.querySelector('.tab-peek')).toBeNull()

    for (const callback of [open, close, save, move, reorder, remove, copy, add, drag, finish]) expect(callback).not.toHaveBeenCalled()
    expect(space).toEqual(before)
  } finally { vi.useRealTimers(); await act(async () => root.unmount()); container.remove() }
})

it('отображает чип недавнего файла и позволяет добавить его в материалы в 1 клик', async () => {
  const space = normalizeSpace({ id: 'brand', name: 'Бренд', tone: 'sage', resources: [], activeSession: { tabs: [], activeTabId: '' } })
  const addRecent = vi.fn(), dismissRecent = vi.fn()
  const recent = { name: 'макет.psd', target: 'D:\\designs\\макет.psd', modifiedAt: new Date().toISOString() }
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<CabinetContents space={space} destinations={[]} covers={{}} drag={null}
      onSelectTab={vi.fn()} onCloseTab={vi.fn()} onSaveTab={vi.fn()} onMoveTab={vi.fn()} onReorderTab={vi.fn()}
      onOpen={vi.fn()} onRemove={vi.fn()} onCopy={vi.fn()} onAddDocument={vi.fn()} onAddLink={vi.fn()}
      onStartDrag={vi.fn()} onFinishDrag={vi.fn()}
      suggestedRecentFile={recent} onAddRecentFile={addRecent} onDismissRecentFile={dismissRecent} />))

    const chip = container.querySelector('.cabinet-recent-chip')
    expect(chip).not.toBeNull()
    expect(chip?.textContent).toContain('макет.psd')

    const addBtn = chip?.querySelector<HTMLButtonElement>('.cabinet-recent-chip-btn')
    await act(async () => addBtn?.click())
    expect(addRecent).toHaveBeenCalledWith(recent)

    const dismissBtn = chip?.querySelector<HTMLButtonElement>('.cabinet-recent-chip-dismiss')
    await act(async () => dismissBtn?.click())
    expect(dismissRecent).toHaveBeenCalledWith(recent.target)
  } finally { await act(async () => root.unmount()); container.remove() }
})

