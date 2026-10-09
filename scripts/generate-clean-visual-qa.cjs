const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const ssDir = path.resolve(__dirname, '../qa/screenshots/visual-qa')
fs.mkdirSync(ssDir, { recursive: true })

app.disableHardwareAcceleration()

async function capture(win, filename) {
  // Let React and DOM layout settle
  await new Promise(r => setTimeout(r, 600))
  const shot = await win.webContents.capturePage()
  fs.writeFileSync(path.join(ssDir, filename), shot.toPNG())
  console.log('✓ Captured:', filename)
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      additionalArguments: ['--cabinet-pilot'],
      contextIsolation: true,
      sandbox: true
    }
  })

  // 1. Dashboard home
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } })
  await new Promise(r => setTimeout(r, 1200))
  await capture(win, '01-dashboard-home.png')

  // 2. Profile popover
  await win.webContents.executeJavaScript(`document.querySelector('.chrome-profile').click()`)
  await capture(win, '02-profile-popover.png')

  // 3. Profile customized
  await win.webContents.executeJavaScript(`
    const lilac = document.querySelector('.profile-tone-btn.tone-lilac')
    if (lilac) lilac.click()
    const emojis = [...document.querySelectorAll('.profile-emoji-btn')]
    const rocket = emojis.find(b => b.textContent.includes('🚀')) || emojis[0]
    if (rocket) rocket.click()
  `)
  await capture(win, '03-profile-customized.png')

  // 4. Settings (Profile)
  await win.webContents.executeJavaScript(`
    const btn = [...document.querySelectorAll('.profile-action-btn')].find(b => b.textContent.includes('Настройки'))
    if (btn) btn.click()
  `)
  await capture(win, '04-settings-profile.png')

  // Close Settings dialog
  await win.webContents.executeJavaScript(`
    const closeBtn = document.querySelector('.calm-dialog button[aria-label="Закрыть"]')
    if (closeBtn) closeBtn.click()
  `)
  await new Promise(r => setTimeout(r, 400))

  // 5. Wallpaper settings
  // Re-open profile popover and click "Фон и оформление"
  await win.webContents.executeJavaScript(`document.querySelector('.chrome-profile').click()`)
  await new Promise(r => setTimeout(r, 400))
  await win.webContents.executeJavaScript(`
    const btn = [...document.querySelectorAll('.profile-action-btn')].find(b => b.textContent.includes('Фон и оформление'))
    if (btn) btn.click()
  `)
  await new Promise(r => setTimeout(r, 400))
  // Switch to Wallpaper tab inside DashboardSettings
  await win.webContents.executeJavaScript(`
    const tab = [...document.querySelectorAll('.calm-dialog .calm-tabs button')].find(b => b.textContent.includes('Фон'))
    if (tab) tab.click()
  `)
  await capture(win, '05-settings-wallpaper.png')

  // Close wallpaper dialog (click "Готово")
  await win.webContents.executeJavaScript(`
    const doneBtn = [...document.querySelectorAll('.calm-dialog button')].find(b => b.textContent.trim() === 'Готово')
    if (doneBtn) doneBtn.click()
  `)
  await new Promise(r => setTimeout(r, 400))
  // And close settings if it opened
  await win.webContents.executeJavaScript(`
    const closeBtn = document.querySelector('.calm-dialog button[aria-label="Закрыть"]')
    if (closeBtn) closeBtn.click()
  `)
  await new Promise(r => setTimeout(r, 400))

  // 6. Cabinet dashboard view (Space «Обновить логотип»)
  await win.webContents.executeJavaScript(`
    const spaceBtns = [...document.querySelectorAll('.chrome-space')]
    const spaceBtn = spaceBtns.find(b => b.textContent.includes('Обновить логотип'))
    if (spaceBtn) spaceBtn.click()
  `)
  await capture(win, '06-cabinet-dashboard-view.png')

  // 7. Context menu on tab card
  await win.webContents.executeJavaScript(`
    const menuBtn = document.querySelector('.cabinet-tab-card .task-more, .cabinet-tab-card button[aria-label*="Действия"]')
    if (menuBtn) menuBtn.click()
  `)
  await capture(win, '07-cabinet-context-menu.png')

  // Close context menu
  await win.webContents.executeJavaScript(`
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  `)
  await new Promise(r => setTimeout(r, 400))

  // 8. New space created via '+' button
  await win.webContents.executeJavaScript(`
    const plusBtn = document.querySelector('.chrome-new-space')
    if (plusBtn) plusBtn.click()
  `)
  await capture(win, '08-cabinet-created.png')

  // 9. Browser Workstage
  // Return to «Обновить логотип» and open tab
  await win.webContents.executeJavaScript(`
    const spaceBtns = [...document.querySelectorAll('.chrome-space')]
    const spaceBtn = spaceBtns.find(b => b.textContent.includes('Обновить логотип'))
    if (spaceBtn) spaceBtn.click()
  `)
  await new Promise(r => setTimeout(r, 400))
  // Direct route to browse mode for clean workstage capture
  await win.webContents.executeJavaScript(`
    const tabOpen = document.querySelector('.cabinet-tab-open')
    if (tabOpen) tabOpen.click()
  `)
  await capture(win, '09-browser-workstage.png')

  // 10. Browser Day Panel
  await win.webContents.executeJavaScript(`
    const dayBtn = document.querySelector('.browser-day-pulse, button[aria-label*="Мой день"]')
    if (dayBtn) dayBtn.click()
  `)
  await capture(win, '10-browser-day-panel.png')

  // 11. Return to dashboard
  await win.webContents.executeJavaScript(`
    const dashBtn = document.querySelector('.browser-home, .brand, button[aria-label*="дашборд"]')
    if (dashBtn) dashBtn.click()
  `)
  await capture(win, '11-return-to-dashboard.png')

  console.log('\n=============================================')
  console.log('ВСЕ 11 СКРИНШОТОВ УСПЕШНО СФОРМИРОВАНЫ!')
  console.log('=============================================')
  app.exit(0)
}).catch(err => {
  console.error('Failure:', err)
  app.exit(1)
})
