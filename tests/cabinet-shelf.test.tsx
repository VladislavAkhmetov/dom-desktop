// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CabinetContents } from '../src/CabinetContents'
import { normalizeSpace } from '../shared/state'
import type { Space } from '../src/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
const common = { destinations: [], covers: {}, drag: null, onSelectTab: vi.fn(), onCloseTab: vi.fn(), onSaveTab: vi.fn(), onMoveTab: vi.fn(), onReorderTab: vi.fn(), onOpen: vi.fn(), onRemove: vi.fn(), onCopy: vi.fn(), onAddDocument: vi.fn(), onAddLink: vi.fn(), onStartDrag: vi.fn(), onFinishDrag: vi.fn() }
const shelfSpace = (extra: Partial<Space> = {}) => normalizeSpace({ id: 'logo', name: 'Логотип', tone: 'sage', resources: [], activeSession: { tabs: [{ id: 'live', title: 'Живая', url: 'https://live.test/' }], activeTabId: 'live' },
  shelf: [{ id: 'old1', title: 'Старый референс', url: 'https://old.test/one', shelvedAt: '2026-10-01T10:00:00Z' }, { id: 'old2', title: 'Другая статья', url: 'https://old.test/two', shelvedAt: '2026-10-01T10:00:00Z' }], ...extra })
beforeEach(() => { vi.clearAllMocks(); document.body.innerHTML = '<div id="test-root"></div>'; root = createRoot(document.getElementById('test-root')!) })
afterEach(async () => { await act(async () => root.unmount()) })

it('«Отложено» показывает убранные вкладки отдельной секцией и возвращает или убирает выбранную', async () => {
  const restore = vi.fn(), forget = vi.fn()
  await act(async () => root.render(<CabinetContents space={shelfSpace()} {...common} onRestoreShelved={restore} onForgetShelved={forget} />))
  const section = document.querySelector<HTMLElement>('.cabinet-shelf')!
  expect(section.querySelector('h2')!.textContent).toContain('Отложено')
  expect([...section.querySelectorAll('.cabinet-tab-card strong')].map(node => node.textContent)).toEqual(['Старый референс', 'Другая статья'])
  expect(document.querySelectorAll('.cabinet-content-section[aria-label="Вкладки пространства"] .cabinet-tab-card')).toHaveLength(1)
  await act(async () => section.querySelector<HTMLElement>('[data-tab-id="old2"] .cabinet-tab-open')!.click())
  expect(restore).toHaveBeenCalledWith('old2')
  expect(forget).not.toHaveBeenCalled()
})

it('не показывает секцию без полки, без обработчиков и в «Сегодня»', async () => {
  await act(async () => root.render(<CabinetContents space={shelfSpace({ shelf: [] })} {...common} onRestoreShelved={vi.fn()} onForgetShelved={vi.fn()} />))
  expect(document.querySelector('.cabinet-shelf')).toBeNull()
  await act(async () => root.render(<CabinetContents space={shelfSpace()} {...common} />))
  expect(document.querySelector('.cabinet-shelf')).toBeNull()
  await act(async () => root.render(<CabinetContents space={shelfSpace({ kind: 'day', day: '2026-10-30' })} {...common} onRestoreShelved={vi.fn()} onForgetShelved={vi.fn()} />))
  expect(document.querySelector('.cabinet-shelf')).toBeNull()
})
