import type { HistoryItem } from '../types'

export function isValidHistoryUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) return false
  try {
    const parsed = new URL(trimmed)
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

export function formatHistoryDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function formatHistoryTime(visitedAt: string): string {
  try {
    const date = new Date(visitedAt)
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function recordHistory(
  currentHistory: HistoryItem[] | undefined,
  entry: { url: string; title?: string; favicon?: string; spaceId?: string },
  now = new Date()
): HistoryItem[] {
  if (!isValidHistoryUrl(entry.url)) return currentHistory || []
  const list = currentHistory ? [...currentHistory] : []
  const cleanUrl = entry.url.trim()
  let domain = cleanUrl
  try { domain = new URL(cleanUrl).hostname } catch {}
  const rawTitle = (entry.title || '').trim()
  const title = rawTitle && rawTitle !== cleanUrl ? rawTitle : domain
  const visitedAt = now.toISOString()

  // If the same URL was visited recently (within 15 minutes), update it and move to front
  const existingIndex = list.findIndex(item => item.url === cleanUrl)
  if (existingIndex >= 0) {
    const existing = list[existingIndex]
    const diffMs = Math.abs(now.getTime() - Date.parse(existing.visitedAt || visitedAt))
    if (diffMs < 15 * 60 * 1000) {
      const updated: HistoryItem = {
        ...existing,
        title: rawTitle && rawTitle !== cleanUrl ? rawTitle : existing.title || domain,
        visitedAt,
        favicon: entry.favicon || existing.favicon,
        spaceId: entry.spaceId || existing.spaceId
      }
      list.splice(existingIndex, 1)
      list.unshift(updated)
      return list.slice(0, 1000)
    }
  }

  const newItem: HistoryItem = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url: cleanUrl,
    title,
    visitedAt,
    favicon: entry.favicon,
    spaceId: entry.spaceId
  }

  list.unshift(newItem)
  return list.slice(0, 1000)
}

export function removeHistoryItem(currentHistory: HistoryItem[] | undefined, id: string): HistoryItem[] {
  if (!currentHistory) return []
  return currentHistory.filter(item => item.id !== id)
}

export function clearHistory(): HistoryItem[] {
  return []
}

export function filterHistory(items: HistoryItem[], query: string): HistoryItem[] {
  const q = query.trim().toLocaleLowerCase('ru')
  if (!q) return items
  return items.filter(item =>
    item.title.toLocaleLowerCase('ru').includes(q) ||
    item.url.toLocaleLowerCase('ru').includes(q)
  )
}

export interface HistoryGroup {
  label: string
  items: HistoryItem[]
}

export function groupHistoryByDate(items: HistoryItem[], reference = new Date()): HistoryGroup[] {
  const groups: Record<'today' | 'yesterday' | 'week' | 'earlier', HistoryItem[]> = {
    today: [],
    yesterday: [],
    week: [],
    earlier: []
  }

  const startOfToday = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000

  for (const item of items) {
    const time = Date.parse(item.visitedAt)
    if (Number.isNaN(time) || time >= startOfToday) {
      groups.today.push(item)
    } else if (time >= startOfYesterday) {
      groups.yesterday.push(item)
    } else if (time >= startOfWeek) {
      groups.week.push(item)
    } else {
      groups.earlier.push(item)
    }
  }

  const result: HistoryGroup[] = []
  if (groups.today.length) result.push({ label: 'Сегодня', items: groups.today })
  if (groups.yesterday.length) result.push({ label: 'Вчера', items: groups.yesterday })
  if (groups.week.length) result.push({ label: 'На этой неделе', items: groups.week })
  if (groups.earlier.length) result.push({ label: 'Ранее', items: groups.earlier })

  return result
}
