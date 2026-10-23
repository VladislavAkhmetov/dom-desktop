const { app, BrowserWindow, dialog, shell, ipcMain, globalShortcut, Notification, Tray, Menu, nativeImage, safeStorage, session, components, screen } = require('electron')

app.commandLine.appendSwitch('enable-features', 'WinSystemLocationProvider')
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
const fs = require('node:fs')
const path = require('node:path')
const { createStorage } = require('./storage.cjs')
const { BrowserManager } = require('./browser.cjs')
const { bitwardenExtensionStatus } = require('./bitwarden-extension.cjs')
const { Vault } = require('./vault.cjs')
const { Gmail } = require('./gmail.cjs')
const { AI } = require('./ai.cjs')
const { fetchLimited } = require('./network.cjs')
const { pathToFileURL } = require('node:url')
const osWindows = require('./os-windows.cjs')
const { autoUpdater } = require('electron-updater')

function initCalmAutoUpdater(mainWindow) {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true // Обновится само, когда юзер закроет dombro вечером

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-ready', {
        version: info.version,
      })
    }
  })

  // Проверяем тихо через 10 секунд после запуска
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // Игнорируем отсутствие сети без ошибок в UI (Calm Tech)
    })
  }, 10000)
}

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const isDev = process.argv.includes('--dev')
const isSmoke = process.argv.includes('--smoke-test')
const isCabinetPilot =
  !process.argv.includes('--legacy-pilot') &&
  process.env.DOM_LEGACY_PILOT !== '1'

const isDedicatedPilotProfile =
  process.argv.includes('--cabinet-pilot') ||
  process.env.DOM_CABINET_PILOT === '1' ||
  path.basename(process.execPath || '').toLowerCase().includes('cabinet') ||
  Boolean(process.env.PORTABLE_EXECUTABLE_FILE && path.basename(process.env.PORTABLE_EXECUTABLE_FILE).toLowerCase().includes('cabinet'))

const customUserData = process.argv.find(value => /^--user-data-dir=/.test(value))?.split('=')[1]

if (isSmoke) {
  const id = process.argv.find(value => /^--smoke-id=\d+$/.test(value))?.split('=')[1] || String(process.pid)
  const directory = path.join(app.getPath('temp'), `dom-smoke-${id}`)
  fs.mkdirSync(directory, { recursive: true }); app.setPath('userData', directory)
} else if (customUserData) {
  fs.mkdirSync(customUserData, { recursive: true }); app.setPath('userData', customUserData)
} else if (isDedicatedPilotProfile) {
  const directory = path.join(app.getPath('appData'), 'dombro-cabinet-pilot')
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
  try {
    const url = new URL(value)
    if (isDev) return url.origin === new URL(DEV_URL).origin && url.pathname === '/'
    const expected = pathToFileURL(path.resolve(__dirname, '..', 'dist', 'index.html')).href.toLowerCase()
    return url.href.split(/[?#]/)[0].toLowerCase() === expected
  } catch {
    return false
  }
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
trustedHandle('ai:transcribe', async (_event, buffer, mimeType) => {
  if (!buffer || typeof buffer !== 'object') throw new Error('Некорректный аудио-буфер')
  const uint8 = Buffer.isBuffer(buffer) ? buffer : new Uint8Array(buffer)
  if (uint8.byteLength > 15_000_000) throw new Error('Аудиозапись слишком большая')
  return ai.transcribe(uint8, typeof mimeType === 'string' ? mimeType : 'audio/webm')
})
trustedHandle('vault:credentials:list', (_event, origin) => vault.getCredentials(origin))
trustedHandle('vault:credentials:save', (_event, cred) => vault.saveCredential(cred))
trustedHandle('vault:credentials:remove', (_event, id) => vault.removeCredential(id))
trustedHandle('vault:credentials:import', (_event, csv) => vault.importCredentialsCsv(csv))

async function showCapture() {
  if (!captureWindow || captureWindow.isDestroyed()) {
    captureWindow = new BrowserWindow({ width: 580, height: 520, show: false, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, backgroundColor: '#f5f8f2', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, additionalArguments: isCabinetPilot ? ['--cabinet-pilot'] : [] } })
    captureWindow.on('close', event => { if (!quitting) { event.preventDefault(); captureWindow.hide() } })
    captureWindow.webContents.on('will-navigate', (event, url) => { if (!trustedURL(url)) event.preventDefault() })
    captureWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    if (isDev) await captureWindow.loadURL(isCabinetPilot ? `${DEV_URL}/?cabinet=1#capture` : `${DEV_URL}/#capture`)
    else await captureWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), isCabinetPilot ? { search: 'cabinet=1', hash: 'capture' } : { hash: 'capture' })
  }
  if (!isSmoke) {
    if (captureWindow.isVisible() && captureWindow.isFocused()) {
      captureWindow.webContents.send('capture:toggle-voice')
      return
    }
    captureWindow.show(); captureWindow.focus()
  }
}

let splashWindow = null
let splashStartTime = 0

const SPLASH_HOLD_MS = 1000
const MAIN_FADE_MS = 640

function workAreaUnderCursor() {
  const point = screen.getCursorScreenPoint()
  return screen.getDisplayNearestPoint(point).workArea
}

function windowedBounds(area) {
  const width = Math.min(1440, area.width)
  const height = Math.min(920, area.height)
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height,
    opacity: 0
  }
}

function createSplash() {
  if (isSmoke || splashWindow) return
  splashStartTime = Date.now()
  splashWindow = new BrowserWindow({
    width: 360,
    height: 230,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    center: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    roundedCorners: false,
    thickFrame: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })
  const appVer = app.getVersion()
  splashWindow.loadFile(path.join(__dirname, 'splash.html'), { query: { v: appVer } }).catch(() => undefined)
  splashWindow.once('ready-to-show', () => {
    if (!splashWindow || splashWindow.isDestroyed()) return
    // Прозрачное окно Windows не принимает setOpacity. Карточка остаётся opacity: 0,
    // пока окно скрыто, и проявляется только после show — иначе keyframes кончаются заранее.
    splashWindow.showInactive()
    setTimeout(() => {
      if (!splashWindow || splashWindow.isDestroyed()) return
      splashWindow.webContents
        .executeJavaScript("document.documentElement.classList.add('is-in')")
        .catch(() => undefined)
    }, 32)
  })
}

const windowFades = new WeakMap()

function fadeInWindow(win, duration = MAIN_FADE_MS) {
  return new Promise(resolve => {
    if (!win || win.isDestroyed()) {
      resolve()
      return
    }
    const previous = windowFades.get(win)
    if (previous) clearInterval(previous)
    win.setOpacity(0)
    if (!win.isVisible()) win.show()
    win.setOpacity(0)
    if (duration <= 0) {
      windowFades.delete(win)
      win.setOpacity(1)
      win.focus()
      resolve()
      return
    }
    const start = Date.now()
    const timer = setInterval(() => {
      if (!win || win.isDestroyed()) {
        clearInterval(timer)
        windowFades.delete(win)
        resolve()
        return
      }
      const progress = Math.min(1, (Date.now() - start) / duration)
      const eased = progress * progress * (3 - 2 * progress)
      win.setOpacity(eased)
      if (progress >= 1) {
        clearInterval(timer)
        windowFades.delete(win)
        win.setOpacity(1)
        win.focus()
        resolve()
      }
    }, 16)
    windowFades.set(win, timer)
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForAppShell(win, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!win || win.isDestroyed()) return false
    try {
      const ready = await win.webContents.executeJavaScript('Boolean(document.querySelector(".app-shell"))')
      if (ready) return true
    } catch {
      // Страница ещё переключается.
    }
    await delay(40)
  }
  return false
}

async function prefersReducedMotion(win) {
  if (!win || win.isDestroyed()) return false
  try {
    return Boolean(await win.webContents.executeJavaScript("window.matchMedia('(prefers-reduced-motion: reduce)').matches"))
  } catch {
    return false
  }
}

function dismissSplash() {
  const win = splashWindow
  if (!win || win.isDestroyed()) return Promise.resolve()
  splashWindow = null
  const close = () => {
    if (!win.isDestroyed()) win.destroy()
  }
  const script = `new Promise(resolve => {
    const card = document.querySelector('.splash-card')
    if (!card) { resolve(); return }
    let settled = false
    const finish = () => { if (settled) return; settled = true; resolve() }
    card.addEventListener('animationend', finish, { once: true })
    document.documentElement.classList.remove('is-in')
    document.documentElement.classList.add('is-out')
    setTimeout(finish, 600)
  })`
  return win.webContents.executeJavaScript(script).catch(() => undefined).then(close)
}

function showMaximizedInvisible(win) {
  win.setOpacity(0)
  if (!win.isVisible()) win.show()
  win.setOpacity(0)
  if (!win.isMaximized()) win.maximize()
  return new Promise(resolve => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (!win || win.isDestroyed()) {
        clearInterval(timer)
        resolve()
        return
      }
      win.setOpacity(0)
      if (Date.now() - started >= 240) {
        clearInterval(timer)
        resolve()
      }
    }, 16)
  })
}

async function handoffToMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  await waitForAppShell(mainWindow, 1800)
  if (!mainWindow || mainWindow.isDestroyed()) return
  const reduced = await prefersReducedMotion(mainWindow)
  await showMaximizedInvisible(mainWindow)
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (reduced) {
    mainWindow.setOpacity(1)
    mainWindow.focus()
    const win = splashWindow
    splashWindow = null
    if (win && !win.isDestroyed()) win.destroy()
    return
  }
  await Promise.all([
    fadeInWindow(mainWindow, MAIN_FADE_MS),
    dismissSplash()
  ])
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) {
    showMaximizedInvisible(mainWindow)
      .then(() => fadeInWindow(mainWindow, MAIN_FADE_MS))
      .catch(error => console.error('Window reveal failed:', error))
  } else {
    mainWindow.focus()
  }
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
  const placed = isSmoke ? { width: 1440, height: 920 } : windowedBounds(workAreaUnderCursor())
  mainWindow = new BrowserWindow({
    show: false,
    ...placed,
    minWidth: 900,
    minHeight: 650,
    title: isCabinetPilot ? 'dombro (кабинеты)' : 'dombro',
    icon: fs.existsSync(appIcon) ? appIcon : getAssetPath('tray.png'),
    backgroundColor: '#a4b8ac',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : { color: '#00000000', symbolColor: '#2e453b', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      additionalArguments: isCabinetPilot ? ['--cabinet-pilot'] : []
    }
  })
  if (!isSmoke) mainWindow.setOpacity(0)

  let revealed = false
  const reveal = () => {
    if (revealed || !mainWindow || mainWindow.isDestroyed()) return
    revealed = true

    if (isSmoke) {
      mainWindow.maximize()
      mainWindow.setOpacity(1)
      mainWindow.show()
      return
    }

    const elapsed = Date.now() - (splashStartTime || Date.now())
    const wait = Math.max(0, SPLASH_HOLD_MS - elapsed)
    setTimeout(() => {
      handoffToMain().catch(error => console.error('Window reveal failed:', error))
    }, wait)
  }

  mainWindow.once('ready-to-show', reveal)
  setTimeout(reveal, 2500)

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault()
      mainWindow.setFullScreen(!mainWindow.isFullScreen())
    }
  })

  browser = new BrowserManager(mainWindow, isCabinetPilot ? 'persist:dom-cabinet-browser' : 'persist:dom-browser')
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
  if (isDev) mainWindow.loadURL(isCabinetPilot ? `${DEV_URL}?cabinet=1` : DEV_URL)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), isCabinetPilot ? { search: 'cabinet=1' } : undefined)
}

function createTray() {
  const icon = nativeImage.createFromPath(getAssetPath('tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('dombro — всё нужное рядом')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть dombro', click: showWindow },
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
      const bodies = all.length > 3 ? [`Напоминаний: ${all.length}. Откройте dombro, чтобы посмотреть.`] : all
      for (const body of bodies) { const notification = new Notification({ title: 'dombro напоминает', body, silent: true }); notification.on('click', showWindow); notification.show() }
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
  if (!resource || !['app', 'file', 'link', 'window'].includes(resource.kind)) return { ok: false, error: 'Некорректный ресурс' }
  if (resource.kind === 'window') {
    if (resource.windowHwnd && osWindows.isWindowAlive(resource.windowHwnd)) {
      osWindows.focusWindow(resource.windowHwnd)
      return { ok: true }
    }
    if (resource.target && fs.existsSync(resource.target)) {
      const error = await shell.openPath(resource.target)
      return error ? { ok: false, error } : { ok: true }
    }
    return { ok: false, error: 'Окно закрыто, а файл программы не найден.' }
  }
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
async function getRecentFiles() {
  if (process.platform !== 'win32') return []
  try {
    const recentDir = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Recent')
    if (!fs.existsSync(recentDir)) return []
    const entries = fs.readdirSync(recentDir)
    const links = []
    const now = Date.now()
    const maxAge = 48 * 60 * 60 * 1000
    for (const name of entries) {
      if (!name.toLowerCase().endsWith('.lnk')) continue
      try {
        const fullPath = path.join(recentDir, name)
        const stat = fs.statSync(fullPath)
        if (now - stat.mtimeMs > maxAge) continue
        links.push({ fullPath, mtimeMs: stat.mtimeMs })
      } catch { /* skip inaccessible */ }
    }
    links.sort((a, b) => b.mtimeMs - a.mtimeMs)
    const results = []
    const seen = new Set()
    for (const item of links.slice(0, 40)) {
      try {
        const shortcut = shell.readShortcutLink(item.fullPath)
        const target = shortcut.target
        if (!target || seen.has(target.toLowerCase())) continue
        if (!path.isAbsolute(target) || !fs.existsSync(target)) continue
        const stat = fs.statSync(target)
        if (!stat.isFile()) continue
        const ext = path.extname(target).toLowerCase()
        if (['.exe', '.lnk', '.url', '.dll', '.bat', '.cmd', '.msi', '.bin', '.sys'].includes(ext)) continue
        seen.add(target.toLowerCase())
        results.push({
          name: path.basename(target),
          target,
          modifiedAt: new Date(item.mtimeMs).toISOString()
        })
        if (results.length >= 8) break
      } catch { /* skip unreadable */ }
    }
    return results
  } catch {
    return []
  }
}
trustedHandle('resource:recentFiles', () => getRecentFiles())
trustedHandle('windows:list-open', () => osWindows.getOpenWindows(process.pid))
trustedHandle('windows:minimize', (_event, toPark, activeKeep) => {
  osWindows.minimizeWindows(toPark, activeKeep)
  return true
})
trustedHandle('windows:restore', (_event, hwndList, focusDomWindow) => {
  let domHwnd = null
  if (focusDomWindow && mainWindow && !mainWindow.isDestroyed()) {
    try {
      domHwnd = '0x' + mainWindow.getNativeWindowHandle().readBigInt64LE().toString(16)
    } catch {
      // fallback
    }
  }
  osWindows.restoreWindows(hwndList, domHwnd)
  return true
})
trustedHandle('windows:focus', (_event, hwnd) => osWindows.focusWindow(hwnd))
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
trustedHandle('window:toggleFullScreen', () => {
  if (!mainWindow) return false
  const next = !mainWindow.isFullScreen()
  mainWindow.setFullScreen(next)
  return next
})
trustedHandle('window:isFullScreen', () => Boolean(mainWindow?.isFullScreen()))
trustedHandle('window:setTitleBarOverlay', (_event, options) => {
  if (!mainWindow || mainWindow.isDestroyed() || process.platform === 'darwin') return false
  try {
    mainWindow.setTitleBarOverlay({
      color: options?.color ?? '#00000000',
      symbolColor: options?.symbolColor ?? '#2e453b',
      height: options?.height ?? 36
    })
    return true
  } catch (err) {
    console.error('Failed to update titleBarOverlay:', err)
    return false
  }
})
trustedHandle('capture:close', () => captureWindow?.hide())
trustedHandle('browser:show', (_event, value) => browser.show(value))
trustedHandle('browser:hide', (_event, id) => browser.hide(id))
trustedHandle('browser:move', (_event, id, spaceId) => browser.move(id, spaceId))
trustedHandle('browser:block', (_event, value) => browser.block(value))
trustedHandle('browser:close', (_event, id) => browser.close(id))
trustedHandle('browser:park', (_event, ids) => browser.park(ids))
trustedHandle('browser:action', (_event, id, action) => browser.action(id, action))
trustedHandle('browser:text', (_event, id) => browser.text(id))
trustedHandle('browser:respondPermission', (_event, id, allowed) => browser?.respondPermission(id, allowed))
trustedHandle('browser:adblock:status', (_event, tabId, hostname) => browser.adblock.getStatus(tabId, hostname))
trustedHandle('browser:adblock:toggle-site', (_event, hostname, disabled) => {
  browser.adblock.toggleSite(hostname, disabled)
  return browser.adblock.getStatus(null, hostname)
})
trustedHandle('browser:adblock:toggle-cookies', (_event, enabled) => {
  browser.adblock.toggleCookies(enabled)
  return browser.adblock.getStatus(null, null)
})
trustedHandle('browser:adblock:toggle-global', (_event, enabled) => {
  browser.adblock.toggleGlobal(enabled)
  return browser.adblock.getStatus(null, null)
})
trustedHandle('browser:dark:toggle', async (_event, tabId, hostname, enabled) => {
  browser.adblock.toggleDarkSite(hostname, enabled)
  await browser.applyDarkMode(tabId, enabled)
  return browser.adblock.getStatus(tabId, hostname)
})
trustedHandle('browser:reader:content', async (_event, tabId) => browser.getReaderContent(tabId))
trustedHandle('browser:translate:text', async (_event, text, targetLang) => {
  const { translateText } = require('./translate.cjs')
  return translateText(text, targetLang)
})
trustedHandle('browser:translate:tab', async (_event, tabId) => browser.translateTab(tabId))
trustedHandle('browser:suggest', async (_event, query) => {
  if (!query || typeof query !== 'string') return []
  const q = query.trim().slice(0, 100)
  if (!q) return []
  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data[1]) ? data[1].slice(0, 8) : []
  } catch {
    return []
  }
})
ipcMain.on('page:signal', (event, value) => browser?.pageSignal(event.sender, value))
ipcMain.on('page:password-submit', (event, data) => browser?.pagePasswordSubmit(event.sender, data))
trustedHandle('browser:autofill', async (_event, tabId, cred) => browser?.autofill(tabId, cred))
trustedHandle('bitwarden:status', () => bitwardenExtensionStatus())

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
    if (components && typeof components.whenReady === 'function') {
      try { await components.whenReady() } catch (err) { console.warn('[DRM] components.whenReady() warning:', err.message) }
    }
    if (!isSmoke) createSplash()
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (['geolocation', 'notifications'].includes(permission)) return callback(true)
      callback(false)
    })
    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      return ['geolocation', 'notifications'].includes(permission)
    })
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
    if (!isSmoke) {
      initCalmAutoUpdater(mainWindow)
    }
    setInterval(() => gmail.sync().catch(() => undefined), 120000)
    setInterval(() => ai.background().catch(() => undefined), 60000)
    gmail.sync().catch(() => undefined)
    if (!isSmoke) {
      globalShortcut.register(process.platform === 'darwin' ? 'Command+Shift+Space' : 'Control+Shift+Space', () => {
        showCapture().catch(error => console.error('Capture failed:', error.message))
      })
      globalShortcut.register(process.platform === 'darwin' ? 'Command+Shift+S' : 'Control+Shift+S', async () => {
        try {
          const recents = await getRecentFiles()
          const top = recents[0]
          if (!top) return
          const current = await storage.get()
          const spaceId = current.activeSpaceId || current.spaces.find(s => !s.archivedAt && s.kind !== 'web')?.id
          if (!spaceId) return
          const space = current.spaces.find(s => s.id === spaceId)
          if (!space) return
          const already = space.resources.some(r => r.kind === 'file' && r.target.toLowerCase() === top.target.toLowerCase())
          if (already) {
            mainWindow?.webContents.send('toast:show', `«${top.name}» уже в «${space.name}»`)
            return
          }
          const resource = {
            id: crypto.randomUUID(),
            name: top.name,
            kind: 'file',
            target: top.target,
            createdAt: new Date().toISOString()
          }
          const { diffState } = await import('../shared/state.js')
          const next = { ...current, spaces: current.spaces.map(s => s.id === spaceId ? { ...s, resources: [...s.resources, resource] } : s) }
          const applied = await storage.apply(diffState(current, next))
          broadcastState(applied)
          mainWindow?.webContents.send('toast:show', `«${top.name}» добавлен в «${space.name}»`)
        } catch (error) {
          console.error('Capture shortcut failed:', error)
        }
      })
    }
    checkReminders()
    setInterval(checkReminders, 15_000)
    if (isSmoke) require('./smoke.cjs')({ window: mainWindow, storage, vault, showCapture, getCapture: () => captureWindow, browser }).then(async () => { quitting = true; await storage.close(); app.exit(0) }).catch(async error => { console.error(error); quitting = true; await storage.close(); app.exit(1) })
  }).catch(error => { dialog.showErrorBox('Не удалось открыть данные Дома', `${error.message}\n\nИсходные данные не удалены. Резервные копии находятся в папке ${app.getPath('userData')}.`); app.quit() })

  app.on('activate', showWindow)
  app.on('before-quit', () => { quitting = true; ai?.dispose(); browser?.dispose() })
  app.on('will-quit', () => { globalShortcut.unregisterAll(); storage?.close() })
}

process.on('unhandledRejection', error => console.error(error))

