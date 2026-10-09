// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { BrowserHistory } from '../src/browser/BrowserHistory'
import type { HistoryItem } from '../src/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('компонент BrowserHistory', () => {
  it('показывает сообщение о пустой истории', async () => {
    document.body.innerHTML = '<div id="test-root"></div>'
    const root = createRoot(document.getElementById('test-root')!)
    try {
      await act(async () => {
        root.render(
          <BrowserHistory
            history={[]}
            onClose={vi.fn()}
            onNavigate={vi.fn()}
            onRemove={vi.fn()}
            onClear={vi.fn()}
          />
        )
      })
      expect(document.body.textContent).toContain('История просмотров пуста')
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('отображает записи и фильтрует их по поиску', async () => {
    document.body.innerHTML = '<div id="test-root"></div>'
    const root = createRoot(document.getElementById('test-root')!)
    const items: HistoryItem[] = [
      { id: '1', url: 'https://github.com', title: 'GitHub Repo', visitedAt: new Date().toISOString() },
      { id: '2', url: 'https://figma.com', title: 'Figma Design', visitedAt: new Date().toISOString() }
    ]
    try {
      await act(async () => {
        root.render(
          <BrowserHistory
            history={items}
            onClose={vi.fn()}
            onNavigate={vi.fn()}
            onRemove={vi.fn()}
            onClear={vi.fn()}
          />
        )
      })
      expect(document.body.textContent).toContain('GitHub Repo')
      expect(document.body.textContent).toContain('Figma Design')

      const searchInput = document.querySelector<HTMLInputElement>('.browser-history-search input')!
      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        nativeSetter?.call(searchInput, 'figma')
        searchInput.dispatchEvent(new Event('input', { bubbles: true }))
        searchInput.dispatchEvent(new Event('change', { bubbles: true }))
      })
      expect(document.body.textContent).not.toContain('GitHub Repo')
      expect(document.body.textContent).toContain('Figma Design')
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('вызывает onNavigate и onClose при клике на элемент', async () => {
    document.body.innerHTML = '<div id="test-root"></div>'
    const root = createRoot(document.getElementById('test-root')!)
    const onNavigate = vi.fn()
    const onClose = vi.fn()
    const items: HistoryItem[] = [
      { id: '1', url: 'https://github.com', title: 'GitHub', visitedAt: new Date().toISOString() }
    ]
    try {
      await act(async () => {
        root.render(
          <BrowserHistory
            history={items}
            onClose={onClose}
            onNavigate={onNavigate}
            onRemove={vi.fn()}
            onClear={vi.fn()}
          />
        )
      })
      const item = document.querySelector<HTMLElement>('.browser-history-item')!
      await act(async () => {
        item.click()
      })
      expect(onNavigate).toHaveBeenCalledWith('https://github.com', false)
      expect(onClose).toHaveBeenCalled()
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('запрашивает подтверждение перед очисткой', async () => {
    document.body.innerHTML = '<div id="test-root"></div>'
    const root = createRoot(document.getElementById('test-root')!)
    const onClear = vi.fn()
    const items: HistoryItem[] = [
      { id: '1', url: 'https://github.com', title: 'GitHub', visitedAt: new Date().toISOString() }
    ]
    try {
      await act(async () => {
        root.render(
          <BrowserHistory
            history={items}
            onClose={vi.fn()}
            onNavigate={vi.fn()}
            onRemove={vi.fn()}
            onClear={onClear}
          />
        )
      })
      const clearBtn = document.querySelector<HTMLButtonElement>('.browser-history-clear-btn')!
      await act(async () => {
        clearBtn.click()
      })

      expect(document.body.textContent).toContain('Очистить всю историю просмотров?')
      const confirmBtn = document.querySelector<HTMLButtonElement>('.browser-history-confirm-btn.is-danger')!
      await act(async () => {
        confirmBtn.click()
      })
      expect(onClear).toHaveBeenCalled()
    } finally {
      await act(async () => root.unmount())
    }
  })

  it('вызывает onRemove при удалении отдельной записи', async () => {
    document.body.innerHTML = '<div id="test-root"></div>'
    const root = createRoot(document.getElementById('test-root')!)
    const onRemove = vi.fn()
    const items: HistoryItem[] = [
      { id: '1', url: 'https://github.com', title: 'GitHub', visitedAt: new Date().toISOString() }
    ]
    try {
      await act(async () => {
        root.render(
          <BrowserHistory
            history={items}
            onClose={vi.fn()}
            onNavigate={vi.fn()}
            onRemove={onRemove}
            onClear={vi.fn()}
          />
        )
      })
      const removeBtn = document.querySelector<HTMLButtonElement>('.browser-history-remove-btn')!
      await act(async () => {
        removeBtn.click()
      })
      expect(onRemove).toHaveBeenCalledWith('1')
    } finally {
      await act(async () => root.unmount())
    }
  })
})
