// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { CabinetContents } from '../src/CabinetContents'
import { normalizeSpace } from '../shared/state'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

it('показывает верхний фрагмент только по запросу из готового снимка, не открывая страницу и не меняя материалы', async () => {
  const space = normalizeSpace({ id: 'logo', name: 'Логотип', tone: 'sage', resources: [], activeSession: { tabs: [{ id: 'ref', title: 'Референс', url: 'https://ref.test/' }], activeTabId: 'ref' } })
  const before = structuredClone(space)
  const open = vi.fn(), close = vi.fn(), save = vi.fn(), move = vi.fn(), reorder = vi.fn(), remove = vi.fn(), copy = vi.fn(), add = vi.fn(), drag = vi.fn(), finish = vi.fn()
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1sAAAAASUVORK5CYII='
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<CabinetContents space={space} destinations={[]} covers={{ ref: image }} drag={null} onSelectTab={open} onCloseTab={close} onSaveTab={save} onMoveTab={move} onReorderTab={reorder} onOpen={open} onRemove={remove} onCopy={copy} onAddDocument={add} onAddLink={add} onStartDrag={drag} onFinishDrag={finish} />))
    expect(container.querySelector('.cabinet-page-fragment')).toBeNull()
    const toggle = container.querySelector<HTMLButtonElement>('.cabinet-preview-toggle')!
    await act(async () => toggle.click())
    expect(container.querySelector('.cabinet-page-fragment img')?.getAttribute('src')).toBe(image)
    await act(async () => toggle.click())
    expect(container.querySelector('.cabinet-page-fragment')).toBeNull()
    for (const callback of [open, close, save, move, reorder, remove, copy, add, drag, finish]) expect(callback).not.toHaveBeenCalled()
    expect(space).toEqual(before)
  } finally { await act(async () => root.unmount()); container.remove() }
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

