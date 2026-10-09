const { app, BrowserWindow } = require('electron')
const path = require('node:path')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { additionalArguments: ['--cabinet-pilot'] } })
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await new Promise(r => setTimeout(r, 1000))

  await win.webContents.executeJavaScript(`
    document.querySelectorAll('.chrome-space')[1].click()
  `)
  await new Promise(r => setTimeout(r, 500))

  console.log('Before click:', await win.webContents.executeJavaScript('document.querySelector(".app-shell").className'))

  await win.webContents.executeJavaScript(`
    document.querySelector('.cabinet-tab-open').click()
  `)
  await new Promise(r => setTimeout(r, 1000))

  console.log('After click:', await win.webContents.executeJavaScript('document.querySelector(".app-shell").className'))
  console.log('Top header:', await win.webContents.executeJavaScript('document.querySelector("header").className'))
  app.exit(0)
})
