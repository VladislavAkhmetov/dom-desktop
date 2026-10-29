// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateNoticeButton } from '../src/UpdateNoticeButton'
import { bridge } from '../src/bridge'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('UpdateNoticeButton', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
    document.querySelectorAll('.update-popover').forEach(el => el.remove())
    vi.restoreAllMocks()
  })

  it('не отображается, если обновление отсутствует', async () => {
    await act(async () => {
      root.render(<UpdateNoticeButton update={null} />)
    })
    expect(container.querySelector('.chrome-update-notice')).toBeNull()
  })

  it('отображает кнопку с номером версии при наличии обновления', async () => {
    await act(async () => {
      root.render(<UpdateNoticeButton update={{ version: '0.0.2', manual: false }} />)
    })
    const btn = container.querySelector('.chrome-update-notice')
    expect(btn).not.toBeNull()
    expect(btn?.textContent).toContain('v0.0.2')
  })

  it('раскрывает поповер для NSIS-установщика и вызывает installUpdate', async () => {
    const installSpy = vi.spyOn(bridge, 'installUpdate').mockResolvedValue(true)

    await act(async () => {
      root.render(<UpdateNoticeButton update={{ version: '0.0.2', manual: false }} />)
    })

    const btn = container.querySelector('.chrome-update-notice') as HTMLButtonElement
    await act(async () => {
      btn.click()
    })

    const popover = document.querySelector('.update-popover')
    expect(popover).not.toBeNull()
    expect(popover?.textContent).toContain('загружена в фоне')

    const restartBtn = Array.from(popover?.querySelectorAll('button') || []).find(b => b.textContent?.includes('Перезапустить'))
    expect(restartBtn).toBeDefined()

    await act(async () => {
      restartBtn?.click()
    })

    expect(installSpy).toHaveBeenCalled()
    expect(document.querySelector('.update-popover')).toBeNull()
  })

  it('раскрывает поповер для Portable-сборки и вызывает openReleasePage', async () => {
    const openReleaseSpy = vi.spyOn(bridge, 'openReleasePage').mockResolvedValue(true)

    await act(async () => {
      root.render(<UpdateNoticeButton update={{ version: '0.0.3', manual: true }} />)
    })

    const btn = container.querySelector('.chrome-update-notice') as HTMLButtonElement
    await act(async () => {
      btn.click()
    })

    const popover = document.querySelector('.update-popover')
    expect(popover).not.toBeNull()
    expect(popover?.textContent).toContain('Портативную сборку можно скачать')

    const downloadBtn = Array.from(popover?.querySelectorAll('button') || []).find(b => b.textContent?.includes('Скачать выпуск'))
    expect(downloadBtn).toBeDefined()

    await act(async () => {
      downloadBtn?.click()
    })

    expect(openReleaseSpy).toHaveBeenCalled()
    expect(document.querySelector('.update-popover')).toBeNull()
  })

  it('закрывает поповер по клику на крестик или нажатию Escape', async () => {
    await act(async () => {
      root.render(<UpdateNoticeButton update={{ version: '0.0.2', manual: false }} />)
    })

    const btn = container.querySelector('.chrome-update-notice') as HTMLButtonElement
    await act(async () => {
      btn.click()
    })
    expect(document.querySelector('.update-popover')).not.toBeNull()

    // Нажатие Escape
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(document.querySelector('.update-popover')).toBeNull()
  })
})
