const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { additionalArguments: ['--cabinet-pilot'] } })
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await new Promise(r => setTimeout(r, 1000))

  // Select space 'Обновить логотип'
  await win.webContents.executeJavaScript(`
    const spaceBtn = [...document.querySelectorAll('.chrome-space')].find(b => b.textContent.includes('Обновить логотип'))
    if (spaceBtn) spaceBtn.click()
  `)
  await new Promise(r => setTimeout(r, 600))

  const inCabinet = await win.webContents.executeJavaScript(`
    Boolean(document.querySelector('.cabinet-contents'))
  `)
  console.log('In cabinet view:', inCabinet)

  // Now click .cabinet-tab-open
  const clickResult = await win.webContents.executeJavaScript(`(() => {
    const btn = document.querySelector('.cabinet-tab-open')
    if (!btn) return 'NO_BTN'
    btn.click()
    return 'CLICKED: ' + btn.getAttribute('aria-label')
  })()`)
  console.log('Click result:', clickResult)
  await win.webContents.executeJavaScript(`new Promise(resolve => {
    const check = () => {
      if (document.querySelector('.browser-chrome.browser-topbar') && !document.querySelector('[data-workspace-transition]')) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  })`);
  await new Promise(r => setTimeout(r, 600));

  const shot = await win.webContents.capturePage()
  fs.writeFileSync(path.join(__dirname, '../qa/screenshots/visual-qa/test-browser-stage.png'), shot.toPNG())
  console.log('Saved test-browser-stage.png')

  app.exit(0)
}).catch(err => {
  console.error(err)
  app.exit(1)
})
