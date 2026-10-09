const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { additionalArguments: ['--cabinet-pilot'] } })
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await new Promise(r => setTimeout(r, 1000))

  await win.webContents.executeJavaScript(`document.querySelectorAll('.chrome-space')[1].click()`)
  await new Promise(r => setTimeout(r, 600))

  await win.webContents.executeJavaScript(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Открыть вкладки') || b.textContent?.includes('Браузер'))
    if (btn) btn.click()
  })()`)
  await new Promise(r => setTimeout(r, 1500))

  const shot = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, '../qa/screenshots/visual-qa/fresh-browser-stage.png'), shot.toPNG())
  console.log('Saved fresh-browser-stage.png')
  app.exit(0)
})
