import { describe, expect, it } from 'vitest'
import { applyChanges, diffState, emptyState, migrateState } from '../shared/state'
import { BOOKMARKS, favoritePage, removeFavoritePage, savePageToDestination } from '../src/browser/bookmarks'
import { createSpaceAndMoveTab } from '../src/browser/tabModel'
import { contextSession } from '../src/workContexts'

const tab = { id: 'live-page', title: 'Чекаут', url: 'https://example.com/checkout', protected: true, scrollY: 320, pinned: true }

describe('быстрое избранное', () => {
  it('меняет категорию одной записи и возвращает её в общее через формат постоянного хранения', () => {
    const initial = emptyState()
    initial.activeSpaceId = initial.spaces[0].id
    initial.spaces[0].activeSession = { tabs: [tab], activeTabId: tab.id }
    const first = savePageToDestination(initial, tab, { name: tab.title, destination: { spaceId: BOOKMARKS } })
    const grouped = savePageToDestination(first.state, tab, { name: tab.title, destination: { spaceId: BOOKMARKS }, newGroupName: 'Референсы' })
    const general = savePageToDestination(grouped.state, tab, { name: tab.title, destination: { spaceId: BOOKMARKS } })
    const stored = migrateState(applyChanges(grouped.state, diffState(grouped.state, general.state)))
    expect(favoritePage(stored.spaces, tab.url)).toMatchObject({ id: first.resource.id, target: tab.url })
    expect(favoritePage(stored.spaces, tab.url)?.bookmarkGroupId).toBeUndefined()
    expect(stored.spaces.find(space => space.kind === 'web')!.resources).toHaveLength(1)
    expect(stored.activeSpaceId).toBe(initial.activeSpaceId)
    expect(stored.spaces[0].activeSession!.tabs[0]).toMatchObject(tab)
    expect(first.resource.bookmarkGroupId).toBeUndefined()
  })

  it('объединяет старые дубли избранного, а удаление сохраняет ссылку в материалах и живую вкладку', () => {
    const initial = emptyState()
    initial.spaces[0].activeSession = { tabs: [tab], activeTabId: tab.id }
    const grouped = savePageToDestination(initial, tab, { name: tab.title, destination: { spaceId: BOOKMARKS }, newGroupName: 'Референсы' })
    const web = grouped.state.spaces.find(space => space.kind === 'web')!
    web.resources.push({ ...grouped.resource, id: 'old-duplicate', bookmarkGroupId: undefined })
    const material = savePageToDestination(grouped.state, tab, { name: tab.title, destination: { spaceId: initial.spaces[0].id } })
    const general = savePageToDestination(material.state, tab, { name: tab.title, destination: { spaceId: BOOKMARKS } })
    expect(general.state.spaces.find(space => space.kind === 'web')!.resources).toHaveLength(1)
    const removed = removeFavoritePage(general.state, tab.url)
    expect(favoritePage(removed.spaces, tab.url)).toBeUndefined()
    expect(removed.spaces[0].resources[0].target).toBe(tab.url)
    expect(removed.spaces[0].activeSession!.tabs[0]).toMatchObject(tab)
    expect(favoritePage(removed.spaces, 'javascript:alert(1)')).toBeUndefined()
  })
})

describe('создание пространства из текущей вкладки', () => {
  it('атомарно переносит ту же вкладку, оставляет исходное пространство и не создаёт лишнюю вкладку', () => {
    const initial = emptyState(), sourceId = initial.spaces[0].id
    initial.activeSpaceId = sourceId
    initial.spaces[0].activeSession = { tabs: [tab], activeTabId: tab.id }
    const next = createSpaceAndMoveTab(initial, sourceId, tab.id, 'checkout-space', '  Новый чекаут  ', 'sage')
    const stored = migrateState(applyChanges(initial, diffState(initial, next)))
    const destination = stored.spaces.find(space => space.id === 'checkout-space')!
    expect(destination).toMatchObject({ name: 'Новый чекаут', nameOrigin: 'manual', resources: [] })
    expect(contextSession(destination).tabs).toHaveLength(1)
    expect(contextSession(destination).tabs[0]).toMatchObject(tab)
    expect(contextSession(stored.spaces[0]).tabs).toHaveLength(0)
    expect(stored.activeSpaceId).toBe(sourceId)
    expect(initial.spaces[0].activeSession!.tabs[0]).toMatchObject(tab)
    expect(initial.spaces).toHaveLength(1)
  })

  it('повторно использует существующее название и не создаёт пространство для исчезнувшей вкладки', () => {
    const initial = emptyState(), sourceId = initial.spaces[0].id
    initial.spaces[0].activeSession = { tabs: [tab], activeTabId: tab.id }
    initial.spaces.push({ id: 'research', name: 'Исследование', tone: 'blue', resources: [] })
    const moved = createSpaceAndMoveTab(initial, sourceId, tab.id, 'new-id', 'исследование', 'sage')
    expect(moved.spaces).toHaveLength(2)
    expect(contextSession(moved.spaces[1]).tabs[0].id).toBe(tab.id)
    expect(createSpaceAndMoveTab(initial, sourceId, 'missing', 'new-id', 'Другая задача', 'sage')).toBe(initial)
    expect(createSpaceAndMoveTab(initial, sourceId, tab.id, 'new-id', '   ', 'sage')).toBe(initial)
  })
})
