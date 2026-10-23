import { describe, expect, it } from 'vitest'
import { applyChanges, diffState, emptyState, migrateState } from '../shared/state'
import { parseCapture } from '../src/reminders'
import { postponeReminder, remindersForDay, rescheduleTaskToToday } from '../src/dayModel'
import { saveCheckpoint } from '../src/checkpoints'
import type { AppState } from '../src/types'

const now = new Date(2026, 8, 27, 22, 15)
describe('данные и планирование', () => {
  it('мигрирует напоминание и checkpoint, сохраняя отметку уведомления', () => {
    const old: AppState = { ...emptyState(), version: 1, reminders: [{ id: 'r', title: 'Заказ', createdAt: now.toISOString(), dueAt: now.toISOString(), done: false, notifiedAt: now.toISOString() }], checkpoint: { spaceId: 'first-space', note: 'Заметка', nextStep: 'Сравнить', savedAt: now.toISOString() } }
    const value = migrateState(old)
    expect(value.version).toBe(2)
    expect(value.reminders[0].notifiedAt).toBe(old.reminders[0].notifiedAt)
    expect(value.spaces[0].checkpoint?.nextStep).toBe('Сравнить')
    expect(value.checkpoint).toBeUndefined()
    expect(migrateState(value)).toEqual(value)
  })
  it('отказывается заменять повреждённые данные пустыми', () => expect(() => migrateState({ version: 1 })).toThrow())
  it('не теряет фоновое уведомление при сохранении отредактированной задачи', () => {
    const original = { ...emptyState(), reminders: [{ id: 'r', title: 'До', createdAt: now.toISOString(), dueAt: now.toISOString(), done: false }] }
    const edited = structuredClone(original)
    edited.reminders[0].title = 'После'
    const notified = applyChanges(original, [{ op: 'set', path: ['reminders', '@r', 'notifiedAt'], value: now.toISOString() }])
    const saved = applyChanges(notified, diffState(original, edited))
    expect(saved.reminders[0]).toMatchObject({ title: 'После', notifiedAt: now.toISOString() })
  })
  it('не возвращает удалённую другим окном задачу', () => {
    const original = { ...emptyState(), reminders: [{ id: 'r', title: 'До', createdAt: now.toISOString(), dueAt: null, done: false }] }
    const edited = structuredClone(original); edited.reminders[0].title = 'После'
    const deleted = applyChanges(original, [{ op: 'remove', path: ['reminders', '@r'] }])
    expect(applyChanges(deleted, diffState(original, edited)).reminders).toEqual([])
  })
  it('сохраняет параллельно добавленную вкладку при изменении порядка', () => {
    const original = emptyState(); original.spaces[0].resources = [{ id: 'a', kind: 'link', name: 'A', target: 'https://a.test', createdAt: now.toISOString() }]
    const changed = structuredClone(original); changed.spaces[0].resources.unshift({ ...changed.spaces[0].resources[0], id: 'b' })
    const concurrent = structuredClone(original); concurrent.spaces[0].resources.push({ ...concurrent.spaces[0].resources[0], id: 'c' })
    expect(applyChanges(concurrent, diffState(original, changed)).spaces[0].resources.map(item => item.id)).toEqual(['b', 'a', 'c'])
  })
  it('дата без времени не создаёт напоминание', () => expect(parseCapture('Завтра забрать заказ', now)).toEqual({ title: 'забрать заказ', plannedDate: '2026-09-28', dueAt: null, kind: 'task' }))
  it('разбирает дату и время независимо', () => {
    const value = parseCapture('Завтра в 18 забрать заказ', now)
    expect(value.plannedDate).toBe('2026-09-28')
    expect(new Date(value.dueAt!).getHours()).toBe(18)
    expect(value.title).toBe('забрать заказ')
  })
  it('сохраняет исходный текст при неверной дате или интервале', () => {
    expect(parseCapture('31.02.2026 забрать заказ', now).title).toBe('31.02.2026 забрать заказ')
    expect(parseCapture('через 0 минут позвонить', now).dueAt).toBeNull()
  })
  it('через час переходит через полночь', () => expect(parseCapture('через 3 часа позвонить', now).plannedDate).toBe('2026-09-28'))
  it('разбирает предлог к и очищает оговорки напомни', () => {
    // В 22:15 время 10:00 переносится на завтра
    const v1 = parseCapture('к 10 в поликлинику', now)
    expect(v1.title).toBe('в поликлинику')
    expect(v1.plannedDate).toBe('2026-09-28')
    expect(new Date(v1.dueAt!).getHours()).toBe(10)

    const v2 = parseCapture('В напомни к 10 к врачу', now)
    expect(v2.title).toBe('к врачу')
    expect(v2.plannedDate).toBe('2026-09-28')
    expect(new Date(v2.dueAt!).getHours()).toBe(10)

    const v3 = parseCapture('завтра к 15 часам отчет', now)
    expect(v3.title).toBe('отчет')
    expect(v3.plannedDate).toBe('2026-09-28')
    expect(new Date(v3.dueAt!).getHours()).toBe(15)
  })
  it('включает в план дня задачу с dueAt даже при plannedDate null', () => {
    const todayTask = { id: 'r', title: 'Дело', createdAt: now.toISOString(), dueAt: '2026-09-27T10:00:00.000Z', plannedDate: null, done: false }
    expect(remindersForDay({ ...emptyState(), reminders: [todayTask] }, new Date(2026, 8, 27))).toHaveLength(1)
  })
  it('переносит просроченное дело на сегодня, сохраняя время и сбрасывая уведомление', () => {
    const overdueTask = { id: 'r', title: 'Врач', createdAt: new Date(2026, 8, 26, 8, 0).toISOString(), dueAt: new Date(2026, 8, 26, 10, 0).toISOString(), plannedDate: '2026-09-26', done: false, notifiedAt: '2026-09-26T10:00:00.000Z' }
    const today = new Date(2026, 8, 27, 8, 30)
    const rescheduled = rescheduleTaskToToday(overdueTask, today)
    expect(rescheduled.plannedDate).toBe('2026-09-27')
    expect(new Date(rescheduled.dueAt!).getHours()).toBe(10)
    expect(new Date(rescheduled.dueAt!).getDate()).toBe(27)
    expect(rescheduled.notifiedAt).toBeUndefined()
  })
  it('переносит день, сохраняя срок и отсутствие таймера', () => {
    const task = { id: 'r', title: 'Текст', createdAt: now.toISOString(), dueAt: null, plannedDate: '2026-09-27', deadline: '2026-09-30', done: false }
    const next = postponeReminder(task, 'tomorrow', now)
    expect(next).toMatchObject({ plannedDate: '2026-09-28', dueAt: null, deadline: '2026-09-30' })
    expect(remindersForDay({ ...emptyState(), reminders: [next] }, new Date(2026, 8, 28))).toHaveLength(1)
  })
  it('хранит разные точки продолжения без обязательной заметки', () => {
    const initial = emptyState(); initial.spaces.push({ id: 'second', name: 'Поездка', tone: 'sand', resources: [] })
    const value = saveCheckpoint(saveCheckpoint(initial, 'first-space', { nextStep: 'Макет' }, now), 'second', {}, now)
    expect(value.spaces[0].checkpoint?.nextStep).toBe('Макет')
    expect(value.spaces[1].checkpoint?.note).toBe('')
    expect(value.spaces[1].checkpointHistory).toHaveLength(1)
  })
  it('корректно сохраняет и изменяет фоновое изображение в состоянии', () => {
    const initial = emptyState()
    const updated = { ...initial, backgroundImage: '/backgrounds/abstract-hills.jpg' }
    const changes = diffState(initial, updated)
    expect(changes).toEqual([{ op: 'set', path: ['backgroundImage'], value: '/backgrounds/abstract-hills.jpg' }])
    const applied = applyChanges(initial, changes)
    expect(applied.backgroundImage).toBe('/backgrounds/abstract-hills.jpg')
  })
})
