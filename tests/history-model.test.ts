import { describe, expect, it } from 'vitest'
import {
  clearHistory,
  filterHistory,
  groupHistoryByDate,
  isValidHistoryUrl,
  recordHistory,
  removeHistoryItem
} from '../src/browser/historyModel'
import type { HistoryItem } from '../src/types'

describe('история браузера (historyModel)', () => {
  it('проверяет валидность URL для истории', () => {
    expect(isValidHistoryUrl('https://example.com')).toBe(true)
    expect(isValidHistoryUrl('http://github.com/path')).toBe(true)
    expect(isValidHistoryUrl('')).toBe(false)
    expect(isValidHistoryUrl('about:blank')).toBe(false)
    expect(isValidHistoryUrl('file:///C:/test.txt')).toBe(false)
    expect(isValidHistoryUrl('javascript:alert(1)')).toBe(false)
  })

  it('добавляет новые записи в начало истории', () => {
    const t0 = new Date(2026, 9, 9, 10, 0, 0)
    const h1 = recordHistory([], { url: 'https://site1.ru', title: 'Сайт 1' }, t0)
    expect(h1).toHaveLength(1)
    expect(h1[0].url).toBe('https://site1.ru')
    expect(h1[0].title).toBe('Сайт 1')

    const t1 = new Date(2026, 9, 9, 10, 30, 0)
    const h2 = recordHistory(h1, { url: 'https://site2.ru', title: 'Сайт 2' }, t1)
    expect(h2).toHaveLength(2)
    expect(h2[0].url).toBe('https://site2.ru')
    expect(h2[1].url).toBe('https://site1.ru')
  })

  it('обновляет недавнюю запись при повторном переходе вместо дублирования', () => {
    const t0 = new Date(2026, 9, 9, 10, 0, 0)
    const h1 = recordHistory([], { url: 'https://site1.ru', title: 'Сайт 1' }, t0)

    const t1 = new Date(2026, 9, 9, 10, 5, 0) // 5 минут спустя
    const h2 = recordHistory(h1, { url: 'https://site1.ru', title: 'Сайт 1 — Новая страница' }, t1)
    expect(h2).toHaveLength(1)
    expect(h2[0].title).toBe('Сайт 1 — Новая страница')
    expect(h2[0].visitedAt).toBe(t1.toISOString())
  })

  it('удаляет запись и очищает историю', () => {
    const items: HistoryItem[] = [
      { id: '1', url: 'https://a.ru', title: 'A', visitedAt: '2026-10-09T10:00:00Z' },
      { id: '2', url: 'https://b.ru', title: 'B', visitedAt: '2026-10-09T10:01:00Z' }
    ]
    const filtered = removeHistoryItem(items, '1')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('2')

    expect(clearHistory()).toEqual([])
  })

  it('фильтрует историю по поисковому запросу', () => {
    const items: HistoryItem[] = [
      { id: '1', url: 'https://github.com/torvalds', title: 'GitHub Linux', visitedAt: '2026-10-09T10:00:00Z' },
      { id: '2', url: 'https://figma.com/design', title: 'Макет Дома', visitedAt: '2026-10-09T10:01:00Z' }
    ]
    expect(filterHistory(items, 'linux')).toHaveLength(1)
    expect(filterHistory(items, 'макет')).toHaveLength(1)
    expect(filterHistory(items, 'figma')).toHaveLength(1)
    expect(filterHistory(items, 'нет такого')).toHaveLength(0)
  })

  it('группирует записи по дням', () => {
    const ref = new Date(2026, 9, 9, 15, 0, 0)
    const items: HistoryItem[] = [
      { id: '1', url: 'https://today.ru', title: 'Сегодня', visitedAt: new Date(2026, 9, 9, 11, 0, 0).toISOString() },
      { id: '2', url: 'https://yesterday.ru', title: 'Вчера', visitedAt: new Date(2026, 9, 8, 12, 0, 0).toISOString() },
      { id: '3', url: 'https://earlier.ru', title: 'Давно', visitedAt: new Date(2026, 8, 1, 10, 0, 0).toISOString() }
    ]
    const groups = groupHistoryByDate(items, ref)
    expect(groups.map(g => g.label)).toEqual(['Сегодня', 'Вчера', 'Ранее'])
    expect(groups[0].items[0].title).toBe('Сегодня')
    expect(groups[1].items[0].title).toBe('Вчера')
    expect(groups[2].items[0].title).toBe('Давно')
  })
})
