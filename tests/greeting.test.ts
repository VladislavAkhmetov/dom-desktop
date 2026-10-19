import { describe, expect, it } from 'vitest'
import { emptyState } from '../shared/state'
import { selectGreeting } from '../src/greetingModel'
import type { AppState } from '../src/types'

describe('greetingModel', () => {
  it('формирует ночное приветствие с именем пользователя и действием тихого фокуса', () => {
    const state: AppState = {
      ...emptyState(),
      userProfile: { name: 'Vlad', avatarTone: 'sage', status: '' }
    }
    const night = new Date(2026, 9, 12, 23, 35)
    const result = selectGreeting(state, night)
    expect(result.text).toBe('Засиделись допоздна, Vlad?')
    expect(result.action?.type).toBe('focus')
    expect(result.action?.label).toBe('Тихий фокус')
  })

  it('формирует ночное приветствие без имени, если профиль по умолчанию', () => {
    const state: AppState = emptyState()
    const midnight = new Date(2026, 9, 13, 1, 15)
    const result = selectGreeting(state, midnight)
    expect(result.text).toBe('Засиделись допоздна?')
  })

  it('подмечает незавершённые дела с прошлых дней', () => {
    const state: AppState = {
      ...emptyState(),
      reminders: [
        {
          id: 'old-1',
          title: 'Старый черновик',
          createdAt: '2026-10-10T10:00:00.000Z',
          plannedDate: '2026-10-10',
          kind: 'task',
          done: false
        }
      ]
    }
    const day = new Date(2026, 9, 12, 14, 0)
    const result = selectGreeting(state, day)
    expect(result.text).toBe('Осталась 1 мысль с прошлых дней')
    expect(result.action?.type).toBe('day')
  })

  it('сообщает о чистом листе, если на сегодня нет дел', () => {
    const state: AppState = emptyState()
    const day = new Date(2026, 9, 12, 15, 0)
    const result = selectGreeting(state, day)
    expect(result.text).toBe('На этот день нет дел — чистый лист')
    expect(result.action?.label).toBe('Добавить дело')
  })

  it('хвалит за все закрытые дела, если завершённые были', () => {
    const state: AppState = {
      ...emptyState(),
      reminders: [
        {
          id: 'done-1',
          title: 'Отчёт',
          createdAt: '2026-10-12T09:00:00.000Z',
          plannedDate: '2026-10-12',
          kind: 'task',
          done: true
        }
      ]
    }
    const day = new Date(2026, 9, 12, 16, 0)
    const result = selectGreeting(state, day)
    expect(result.text).toBe('Все дела закрыты. Отличная работа.')
  })

  it('здоровается утром с именем при наличии задач', () => {
    const state: AppState = {
      ...emptyState(),
      userProfile: { name: 'Влад', avatarTone: 'sage', status: '' },
      reminders: [
        {
          id: 't-1',
          title: 'Встреча',
          createdAt: '2026-10-12T09:00:00.000Z',
          plannedDate: '2026-10-12',
          kind: 'task',
          done: false
        }
      ]
    }
    const morning = new Date(2026, 9, 12, 9, 30)
    const result = selectGreeting(state, morning)
    expect(result.text).toBe('Доброе утро, Влад.')
  })
})
