import type { AppState } from './types'

export const isDemo = new URLSearchParams(window.location.search).get('demo') === '1'
const KEY = 'dom-example-day-v2'

export function exampleDay(): AppState {
  try {
    const saved = sessionStorage.getItem(KEY)
    if (saved) return JSON.parse(saved) as AppState
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
    spaces: [{ id: 'example-studio', name: 'Работа', tone: 'sage', resources: [
      { id: 'example-figma', name: 'Figma', kind: 'app', target: 'preview:figma', createdAt },
      { id: 'example-illustrator', name: 'Illustrator 2025', kind: 'app', target: 'preview:illustrator', createdAt },
      { id: 'example-moodboard', name: 'Мудборд: воздух, стекло, спокойствие', kind: 'link', target: new URL('/assets/moodboard/index.html', window.location.origin).href, createdAt },
      ...figmaRecentDocs,
      ...illustratorRecentDocs
    ] }, { id: 'example-personal-space', name: 'Поездка на выходные', tone: 'sand', resources: [] }, { id: 'example-learning', name: 'Учёба', tone: 'blue', resources: [] }],
    checkpoint: { spaceId: 'example-personal-space', note: 'Даты выбраны. Осталось сравнить варианты и обсудить с близкими.', nextStep: 'Выбрать, где остановиться', savedAt: yesterday.toISOString() },
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
    newsEditions: [{ id: 'example-edition', createdAt, articles: [
      { id: 'example-news-1', title: 'Пример: как вернуться к делу после перерыва', url: 'https://example.com/demo/return', source: 'Демонстрационный источник', summary: 'В этом примере статья предлагает оставить короткую заметку о следующем шаге перед завершением работы. На карточке виден фрагмент; полный материал открывается отдельно.', publishedAt: createdAt },
      { id: 'example-news-2', title: 'Пример: прогулка на выходных', url: 'https://example.com/demo/walk', source: 'Демонстрационный источник', summary: 'Пример личной подборки: маршрут на пару часов, удобный транспорт и место, где можно остановиться на кофе.', publishedAt: createdAt },
      { id: 'example-news-3', title: 'Пример: находки для нового проекта', url: 'https://example.com/demo/project', source: 'Демонстрационный источник', summary: 'Небольшая подборка идей для проекта. Этот выпуск демонстрирует размер карточки и подробность описания и не содержит настоящих новостей.', publishedAt: createdAt }
    ] }]
  }
}

export function saveExample(state: AppState) { sessionStorage.setItem(KEY, JSON.stringify(state)); return true }
export function resetExample() { sessionStorage.removeItem(KEY); return exampleDay() }

