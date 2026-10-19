const fs = require('node:fs')
const path = require('node:path')
const { ElectronBlocker, fullLists } = require('@ghostery/adblocker-electron')

class AdblockManager {
  constructor({ userDataPath, getTabByWebContentsId, onBlocked }) {
    this.userDataPath = userDataPath
    this.getTabByWebContentsId = getTabByWebContentsId
    this.onBlocked = onBlocked
    this.cacheFile = path.join(userDataPath, 'adblock-cache.bin')
    this.settingsFile = path.join(userDataPath, 'adblock-settings.json')

    this.settings = {
      enabled: true,
      blockCookies: true,
      whitelist: [],
      darkSites: []
    }
    this.loadSettings()

    this.blocker = null
    this.ready = false
    this.initPromise = null
    this.tabStats = new Map() // tabId -> count
    this.session = null
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.settingsFile)) {
        const raw = fs.readFileSync(this.settingsFile, 'utf8')
        const parsed = JSON.parse(raw)
        this.settings = {
          enabled: parsed.enabled !== false,
          blockCookies: parsed.blockCookies !== false,
          whitelist: Array.isArray(parsed.whitelist) ? parsed.whitelist.map(h => String(h).toLowerCase().trim()) : [],
          darkSites: Array.isArray(parsed.darkSites) ? parsed.darkSites.map(h => String(h).toLowerCase().trim()) : []
        }
      }
    } catch {
      // safe fallback to defaults
    }
  }

  saveSettings() {
    try {
      const tmp = this.settingsFile + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(this.settings, null, 2), 'utf8')
      fs.renameSync(tmp, this.settingsFile)
    } catch (err) {
      console.error('[Adblock] Не удалось сохранить настройки:', err)
    }
  }

  async initialize(electronSession) {
    this.session = electronSession
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      const t0 = Date.now()
      try {
        if (fs.existsSync(this.cacheFile)) {
          const buffer = await fs.promises.readFile(this.cacheFile)
          this.blocker = ElectronBlocker.deserialize(buffer)
          console.log(`[Adblock] Восстановлен из дискового кэша за ${Date.now() - t0} мс`)
        }
      } catch (err) {
        console.warn('[Adblock] Ошибка чтения дискового кэша, загружаем prebuilt:', err.message)
      }

      if (!this.blocker) {
        try {
          console.log('[Adblock] Первичная сборка правил фильтрации...')
          this.blocker = await ElectronBlocker.fromPrebuiltFull(fetch)
          console.log(`[Adblock] Загружен full blocker за ${Date.now() - t0} мс`)
          // Асинхронно сохраняем кэш на диск, не блокируя работу
          fs.promises.writeFile(this.cacheFile, this.blocker.serialize())
            .then(() => console.log('[Adblock] Кэш успешно сохранён на диск'))
            .catch(e => console.warn('[Adblock] Не удалось записать кэш:', e.message))
        } catch (fetchErr) {
          console.error('[Adblock] Ошибка загрузки prebuilt фильтров:', fetchErr)
          this.blocker = ElectronBlocker.empty()
        }
      }

      this.wrapBlocker()
      if (this.session) {
        this.blocker.enableBlockingInSession(this.session)
      }
      this.ready = true
    })()

    return this.initPromise
  }

  normalizeHost(urlOrHost) {
    if (!urlOrHost) return ''
    try {
      if (urlOrHost.includes('://')) {
        return new URL(urlOrHost).hostname.toLowerCase()
      }
      return urlOrHost.toLowerCase().trim()
    } catch {
      return urlOrHost.toLowerCase().trim()
    }
  }

  isSiteDisabled(hostname) {
    const host = this.normalizeHost(hostname)
    if (!host) return false
    return this.settings.whitelist.some(item => host === item || host.endsWith('.' + item))
  }

  isDarkSite(hostname) {
    const host = this.normalizeHost(hostname)
    if (!host) return false
    return this.settings.darkSites.some(item => host === item || host.endsWith('.' + item))
  }

  toggleSite(hostname, disabled) {
    const host = this.normalizeHost(hostname)
    if (!host) return
    const current = this.isSiteDisabled(host)
    if (disabled && !current) {
      this.settings.whitelist.push(host)
      this.saveSettings()
    } else if (!disabled && current) {
      this.settings.whitelist = this.settings.whitelist.filter(item => item !== host && !host.endsWith('.' + item))
      this.saveSettings()
    }
  }

  toggleDarkSite(hostname, enabled) {
    const host = this.normalizeHost(hostname)
    if (!host) return
    const current = this.isDarkSite(host)
    if (enabled && !current) {
      this.settings.darkSites.push(host)
      this.saveSettings()
    } else if (!enabled && current) {
      this.settings.darkSites = this.settings.darkSites.filter(item => item !== host)
      this.saveSettings()
    }
  }

  toggleGlobal(enabled) {
    this.settings.enabled = Boolean(enabled)
    this.saveSettings()
  }

  toggleCookies(enabled) {
    this.settings.blockCookies = Boolean(enabled)
    this.saveSettings()
  }

  resetTabStats(tabId) {
    if (tabId) {
      this.tabStats.set(tabId, 0)
    }
  }

  getTabStats(tabId) {
    return this.tabStats.get(tabId) || 0
  }

  getStatus(tabId, hostname) {
    const host = this.normalizeHost(hostname)
    return {
      enabled: this.settings.enabled,
      siteDisabled: this.isSiteDisabled(host),
      blockedCount: this.getTabStats(tabId),
      blockCookies: this.settings.blockCookies,
      isDark: this.isDarkSite(host)
    }
  }

  wrapBlocker() {
    if (!this.blocker) return

    const originalOnBeforeRequest = this.blocker.onBeforeRequest.bind(this.blocker)
    this.blocker.onBeforeRequest = (details, callback) => {
      if (!this.settings.enabled) {
        callback({})
        return
      }

      // Находим текущую вкладку и её хост
      let tabId = null
      let host = ''
      if (details.webContentsId && this.getTabByWebContentsId) {
        const tab = this.getTabByWebContentsId(details.webContentsId)
        if (tab) {
          tabId = tab.id
          host = this.normalizeHost(tab.url)
        }
      }
      if (!host && details.initiator) {
        host = this.normalizeHost(details.initiator)
      }
      if (!host && details.url) {
        host = this.normalizeHost(details.url)
      }

      // Если сайт в белом списке — не блокируем
      if (host && this.isSiteDisabled(host)) {
        callback({})
        return
      }

      originalOnBeforeRequest(details, response => {
        if (response.cancel || response.redirectURL) {
          if (tabId) {
            const prev = this.tabStats.get(tabId) || 0
            const next = prev + 1
            this.tabStats.set(tabId, next)
            if (this.onBlocked) {
              this.onBlocked({ tabId, count: next, url: details.url })
            }
          }
        }
        callback(response)
      })
    }

    const originalOnInjectCosmeticFilters = this.blocker.onInjectCosmeticFilters.bind(this.blocker)
    this.blocker.onInjectCosmeticFilters = (event, url, msg) => {
      if (!this.settings.enabled) return { styles: '', scripts: [] }
      const host = this.normalizeHost(url)
      if (host && this.isSiteDisabled(host)) {
        return { styles: '', scripts: [] }
      }
      return originalOnInjectCosmeticFilters(event, url, msg)
    }
  }
}

module.exports = { AdblockManager }
