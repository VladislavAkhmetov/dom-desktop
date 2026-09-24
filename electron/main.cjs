const { app, BrowserWindow, dialog, shell, ipcMain, globalShortcut, Notification, Tray, Menu, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const isDev = process.argv.includes('--dev')
let mainWindow
let tray
let quitting = false

function statePath() {
  return path.join(app.getPath('userData'), 'state.json')
}

function emptyState() {
  return {
    version: 1,
    spaces: [{ id: 'first-space', name: 'Моё пространство', tone: 'sage', resources: [] }],
    reminders: [],
    dismissedUntil: null
  }
}

function withStarterApps(state) {
  if (state.starterAppsAdded) return state
  const now = new Date().toISOString()
  const candidates = [
    { id: 'starter-figma', name: 'Figma', target: path.join(process.env.LOCALAPPDATA || '', 'Figma', 'Figma.exe') },
    { id: 'starter-illustrator-2025', name: 'Illustrator 2025', target: path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Adobe', 'Adobe Illustrator 2025', 'Support Files', 'Contents', 'Windows', 'Illustrator.exe') }
  ]
  const existing = new Set(state.spaces.flatMap(space => space.resources.map(resource => resource.name.toLowerCase())))
  const starters = candidates.filter(candidate => path.isAbsolute(candidate.target) && fs.existsSync(candidate.target) && !existing.has(candidate.name.toLowerCase()))
    .map(candidate => ({ ...candidate, kind: 'app', createdAt: now }))
  const spaces = state.spaces.length ? state.spaces : emptyState().spaces
  return { ...state, starterAppsAdded: true, spaces: spaces.map((space, index) => index === 0 ? { ...space, resources: [...space.resources, ...starters] } : space) }
}

function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath(), 'utf8'))
    if (parsed.version === 1 && Array.isArray(parsed.spaces) && Array.isArray(parsed.reminders)) return parsed
  } catch { /* First run, or a damaged file: start with an empty home. */ }
  return emptyState()
}

function saveState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.spaces) || !Array.isArray(state.reminders)) {
    throw new Error('Некорректные данные приложения')
  }
  const serialized = JSON.stringify(state, null, 2)
  if (serialized.length > 2_000_000) throw new Error('Локальное хранилище переполнено')
  const target = statePath()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const temporary = `${target}.tmp`
  fs.writeFileSync(temporary, serialized, 'utf8')
  fs.renameSync(temporary, target)
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
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 650,
    title: 'Дом',
    icon: fs.existsSync(appIcon) ? appIcon : getAssetPath('tray.png'),
    backgroundColor: '#a4b8ac',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true
    }
  })
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
    if (isDev) {
      if (!url.startsWith(DEV_URL)) {
        event.preventDefault()
        if (/^https?:\/\//i.test(url)) shell.openExternal(url)
      }
    } else {
      if (!url.startsWith('file://')) {
        event.preventDefault()
        if (/^https?:\/\//i.test(url)) shell.openExternal(url)
      }
    }
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

function checkReminders() {
  const state = readState()
  const now = Date.now()
  let changed = false
  for (const reminder of state.reminders) {
    if (reminder.done || reminder.notifiedAt || !reminder.dueAt) continue
    const due = Date.parse(reminder.dueAt)
    if (Number.isNaN(due) || due > now) continue
    if (Notification.isSupported()) {
      new Notification({ title: 'Дом напоминает', body: reminder.title, silent: true }).show()
    }
    reminder.notifiedAt = new Date().toISOString()
    changed = true
  }
  if (changed) {
    saveState(state)
    mainWindow?.webContents.send('state:changed', state)
  }
}

ipcMain.handle('state:get', () => {
  const state = readState()
  const migrated = withStarterApps(state)
  if (migrated !== state) saveState(migrated)
  return migrated
})
ipcMain.handle('state:save', (_event, state) => { saveState(state); return true })
ipcMain.handle('resource:pick', async (_event, kind) => {
  if (kind !== 'app' && kind !== 'file') throw new Error('Неизвестный тип ресурса')
  const result = await dialog.showOpenDialog(mainWindow, {
    title: kind === 'app' ? 'Выберите приложение или ярлык' : 'Выберите документ',
    properties: ['openFile'],
    filters: kind === 'app' ? [{ name: 'Приложения и ярлыки', extensions: ['exe', 'lnk'] }] : undefined
  })
  return result.canceled ? null : result.filePaths[0]
})
ipcMain.handle('resource:open', async (_event, resource) => {
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
ipcMain.handle('settings:getAutostart', () => app.getLoginItemSettings().openAtLogin)
ipcMain.handle('settings:setAutostart', (_event, value) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(value) })
  return app.getLoginItemSettings().openAtLogin
})
ipcMain.handle('calendar:fetch', async (_event, url) => {
  if (!url || typeof url !== 'string') throw new Error('Некорректный адрес календаря')
  let targetUrl = url.trim()
  if (targetUrl.startsWith('webcal://')) targetUrl = 'https://' + targetUrl.slice(9)
  const parsed = new URL(targetUrl)
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Поддерживаются только протоколы HTTP, HTTPS и Webcal')
  const res = await fetch(targetUrl, {
    headers: { 'User-Agent': 'Dom-Desktop/0.1' }
  })
  if (!res.ok) throw new Error(`Ошибка загрузки календаря: ${res.status}`)
  return await res.text()
})
ipcMain.handle('window:show', () => { showWindow(); return true })

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

  app.whenReady().then(() => {
    createWindow()
    createTray()
    globalShortcut.register('Control+Alt+Space', () => {
      showWindow()
      mainWindow?.webContents.send('focus:capture')
    })
    checkReminders()
    setInterval(checkReminders, 15_000)
  })

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      const ua = contents.userAgent.replace(/Electron\/\S+\s?/g, '')
      contents.setUserAgent(ua)
      contents.setWindowOpenHandler(({ url }) => {
        contents.loadURL(url)
        return { action: 'deny' }
      })
    }
  })

  app.on('activate', showWindow)
  app.on('before-quit', () => { quitting = true })
  app.on('will-quit', () => globalShortcut.unregisterAll())
}

process.on('unhandledRejection', error => console.error(error))

