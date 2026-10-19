import { describe, expect, it } from 'vitest'
import { buildOmniboxSuggestions } from '../src/browser/omniboxSuggestions'
import type { Space } from '../src/types'

describe('omnibox suggestions builder', () => {
  const spaces: Space[] = [
    {
      id: 'work',
      name: 'Работа',
      tone: 'sage',
      resources: [
        { id: 'bm1', name: 'Pinterest Доски', kind: 'link', target: 'https://pinterest.com/boards', createdAt: '2026-10-10T00:00:00Z' },
        { id: 'doc1', name: 'Документ', kind: 'file', target: 'C:\\doc.txt', createdAt: '2026-10-10T00:00:00Z' }
      ],
      activeSession: {
        activeTabId: 'tab1',
        tabs: [
          { id: 'tab1', title: 'Pinterest Feed', url: 'https://pinterest.com/feed' }
        ]
      }
    }
  ]

  const history = [
    { url: 'https://pinterest.com/login', title: 'Вход в Pinterest', visitedAt: '2026-10-10T01:00:00Z' },
    { url: 'https://github.com/trending', title: 'GitHub Trending', visitedAt: '2026-10-10T00:30:00Z' }
  ]

  it('формирует первичное действие и находит открытые вкладки, закладки, историю и поисковые подсказки', () => {
    const suggestions = buildOmniboxSuggestions({
      query: 'pin',
      spaces,
      history,
      googleSuggestions: ['pinterest video downloader', 'pinterest wallpaper']
    })

    expect(suggestions.length).toBeGreaterThan(3)
    // Primary item is Google search
    expect(suggestions[0]).toMatchObject({
      type: 'search',
      title: 'pin',
      value: 'pin'
    })

    // Found open tab
    const tabItem = suggestions.find(s => s.type === 'tab')
    expect(tabItem).toBeDefined()
    expect(tabItem?.title).toBe('Pinterest Feed')
    expect(tabItem?.value).toBe('https://pinterest.com/feed')

    // Found bookmark
    const bookmarkItem = suggestions.find(s => s.type === 'bookmark')
    expect(bookmarkItem).toBeDefined()
    expect(bookmarkItem?.title).toBe('Pinterest Доски')

    // Found history
    const historyItem = suggestions.find(s => s.type === 'history')
    expect(historyItem).toBeDefined()
    expect(historyItem?.title).toBe('Вход в Pinterest')

    // Found Google suggestions
    const googleItems = suggestions.filter(s => s.id.startsWith('google-'))
    expect(googleItems.length).toBe(2)
  })

  it('для URL формирует прямое действие перехода', () => {
    const suggestions = buildOmniboxSuggestions({
      query: 'pinterest.com',
      spaces,
      history
    })

    expect(suggestions[0]).toMatchObject({
      type: 'url',
      value: 'https://pinterest.com'
    })
  })

  it('дедуплицирует одинаковые адреса', () => {
    const suggestions = buildOmniboxSuggestions({
      query: 'pinterest',
      spaces,
      history,
      googleSuggestions: ['https://pinterest.com/login'] // identical to history item
    })

    const loginOccurrences = suggestions.filter(s => s.value.toLowerCase().includes('pinterest.com/login'))
    expect(loginOccurrences).toHaveLength(1)
  })
})
