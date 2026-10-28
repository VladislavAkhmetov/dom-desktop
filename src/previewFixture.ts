import type { AppState, BrowserTab, Resource, Space } from './types'

/*
 * Hardcoded test content for the browser dev preview (Figma Make, `npm run dev:web`).
 * NOT real data: fills the first empty space once with 10 tabs, Photoshop/Illustrator
 * files and an Excel sheet so cards can be designed against realistic content.
 * withPreviewDemoData (below) adds the rest of the day — tasks, events, news, mail — daily.
 * Never runs in Electron (window.dom), in unit tests, in ?demo=1, or in production builds.
 */
const FLAG = 'dom-preview-fixture-v1'
const env = (import.meta as unknown as { env?: { DEV?: boolean; MODE?: string } }).env

function previewAllowed() {
  if (!env?.DEV || env.MODE === 'test') return false
  if (typeof window === 'undefined' || window.dom) return false
  if (new URLSearchParams(window.location.search).get('demo') === '1') return false
  return true
}

function enabled() {
  if (!previewAllowed()) return false
  try { return localStorage.getItem(FLAG) !== 'done' } catch { return false }
}

function isBlank(space: Space) {
  return !space.archivedAt && space.kind !== 'web' && space.kind !== 'day' && !space.resources.length && !(space.activeSession?.tabs.length)
}

export function withPreviewFixture(state: AppState): AppState {
  if (!enabled()) return state
  const target = state.spaces.find(isBlank)
  if (!target) return state

  const now = Date.now()
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString()
  const contextId = target.activeContextId || target.workContexts?.[0]?.id || `${target.id}-fixture-context`

  const tabs: BrowserTab[] = [
    ['Главная — макеты v3', 'https://www.figma.com/design/fx1/Redesign-Home-v3'],
    ['Дизайн-система: компоненты', 'https://www.figma.com/design/fx2/DS-Components'],
    ['ТЗ на редизайн сайта', 'https://docs.google.com/document/d/fx3/edit'],
    ['Референсы: e-commerce', 'https://www.behance.net/search/projects/e-commerce'],
    ['Dribbble — product cards', 'https://dribbble.com/search/product-card'],
    ['Pinterest — мудборд', 'https://www.pinterest.com/search/pins/?q=calm%20ui'],
    ['Unsplash — фото для героя', 'https://unsplash.com/s/photos/morning-light'],
    ['Google Fonts — Manrope', 'https://fonts.google.com/specimen/Manrope'],
    ['Задачи спринта', 'https://www.notion.so/team/Sprint-fx9'],
    ['Репозиторий фронтенда', 'https://github.com/example/site-frontend']
  ].map(([title, url], index) => ({ id: `fixture-tab-${index + 1}`, contextId, title, url, lastAccessedAt: ago(index * 7) }))

  const files: Resource[] = [
    ['Hero_главная_v3.psd', 'D:\\Projects\\Redesign\\Hero_главная_v3.psd', 12],
    ['Баннеры_акция_осень.psd', 'D:\\Projects\\Redesign\\Баннеры_акция_осень.psd', 45],
    ['Иконки_и_иллюстрации.ai', 'D:\\Projects\\Redesign\\Иконки_и_иллюстрации.ai', 90],
    ['Контент-план_и_бюджет.xlsx', 'D:\\Projects\\Redesign\\Контент-план_и_бюджет.xlsx', 150]
  ].map(([name, path, minutes], index) => ({ id: `fixture-file-${index + 1}`, name: String(name), kind: 'file' as const, target: String(path), createdAt: ago(600), lastOpenedAt: ago(Number(minutes)) }))

  const contexts = target.workContexts?.length ? target.workContexts : [{ id: contextId, title: target.name, documentIds: [] as string[] }]
  const filled: Space = {
    ...target,
    lastActiveAt: ago(5),
    resources: files,
    activeContextId: contextId,
    workContexts: contexts.map(context => context.id === contextId ? {
      ...context,
      documentIds: files.map(file => file.id),
      activeTabId: tabs[0].id,
      lastActiveAt: ago(5),
      checkpoint: { id: 'fixture-checkpoint', spaceId: target.id, contextId, note: '', nextStep: 'Собрать финальные макеты главной', savedAt: ago(5) }
    } : context),
    activeSession: { tabs, activeTabId: tabs[0].id, savedAt: ago(5) }
  }
  try { localStorage.setItem(FLAG, 'done') } catch { /* preview only */ }
  return { ...state, spaces: state.spaces.map(space => space.id === target.id ? filled : space) }
}

/*
 * Daily demo data for the browser preview. NOT real data — every item id starts with `demo-`.
 * Unlike the one-time space seed above, it is refreshed on the first preview load of each calendar
 * day: demo items are recreated with dates relative to today (otherwise «Мой день» goes empty a day
 * later), user-made items are never touched. Covers: tasks today/tomorrow/this week, undated
 * thoughts, calendar events (one starts in ~20 min, a task is due «now» → attention island), more spaces (two pinned), reading
 * links, browser bookmarks in groups, a news edition with topics, browsing history. No mail: mail is
 * not being connected for now (attentionModel → ATTENTION_MAIL); demo mail from earlier runs is removed.
 * Replaces the former one-time day/news seeds (their `fixture-*` items are removed).
 */
const DEMO_FLAG = 'dom-preview-demo-day-v3'
const isDemo = (id: string) => id.startsWith('demo-') || /^fixture-(task|thought|meeting|read|news|edition)/.test(id)
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=70`

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type DemoSpace = { id: string; name: string; tone: Space['tone']; pinned?: boolean; minutesAgo: number; nextStep: string; note?: string; tabs: [string, string][]; files: [string, string][] }

function demoSpace(spec: DemoSpace, now: number): Space {
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString()
  const contextId = `${spec.id}-context`
  const tabs: BrowserTab[] = spec.tabs.map(([title, url], index) => ({ id: `${spec.id}-tab-${index + 1}`, contextId, title, url, lastAccessedAt: ago(spec.minutesAgo + index * 9) }))
  const files: Resource[] = spec.files.map(([name, target], index) => ({ id: `${spec.id}-file-${index + 1}`, name, kind: 'file', target, createdAt: ago(3000), lastOpenedAt: ago(spec.minutesAgo + 30 + index * 40) }))
  const checkpoint = { id: `${spec.id}-checkpoint`, spaceId: spec.id, contextId, note: spec.note || '', nextStep: spec.nextStep, savedAt: ago(spec.minutesAgo) }
  return {
    id: spec.id, name: spec.name, tone: spec.tone, pinned: spec.pinned, nameOrigin: 'manual', lastActiveAt: ago(spec.minutesAgo), resources: files,
    activeContextId: contextId,
    workContexts: [{ id: contextId, title: spec.name, documentIds: files.map(file => file.id), activeTabId: tabs[0]?.id, lastActiveAt: ago(spec.minutesAgo), checkpoint }],
    checkpoint,
    activeSession: { tabs, activeTabId: tabs[0]?.id || '', savedAt: ago(spec.minutesAgo) }
  }
}

export function withPreviewDemoData(state: AppState): AppState {
  if (!previewAllowed()) return state
  const nowDate = new Date()
  const today = dayKey(nowDate)
  try { if (localStorage.getItem(DEMO_FLAG) === today) return state } catch { return state }
  const now = nowDate.getTime()
  const iso = (value: number) => new Date(value).toISOString()
  const ago = (minutes: number) => iso(now - minutes * 60000)
  const at = (dayOffset: number, hours: number, minutes = 0) => { const value = new Date(nowDate); value.setDate(value.getDate() + dayOffset); value.setHours(hours, minutes, 0, 0); return value.toISOString() }
  const day = (offset: number) => { const value = new Date(nowDate); value.setDate(value.getDate() + offset); return dayKey(value) }
  const created = iso(now)

  // ── Spaces ────────────────────────────────────────────────────────────
  const demoSpaces = [
    demoSpace({ id: 'demo-space-report', name: 'Квартальный отчёт', tone: 'blue', pinned: true, minutesAgo: 95, nextStep: 'Сверить цифры продаж с бухгалтерией', note: 'Не хватает данных за сентябрь',
      tabs: [['Продажи Q3 — таблица', 'https://docs.google.com/spreadsheets/d/demo-q3/edit'], ['Отчёт: структура', 'https://www.notion.so/team/Q3-report-demo'], ['Графики для слайдов', 'https://datawrapper.de/chart/demo']],
      files: [['Отчёт_Q3_черновик.docx', 'D:\\Work\\Report\\Отчёт_Q3_черновик.docx'], ['Продажи_сентябрь.xlsx', 'D:\\Work\\Report\\Продажи_сентябрь.xlsx'], ['Итоги_квартала.pdf', 'D:\\Work\\Report\\Итоги_квартала.pdf']] }, now),
    demoSpace({ id: 'demo-space-trip', name: 'Отпуск в Грузии', tone: 'sand', pinned: true, minutesAgo: 60 * 26, nextStep: 'Забронировать жильё в Тбилиси',
      tabs: [['Авиабилеты Москва — Тбилиси', 'https://www.aviasales.ru/search/MOW0105TBS1'], ['Квартиры в Старом городе', 'https://www.airbnb.ru/s/Tbilisi'], ['Маршрут по Кахетии', 'https://maps.google.com/?q=Kakheti'], ['Что попробовать: хинкали и хачапури', 'https://www.tripadvisor.ru/Restaurants-Tbilisi']],
      files: [['Маршрут_по_дням.docx', 'C:\\Users\\me\\Documents\\Маршрут_по_дням.docx'], ['Бюджет_поездки.xlsx', 'C:\\Users\\me\\Documents\\Бюджет_поездки.xlsx']] }, now),
    demoSpace({ id: 'demo-space-course', name: 'Курс по TypeScript', tone: 'lilac', minutesAgo: 60 * 50, nextStep: 'Досмотреть урок 7 про дженерики',
      tabs: [['Handbook: Generics', 'https://www.typescriptlang.org/docs/handbook/2/generics.html'], ['Урок 7 — видео', 'https://www.youtube.com/watch?v=demo-ts-7'], ['Домашка: репозиторий', 'https://github.com/example/ts-course']],
      files: [['Конспект_уроки_1-6.pdf', 'C:\\Users\\me\\Documents\\Конспект_уроки_1-6.pdf']] }, now)
  ]
  let spaces = [...state.spaces.filter(space => !space.id.startsWith('demo-space-')), ...demoSpaces]

  // Reading list («Почитать») lives on the first ordinary space; links only, newest first.
  const reads: [string, string, number][] = [
    ['Как проектировать карточки товара, которые продают', 'https://www.smashingmagazine.com/product-cards', 1],
    ['Типографика интерфейсов: ритм, сетка и вертикальный шаг', 'https://habr.com/ru/articles/typography-rhythm/', 3],
    ['Спокойные технологии: интерфейсы без тревоги', 'https://calmtech.com/principles', 6],
    ['Цвет в дизайн-системах: токены и контраст', 'https://medium.com/design/color-tokens', 20],
    ['Почему мы устаём от вкладок — и что с этим делать', 'https://www.nngroup.com/articles/tab-overload/', 30],
    ['Литература для дизайнера: 12 книг на осень', 'https://bureau.ru/books/autumn', 52]
  ]
  const host = spaces.find(space => !space.archivedAt && space.kind !== 'web' && space.kind !== 'day' && !space.id.startsWith('demo-space-'))
  if (host) spaces = spaces.map(space => space.id !== host.id ? space : {
    ...space,
    resources: [...space.resources.filter(item => !isDemo(item.id)), ...reads.map(([name, target, hours], index) => ({ id: `demo-read-${index + 1}`, name, kind: 'link' as const, target, createdAt: ago(hours * 60) }))]
  })

  // Browser bookmarks («Избранное») in groups, on the web space (created if missing).
  const groups = [{ id: 'demo-group-work', name: 'Работа' }, { id: 'demo-group-home', name: 'Дом' }, { id: 'demo-group-ideas', name: 'Вдохновение' }]
  const bookmarks: [string, string, string][] = [
    ['Figma — все файлы', 'https://www.figma.com/files/recent', 'demo-group-work'],
    ['Linear — задачи команды', 'https://linear.app/team/active', 'demo-group-work'],
    ['Почта', 'https://mail.google.com/mail/u/0/#inbox', 'demo-group-work'],
    ['Госуслуги', 'https://www.gosuslugi.ru/', 'demo-group-home'],
    ['Яндекс Еда', 'https://eda.yandex.ru/', 'demo-group-home'],
    ['Кинопоиск — буду смотреть', 'https://www.kinopoisk.ru/mykp/folders/', 'demo-group-home'],
    ['Awwwards — сайты дня', 'https://www.awwwards.com/websites/', 'demo-group-ideas'],
    ['Mobbin — паттерны интерфейсов', 'https://mobbin.com/browse/ios/apps', 'demo-group-ideas']
  ]
  const bookmarkResources: Resource[] = bookmarks.map(([name, target, bookmarkGroupId], index) => ({ id: `demo-bm-${index + 1}`, name, kind: 'link', target, bookmarkGroupId, createdAt: ago(60 * 24 * (index + 2)) }))
  const web = spaces.find(space => space.kind === 'web' && !space.archivedAt)
  spaces = web
    ? spaces.map(space => space.id !== web.id ? space : { ...space, bookmarkGroups: [...(space.bookmarkGroups || []).filter(group => !group.id.startsWith('demo-')), ...groups], resources: [...space.resources.filter(item => !item.id.startsWith('demo-bm-')), ...bookmarkResources] })
    : [...spaces, { id: 'demo-web', name: 'Браузинг', tone: 'blue', kind: 'web', resources: bookmarkResources, bookmarkGroups: groups }]

  // ── Tasks, reminders, thoughts ────────────────────────────────────────
  const task = (id: string, title: string, plannedDate: string | null, dueAt: string | null, extra: Partial<AppState['reminders'][number]> = {}) => ({ id: `demo-${id}`, title, createdAt: created, dueAt, done: false, kind: 'task' as const, plannedDate, ...extra })
  const note = (id: string, title: string, minutes: number) => ({ id: `demo-${id}`, title, createdAt: ago(minutes), dueAt: null, done: false, kind: 'note' as const })
  const reminders = [
    task('task-standup', 'Утренняя планёрка', day(0), at(0, 9, 30), { done: true }),
    // Due five minutes before the first preview load of the day → «Сейчас · …» in the island for ~25 min.
    task('task-now', 'Позвонить в типографию', day(0), iso(Math.floor((now - 5 * 60000) / 60000) * 60000)),
    task('task-hero', 'Согласовать hero-блок с клиентом', day(0), at(0, 10, 30), { spaceId: host?.id }),
    task('task-banners', 'Экспортировать баннеры для рекламы', day(0), at(0, 14, 0), { spaceId: host?.id }),
    task('task-fonts', 'Ответить Ане про шрифты', day(0), at(0, 16, 30)),
    task('task-budget', 'Обновить смету в контент-плане', day(0), null, { spaceId: host?.id }),
    task('task-parcel', 'Забрать посылку на почте', day(0), at(0, 19, 0)),
    task('task-sales', 'Сверить цифры продаж с бухгалтерией', day(1), at(1, 11, 0), { spaceId: 'demo-space-report' }),
    task('task-slides', 'Подготовить слайды для ревью', day(1), null, { spaceId: 'demo-space-report' }),
    task('task-barber', 'Записаться в барбершоп', day(1), null),
    task('task-internet', 'Оплатить интернет', day(3), null, { deadline: day(5) }),
    task('task-gift', 'Купить подарок Ане', day(5), null),
    task('task-flat', 'Забронировать жильё в Тбилиси', day(6), null, { spaceId: 'demo-space-trip' }),
    note('thought-palette', 'Попробовать тёплую палитру для осенней акции', 90),
    note('thought-motion', 'Собрать референсы анимаций для карточек товара', 60 * 5),
    note('thought-book', 'Книга «Тонкое искусство пофигизма» — дочитать', 60 * 30),
    note('thought-idea', 'Идея: экран «Сегодня» без чисел, только фразы', 60 * 50)
  ]

  // ── Calendar ──────────────────────────────────────────────────────────
  const soon = Math.ceil((now + 20 * 60000) / (5 * 60000)) * 5 * 60000
  const midnight = (offset: number) => { const value = new Date(nowDate); value.setDate(value.getDate() + offset); value.setHours(0, 0, 0, 0); return value.toISOString() }
  const events: NonNullable<AppState['events']> = [
    { id: 'demo-event-soon', title: 'Созвон по редизайну', startAt: iso(soon), endAt: iso(soon + 30 * 60000), category: 'meeting', meetingUrl: 'https://meet.google.com/abc-defg-hij', spaceId: host?.id, noticeMinutes: 10 },
    { id: 'demo-event-review', title: 'Дизайн-ревью с командой', startAt: at(0, 15, 0), endAt: at(0, 16, 0), category: 'design', location: 'Переговорка «Волга»' },
    { id: 'demo-event-standup', title: 'Стендап', startAt: at(1, 10, 0), endAt: at(1, 10, 15), category: 'meeting', meetingUrl: 'https://meet.google.com/xyz-uvwx-rst' },
    { id: 'demo-event-birthday', title: 'День рождения Ани', startAt: midnight(1), endAt: midnight(2), allDay: true, startDate: day(1), endDate: day(2), category: 'personal' },
    { id: 'demo-event-dentist', title: 'Стоматолог', startAt: at(2, 18, 30), endAt: at(2, 19, 30), category: 'personal', location: 'ул. Ленина, 12' },
    { id: 'demo-event-focus', title: 'Фокус-время: отчёт', startAt: at(3, 10, 0), endAt: at(3, 12, 0), category: 'focus', spaceId: 'demo-space-report' }
  ]

  // ── News (topics shown as tabs) ───────────────────────────────────────
  const articles: [string, string, string, string, number, string?][] = [
    ['Хабр', 'ИТ', 'Браузеры начали выгружать фоновые вкладки агрессивнее: что это значит для веб-приложений', 'Разработчики Chromium и Firefox рассказали о новых правилах заморозки вкладок и о том, как сохранить состояние форм.', 1, 'photo-1577375729152-4c8b5fcda381'],
    ['Хабр', 'ИТ', 'SQLite 3.47: ускорение полнотекстового поиска и новые JSON-функции', 'В релизе улучшили FTS5 и добавили функции для работы с вложенными структурами без лишних копий.', 3, 'photo-1621361365424-06f0e1eb5c49'],
    ['Tproger', 'ИТ', 'TypeScript 6: что изменится в проверке типов', 'Команда языка показала план: строже по умолчанию, быстрее на больших проектах.', 5],
    ['Дизайн-журнал', 'Дизайн', 'Как команды переходят на токены в Figma и коде', 'Опыт трёх команд: от разрозненных стилей к единой системе переменных и проверке контраста.', 2, 'photo-1626785774625-ddcddc3445e9'],
    ['Дизайн-журнал', 'Дизайн', 'Тёплые нейтральные цвета снова в моде: подборка интерфейсов', 'Песочные и шалфейные оттенки вытесняют холодный серый в продуктовых интерфейсах.', 7, 'photo-1561070791-2526d30994b5'],
    ['Городские новости', 'Город', 'В центре открыли новую пешеходную улицу', 'Движение машин ограничено до весны, на улице появятся скамейки и деревья в кадках.', 4, 'photo-1665077118314-7eb2319f9463'],
    ['Городские новости', 'Город', 'Первый снег ожидается к выходным', 'Синоптики обещают ночью до −5°, днём около нуля.', 9, 'photo-1665863890078-c920a683856b'],
    ['Спортс', 'Спорт', 'Марафон в выходные: перекрытия улиц и расписание стартов', 'Организаторы ожидают около десяти тысяч участников и просят выбирать общественный транспорт.', 6, 'photo-1571008887538-b36bb32f4571'],
    ['Спортс', 'Спорт', 'Сборная завершила сбор победой в контрольном матче', 'Тренерский штаб остался доволен игрой в обороне.', 11]
  ]
  const edition = { id: 'demo-edition', createdAt: ago(30), articles: articles.map(([source, topic, title, summary, hours, image], index) => ({ id: `demo-news-${index + 1}`, source, topic, title, summary, url: `https://example.com/preview-news/${index + 1}`, publishedAt: ago(hours * 60), ...(image ? { image: photo(image) } : {}) })) }
  const realEdition = state.newsEditions?.[0] && !isDemo(state.newsEditions[0].id) && state.newsEditions[0].articles.length
  const newsEditions = realEdition ? state.newsEditions : [edition, ...(state.newsEditions || []).filter(item => !isDemo(item.id))].slice(0, 7)

  // ── Mail: not connected for now — drop demo mail left by earlier preview runs ──
  const mailAccounts = state.mailAccounts?.filter(account => !isDemo(account.id))
  const mailMessages = state.mailMessages?.filter(message => !isDemo(message.id))

  // ── Browsing history (omnibox, history panel) ─────────────────────────
  const visits: [string, string, number][] = [
    ['Главная — макеты v3', 'https://www.figma.com/design/fx1/Redesign-Home-v3', 12], ['Продажи Q3 — таблица', 'https://docs.google.com/spreadsheets/d/demo-q3/edit', 95],
    ['Dribbble — product cards', 'https://dribbble.com/search/product-card', 140], ['Квартиры в Старом городе', 'https://www.airbnb.ru/s/Tbilisi', 60 * 26],
    ['Handbook: Generics', 'https://www.typescriptlang.org/docs/handbook/2/generics.html', 60 * 50], ['Google Fonts — Manrope', 'https://fonts.google.com/specimen/Manrope', 200],
    ['Почта', 'https://mail.google.com/mail/u/0/#inbox', 20], ['Хабр — новости', 'https://habr.com/ru/news/', 300],
    ['Linear — задачи команды', 'https://linear.app/team/active', 400], ['Погода в Уфе', 'https://yandex.ru/pogoda/ufa', 600]
  ]
  const history = [...visits.map(([title, url, minutes], index) => ({ id: `demo-h-${index + 1}`, title, url, visitedAt: ago(minutes) })), ...(state.history || []).filter(item => !isDemo(item.id))].slice(0, 1000)

  try { localStorage.setItem(DEMO_FLAG, today) } catch { /* preview only */ }
  return {
    ...state,
    spaces,
    reminders: [...state.reminders.filter(item => !isDemo(item.id)), ...reminders],
    events: [...(state.events || []).filter(item => !isDemo(item.id)), ...events],
    newsEditions,
    newsPreferences: state.newsPreferences || { topics: ['ИТ', 'Дизайн', 'Город', 'Спорт'] },
    mailAccounts,
    mailMessages,
    history,
    scratchpadNote: state.scratchpadNote?.trim() ? state.scratchpadNote : 'Главная v3:\n— герой: фото + одна фраза\n— убрать второй слайдер\n— проверить контраст кнопок'
  }
}

/*
 * Fourth preview aid: stand-in page covers for the fixture tabs. NOT screenshots — Electron's
 * capturePage() is unavailable in the browser preview, so a plain page layout is drawn on a canvas
 * (JPEG, like the real covers). Three tabs stay without a cover to show the "no snapshot yet" case.
 * Kept in memory only, never persisted; runs under the same guards as the seeds above (minus the flag).
 */
const COVER_PALETTE = [
  ['#f4efe6', '#c9a77c', '#3d3328'], ['#eef3ec', '#7f9f86', '#24382b'], ['#f1f0f6', '#8d8fbf', '#2c2c46'],
  ['#f6eeea', '#c48d78', '#3f2a22'], ['#edf2f4', '#7d9aa8', '#22333b']
]

function drawCover(title: string, url: string, index: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = 960; canvas.height = 600
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const [paper, accent, ink] = COVER_PALETTE[index % COVER_PALETTE.length]
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } })()
  const block = (x: number, y: number, w: number, h: number, color: string, r = 12) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill() }
  ctx.fillStyle = paper; ctx.fillRect(0, 0, 960, 600)
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 960, 64)
  block(32, 20, 24, 24, accent, 7)
  ctx.fillStyle = ink; ctx.font = '600 20px Manrope, system-ui, sans-serif'; ctx.fillText(host, 68, 40)
  for (let item = 0; item < 3; item++) block(600 + item * 104, 24, 84, 16, `${ink}22`, 8)
  ctx.fillStyle = ink; ctx.font = '700 44px Manrope, system-ui, sans-serif'
  ctx.fillText(title.length > 30 ? `${title.slice(0, 29)}…` : title, 48, 150)
  block(48, 180, 520, 16, `${ink}2a`, 8); block(48, 208, 400, 16, `${ink}1f`, 8)
  block(48, 248, 160, 44, accent, 22)
  block(620, 108, 292, 196, `${accent}88`, 20)
  for (let card = 0; card < 3; card++) {
    const x = 48 + card * 296
    block(x, 340, 272, 220, '#ffffff', 18)
    block(x + 20, 360, 232, 120, `${accent}55`, 12)
    block(x + 20, 500, 180, 14, `${ink}33`, 7); block(x + 20, 524, 120, 14, `${ink}1f`, 7)
  }
  return canvas.toDataURL('image/jpeg', 0.82)
}

export function previewTabCovers(state: AppState): Record<string, string> {
  if (!previewAllowed()) return {}
  const tabs = state.spaces.flatMap(space => space.activeSession?.tabs || []).filter(tab => tab.id.startsWith('fixture-tab-') || tab.id.startsWith('demo-space-'))
  const covers: Record<string, string> = {}
  tabs.forEach((tab, index) => {
    if (index % 3 === 2) return
    try { const image = drawCover(tab.title, tab.url, index); if (image) covers[tab.id] = image } catch { /* preview only */ }
  })
  return covers
}
