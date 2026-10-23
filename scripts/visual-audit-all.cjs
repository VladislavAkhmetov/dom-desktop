const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const outDir = path.resolve(__dirname, '../qa/screenshots/full-audit')
fs.mkdirSync(outDir, { recursive: true })
const userData = path.resolve(__dirname, '../.cache/visual-audit', String(Date.now()))
fs.mkdirSync(userData, { recursive: true })
app.setPath('userData', userData)
app.disableHardwareAcceleration()
app.on('window-all-closed', () => undefined)

const findings = []
const shots = []
const consoleErrors = []
let window

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function writeShot(name, png) {
  const safe = name.replace(/[^\w.-]+/g, '-').slice(0, 80)
  const target = path.join(outDir, `${safe}.png`)
  try {
    fs.writeFileSync(target, png)
    return target
  } catch {
    const fallback = path.join(outDir, 'latest', `${safe}.png`)
    fs.mkdirSync(path.dirname(fallback), { recursive: true })
    fs.writeFileSync(fallback, png)
    return fallback
  }
}

const PAGE = `
window.__audit = (() => {
  const text = el => (el?.getAttribute?.('aria-label') || el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim()
  const visible = el => {
    if (!el || el.closest('[hidden]')) return false
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
    const rect = el.getBoundingClientRect()
    return rect.width >= 2 && rect.height >= 2
  }
  const controls = () => [...document.querySelectorAll('button, [role="radio"], [role="switch"], [role="tab"], [role="menuitem"]')].filter(visible).map(el => ({
    name: text(el).slice(0, 120),
    className: String(el.className).slice(0, 80),
    disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
    w: Math.round(el.getBoundingClientRect().width),
    h: Math.round(el.getBoundingClientRect().height)
  }))
  function pool() {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible)
    const root = dialogs.at(-1) || document
    return [...root.querySelectorAll('button, [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], a')].filter(visible)
  }
  function find(label) {
    return pool().find(el => text(el).includes(label))
  }
  function click(label) {
    const roots = []
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible)
    if (dialogs.at(-1)) roots.push(dialogs.at(-1))
    roots.push(document)
    for (const root of roots) {
      const el = [...root.querySelectorAll('button, [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], a')].filter(visible).find(item => text(item).includes(label))
      if (!el) continue
      el.click()
      return { ok: true, name: text(el).slice(0, 120) }
    }
    return { ok: false, reason: 'нет «' + label + '»' }
  }
  function clickFirst(labels) {
    for (const label of labels) {
      const result = click(label)
      if (result.ok) return result
    }
    return { ok: false, reason: 'нет ' + labels.join(' / ') }
  }
  function press(key, extra) {
    document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, extra || {})))
    return true
  }
  function dismiss() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    document.documentElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    let closed = 0
    for (let i = 0; i < 8; i++) {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible)
      if (!dialogs.length) break
      const top = dialogs.at(-1)
      const close = top.querySelector('button[aria-label="Закрыть"]')
      if (!close) break
      close.click()
      closed++
    }
    return { ok: true, closed, left: [...document.querySelectorAll('[role="dialog"]')].filter(visible).length }
  }
  function clickExact(selector, label) {
    const el = [...document.querySelectorAll(selector)].filter(visible).find(item => text(item) === label || text(item).includes(label))
    if (!el) return { ok: false, reason: 'нет «' + label + '» в ' + selector }
    el.click()
    return { ok: true, name: text(el).slice(0, 120) }
  }
  function probe() {
    const issues = []
    for (const el of document.querySelectorAll('button')) {
      if (!visible(el)) continue
      const name = text(el)
      const rect = el.getBoundingClientRect()
      if (!name && !el.getAttribute('title')) issues.push({ kind: 'кнопка без имени', where: String(el.className).slice(0, 60) })
      if (rect.width < 20 || rect.height < 20) issues.push({ kind: 'слишком мелкая цель', name: name.slice(0, 60), w: Math.round(rect.width), h: Math.round(rect.height) })
    }
    for (const dialog of document.querySelectorAll('[role="dialog"], .calm-dialog')) {
      if (!visible(dialog)) continue
      const rect = dialog.getBoundingClientRect()
      if (rect.left < -12 || rect.top < -12 || rect.right > innerWidth + 12 || rect.bottom > innerHeight + 12) {
        issues.push({ kind: 'диалог вылезает за экран', name: text(dialog).slice(0, 80), left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), vw: innerWidth, vh: innerHeight })
      }
    }
    if (document.documentElement.scrollWidth > innerWidth + 8) issues.push({ kind: 'горизонтальный переполнение', width: document.documentElement.scrollWidth, vw: innerWidth })
    const tiny = []
    for (const el of document.querySelectorAll('button, a, p, span, small, label, h1, h2, h3, li, time')) {
      if (!visible(el) || el.children.length > 3) continue
      const sample = text(el)
      if (sample.length < 2 || sample.length > 80) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size > 0 && size < 12) tiny.push({ size, sample, className: String(el.className).slice(0, 40) })
    }
    const seen = new Set()
    const tinyUnique = tiny.filter(item => {
      const key = item.size + '|' + item.className + '|' + item.sample
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 12)
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map(el => text(el).slice(0, 80))
    return { issues, tiny: tinyUnique, dialogs, controls: controls().length, route: document.querySelector('.app-shell')?.className || '' }
  }
  return { click, clickFirst, clickExact, press, dismiss, find: label => Boolean(find(label)), probe, controls }
})()
`

async function runStep(name, source) {
  const before = consoleErrors.length
  let action = null
  try {
    action = await window.webContents.executeJavaScript(`(() => { ${source} })()`)
  } catch (error) {
    action = { threw: error.message }
  }
  await sleep(320)
  let probe = null
  try { probe = await window.webContents.executeJavaScript('window.__audit.probe()') } catch (error) { probe = { threw: error.message } }
  const errors = consoleErrors.slice(before).filter(message => !/resource:recentFiles|vault:credentials|browser:suggest|Failed to fetch|net::|Adblock/.test(message))
  const png = await window.webContents.capturePage()
  const file = writeShot(name, png.toPNG())
  shots.push(file)
  const record = { name, action, probe, errors }
  if (action?.ok === false || action?.threw || errors.length) findings.push(record)
  else if (probe?.issues?.some(item => item.kind !== 'слишком мелкая цель')) findings.push(record)
  console.log(`[audit] ${name} ${action?.ok === false ? 'MISS ' + action.reason : action?.threw ? 'THROW' : 'ok'}${errors.length ? ' errors=' + errors.length : ''}`)
  return record
}

async function closeLayers() {
  await window.webContents.executeJavaScript(`(() => {
    window.__audit.press('Escape')
    document.querySelectorAll('[role="dialog"] button[aria-label="Закрыть"], [role="dialog"] .calm-dialog-heading button, .island-detail-heading button').forEach(button => button.click())
  })()`).catch(() => undefined)
  await sleep(220)
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
    if (event.level === 'error' || event.level === 2 || event.level === 'warning') consoleErrors.push(event.message)
  })
  await window.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await window.webContents.executeJavaScript(PAGE + ';true')
  const ready = Date.now() + 15000
  while (Date.now() < ready) {
    const ok = await window.webContents.executeJavaScript('Boolean(document.querySelector(".app-shell") && document.querySelector(".calm-home, .cabinet-contents, .chrome-profile"))').catch(() => false)
    if (ok) break
    await sleep(150)
  }
  await sleep(700)

  const inventory = await window.webContents.executeJavaScript('window.__audit.controls()')
  fs.writeFileSync(path.join(outDir, 'home-controls.json'), JSON.stringify(inventory, null, 2))

  const steps = [
    ['01-home', 'return { ok: true, home: true }'],
    ['02-date', `return window.__audit.click('Показать календарь месяца')`],
    ['03-weather', `return window.__audit.dismiss() && window.__audit.click('Погода')`],
    ['04-plan-tomorrow', `return window.__audit.dismiss() && window.__audit.clickExact('.plan-card button, .calm-tabs button', 'Завтра')`],
    ['05-plan-today', `return window.__audit.clickExact('.plan-card button, .calm-tabs button', 'Сегодня')`],
    ['06-calendar', `return window.__audit.click('Открыть календарь')`],
    ['07-calendar-day', `return window.__audit.clickExact('.calendar-modes button', 'День')`],
    ['08-calendar-month', `return window.__audit.clickExact('.calendar-modes button', 'Месяц')`],
    ['09-calendar-week', `return window.__audit.clickExact('.calendar-modes button', 'Неделя')`],
    ['10-calendar-today', `return window.__audit.clickExact('.calendar-today', 'Сегодня')`],
    ['11-calendar-next', `return window.__audit.click('Следующий период')`],
    ['12-calendar-prev', `return window.__audit.click('Предыдущий период')`],
    ['13-add-task', `window.__audit.dismiss(); return window.__audit.clickExact('.plan-card button', 'Добавить дело')`],
    ['14-add-task-tomorrow', `return window.__audit.clickExact('.capture-options button, [role="dialog"] button', 'Завтра')`],
    ['15-add-task-today', `return window.__audit.clickExact('.capture-options button, [role="dialog"] button', 'Сегодня')`],
    ['16-task-menu', `window.__audit.dismiss(); const button = document.querySelector('.plan-card [aria-haspopup="menu"]'); if (!button) return { ok: false, reason: 'нет меню дела' }; button.click(); return { ok: true }`],
    ['17-task-edit', `const button = [...document.querySelectorAll('[role="menuitem"], .action-menu-popover button')].find(item => item.textContent.includes('Изменить')); if (!button) return { ok: false, reason: 'нет Изменить' }; button.click(); return { ok: true }`],
    ['18-task-no-reminder', `return window.__audit.clickExact('[role="dialog"] button', 'Без напоминания')`],
    ['19-reading-grid', `window.__audit.dismiss(); return window.__audit.click('Отображение плитками')`],
    ['20-reading-list', `return window.__audit.click('Отображение списком')`],
    ['21-reading-add', `return window.__audit.click('Добавить ссылку')`],
    ['22-edit-widgets', `window.__audit.dismiss(); return window.__audit.click('Настроить виджеты')`],
    ['23-add-widget', `return window.__audit.click('Добавить виджет')`],
    ['24-presets', `window.__audit.dismiss(); const open = window.__audit.click('Настроить виджеты'); if (!open.ok) return open; return window.__audit.click('Пресеты')`],
    ['25-preset-calm', `return window.__audit.clickExact('[role="radio"]', 'Спокойный')`],
    ['26-preset-work', `return window.__audit.clickExact('[role="radio"]', 'Рабочий')`],
    ['27-preset-city', `return window.__audit.clickExact('[role="radio"]', 'Город')`],
    ['28-preset-balance', `return window.__audit.clickExact('[role="radio"]', 'Баланс')`],
    ['29-preset-overview', `return window.__audit.clickExact('[role="radio"]', 'Обзор')`],
    ['30-wallpaper-tab', `return window.__audit.click('Фон и оформление')`],
    ['31-widgets-tab', `return window.__audit.clickExact('[role="dialog"] button, [role="tab"]', 'Виджеты')`],
    ['32-profile', `window.__audit.dismiss(); return window.__audit.click('Профиль:')`],
    ['33-profile-tone', `return window.__audit.click('Лаванда')`],
    ['34-profile-emoji', `return window.__audit.click('Эмодзи 🌿')`],
    ['35-settings', `window.__audit.dismiss(); return window.__audit.clickExact('.chrome-button', 'Настройки')`],
    ['36-settings-general', `return window.__audit.clickExact('.settings-nav button, [role="dialog"] button', 'Общие')`],
    ['37-settings-sound', `return window.__audit.click('Тактильные звуки')`],
    ['38-settings-hints', `return window.__audit.click('Анимация напоминаний')`],
    ['39-settings-english', `const button = [...document.querySelectorAll('[role="radio"], button')].find(item => (item.innerText || '').trim() === 'English'); if (!button) return { ok: false, reason: 'нет English' }; button.click(); return { ok: true }`],
    ['40-settings-russian', `const button = [...document.querySelectorAll('[role="radio"], button')].find(item => /Русский/.test(item.innerText || '')); if (!button) return { ok: false, reason: 'нет Русский' }; button.click(); return { ok: true }`],
    ['41-settings-passwords', `return window.__audit.click('Пароли и ключи')`],
    ['42-settings-calendars', `return window.__audit.click('Календар')`],
    ['43-settings-mail', `return window.__audit.click('Почта Gmail')`],
    ['44-settings-news', `return window.__audit.click('Дайджест')`],
    ['45-settings-privacy', `return window.__audit.click('Приватность')`],
    ['46-settings-profile', `return window.__audit.clickExact('.settings-nav button, [role="dialog"] button', 'Профиль')`],
    ['47-search', `window.__audit.dismiss(); return window.__audit.clickExact('.chrome-button', 'Поиск в Доме')`],
    ['48-search-type', `const input = document.querySelector('[role="dialog"] input, [role="dialog"] textarea'); if (!input) return { ok: false, reason: 'нет поля поиска' }; const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto, 'value').set; setter.call(input, 'логотип'); input.dispatchEvent(new Event('input', { bubbles: true })); return { ok: true }`],
    ['49-assistant', `window.__audit.dismiss(); return window.__audit.click('ИИ в Доме')`],
    ['50-tab-desk', `window.__audit.dismiss(); return window.__audit.click('Обзор и поиск вкладок')`],
    ['51-history', `window.__audit.dismiss(); window.__audit.press('h', { ctrlKey: true }); return { ok: true, history: Boolean(document.querySelector('[role="dialog"]')) }`],
    ['52-capture', `window.__audit.dismiss(); return window.__audit.clickExact('.dock-entry-button, .calm-dock button, button', 'Записать')`],
    ['53-focus', `window.__audit.dismiss(); return window.__audit.clickExact('button', 'Фокус')`],
    ['54-player-menu', `window.__audit.dismiss(); return window.__audit.click('Меню плеера')`],
    ['55-space', `window.__audit.dismiss(); const button = [...document.querySelectorAll('.chrome-space')].find(item => item.textContent.includes('Обновить') || item.textContent.includes('логотип')); if (!button) return { ok: false, reason: 'нет кабинета' }; button.click(); return { ok: true }`],
    ['56-space-filter', `return window.__audit.clickExact('.cabinet-contents button, .space-panel-filters button, button', 'Документы')`],
    ['57-space-menu', `const button = document.querySelector('.cabinet-contents [aria-haspopup="menu"], .space-detail [aria-haspopup="menu"]'); if (!button) return { ok: false, reason: 'нет меню кабинета' }; button.click(); return { ok: true }`],
    ['58-rename', `return window.__audit.clickFirst(['Переименовать пространство', 'Переименовать'])`],
    ['59-new-space', `window.__audit.dismiss(); return window.__audit.click('Создать пространство')`],
    ['60-new-space-tone', `return window.__audit.clickFirst(['Сирень', 'Лаванда', 'Шалфей'])`],
    ['61-browser', `window.__audit.dismiss(); return window.__audit.clickExact('.chrome-button', 'Браузер')`],
    ['62-browser-island', `return window.__audit.clickFirst(['Уведомления', 'Сейчас', 'Нет срочного', 'Центр внимания'])`],
    ['63-browser-day', `return window.__audit.clickFirst(['План дня', 'Открыть план'])`],
    ['64-browser-home', `return window.__audit.clickFirst(['Вернуться в дашборд', 'Вернуться', 'На главную'])`],
    ['65-ask-ai', `window.__audit.dismiss(); return window.__audit.click('Спросить ИИ')`],
    ['66-undated', `window.__audit.dismiss(); return window.__audit.click('Мысли без даты')`]
  ]

  for (const [name, source] of steps) {
    await runStep(name, source)
  }

  await closeLayers()
  await runStep('51-home-after', `const home = document.querySelector('.brand'); if (home) home.click(); return { ok: true }`)

  const after = await window.webContents.executeJavaScript('window.__audit.controls()')
  const report = {
    controlsOnHome: inventory.length,
    controlsAfter: after.length,
    steps: shots.length,
    findings: findings.map(item => ({
      name: item.name,
      action: item.action,
      errors: item.errors,
      issues: item.probe?.issues || [],
      tiny: item.probe?.tiny || [],
      dialogs: item.probe?.dialogs || []
    }))
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`[audit] steps=${shots.length} findings=${findings.length} homeControls=${inventory.length}`)
  app.exit(findings.some(item => item.action?.ok === false || item.action?.threw || item.errors?.length) ? 1 : 0)
}

app.whenReady().then(run).catch(error => {
  console.error(error)
  app.exit(1)
})
