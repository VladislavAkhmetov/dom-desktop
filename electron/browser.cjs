const { WebContentsView, dialog, session } = require('electron')
const path = require('node:path')

function validURL(value) { try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false } }

class BrowserManager {
  constructor(window) {
    this.window = window
    this.tabs = new Map()
    this.blocked = false
    const profile = session.fromPartition('persist:dom-browser')
    profile.setPermissionRequestHandler(async (contents, permission, callback, details) => {
      if (!['media', 'geolocation', 'notifications', 'clipboard-read'].includes(permission)) return callback(false)
      let hostname
      try { hostname = new URL(contents.getURL()).hostname } catch { return callback(false) }
      const result = await dialog.showMessageBox(this.window, { type: 'question', title: 'Разрешение сайта', message: `${hostname} запрашивает доступ: ${permission}`, detail: details.mediaTypes?.join(', ') || '', buttons: ['Не разрешать', 'Разрешить'], defaultId: 0, cancelId: 0 })
      callback(result.response === 1)
    })
    profile.on('will-download', (_event, item) => item.setSaveDialogOptions({ title: 'Сохранить загрузку', defaultPath: item.getFilename() }))
  }
  send(message) { if (!this.window.isDestroyed()) this.window.webContents.send('browser:event', message) }
  metadata(record, updates) { this.send({ type: 'update', tabId: record.id, spaceId: record.spaceId, updates }) }
  async show({ tab, spaceId, bounds }) {
    if (!tab || typeof tab.id !== 'string' || typeof spaceId !== 'string' || !validURL(tab.url)) return
    let record = this.tabs.get(tab.id)
    if (!record) {
      const view = new WebContentsView({ webPreferences: { partition: 'persist:dom-browser', preload: path.join(__dirname, 'page-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } })
      record = { id: tab.id, spaceId, view, url: tab.url, desired: true, protected: false, bounds }
      this.tabs.set(tab.id, record)
      this.window.contentView.addChildView(view)
      view.setVisible(false)
      const contents = view.webContents
      contents.setUserAgent(contents.getUserAgent().replace(/Electron\/\S+\s?/g, ''))
      const navigate = (_event, url) => { record.url = url; this.metadata(record, { url, lastAccessedAt: new Date().toISOString(), error: undefined }) }
      contents.on('did-navigate', navigate)
      contents.on('did-navigate-in-page', navigate)
      contents.on('did-start-loading', () => this.metadata(record, { error: undefined }))
      contents.on('page-title-updated', (_event, title) => this.metadata(record, { title }))
      contents.on('page-favicon-updated', (_event, icons) => { if (icons[0]) this.metadata(record, { favicon: icons[0] }) })
      contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => { if (isMainFrame && code !== -3) this.metadata(record, { error: description }) })
      contents.on('render-process-gone', () => this.metadata(record, { error: 'Страница остановлена. Обновите её, чтобы продолжить.' }))
      contents.setWindowOpenHandler(({ url, disposition }) => {
        if (validURL(url)) this.send({ type: 'new-tab', spaceId: record.spaceId, parentTabId: record.id, url, background: disposition === 'background-tab' })
        return { action: 'deny' }
      })
      contents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown' || !(input.control || input.meta)) return
        const key = input.key.toLowerCase()
        if (['l', 'k', 't', 'w', 'tab'].includes(key) || (input.alt && input.code === 'Space')) {
          event.preventDefault(); this.window.webContents.focus(); this.send({ type: 'shortcut', key, shift: input.shift, alt: input.alt })
        }
      })
      contents.loadURL(tab.url).catch(() => undefined)
      if (tab.scrollY) contents.once('did-finish-load', () => contents.executeJavaScript(`window.scrollTo(0, ${Number(tab.scrollY) || 0})`).catch(() => undefined))
    } else if (record.url !== tab.url) {
      record.url = tab.url
      record.view.webContents.loadURL(tab.url).catch(() => undefined)
    }
    record.desired = true
    record.bounds = { x: Math.max(0, Math.round(bounds.x)), y: Math.max(0, Math.round(bounds.y)), width: Math.max(1, Math.round(bounds.width)), height: Math.max(1, Math.round(bounds.height)) }
    record.view.setBounds(record.bounds)
    record.view.setVisible(!this.blocked)
  }
  hide(id) { const record = this.tabs.get(id); if (record) { record.desired = false; record.view.setVisible(false) } }
  async block(value) {
    if (this.blocked === Boolean(value)) return
    this.blocked = Boolean(value)
    for (const record of this.tabs.values()) {
      if (this.blocked && record.desired) {
        // The trusted UI gets a frozen page while the native page is blocked.
        record.view.webContents.capturePage().then(frame => this.send({ type: 'cover', tabId: record.id, image: frame.toDataURL() })).catch(() => undefined)
      }
      record.view.setVisible(record.desired && !this.blocked)
    }
    if (this.blocked) this.window.webContents.focus()
  }
  async close(id, confirm = true) {
    const record = this.tabs.get(id)
    if (!record) return true
    if (record.protected) {
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
    this.window.contentView.removeChildView(record.view)
    this.tabs.delete(id)
    return true
  }
  async park(ids) { let protectedCount = 0; for (const id of ids) { this.hide(id); if (!await this.close(id, false)) protectedCount++ } return { protectedCount } }
  pageSignal(sender, signal) {
    const record = [...this.tabs.values()].find(item => item.view.webContents.id === sender.id)
    if (!record) return
    record.protected = Boolean(signal.dirty || signal.playing)
    this.metadata(record, { protected: record.protected, scrollY: Math.max(0, Number(signal.scrollY) || 0) })
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
  dispose() { for (const record of this.tabs.values()) { this.window.contentView.removeChildView(record.view); record.view.webContents.close() } this.tabs.clear() }
}
module.exports = { BrowserManager, validURL }
