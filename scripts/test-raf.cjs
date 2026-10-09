const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { additionalArguments: ['--cabinet-pilot'] } })
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await new Promise(r => setTimeout(r, 1000))

  // Space select
  await win.webContents.executeJavaScript(`document.querySelectorAll('.chrome-space')[1].click()`)
  await new Promise(r => setTimeout(r, 400))

  // Click tab
  await win.webContents.executeJavaScript(`document.querySelector('.cabinet-tab-open').click()`)
  await new Promise(r => setTimeout(r, 500))

  // Force paint/raf
  await win.webContents.executeJavaScript(`
    new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 300)
        })
      })
    })
  `)

  const shot = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, '../qa/screenshots/visual-qa/test-raf.png'), shot.toPNG())
  console.log('Saved test-raf.png, size:', shot.toPNG().length)
  app.exit(0)
})
