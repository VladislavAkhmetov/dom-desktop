const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.disableHardwareAcceleration();
app.on('ready', async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 1050,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  });

  win.webContents.on('console-message', (e, level, message) => {
    console.log('[BROWSER]', message);
  });

  await win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { cabinet: '1', demo: '1' } });
  await new Promise(r => setTimeout(r, 1500));

  // 1. Explicitly switch to List mode
  const res1 = await win.webContents.executeJavaScript(`
    (() => {
      const listBtn = document.querySelector('button[aria-label="Отображение списком"]');
      if (listBtn) listBtn.click();
      return { listFound: !!listBtn, currentMode: localStorage.getItem('dombro:reading-shelf-view') };
    })()
  `);
  console.log('List switch result:', res1);
  await new Promise(r => setTimeout(r, 600));

  // Full dashboard screenshot (List mode)
  const img1 = await win.webContents.capturePage();
  const dest1 = path.join(__dirname, '../qa/screenshots/visual-qa/01-reading-shelf-list.png');
  fs.writeFileSync(dest1, img1.toPNG());

  // Macro closeup of Reading Shelf card (List mode)
  const rectList = await win.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector('[data-widget="reading"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    })()
  `);
  if (rectList) {
    const cardImgList = await win.webContents.capturePage(rectList);
    const destCardList = path.join(__dirname, '../qa/screenshots/visual-qa/03-reading-shelf-list-closeup.png');
    fs.writeFileSync(destCardList, cardImgList.toPNG());
    console.log('Saved list closeup to:', destCardList);
  }

  // 2. Switch to Grid / Tiles mode
  const res2 = await win.webContents.executeJavaScript(`
    (() => {
      const gridBtn = document.querySelector('button[aria-label="Отображение плитками"]');
      if (gridBtn) gridBtn.click();
      return { gridFound: !!gridBtn, currentMode: localStorage.getItem('dombro:reading-shelf-view') };
    })()
  `);
  console.log('Grid switch result:', res2);
  await new Promise(r => setTimeout(r, 600));

  // Full dashboard screenshot (Grid mode)
  const img2 = await win.webContents.capturePage();
  const dest2 = path.join(__dirname, '../qa/screenshots/visual-qa/02-reading-shelf-grid.png');
  fs.writeFileSync(dest2, img2.toPNG());

  // Macro closeup of Reading Shelf card (Grid mode)
  const rectGrid = await win.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector('[data-widget="reading"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    })()
  `);
  if (rectGrid) {
    const cardImgGrid = await win.webContents.capturePage(rectGrid);
    const destCardGrid = path.join(__dirname, '../qa/screenshots/visual-qa/04-reading-shelf-grid-closeup.png');
    fs.writeFileSync(destCardGrid, cardImgGrid.toPNG());
    console.log('Saved grid closeup to:', destCardGrid);
  }

  app.quit();
});
