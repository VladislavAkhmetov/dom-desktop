// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseFeed } from '../src/feedParser'
import { parseTabImport } from '../src/browser/ImportTabs'
import { applyAssistantAction, proposedActions } from '../src/assistantTools'
import { emptyState } from '../shared/state'
import { searchState } from '../src/search'
import { eventInDay } from '../src/calendar/CalendarView'
describe('RSS и Atom', () => {
  const source = { id: 'a', name: 'Редакция', url: 'https://example.com/feed' }
  it('разбирает RSS, удаляет HTML и опасные ссылки', () => {
    const articles = parseFeed('<rss><channel><item><title>Новость</title><link>https://example.com/one</link><description><![CDATA[<p>Текст</p><script>alert(1)</script>]]></description><pubDate>Tue, 01 Sep 2026 12:00:00 GMT</pubDate></item><item><title>Плохая ссылка</title><link>javascript:alert(1)</link></item></channel></rss>', source)
    expect(articles).toHaveLength(1); expect(articles[0]).toMatchObject({ title: 'Новость', summary: 'Текст', source: 'Редакция' }); expect(articles[0].publishedAt).toBe('2026-09-01T12:00:00.000Z')
  })
  it('разбирает Atom и относительные ссылки', () => { const articles = parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Статья</title><link rel="alternate" href="/one"/><summary>Коротко</summary><updated>2026-09-01T00:00:00Z</updated></entry></feed>', source); expect(articles[0].url).toBe('https://example.com/one') })
  it('отказывается выдавать страницу ошибки за выпуск', () => { expect(() => parseFeed('<html><body>Unavailable</body></html>', source)).toThrow(); expect(() => parseFeed('invalid xml', source)).toThrow() })
  it('не подменяет отсутствующую ссылку адресом RSS', () => { expect(parseFeed('<rss><channel><item><title>Без ссылки</title></item><item><title>Пустая ссылка</title><link> </link></item></channel></rss>', source)).toEqual([]) })
})
describe('поиск текущих данных', () => {
  it('находит дело и следующий шаг, не обращаясь к другому хранилищу', () => { const state = emptyState(); state.reminders.push({ id: 'note', title: 'Забрать заказ', dueAt: null, createdAt: '2026-09-27', done: false }); state.spaces[0].checkpoint = { id: 'cp', spaceId: 'first-space', note: 'Сравнить варианты', nextStep: 'Обсудить макет', savedAt: '2026-09-27' }; expect(searchState(state, 'забрать')[0].id).toBe('note'); expect(searchState(state, 'обсудить макет')[0].id).toBe('first-space') })
  it('исключает архивные пространства и завершённые дела', () => { const state = emptyState(); state.spaces[0].archivedAt = '2026-09-27'; state.reminders.push({ id: 'done', title: 'Готово', dueAt: null, createdAt: '2026-09-27', done: true }); expect(searchState(state, 'пространство')).toEqual([]); expect(searchState(state, 'готово')).toEqual([]) })
})
describe('события выбранного дня', () => {
  it('показывает продолжающееся событие, учитывая исключительную дату окончания', () => { const event = { id: 'trip', title: 'Поездка', category: 'personal' as const, allDay: true, startDate: '2026-09-27', endDate: '2026-09-29', startAt: '2026-09-27T00:00:00Z', endAt: '2026-09-29T00:00:00Z' }; expect(eventInDay(event, new Date('2026-09-28T12:00:00'))).toBe(true); expect(eventInDay(event, new Date('2026-09-29T12:00:00'))).toBe(false); expect(eventInDay({ ...event, endDate: undefined }, new Date('2026-09-28T12:00:00'))).toBe(false) })
})
describe('импорт', () => {
  it('импортирует окна Chrome, закрепление и группы без опасных адресов', () => { const groups = parseTabImport(JSON.stringify({ windows: [{ name: 'Работа', tabs: [{ url: 'https://example.com', pinned: true, groupId: 2 }, { url: 'chrome://settings' }, { url: 'javascript:alert(1)' }] }] })); expect(groups[0].tabs).toHaveLength(1); expect(groups[0].tabs[0]).toMatchObject({ pinned: true, branchId: 'import-0-2' }) })
  it('переносит HTML закладки и список адресов', () => { expect(parseTabImport('<DL><A HREF="https://example.com/">Материал</A><A HREF="file:///private">Файл</A></DL>')[0].tabs.map(item => item.title)).toEqual(['Материал']); expect(parseTabImport('https://one.example https://two.example')[0].tabs).toHaveLength(2) })
})
describe('действия ИИ', () => {
  it('не принимает произвольные инструменты, неверные даты и Javascript URL', () => { expect(proposedActions(JSON.stringify({ actions: [{ type: 'send_email', to: 'x' }, { type: 'create_task', title: 'Дело', plannedDate: '2026-02-31' }, { type: 'save_link', title: 'Сайт', spaceId: 'first-space', url: 'javascript:alert(1)' }] }))).toEqual([]) })
  it('применяет только конкретное проверенное действие и не создаёт таймер', () => { const actions = proposedActions('```json\n{"actions":[{"type":"create_task","title":"Обсудить проект","plannedDate":"2026-09-28"}]}\n```'); const state = applyAssistantAction(emptyState(), actions[0]); expect(state.reminders[0]).toMatchObject({ title: 'Обсудить проект', plannedDate: '2026-09-28', dueAt: null }); expect(state.spaces).toHaveLength(1) })
  it('не восстанавливает архивное пространство', () => { const state = emptyState(); state.spaces[0].archivedAt = '2026-09-01'; expect(() => applyAssistantAction(state, { type: 'checkpoint', spaceId: 'first-space', nextStep: 'Шаг' })).toThrow('недоступно') })
})
