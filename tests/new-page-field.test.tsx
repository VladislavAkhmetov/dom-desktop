// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { HistoryItem, Space } from '../src/types'

vi.mock('../src/bridge', () => ({ isDesktop: false, bridge: { platform: 'browser' } }))
vi.mock('../src/cabinetMode', () => ({ isCabinetPreview: true }))
const { NewPage } = await import('../src/browser/NewPage')
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('Поле новой вкладки', () => {
  it('печатаем там, где нажали: подсказки под полем, выбор открывает адрес', async () => {
    const space = { id: 'day', name: 'Сегодня', kind: 'day', day: '2026-10-27', tone: 'sage', resources: [], activeSession: { tabs: [], activeTabId: '' } } as unknown as Space
    const history = [{ id: 'h1', url: 'https://www.figma.com/files/recent', title: 'Figma — все файлы', visitedAt: '2026-10-27T09:00:00Z' }] as unknown as HistoryItem[]
    const onOpen = vi.fn()
    const container = document.body.appendChild(document.createElement('div'))
    const root = createRoot(container)
    await act(async () => root.render(<NewPage space={space} spaces={[space]} history={history} onOpen={onOpen} onOpenResource={() => {}} onAddLink={() => {}} />))
    const input = container.querySelector<HTMLInputElement>('.new-page-form input')!
    expect(document.activeElement).toBe(input)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'figma')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const list = container.querySelector('.new-page-form .new-page-suggestions')
    expect(list).not.toBeNull()
    const option = [...list!.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(item => item.textContent?.includes('Figma'))!
    await act(async () => option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(onOpen).toHaveBeenCalledWith(expect.stringContaining('figma.com'), expect.anything())
    await act(async () => root.unmount())
  })
})
