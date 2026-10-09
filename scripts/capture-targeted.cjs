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
    await sleep(450);
    const img = await win.webContents.capturePage();
    const dest = path.join(SCREENSHOT_DIR, `${name}.png`);
    fs.writeFileSync(dest, img.toPNG());
    console.log(`[TARGETED] Saved: ${name}.png (${fs.statSync(dest).size} bytes)`);
    return dest;
  };

  const evalJs = async (fnString) => {
    return await win.webContents.executeJavaScript(`(() => { ${fnString} })()`);
  };

  const loadHome = async () => {
    await win.loadURL('http://127.0.0.1:5173/?demo=1');
    await sleep(1800);
  };

  try {
    // 1. Focus Timer Modal
    console.log('[TARGETED] 1. Focus Timer Modal');
    await loadHome();
    await evalJs(`
      const timerBtn = document.querySelector('.calm-dock-timer');
      if (timerBtn) timerBtn.click();
    `);
    await sleep(600);
    await capture('targeted_01_focus_timer_modal');

    // 2. Dock Quick Entry Popover
    console.log('[TARGETED] 2. Dock Quick Entry Popover');
    await loadHome();
    await evalJs(`
      const captureBtn = document.querySelector('.calm-capture.dock-entry-button');
      if (captureBtn) captureBtn.click();
    `);
    await sleep(600);
    await capture('targeted_02_dock_quick_entry');

    // 3. App Launcher Popover (e.g. Figma)
    console.log('[TARGETED] 3. App Launcher Popover');
    await loadHome();
    await evalJs(`
      const appBtn = document.querySelector('.calm-app-btn');
      if (appBtn) appBtn.click();
    `);
    await sleep(600);
    await capture('targeted_03_app_launcher_popover');

    // 4. Tab Desk Overview
    console.log('[TARGETED] 4. Tab Desk Overview');
    await loadHome();
    await evalJs(`
      const deskBtn = document.querySelector('.chrome-tab-desk');
      if (deskBtn) deskBtn.click();
    `);
    await sleep(700);
    await capture('targeted_04_tab_desk_overview');

    // 5. Space Detail: Работа
    console.log('[TARGETED] 5. Space Detail: Работа');
    await loadHome();
    await evalJs(`
      const spaceTab = Array.from(document.querySelectorAll('.chrome-spaces button')).find(b => b.textContent.trim() === 'Работа');
      if (spaceTab) spaceTab.click();
    `);
    await sleep(800);
    await capture('targeted_05_space_detail_rabota');

    // 6. Dashboard Layout & Wallpaper Customizer
    console.log('[TARGETED] 6. Dashboard Layout Customizer');
    await loadHome();
    await evalJs(`
      const setBtn = document.querySelector('.chrome-button[aria-label="Настройки"]');
      if (setBtn) setBtn.click();
    `);
    await sleep(600);
    await evalJs(`
      const customizeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Настроить'));
      if (customizeBtn) customizeBtn.click();
    `);
    await sleep(600);
    await capture('targeted_06_dashboard_customizer');

    // 7. News Settings / RSS configuration in Settings
    console.log('[TARGETED] 7. Settings News / RSS');
    await loadHome();
    await evalJs(`
      const setBtn = document.querySelector('.chrome-button[aria-label="Настройки"]');
      if (setBtn) setBtn.click();
    `);
    await sleep(500);
    await evalJs(`
      const newsTab = Array.from(document.querySelectorAll('.settings-nav button')).find(b => b.textContent.includes('Дайджест'));
      if (newsTab) newsTab.click();
    `);
    await sleep(500);
    await capture('targeted_07_settings_digest_sources');

    // 8. Mail Account Settings in Settings
    console.log('[TARGETED] 8. Settings Mail Account');
    await evalJs(`
      const mailTab = Array.from(document.querySelectorAll('.settings-nav button')).find(b => b.textContent.includes('Почта'));
      if (mailTab) mailTab.click();
    `);
    await sleep(500);
    await capture('targeted_08_settings_mail_account');

    // 9. Home view on 1280x720 (to check scrollbars on Home)
    console.log('[TARGETED] 9. Home 1280x720');
    await loadHome();
    win.setSize(1280, 720);
    await sleep(600);
    await capture('targeted_09_home_1280x720');

    console.log('[TARGETED ALL DONE!]');
  } catch (err) {
    console.error('[TARGETED ERROR]', err);
  } finally {
    app.quit();
  }
});
