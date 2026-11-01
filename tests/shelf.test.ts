import { describe, expect, it } from 'vitest'
import type { AppState, BrowserTab, Space } from '../src/types'
import { DEFAULT_SHELVE_DAYS, SHELF_LIMIT, forgetShelvedTab, shelveAfterDays, shelveStaleTabs, unshelveTab } from '../src/browser/shelf'
import { contextSession } from '../src/workContexts'

const NOW = new Date('2026-10-30T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()
const tab = (id: string, extra: Partial<BrowserTab> = {}): BrowserTab => ({ id, title: id, url: `https://${id}.test/`, ...extra })

function fixture(tabs: BrowserTab[], space: Partial<Space> = {}): AppState {
  return { version: 2, dismissedUntil: null, reminders: [], spaces: [{ id: 'work', name: 'Работа', tone: 'sage', resources: [], activeSession: { tabs, activeTabId: 'now' }, ...space }] }
}
const shelved = (state: AppState) => (state.spaces[0].shelf || []).map(item => item.id)
const live = (state: AppState) => (state.spaces[0].activeSession?.tabs || []).map(item => item.id)

describe('тихая уборка вкладок пространств', () => {
  it('убирает давние вкладки на полку, оставляя активную, закреплённую, защищённую и свежие', () => {
    const state = fixture([
      tab('now', { lastActiveAt: daysAgo(30) }), tab('old', { lastActiveAt: daysAgo(20) }), tab('fresh', { lastActiveAt: daysAgo(2) }),
      tab('pin', { lastActiveAt: daysAgo(40), pinned: true }), tab('form', { lastActiveAt: daysAgo(40), protected: true }),
      tab('blank', { lastActiveAt: daysAgo(40), url: '' })
    ])
    const next = shelveStaleTabs(state, NOW)
    expect(shelved(next)).toEqual(['old'])
    expect(live(next)).toEqual(['now', 'fresh', 'pin', 'form', 'blank'])
    expect(next.spaces[0].shelf![0].shelvedAt).toBe(NOW.toISOString())
    expect(state.spaces[0].activeSession!.tabs).toHaveLength(6)
  })

  it('вкладке без отметки ставит «сейчас» и не убирает её сразу после обновления', () => {
    const next = shelveStaleTabs(fixture([tab('now'), tab('legacy', { lastAccessedAt: daysAgo(90) })]), NOW)
    expect(shelved(next)).toEqual([])
    expect(next.spaces[0].activeSession!.tabs.every(item => item.lastActiveAt === NOW.toISOString())).toBe(true)
  })

  it('не пишет ничего, если менять нечего, и освежает отметку активной вкладки не чаще раза в час', () => {
    const state = fixture([tab('now', { lastActiveAt: new Date(NOW.getTime() - 10 * 60_000).toISOString() }), tab('fresh', { lastActiveAt: daysAgo(1) })])
    expect(shelveStaleTabs(state, NOW)).toBe(state)
    const hourLater = shelveStaleTabs(state, new Date(NOW.getTime() + 61 * 60_000))
    expect(hourLater).not.toBe(state)
    expect(live(hourLater)).toEqual(['now', 'fresh'])
  })

  it('учитывает активную и парную вкладку каждого дела, не трогает «Сегодня», веб, архив и открытое на экране', () => {
    const contexts = [{ id: 'a', title: '', documentIds: [], activeTabId: 'a1', splitTabId: 'a2' }, { id: 'b', title: '', documentIds: [], activeTabId: 'b1' }]
    const old = daysAgo(50)
    const tabs = [tab('a1', { contextId: 'a', lastActiveAt: old }), tab('a2', { contextId: 'a', lastActiveAt: old }), tab('a3', { contextId: 'a', lastActiveAt: old }), tab('b1', { contextId: 'b', lastActiveAt: old })]
    const multi = fixture(tabs, { workContexts: contexts, activeContextId: 'a', activeSession: { tabs, activeTabId: 'a1', splitTabId: 'a2' } })
    expect(shelved(shelveStaleTabs(multi, NOW))).toEqual(['a3'])
    const plain = [tab('now', { lastActiveAt: old }), tab('old', { lastActiveAt: old })]
    for (const space of [{ kind: 'day' as const }, { kind: 'web' as const }, { archivedAt: old }]) {
      const state = fixture(plain, space)
      expect(shelveStaleTabs(state, NOW)).toBe(state)
    }
    const onScreen = fixture(plain)
    expect(shelveStaleTabs(onScreen, NOW, 14, ['work'])).toBe(onScreen)
  })

  it('выключается нулём дней, берёт срок из настройки и держит не больше SHELF_LIMIT', () => {
    const state = fixture([tab('now'), tab('old', { lastActiveAt: daysAgo(10) })])
    expect(shelveAfterDays(state)).toBe(DEFAULT_SHELVE_DAYS)
    expect(shelveAfterDays({ shelveAfterDays: 0 })).toBe(0)
    expect(shelveAfterDays({ shelveAfterDays: 7 })).toBe(7)
    expect(shelveStaleTabs({ ...state, shelveAfterDays: 0 }, NOW)).toEqual({ ...state, shelveAfterDays: 0 })
    expect(shelved(shelveStaleTabs({ ...state, shelveAfterDays: 7 }, NOW))).toEqual(['old'])
    expect(shelved(shelveStaleTabs(state, NOW))).toEqual([])
    const many = fixture([tab('now'), tab('old', { lastActiveAt: daysAgo(30) })], { shelf: Array.from({ length: SHELF_LIMIT }, (_, index) => tab(`s${index}`)) })
    const shelf = shelveStaleTabs(many, NOW).spaces[0].shelf!
    expect(shelf).toHaveLength(SHELF_LIMIT)
    expect(shelf[0].id).toBe('old')
  })

  it('не плодит дубли одной страницы на полке', () => {
    const state = fixture([tab('now'), tab('again', { url: 'https://same.test/', lastActiveAt: daysAgo(30) })], { shelf: [tab('before', { url: 'https://same.test/' })] })
    expect(shelved(shelveStaleTabs(state, NOW))).toEqual(['again'])
  })

  it('«Вернуть» ставит вкладку активной в текущее дело без метки полки, «Забыть» убирает насовсем', () => {
    const state = shelveStaleTabs(fixture([tab('now'), tab('old', { lastActiveAt: daysAgo(30), scrollY: 120 })]), NOW)
    const back = unshelveTab(state, 'work', 'old', NOW.toISOString())
    const session = contextSession(back.spaces[0])
    expect(session.activeTabId).toBe('old')
    expect(session.tabs.find(item => item.id === 'old')).toMatchObject({ scrollY: 120, lastActiveAt: NOW.toISOString() })
    expect(session.tabs.find(item => item.id === 'old')).not.toHaveProperty('shelvedAt')
    expect(shelved(back)).toEqual([])
    expect(unshelveTab(state, 'work', 'missing')).toBe(state)
    expect(shelved(forgetShelvedTab(state, 'work', 'old'))).toEqual([])
    expect(forgetShelvedTab(state, 'work', 'missing')).toBe(state)
  })
})
