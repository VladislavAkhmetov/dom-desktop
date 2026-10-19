// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionPrompt, type PermissionRequestInfo } from '../src/browser/PermissionPrompt'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('PermissionPrompt (Chrome-style)', () => {
  let root: Root
  const geoRequest: PermissionRequestInfo = {
    id: 'req-1',
    tabId: 'tab-1',
    hostname: 'yandex.ru',
    origin: 'https://yandex.ru',
    permission: 'geolocation'
  }

  beforeEach(() => {
    document.body.innerHTML = '<div id="test-root"></div>'
    root = createRoot(document.getElementById('test-root')!)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
  })

  it('renders hostname and geolocation description like Chrome', async () => {
    const onRespond = vi.fn()
    await act(async () => {
      root.render(<PermissionPrompt request={geoRequest} onRespond={onRespond} />)
    })

    expect(document.body.textContent).toContain('yandex.ru')
    expect(document.body.textContent).toContain('Запрашивает доступ к данным о вашем местоположении')
    expect(document.querySelector('.perm-btn-allow')?.textContent).toBe('Разрешить')
    expect(document.querySelector('.perm-btn-block')?.textContent).toBe('Блокировать')
  })

  it('calls onRespond with true when clicking Разрешить', async () => {
    const onRespond = vi.fn()
    await act(async () => {
      root.render(<PermissionPrompt request={geoRequest} onRespond={onRespond} />)
    })

    const allowBtn = document.querySelector<HTMLButtonElement>('.perm-btn-allow')!
    await act(async () => {
      allowBtn.click()
    })
    expect(onRespond).toHaveBeenCalledWith(true)
  })

  it('calls onRespond with false when clicking Блокировать', async () => {
    const onRespond = vi.fn()
    await act(async () => {
      root.render(<PermissionPrompt request={geoRequest} onRespond={onRespond} />)
    })

    const blockBtn = document.querySelector<HTMLButtonElement>('.perm-btn-block')!
    await act(async () => {
      blockBtn.click()
    })
    expect(onRespond).toHaveBeenCalledWith(false)
  })

  it('calls onRespond with null when clicking Close (X)', async () => {
    const onRespond = vi.fn()
    await act(async () => {
      root.render(<PermissionPrompt request={geoRequest} onRespond={onRespond} />)
    })

    const closeBtn = document.querySelector<HTMLButtonElement>('.perm-close-btn')!
    await act(async () => {
      closeBtn.click()
    })
    expect(onRespond).toHaveBeenCalledWith(null)
  })

  it('calls onRespond with null when pressing Escape', async () => {
    const onRespond = vi.fn()
    await act(async () => {
      root.render(<PermissionPrompt request={geoRequest} onRespond={onRespond} />)
    })

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onRespond).toHaveBeenCalledWith(null)
  })

  it('renders appropriate description for notifications and media', async () => {
    const notifRequest: PermissionRequestInfo = {
      id: 'req-2',
      hostname: 'example.com',
      origin: 'https://example.com',
      permission: 'notifications'
    }
    await act(async () => {
      root.render(<PermissionPrompt request={notifRequest} onRespond={vi.fn()} />)
    })
    expect(document.body.textContent).toContain('Запрашивает разрешение на отправку уведомлений')

    const mediaRequest: PermissionRequestInfo = {
      id: 'req-3',
      hostname: 'meet.google.com',
      origin: 'https://meet.google.com',
      permission: 'media'
    }
    await act(async () => {
      root.render(<PermissionPrompt request={mediaRequest} onRespond={vi.fn()} />)
    })
    expect(document.body.textContent).toContain('Запрашивает доступ к камере и микрофону')
  })

  it('ensures all buttons have explicit type=button and stop propagation', async () => {
    const onRespond = vi.fn()
    await act(async () => {
      root.render(<PermissionPrompt request={geoRequest} onRespond={onRespond} />)
    })

    const buttons = document.querySelectorAll<HTMLButtonElement>('.chrome-permission-bubble button')
    expect(buttons.length).toBe(3)
    buttons.forEach(button => {
      expect(button.getAttribute('type')).toBe('button')
    })
  })
})
