import type { HistoryItem, Space } from '../types'

export interface OmniboxSuggestionItem {
  id: string
  type: 'search' | 'url' | 'tab' | 'bookmark' | 'history'
  title: string
  subtitle?: string
  value: string
  tabId?: string
  spaceId?: string
}

function formatDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function buildOmniboxSuggestions({
  query,
  spaces,
  history = [],
  googleSuggestions = []
}: {
  query: string
  spaces: Space[]
  history?: HistoryItem[]
  googleSuggestions?: string[]
}): OmniboxSuggestionItem[] {
  const raw = query.trim()
  const q = raw.toLowerCase()
  const items: OmniboxSuggestionItem[] = []
  const seenValues = new Set<string>()

  const isUrl = /^https?:\/\//i.test(raw) || /^[^\s]+\.[^\s]+$/.test(raw)

  // 1. Primary input item
  if (raw) {
    if (isUrl) {
      const urlVal = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      items.push({
        id: 'primary-url',
        type: 'url',
        title: raw,
        subtitle: 'Перейти по адресу',
        value: urlVal
      })
      seenValues.add(urlVal.toLowerCase())
      seenValues.add(raw.toLowerCase())
    } else {
      items.push({
        id: 'primary-search',
        type: 'search',
        title: raw,
        subtitle: 'Поиск в Google',
        value: raw
      })
      seenValues.add(raw.toLowerCase())
    }
  }

  // 2. Open tabs (in current or other spaces)
  if (q) {
    for (const space of spaces) {
      if (space.archivedAt) continue
      for (const tab of space.activeSession?.tabs || []) {
        if (!tab.url) continue
        const title = tab.title || tab.url
        if (title.toLowerCase().includes(q) || tab.url.toLowerCase().includes(q)) {
          const key = tab.url.toLowerCase().replace(/\/$/, '')
          if (!seenValues.has(key)) {
            seenValues.add(key)
            items.push({
              id: `tab-${tab.id}`,
              type: 'tab',
              title,
              subtitle: `Вкладка · ${space.name} · ${formatDomain(tab.url)}`,
              value: tab.url,
              tabId: tab.id,
              spaceId: space.id
            })
          }
        }
      }
    }
  }

  // 3. Bookmarks (spaces.resources)
  if (q) {
    for (const space of spaces) {
      if (space.archivedAt) continue
      for (const resource of space.resources) {
        if (resource.kind !== 'link' || !resource.target) continue
        if (resource.name.toLowerCase().includes(q) || resource.target.toLowerCase().includes(q)) {
          const key = resource.target.toLowerCase().replace(/\/$/, '')
          if (!seenValues.has(key)) {
            seenValues.add(key)
            items.push({
              id: `bm-${resource.id}`,
              type: 'bookmark',
              title: resource.name,
              subtitle: `Избранное · ${formatDomain(resource.target)}`,
              value: resource.target
            })
          }
        }
      }
    }
  }

  // 4. History matches
  if (q) {
    for (const h of history) {
      if (!h.url) continue
      const title = h.title || h.url
      if (title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q)) {
        const key = h.url.toLowerCase().replace(/\/$/, '')
        if (!seenValues.has(key)) {
          seenValues.add(key)
          items.push({
            id: `hist-${h.url}`,
            type: 'history',
            title,
            subtitle: `История · ${formatDomain(h.url)}`,
            value: h.url
          })
        }
      }
    }
  }

  // 5. Google suggestions
  for (const sug of googleSuggestions) {
    const trimmed = sug.trim()
    if (!trimmed) continue
    const isNav = /^https?:\/\//i.test(trimmed)
    const key = trimmed.toLowerCase()
    if (!seenValues.has(key)) {
      seenValues.add(key)
      items.push({
        id: `google-${trimmed}`,
        type: isNav ? 'url' : 'search',
        title: trimmed,
        subtitle: isNav ? 'Перейти' : 'Поиск в Google',
        value: trimmed
      })
    }
  }

  // Fallback when input is focused but empty
  if (!raw && history.length > 0) {
    for (const h of history.slice(0, 5)) {
      items.push({
        id: `recent-${h.url}`,
        type: 'history',
        title: h.title || h.url,
        subtitle: `История · ${formatDomain(h.url)}`,
        value: h.url
      })
    }
  }

  return items.slice(0, 8)
}
