// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalmTooltip } from '../src/CalmTooltip'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = `
    <div id="test-root"></div>
    <div id="app">
      <button id="btn-save" title="В избранное · Ctrl D" aria-label="В избранное">Сохранить</button>
      <button id="btn-move" aria-label="Перенести в другое пространство">Перенести</button>
    </div>
  `
  root = createRoot(document.getElementById('test-root')!)
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
})

describe('CalmTooltip', () => {
  it('отображает стильную подсказку под курсором при наведении и форматирует сочетание клавиш', async () => {
    await act(async () => root.render(<CalmTooltip />))

    const button = document.getElementById('btn-save')!
    await act(async () => {
      button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 150, clientY: 200 }))
      vi.advanceTimersByTime(200)
    })

    const tooltip = document.querySelector('.calm-tooltip')
    expect(tooltip).not.toBeNull()
    expect(tooltip?.classList.contains('is-visible')).toBe(true)
    expect(tooltip?.querySelector('.calm-tooltip-label')?.textContent).toBe('В избранное')
    expect(tooltip?.querySelector('.calm-tooltip-kbd')?.textContent).toBe('Ctrl D')

    // Native title suppressed while hovering
    expect(button.getAttribute('title')).toBeNull()

    // Hides on mouseout
    await act(async () => {
      button.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    })

    // Native title restored
    expect(button.getAttribute('title')).toBe('В избранное · Ctrl D')
  })

  it('использует aria-label если title не задан', async () => {
    await act(async () => root.render(<CalmTooltip />))

    const button = document.getElementById('btn-move')!
    await act(async () => {
      button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 100, clientY: 100 }))
      vi.advanceTimersByTime(200)
    })

    const tooltip = document.querySelector('.calm-tooltip')
    expect(tooltip).not.toBeNull()
    expect(tooltip?.querySelector('.calm-tooltip-label')?.textContent).toBe('Перенести в другое пространство')
    expect(tooltip?.querySelector('.calm-tooltip-kbd')).toBeNull()
  })

  it('скрывается при нажатии Escape или клике', async () => {
    await act(async () => root.render(<CalmTooltip />))

    const button = document.getElementById('btn-save')!
    await act(async () => {
      button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 150, clientY: 200 }))
      vi.advanceTimersByTime(200)
    })

    expect(document.querySelector('.calm-tooltip.is-visible')).not.toBeNull()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(document.querySelector('.calm-tooltip.is-visible')).toBeNull()
  })
})
