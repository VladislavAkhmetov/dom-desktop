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

  win.webContents.on('console-message', (e, level, message) => {
    console.log('[BROWSER]', message);
  });

  await win.loadURL('http://127.0.0.1:5173/?demo=1');
  await new Promise(r => setTimeout(r, 2000));
  
  const img = await win.webContents.capturePage();
  const dest = path.join(__dirname, '../qa/screenshots/verify-web-demo.png');
  fs.writeFileSync(dest, img.toPNG());
  console.log('Saved screenshot to:', dest, 'size:', fs.statSync(dest).size);
  app.quit();
});
