import { describe, expect, it } from 'vitest'
import type { AppState, Space } from '../src/types'
import { activateContext, contextSession, latestContinuation } from '../src/workContexts'
import { ensureWebSpace, findTabs, moveBrowserTab, orderedTabs, removeBrowserTab, reorderBrowserTabs, restoreBrowserTab, selectBrowserTab, tabEntries, webSpaceId } from '../src/browser/tabModel'

function fixture(): AppState {
  const space: Space = { id: 'trip', name: 'Поездка', tone: 'sand', resources: [], activeContextId: 'now',
    workContexts: [{ id: 'now', title: 'Маршрут', documentIds: [], activeTabId: 'map', splitTabId: 'hotel' }, { id: 'later', title: 'Летний отпуск', documentIds: [], activeTabId: 'summer' }],
    activeSession: { tabs: [
      { id: 'map', contextId: 'now', title: 'Маршрут', url: 'https://map.test/' },
      { id: 'hotel', contextId: 'now', title: 'Отель у озера', url: 'https://stay.test/lake', protected: true, scrollY: 240, pinned: true },
      { id: 'train', contextId: 'now', title: 'Билеты', url: 'https://train.test/' },
      { id: 'summer', contextId: 'later', title: 'Отель у моря', url: 'https://stay.test/sea' }
    ], activeTabId: 'map', splitTabId: 'hotel' }
  }
  return { version: 2, dismissedUntil: null, reminders: [], spaces: [space,
    { id: 'work', name: 'Работа', tone: 'sage', resources: [], activeSession: { tabs: [{ id: 'brief', title: 'Бриф', url: 'https://brief.test/' }], activeTabId: 'brief' } },
    { id: 'archive', name: 'Архив', tone: 'blue', resources: [], archivedAt: '2026-09-30T10:00:00Z', activeSession: { tabs: [{ id: 'old', title: 'Отель', url: 'https://old.test/' }], activeTabId: 'old' } }
  ] }
}

describe('поиск и порядок вкладок', () => {
  it('ищет во всех делах пространства, исключая архив и чужие пространства', () => {
    const entries = tabEntries(fixture())
    expect(findTabs(entries, 'ОТЕЛЬ', 'trip').map(entry => entry.tab.id)).toEqual(['hotel', 'summer'])
    expect(findTabs(entries, 'билеты поездка', 'trip').map(entry => entry.tab.id)).toEqual(['train'])
    expect(findTabs(entries, 'летний stay.test', 'trip').map(entry => entry.tab.id)).toEqual(['summer'])
    expect(findTabs(entries, 'бриф', 'trip')).toEqual([])
    expect(findTabs(entries, 'бриф').map(entry => entry.tab.id)).toEqual(['brief'])
    expect(findTabs(entries, 'отель').map(entry => entry.tab.id)).not.toContain('old')
    const web = ensureWebSpace(fixture())
    web.space.activeSession = { tabs: [{ id: 'reading', title: 'Статья', url: 'https://reading.test/' }], activeTabId: 'reading' }
    expect(findTabs(tabEntries(web.state), 'браузер').map(entry => entry.tab.id)).toEqual(['reading'])
    expect(findTabs(tabEntries(web.state), 'веб').map(entry => entry.tab.id)).toEqual(['reading'])
  })
  it('выше ставит точное совпадение и принимает е вместо ё', () => {
    const entries = tabEntries(fixture())
    entries[0].tab.title = 'Всё о поездке'
    expect(findTabs(entries, 'все о поездке').map(entry => entry.tab.id)).toEqual([entries[0].tab.id])
    expect(findTabs(entries, 'маршрут')[0].tab.id).toBe('map')
  })
  it('сохраняет читаемые закреплённые вкладки впереди и не смешивает группы при перестановке', () => {
    const tabs = contextSession(fixture().spaces[0]).tabs
    expect(orderedTabs(tabs).map(tab => tab.id)).toEqual(['hotel', 'map', 'train'])
    expect(reorderBrowserTabs(tabs, 'train', 'map').map(tab => tab.id)).toEqual(['hotel', 'train', 'map'])
    expect(reorderBrowserTabs(tabs, 'map', 'hotel')).toBe(tabs)
    expect(tabs.map(tab => tab.id)).toEqual(['map', 'hotel', 'train'])
  })
})

describe('переключение, закрытие и перенос вкладок', () => {
  it('открывает результат из другого дела, сохраняя сессию предыдущего', () => {
    const next = selectBrowserTab(fixture(), 'trip', 'summer')
    expect(next.activeSpaceId).toBe('trip')
    expect(next.spaces[0].activeContextId).toBe('later')
    expect(contextSession(next.spaces[0]).activeTabId).toBe('summer')
    expect(contextSession(next.spaces[0], 'now')).toMatchObject({ activeTabId: 'map', splitTabId: 'hotel' })
    expect(next.spaces[0].activeSession?.tabs).toHaveLength(4)
  })
  it('при выборе правой страницы меняет стороны, сохраняя просмотр рядом', () => {
    expect(contextSession(selectBrowserTab(fixture(), 'trip', 'hotel').spaces[0])).toMatchObject({ activeTabId: 'hotel', splitTabId: 'map' })
  })
  it('закрывает только указанную вкладку и выбирает левую соседнюю', () => {
    const next = removeBrowserTab(fixture(), 'trip', 'map')
    expect(contextSession(next.spaces[0])).toMatchObject({ activeTabId: 'hotel', splitTabId: null })
    expect(contextSession(next.spaces[0], 'later').tabs.map(tab => tab.id)).toEqual(['summer'])
    expect(next.spaces[0].activeSession?.closedTabs?.[0]).toMatchObject({ id: 'map', closedIndex: 1 })
  })
  it('возвращает закрытую вкладку в её дело, не заявляя о сохранённой форме', () => {
    const original = fixture(), tab = tabEntries(original).find(entry => entry.tab.id === 'hotel')!.tab
    const removed = removeBrowserTab(original, 'trip', 'hotel')
    const restored = restoreBrowserTab(removed, 'trip', { ...tab, closedIndex: 0 })
    expect(contextSession(restored.spaces[0]).tabs[0]).toMatchObject({ id: 'hotel', protected: false, scrollY: 240 })
    expect(restored.spaces[0].activeSession?.closedTabs).toEqual([])
    expect(restored.spaces[0].activeSession?.tabs).toHaveLength(4)
  })
  it('переносит тот же идентификатор и состояние страницы, сохраняя другие дела', () => {
    const original = fixture(), moved = moveBrowserTab(original, 'trip', 'hotel', 'work')
    expect(contextSession(moved.spaces[0]).tabs.map(tab => tab.id)).toEqual(['map', 'train'])
    expect(contextSession(moved.spaces[0], 'later').tabs.map(tab => tab.id)).toEqual(['summer'])
    expect(moved.spaces[0].activeSession?.closedTabs || []).toEqual([])
    expect(contextSession(moved.spaces[1]).tabs[1]).toMatchObject({ id: 'hotel', protected: true, scrollY: 240, pinned: true })
    const returned = moveBrowserTab(moved, 'work', 'hotel', 'trip', 'now', 1)
    expect(contextSession(returned.spaces[0]).tabs.map(tab => tab.id)).toEqual(['map', 'hotel', 'train'])
    expect(contextSession(returned.spaces[1]).tabs.map(tab => tab.id)).toEqual(['brief'])
    expect(original.spaces[0].activeSession?.tabs).toHaveLength(4)
  })
  it('возвращает обычную вкладку на её видимое место даже при несортированном закреплении', () => {
    const original = fixture()
    original.spaces[0].activeSession!.tabs = [
      { id: 'a', contextId: 'now', title: 'A', url: 'https://a.test/' },
      { id: 'b', contextId: 'now', title: 'B', url: 'https://b.test/' },
      { id: 'c', contextId: 'now', title: 'C', url: 'https://c.test/', pinned: true },
      { id: 'd', contextId: 'now', title: 'D', url: 'https://d.test/', pinned: true }
    ]
    const removed = removeBrowserTab(original, 'trip', 'a')
    const restored = restoreBrowserTab(removed, 'trip', removed.spaces[0].activeSession!.closedTabs![0])
    expect(orderedTabs(contextSession(restored.spaces[0]).tabs).map(tab => tab.id)).toEqual(['c', 'd', 'a', 'b'])
  })
  it('отвергает отсутствующее пространство и дело без потери вкладки', () => {
    const original = fixture()
    expect(moveBrowserTab(original, 'trip', 'hotel', 'missing')).toBe(original)
    expect(moveBrowserTab(original, 'trip', 'hotel', 'work', 'missing')).toBe(original)
    expect(selectBrowserTab(original, 'archive', 'old')).toBe(original)
  })
  it('создаёт единственный Веб без пустой вкладки и не заменяет продолжение проекта', () => {
    const original = fixture(), created = ensureWebSpace(original)
    expect(created.space.kind).toBe('web')
    expect(contextSession(created.space).tabs).toEqual([])
    expect(webSpaceId(created.state)).toBe(created.space.id)
    expect(ensureWebSpace(created.state).state.spaces).toHaveLength(4)
    const browsing = { ...created.space, activeSession: { tabs: [{ id: 'web-page', title: 'Новости', url: 'https://news.test/' }], activeTabId: 'web-page' }, lastActiveAt: '2099-01-01T10:00:00Z' }
    expect(latestContinuation({ ...created.state, spaces: [original.spaces[0], activateContext(browsing, browsing.activeContextId!)] })?.space.id).toBe('trip')
  })
})
