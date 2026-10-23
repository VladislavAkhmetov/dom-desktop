const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const outDir = path.resolve(__dirname, '../qa/screenshots/functional')
fs.mkdirSync(outDir, { recursive: true })
const userData = path.resolve(__dirname, '../.cache/functional-audit', String(Date.now()))
fs.mkdirSync(userData, { recursive: true })
app.setPath('userData', userData)
app.disableHardwareAcceleration()
app.on('window-all-closed', () => undefined)

const results = []
let window

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const PAGE = `
window.__fn = (() => {
  const text = el => (el?.getAttribute?.('aria-label') || el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim()
  const visible = el => {
    if (!el || el.closest('[hidden]')) return false
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
    const rect = el.getBoundingClientRect()
    return rect.width >= 2 && rect.height >= 2
  }
  const controls = root => [...(root || document).querySelectorAll('button, [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], a, label')].filter(visible)
  function click(label) {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible)
    const roots = dialogs.length ? [dialogs.at(-1), document] : [document]
    for (const root of roots) {
      const exact = controls(root).find(el => text(el) === label)
      const el = exact || controls(root).find(el => text(el).includes(label))
      if (!el) continue
      el.click()
      return { ok: true, name: text(el).slice(0, 140) }
    }
    return { ok: false, reason: 'нет «' + label + '»' }
  }
  function fill(label, value) {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible)
    const root = dialogs.at(-1) || document
    const host = [...root.querySelectorAll('label')].find(el => text(el).includes(label))
    const input = host?.querySelector('input, textarea') || root.querySelector(label)
    if (!input) return { ok: false, reason: 'нет поля «' + label + '»' }
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return { ok: true }
  }
  function typeInto(selector, value) {
    const input = document.querySelector(selector)
    if (!input) return { ok: false, reason: 'нет ' + selector }
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return { ok: true }
  }
  function pressOn(selector, key, extra) {
    const input = document.querySelector(selector)
    if (!input) return { ok: false, reason: 'нет ' + selector }
    input.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, extra || {})))
    return { ok: true }
  }
  function state() {
    const raw = sessionStorage.getItem('dom-cabinet-example-day-v1')
    return raw ? JSON.parse(raw) : null
  }
  function dismiss() {
    document.documentElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    for (let i = 0; i < 8; i++) {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible)
      if (!dialogs.length) break
      const close = dialogs.at(-1).querySelector('button[aria-label="Закрыть"]')
      if (!close) break
      close.click()
    }
    return true
  }
  return { click, fill, typeInto, pressOn, state, dismiss, text, visible }
})()
`

async function js(source) {
  const body = /^\s*(return|const|let|var)\b/.test(source) ? source : `return (${source})`
  return window.webContents.executeJavaScript(`(() => { ${body} })()`)
}

async function until(source, label, timeout = 5000) {
  const end = Date.now() + timeout
  let last = null
  while (Date.now() < end) {
    try { last = await js(source) } catch (error) { last = error.message }
    if (last === true) return
    await sleep(140)
  }
  throw new Error(`${label}: ${typeof last === 'string' ? last : JSON.stringify(last)}`)
}

async function need(source, label) {
  const result = await js(source)
  if (!result || result.ok === false) throw new Error(result?.reason || label)
  await sleep(280)
  return result
}

async function check(name, fn) {
  try {
    await js('window.__fn.dismiss()')
    await sleep(180)
    await fn()
    results.push({ name, ok: true })
    console.log(`[fn] ok ${name}`)
  } catch (error) {
    results.push({ name, ok: false, error: error.message })
    console.log(`[fn] FAIL ${name}: ${error.message}`)
    try {
      const png = await window.webContents.capturePage()
      fs.writeFileSync(path.join(outDir, `${name.replace(/[^\w.-]+/g, '-')}.png`), png.toPNG())
    } catch { /* кадр необязателен */ }
  }
}

async function run() {
  window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 920,
    webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false }
  })
  window.showInactive()
  window.webContents.on('console-message', event => {
    if (event.level === 'error' || event.level === 3) console.log('[renderer]', event.message)
  })
  window.webContents.on('did-fail-load', (_event, code, description) => console.log('[load-fail]', code, description))
  await window.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await window.webContents.executeJavaScript(PAGE + ';true')
  const snap = await js(`({ href: location.href, fn: typeof window.__fn, shell: Boolean(document.querySelector('.app-shell')), root: (document.querySelector('#root')?.innerText || '').slice(0, 180) })`)
  console.log('[fn] snap', JSON.stringify(snap))
  await until(`Boolean(document.querySelector('.app-shell') && window.__fn.state())`, 'приложение не собрало состояние', 15000)
  await sleep(400)

  await check('дело-завершить-и-вернуть', async () => {
    await need(`return window.__fn.click('Завершить: Отправить итоги встречи')`, 'чекбокс')
    await until(`(() => { const task = window.__fn.state().reminders.find(item => item.title === 'Отправить итоги встречи'); return task?.done === true })()`, 'дело не отметилось сделанным')
    await need(`const button = document.querySelector('.calm-undo button'); if (!button || !button.textContent.includes('Вернуть')) return { ok: false, reason: 'нет плашки Вернуть' }; button.click(); return { ok: true }`, 'вернуть')
    await until(`window.__fn.state().reminders.find(item => item.title === 'Отправить итоги встречи')?.done === false`, 'дело не вернулось')
    const overlap = await js(`(() => { const undo = document.querySelector('.calm-undo'); const dock = document.querySelector('.calm-dock'); if (!undo || !dock) return false; const a = undo.getBoundingClientRect(); const b = dock.getBoundingClientRect(); return a.bottom > b.top + 4 && a.top < b.bottom - 4 })()`)
    if (overlap) throw new Error('плашка «Вернуть» перекрывает док')
  })

  await check('новое-дело-сохраняется', async () => {
    await need(`const button = document.querySelector('[data-widget="day"] button[aria-label="Добавить дело"]'); if (!button) return { ok: false, reason: 'нет кнопки плана' }; button.click(); return { ok: true }`, 'добавить')
    await need(`const filled = window.__fn.fill('Мысль или дело', 'Проверка сохранения дела'); if (filled.ok) return filled; return window.__fn.typeInto('#quick-thought', 'Проверка сохранения дела')`, 'текст')
    await need(`const button = [...document.querySelectorAll('[role="dialog"] button')].find(item => item.textContent.trim() === 'Сегодня'); if (!button) return { ok: false, reason: 'нет Сегодня' }; button.click(); return { ok: true }`, 'сегодня')
    await need(`const button = [...document.querySelectorAll('[role="dialog"] button')].find(item => item.textContent.trim() === 'Сохранить'); if (!button) return { ok: false, reason: 'нет Сохранить' }; button.click(); return { ok: true }`, 'сохранить')
    await until(`window.__fn.state().reminders.some(item => item.title === 'Проверка сохранения дела' && item.done === false)`, 'дело не попало в состояние')
    const today = await js(`(() => { const date = new Date(); return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') })()`)
    const task = await js(`window.__fn.state().reminders.find(item => item.title === 'Проверка сохранения дела')`)
    if (task?.plannedDate !== today) throw new Error('дело не на сегодня ' + JSON.stringify({ plannedDate: task?.plannedDate, dueAt: task?.dueAt, today }))
    await need(`return window.__fn.click('Открыть календарь')`, 'календарь')
    await need(`const button = [...document.querySelectorAll('.calendar-modes button')].find(item => item.textContent.trim() === 'День'); if (!button) return { ok: false, reason: 'нет вида День' }; button.click(); return { ok: true }`, 'день')
    await until(`document.body.innerText.includes('Проверка сохранения дела')`, 'дело не видно в календаре дня')
    await need(`return window.__fn.click('Закрыть')`, 'закрыть')
  })

  await check('календарь-день-неделя-месяц', async () => {
    await need(`return window.__fn.click('Открыть календарь')`, 'календарь')
    for (const [label, mode] of [['День', 'day'], ['Месяц', 'month'], ['Неделя', 'week']]) {
      await need(`const button = [...document.querySelectorAll('.calendar-modes button')].find(item => item.textContent.trim() === '${label}'); if (!button) return { ok: false, reason: 'нет ${label}' }; button.click(); return { ok: true }`, label)
      await until(`document.querySelector('.calendar-view')?.classList.contains('${mode}') === true && document.querySelector('.calendar-modes button[aria-pressed="true"]')?.textContent.trim() === '${label}'`, `вид не стал «${label}»`)
    }
    await need(`return window.__fn.click('Закрыть')`, 'закрыть')
  })

  await check('ссылка-в-почитать-и-прочитано', async () => {
    await need(`return window.__fn.click('Добавить ссылку')`, 'добавить ссылку')
    await need(`return window.__fn.fill('Название', 'Проверка полки')`, 'название')
    await need(`return window.__fn.fill('Адрес', 'https://example.com/functional-shelf')`, 'адрес')
    await need(`const button = [...document.querySelectorAll('[role="dialog"] button')].find(item => item.textContent.includes('Добавить')); if (!button) return { ok: false, reason: 'нет Добавить' }; button.click(); return { ok: true }`, 'сохранить ссылку')
    await until(`window.__fn.state().spaces.some(space => space.resources.some(item => item.name === 'Проверка полки' && item.target.includes('example.com/functional-shelf')))`, 'ссылка не записана')
    await until(`document.body.innerText.includes('Проверка полки')`, 'ссылка не видна на полке')
    await need(`return window.__fn.click('Отметить прочитанным: Проверка полки')`, 'прочитано')
    await until(`window.__fn.state().spaces.some(space => space.resources.some(item => item.name === 'Проверка полки' && item.completedAt))`, 'прочтение не записано')
    await until(`!document.body.innerText.includes('Проверка полки')`, 'прочитанная ссылка осталась на полке')
  })

  await check('мысли-без-даты', async () => {
    await need(`return window.__fn.click('Мысли без даты')`, 'открыть')
    await until(`document.body.innerText.includes('В выходные попробовать новый маршрут') && document.body.innerText.includes('Без срока')`, 'запись без даты не показана')
  })

  await check('пресет-фон-и-виджет', async () => {
    await need(`return window.__fn.click('Настройки')`, 'настройки')
    await need(`return window.__fn.click('Общие')`, 'общие')
    await need(`return window.__fn.click('Настроить')`, 'настроить главную')
    await until(`document.body.innerText.includes('Настроить главную')`, 'диалог главной не открыт')
    await need(`return window.__fn.click('Пресеты')`, 'пресеты')
    await need(`const card = [...document.querySelectorAll('[role="radio"]')].find(item => item.textContent.includes('Спокойный')); if (!card) return { ok: false, reason: 'нет пресета' }; card.click(); return { ok: true }`, 'спокойный')
    await until(`window.__fn.state().dashboard?.preset === 'calm' && window.__fn.state().dashboard.widgets.some(item => item.type === 'notes') && window.__fn.state().dashboard.widgets.some(item => item.type === 'focus')`, 'пресет не применился')
    await need(`return window.__fn.click('Фон и оформление')`, 'фон')
    await need(`const card = [...document.querySelectorAll('.wallpaper-card')].find(item => item.textContent.includes('Рассвет')); if (!card) return { ok: false, reason: 'нет рассвета' }; card.click(); return { ok: true }`, 'рассвет')
    await until(`(window.__fn.state().backgroundImage || '').includes('abstract-morning')`, 'фон не сменился')
    await need(`return window.__fn.click('Виджеты')`, 'виджеты')
    await need(`const button = [...document.querySelectorAll('[role="dialog"] button')].find(item => item.textContent.includes('Пространства')); if (!button) return { ok: false, reason: 'нет кнопки Пространства' }; button.click(); return { ok: true }`, 'добавить пространства')
    await until(`window.__fn.state().dashboard.widgets.some(item => item.type === 'spaces')`, 'виджет пространств не добавлен')
    await need(`return window.__fn.click('Пресеты')`, 'к пресетам')
    await need(`const card = [...document.querySelectorAll('[role="radio"]')].find(item => item.textContent.includes('Обзор')); if (!card) return { ok: false, reason: 'нет обзора' }; card.click(); return { ok: true }`, 'обзор')
    await until(`window.__fn.state().dashboard?.preset === 'overview'`, 'стандартный пресет не вернулся')
  })

  await check('язык-подсказки-звук', async () => {
    await need(`return window.__fn.click('Настройки')`, 'настройки')
    await need(`return window.__fn.click('Общие')`, 'общие')
    const before = await js(`window.__fn.state().liveHints === true`)
    await need(`return window.__fn.click('Анимация напоминаний')`, 'анимация')
    await until(`window.__fn.state().liveHints === ${before ? 'false' : 'true'}`, 'анимация не переключилась')
    await need(`return window.__fn.click('Анимация напоминаний')`, 'анимация обратно')
    const soundBefore = await js(`document.querySelector('[aria-label="Тактильные звуки Calm Tech"]')?.getAttribute('aria-checked')`)
    await need(`return window.__fn.click('Тактильные звуки Calm Tech')`, 'звук')
    await until(`document.querySelector('[aria-label="Тактильные звуки Calm Tech"]')?.getAttribute('aria-checked') !== '${soundBefore}'`, 'звук не переключился')
    await need(`const button = [...document.querySelectorAll('button')].find(item => item.textContent.includes('English')); if (!button) return { ok: false, reason: 'нет English' }; button.click(); return { ok: true }`, 'english')
    await until(`window.__fn.state().locale === 'en' && document.body.innerText.includes('Settings')`, 'интерфейс не стал английским')
    await need(`const button = [...document.querySelectorAll('button')].find(item => item.textContent.includes('Русский')); if (!button) return { ok: false, reason: 'нет Русский' }; button.click(); return { ok: true }`, 'русский')
    await until(`window.__fn.state().locale === 'ru' && document.body.innerText.includes('Настройки')`, 'интерфейс не вернулся на русский')
    const autostart = await js(`(() => { const button = document.querySelector('[aria-label="Автозапуск"]'); return !button || button.disabled === true })()`)
    if (!autostart) throw new Error('автозапуск в демо должен быть недоступен')
  })

  await check('профиль-имя-и-тон', async () => {
    await js('window.__fn.dismiss()')
    await need(`return window.__fn.click('Профиль:')`, 'профиль')
    await need(`const button = document.querySelector('.profile-name'); if (!button) return { ok: false, reason: 'нет имени' }; button.click(); return { ok: true }`, 'имя')
    await need(`return window.__fn.typeInto('.profile-name-input', 'Проверка профиля')`, 'ввод имени')
    await need(`return window.__fn.pressOn('.profile-name-input', 'Enter')`, 'enter')
    await until(`window.__fn.state().userProfile.name === 'Проверка профиля'`, 'имя не сохранилось')
    await need(`return window.__fn.click('Лаванда')`, 'лаванда')
    await until(`window.__fn.state().userProfile.avatarTone === 'lilac'`, 'тон не сохранился')
  })

  await check('пароль-сохранить-и-удалить', async () => {
    await need(`return window.__fn.click('Настройки')`, 'настройки')
    await need(`return window.__fn.click('Пароли и ключи')`, 'пароли')
    await need(`return window.__fn.fill('Сайт или сервис', 'https://example.com')`, 'сайт')
    await need(`return window.__fn.fill('Логин или email', 'functional@example.com')`, 'логин')
    await need(`return window.__fn.fill('Пароль', 'secret-check')`, 'пароль')
    await need(`const button = [...document.querySelectorAll('[role="dialog"] button')].find(item => item.textContent.includes('Сохранить') && !item.disabled); if (!button) return { ok: false, reason: 'нет Сохранить' }; button.click(); return { ok: true }`, 'сохранить пароль')
    await until(`document.body.innerText.includes('example.com') && document.body.innerText.includes('functional@example.com')`, 'пароль не появился в списке')
    const stored = await js(`JSON.parse(localStorage.getItem('dom-vault-credentials') || '[]').some(item => item.username === 'functional@example.com' && item.password === 'secret-check')`)
    if (!stored) throw new Error('пароль не записан в хранилище')
    await need(`return window.__fn.click('Удалить пароль для https://example.com')`, 'удалить')
    await until(`!JSON.parse(localStorage.getItem('dom-vault-credentials') || '[]').some(item => item.username === 'functional@example.com')`, 'пароль не удалён')
  })

  await check('почта-дайджест-календарь', async () => {
    await need(`return window.__fn.click('Настройки')`, 'настройки')
    await need(`return window.__fn.click('Почта Gmail')`, 'почта')
    await until(`document.body.innerText.includes('Подключение недоступно') && document.body.innerText.includes('demo@example.com')`, 'демо-почта не показана честно')
    const sender = await js(`return window.__fn.fill('Важные отправители', 'functional-sender@example.com')`)
    if (!sender?.ok) throw new Error(sender?.reason || 'нет поля отправителей')
    await sleep(250)
    await until(`(window.__fn.state().mailAccounts || []).some(item => (item.importantSenders || []).includes('functional-sender@example.com'))`, 'отправитель не сохранился')
    await need(`return window.__fn.click('Дайджест')`, 'дайджест')
    await until(`document.body.innerText.includes('Хабр') && document.body.innerText.includes('Лента.ру')`, 'источники дайджеста не показаны')
    await need(`return window.__fn.click('Календар')`, 'календари')
    await need(`(() => {
      const text = el => (el.innerText || '').replace(/\\s+/g, ' ').trim()
      const visible = el => !el.closest('[hidden]') && el.getBoundingClientRect().width > 2
      const set = (label, value) => {
        const host = [...document.querySelectorAll('[role="dialog"] label')].find(el => visible(el) && text(el).startsWith(label))
        const input = host?.querySelector('input')
        if (!input) return { ok: false, reason: 'нет поля «' + label + '»' }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return { ok: true }
      }
      const name = set('Название', 'Проверка календаря')
      if (!name.ok) return name
      return set('Адрес iCal', 'https://example.com/functional.ics')
    })()`, 'поля календаря')
    await need(`const button = [...document.querySelectorAll('[role="dialog"] button')].find(item => !item.closest('[hidden]') && item.textContent.trim() === 'Подключить' && !item.disabled); if (!button) return { ok: false, reason: 'кнопка Подключить недоступна' }; button.click(); return { ok: true }`, 'подключить')
    await until(`(window.__fn.state().calendarSubscriptions || []).some(item => item.name === 'Проверка календаря' && item.url.includes('functional.ics') && item.error)`, 'календарь не добавлен в состояние', 8000)
    await need(`return window.__fn.click('Удалить календарь: Проверка календаря')`, 'отключить')
    await until(`!(window.__fn.state().calendarSubscriptions || []).some(item => item.name === 'Проверка календаря')`, 'календарь не отключился')
  })

  await check('поиск-находит-материал', async () => {
    await need(`return window.__fn.click('Поиск в Доме')`, 'поиск')
    await need(`return window.__fn.typeInto('[role="dialog"] input', 'логотип')`, 'запрос')
    await until(`document.body.innerText.includes('Логотип_Мастер_2026.ai')`, 'материал не найден')
    await need(`const button = [...document.querySelectorAll('[role="dialog"] button')].find(item => item.textContent.includes('Логотип_Мастер_2026.ai')); if (!button) return { ok: false, reason: 'нет результата' }; button.click(); return { ok: true }`, 'открыть результат')
    await until(`document.body.innerText.includes('Обновить логотип') && !document.querySelector('[role="dialog"]')`, 'результат не открыл пространство')
  })

  await check('омнибокс-открывает-адрес', async () => {
    await need(`const home = document.querySelector('.brand'); if (!home) return { ok: false, reason: 'нет главной' }; home.click(); return { ok: true }`, 'домой')
    await sleep(300)
    await need(`return window.__fn.typeInto('.omnibox-input', 'https://example.com/functional-page')`, 'адрес')
    await need(`return window.__fn.pressOn('.omnibox-input', 'Enter')`, 'enter')
    await until(`window.__fn.state().spaces.some(space => (space.activeSession?.tabs || []).some(tab => (tab.url || '').includes('example.com/functional-page')))`, 'вкладка с адресом не создана')
    await until(`(window.__fn.state().history || []).some(item => (item.url || '').includes('example.com/functional-page'))`, 'адрес не записан в историю')
  })

  await check('фокус-старт-и-стоп', async () => {
    await need(`const home = document.querySelector('.brand'); if (home) home.click(); return { ok: true }`, 'домой')
    await sleep(250)
    await need(`return window.__fn.click('Фокус')`, 'фокус')
    await need(`const label = [...document.querySelectorAll('.focus-task')].find(item => item.textContent.includes('Свободная сессия')); if (!label) return { ok: false, reason: 'нет свободной сессии' }; label.click(); return { ok: true }`, 'сессия')
    await need(`return window.__fn.click('15 мин')`, '15')
    await need(`return window.__fn.click('Начать')`, 'начать')
    await until(`document.body.innerText.includes('15 минут') && Boolean(document.querySelector('.focus-clock time'))`, 'таймер не запущен')
    await need(`return window.__fn.click('Завершить сессию')`, 'стоп')
    await until(`!document.querySelector('.focus-dialog')`, 'сессия не закрылась')
  })

  await check('быстрая-запись', async () => {
    await need(`return window.__fn.click('Записать')`, 'записать')
    await need(`return window.__fn.typeInto('#quick-thought, .dock-entry-anchor textarea, [role="dialog"] textarea', 'Проверка быстрой записи')`, 'текст')
    await need(`return window.__fn.click('Сохранить')`, 'сохранить')
    await until(`window.__fn.state().reminders.some(item => item.title === 'Проверка быстрой записи')`, 'запись не сохранена')
  })

  await check('история-ctrl-h', async () => {
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true, cancelable: true }))`)
    await until(`document.body.innerText.includes('История браузера') && document.body.innerText.includes('example.com')`, 'история не показала открытый адрес')
  })

  await check('браузер-остров-и-план-дня', async () => {
    await js('window.__fn.dismiss()')
    await sleep(200)
    await need(`return window.__fn.click('Браузер')`, 'браузер')
    await until(`Boolean(document.querySelector('.browser-day-pulse, .browser-attention-island'))`, 'остров внимания не появился', 6000)
    await need(`const button = document.querySelector('.browser-day-pulse'); if (!button) return { ok: false, reason: 'нет острова' }; button.click(); return { ok: true }`, 'остров')
    await need(`const button = document.querySelector('.browser-island-day'); if (!button) return { ok: false, reason: 'нет плана дня' }; button.click(); return { ok: true }`, 'план дня')
    await until(`Boolean(document.querySelector('.browser-day-panel, .browser-day-heading'))`, 'панель дня не открылась')
  })

  await check('фильтр-документов', async () => {
    await need(`const home = document.querySelector('.brand'); if (home) home.click(); return { ok: true }`, 'домой')
    await sleep(300)
    await need(`const button = [...document.querySelectorAll('.chrome-space')].find(item => item.textContent.includes('логотип')); if (!button) return { ok: false, reason: 'нет пространства' }; button.click(); return { ok: true }`, 'пространство')
    await need(`const button = [...document.querySelectorAll('.cabinet-content-filters button')].find(item => item.textContent.trim() === 'Документы'); if (!button) return { ok: false, reason: 'нет фильтра' }; button.click(); return { ok: true }`, 'документы')
    await until(`document.querySelector('.cabinet-content-filters button[aria-pressed="true"]')?.textContent.includes('Документы')`, 'фильтр не выбран')
    const files = await js(`document.body.innerText.includes('Логотип_Мастер_2026.ai') && !document.body.innerText.includes('figma.com')`)
    if (!files) throw new Error('фильтр документов не спрятал сайты')
  })

  await check('пространство-создать-переименовать-удалить', async () => {
    const before = await js(`window.__fn.state().spaces.length`)
    await need(`return window.__fn.click('Создать пространство')`, 'создать')
    await until(`window.__fn.state().spaces.length === ${before + 1}`, 'пространство не создано')
    await until(`document.body.innerText.includes('Новое пространство')`, 'новое пространство не открыто')
    await need(`return window.__fn.click('Переименовать пространство')`, 'переименовать')
    await need(`return window.__fn.fill('Название пространства', 'Проверка имени')`, 'имя')
    await need(`const button = [...document.querySelectorAll('[role="dialog"] button')].find(item => item.textContent.includes('Сохранить')); if (!button) return { ok: false, reason: 'нет Сохранить' }; button.click(); return { ok: true }`, 'сохранить имя')
    await until(`window.__fn.state().spaces.some(space => space.name === 'Проверка имени')`, 'имя не сохранилось')
    const space = await js(`(() => { const button = [...document.querySelectorAll('.chrome-space')].find(item => item.textContent.includes('Проверка имени')); if (!button) return false; button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 })); return true })()`)
    if (!space) throw new Error('нет вкладки нового пространства')
    await sleep(250)
    await need(`return window.__fn.click('Закрепить в меню')`, 'закрепить')
    await until(`window.__fn.state().spaces.find(space => space.name === 'Проверка имени')?.pinned === true`, 'не закрепилось')
    await js(`(() => { const button = [...document.querySelectorAll('.chrome-space')].find(item => item.textContent.includes('Проверка имени')); button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 })); return true })()`)
    await sleep(250)
    await need(`return window.__fn.click('В архив')`, 'архив')
    await until(`Boolean(window.__fn.state().spaces.find(space => space.name === 'Проверка имени')?.archivedAt)`, 'не ушло в архив')
    await need(`const button = document.querySelector('.calm-undo button'); if (!button) return { ok: false, reason: 'нет возврата из архива' }; button.click(); return { ok: true }`, 'вернуть из архива')
    await until(`!window.__fn.state().spaces.find(space => space.name === 'Проверка имени')?.archivedAt`, 'архив не отменён')
    await js(`(() => { const button = [...document.querySelectorAll('.chrome-space')].find(item => item.textContent.includes('Проверка имени')); button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 })); return true })()`)
    await sleep(250)
    await need(`return window.__fn.click('Удалить пространство')`, 'меню удаления')
    await need(`const button = [...document.querySelectorAll('[role="dialog"] button')].find(item => item.textContent.trim().startsWith('Удалить пространство')); if (!button) return { ok: false, reason: 'нет подтверждения' }; button.click(); return { ok: true }`, 'подтвердить')
    await until(`!window.__fn.state().spaces.some(space => space.name === 'Проверка имени')`, 'пространство не удалено')
  })

  const failed = results.filter(item => !item.ok)
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2))
  console.log(`[fn] passed=${results.length - failed.length} failed=${failed.length}`)
  app.exit(failed.length ? 1 : 0)
}

app.whenReady().then(run).catch(error => {
  console.error(error)
  app.exit(1)
})
