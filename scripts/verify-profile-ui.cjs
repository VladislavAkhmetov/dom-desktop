const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.disableHardwareAcceleration();

app.on('ready', async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  });

  win.webContents.on('console-message', (_e, _level, message) => {
    console.log('[BROWSER]', message);
  });

  const distFile = path.join(__dirname, '../dist/index.html');
  await win.loadFile(distFile, { query: { demo: '1', cabinet: '1' } });
  await new Promise(r => setTimeout(r, 1500));

  // Screenshot 1: Dashboard with profile avatar button in header
  let img = await win.webContents.capturePage();
  const dest1 = path.join(__dirname, '../qa/screenshots/profile-dashboard.png');
  fs.writeFileSync(dest1, img.toPNG());
  console.log('Saved profile-dashboard screenshot:', dest1);

  // Click on profile avatar button
  await win.webContents.executeJavaScript(`
    const btn = document.querySelector('.chrome-profile');
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 600));

  // Screenshot 2: Profile Popover open
  img = await win.webContents.capturePage();
  const dest2 = path.join(__dirname, '../qa/screenshots/profile-popover.png');
  fs.writeFileSync(dest2, img.toPNG());
  console.log('Saved profile-popover screenshot:', dest2);

  // Click on "Настройки профиля" in popover
  await win.webContents.executeJavaScript(`
    const actionBtns = [...document.querySelectorAll('.profile-action-btn')];
    const settingsBtn = actionBtns.find(b => b.textContent.includes('Настройки'));
    if (settingsBtn) settingsBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));

  // Screenshot 3: Settings with Profile tab open
  img = await win.webContents.capturePage();
  const dest3 = path.join(__dirname, '../qa/screenshots/profile-settings.png');
  fs.writeFileSync(dest3, img.toPNG());
  console.log('Saved profile-settings screenshot:', dest3);

  app.quit();
});
