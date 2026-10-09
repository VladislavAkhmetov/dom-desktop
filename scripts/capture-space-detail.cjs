const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.disableHardwareAcceleration();

app.on('ready', async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false, webPreferences: { sandbox: true, contextIsolation: false } });
  await win.loadURL('http://127.0.0.1:5173/?demo=1');
  await new Promise(r => setTimeout(r, 2000));
  
  // Navigate to spaces overview first
  await win.webContents.executeJavaScript(`(() => {
    const btn = Array.from(document.querySelectorAll('.chrome-spaces button')).find(b => b.textContent.includes('Все пространства'));
    if (btn) btn.click();
  })()`);
  await new Promise(r => setTimeout(r, 600));

  // Click on "Работа" space card
  await win.webContents.executeJavaScript(`(() => {
    const card = Array.from(document.querySelectorAll('.space-card, [aria-label*="Работа"], .space-summary-card')).find(b => b.textContent.includes('Работа'));
    if (card) card.click();
  })()`);
  await new Promise(r => setTimeout(r, 800));

  const img = await win.webContents.capturePage();
  const dest = path.join(__dirname, '../qa/screenshots/audit/space_detail_materials.png');
  fs.writeFileSync(dest, img.toPNG());
  console.log('Saved space_detail_materials.png size:', fs.statSync(dest).size);
  app.quit();
});
