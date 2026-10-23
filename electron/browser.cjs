const { WebContentsView, dialog, session, app } = require('electron')
const path = require('node:path')
const { AdblockManager } = require('./adblock.cjs')
const { parseReaderContent, applyDarkMode } = require('./reader.cjs')
const { translateText } = require('./translate.cjs')

function validURL(value) { try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false } }

class BrowserManager {
  constructor(window, partitionName = 'persist:dom-browser') {
    this.window = window
    this.tabs = new Map()
    this.blocked = false
    this.partition = partitionName
    this.permissions = new Map()
    this.pendingPermissions = new Map()
    const profile = session.fromPartition(partitionName)

    const chromeVersion = process.versions.chrome || '132.0.0.0'
    const majorChrome = chromeVersion.split('.')[0]
    const secChUa = `"Not A(Brand";v="99", "Google Chrome";v="${majorChrome}", "Chromium";v="${majorChrome}"`
    const secChUaFullVersionList = `"Not A(Brand";v="99.0.0.0", "Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}"`

    if (profile.webRequest && typeof profile.webRequest.onBeforeSendHeaders === 'function') {
      profile.webRequest.onBeforeSendHeaders((details, callback) => {
        const headers = details.requestHeaders || {}
        let hasSecChUa = false
        let hasSecChUaFull = false

        for (const key of Object.keys(headers)) {
          const lower = key.toLowerCase()
          if (lower === 'sec-ch-ua') {
            headers[key] = secChUa
            hasSecChUa = true
          } else if (lower === 'sec-ch-ua-full-version-list') {
            headers[key] = secChUaFullVersionList
            hasSecChUaFull = true
          } else if (lower === 'user-agent' && typeof headers[key] === 'string') {
            headers[key] = headers[key].replace(/Electron\/\S+\s?/g, '')
          }
        }

        if (!hasSecChUa && details.url && /^https?:\/\//i.test(details.url)) {
          headers['Sec-CH-UA'] = secChUa
        }
        if (!hasSecChUaFull && details.url && /^https?:\/\//i.test(details.url)) {
          headers['Sec-CH-UA-Full-Version-List'] = secChUaFullVersionList
        }

        callback({ requestHeaders: headers })
      })
    }

    this.adblock = new AdblockManager({
      userDataPath: app.getPath('userData'),
      getTabByWebContentsId: (contentsId) => {
        return [...this.tabs.values()].find(item => item.view.webContents.id === contentsId)
      },
      onBlocked: ({ tabId, count }) => {
        this.send({ type: 'adblock-stats', tabId, count })
      }
    })
    this.adblock.initialize(profile).catch(err => {
      console.warn('[BrowserManager] Ошибка инициализации Adblock:', err.message)
    })
    profile.setPermissionRequestHandler(async (contents, permission, callback, details) => {
      if (!['media', 'geolocation', 'notifications', 'clipboard-read'].includes(permission)) return callback(false)
      let hostname
      try { hostname = new URL(contents.getURL()).hostname } catch { return callback(false) }
      const key = `${hostname}:${permission}`
      if (this.permissions.has(key)) return callback(this.permissions.get(key))

      const tabRecord = [...this.tabs.values()].find(item => item.view.webContents.id === contents.id)
      const requestId = 'perm_' + Math.random().toString(36).slice(2, 10)
      this.pendingPermissions.set(requestId, { callback, key, hostname, permission, tabId: tabRecord?.id })

      this.send({
        type: 'permission-request',
        id: requestId,
        tabId: tabRecord?.id,
        hostname,
        origin: new URL(contents.getURL()).origin,
        permission,
        details: details.mediaTypes?.join(', ') || ''
      })
    })
    profile.setPermissionCheckHandler((contents, permission) => {
      let hostname
      try { hostname = new URL(contents.getURL()).hostname } catch { return false }
      const key = `${hostname}:${permission}`
      if (this.permissions.has(key)) return this.permissions.get(key)
      return false
    })
    profile.on('will-download', (_event, item) => item.setSaveDialogOptions({ title: 'Сохранить загрузку', defaultPath: item.getFilename() }))
  }
  send(message) { if (!this.window.isDestroyed()) this.window.webContents.send('browser:event', message) }
  metadata(record, updates) { this.send({ type: 'update', tabId: record.id, spaceId: record.spaceId, updates }) }
  async show({ tab, spaceId, bounds }) {
    if (!tab || typeof tab.id !== 'string' || typeof spaceId !== 'string' || !validURL(tab.url)) return
    let record = this.tabs.get(tab.id)
    if (!record) {
      const view = new WebContentsView({ webPreferences: { partition: this.partition, preload: path.join(__dirname, 'page-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } })
      record = { id: tab.id, spaceId, view, url: tab.url, desired: true, protected: false, bounds }
      this.tabs.set(tab.id, record)
      this.window.contentView.addChildView(view)
      view.setVisible(false)
      const contents = view.webContents
      contents.setUserAgent(contents.getUserAgent().replace(/Electron\/\S+\s?/g, ''))
      const navigate = (_event, url) => { record.url = url; this.metadata(record, { url, lastAccessedAt: new Date().toISOString(), error: undefined }) }
      contents.on('will-navigate', (event, url) => { if (!validURL(url)) event.preventDefault() })
      contents.on('will-redirect', (event, url) => { if (!validURL(url)) event.preventDefault() })
      contents.on('did-navigate', navigate)
      contents.on('did-navigate-in-page', navigate)
      contents.on('did-start-loading', () => {
        this.adblock.resetTabStats(record.id)
        this.metadata(record, { error: undefined })
      })
      contents.on('did-finish-load', () => {
        let host = ''
        try { host = new URL(contents.getURL()).hostname } catch {}
        if (host && this.adblock.isDarkSite(host)) {
          applyDarkMode(contents, true).catch(() => undefined)
        }
      })
      contents.on('page-title-updated', (_event, title) => this.metadata(record, { title }))
      contents.on('page-favicon-updated', (_event, icons) => { if (icons[0]) this.metadata(record, { favicon: icons[0] }) })
      const updateAudible = () => {
        if (contents.isDestroyed()) return
        const audible = typeof contents.isCurrentlyAudible === 'function' && contents.isCurrentlyAudible()
        if (record.audible !== audible) {
          record.audible = audible
          record.protected = Boolean(record.dirty || record.playing || record.audible)
          this.metadata(record, { protected: record.protected })
        }
      }
      contents.on('media-started-playing', () => { record.playing = true; record.protected = true; this.metadata(record, { protected: true }) })
      contents.on('media-paused', () => { record.playing = false; updateAudible() })
      contents.on('audio-state-changed', updateAudible)
      contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => { if (isMainFrame && code !== -3) this.metadata(record, { error: description }) })
      contents.on('certificate-error', (event, _url, error, _cert, callback) => {
        event.preventDefault()
        callback(false)
        this.metadata(record, { error: `Ошибка безопасности SSL: ${error}` })
      })
      contents.on('render-process-gone', () => this.metadata(record, { error: 'Страница остановлена. Обновите её, чтобы продолжить.' }))
      contents.setWindowOpenHandler(({ url, disposition }) => {
        if (validURL(url)) this.send({ type: 'new-tab', spaceId: record.spaceId, parentTabId: record.id, url, background: disposition === 'background-tab' })
        return { action: 'deny' }
      })
      contents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F11') {
          event.preventDefault()
          this.window.setFullScreen(!this.window.isFullScreen())
          return
        }
        if (input.type !== 'keyDown' || !(input.control || input.meta)) return
        const key = input.key.toLowerCase()
        if (['d', 'l', 'k', 't', 'w', 'tab', 'h'].includes(key) || (key === 'a' && input.shift) || (input.alt && input.code === 'Space')) {
          event.preventDefault(); this.window.webContents.focus(); this.send({ type: 'shortcut', key, shift: input.shift, alt: input.alt })
        }
      })
      contents.loadURL(tab.url).catch(() => undefined)
      if (tab.scrollY) contents.once('did-finish-load', () => contents.executeJavaScript(`window.scrollTo(0, ${Number(tab.scrollY) || 0})`).catch(() => undefined))
    } else if (record.url !== tab.url) {
      record.url = tab.url
      record.view.webContents.loadURL(tab.url).catch(() => undefined)
    }
    record.spaceId = spaceId
    record.desired = true
    record.bounds = { x: Math.max(0, Math.round(bounds.x)), y: Math.max(0, Math.round(bounds.y)), width: Math.max(1, Math.round(bounds.width)), height: Math.max(1, Math.round(bounds.height)) }
    record.view.setBounds(record.bounds)
    record.view.setVisible(!this.blocked)
  }
  move(id, spaceId) { const record = this.tabs.get(id); if (record && typeof spaceId === 'string') record.spaceId = spaceId }
  hide(id) {
    const record = this.tabs.get(id)
    if (!record) return
    if (record.desired && !record.view.webContents.isDestroyed()) record.view.webContents.capturePage().then(frame => {
      if (this.tabs.get(id) === record && !frame.isEmpty()) this.send({ type: 'cover', tabId: id, image: frame.resize({ width: Math.min(1000, frame.getSize().width) }).toDataURL() })
    }).catch(() => undefined)
    record.desired = false
    record.view.setVisible(false)
  }
  async block(value) {
    if (this.blocked === Boolean(value)) return
    this.blocked = Boolean(value)
    for (const record of this.tabs.values()) {
      if (this.blocked && record.desired) {
        // The trusted UI gets a frozen page while the native page is blocked.
        record.view.webContents.capturePage().then(frame => {
          if (this.tabs.get(record.id) === record && !frame.isEmpty()) this.send({ type: 'cover', tabId: record.id, image: frame.resize({ width: Math.min(1000, frame.getSize().width) }).toDataURL() })
        }).catch(() => undefined)
      }
      record.view.setVisible(record.desired && !this.blocked)
    }
    if (this.blocked) this.window.webContents.focus()
  }
  async close(id, confirm = true) {
    const record = this.tabs.get(id)
    if (!record) return true
    const isAudible = !record.view.webContents.isDestroyed() && typeof record.view.webContents.isCurrentlyAudible === 'function' && record.view.webContents.isCurrentlyAudible()
    if (record.protected || isAudible) {
      if (!confirm) return false
      const result = await dialog.showMessageBox(this.window, { type: 'question', title: 'Незавершённая работа', message: 'На этой странице есть введённые данные или воспроизведение.', detail: 'Сохранение ссылки не сохраняет заполненную форму.', buttons: ['Оставить открытой', 'Закрыть страницу'], defaultId: 0, cancelId: 0 })
      if (result.response !== 1) return false
    }
    const contents = record.view.webContents
    const closed = await new Promise(resolve => {
      let timer
      const finish = result => { clearTimeout(timer); contents.removeListener('destroyed', destroyed); contents.removeListener('will-prevent-unload', prevent); resolve(result) }
      const destroyed = () => finish(true)
      const prevent = event => {
        if (!confirm) { finish(false); return }
        const choice = record.protected ? 1 : dialog.showMessageBoxSync(this.window, { type: 'question', title: 'Страница просит остаться', message: 'На странице может быть незавершённая работа.', buttons: ['Оставить открытой', 'Закрыть'], defaultId: 0, cancelId: 0 })
        if (choice === 1) event.preventDefault()
        else finish(false)
      }
      contents.once('destroyed', destroyed); contents.on('will-prevent-unload', prevent)
      timer = setTimeout(() => finish(false), 10000)
      contents.close({ waitForBeforeUnload: true })
    })
    if (!closed) return false
    for (const [permId, pending] of this.pendingPermissions.entries()) {
      if (pending.tabId === id) {
        pending.callback(false)
        this.pendingPermissions.delete(permId)
      }
    }
    this.window.contentView.removeChildView(record.view)
    this.tabs.delete(id)
    return true
  }
  respondPermission(id, allowed) {
    const pending = this.pendingPermissions.get(id)
    if (!pending) return
    this.pendingPermissions.delete(id)
    if (allowed !== null && allowed !== undefined) {
      this.permissions.set(pending.key, Boolean(allowed))
    }
    pending.callback(Boolean(allowed))
  }
  async park(ids) {
    let protectedCount = 0
    const pidMemoryMap = new Map()
    if (typeof app.getAppMetrics === 'function') {
      try {
        const metrics = app.getAppMetrics()
        for (const m of metrics) {
          if (m.pid && m.memory) {
            pidMemoryMap.set(m.pid, m.memory.workingSetSize || 0)
          }
        }
      } catch { /* ignore */ }
    }

    const tabPidMap = new Map()
    for (const id of ids) {
      const record = this.tabs.get(id)
      if (record && !record.view.webContents.isDestroyed()) {
        try {
          const pid = record.view.webContents.getOSProcessId()
          if (pid) tabPidMap.set(id, pid)
        } catch { /* ignore */ }
      }
    }

    const actuallyClosedPids = new Set()
    for (const id of ids) {
      this.hide(id)
      const pid = tabPidMap.get(id)
      const closed = await this.close(id, false)
      if (!closed) {
        protectedCount++
      } else if (pid) {
        actuallyClosedPids.add(pid)
      }
    }

    let totalWorkingSetKB = 0
    for (const pid of actuallyClosedPids) {
      totalWorkingSetKB += (pidMemoryMap.get(pid) || 0)
    }
    const freedMB = Math.round((totalWorkingSetKB / 1024) * 10) / 10
    return { protectedCount, freedMB }
  }
  pageSignal(sender, signal) {
    const record = [...this.tabs.values()].find(item => item.view.webContents.id === sender.id)
    if (!record) return
    record.dirty = Boolean(signal.dirty)
    const isAudible = !record.view.webContents.isDestroyed() && typeof record.view.webContents.isCurrentlyAudible === 'function' && record.view.webContents.isCurrentlyAudible()
    record.playing = Boolean(signal.playing || isAudible || record.audible)
    record.protected = Boolean(record.dirty || record.playing)
    if (signal.readerable !== undefined) record.readerable = Boolean(signal.readerable)
    if (signal.lang !== undefined) record.lang = String(signal.lang)
    this.metadata(record, {
      protected: record.protected,
      scrollY: Math.max(0, Number(signal.scrollY) || 0),
      readerable: record.readerable,
      lang: record.lang
    })
  }
  pagePasswordSubmit(sender, data) {
    if (!data || typeof data !== 'object') return
    const record = [...this.tabs.values()].find(item => item.view.webContents.id === sender.id)
    if (!record || record.view.webContents.isDestroyed()) return

    let currentUrl = ''
    try {
      currentUrl = record.view.webContents.getURL()
    } catch {}
    if (!currentUrl) return

    let pageOrigin = ''
    let hostname = ''
    try {
      const parsed = new URL(currentUrl)
      pageOrigin = parsed.origin
      hostname = parsed.hostname
    } catch {}
    if (!pageOrigin || data.origin !== pageOrigin) return

    const username = typeof data.username === 'string' ? data.username.trim() : ''
    const password = typeof data.password === 'string' ? data.password : ''
    if (!password) return

    this.send({
      type: 'password-save-offer',
      tabId: record.id,
      origin: pageOrigin,
      hostname: hostname || pageOrigin,
      username,
      password
    })
  }
  async autofill(tabId, cred) {
    const record = this.tabs.get(tabId)
    if (!record || record.view.webContents.isDestroyed()) return false
    if (!cred || typeof cred !== 'object') return false

    let currentUrl = ''
    try {
      currentUrl = record.view.webContents.getURL()
    } catch {}
    if (!currentUrl) return false

    if (cred.origin) {
      try {
        const pageOrigin = new URL(currentUrl).origin
        if (cred.origin.toLowerCase() !== pageOrigin.toLowerCase()) return false
      } catch {
        return false
      }
    }

    record.view.webContents.send('page:autofill', {
      username: cred.username || '',
      password: cred.password || ''
    })
    return true
  }
  async applyDarkMode(tabId, enabled) {
    const record = this.tabs.get(tabId)
    if (!record || record.view.webContents.isDestroyed()) return
    await applyDarkMode(record.view.webContents, enabled)
  }
  async getReaderContent(tabId) {
    const record = this.tabs.get(tabId)
    if (!record || record.view.webContents.isDestroyed()) return null
    const contents = record.view.webContents
    const html = await contents.executeJavaScript('document.documentElement.outerHTML').catch(() => '')
    return parseReaderContent(html, record.url)
  }
  async translateTab(tabId) {
    const record = this.tabs.get(tabId)
    if (!record || record.view.webContents.isDestroyed()) return { ok: false }
    const contents = record.view.webContents
    try {
      const texts = await contents.executeJavaScript(`
        (() => {
          const elements = [...document.querySelectorAll('h1, h2, h3, p, article span, .article-body p')].slice(0, 30);
          return elements.map(el => el.innerText.trim()).filter(t => t.length > 5 && !/^[0-9\\W]+$/.test(t));
        })()
      `)
      if (Array.isArray(texts) && texts.length > 0) {
        const translations = []
        for (const t of texts) {
          const translated = await translateText(t, 'ru')
          translations.push({ original: t, translated })
        }
        await contents.executeJavaScript(`
          (() => {
            const map = ${JSON.stringify(translations)};
            const elements = [...document.querySelectorAll('h1, h2, h3, p, article span, .article-body p')];
            for (const item of map) {
              for (const el of elements) {
                if (el.innerText && el.innerText.trim() === item.original) {
                  el.innerText = item.translated;
                }
              }
            }
          })()
        `)
        return { ok: true, count: translations.length }
      }
      return { ok: true, count: 0 }
    } catch (err) {
      console.warn('[Translate] Ошибка перевода:', err)
      return { ok: false, error: err.message }
    }
  }
  action(id, action) {
    const contents = this.tabs.get(id)?.view.webContents
    if (!contents) return
    if (action === 'back' && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
    if (action === 'forward' && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
    if (action === 'reload') contents.reload()
    if (action === 'stop') contents.stop()
    if (action === 'zoomIn') contents.setZoomLevel(contents.getZoomLevel() + 0.5)
    if (action === 'zoomOut') contents.setZoomLevel(contents.getZoomLevel() - 0.5)
    if (action === 'zoomReset') contents.setZoomLevel(0)
  }
  async text(id) {
    const contents = this.tabs.get(id)?.view.webContents
    if (!contents) throw new Error('Откройте страницу перед добавлением в контекст')
    return { url: contents.getURL(), title: contents.getTitle(), text: await contents.executeJavaScript("window.getSelection()?.toString() || document.querySelector('article, main')?.innerText || document.body.innerText").then(text => String(text).slice(0, 50000)) }
  }
  dispose() {
    for (const pending of this.pendingPermissions.values()) {
      pending.callback(false)
    }
    this.pendingPermissions.clear()
    for (const record of this.tabs.values()) { this.window.contentView.removeChildView(record.view); record.view.webContents.close() }
    this.tabs.clear()
  }
}
module.exports = { BrowserManager, validURL }
