const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { additionalArguments: ['--cabinet-pilot'] } })
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await new Promise(r => setTimeout(r, 1000))

  // Select space
  await win.webContents.executeJavaScript(`document.querySelectorAll('.chrome-space')[1].click()`)
  await new Promise(r => setTimeout(r, 400))

  // Click tab
  await win.webContents.executeJavaScript(`document.querySelector('.cabinet-tab-open').click()`)
  await new Promise(r => setTimeout(r, 600))

  const state = await win.webContents.executeJavaScript(`(() => {
    return {
      appShell: document.querySelector('.app-shell')?.className,
      header: document.querySelector('header')?.className,
      firstTabTitle: document.querySelector('.chrome-tab, .browser-tab, .workstage-tab')?.textContent?.trim()
    }
  })()`)
  console.log('DOM State:', state)

  const shot = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, '../qa/screenshots/visual-qa/test-diagnose.png'), shot.toPNG())
  console.log('Saved test-diagnose.png')
  app.exit(0)
})
