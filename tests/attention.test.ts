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
