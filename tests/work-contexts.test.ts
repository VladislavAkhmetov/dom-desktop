import { describe, expect, it, vi } from 'vitest'
import { applyChanges, diffState, migrateState, normalizeSpace } from '../shared/state'
import { saveCheckpoint } from '../src/checkpoints'
import { activateContext, contextDocuments, contextSession, createContext, currentContext, latestContinuation, recordDocumentOpen, updateContextSession } from '../src/workContexts'
import { resumeDocuments } from '../src/resumeContext'
import type { AppState, Resource, Space } from '../src/types'

const before = '2026-09-29T10:00:00Z', after = '2026-09-30T10:00:00Z'
const file: Resource = { id: 'document', name: 'Логотип.ai', kind: 'file', target: 'D:\\Projects\\Логотип.ai', createdAt: before }
const later: Resource = { ...file, id: 'later', name: 'На потом.ai', target: 'D:\\Projects\\На потом.ai' }
function legacy(): Space { return { id: 'work', name: 'Работа', tone: 'sage', resources: [file, later], lastActiveAt: before, activeSession: { tabs: [{ id: 'original', title: 'Бриф', url: 'https://brief.test/', protected: true, scrollY: 180 }], activeTabId: 'original' } } }
function state(space = legacy()): AppState { return { version: 2, spaces: [space], reminders: [], dismissedUntil: null } }

describe('дела и автоматическое сохранение', () => {
  it('переносит старую сессию без смены идентификаторов и не включает все материалы пространства', () => {
    const old = legacy(); old.resources[0] = { ...file, lastOpenedAt: before }
    const next = migrateState(state(old))
    expect(contextSession(next.spaces[0]).tabs[0]).toMatchObject({ id: 'original', protected: true, scrollY: 180 })
    expect(currentContext(next.spaces[0]).documentIds).toEqual(['document'])
    expect(migrateState(next)).toEqual(next)
  })
  it('сохранённый на потом документ сам по себе не создаёт продолжение', () => {
    expect(latestContinuation(state({ ...legacy(), activeSession: undefined, lastActiveAt: undefined }))).toBeUndefined()
    expect(currentContext(normalizeSpace(legacy())).documentIds).toEqual([])
  })
  it('переключает две группы с одинаковым URL, не закрывая или заменяя другую группу', () => {
    const original = normalizeSpace(legacy())
    let next = createContext(original, 'study', 'Учебный проект')
    next = updateContextSession(next, session => ({ ...session, tabs: [{ id: 'study-tab', title: 'Тот же сайт', url: 'https://brief.test/' }], activeTabId: 'study-tab' }), after)
    next = activateContext(next, original.activeContextId!, after)
    expect(contextSession(next).tabs).toEqual(contextSession(original).tabs)
    expect(contextSession(next, 'study').tabs.map(tab => tab.id)).toEqual(['study-tab'])
    expect(next.activeSession?.tabs).toHaveLength(2)
  })
  it('закрытие вкладки в одном деле не закрывает вкладки другого и снимок не возвращает закрытую вкладку', () => {
    let first = normalizeSpace(legacy())
    first = saveCheckpoint(state(first), 'work', {}, new Date(before)).spaces[0]
    const originalId = first.activeContextId!
    let second = createContext(first, 'second', 'Другое дело')
    second = updateContextSession(second, session => ({ ...session, tabs: [{ id: 'other', title: 'Другой бриф', url: 'https://other.test/' }], activeTabId: 'other' }), after)
    second = activateContext(second, originalId)
    second = updateContextSession(second, session => ({ ...session, tabs: [], activeTabId: '', closedTabs: session.tabs }))
    second = activateContext(second, originalId)
    expect(contextSession(second).tabs).toEqual([])
    expect(contextSession(second).closedTabs?.[0].id).toBe('original')
    expect(contextSession(second, 'second').tabs[0].id).toBe('other')
    expect(currentContext(second).checkpoint?.session?.tabs[0].id).toBe('original')
  })
  it('обновление фоновой вкладки сохраняет состояние, не перехватывая последнее продолжение', () => {
    const work = normalizeSpace(legacy())
    let second = createContext(work, 'second', 'Учёба')
    second = updateContextSession(second, session => ({ ...session, tabs: [{ id: 'study', title: 'Курс', url: 'https://study.test/' }], activeTabId: 'study' }), after)
    second = updateContextSession(second, session => ({ ...session, tabs: session.tabs.map(tab => ({ ...tab, title: 'Обновлённый бриф' })) }), '2026-10-01T12:00:00Z', work.activeContextId, false)
    expect(latestContinuation(state(second))?.context.id).toBe('second')
    expect(contextSession(second, work.activeContextId).tabs[0].title).toBe('Обновлённый бриф')
    expect(second.activeSession?.activeTabId).toBe('study')
  })
  it('успешно открытый документ добавляется лишь в своё дело, явное исключение сохраняется', () => {
    let work = normalizeSpace(legacy())
    work = recordDocumentOpen(work, file, work.activeContextId, after)
    expect(currentContext(work).documentIds).toEqual(['document'])
    work = { ...work, workContexts: work.workContexts!.map(context => ({ ...context, documentIds: [], excludedDocumentIds: ['document'] })) }
    work = recordDocumentOpen(work, file, work.activeContextId, after)
    expect(currentContext(work).documentIds).toEqual([])
  })
  it('свежая активность побеждает старый checkpoint другого дела; архив не предлагается', () => {
    const work = normalizeSpace(legacy())
    const old = saveCheckpoint(state(work), 'work', { nextStep: 'Старый шаг' }, new Date(before)).spaces[0]
    const fresh = recordDocumentOpen({ ...normalizeSpace({ ...legacy(), id: 'study', lastActiveAt: undefined }), activeSession: undefined }, file, undefined, after)
    expect(latestContinuation({ ...state(old), spaces: [old, fresh] })?.space.id).toBe('study')
    expect(latestContinuation({ ...state(old), spaces: [old, { ...fresh, archivedAt: after }] })?.space.id).toBe('work')
  })
  it('не запускает приложения, исполняемые файлы и завершённые документы; убирает повтор пути', () => {
    const executable = { ...file, id: 'script', target: 'D:\\danger.cmd' }
    const duplicate = { ...file, id: 'duplicate', target: 'd:/projects/Логотип.ai' }
    const done = { ...later, completedAt: after }
    const work = normalizeSpace({ ...legacy(), resources: [file, duplicate, executable, done] })
    const context = { ...currentContext(work), documentIds: ['document', 'duplicate', 'script', 'later'] }
    expect(contextDocuments(work, context).map(item => item.id)).toEqual(['document'])
  })
  it('параллельное добавление дела не теряется при редактировании другого', () => {
    const original = state(normalizeSpace(legacy()))
    const edited = structuredClone(original); edited.spaces[0].workContexts![0].title = 'Брендинг'
    const concurrent = { ...original, spaces: [createContext(original.spaces[0], 'second', 'Курс')] }
    const saved = applyChanges(concurrent, diffState(original, edited))
    expect(saved.spaces[0].workContexts!.map(item => item.title)).toEqual(['Брендинг', 'Курс'])
  })
  it('checkpoint хранит вкладки и заметку своего дела без переноса чужого следующего шага', () => {
    const first = saveCheckpoint(state(normalizeSpace(legacy())), 'work', { nextStep: 'Изменить знак', note: 'Синий вариант' }, new Date(before))
    const originalId = first.spaces[0].activeContextId!
    const second = { ...first, spaces: [createContext(first.spaces[0], 'second', 'Курс')] }
    const saved = saveCheckpoint(second, 'work', {}, new Date(after))
    expect(saved.spaces[0].workContexts!.find(item => item.id === originalId)!.checkpoint?.note).toBe('Синий вариант')
    expect(currentContext(saved.spaces[0]).checkpoint).toMatchObject({ nextStep: '', note: '', contextId: 'second' })
    expect(currentContext(saved.spaces[0]).checkpoint?.session?.tabs).toEqual([])
  })
})

describe('частичное открытие документов', () => {
  it('открывает независимые документы при ошибке одного и повторяет только неуспешные', async () => {
    const open = vi.fn().mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('Файл перемещён'))
    const result = await resumeDocuments([file, later], open)
    expect(result.successfulIds).toEqual(['document'])
    expect(result.failures).toEqual([{ id: 'later', name: 'На потом.ai', error: 'Файл перемещён' }])
    open.mockResolvedValueOnce({ ok: true })
    const retry = await resumeDocuments([file, later], open, result.successfulIds)
    expect(open.mock.calls.map(args => args[0].id)).toEqual(['document', 'later', 'later'])
    expect(retry.failures).toEqual([])
  })
})
