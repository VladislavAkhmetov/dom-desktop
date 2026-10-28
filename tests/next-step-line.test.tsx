// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { NextStepLine } from '../src/NextStepLine'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

it('правит следующий шаг на месте: Enter сохраняет, Escape отменяет, пустое значение убирает шаг', async () => {
  const save = vi.fn()
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const type = async (value: string, key: string) => {
    const input = container.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) })
  }
  try {
    await act(async () => root.render(<NextStepLine step="Собрать макеты" onSave={save} />))
    expect(container.textContent).toBe('Дальше:Собрать макеты')
    await act(async () => container.querySelector('button')!.click())
    await type('Отправить клиенту', 'Enter')
    expect(save).toHaveBeenLastCalledWith('Отправить клиенту')

    await act(async () => container.querySelector('button')!.click())
    await type('Не то', 'Escape')
    expect(save).toHaveBeenCalledTimes(1)
    expect(container.querySelector('input')).toBeNull()

    await act(async () => container.querySelector('button')!.click())
    await type('   ', 'Enter')
    expect(save).toHaveBeenLastCalledWith('')

    await act(async () => root.render(<NextStepLine onSave={save} />))
    expect(container.textContent).toBe('Следующий шаг')
    await act(async () => root.render(<NextStepLine />))
    expect(container.textContent).toBe('')
  } finally { await act(async () => root.unmount()); container.remove() }
})
