import { expect, it } from 'vitest'
import { emptyState } from '../shared/state'
import { attentionLine, selectAttention, selectAttentionSignal } from '../src/attentionModel'
import { mailIsImportant } from '../src/mailModel'
const now = new Date('2026-09-27T12:00:00Z')
const focus = { status: 'running', remainingSeconds: 1250 }
it('напоминание имеет приоритет над фокусом', () => {
  const state = emptyState(); state.reminders.push({ id: 'r', title: 'Заказ', createdAt: now.toISOString(), dueAt: now.toISOString(), done: false })
  expect(selectAttention(state, now, focus)?.type).toBe('task')
  state.reminders[0].done = true
  expect(selectAttention(state, now, focus)?.type).toBe('focus')
})
it('не прерывает событием без включённого напоминания', () => {
  const state = emptyState(); state.events = [{ id: 'e', title: 'Встреча', startAt: '2026-09-27T12:05:00Z', endAt: '2026-09-27T13:00:00Z', category: 'meeting' }]
  expect(selectAttention(state, now, focus)?.type).toBe('focus')
  state.events[0].noticeMinutes = 10
  expect(selectAttention(state, now, focus)?.type).toBe('event')
})
it('уважает реакцию пользователя и не возвращает старое напоминание', () => {
  const state = emptyState(); state.reminders = [{ id: 'r', title: 'Заказ', createdAt: now.toISOString(), dueAt: now.toISOString(), done: false }]; state.dismissedNotices = [`task:r:${now.toISOString()}`]
  expect(selectAttention(state, now, { status: 'idle', remainingSeconds: 0 })).toBeNull()
})
it('снятое правило отправителя перестаёт считать письмо важным', () => {
  const state = emptyState(); state.mailAccounts = [{ id: 'a', email: 'me@example.com', importantSenders: ['team@example.com'] }]
  const message = { id: 'mail', accountId: 'a', gmailId: 'm', threadId: 't', from: 'team@example.com', subject: 'Макет', snippet: 'Текст', receivedAt: now.toISOString(), unread: true, important: true, gmailImportant: false, url: 'https://example.com' }
  expect(mailIsImportant(state, message)).toBe(true)
  state.mailAccounts[0].importantSenders = []
  expect(mailIsImportant(state, message)).toBe(false)
  expect(mailIsImportant(state, { ...message, gmailImportant: true })).toBe(true)
})
it('в браузинге фокус и музыка не вытесняют важное письмо', () => {
  const state = emptyState()
  expect(selectAttentionSignal(state, now, focus, { music: 'Lofi Girl' })).toBeNull()
  state.mailMessages = [{ id: 'mail', accountId: 'a', gmailId: 'm', threadId: 't', from: 'Анна <anna@example.com>', subject: 'Согласован макет', snippet: 'Можно отправлять', receivedAt: now.toISOString(), unread: true, important: true, gmailImportant: true, url: 'https://mail.google.com/' }]
  const signal = selectAttentionSignal(state, now, focus, { music: 'Lofi Girl' })
  expect(signal?.type).toBe('mail')
  expect(attentionLine(signal, state.mailMessages[0].from)).toBe('Анна · Согласован макет')
  expect(selectAttentionSignal(state, now, focus, { ambient: true })?.type).toBe('focus')
})
it('сигнал ИИ появляется по завершении, учитывает скрытие и срок актуальности', () => {
  const state = emptyState(), idle = { ...focus, status: 'idle' }
  state.aiJournal = [{ id: 'answer', at: now.toISOString(), model: 'Модель', sources: [], status: 'running' }]
  expect(selectAttentionSignal(state, now, idle)).toBeNull()
  state.aiJournal[0].status = 'done'
  expect(selectAttentionSignal(state, now, idle)?.title).toBe('Ответ готов')
  state.dismissedNotices = ['activity:answer']
  expect(selectAttentionSignal(state, now, idle)).toBeNull()
  state.dismissedNotices = []
  expect(selectAttentionSignal(state, new Date(now.getTime() + 6 * 60000), idle)).toBeNull()
})
it('сигнал обновления появляется с самым низким приоритетом после напоминаний, встреч и фокуса', () => {
  const state = emptyState()
  const idle = { status: 'idle', remainingSeconds: 0 }
  const update = { version: '0.0.2' }

  // Сигнал обновления виден, когда нет других сигналов
  const signal = selectAttentionSignal(state, now, idle, { update })
  expect(signal?.type).toBe('update')
  expect(signal?.title).toBe('Доступно обновление dombro')
  expect(signal?.label).toBe('Перезапустить при выходе')
  expect(attentionLine(signal)).toBe('Доступно обновление dombro · Перезапустить при выходе')

  // Напоминание вытесняет сигнал обновления
  state.reminders = [{ id: 'r', title: 'Заказ', createdAt: now.toISOString(), dueAt: now.toISOString(), done: false }]
  expect(selectAttentionSignal(state, now, idle, { update })?.type).toBe('task')

  // Фокус вытесняет сигнал обновления
  state.reminders = []
  expect(selectAttentionSignal(state, now, { status: 'running', remainingSeconds: 500 }, { ambient: true, update })?.type).toBe('focus')

  // Скрытие пользователем предотвращает показ сигнала
  state.dismissedNotices = ['update:0.0.2']
  expect(selectAttentionSignal(state, now, idle, { update })).toBeNull()
})

it('динамический остров выдает мягкое предупреждение за 15 минут до срока задачи', () => {
  const state = emptyState()
  const idle = { status: 'idle', remainingSeconds: 0 }
  const in10min = new Date(now.getTime() + 10 * 60_000).toISOString()
  state.reminders = [{ id: 'task-pill', title: 'Принять витамины', createdAt: now.toISOString(), dueAt: in10min, done: false }]

  const signal = selectAttention(state, now, idle)
  expect(signal?.type).toBe('task')
  expect(signal?.title).toBe('Принять витамины')
  expect(signal?.label).toBe('Через 10 мин')
  expect(signal?.id).toBe(`task:task-pill:${in10min}:soon`)
  expect(attentionLine(signal)).toBe('Через 10 мин · Принять витамины')

  // Скрытие мягкого предупреждения скрывает его сейчас, но не блокирует наступление точного срока
  state.dismissedNotices = [`task:task-pill:${in10min}:soon`]
  expect(selectAttention(state, now, idle)).toBeNull()

  // При наступлении точного срока срабатывает основное напоминание "Сейчас"
  const exactTime = new Date(now.getTime() + 10 * 60_000)
  const exactSignal = selectAttention(state, exactTime, idle)
  expect(exactSignal?.type).toBe('task')
  expect(exactSignal?.label).toBe('Сейчас')
  expect(exactSignal?.id).toBe(`task:task-pill:${in10min}`)
  expect(attentionLine(exactSignal)).toBe('Сейчас · Принять витамины')
})

it('напоминание Сейчас имеет приоритет над приближающейся задачей Через 10 мин', () => {
  const state = emptyState()
  const idle = { status: 'idle', remainingSeconds: 0 }
  const in10min = new Date(now.getTime() + 10 * 60_000).toISOString()
  state.reminders = [
    { id: 't-future', title: 'Встреча курьера', createdAt: now.toISOString(), dueAt: in10min, done: false },
    { id: 't-now', title: 'Выключить духовку', createdAt: now.toISOString(), dueAt: now.toISOString(), done: false }
  ]
  const signal = selectAttention(state, now, idle)
  expect(signal?.targetId).toBe('t-now')
  expect(signal?.label).toBe('Сейчас')
})
