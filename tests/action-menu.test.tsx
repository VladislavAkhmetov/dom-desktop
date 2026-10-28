// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { ActionMenu } from '../src/ActionMenu'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('ActionMenu', () => {
  it('открытие второго меню закрывает первое, хотя триггер гасит pointerdown', async () => {
    const container = document.body.appendChild(document.createElement('div'))
    const root = createRoot(container)
    const action = (label: string) => ({ label, icon: null, onSelect: () => {} })
    await act(async () => root.render(<><ActionMenu label="Первое" actions={[action('А')]} /><ActionMenu label="Второе" actions={[action('Б')]} /></>))
    const [first, second] = [...container.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"]')]
    await act(async () => first.click())
    expect(first.getAttribute('aria-expanded')).toBe('true')
    await act(async () => { second.dispatchEvent(new Event('pointerdown', { bubbles: true })); second.click() })
    expect(first.getAttribute('aria-expanded')).toBe('false')
    expect(second.getAttribute('aria-expanded')).toBe('true')
    await act(async () => root.unmount())
  })
})
