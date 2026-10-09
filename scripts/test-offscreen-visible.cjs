const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

app.whenReady().then(async () => {
  // Visible to Chromium compositor, but positioned offscreen so user doesn't see a popup
  const win = new BrowserWindow({
    show: true,
    x: -3000,
    y: -3000,
    width: 1440,
    height: 900,
    webPreferences: { additionalArguments: ['--cabinet-pilot'] }
  })
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await new Promise(r => setTimeout(r, 1200))

  // Select space
  await win.webContents.executeJavaScript(`document.querySelectorAll('.chrome-space')[1].click()`)
  await new Promise(r => setTimeout(r, 600))

  // Click tab
  await win.webContents.executeJavaScript(`document.querySelector('.cabinet-tab-open').click()`)
  await new Promise(r => setTimeout(r, 800))

  const shot = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, '../qa/screenshots/visual-qa/test-real-visible.png'), shot.toPNG())
  console.log('Saved test-real-visible.png')
  app.exit(0)
})
