const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

app.disableHardwareAcceleration();

const SCREENSHOT_DIR = path.join(__dirname, '../qa/screenshots/audit');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.on('ready', async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: false
    }
  });

  const capture = async (name) => {
    await sleep(400);
    const img = await win.webContents.capturePage();
    const dest = path.join(SCREENSHOT_DIR, `${name}.png`);
    fs.writeFileSync(dest, img.toPNG());
    console.log(`[SAVED] ${name}.png (${fs.statSync(dest).size} bytes)`);
  };

  const evalJs = async (fnString) => {
    return await win.webContents.executeJavaScript(`(() => { ${fnString} })()`);
  };

  try {
    console.log('Loading demo...');
    await win.loadURL('http://127.0.0.1:5173/?demo=1');
    await sleep(2500);

    // 1. Focus Timer Modal
    console.log('1. Focus modal...');
    await evalJs(`
      const timerBtn = document.querySelector('.calm-dock-timer');
      if (timerBtn) {
        timerBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    `);
    await sleep(600);
    await capture('final_01_focus_modal');

    // Close modal
    await evalJs(`
      const closeBtn = document.querySelector('[role="dialog"] button[aria-label="Закрыть"]');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(400);

    // 2. Dock Quick Entry Popover
    console.log('2. Dock quick entry...');
    await evalJs(`
      const captureBtn = document.querySelector('.dock-entry-anchor .calm-capture');
      if (captureBtn) {
        captureBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    `);
    await sleep(600);
    await capture('final_02_dock_quick_entry_popover');

    // Close quick entry
    await evalJs(`
      const closeBtn = document.querySelector('.dock-entry-close');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(400);

    // 3. App Launcher Popover (Figma)
    console.log('3. App launcher popover...');
    await evalJs(`
      const appBtn = document.querySelector('.calm-app-btn');
      if (appBtn) {
        appBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    `);
    await sleep(600);
    await capture('final_03_app_launcher_popover');

    // Close app launcher
    await evalJs(`
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    `);
    await sleep(400);

    // 4. Space Detail: Работа
    console.log('4. Space detail Работа...');
    await evalJs(`
      const spaceBtn = Array.from(document.querySelectorAll('.chrome-spaces button')).find(b => b.textContent.includes('Работа'));
      if (spaceBtn) {
        spaceBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    `);
    await sleep(800);
    await capture('final_04_space_detail_rabota');

    // 5. Dashboard Layout Customizer
    console.log('5. Dashboard Layout Customizer...');
    // Return home first
    await evalJs(`
      const homeBtn = document.querySelector('.brand');
      if (homeBtn) homeBtn.click();
    `);
    await sleep(600);
    // Open settings
    await evalJs(`
      const setBtn = document.querySelector('.chrome-button[aria-label="Настройки"]');
      if (setBtn) setBtn.click();
    `);
    await sleep(600);
    // Click "Настроить ->"
    await evalJs(`
      const customizeBtn = Array.from(document.querySelectorAll('.settings-panel button')).find(b => b.textContent.includes('Настроить'));
      if (customizeBtn) customizeBtn.click();
    `);
    await sleep(600);
    await capture('final_05_dashboard_layout_customizer');

    console.log('ALL DONE CLEANLY!');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    app.quit();
  }
});
