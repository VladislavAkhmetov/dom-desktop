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

  win.webContents.on('console-message', (e, level, message) => {
    if (level === 2) console.error('[BROWSER ERR]', message);
  });

  const capture = async (name) => {
    await sleep(450);
    const img = await win.webContents.capturePage();
    const dest = path.join(SCREENSHOT_DIR, `${name}.png`);
    fs.writeFileSync(dest, img.toPNG());
    console.log(`[AUDIT] Saved: ${name}.png (${fs.statSync(dest).size} bytes)`);
    return dest;
  };

  const evalJs = async (fnString, label = '') => {
    try {
      const code = `(() => { ${fnString} })()`;
      return await win.webContents.executeJavaScript(code);
    } catch (err) {
      console.warn(`[AUDIT WARN] ${label}:`, err.message);
      return null;
    }
  };

  const closeDialogs = async () => {
    await evalJs(`
      const closeBtn = document.querySelector('[role="dialog"] button[aria-label="Закрыть"], .dialog-close, button.calm-icon[aria-label="Закрыть"]');
      if (closeBtn) closeBtn.click();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    `, 'closeDialogs');
    await sleep(400);
  };

  const loadFresh = async (extraParam = '') => {
    await win.loadURL(`http://127.0.0.1:5173/?demo=1${extraParam}`);
    await sleep(1800);
  };

  try {
    console.log('[AUDIT] Loading fresh web demo for second batch...');
    await loadFresh();

    // ==========================================
    // 8. DOCK: QUICK ENTRY / CAPTURE
    // ==========================================
    console.log('[AUDIT] 8a. Dock Quick Entry Popover');
    await evalJs(`
      const btn = Array.from(document.querySelectorAll('.bottom-dock button, .dock-action-button')).find(b => b.textContent.includes('Записать'));
      if (btn) btn.click();
    `, 'dock-write-click');
    await sleep(600);
    await capture('08a_dock_quick_entry_popover');

    await closeDialogs();

    // ==========================================
    // 9. ZEN FOCUS TIMER
    // ==========================================
    console.log('[AUDIT] 9. Zen Focus Timer Modal');
    await evalJs(`
      const btn = Array.from(document.querySelectorAll('.bottom-dock button, .dock-action-button')).find(b => b.textContent.includes('Фокус'));
      if (btn) btn.click();
    `, 'focus-click');
    await sleep(600);
    await capture('09_focus_timer_dialog');

    await closeDialogs();

    // ==========================================
    // 10. AI ASSISTANT PANEL
    // ==========================================
    console.log('[AUDIT] 10. AI Assistant Panel');
    await evalJs(`
      const aiBtn = document.querySelector('.chrome-assistant');
      if (aiBtn) aiBtn.click();
    `, 'ai-click');
    await sleep(700);
    await capture('10_ai_assistant_panel');

    // Close AI panel
    await evalJs(`
      const closeAi = document.querySelector('.assistant-panel [aria-label="Закрыть"], .assistant-close');
      if (closeAi) closeAi.click();
      else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `, 'ai-close');
    await sleep(400);

    // ==========================================
    // 11. GLOBAL SEARCH (Ctrl+K)
    // ==========================================
    console.log('[AUDIT] 11a. Global Search Empty');
    await evalJs(`
      const searchBtn = document.querySelector('.chrome-button[title*="Ctrl K"]');
      if (searchBtn) searchBtn.click();
    `, 'search-click');
    await sleep(500);
    await capture('11a_global_search_empty');

    console.log('[AUDIT] 11b. Global Search Query');
    await evalJs(`
      const input = document.querySelector('.context-search-input, .search-dialog input, [role="dialog"] input[type="text"]');
      if (input) {
        input.value = 'логотип';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `, 'search-query');
    await sleep(500);
    await capture('11b_global_search_results');

    await closeDialogs();

    // ==========================================
    // 12. TAB DESK OVERVIEW (Ctrl+Shift+A)
    // ==========================================
    console.log('[AUDIT] 12. Tab Desk Overview');
    await evalJs(`
      const deskBtn = document.querySelector('.chrome-tab-desk');
      if (deskBtn) deskBtn.click();
    `, 'tabdesk-click');
    await sleep(600);
    await capture('12_tab_desk_overview');

    await closeDialogs();

    // ==========================================
    // 13. SETTINGS & TABS
    // ==========================================
    console.log('[AUDIT] 13a. Settings General');
    await evalJs(`
      const setBtn = document.querySelector('.chrome-button[aria-label="Настройки"]');
      if (setBtn) setBtn.click();
    `, 'settings-click');
    await sleep(600);
    await capture('13a_settings_general');

    console.log('[AUDIT] 13b. Settings Calendars');
    await evalJs(`
      const tab = Array.from(document.querySelectorAll('.settings-nav button')).find(b => b.textContent.includes('Календар'));
      if (tab) tab.click();
    `, 'settings-cal');
    await sleep(400);
    await capture('13b_settings_calendars');

    console.log('[AUDIT] 13c. Settings Mail');
    await evalJs(`
      const tab = Array.from(document.querySelectorAll('.settings-nav button')).find(b => b.textContent.includes('Почта'));
      if (tab) tab.click();
    `, 'settings-mail');
    await sleep(400);
    await capture('13c_settings_mail');

    console.log('[AUDIT] 13d. Settings News');
    await evalJs(`
      const tab = Array.from(document.querySelectorAll('.settings-nav button')).find(b => b.textContent.includes('Новости'));
      if (tab) tab.click();
    `, 'settings-news');
    await sleep(400);
    await capture('13d_settings_news');

    console.log('[AUDIT] 13e. Settings AI');
    await evalJs(`
      const tab = Array.from(document.querySelectorAll('.settings-nav button')).find(b => b.textContent.includes('ИИ'));
      if (tab) tab.click();
    `, 'settings-ai');
    await sleep(400);
    await capture('13e_settings_ai');

    console.log('[AUDIT] 13f. Settings Dashboard Layout');
    await evalJs(`
      const tab = Array.from(document.querySelectorAll('.settings-nav button, .settings-panel button')).find(b => b.textContent.includes('Дашборд') || b.textContent.includes('Виджет'));
      if (tab) tab.click();
    `, 'settings-dash');
    await sleep(500);
    await capture('13f_dashboard_customizer');

    await closeDialogs();

    // ==========================================
    // 14. WEATHER FORECAST & TRAFFIC
    // ==========================================
    console.log('[AUDIT] 14. Weather Details');
    await evalJs(`
      const weatherBtn = document.querySelector('.hub-weather');
      if (weatherBtn) weatherBtn.click();
    `, 'weather-click');
    await sleep(400);
    await evalJs(`
      const action = document.querySelector('.ambient-card-action');
      if (action) action.click();
    `, 'weather-action');
    await sleep(500);
    await capture('14_weather_details_dialog');

    await closeDialogs();

    // ==========================================
    // 15. SPACE DETAIL: РАБОТА
    // ==========================================
    console.log('[AUDIT] 15a. Space Detail: Работа');
    await evalJs(`
      const spaceTab = Array.from(document.querySelectorAll('.chrome-spaces button')).find(b => b.textContent.trim() === 'Работа');
      if (spaceTab) spaceTab.click();
    `, 'space-rabota');
    await sleep(700);
    await capture('15a_space_detail_rabota');

    console.log('[AUDIT] 15b. Space Add Menu');
    await evalJs(`
      const addTrigger = document.querySelector('.space-add-actions [aria-haspopup="menu"]');
      if (addTrigger) addTrigger.click();
    `, 'space-add-click');
    await sleep(400);
    await capture('15b_space_add_menu');

    // Close menu
    await evalJs(`
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `);
    await sleep(300);

    console.log('[AUDIT] 15c. Space Edit Context Dialog');
    await evalJs(`
      const editCtx = document.querySelector('[aria-label="Настроить продолжение текущего дела"]');
      if (editCtx) editCtx.click();
    `, 'space-edit-ctx');
    await sleep(500);
    await capture('15c_space_edit_context_dialog');

    await closeDialogs();

    // ==========================================
    // 16. SPACES OVERVIEW & CREATE SPACE
    // ==========================================
    console.log('[AUDIT] 16a. Spaces Overview');
    await evalJs(`
      const allSpaces = Array.from(document.querySelectorAll('.chrome-spaces button')).find(b => b.textContent.includes('Все пространства'));
      if (allSpaces) allSpaces.click();
    `, 'spaces-overview');
    await sleep(600);
    await capture('16a_spaces_overview');

    console.log('[AUDIT] 16b. Create Space Dialog');
    await evalJs(`
      const plusBtn = document.querySelector('.chrome-new-space, [aria-label="Создать пространство"]');
      if (plusBtn) plusBtn.click();
    `, 'new-space-click');
    await sleep(500);
    await capture('16b_create_space_dialog');

    await closeDialogs();

    // ==========================================
    // 17. WORKSTAGE / BROWSER SHELL (WEB MODE)
    // ==========================================
    console.log('[AUDIT] 17a. Workstage Browser Shell');
    await evalJs(`
      const browserBtn = document.querySelector('.chrome-button.chrome-browser');
      if (browserBtn) browserBtn.click();
    `, 'browser-shell-click');
    await sleep(800);
    await capture('17a_workstage_browser_shell');

    console.log('[AUDIT] 17b. Browser Day Panel');
    await evalJs(`
      const pulse = document.querySelector('.browser-day-pulse');
      if (pulse) pulse.click();
    `, 'pulse-click');
    await sleep(600);
    await capture('17b_browser_day_panel');

    // Close day panel
    await evalJs(`
      const closePanel = document.querySelector('.browser-day-panel button[aria-label="Закрыть"], .browser-day-panel .dialog-close');
      if (closePanel) closePanel.click();
    `);
    await sleep(400);

    // Return Home
    await evalJs(`
      const brand = document.querySelector('.brand, button[aria-label*="Вернуться"], button[aria-label*="главную"]');
      if (brand) brand.click();
    `);
    await sleep(700);

    // ==========================================
    // 18. RESPONSIVE VIEWPORTS
    // ==========================================
    console.log('[AUDIT] 18a. Responsive 1280x720');
    win.setSize(1280, 720);
    await sleep(700);
    await capture('18a_responsive_1280x720');

    console.log('[AUDIT] 18b. Responsive 1024x768');
    win.setSize(1024, 768);
    await sleep(700);
    await capture('18b_responsive_1024x768');

    console.log('[AUDIT] 18c. Responsive 640x800 (Narrow Mobile)');
    win.setSize(640, 800);
    await sleep(700);
    await capture('18c_responsive_640x800');

    console.log('[AUDIT BATCH 2 SUCCESS] All remaining screenshots captured cleanly!');
  } catch (err) {
    console.error('[AUDIT RUNTIME ERROR]', err);
  } finally {
    app.quit();
  }
});
