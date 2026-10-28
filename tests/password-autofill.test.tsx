// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PasswordSavePrompt } from '../src/browser/PasswordSavePrompt'
import type { CredentialSummary, PasswordSavePromptInfo } from '../src/types'
import { BrowserChrome } from '../src/browser/BrowserChrome'
import { bridge } from '../src/bridge'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('PasswordSavePrompt (Calm Tech)', () => {
  let root: Root
  const samplePrompt: PasswordSavePromptInfo = {
    id: 'test-prompt-1',
    tabId: 'tab-1',
    origin: 'https://higgsfield.ai',
    hostname: 'higgsfield.ai',
    username: 'creator@higgsfield.ai',
    token: 'offer-token'
  }

  beforeEach(() => {
    document.body.innerHTML = '<div id="test-root"></div>'
    root = createRoot(document.getElementById('test-root')!)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
  })

  it('отображает хост и логин, а перехваченный пароль в интерфейс не попадает', async () => {
    const onSave = vi.fn()
    const onDismiss = vi.fn()
    await act(async () => {
      root.render(<PasswordSavePrompt prompt={samplePrompt} onSave={onSave} onDismiss={onDismiss} />)
    })

    expect(document.body.textContent).toContain('Сохранить пароль?')
    expect(document.body.textContent).toContain('higgsfield.ai')

    const userInput = document.querySelector<HTMLInputElement>('#password-prompt-user')!
    const passInput = document.querySelector<HTMLInputElement>('#password-prompt-pass')!

    expect(userInput.value).toBe('creator@higgsfield.ai')
    expect(passInput.value).toBe('')
    expect(passInput.placeholder).toBe('Как ввели на странице')
    expect(passInput.type).toBe('password')
    expect(document.body.innerHTML).not.toContain('SuperSecret123!')
  })

  it('переключает видимость пароля по клику на глаз', async () => {
    const onSave = vi.fn()
    const onDismiss = vi.fn()
    await act(async () => {
      root.render(<PasswordSavePrompt prompt={samplePrompt} onSave={onSave} onDismiss={onDismiss} />)
    })

    const passInput = document.querySelector<HTMLInputElement>('#password-prompt-pass')!
    const eyeBtn = document.querySelector<HTMLButtonElement>('.password-eye-btn')!

    await act(async () => {
      eyeBtn.click()
    })
    expect(passInput.type).toBe('text')

    await act(async () => {
      eyeBtn.click()
    })
    expect(passInput.type).toBe('password')
  })

  it('отправляет отредактированные данные при нажатии Сохранить', async () => {
    const onSave = vi.fn()
    const onDismiss = vi.fn()
    await act(async () => {
      root.render(<PasswordSavePrompt prompt={samplePrompt} onSave={onSave} onDismiss={onDismiss} />)
    })

    const userInput = document.querySelector<HTMLInputElement>('#password-prompt-user')!
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      nativeSetter?.call(userInput, 'edited@higgsfield.ai')
      userInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const form = document.querySelector<HTMLFormElement>('.password-bubble-form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    // Empty password = keep the one captured on the page (held by the main process under the token).
    expect(onSave).toHaveBeenCalledWith('edited@higgsfield.ai', '')
  })

  it('закрывает баббл по Escape или кнопке Не сейчас', async () => {
    const onSave = vi.fn()
    const onDismiss = vi.fn()
    await act(async () => {
      root.render(<PasswordSavePrompt prompt={samplePrompt} onSave={onSave} onDismiss={onDismiss} />)
    })

    const dismissBtn = document.querySelector<HTMLButtonElement>('.password-btn-dismiss')!
    await act(async () => {
      dismissBtn.click()
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })
})

describe('Интеграция автозаполнения в BrowserChrome', () => {
  let root: Root

  beforeEach(() => {
    document.body.innerHTML = '<div id="test-root"></div>'
    root = createRoot(document.getElementById('test-root')!)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
  })

  it('отображает кнопку ключа и вызывает autofill при выборе сохранённого пароля', async () => {
    const cred: CredentialSummary = {
      id: 'cred-1',
      origin: 'https://higgsfield.ai',
      username: 'art@design.io',
      updatedAt: new Date().toISOString()
    }

    const listSpy = vi.spyOn(bridge.vault!, 'listCredentials').mockResolvedValue([cred])
    const autofillSpy = vi.fn().mockResolvedValue(true)
    bridge.browser.autofill = autofillSpy

    const mockSpace: any = {
      id: 'space-1',
      name: 'Рабочее',
      kind: 'browser',
      tone: 'slate',
      resources: [],
      createdAt: new Date().toISOString()
    }

    const mockTab: any = {
      id: 'tab-1',
      url: 'https://higgsfield.ai/login',
      title: 'Higgsfield AI Login'
    }

    await act(async () => {
      root.render(
        <BrowserChrome
          space={mockSpace}
          spaces={[mockSpace]}
          tab={mockTab}
          attentionIsland={() => null}
          nativeNavigation={true}
          onHome={vi.fn()}
          onSpace={vi.fn()}
          onSpaceDashboard={vi.fn()}
          onWeb={vi.fn()}
          onAllSpaces={vi.fn()}
          onNavigate={vi.fn()}
          onNavigation={vi.fn()}
          onSave={vi.fn()}
          onDay={vi.fn()}
          onCapture={vi.fn()}
          onAssistant={vi.fn()}
          onFocus={vi.fn()}
          onSearch={vi.fn()}
          onSettings={vi.fn()}
          onPark={vi.fn()}
        />
      )
    })

    // Ждем, пока асинхронный listCredentials завершится и обновит стейт
    await act(async () => {
      await Promise.resolve()
    })

    const keyBtn = document.querySelector<HTMLButtonElement>('.browser-key-toggle')
    expect(keyBtn).not.toBeNull()

    // Кликаем по кнопке ключа для открытия выпадающего списка
    await act(async () => {
      keyBtn?.click()
    })

    expect(document.body.textContent).toContain('Автозаполнение')
    expect(document.body.textContent).toContain('art@design.io')

    // Кликаем по элементу автозаполнения
    const item = document.querySelector<HTMLDivElement>('.autofill-item')
    expect(item).not.toBeNull()

    await act(async () => {
      item?.click()
    })

    // Asks for the exact page's site and autofills by id: the password is resolved in the main process.
    expect(listSpy).toHaveBeenCalledWith('https://higgsfield.ai/login')
    expect(autofillSpy).toHaveBeenCalledWith('tab-1', 'cred-1')
  })
})
