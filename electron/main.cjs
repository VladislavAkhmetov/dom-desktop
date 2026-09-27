const { app, BrowserWindow, dialog, shell, ipcMain, globalShortcut, Notification, Tray, Menu, nativeImage, safeStorage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { createStorage } = require('./storage.cjs')
const { BrowserManager } = require('./browser.cjs')
const { Vault } = require('./vault.cjs')
const { Gmail } = require('./gmail.cjs')
const { AI } = require('./ai.cjs')
const { fetchLimited } = require('./network.cjs')
const { pathToFileURL } = require('node:url')

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const isDev = process.argv.includes('--dev')
const isSmoke = process.argv.includes('--smoke-test')
if (isSmoke) {
  const id = process.argv.find(value => /^--smoke-id=\d+$/.test(value))?.split('=')[1] || String(process.pid)
  const directory = path.join(app.getPath('temp'), `dom-smoke-${id}`)
  fs.mkdirSync(directory, { recursive: true }); app.setPath('userData', directory)
}
let mainWindow
let tray
let quitting = false
let storage
let checkingReminders = false
let browser
let captureWindow
let vault, gmail, ai
function trustedURL(value) {
  try { const url = new URL(value); return isDev ? url.origin === new URL(DEV_URL).origin && url.pathname === '/' : url.href.split(/[?#]/)[0] === pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href } catch { return false }
}
function trustedHandle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (![mainWindow?.webContents, captureWindow?.webContents].includes(event.sender) || event.senderFrame !== event.sender.mainFrame || !trustedURL(event.senderFrame.url)) throw new Error('Доступ к приложению не разрешён')
    return handler(event, ...args)
  })
}
async function changeState(update) {
  const { diffState } = await import('../shared/state.js')
  const previous = await storage.get(); const state = await storage.apply(diffState(previous, update(previous))); broadcastState(state); return state
}

function broadcastState(state) { mainWindow?.webContents.send('state:changed', state); captureWindow?.webContents.send('state:changed', state) }

async function createIntegrations() {
  vault = new Vault(app.getPath('userData'), safeStorage)
  gmail = new Gmail({ vault, change: changeState, getState: () => storage.get(), openExternal: url => shell.openExternal(url) })
  ai = new AI({ vault, change: changeState, getState: () => storage.get() })
  // Migration is committed only after encryption succeeds. No plaintext fallback.
  const state = await storage.get()
  if (vault.available()) {
    for (const sub of state.calendarSubscriptions || []) if (sub.url && !sub.secretId) {
      vault.set(`calendar:${sub.id}`, sub.url)
      await changeState(previous => ({ ...previous, calendarSubscriptions: previous.calendarSubscriptions.map(item => item.id === sub.id ? { ...item, secretId: `calendar:${sub.id}`, url: '' } : item) }))
    }
  }
  await changeState(previous => ({ ...previous, aiJournal: previous.aiJournal?.map(item => item.status === 'running' ? { ...item, status: 'error', error: 'Приложение завершилось до окончания запроса' } : item) }))
}

trustedHandle('google:configure', (_event, clientId) => gmail.configure(String(clientId).trim()))
trustedHandle('google:configured', () => gmail.configured())
trustedHandle('gmail:connect', () => gmail.connect())
trustedHandle('gmail:sync', (_event, id) => gmail.sync(id))
trustedHandle('gmail:disconnect', (_event, id) => gmail.disconnect(id))
trustedHandle('feed:fetch', (_event, url) => fetchLimited(String(url)))
trustedHandle('material:read', async (_event, id) => {
  const item = (await storage.get()).spaces.flatMap(space => space.resources).find(item => item.id === id)
  if (!item || item.kind === 'app') throw new Error('Материал недоступен')
  if (item.kind === 'link') return { id, title: item.name, url: item.target, text: await fetchLimited(item.target) }
  if (!/\.(txt|md|csv|json|html?|xml|log|js|ts|tsx|jsx|css|py)$/i.test(item.target)) throw new Error('Для этого формата доступно только название. Чтение PDF, Office и Adobe пока не подключено.')
  const details = await fs.promises.stat(item.target)
  if (!details.isFile() || details.size > 2_000_000) throw new Error('Текстовый файл должен быть до 2 МБ')
  return { id, title: item.name, text: (await fs.promises.readFile(item.target, 'utf8')).slice(0, 50000) }
})
trustedHandle('calendar:add', async (_event, name, url) => {
  const target = new URL(String(url).replace(/^webcal:\/\//, 'https://'))
  if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) throw new Error('Проверьте адрес календаря')
  const id = require('node:crypto').randomUUID(); vault.set(`calendar:${id}`, target.toString())
  await changeState(previous => ({ ...previous, calendarSubscriptions: [...(previous.calendarSubscriptions || []), { id, name: String(name).slice(0, 100), secretId: `calendar:${id}`, url: '' }] }))
})
trustedHandle('calendar:source', async (_event, id) => { const sub = (await storage.get()).calendarSubscriptions?.find(item => item.id === id); if (!sub) throw new Error('Календарь отключён'); const url = sub.secretId ? vault.get(sub.secretId) : sub.url; if (!url) throw new Error('Адрес календаря недоступен'); return fetchLimited(url) })
trustedHandle('calendar:remove', async (_event, id) => { vault.set(`calendar:${id}`, undefined); await changeState(previous => ({ ...previous, calendarSubscriptions: previous.calendarSubscriptions?.filter(item => item.id !== id), events: previous.events?.filter(item => item.sourceId !== id) })) })
trustedHandle('ai:configure', (_event, value, key) => ai.configure(value, key))
trustedHandle('ai:run', (event, request) => ai.run(request, value => { if (!event.sender.isDestroyed()) event.sender.send('ai:event', value) }))
trustedHandle('ai:cancel', (_event, id) => ai.cancel(id))

async function showCapture() {
  if (!captureWindow || captureWindow.isDestroyed()) {
    captureWindow = new BrowserWindow({ width: 580, height: 520, show: false, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, backgroundColor: '#f5f8f2', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } })
    captureWindow.on('close', event => { if (!quitting) { event.preventDefault(); captureWindow.hide() } })
    captureWindow.webContents.on('will-navigate', (event, url) => { if (!trustedURL(url)) event.preventDefault() })
    captureWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    if (isDev) await captureWindow.loadURL(`${DEV_URL}/#capture`)
    else await captureWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'capture' })
  }
  if (!isSmoke) { captureWindow.show(); captureWindow.focus() }
}

function showWindow() {
  if (!mainWindow) return
  mainWindow.show()
  mainWindow.focus()
}

function getAssetPath(filename) {
  const candidates = [
    path.join(__dirname, '..', 'build', filename),
    path.join(__dirname, '..', 'dist', filename),
    path.join(__dirname, '..', 'public', filename),
    path.join(process.resourcesPath || '', filename)
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return path.join(__dirname, '..', 'public', filename)
}

function createWindow() {
  const appIcon = getAssetPath('icon.ico')
  mainWindow = new BrowserWindow({
    show: !isSmoke,
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 650,
    title: 'Дом',
    icon: fs.existsSync(appIcon) ? appIcon : getAssetPath('tray.png'),
    backgroundColor: '#a4b8ac',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : { color: '#eef3ec', symbolColor: '#2e453b', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })
  browser = new BrowserManager(mainWindow)
  mainWindow.on('close', event => {
    if (!quitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!trustedURL(url)) { event.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url) }
  })
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => console.error('UI load failed:', code, description))
  if (isDev) mainWindow.loadURL(DEV_URL)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

function createTray() {
  const icon = nativeImage.createFromPath(getAssetPath('tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('Дом — всё нужное рядом')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть Дом', click: showWindow },
    { type: 'separator' },
    { label: 'Выйти', click: () => { quitting = true; app.quit() } }
  ]))
  tray.on('double-click', showWindow)
}

async function checkReminders() {
  if (checkingReminders || !storage) return
  checkingReminders = true
  try {
    const state = await storage.get()
    const due = state.reminders.filter(item => !item.done && !item.notifiedAt && item.dueAt && Date.parse(item.dueAt) <= Date.now())
    const events = (state.events || []).filter(item => !item.allDay && item.noticeMinutes && Date.parse(item.startAt) - Date.now() <= item.noticeMinutes * 60000 && Date.parse(item.startAt) >= Date.now() - 5 * 60000 && !state.notifiedNotices?.includes(`event:${item.id}:${item.startAt}`) && !state.dismissedNotices?.includes(`event:${item.id}:${item.startAt}`))
    if (!due.length && !events.length) return
    const notifiedAt = new Date().toISOString()
    const changes = due.map(item => ({ op: 'set', path: ['reminders', `@${item.id}`, 'notifiedAt'], value: notifiedAt }))
    if (events.length) changes.push({ op: 'set', path: ['notifiedNotices'], value: [...(state.notifiedNotices || []), ...events.map(item => `event:${item.id}:${item.startAt}`)].slice(-1000) })
    const next = await storage.apply(changes)
    broadcastState(next)
    if (Notification.isSupported()) {
      const all = [...due.map(item => item.title), ...events.map(item => `Скоро: ${item.title}`)]
      const bodies = all.length > 3 ? [`Напоминаний: ${all.length}. Откройте Дом, чтобы посмотреть.`] : all
      for (const body of bodies) { const notification = new Notification({ title: 'Дом напоминает', body, silent: true }); notification.on('click', showWindow); notification.show() }
    }
  } catch (error) { console.error('Reminder check failed:', error.message) }
  finally { checkingReminders = false }
}

trustedHandle('state:get', () => storage.get())
trustedHandle('state:save', () => { throw new Error('Используйте операции изменения данных') })
trustedHandle('state:apply', async (_event, changes) => {
  if (!Array.isArray(changes) || changes.length > 40000) throw new Error('Некорректные операции изменения')
  const state = await storage.apply(changes)
  broadcastState(state)
  return state
})
trustedHandle('state:search', (_event, query) => storage.search(String(query).slice(0, 500)))
trustedHandle('state:backup', () => storage.backup())
trustedHandle('resource:pick', async (_event, kind) => {
  if (kind !== 'app' && kind !== 'file') throw new Error('Неизвестный тип ресурса')
  const result = await dialog.showOpenDialog(mainWindow, {
    title: kind === 'app' ? 'Выберите приложение или ярлык' : 'Выберите документ',
    properties: process.platform === 'darwin' && kind === 'app' ? ['openFile', 'openDirectory'] : ['openFile'],
    filters: kind === 'app' ? [{ name: 'Приложения и ярлыки', extensions: process.platform === 'darwin' ? ['app'] : ['exe', 'lnk'] }] : undefined
  })
  return result.canceled ? null : result.filePaths[0]
})
trustedHandle('resource:open', async (_event, resource) => {
  if (!resource || !['app', 'file', 'link'].includes(resource.kind)) return { ok: false, error: 'Некорректный ресурс' }
  if (resource.kind === 'link') {
    try {
      const url = new URL(resource.target)
      if (!['https:', 'http:', 'figma:'].includes(url.protocol)) throw new Error('Поддерживаются только страницы HTTP, HTTPS и Figma')
      await shell.openExternal(url.toString())
      return { ok: true }
    } catch (error) { return { ok: false, error: error.message } }
  }
  if (typeof resource.target !== 'string' || !path.isAbsolute(resource.target) || !fs.existsSync(resource.target)) {
    return { ok: false, error: 'Файл не найден. Проверьте его расположение.' }
  }
  const error = await shell.openPath(resource.target)
  return error ? { ok: false, error } : { ok: true }
})
trustedHandle('settings:getAutostart', () => app.getLoginItemSettings().openAtLogin)
trustedHandle('settings:setAutostart', (_event, value) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(value) })
  return app.getLoginItemSettings().openAtLogin
})
trustedHandle('calendar:fetch', async (_event, url) => {
  if (!url || typeof url !== 'string') throw new Error('Некорректный адрес календаря')
  let targetUrl = url.trim()
  if (targetUrl.startsWith('webcal://')) targetUrl = 'https://' + targetUrl.slice(9)
  const parsed = new URL(targetUrl)
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Поддерживаются только протоколы HTTP, HTTPS и Webcal')
  return fetchLimited(targetUrl)
})
trustedHandle('window:show', () => { showWindow(); return true })
trustedHandle('capture:close', () => captureWindow?.hide())
trustedHandle('browser:show', (_event, value) => browser.show(value))
trustedHandle('browser:hide', (_event, id) => browser.hide(id))
trustedHandle('browser:block', (_event, value) => browser.block(value))
trustedHandle('browser:close', (_event, id) => browser.close(id))
trustedHandle('browser:park', (_event, ids) => browser.park(ids))
trustedHandle('browser:action', (_event, id, action) => browser.action(id, action))
trustedHandle('browser:text', (_event, id) => browser.text(id))
ipcMain.on('page:signal', (event, value) => browser?.pageSignal(event.sender, value))

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      showWindow()
    }
  })

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ label: 'Дом', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit' }] }] : []),
      { label: 'Правка', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'Окно', submenu: [{ role: 'minimize' }, { role: 'togglefullscreen' }] }
    ]))
    storage = createStorage(app.getPath('userData'))
    await storage.ready
    await createIntegrations()
    createWindow()
    createTray()
    setInterval(() => gmail.sync().catch(() => undefined), 120000)
    setInterval(() => ai.background().catch(() => undefined), 60000)
    gmail.sync().catch(() => undefined)
    if (!isSmoke) globalShortcut.register(process.platform === 'darwin' ? 'Command+Option+Space' : 'Control+Alt+Space', () => {
      showCapture().catch(error => console.error('Capture failed:', error.message))
    })
    checkReminders()
    setInterval(checkReminders, 15_000)
    if (isSmoke) require('./smoke.cjs')({ window: mainWindow, storage, vault, showCapture, getCapture: () => captureWindow, browser }).then(async () => { quitting = true; await storage.close(); app.exit(0) }).catch(async error => { console.error(error); quitting = true; await storage.close(); app.exit(1) })
  }).catch(error => { dialog.showErrorBox('Не удалось открыть данные Дома', `${error.message}\n\nИсходные данные не удалены. Резервные копии находятся в папке ${app.getPath('userData')}.`); app.quit() })

  app.on('activate', showWindow)
  app.on('before-quit', () => { quitting = true; ai?.dispose(); browser?.dispose() })
  app.on('will-quit', () => { globalShortcut.unregisterAll(); storage?.close() })
}

process.on('unhandledRejection', error => console.error(error))

