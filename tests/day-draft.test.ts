import { describe, expect, it } from 'vitest'
import { emptyState, migrateState } from '../shared/state'
import { dayKey, dayLabel, ensureDayDraft, pastDays, promoteDayDraft, todayDraft, TODAY_NAME } from '../src/dayDraft'
import type { AppState } from '../src/types'

const at = (iso: string) => new Date(iso)
const morning = at('2026-10-27T09:00:00')

describe('черновик дня «Сегодня»', () => {
  it('граница дня — 04:00: ночью ещё вчерашний день', () => {
    expect(dayKey(at('2026-10-27T03:59:00'))).toBe('2026-10-26')
    expect(dayKey(at('2026-10-27T04:00:00'))).toBe('2026-10-27')
    expect(dayLabel('2026-10-27')).toBe('Вторник, 27 октября')
  })

  it('новый пользователь начинает с «Сегодня», а не с пустого «Моего пространства»', () => {
    const state = ensureDayDraft(migrateState(emptyState()), morning)
    expect(state.spaces.map(space => space.name)).toEqual([TODAY_NAME])
    expect(state.activeSpaceId).toBe(todayDraft(state, morning)!.id)
    expect(ensureDayDraft(state, morning)).toBe(state)
  })

  it('утром вчерашние вкладки уходят в прошлые дни, закреплённые и защищённые переходят в новый день', () => {
    let state: AppState = ensureDayDraft(migrateState({ ...emptyState(), spaces: [{ id: 'work', name: 'Работа', tone: 'sage', resources: [{ id: 'f', name: 'a.docx', kind: 'file', target: 'C:/a.docx', createdAt: '2026-01-01' }] }] }), at('2026-10-26T10:00:00'))
    const yesterday = todayDraft(state, at('2026-10-26T10:00:00'))!
    state = { ...state, spaces: state.spaces.map(space => space.id !== yesterday.id ? space : { ...space, activeSession: { activeTabId: 'a', tabs: [
      { id: 'a', title: 'Новость', url: 'https://news.example/', contextId: `${space.id}:context` },
      { id: 'p', title: 'Почта', url: 'https://mail.example/', pinned: true, contextId: `${space.id}:context` },
      { id: 'f', title: 'Форма', url: 'https://form.example/', protected: true, contextId: `${space.id}:context` }
    ] } }) }
    const next = ensureDayDraft(state, morning)
    const today = todayDraft(next, morning)!
    expect(today.name).toBe(TODAY_NAME)
    expect(today.activeSession!.tabs.map(tab => tab.id)).toEqual(['p', 'f'])
    expect(today.activeSession!.tabs.every(tab => tab.contextId === `${today.id}:context`)).toBe(true)
    const past = pastDays(next, morning)
    expect(past.map(space => space.name)).toEqual(['Понедельник, 26 октября'])
    expect(past[0].activeSession!.tabs.map(tab => tab.id)).toEqual(['a'])
    expect(next.spaces.find(space => space.id === 'work')).toBe(state.spaces.find(space => space.id === 'work'))
  })

  it('пустой вчерашний черновик не становится прошлым днём; прошлые дни старше 14 дней забываются', () => {
    const old = migrateState({ ...emptyState(), spaces: [
      { id: 'day-2026-10-10', name: 'Суббота, 10 октября', nameOrigin: 'manual', kind: 'day', day: '2026-10-10', dayRetired: true, tone: 'sage', resources: [], activeSession: { tabs: [{ id: 'x', title: 'x', url: 'https://x.example/' }], activeTabId: 'x' } },
      { id: 'day-2026-10-20', name: 'Вторник, 20 октября', nameOrigin: 'manual', kind: 'day', day: '2026-10-20', dayRetired: true, tone: 'sage', resources: [], activeSession: { tabs: [{ id: 'y', title: 'y', url: 'https://y.example/' }], activeTabId: 'y' } },
      { id: 'day-2026-10-26', name: TODAY_NAME, nameOrigin: 'manual', kind: 'day', day: '2026-10-26', tone: 'sage', resources: [] }
    ] })
    const next = ensureDayDraft(old, morning)
    expect(pastDays(next, morning).map(space => space.day)).toEqual(['2026-10-20'])
    expect(todayDraft(next, morning)).toBeTruthy()
  })

  it('«Сделать пространством» даёт имя по содержимому и открывает новый чистый «Сегодня»', () => {
    let state = ensureDayDraft(migrateState(emptyState()), morning)
    const draft = todayDraft(state, morning)!
    state = { ...state, spaces: state.spaces.map(space => space.id !== draft.id ? space : { ...space, activeSession: { activeTabId: 't', tabs: [{ id: 't', title: 'Главная — макеты v3', url: 'https://figma.example/', contextId: `${space.id}:context` }] } }) }
    const next = promoteDayDraft(state, draft.id, morning)
    const promoted = next.spaces.find(space => space.id === draft.id)!
    expect(promoted).toMatchObject({ name: 'Главная — макеты v3', nameOrigin: 'suggested' })
    expect(promoted.kind).toBeUndefined()
    expect(promoted.day).toBeUndefined()
    const fresh = todayDraft(next, morning)!
    expect(fresh.id).not.toBe(draft.id)
    expect(fresh.activeSession!.tabs).toEqual([])
    expect(promoteDayDraft(next, fresh.id, morning, 'Ремонт кухни').spaces.find(space => space.id === fresh.id)).toMatchObject({ name: 'Ремонт кухни', nameOrigin: 'manual' })
  })
})
