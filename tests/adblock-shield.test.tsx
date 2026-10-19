// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdblockShield } from '../src/browser/AdblockShield'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('AdblockShield component', () => {
  let root: Root

  beforeEach(() => {
    document.body.innerHTML = '<div id="test-root"></div>'
    root = createRoot(document.getElementById('test-root')!)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
  })

  it('рендерит кнопку щита для корректного URL', async () => {
    await act(async () => {
      root.render(
        <AdblockShield
          tabId="tab-1"
          url="https://habr.com/ru/articles/123"
          blockedCount={5}
        />
      )
    })

    const button = document.querySelector('.adblock-shield-btn')
    expect(button).not.toBeNull()
    expect(button?.getAttribute('aria-label')).toContain('habr.com')
  })

  it('не рендерит щит для пустых или внутренних URL', async () => {
    await act(async () => {
      root.render(<AdblockShield tabId="tab-2" url="about:blank" />)
    })

    const button = document.querySelector('.adblock-shield-btn')
    expect(button).toBeNull()
  })

  it('открывает поповер по клику', async () => {
    await act(async () => {
      root.render(
        <AdblockShield
          tabId="tab-1"
          url="https://habr.com/ru/articles/123"
          blockedCount={7}
        />
      )
    })

    const button = document.querySelector('.adblock-shield-btn') as HTMLButtonElement
    expect(button).not.toBeNull()

    await act(async () => {
      button.click()
    })

    const popover = document.querySelector('.adblock-popover')
    expect(popover).not.toBeNull()
    expect(popover?.textContent).toContain('habr.com')
    expect(popover?.textContent).toContain('Блокировка рекламы')
    expect(popover?.textContent).toContain('Блокировать плашки Cookies')
  })
})
