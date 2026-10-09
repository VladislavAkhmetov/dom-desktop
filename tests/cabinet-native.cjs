const { app, BrowserWindow, ipcMain, shell } = require('electron')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const { createStorage } = require('../electron/storage.cjs')
const { BrowserManager } = require('../electron/browser.cjs')

const testDir = path.resolve(__dirname, '../.cache/cabinet-tests', String(Date.now()))
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
  // 1. Create a local HTTP server
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html>
<html lang="ru">
<head><title>Кабинет Тест Страница</title></head>
<body>
  <h1>Рабочая страница кабинета</h1>
  <p>Проверка отображения в реальном WebContentsView</p>
  <input id="test-input" value="Тестовые данные">
</body>
</html>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const testUrl = `http://127.0.0.1:${port}/`

  // 2. Prepare test local file
  const testDocPath = path.join(testDir, 'test-document.txt')
  fs.writeFileSync(testDocPath, 'Тестовый документ для материалов кабинета dombro.', 'utf8')

  // 3. Write initial legacy state to SQLite directory (without cabinetVersion)
  const legacyInitialState = {
    version: 1,
    spaces: [
      {
        id: 'space-work',
        name: 'Работа',
        tone: 'sage',
        pinned: true,
        resources: [
          { id: 'res-link', name: 'Сайт проекта', kind: 'link', target: testUrl, createdAt: new Date().toISOString() }
        ],
        activeSession: {
          tabs: [
            { id: 'tab-1', title: 'Рабочая страница', url: testUrl }
          ],
          activeTabId: 'tab-1'
        }
      }
    ],
    reminders: [],
    events: [],
    backgroundImage: '/backgrounds/abstract-hills.jpg'
  }
  fs.writeFileSync(path.join(testDir, 'state.json'), JSON.stringify(legacyInitialState))

  storage = createStorage(testDir)
  await storage.ready

  // 4. Create BrowserWindow with cabinet-pilot flags
  window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      additionalArguments: ['--cabinet-pilot']
    }
  })

  window.webContents.on('console-message', event => console.log('Renderer [' + event.level + ']: ' + event.message))

  manager = new BrowserManager(window, 'persist:dom-cabinet-browser')

  // Wire up IPC handlers mirroring electron/main.cjs
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

  let pickedFile = testDocPath
  ipcMain.handle('resource:pick', async (_event, kind) => {
    if (kind === 'file') return pickedFile
    return null
  })

  let openedResource = null
  ipcMain.handle('resource:open', async (_event, resource) => {
    openedResource = resource
    if (resource.kind === 'file' && fs.existsSync(resource.target)) {
      return { ok: true }
    }
    if (resource.kind === 'link') {
      return { ok: true }
    }
    return { ok: false, error: 'Файл не найден' }
  })

  ipcMain.handle('browser:show', (_event, value) => manager.show(value))
  ipcMain.handle('browser:hide', (_event, id) => manager.hide(id))
  ipcMain.handle('browser:move', (_event, id, spaceId) => manager.move(id, spaceId))
  ipcMain.handle('browser:block', (_event, value) => manager.block(value))
  ipcMain.handle('browser:close', (_event, id) => manager.close(id))
  ipcMain.handle('browser:park', (_event, ids) => manager.park(ids))
  ipcMain.handle('browser:action', (_event, id, action) => manager.action(id, action))
  ipcMain.on('page:signal', (event, value) => manager.pageSignal(event.sender, value))

  // 5. Load UI with search: 'cabinet=1'
  await window.loadFile(path.join(__dirname, '../dist/index.html'), { search: 'cabinet=1' })

  // 6. Verify cabinet pilot mode in renderer
  await waitFor(() => window.webContents.executeJavaScript('Boolean(window.dom && window.dom.cabinetPilot)'), 'window.dom.cabinetPilot')
  const isPilotInRenderer = await window.webContents.executeJavaScript('window.dom.cabinetPilot')
  assert.equal(isPilotInRenderer, true, 'window.dom.cabinetPilot должен быть true')

  // 7. Verify migration to cabinetVersion=1 persisted to SQLite
  await waitFor(async () => {
    const s = await storage.get()
    return s.cabinetVersion === 1
  }, 'миграция cabinetVersion=1 в SQLite')
  const migratedState = await storage.get()
  assert.equal(migratedState.cabinetVersion, 1, 'База данных должна быть мигрирована на cabinetVersion=1')

  // 8. Verify Dashboard frame is preserved on start
  await waitFor(() => renderer(() => Boolean(document.querySelector('.app-shell:not(.browsing)') && document.querySelector('.hub-ambient'))), 'дашборд загружен')
  assert.equal(await renderer(() => Boolean(document.querySelector('.app-shell.browsing'))), false, 'При старте браузер не должен открываться на весь экран')

  // Ensure screenshots dir exists
  const ssDir = path.resolve(__dirname, '../qa/screenshots')
  fs.mkdirSync(ssDir, { recursive: true })

  // Capture dashboard screenshot
  await new Promise(r => setTimeout(r, 600))
  const dashImg = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, 'cabinet-native-dashboard.png'), dashImg.toPNG())

  // 9. Verify clicking "+" in dashboard creates an empty cabinet inside dashboard without popup
  const plusBtnExists = await renderer(() => Boolean(document.querySelector('button[aria-label="Создать пространство"], button[aria-label="Новое пространство"], .space-add-trigger')))
  assert.ok(plusBtnExists, 'Кнопка создания пространства должна присутствовать')
  await renderer(() => {
    const btn = document.querySelector('button[aria-label="Создать пространство"], button[aria-label="Новое пространство"], .space-add-trigger')
    if (btn) btn.click()
  })

  await waitFor(async () => {
    const s = await storage.get()
    return s.spaces.length > 1
  }, 'создание нового кабинета в базе данных')
  assert.equal(await renderer(() => Boolean(document.querySelector('.app-shell.browsing'))), false, 'Создание кабинета из дашборда не должно выбивать в браузер')

  // 10. Verify clicking a space in dashboard stays inside dashboard
  await renderer(() => {
    const spaceBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Работа' || b.getAttribute('aria-label')?.includes('Работа'))
    if (spaceBtn) spaceBtn.click()
  })
  assert.equal(await renderer(() => Boolean(document.querySelector('.app-shell.browsing'))), false, 'Выбор пространства в дашборде остаётся в дашборде')

  // 11. Verify adding a document reference on desktop uses bridge.pickResource directly
  await renderer(() => {
    const directDocBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Документ')
    if (directDocBtn) {
      directDocBtn.click()
      return
    }
    const addMenuBtn = document.querySelector('button[aria-label="Добавить в пространство"]')
    if (addMenuBtn) addMenuBtn.click()
  })
  await renderer(() => {
    const docOption = [...document.querySelectorAll('.action-menu-popover button, button')].find(b => b.textContent?.trim() === 'Документ')
    if (docOption) docOption.click()
  })
  // Give time for async pickResource to resolve and commit
  await waitFor(async () => {
    const s = await storage.get()
    return s.spaces.some(sp => sp.resources.some(r => r.kind === 'file'))
  }, 'добавление документа через нативный выбор файла')
  const stateWithDoc = await storage.get()
  const addedDoc = stateWithDoc.spaces.flatMap(sp => sp.resources).find(r => r.kind === 'file')
  assert.ok(addedDoc, 'Документ должен быть добавлен в ресурсы пространства')
  assert.equal(addedDoc.target, testDocPath, 'Путь документа должен совпадать с выбранным файлом')

  // Capture materials panel screenshot
  const matImg = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, 'cabinet-native-materials.png'), matImg.toPNG())

  // 12. Verify opening a document uses bridge.openResource
  openedResource = null
  await renderer(() => {
    const fileCard = [...document.querySelectorAll('.resource-card')].find(c => c.querySelector('.kind-file'))
    const resBtn = document.querySelector('.cabinet-material-card[data-resource-kind="file"] .cabinet-material-open') || (fileCard ? fileCard.querySelector('.resource-open') : document.querySelector('.resource-open'))
    if (resBtn) resBtn.click()
  })
  await waitFor(() => Boolean(openedResource), 'вызов bridge.openResource')
  assert.ok(openedResource, 'bridge.openResource должен быть вызван для файла')
  assert.equal(openedResource.target, testDocPath, 'openResource должен получить правильный путь файла')

  // 13. Verify explicit browser action opens browser workstage
  const entry = await renderer(async () => {
    const openBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Открыть вкладки' || b.getAttribute('aria-label') === 'Браузер')
    if (openBtn) openBtn.click()
    // React commits the click after its event batch; the 320ms journey is still running.
    while (!document.querySelector('#root .app-shell.browsing')) await new Promise(resolve => setTimeout(resolve, 0))
    return { live: Boolean(document.querySelector('#root .app-shell.browsing')), journey: Boolean(document.querySelector('[data-workspace-transition]')) }
  })
  assert.equal(entry.live, true, 'Живой браузер открывается до окончания перехода')
  assert.equal(entry.journey, true, 'Открытие вкладок создаёт визуальный переход')
  await waitFor(() => renderer(() => Boolean(document.querySelector('.app-shell.browsing'))), 'браузерный режим открыт')
  assert.equal(await renderer(() => Boolean(document.querySelector('.workstage-container'))), true, 'workstage-container виден')

  // NativePane creates the page at its final bounds while the transition covers it.
  await waitFor(() => manager.tabs.has('tab-1'), 'WebContentsView вкладки создан')
  const liveTab = manager.tabs.get('tab-1')
  await waitFor(() => liveTab.view.webContents.executeJavaScript('Boolean(document.querySelector("#test-input"))').catch(() => false), 'сайт загружен в WebContentsView')
  const inputValue = await liveTab.view.webContents.executeJavaScript('document.querySelector("#test-input")?.value')
  assert.equal(inputValue, 'Тестовые данные', 'Реальный сайт загружен в WebContentsView')
  await waitFor(() => renderer(() => !document.querySelector('[data-workspace-transition]')), 'переход завершён')
  await waitFor(() => !manager.blocked && liveTab.desired, 'живая страница доступна после перехода')
  const expectedBounds = await renderer(() => {
    const r = document.querySelector('#root .native-viewport').getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
  })
  assert.deepEqual(liveTab.view.getBounds(), expectedBounds, 'Анимация не меняет размеры нативной страницы')
  await liveTab.view.webContents.executeJavaScript('document.querySelector("#test-input").value = "Продолжаем работу"')

  // Capture browser screenshot
  const browserImg = await window.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, 'cabinet-native-browser.png'), browserImg.toPNG())

  // 14. Verify WebContentsView is hidden when returning to dashboard
  await renderer(() => document.querySelector('#root .browser-home').click())
  await waitFor(() => !liveTab.desired, 'страница скрыта при возврате в дашборд')
  assert.equal(liveTab.desired, false, 'Нативная страница скрыта при возврате в дашборд')
  await waitFor(() => renderer(() => !document.querySelector('[data-workspace-transition]')), 'обратный переход завершён')
  await renderer(() => document.querySelector('#root .space-open-tabs').click())
  await waitFor(() => liveTab.desired && !manager.blocked, 'повторный вход в браузер')
  assert.equal(await liveTab.view.webContents.executeJavaScript('document.querySelector("#test-input").value'), 'Продолжаем работу', 'Возврат сохраняет ввод на живой странице')

  // 15. Verify persistence across restart
  await storage.close()
  const reloadedStorage = createStorage(testDir)
  await reloadedStorage.ready
  const persistedState = await reloadedStorage.get()
  assert.equal(persistedState.cabinetVersion, 1, 'cabinetVersion=1 сохранился после перезапуска')
  assert.ok(persistedState.spaces.length >= 2, 'Кабинеты сохранились после перезапуска')
  assert.ok(persistedState.spaces.some(sp => sp.resources.some(r => r.kind === 'file')), 'Документ сохранился после перезапуска')
  await reloadedStorage.close()

  server.close()
  console.log('Cabinet Native Tests passed: isolation, migration, persistence, real tabs, document picking and dashboard rules OK.')
  app.exit(0)
}

app.whenReady().then(run).catch(err => {
  console.error('Cabinet Native Test failure:', err)
  if (server) server.close()
  app.exit(1)
})
