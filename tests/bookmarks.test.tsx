// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { applyChanges, diffState, emptyState, migrateState } from '../shared/state'
import { BOOKMARKS, defaultBookmarkDestination, savePageToDestination } from '../src/browser/bookmarks'
import { SavePageDialog } from '../src/browser/SavePageDialog'

const tab = { id: 'tab', title: 'Документация', url: 'https://example.com/docs?lang=ru#start', protected: true }
const request = { destination: { spaceId: BOOKMARKS }, name: tab.title, newGroupName: 'Рабочее' }

describe('сохранение страницы в выбранное место', () => {
  it('сохраняет группу и ссылку через общий формат хранения, не меняя живую вкладку или выбранное пространство', () => {
    const state = emptyState()
    state.activeSpaceId = state.spaces[0].id
    state.spaces[0].activeSession = { tabs: [tab], activeTabId: tab.id }
    const result = savePageToDestination(state, tab, request)
    const stored = migrateState(applyChanges(state, diffState(state, result.state)))
    const web = stored.spaces.find(space => space.kind === 'web')!
    expect(web.bookmarkGroups).toEqual([{ id: expect.any(String), name: 'Рабочее' }])
    expect(web.resources[0]).toMatchObject({ target: tab.url, bookmarkGroupId: web.bookmarkGroups![0].id })
    expect(stored.activeSpaceId).toBe(state.activeSpaceId)
    expect(stored.spaces[0].activeSession!.tabs[0]).toMatchObject(tab)
    expect(state.spaces).toHaveLength(1)
    expect(defaultBookmarkDestination(stored)).toEqual(stored.lastBookmarkDestination)
  })

  it('повторное сохранение не дублирует группу и ссылку; в другое место сохраняет отдельный ресурс', () => {
    const first = savePageToDestination(emptyState(), tab, request)
    const second = savePageToDestination(first.state, tab, { ...request, newGroupName: ' рабочее ' })
    expect(second.alreadySaved).toBe(true)
    expect(second.resource.id).toBe(first.resource.id)
    expect(second.state.spaces.find(space => space.kind === 'web')!.bookmarkGroups).toHaveLength(1)
    const third = savePageToDestination(second.state, tab, { name: 'Полезный материал', destination: { spaceId: second.state.spaces[0].id } })
    expect(third.state.spaces[0].resources[0].name).toBe('Полезный материал')
    expect(third.resource.id).not.toBe(first.resource.id)
    expect(third.state.spaces.find(space => space.kind === 'web')!.resources).toHaveLength(1)
  })

  it('не пишет в архив или исчезнувшую группу и не сохраняет исполняемый URL', () => {
    const state = emptyState()
    state.spaces[0].archivedAt = '2026-10-02T10:00:00Z'
    expect(() => savePageToDestination(state, tab, { ...request, destination: { spaceId: state.spaces[0].id } })).toThrow('недоступно')
    expect(() => savePageToDestination(state, tab, { name: tab.title, destination: { spaceId: BOOKMARKS, groupId: 'missing' } })).toThrow('Группа')
    expect(() => savePageToDestination(state, { ...tab, url: 'javascript:alert(1)' }, request)).toThrow('HTTP')
    state.lastBookmarkDestination = { spaceId: state.spaces[0].id }
    expect(defaultBookmarkDestination(state)).toEqual({ spaceId: BOOKMARKS })
  })

  it('изменения существующих групп применяются по идентификатору, сохраняя параллельное добавление', () => {
    const first = savePageToDestination(emptyState(), tab, request).state
    const second = savePageToDestination(first, { ...tab, url: 'https://example.com/new' }, { ...request, newGroupName: 'Почитать' }).state
    const third = savePageToDestination(first, { ...tab, url: 'https://example.com/other' }, { ...request, newGroupName: 'Справка' }).state
    const merged = applyChanges(third, diffState(first, second))
    expect(merged.spaces.find(space => space.kind === 'web')!.bookmarkGroups!.map(group => group.name).sort()).toEqual(['Почитать', 'Рабочее', 'Справка'])
    expect(merged.spaces.find(space => space.kind === 'web')!.resources).toHaveLength(3)
  })
})

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
describe('панель сохранения страницы', () => {
  it('готова к Enter, блокирует повторный запрос и сохраняет выбор при ошибке', async () => {
    document.body.innerHTML = '<div id="test-root"></div>'
    const root = createRoot(document.getElementById('test-root')!)
    let finish!: (saved: boolean) => void
    const onSave = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve }))
    const onClose = vi.fn()
    try {
      await act(async () => root.render(<SavePageDialog state={emptyState()} tab={tab} onSave={onSave} onClose={onClose} />))
      expect(document.activeElement?.textContent).toContain('Сохранить')
      const submit = () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await act(async () => { submit(); submit() })
      expect(onSave).toHaveBeenCalledExactlyOnceWith({ destination: { spaceId: BOOKMARKS }, name: tab.title })
      await act(async () => finish(false))
      expect(document.querySelector('[role="alert"]')?.textContent).toContain('Не удалось сохранить')
      expect(document.querySelector<HTMLInputElement>('input')!.value).toBe(tab.title)
      expect(onClose).not.toHaveBeenCalled()
      await act(async () => submit())
      await act(async () => finish(true))
      expect(onClose).toHaveBeenCalledOnce()
    } finally { await act(async () => root.unmount()) }
  })
})
