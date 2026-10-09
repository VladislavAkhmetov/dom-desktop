const { app, BrowserWindow } = require('electron')
const path = require('node:path')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { additionalArguments: ['--cabinet-pilot'] } })
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await new Promise(r => setTimeout(r, 1000))

  await win.webContents.executeJavaScript(`document.querySelector('.chrome-profile').click()`)
  await new Promise(r => setTimeout(r, 500))

  await win.webContents.executeJavaScript(`
    const btn = [...document.querySelectorAll('.profile-action-btn')].find(b => b.textContent.includes('Настройки'))
    btn.click()
  `)
  await new Promise(r => setTimeout(r, 500))

  const info = await win.webContents.executeJavaScript(`(() => {
    const dialog = document.querySelector('.calm-dialog')
    const navBtns = [...document.querySelectorAll('.settings-nav button')].map(b => ({
      text: b.textContent.trim(),
      id: b.id,
      current: b.getAttribute('aria-current')
    }))
    return { hasDialog: Boolean(dialog), navBtns }
  })()`)
  console.log('Settings Info:', JSON.stringify(info, null, 2))

  const clicked = await win.webContents.executeJavaScript(`(() => {
    const generalBtn = [...document.querySelectorAll('.settings-nav button')].find(b => b.textContent.includes('Общие'))
    if (!generalBtn) return 'NOT_FOUND'
    generalBtn.click()
    return 'CLICKED'
  })()`)
  console.log('Clicked general:', clicked)
  await new Promise(r => setTimeout(r, 500))

  const afterClick = await win.webContents.executeJavaScript(`(() => {
    const activeHeader = document.querySelector('.settings-section-heading h3')?.textContent
    const panelBtns = [...document.querySelectorAll('.settings-panel button')].map(b => b.textContent.trim())
    return { activeHeader, buttons: panelBtns }
  })()`)
  console.log('After click:', JSON.stringify(afterClick, null, 2))

  app.exit(0)
}).catch(err => {
  console.error(err)
  app.exit(1)
})
