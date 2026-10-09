const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const assert = require('node:assert/strict')
const { createStorage } = require('../electron/storage.cjs')

const testDir = path.resolve(__dirname, '../.cache/default-runtime-test', String(Date.now()))
fs.mkdirSync(testDir, { recursive: true })
app.setPath('userData', testDir)
app.disableHardwareAcceleration()

let storage

app.whenReady().then(async () => {
  storage = createStorage(testDir)
  await storage.ready

  ipcMain.handle('state:get', () => storage.get())
  ipcMain.handle('state:apply', async (_event, changes) => storage.apply(changes))
  ipcMain.handle('state:search', (_event, q) => storage.search(q))
  ipcMain.handle('state:backup', () => storage.backup())
  ipcMain.handle('settings:getAutostart', () => false)
  ipcMain.handle('google:configured', () => false)
  ipcMain.handle('feed:fetch', () => '')

  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      contextIsolation: true,
      sandbox: true
    }
  })

  // Load without any flags or search params
  await win.loadFile(path.join(__dirname, '../dist/index.html'))
  await new Promise(r => setTimeout(r, 1500))

  const runtimeState = await win.webContents.executeJavaScript(`(() => {
    return {
      cabinetPilot: window.dom?.cabinetPilot,
      hasProfilePill: Boolean(document.querySelector('.chrome-profile')),
      hasOmnibox: Boolean(document.querySelector('.calm-omnibox')),
      spacesCount: document.querySelectorAll('.chrome-space').length
    }
  })()`)

  console.log('Default Runtime State:', JSON.stringify(runtimeState, null, 2))
  assert.equal(runtimeState.cabinetPilot, true, 'cabinetPilot should be true by default in Electron')
  assert.equal(runtimeState.hasProfilePill, true, 'Profile avatar pill should be visible in header')
  assert.equal(runtimeState.hasOmnibox, true, 'Omnibox should be visible in header')
  assert.ok(runtimeState.spacesCount > 0, 'Spaces should be rendered')

  console.log('✓ All checks passed! Electron boots in the latest prototype by default without any CLI flags.')
  app.exit(0)
}).catch(err => {
  console.error(err)
  app.exit(1)
})
