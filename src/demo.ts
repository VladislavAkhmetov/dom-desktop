import type { AppState, Space } from './types'
import { defaultNewsSources, initializeNews } from './newsCatalog'
import { isCabinetPreview } from './cabinetMode'

export const isDemo = new URLSearchParams(window.location.search).get('demo') === '1'
const KEY = isCabinetPreview ? 'dom-cabinet-example-day-v1' : 'dom-example-day-v2'
const additionalSpaces: Space[] = [
  { id: 'example-home', name: 'Дом', tone: 'lilac', resources: [] }
]

export function exampleDay(): AppState {
  try {
    const saved = sessionStorage.getItem(KEY)
    if (saved) {
      const state = JSON.parse(saved) as AppState
      const missing = additionalSpaces.filter(space => !state.spaces.some(item => item.id === space.id))
      if (missing.length) state.spaces.push(...missing)
      const updated = initializeNews(state)
      if (missing.length || updated !== state) sessionStorage.setItem(KEY, JSON.stringify(updated))
      return updated
    }
  } catch { /* A fresh example can always be opened. */ }
  const now = new Date()
  const at = (hours: number, minutes = 0) => { const value = new Date(now); value.setHours(hours, minutes, 0, 0); return value.toISOString() }
  const createdAt = now.toISOString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yAt = (hours: number, minutes = 0) => {
    const value = new Date(yesterday)
    value.setHours(hours, minutes, 0, 0)
    return value.toISOString()
  }

  const figmaRecentDocs = [
    { id: 'figma-checkout', name: 'Редизайн чекаута и оплаты v2', kind: 'link' as const, target: 'https://www.figma.com/design/d1/Checkout-v2', createdAt: yAt(10, 0), lastOpenedAt: yAt(18, 40) },
    { id: 'figma-ds', name: 'UI Kit: компоненты и цвета', kind: 'link' as const, target: 'https://www.figma.com/design/d2/Design-System', createdAt: yAt(10, 0), lastOpenedAt: yAt(16, 15) },
    { id: 'figma-landing', name: 'Промо-лендинг для осени', kind: 'link' as const, target: 'https://www.figma.com/design/d3/Promo-Landing', createdAt: yAt(10, 0), lastOpenedAt: yAt(14, 20) },
    { id: 'figma-icons', name: 'Иконки и иллюстрации интерфейса', kind: 'link' as const, target: 'https://www.figma.com/design/d4/Interface-Icons', createdAt: yAt(10, 0), lastOpenedAt: yAt(11, 5) }
  ]

  const illustratorRecentDocs = [
    { id: 'ai-logo', name: 'Логотип_Мастер_2026.ai', kind: 'file' as const, target: 'D:\\Projects\\Brand\\Логотип_Мастер_2026.ai', createdAt: yAt(9, 30), lastOpenedAt: yAt(19, 10) },
    { id: 'ai-patterns', name: 'Векторные_паттерны_v3.ai', kind: 'file' as const, target: 'D:\\Projects\\Brand\\Векторные_паттерны_v3.ai', createdAt: yAt(9, 30), lastOpenedAt: yAt(16, 45) },
    { id: 'ai-packaging', name: 'Упаковка_и_этикетки.ai', kind: 'file' as const, target: 'D:\\Projects\\Store\\Упаковка_и_этикетки.ai', createdAt: yAt(9, 30), lastOpenedAt: yAt(15, 0) },
    { id: 'ai-poster', name: 'Постер_А2_Печать.ai', kind: 'file' as const, target: 'D:\\Design\\Prints\\Постер_А2_Печать.ai', createdAt: yAt(9, 30), lastOpenedAt: yAt(12, 30) }
  ]

  return {
    version: 1, dismissedUntil: null, starterAppsAdded: true,
    userProfile: { name: 'Александр', avatarTone: 'sage', status: 'В потоке' },
    spaces: [{ id: 'example-studio', name: 'Работа', tone: 'sage', resources: [
      { id: 'example-figma', name: 'Figma', kind: 'app', target: 'preview:figma', createdAt },
      { id: 'example-illustrator', name: 'Illustrator 2025', kind: 'app', target: 'preview:illustrator', createdAt },
      { id: 'example-moodboard', name: 'Мудборд: воздух, стекло, спокойствие', kind: 'link', target: new URL('/assets/moodboard/index.html', window.location.origin).href, createdAt },
      ...figmaRecentDocs,
      ...illustratorRecentDocs
    ], activeContextId: 'example-brand', workContexts: [{ id: 'example-brand', title: 'Обновить логотип', documentIds: ['ai-logo', 'ai-patterns'], activeTabId: 'example-reference', lastActiveAt: yAt(19, 10) }], activeSession: { tabs: [
      { id: 'example-reference', contextId: 'example-brand', title: 'Мудборд: воздух, стекло, спокойствие', url: new URL('/assets/moodboard/index.html', window.location.origin).href },
      { id: 'example-checkout', contextId: 'example-brand', title: 'Редизайн чекаута и оплаты v2', url: figmaRecentDocs[0].target }
    ], activeTabId: 'example-reference', savedAt: yAt(19, 10) } }, { id: 'example-personal-space', name: 'Поездка на выходные', tone: 'sand', resources: [], lastActiveAt: yAt(17), activeSession: { tabs: [{ id: 'example-weekend', title: 'План поездки', url: new URL('/prototype/weekend.html', window.location.origin).href }], activeTabId: 'example-weekend' } }, { id: 'example-learning', name: 'Учёба', tone: 'blue', resources: [] }, ...additionalSpaces],
    checkpoint: { spaceId: 'example-personal-space', note: 'Даты выбраны. Осталось сравнить варианты и обсудить с близкими.', nextStep: 'Выбрать, где остановиться', savedAt: yAt(17) },
    reminders: [
      { id: 'example-review', title: 'Отправить итоги встречи', createdAt, dueAt: at(18, 30), done: false },
      { id: 'example-personal', title: 'Забрать заказ по дороге домой', createdAt, dueAt: at(20), done: false },
      { id: 'example-note', title: 'В выходные попробовать новый маршрут для прогулки', createdAt, dueAt: null, done: false }
    ],
    events: [{ id: 'example-meeting', title: 'Разговор с командой', startAt: at(19), endAt: at(19, 30), category: 'meeting' }],
    mailAccounts: [{ id: 'example-mail', email: 'demo@example.com', importantSenders: ['team@example.com'], lastSyncedAt: createdAt }],
    mailMessages: [
      { id: 'example-mail-1', accountId: 'example-mail', gmailId: 'example-1', threadId: 'example-1', from: 'Команда <team@example.com>', subject: 'Пример: материалы к обсуждению', snippet: 'Собрали вопросы к встрече. Посмотрите два варианта главной и оставьте комментарий к тому, который легче читать.', receivedAt: at(8, 30), unread: true, important: true, url: 'https://example.com/demo/meeting' },
      { id: 'example-mail-2', accountId: 'example-mail', gmailId: 'example-2', threadId: 'example-2', from: 'Мастерская <studio@example.com>', subject: 'Пример: время занятия', snippet: 'Занятие начнётся в субботу в 12:00. Можно прийти на десять минут раньше, чтобы выбрать материалы.', receivedAt: yAt(17), unread: true, important: false, url: 'https://example.com/demo/workshop' }
    ],
    feedSources: structuredClone(defaultNewsSources),
    newsPreferences: { topics: defaultNewsSources.map(source => source.topic!) },
    newsEditions: [],
  }
}

export function saveExample(state: AppState) { sessionStorage.setItem(KEY, JSON.stringify(state)); return true }
export function resetExample() { sessionStorage.removeItem(KEY); return exampleDay() }

