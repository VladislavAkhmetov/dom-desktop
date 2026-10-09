import { describe, expect, it } from 'vitest'
import type { AppState, Resource } from '../src/types'
import { cabinetFromTabs, copyMaterial, newCabinet, suggestInitialName, upgradeCabinets } from '../src/cabinetModel'
import { contextSession, currentContext } from '../src/workContexts'

const file: Resource = { id: 'file', kind: 'file', name: 'Логотип.ai', target: 'D:\\Design\\Logo.ai', createdAt: '2026-10-07T10:00:00Z' }
function legacy(): AppState {
  return { version: 2, reminders: [{ id: 'reminder', title: 'Позвонить', createdAt: file.createdAt, dueAt: null, done: false, spaceId: 'work' }], dismissedUntil: null, activeSpaceId: 'work', spaces: [{
    id: 'work', name: 'Работа', tone: 'sage', resources: [file, { ...file, id: 'reference', kind: 'link', name: 'Референс', target: 'https://ref.test/' }], activeContextId: 'logo',
    workContexts: [{ id: 'logo', title: 'Обновить логотип', documentIds: ['file', 'unavailable'], activeTabId: 'logo-tab' }, { id: 'talk', title: 'Презентация', documentIds: ['file'], activeTabId: 'talk-tab' }],
    activeSession: { tabs: [{ id: 'logo-tab', contextId: 'logo', title: 'Референс', url: 'https://ref.test/', protected: true, scrollY: 140 }, { id: 'talk-tab', contextId: 'talk', title: 'Слайды', url: 'https://slides.test/' }, { id: 'orphan', title: 'Статья', url: 'https://article.test/' }, { id: 'unknown', contextId: 'removed-context', title: 'Инструмент', url: 'https://tool.test/' }], activeTabId: 'logo-tab', splitTabId: 'orphan', closedTabs: [{ id: 'closed', title: 'Закрытая', url: 'https://closed.test/' }] },
    checkpointHistory: [{ id: 'old', spaceId: 'work', contextId: 'removed-context', note: 'Не потерять', nextStep: '', savedAt: file.createdAt }]
  }] }
}

describe('переход к пространствам-кабинетам', () => {
  it('копирует данные, сохраняет все живые/закрытые вкладки, защиту, позицию и осиротевшую историю', () => {
    const source = legacy(), before = structuredClone(source)
    const result = upgradeCabinets(source)
    expect(source).toEqual(before)
    expect(result.spaces.map(space => space.name)).toEqual(['Обновить логотип', 'Презентация'])
    expect(result.spaces.flatMap(space => space.activeSession!.tabs.map(tab => tab.id)).sort()).toEqual(['logo-tab', 'orphan', 'talk-tab', 'unknown'])
    expect(contextSession(result.spaces[0])).toMatchObject({ activeTabId: 'logo-tab', splitTabId: 'orphan', closedTabs: [{ id: 'closed', contextId: 'logo' }] })
    expect(result.spaces[0].activeSession!.tabs[0]).toMatchObject({ protected: true, scrollY: 140 })
    expect(result.spaces[0].checkpointHistory![0].note).toBe('Не потерять')
    expect(currentContext(result.spaces[0]).documentIds).toContain('unavailable')
    expect(result.activeSpaceId).toBe('work')
    expect(result.reminders[0].spaceId).toBe('work')
  })
  it('даёт общим материалам независимые идентификаторы и повторно не разбивает пространства', () => {
    const result = upgradeCabinets(legacy())
    expect(result.spaces[1].resources[0].target).toBe(file.target)
    expect(result.spaces[1].resources[0].id).not.toBe(file.id)
    expect(currentContext(result.spaces[1]).documentIds).toContain(result.spaces[1].resources[0].id)
    expect(upgradeCabinets(result)).toBe(result)
  })
  it('не воскрешает закрытую вкладку из старого снимка и переводит завершённое дело в обратимый архив', () => {
    const source = legacy()
    source.spaces[0].workContexts![1].completedAt = file.createdAt
    source.spaces[0].workContexts![0].checkpoint = { id: 'cp', spaceId: 'work', contextId: 'logo', note: '', nextStep: 'Продолжить', savedAt: file.createdAt, session: { tabs: [{ id: 'obsolete', title: 'Старая', url: 'https://obsolete.test/' }], activeTabId: 'obsolete' } }
    const result = upgradeCabinets(source)
    expect(result.spaces.flatMap(space => space.activeSession!.tabs).some(tab => tab.id === 'obsolete')).toBe(false)
    expect(result.spaces[1].archivedAt).toBe(file.createdAt)
    expect(currentContext(result.spaces[1]).completedAt).toBeUndefined()
    expect(result.spaces[0].checkpoint!.session!.tabs[0].id).toBe('obsolete')
  })
  it('избегает столкновения идентификаторов с уже существующим пространством', () => {
    const source = legacy()
    source.spaces.push({ id: 'work:cabinet:talk', name: 'Уже существует', tone: 'blue', resources: [] })
    const result = upgradeCabinets(source)
    expect(new Set(result.spaces.map(space => space.id)).size).toBe(result.spaces.length)
  })
  it('сохраняет 300 вкладок при разделении старого пространства на десять кабинетов', () => {
    const source = legacy(), space = source.spaces[0]
    space.workContexts = Array.from({ length: 10 }, (_, index) => ({ id: `context-${index}`, title: `Проект ${index + 1}`, documentIds: [], activeTabId: `tab-${index * 30}` }))
    space.activeContextId = 'context-0'
    space.activeSession = { tabs: Array.from({ length: 300 }, (_, index) => ({ id: `tab-${index}`, contextId: `context-${Math.floor(index / 30)}`, title: `Материал ${index + 1}`, url: `https://ref.test/${index}`, scrollY: index })), activeTabId: 'tab-0' }
    const result = upgradeCabinets(source)
    const tabs = result.spaces.flatMap(space => contextSession(space).tabs)
    expect(result.spaces).toHaveLength(10)
    expect(tabs).toHaveLength(300)
    expect(new Set(tabs.map(tab => tab.id)).size).toBe(300)
    expect(tabs.find(tab => tab.id === 'tab-299')!.scrollY).toBe(299)
  })
})

describe('работа с кабинетом', () => {
  it('создаёт одну чистую вкладку и не меняет предыдущую работу', () => {
    const source = upgradeCabinets(legacy()), before = structuredClone(source.spaces)
    const result = newCabinet(source, 'new', 'empty-tab', 'blue')
    expect(result.spaces.slice(0, -1)).toEqual(before)
    expect(contextSession(result.spaces.at(-1)!)).toMatchObject({ tabs: [{ id: 'empty-tab', url: '' }], activeTabId: 'empty-tab' })
    expect(result.activeSpaceId).toBe('new')
    expect(result.spaces.at(-1)!.pinned).toBe(false)
    expect(newCabinet(result, 'new2', 'empty2', 'sage').spaces.at(-1)!.name).toBe('Новое пространство 2')
  })
  it('предлагает имя однажды и сохраняет его при новых вкладках и ручном переименовании', () => {
    const space = newCabinet(upgradeCabinets(legacy()), 'new', 'tab', 'blue').spaces.at(-1)!
    space.activeSession!.tabs[0] = { ...space.activeSession!.tabs[0], title: 'План презентации', url: 'https://slides.test/' }
    const named = suggestInitialName(space)
    expect(named.name).toBe('План презентации')
    const changed = { ...named, resources: [{ ...file, name: 'Другой материал' }] }
    expect(suggestInitialName(changed).name).toBe('План презентации')
    expect(suggestInitialName({ ...changed, name: 'Моё название', nameOrigin: 'manual' }).name).toBe('Моё название')
    expect(suggestInitialName({ ...space, activeSession: { tabs: [], activeTabId: '' }, resources: [file] }).name).toBe('Логотип')
  })
  it('выделяет только выбранные вкладки, сохраняя их свойства и исходную библиотеку', () => {
    const source = upgradeCabinets(legacy())
    const result = cabinetFromTabs(source, 'work', ['logo-tab'], 'split', 'lilac')
    expect(result.spaces.find(space => space.id === 'work')!.activeSession!.tabs.map(tab => tab.id)).toEqual(['orphan', 'unknown'])
    expect(result.spaces.at(-1)!.activeSession!.tabs[0]).toMatchObject({ id: 'logo-tab', protected: true, scrollY: 140 })
    expect(result.spaces[0].resources).toEqual(source.spaces[0].resources)
    expect(result.spaces.at(-1)!.resources).toHaveLength(1)
    expect(result.spaces.at(-1)!.resources[0].target).toBe('https://ref.test/')
    expect(result.spaces.at(-1)!.resources[0].id).not.toBe('reference')
  })
  it('сохраняет общий документ в двух кабинетах без дублей, в том числе Windows-путей разного регистра', () => {
    const source = newCabinet(upgradeCabinets(legacy()), 'new', 'tab', 'blue')
    const result = copyMaterial(source, file, 'new', 'copy')
    expect(result.spaces[0].resources[0]).toEqual(file)
    expect(result.spaces.at(-1)!.resources[0]).toMatchObject({ id: 'copy', target: file.target })
    expect(copyMaterial(result, { ...file, target: 'd:/design/logo.ai' }, 'new', 'duplicate')).toBe(result)
    expect(copyMaterial(result, file, 'missing', 'copy2')).toBe(result)
  })
})
