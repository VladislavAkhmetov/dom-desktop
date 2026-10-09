const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { additionalArguments: ['--cabinet-pilot'] } })
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await new Promise(r => setTimeout(r, 1000))

  // Open profile popover
  await win.webContents.executeJavaScript(`document.querySelector('.chrome-profile').click()`)
  await new Promise(r => setTimeout(r, 400))

  // Click 'Фон и оформление' directly from profile popover!
  await win.webContents.executeJavaScript(`
    const btn = [...document.querySelectorAll('.profile-action-btn')].find(b => b.textContent.includes('Фон и оформление'))
    if (btn) btn.click()
  `)
  await new Promise(r => setTimeout(r, 600))

  const shot = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, '../qa/screenshots/visual-qa/test-wallpaper-direct.png'), shot.toPNG())
  console.log('Saved test-wallpaper-direct.png')

  // Now click tab 'Фон и оформление' inside DashboardSettings
  await win.webContents.executeJavaScript(`
    const tab = [...document.querySelectorAll('.calm-dialog .calm-tabs button')].find(b => b.textContent.includes('Фон'))
    if (tab) tab.click()
  `)
  await new Promise(r => setTimeout(r, 500))

  const shot2 = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, '../qa/screenshots/visual-qa/test-wallpaper-active.png'), shot2.toPNG())
  console.log('Saved test-wallpaper-active.png')

  app.exit(0)
}).catch(err => {
  console.error(err)
  app.exit(1)
})
