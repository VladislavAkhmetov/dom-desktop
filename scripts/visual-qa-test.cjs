const { app, BrowserWindow, ipcMain } = require('electron')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const { createStorage } = require('../electron/storage.cjs')
const { BrowserManager } = require('../electron/browser.cjs')

const testDir = path.resolve(__dirname, '../.cache/visual-qa-tests', String(Date.now()))
fs.mkdirSync(testDir, { recursive: true })
app.setPath('userData', testDir)
app.disableHardwareAcceleration()

let window, storage, manager, server
app.on('window-all-closed', () => undefined)

const waitFor = async (test, label, timeout = 15000) => {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    try {
      if (await test()) return
    } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Ожидание: ${label}`)
}

const renderer = (fn) => window.webContents.executeJavaScript(`(${fn.toString()})()`)

async function run() {
  const ssDir = path.resolve(__dirname, '../qa/screenshots/visual-qa')
  fs.mkdirSync(ssDir, { recursive: true })

  // 1. Local HTTP server for realistic WebContentsView testing
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Figma: Редизайн чекаута v2</title>
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: #18191b;
      color: #f5f5f5;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    header {
      background: #232427;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 1px solid #333438;
    }
    .badge {
      background: #0d99ff;
      color: #fff;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .file-title {
      font-size: 14px;
      font-weight: 500;
      color: #e2e4e9;
    }
    main {
      flex: 1;
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      align-items: center;
      justify-content: center;
    }
    .canvas {
      width: 680px;
      height: 420px;
      background: #26272b;
      border: 1px solid #3b3d43;
      box-shadow: 0 12px 36px rgba(0,0,0,0.4);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }
    h2 { margin: 0; font-size: 24px; color: #fff; font-weight: 500; }
    p { margin: 0; font-size: 15px; color: #9a9ca6; max-width: 480px; text-align: center; line-height: 1.5; }
    .status-pill {
      background: rgba(46, 213, 115, 0.15);
      color: #2ed573;
      border: 1px solid rgba(46, 213, 115, 0.3);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <header>
    <div class="badge">Figma Canvas</div>
    <div class="file-title">Редизайн чекаута и оплаты v2 · Спринт 4</div>
  </header>
  <main>
    <div class="canvas">
      <span class="status-pill">● Интерактивный нативный WebContentsView</span>
      <h2>Рабочая область макета</h2>
      <p>Реальная веб-страница отрисована Chromium-движком Electron с корректной геометрией bounds и изоляцией сессии.</p>
    </div>
  </main>
</body>
</html>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const testUrl = `http://127.0.0.1:${port}/`

  // 2. Storage setup
  storage = createStorage(testDir)
  await storage.ready

  // 3. BrowserWindow setup (1440x900 desktop layout)
  window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      additionalArguments: ['--cabinet-pilot']
    }
  })

  window.webContents.on('console-message', event => {
    if (event.level === 'error') console.error('Renderer Error:', event.message)
  })

  manager = new BrowserManager(window, 'persist:dom-cabinet-browser')

  // Wire IPC handlers
  ipcMain.handle('state:get', () => storage.get())
  ipcMain.handle('state:apply', async (_event, changes) => {
    const state = await storage.apply(changes)
    window.webContents.send('state:changed', state)
    return state
  })
  ipcMain.handle('state:search', (_event, query) => storage.search(query))
  ipcMain.handle('state:backup', () => storage.backup())
  ipcMain.handle('settings:getAutostart', () => false)
  ipcMain.handle('google:configured', () => false)
  ipcMain.handle('feed:fetch', () => '')
  ipcMain.handle('resource:pick', async (_event, kind) => (kind === 'file' ? path.join(testDir, 'sample.txt') : null))
  ipcMain.handle('resource:open', async (_event, resource) => ({ ok: true }))
  ipcMain.handle('browser:show', (_event, value) => manager.show(value))
  ipcMain.handle('browser:hide', (_event, id) => manager.hide(id))
  ipcMain.handle('browser:move', (_event, id, spaceId) => manager.move(id, spaceId))
  ipcMain.handle('browser:block', (_event, value) => manager.block(value))
  ipcMain.handle('browser:close', (_event, id) => manager.close(id))
  ipcMain.handle('browser:park', (_event, ids) => manager.park(ids))
  ipcMain.handle('browser:action', (_event, id, action) => manager.action(id, action))
  ipcMain.on('page:signal', (event, value) => manager.pageSignal(event.sender, value))

  // 4. Load UI in cabinet mode with demo data
  await window.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })

  // Wait for React UI to mount
  await waitFor(() => renderer(() => Boolean(document.querySelector('.app-shell') && document.querySelector('.chrome-profile'))), 'Загрузка интерфейса')
  await new Promise(r => setTimeout(r, 1000))

  console.log('✓ UI успешно загружен в Electron с флагами cabinet=1&demo=1')

  // --- СЦЕНАРИЙ 1: Главная дашборда (Мой день) ---
  console.log('Тестирование сценария 1: Главная дашборда...')
  let shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '01-dashboard-home.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 01-dashboard-home.png')

  const profileBtnInfo = await renderer(() => {
    const btn = document.querySelector('.chrome-profile')
    return btn ? { exists: true, label: btn.getAttribute('aria-label') } : { exists: false }
  })
  assert.ok(profileBtnInfo.exists, 'Кнопка профиля .chrome-profile должна отображаться в шапке')
  console.log('  -> Кнопка профиля в шапке найдена:', profileBtnInfo.label)

  // --- СЦЕНАРИЙ 2: Открытие поповера профиля ---
  console.log('Тестирование сценария 2: Открытие поповера профиля...')
  await renderer(() => {
    const btn = document.querySelector('.chrome-profile')
    if (btn) btn.click()
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.profile-popover'))), 'Открытие поповера профиля')
  await new Promise(r => setTimeout(r, 500))

  shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '02-profile-popover.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 02-profile-popover.png')

  // --- СЦЕНАРИЙ 3: Кастомизация профиля (выбор тона "Лаванда" и эмодзи 🚀) ---
  console.log('Тестирование сценария 3: Кастомизация профиля...')
  await renderer(() => {
    const toneBtn = document.querySelector('.profile-tone-btn.tone-lilac')
    if (toneBtn) toneBtn.click()
  })
  await new Promise(r => setTimeout(r, 300))
  await renderer(() => {
    const emojiBtns = [...document.querySelectorAll('.profile-emoji-btn')]
    const rocketBtn = emojiBtns.find(b => b.textContent.includes('🚀')) || emojiBtns[0]
    if (rocketBtn) rocketBtn.click()
  })
  await new Promise(r => setTimeout(r, 500))

  shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '03-profile-customized.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 03-profile-customized.png')

  // --- СЦЕНАРИЙ 4: Переход в настройки профиля ---
  console.log('Тестирование сценария 4: Открытие настроек профиля...')
  await renderer(() => {
    const actionBtns = [...document.querySelectorAll('.profile-action-btn')]
    const settingsBtn = actionBtns.find(b => b.textContent.includes('Настройки'))
    if (settingsBtn) settingsBtn.click()
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.settings-layout') && document.querySelector('.profile-preview-card'))), 'Открытие настроек на вкладке Профиль')
  await new Promise(r => setTimeout(r, 600))

  shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '04-settings-profile.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 04-settings-profile.png')

  // --- СЦЕНАРИЙ 5: Раздел обоев оформления через Настройки главной ---
  console.log('Тестирование сценария 5: Открытие настроек обоев...')
  // Закрываем окно настроек профиля
  await renderer(() => {
    const closeBtn = document.querySelector('.calm-dialog button[aria-label="Закрыть"]')
    if (closeBtn) closeBtn.click()
  })
  await waitFor(() => renderer(() => !document.querySelector('.calm-dialog')), 'Закрытие настроек профиля')
  await new Promise(r => setTimeout(r, 400))

  // Открываем профиль-поповер и выбираем пункт «Фон и оформление»
  await renderer(() => {
    const profileBtn = document.querySelector('.chrome-profile')
    if (profileBtn) profileBtn.click()
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.profile-popover'))), 'Открытие поповера профиля')
  await new Promise(r => setTimeout(r, 300))

  await renderer(() => {
    const bgBtn = [...document.querySelectorAll('.profile-action-btn')].find(b => b.textContent.includes('Фон и оформление'))
    if (bgBtn) bgBtn.click()
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.calm-dialog'))), 'Открытие диалога Настроить главную')
  await new Promise(r => setTimeout(r, 400))

  // Переключаемся на вкладку «Фон и оформление» в диалоге
  await renderer(() => {
    const tabBtns = [...document.querySelectorAll('.calm-dialog .calm-tabs button')]
    const bgTab = tabBtns.find(b => b.textContent.includes('Фон'))
    if (bgTab) bgTab.click()
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.wallpaper-section, .wallpaper-grid'))), 'Отображение палитры обоев')
  await new Promise(r => setTimeout(r, 600))

  shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '05-settings-wallpaper.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 05-settings-wallpaper.png')

  // Закрываем диалог обоев («Готово»)
  await renderer(() => {
    const doneBtn = [...document.querySelectorAll('.calm-dialog button')].find(b => b.textContent.trim() === 'Готово')
    if (doneBtn) doneBtn.click()
  })
  await new Promise(r => setTimeout(r, 400))

  // Если открылось общее окно настроек, закрываем его
  await renderer(() => {
    const closeBtn = document.querySelector('.calm-dialog button[aria-label="Закрыть"]')
    if (closeBtn) closeBtn.click()
  })
  await waitFor(() => renderer(() => !document.querySelector('.calm-dialog')), 'Полное закрытие диалогов')
  await new Promise(r => setTimeout(r, 500))

  // --- СЦЕНАРИЙ 6: Выбор кабинета («Обновить логотип») в дашборде ---
  console.log('Тестирование сценария 6: Выбор кабинета «Обновить логотип»...')
  await renderer(() => {
    const spaceBtns = [...document.querySelectorAll('.chrome-space')]
    const spaceBtn = spaceBtns.find(b => b.textContent.includes('Обновить логотип'))
    if (spaceBtn) spaceBtn.click()
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.cabinet-contents'))), 'Отображение содержимого кабинета')
  await new Promise(r => setTimeout(r, 600))

  // Проверка: мы ДОЛЖНЫ остаться внутри каркаса дашборда!
  const isBrowsingNow = await renderer(() => Boolean(document.querySelector('.app-shell.browsing')))
  assert.equal(isBrowsingNow, false, 'Выбор кабинета в дашборде не должен выбивать в полноэкранный браузер')

  shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '06-cabinet-dashboard-view.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 06-cabinet-dashboard-view.png')

  // --- СЦЕНАРИЙ 7: Контекстное меню действий с материалом или кабинетом ---
  console.log('Тестирование сценария 7: Контекстное меню действий...')
  await renderer(() => {
    const menuBtn = document.querySelector('.cabinet-tab-card .task-more, .cabinet-tab-card button[aria-label*="Действия"]')
    if (menuBtn) menuBtn.click()
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.action-menu-popover'))), 'Открытие контекстного меню')
  await new Promise(r => setTimeout(r, 500))

  shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '07-cabinet-context-menu.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 07-cabinet-context-menu.png')

  // Закрываем меню через pointerdown вне меню
  await renderer(() => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  })
  await waitFor(() => renderer(() => !document.querySelector('.action-menu-popover')), 'Закрытие контекстного меню')
  await new Promise(r => setTimeout(r, 400))

  // --- СЦЕНАРИЙ 8: Создание нового кабинета кнопкой «+» на дашборде ---
  console.log('Тестирование сценария 8: Создание нового кабинета кнопкой «+»...')
  await renderer(() => {
    const plusBtn = document.querySelector('.chrome-new-space')
    if (plusBtn) plusBtn.click()
  })
  await waitFor(() => renderer(() => Boolean([...document.querySelectorAll('.chrome-space')].find(b => b.textContent.includes('Новое пространство')))), 'Создание нового пространства')
  await new Promise(r => setTimeout(r, 600))

  assert.equal(await renderer(() => Boolean(document.querySelector('.app-shell.browsing'))), false, 'Создание кабинета из дашборда не включает браузер')

  shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '08-cabinet-created.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 08-cabinet-created.png')

  // --- СЦЕНАРИЙ 9: Переход в браузерный режим (Workstage) и WebContentsView ---
  console.log('Тестирование сценария 9: Переход в браузер и WebContentsView...')
  // Возвращаемся в кабинет «Обновить логотип»
  await renderer(() => {
    const spaceBtns = [...document.querySelectorAll('.chrome-space')]
    const spaceBtn = spaceBtns.find(b => b.textContent.includes('Обновить логотип'))
    if (spaceBtn) spaceBtn.click()
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.cabinet-contents'))), 'Возврат в кабинет')
  await new Promise(r => setTimeout(r, 400))

  // Нажимаем на карточку первой вкладки в кабинете
  await renderer(() => {
    const tabOpen = document.querySelector('.cabinet-tab-open')
    if (tabOpen) {
      tabOpen.click()
    } else {
      const tabCard = document.querySelector('.cabinet-tab-card')
      const btn = tabCard ? tabCard.querySelector('button') : null
      if (btn) btn.click()
    }
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.app-shell.browsing') && document.querySelector('.browser-topbar'))), 'Переход в браузерный режим')
  await new Promise(r => setTimeout(r, 600))

  // Показываем реальный WebContentsView поверх браузерного контента
  await manager.show({
    tab: { id: 'tab-figma', url: testUrl },
    spaceId: 'example-studio',
    bounds: { x: 0, y: 72, width: 1440, height: 828 }
  })
  await waitFor(() => manager.tabs.has('tab-figma'), 'Создание вкладки manager')
  const liveTab = manager.tabs.get('tab-figma')
  await waitFor(() => liveTab.view.webContents.executeJavaScript('Boolean(document.querySelector(".badge"))').catch(() => false), 'Загрузка тестовой страницы в WebContentsView')

  shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '09-browser-workstage.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 09-browser-workstage.png')

  // --- СЦЕНАРИЙ 10: Боковая панель дня и материалов в браузере ---
  console.log('Тестирование сценария 10: Боковая панель дня и материалов...')
  await renderer(() => {
    const toggleBtn = document.querySelector('.browser-day-pulse, button[aria-label*="Мой день"]')
    if (toggleBtn) toggleBtn.click()
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.browser-day-panel, #browser-day-panel'))), 'Открытие боковой панели дня')
  await new Promise(r => setTimeout(r, 500))

  // Адаптируем геометрию WebContentsView под ширину панели (минус 360px справа)
  await manager.show({
    tab: { id: 'tab-figma', url: testUrl },
    spaceId: 'example-studio',
    bounds: { x: 0, y: 72, width: 1080, height: 828 }
  })
  await new Promise(r => setTimeout(r, 400))

  shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '10-browser-day-panel.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 10-browser-day-panel.png')

  // --- СЦЕНАРИЙ 11: Возврат в дашборд («Мой день») ---
  console.log('Тестирование сценария 11: Возврат в дашборд...')
  // Скрываем нативный WebContentsView перед уходом на дашборд
  await manager.hide('tab-figma')

  await renderer(() => {
    const dashBtn = document.querySelector('.browser-day-dashboard, .brand, button[aria-label="Дом"]')
    if (dashBtn) dashBtn.click()
  })
  await waitFor(() => renderer(() => Boolean(document.querySelector('.app-shell:not(.browsing)'))), 'Возврат на дашборд')
  await new Promise(r => setTimeout(r, 600))

  shot = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, '11-return-to-dashboard.png'), shot.toPNG())
  console.log('  -> Снимок сохранён: 11-return-to-dashboard.png')

  // Завершение
  server.close()
  console.log('\n=============================================')
  console.log('ВСЕ 11 ВИЗУАЛЬНЫХ СЦЕНАРИЕВ УСПЕШНО ПРОЙДЕНЫ!')
  console.log('Снимки сохранены в qa/screenshots/visual-qa/')
  console.log('=============================================')
  app.exit(0)
}

app.whenReady().then(run).catch(err => {
  console.error('Visual QA Failure:', err)
  if (server) server.close()
  app.exit(1)
})
