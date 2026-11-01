import { describe, expect, it } from 'vitest'
import type { AppState } from '../src/types'
import { glanceTab, isGlanceVisible, keepGlance, type Glance } from '../src/browser/glance'
import { contextSession } from '../src/workContexts'

const glance: Glance = { id: 'glance-1', spaceId: 'work', parentTabId: 'brief', url: 'https://example.com/read', title: 'Статья', favicon: 'https://example.com/f.ico' }
function fixture(): AppState {
  return { version: 2, dismissedUntil: null, reminders: [], spaces: [{ id: 'work', name: 'Работа', tone: 'sage', resources: [],
    activeSession: { tabs: [
      { id: 'brief', title: 'Бриф', url: 'https://brief.test/', branchId: 'branch' },
      { id: 'other', title: 'Другое', url: 'https://other.test/' }
    ], activeTabId: 'brief', splitTabId: 'other' } }] }
}

describe('Заглянуть', () => {
  it('показывается только рядом со страницей, из которой открыта', () => {
    const view = { open: true, spaceId: 'work', activeTabId: 'brief' }
    expect(isGlanceVisible(glance, view)).toBe(true)
    expect(isGlanceVisible(glance, { ...view, activeTabId: 'other' })).toBe(false)
    expect(isGlanceVisible(glance, { ...view, activeTabId: 'other', splitTabId: 'brief' })).toBe(true)
    expect(isGlanceVisible(glance, { ...view, spaceId: 'home' })).toBe(false)
    expect(isGlanceVisible(glance, { ...view, open: false })).toBe(false)
    expect(isGlanceVisible(null, view)).toBe(false)
  })

  it('«Оставить вкладкой» ставит ту же страницу сразу после исходной, делает активной и не трогает остальное', () => {
    const before = fixture()
    const kept = keepGlance(before, glance, '2026-10-30T12:00:00.000Z')
    const session = contextSession(kept.spaces[0])
    expect(session.tabs.map(tab => tab.id)).toEqual(['brief', 'glance-1', 'other'])
    expect(session.activeTabId).toBe('glance-1')
    expect(session.splitTabId).toBeNull()
    expect(session.tabs[1]).toMatchObject({ id: 'glance-1', url: glance.url, title: 'Статья', parentTabId: 'brief', branchId: 'branch', lastActiveAt: '2026-10-30T12:00:00.000Z' })
    expect(kept.activeSpaceId).toBe('work')
    expect(before.spaces[0].activeSession!.tabs).toHaveLength(2)
  })

  it('повторное сохранение не дублирует вкладку, а пропавшее пространство оставляет состояние как есть', () => {
    const once = keepGlance(fixture(), glance)
    expect(contextSession(keepGlance(once, glance).spaces[0]).tabs).toHaveLength(3)
    const state = fixture()
    expect(keepGlance(state, { ...glance, spaceId: 'gone' })).toBe(state)
  })

  it('временная вкладка для страницы берёт заголовок из адреса, пока его нет', () => {
    expect(glanceTab({ ...glance, title: '' }).title).toBe(glance.url)
    expect(glanceTab(glance)).toMatchObject({ id: 'glance-1', url: glance.url, parentTabId: 'brief' })
  })
})
