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

  const consoleLogs = [];
  win.webContents.on('console-message', (e, level, message) => {
    consoleLogs.push({ level, message });
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

  const closeModalsAndMenus = async () => {
    await evalJs(`
      // Close any action menu popovers
      document.querySelectorAll('.action-menu-popover').forEach(el => el.remove());
      // Click close buttons on dialogs
      const closeButtons = document.querySelectorAll('[role="dialog"] button[aria-label="Закрыть"], .dialog-close, button.calm-icon[aria-label="Закрыть"]');
      closeButtons.forEach(btn => btn.click());
      // Dispatch Escape to window
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      // Dismiss pointer
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    `, 'closeModalsAndMenus');
    await sleep(350);
  };

  const resetToHome = async () => {
    await closeModalsAndMenus();
    await evalJs(`
      const homeBtn = document.querySelector('.brand, button[aria-label*="главную"]');
      if (homeBtn) homeBtn.click();
    `, 'resetToHome');
    await sleep(500);
  };

  try {
    console.log('[AUDIT] Loading web demo...');
    await win.loadURL('http://127.0.0.1:5173/?demo=1');
    await sleep(2500);

    // ==========================================
    // 1. HOME DASHBOARD BASELINE
    // ==========================================
    console.log('[AUDIT] 1. Baseline Home Screen');
    await capture('01_home_baseline');

    // ==========================================
    // 2. ATTENTION ISLAND
    // ==========================================
    console.log('[AUDIT] 2. Attention Island Expanded');
    await evalJs(`
      const trigger = document.querySelector('.island-trigger, .universal-island button');
      if (trigger) trigger.click();
    `, 'island-open');
    await sleep(500);
    await capture('02_attention_island_expanded');

    // Close island
    await evalJs(`
      const closeBtn = document.querySelector('.island-detail-heading button');
      if (closeBtn) closeBtn.click();
      else document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    `, 'island-close');
    await sleep(400);

    // ==========================================
    // 3. CALENDAR VIEWS
    // ==========================================
    console.log('[AUDIT] 3a. Calendar Day View');
    await evalJs(`
      const dayBtn = Array.from(document.querySelectorAll('.plan-view-switch button')).find(b => b.textContent.includes('День'));
      if (dayBtn) dayBtn.click();
    `, 'calendar-day-click');
    await sleep(600);
    await capture('03a_calendar_day_dialog');

    console.log('[AUDIT] 3b. Calendar Week View');
    await evalJs(`
      const weekBtn = Array.from(document.querySelectorAll('.calendar-modes button')).find(b => b.textContent.includes('Неделя'));
      if (weekBtn) weekBtn.click();
    `, 'calendar-week-click');
    await sleep(500);
    await capture('03b_calendar_week_dialog');

    console.log('[AUDIT] 3c. Calendar Month View');
    await evalJs(`
      const monthBtn = Array.from(document.querySelectorAll('.calendar-modes button')).find(b => b.textContent.includes('Месяц'));
      if (monthBtn) monthBtn.click();
    `, 'calendar-month-click');
    await sleep(500);
    await capture('03c_calendar_month_dialog');

    await closeModalsAndMenus();

    // ==========================================
    // 4. TASK ACTIONS & EDITING
    // ==========================================
    console.log('[AUDIT] 4a. Task Actions Menu');
    await evalJs(`
      const moreBtn = document.querySelector('.plan-card .calm-plan-item [aria-haspopup="menu"]');
      if (moreBtn) moreBtn.click();
    `, 'task-more-click');
    await sleep(400);
    await capture('04a_task_actions_menu');

    console.log('[AUDIT] 4b. Task Edit Dialog');
    await evalJs(`
      const editBtn = Array.from(document.querySelectorAll('.action-menu-popover button')).find(b => b.textContent.includes('Изменить'));
      if (editBtn) editBtn.click();
    `, 'task-edit-click');
    await sleep(500);
    await capture('04b_task_edit_dialog');

    await closeModalsAndMenus();

    // ==========================================
    // 5. DAY PLAN: TOMORROW & ADD TASK
    // ==========================================
    console.log('[AUDIT] 5a. Day Plan Tomorrow');
    await evalJs(`
      const tomTab = Array.from(document.querySelectorAll('.calm-tabs button')).find(b => b.textContent.includes('Завтра'));
      if (tomTab) tomTab.click();
    `, 'tomorrow-tab-click');
    await sleep(400);
    await capture('05a_plan_tomorrow_tab');

    // Switch back to today
    await evalJs(`
      const todayTab = Array.from(document.querySelectorAll('.calm-tabs button')).find(b => b.textContent.includes('Сегодня'));
      if (todayTab) todayTab.click();
    `, 'today-tab-click');
    await sleep(300);

    // ==========================================
    // 6. SAVED SECTION DIGESTS
    // ==========================================
    console.log('[AUDIT] 6a. Saved Notes Digest');
    await evalJs(`
      const notesBtn = Array.from(document.querySelectorAll('.plan-saved-links button')).find(b => b.textContent.includes('Мысли и дела'));
      if (notesBtn) notesBtn.click();
    `, 'saved-notes-click');
    await sleep(500);
    await capture('06a_saved_notes_dialog');

    console.log('[AUDIT] 6b. Saved Reading Digest');
    await evalJs(`
      const readTab = Array.from(document.querySelectorAll('.digest-tabs button')).find(b => b.textContent.includes('Почитать'));
      if (readTab) readTab.click();
    `, 'saved-read-click');
    await sleep(400);
    await capture('06b_saved_reading_dialog');

    console.log('[AUDIT] 6c. Saved Events Digest');
    await evalJs(`
      const eventTab = Array.from(document.querySelectorAll('.digest-tabs button')).find(b => b.textContent.includes('События'));
      if (eventTab) eventTab.click();
    `, 'saved-event-click');
    await sleep(400);
    await capture('06c_saved_events_dialog');

    await closeModalsAndMenus();

    // ==========================================
    // 7. CONTINUATION CARD MENU & INTERACTIONS
    // ==========================================
    console.log('[AUDIT] 7a. Continuation Menu');
    await evalJs(`
      const contMore = document.querySelector('.resume-card [aria-haspopup="menu"]');
      if (contMore) contMore.click();
    `, 'cont-more-click');
    await sleep(400);
    await capture('07a_continuation_menu');

    // Close menu safely
    await evalJs(`
      document.querySelectorAll('.action-menu-popover').forEach(el => el.remove());
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    `);
    await sleep(300);

    // Click "Продолжить" button to test web behavior with local files
    console.log('[AUDIT] 7b. Continuation "Продолжить" Web Toast');
    await evalJs(`
      const resumeBtn = document.querySelector('.resume-card .resume-action');
      if (resumeBtn) resumeBtn.click();
    `, 'resume-click');
    await sleep(500);
    await capture('07b_continuation_click_web_toast');

    await resetToHome();

    // ==========================================
    // 8. QUICK ENTRY (DOCK & HOME WIDGET)
    // ==========================================
    console.log('[AUDIT] 8a. Dock Quick Entry Popover');
    await evalJs(`
      const dockWrite = Array.from(document.querySelectorAll('.bottom-dock button')).find(b => b.textContent.includes('Записать'));
      if (dockWrite) dockWrite.click();
    `, 'dock-write-click');
    await sleep(500);
    await capture('08a_dock_quick_entry_popover');

    await closeModalsAndMenus();

    // ==========================================
    // 9. ZEN FOCUS TIMER
    // ==========================================
    console.log('[AUDIT] 9. Zen Focus Timer');
    await evalJs(`
      const focusBtn = Array.from(document.querySelectorAll('.bottom-dock button')).find(b => b.textContent.includes('Фокус'));
      if (focusBtn) focusBtn.click();
    `, 'focus-click');
    await sleep(600);
    await capture('09_focus_timer_dialog');

    await closeModalsAndMenus();

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

    await closeModalsAndMenus();

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
      const input = document.querySelector('.context-search-input, .search-dialog input, [role="dialog"] input');
      if (input) {
        input.value = 'логотип';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `, 'search-query');
    await sleep(500);
    await capture('11b_global_search_results');

    await closeModalsAndMenus();

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

    await closeModalsAndMenus();

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

    await closeModalsAndMenus();

    // ==========================================
    // 14. WEATHER FORECAST & TRAFFIC
    // ==========================================
    console.log('[AUDIT] 14. Weather Details');
    await evalJs(`
      const weatherBtn = document.querySelector('.hub-weather');
      if (weatherBtn) weatherBtn.click();
    `, 'weather-hover');
    await sleep(400);
    await evalJs(`
      const action = document.querySelector('.ambient-card-action');
      if (action) action.click();
    `, 'weather-action');
    await sleep(500);
    await capture('14_weather_details_dialog');

    await closeModalsAndMenus();

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

    await evalJs(`
      document.querySelectorAll('.action-menu-popover').forEach(el => el.remove());
    `);
    await sleep(200);

    console.log('[AUDIT] 15c. Space Edit Context Dialog');
    await evalJs(`
      const editCtx = document.querySelector('[aria-label="Настроить продолжение текущего дела"]');
      if (editCtx) editCtx.click();
    `, 'space-edit-ctx');
    await sleep(500);
    await capture('15c_space_edit_context_dialog');

    await closeModalsAndMenus();

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

    await closeModalsAndMenus();

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

    // Return Home
    await resetToHome();

    // ==========================================
    // 18. RESPONSIVE VIEWPORTS
    // ==========================================
    console.log('[AUDIT] 18a. 1280x720');
    win.setSize(1280, 720);
    await sleep(700);
    await capture('18a_responsive_1280x720');

    console.log('[AUDIT] 18b. 1024x768');
    win.setSize(1024, 768);
    await sleep(700);
    await capture('18b_responsive_1024x768');

    console.log('[AUDIT] 18c. 640x800 (Narrow)');
    win.setSize(640, 800);
    await sleep(700);
    await capture('18c_responsive_640x800');

    console.log('[AUDIT ALL DONE!] All 28 screenshots successfully captured and saved in qa/screenshots/audit/');
  } catch (err) {
    console.error('[AUDIT RUNTIME ERROR]', err);
  } finally {
    app.quit();
  }
});
