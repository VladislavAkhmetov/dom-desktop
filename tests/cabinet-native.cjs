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
const saveShot = (directory, name, image) => {
  if (!image) return
  try { fs.writeFileSync(path.join(directory, name), image.toPNG()) } catch { /* кадр проверки необязателен */ }
}

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
  ipcMain.handle('resource:recentFiles', async () => [
    { name: 'test-document.txt', target: testDocPath, modifiedAt: new Date().toISOString() }
  ])

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
  ipcMain.handle('browser:respondPermission', (_event, id, allowed) => manager.respondPermission(id, allowed))
  ipcMain.handle('browser:adblock:status', (_event, tabId, hostname) => manager.adblock?.getStatus(tabId, hostname) || { enabled: true, siteDisabled: false, blockedCount: 0, blockCookies: true, isDark: false })
  ipcMain.handle('browser:adblock:toggle-site', (_event, hostname, disabled) => {
    manager.adblock?.toggleSite(hostname, disabled)
    return manager.adblock?.getStatus(null, hostname)
  })
  ipcMain.handle('browser:adblock:toggle-cookies', (_event, enabled) => {
    manager.adblock?.toggleCookies(enabled)
    return manager.adblock?.getStatus(null, null)
  })
  ipcMain.handle('browser:adblock:toggle-global', (_event, enabled) => {
    manager.adblock?.toggleGlobal(enabled)
    return manager.adblock?.getStatus(null, null)
  })
  ipcMain.handle('browser:dark:toggle', async (_event, tabId, hostname, enabled) => {
    manager.adblock?.toggleDarkSite(hostname, enabled)
    await manager.applyDarkMode(tabId, enabled)
    return manager.adblock?.getStatus(tabId, hostname)
  })
  ipcMain.handle('browser:reader:content', async (_event, tabId) => manager.getReaderContent(tabId))
  ipcMain.handle('browser:translate:text', async (_event, text) => text)
  ipcMain.handle('browser:translate:tab', async (_event, tabId) => manager.translateTab(tabId))
  ipcMain.handle('browser:suggest', async () => [])
  ipcMain.handle('vault:credentials:list', async () => [])
  ipcMain.on('page:signal', (event, value) => manager.pageSignal(event.sender, value))

  const osWindows = require('../electron/os-windows.cjs')
  ipcMain.handle('windows:list-open', () => osWindows.getOpenWindows(process.pid))
  ipcMain.handle('windows:minimize', (_event, toPark, activeKeep) => { osWindows.minimizeWindows(toPark, activeKeep); return true })
  ipcMain.handle('windows:restore', (_event, hwndList, focusDom) => { osWindows.restoreWindows(hwndList, focusDom); return true })
  ipcMain.handle('windows:focus', (_event, hwnd) => osWindows.focusWindow(hwnd))

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
  const dashImg = await window.webContents.capturePage().catch(() => null)
  saveShot(ssDir, 'cabinet-native-dashboard.png', dashImg)

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
  await waitFor(async () => {
    const s = await storage.get()
    return s.activeSpaceId === 'space-work'
  }, 'активное пространство переключено на Работа в SQLite')
  await waitFor(() => renderer(() => document.querySelector('.chrome-space.selected')?.textContent?.trim() === 'Работа'), 'пространство Работа выбрано в React')
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
  const matImg = await window.webContents.capturePage().catch(() => null)
  saveShot(ssDir, 'cabinet-native-materials.png', matImg)

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
    const openBtn = document.querySelector('.space-threshold .resume-primary, .space-threshold [data-workspace-navigation]')
      || [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Открыть вкладки'))
    if (!openBtn) throw new Error('openBtn not found in DOM!')
    openBtn.click()
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
  const browserImg = await window.webContents.capturePage().catch(() => null)
  saveShot(ssDir, 'cabinet-native-browser.png', browserImg)

  // The island must keep every toolbar action reachable at both densities.
  const layoutDir = path.join(testDir, 'attention-layout')
  fs.mkdirSync(layoutDir, { recursive: true })
  const { diffState } = await import('../shared/state.js')
  // Hidden windows defer compositor animation frames; measure and capture the settled UI.
  const snapshotStyle = await window.webContents.insertCSS('.browser-topbar-main, .browser-topbar-main * { transition: none !important; animation: none !important; }')
  const quickActionX = await renderer(() => document.querySelector('.browser-quick-actions').getBoundingClientRect().x)
  const notice = { id: 'layout-notice', title: 'Отправить макет', kind: 'task', createdAt: new Date().toISOString(), dueAt: new Date(Date.now() - 2 * 60000).toISOString(), done: false }
  for (const active of [false, true]) {
    const current = await storage.get()
    const reminders = current.reminders.filter(item => item.id !== notice.id)
    const remote = await storage.apply(diffState(current, { ...current, reminders: active ? [...reminders, notice] : reminders }))
    window.webContents.send('state:changed', remote)
    await renderer(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })
    try {
      await waitFor(async () => await renderer(() => document.querySelector('.browser-attention-island').dataset.wide) === String(active), 'плотность острова')
    } catch (error) {
      console.error('Attention state:', active, await renderer(() => ({ wide: document.querySelector('.browser-attention-island').dataset.wide, signal: document.querySelector('.browser-attention-island').dataset.signal, text: document.querySelector('.browser-day-pulse').textContent, focus: document.activeElement?.className })))
      throw error
    }
    for (const width of [1440, 1024, 768, 390, 320]) {
      window.setSize(width, 900)
      await new Promise(resolve => setTimeout(resolve, 350))
      const layout = await renderer(() => {
        const actions = [...document.querySelectorAll('.browser-topbar-main button')].filter(button => button.getClientRects().length).map(button => {
          const rect = button.getBoundingClientRect()
          return { label: button.getAttribute('aria-label') || button.title || button.textContent, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
        })
        const island = document.querySelector('.browser-attention-island')
        return { viewport: innerWidth, actions, quickX: document.querySelector('.browser-quick-actions').getBoundingClientRect().x, islandWidth: island.getBoundingClientRect().width, wide: island.dataset.wide }
      })
      assert.ok(active ? layout.islandWidth >= 200 : layout.islandWidth <= 50, `${width}px: фактическая ширина острова ${layout.islandWidth}, data-wide=${layout.wide}`)
      for (const action of layout.actions) assert.ok(action.x >= -1 && action.right <= layout.viewport + 1 && action.right - action.x >= 24, `${width}px: ${action.label} остаётся доступной в окне`)
      for (let a = 0; a < layout.actions.length; a++) for (let b = a + 1; b < layout.actions.length; b++) {
        const first = layout.actions[a], second = layout.actions[b]
        const overlapX = Math.min(first.right, second.right) - Math.max(first.x, second.x)
        const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.y, second.y)
        assert.ok(overlapX <= 1 || overlapY <= 1, `${width}px: ${first.label} не перекрывает ${second.label}`)
      }
      if (width === 1440) assert.ok(Math.abs(layout.quickX - quickActionX) <= 1, 'Быстрые действия не сдвигаются при расширении острова')
      if ([1440, 768, 320].includes(width)) {
        const height = await renderer(() => Math.ceil(document.querySelector('.browser-topbar').getBoundingClientRect().bottom + 48))
        const shot = await window.webContents.capturePage({ x: 0, y: 0, width: layout.viewport, height }).catch(() => window.webContents.capturePage().catch(() => null))
        if (shot) fs.writeFileSync(path.join(layoutDir, `toolbar-${width}-${active ? 'signal' : 'quiet'}.png`), shot.toPNG())
      }
    }
  }
  window.setSize(1440, 900)
  await renderer(() => document.querySelector('.browser-day-pulse').click())
  await waitFor(() => manager.blocked, 'карточка внимания перекрывает нативную страницу')
  assert.ok(await renderer(() => [...document.querySelectorAll('.island-actions button')].some(button => button.textContent === 'Сделано')), 'Действие напоминания доступно вторым нажатием')
  await renderer(() => document.querySelector('[aria-label="Свернуть уведомление"]').click())
  await waitFor(() => !manager.blocked, 'закрытие карточки возвращает нативную страницу')
  const withoutNotice = await storage.apply([{ op: 'remove', path: ['reminders', '@layout-notice'] }])
  window.webContents.send('state:changed', withoutNotice)
  await window.webContents.removeInsertedCSS(snapshotStyle)
  console.log('Attention layout passed: five widths, two densities, stable quick actions and native overlay. Screenshots: ' + layoutDir)

  // 14. Verify WebContentsView is hidden when returning to dashboard
  await renderer(() => document.querySelector('#root .browser-home').click())
  await waitFor(() => !liveTab.desired, 'страница скрыта при возврате в дашборд')
  assert.equal(liveTab.desired, false, 'Нативная страница скрыта при возврате в дашборд')
  await waitFor(() => renderer(() => !document.querySelector('[data-workspace-transition]')), 'обратный переход завершён')
  await renderer(() => (document.querySelector('#root .space-threshold .resume-primary, #root .space-threshold [data-workspace-navigation], #root .space-open-tabs'))?.click())
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

  // 16. Verify Windows window management bridge in native renderer
  const openWindows = await window.webContents.executeJavaScript('window.dom.osWindows.listOpen()')
  assert.ok(Array.isArray(openWindows), 'window.dom.osWindows.listOpen() должен возвращать массив в Electron')
  console.log(`[Native Test] osWindows.listOpen() вернул ${openWindows.length} окон`)

  server.close()
  console.log('Cabinet Native Tests passed: isolation, migration, persistence, real tabs, document picking, osWindows and dashboard rules OK.')
  app.exit(0)
}

app.whenReady().then(run).catch(err => {
  console.error('Cabinet Native Test failure:', err && err.stack ? err.stack : err)
  if (server) server.close()
  app.exit(1)
})
