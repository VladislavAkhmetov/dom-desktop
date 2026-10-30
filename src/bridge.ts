import type { AppState, DomBridge } from './types'
import { applyChanges, diffState, emptyState, migrateState } from '../shared/state'
import { searchState } from './search'
import { isCabinetPreview } from './cabinetMode'
import { upgradeCabinets } from './cabinetModel'
import { withPreviewDemoData, withPreviewFixture } from './previewFixture'

const STORAGE_KEY = isCabinetPreview ? 'dom-cabinet-preview-v1' : 'dom-browser-preview-v1'

let pilotSeedPromise: Promise<AppState | undefined> | null = null
function getPilotSeed(): Promise<AppState | undefined> {
  if (!pilotSeedPromise) {
    pilotSeedPromise = (!window.dom && isCabinetPreview) ? new Promise<AppState | undefined>((resolve, reject) => {
      const request = indexedDB.open('dom-preview', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('state')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('state', 'readonly')
        const read = tx.objectStore('state').get('app')
        tx.oncomplete = () => {
          db.close()
          try {
            const legacy = localStorage.getItem('dom-browser-preview-v1')
            resolve(read.result || (legacy ? JSON.parse(legacy) as AppState : undefined))
          } catch (error) { reject(error) }
        }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
    }) : Promise.resolve(undefined)
  }
  return pilotSeedPromise
}

function openExternalPreview(target: string) {
  const opened = window.open('about:blank', '_blank')
  if (!opened) return false
  opened.opener = null
  opened.location.replace(target)
  return true
}

function firstState(): AppState {
  return emptyState()
}
let databasePromise: Promise<IDBDatabase> | null = null
function getDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(isCabinetPreview ? 'dom-cabinet-preview' : 'dom-preview', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('state')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return databasePromise
}
async function transaction(update?: (value: AppState) => AppState): Promise<AppState> {
  const db = await getDatabase()
  const seed = await getPilotSeed()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', update ? 'readwrite' : 'readonly')
    const store = tx.objectStore('state')
    const request = store.get('app')
    let result: AppState
    request.onsuccess = () => {
      try {
        const legacy = localStorage.getItem(STORAGE_KEY)
        const value = request.result || seed || (legacy ? migrateState(JSON.parse(legacy)) : firstState())
        result = update ? update(value) : value
        if (update) store.put(result, 'app')
      } catch (error) { tx.abort(); reject(error) }
    }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Запись отменена'))
  })
}
const PREVIEW_CREDENTIALS = 'dom-vault-credentials'
function readPreviewCredentials(): import('./types').SavedCredential[] {
  try { return JSON.parse(localStorage.getItem(PREVIEW_CREDENTIALS) || '[]') } catch { return [] }
}
// Same rule as electron/vault.cjs → siteHost: exact host, www. ignored.
function siteHost(value: string) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(text) ? text : `https://${text}`).hostname.replace(/^www\./, '') } catch { return '' }
}

const browserBridge: DomBridge = {
  async getState() {
    return transaction(value => withPreviewDemoData(withPreviewFixture(isCabinetPreview ? upgradeCabinets(migrateState(value)) : migrateState(value))))
  },
  async saveState(state) { const previous = await transaction(); await transaction(value => applyChanges(value, diffState(previous, state))); return true },
  async applyChanges(changes) { return transaction(value => applyChanges(value, changes)) },
  async search(query) { return searchState(await transaction(), query) },
  async backup() { const value = await transaction(); localStorage.setItem(`${STORAGE_KEY}-backup`, JSON.stringify(value)); return true },
  vault: {
    // Browser preview only (localStorage, not encrypted). Mirrors the desktop contract: lists never carry passwords.
    async listCredentials(site?: string) {
      const host = site ? siteHost(site) : ''
      if (site && !host) return []
      return readPreviewCredentials().filter(item => !host || siteHost(item.origin) === host).map(({ password: _password, ...rest }) => rest)
    },
    async revealPassword(id: string) {
      const item = readPreviewCredentials().find(entry => entry.id === id)
      if (!item) throw new Error('Пароль не найден')
      return item.password
    },
    async saveCredential(cred: { id?: string; origin: string; username: string; password: string; title?: string }) {
      const list = readPreviewCredentials()
      const id = cred.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cred-${Date.now()}`)
      const entry: import('./types').SavedCredential = {
        id,
        origin: cred.origin.trim(),
        username: cred.username.trim(),
        password: cred.password,
        title: (cred.title || cred.origin).trim(),
        updatedAt: new Date().toISOString()
      }
      const existing = list.findIndex(item => item.id === id || (item.origin.toLowerCase() === entry.origin.toLowerCase() && item.username.toLowerCase() === entry.username.toLowerCase()))
      if (existing >= 0) list[existing] = { ...list[existing], ...entry, id: list[existing].id }
      else list.push(entry)
      localStorage.setItem(PREVIEW_CREDENTIALS, JSON.stringify(list))
      const { password: _password, ...summary } = entry
      return summary
    },
    async saveOffer() { throw new Error('Сохранение паролей со страниц доступно в настольной версии.') },
    async removeCredential(id: string) {
      localStorage.setItem(PREVIEW_CREDENTIALS, JSON.stringify(readPreviewCredentials().filter(item => item.id !== id)))
      return true
    },
    async importCredentials(csv: string) {
      const lines = csv.split(/\r?\n/).filter(line => line.trim())
      if (!lines.length) return 0
      let count = 0
      const first = lines[0].toLowerCase()
      const startIndex = (first.includes('url') || first.includes('username') || first.includes('password')) ? 1 : 0
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
        if (parts.length >= 3) {
          const [origin, username, password] = parts.length >= 4 ? [parts[1], parts[2], parts[3]] : parts
          if (origin && username && password) {
            await browserBridge.vault!.saveCredential({ origin, username, password })
            count++
          }
        }
      }
      return count
    },
    async exportCredentials() {
      const list = readPreviewCredentials()
      if (!list.length) return false
      const escape = (value: string) => `"${(value || '').replace(/"/g, '""')}"`
      const csv = 'name,url,username,password\n' + list.map(item => [item.title || item.origin, item.origin, item.username, item.password].map(escape).join(',')).join('\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `dombro-passwords-bitwarden-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      return true
    }
  },
  browser: {
    async show() {},
    async hide() {},
    async move() {},
    async block() {},
    async close() { return true },
    async park() { return { protectedCount: 0, freedMB: 0 } },
    async action() {},
    async text() { return { url: '', title: '', text: '' } },
    async respondPermission() { return true },
    onEvent() { return () => undefined },
    async getAdblockStatus() {
      return { enabled: true, siteDisabled: false, blockedCount: 0, blockCookies: true, isDark: false }
    },
    async toggleAdblockSite() {
      return { enabled: true, siteDisabled: false, blockedCount: 0, blockCookies: true, isDark: false }
    },
    async toggleAdblockCookies() {
      return { enabled: true, siteDisabled: false, blockedCount: 0, blockCookies: true, isDark: false }
    },
    async toggleAdblockGlobal() {
      return { enabled: true, siteDisabled: false, blockedCount: 0, blockCookies: true, isDark: false }
    },
    async toggleDarkSite() {
      return { enabled: true, siteDisabled: false, blockedCount: 0, blockCookies: true, isDark: false }
    },
    async getReaderContent() { return null },
    async translateText(text, targetLang = 'ru') {
      if (!text || typeof text !== 'string') return ''
      const trimmed = text.trim()
      if (!trimmed) return ''
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed.slice(0, 450))}&langpair=autodetect|${targetLang}`
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
        const json = await res.json()
        if (json.responseData?.translatedText) {
          return json.responseData.translatedText
            .replace(/&quot;/g, '"')
            .replace(/&#39;|&apos;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
        }
      } catch { /* Fallback to trimmed */ }
      return trimmed
    },
    async translateTab() { return { ok: true, count: 0 } },
    async autofill() { return true }
  },
  async bitwardenStatus() {
    return { loaded: false, version: '2026.10.0', worker: false, error: 'Расширение Bitwarden во вкладки не загружается. Строки «Сохранить пароль?» не будет.' }
  },
  integrations: {
    async configureGoogle() {},
    async googleConfigured() { return false },
    async connectMail() {},
    async syncMail() {},
    async disconnectMail() {},
    async fetchFeed() { return '' },
    async readMaterial() { return { id: '', title: '', text: '' } },
    async addCalendar() {},
    async fetchCalendarSource() { return '' },
    async removeCalendar() {},
    async configureAI() {},
    async runAI() {},
    async cancelAI() {},
    async transcribeAudio() { return { text: '' } },
    onAI() { return () => undefined }
  },
  async pickResource() { return null },
  async openResource(resource) {
    if (resource.kind === 'window') {
      return { ok: false, error: 'Управление окнами Windows доступно в настольной версии dombro.' }
    }
    if (resource.target === 'preview:figma') {
      return openExternalPreview('https://www.figma.com/files/') ? { ok: true } : { ok: false, error: 'Браузер заблокировал новое окно.' }
    }
    if (resource.target === 'preview:illustrator') {
      return { ok: false, error: 'Откройте настольное приложение, чтобы запустить Illustrator.' }
    }
    if (resource.kind === 'link') {
      try {
        const target = new URL(resource.target)
        if (target.protocol !== 'http:' && target.protocol !== 'https:') return { ok: false, error: 'Поддерживаются только адреса HTTP и HTTPS.' }
        return openExternalPreview(target.toString()) ? { ok: true } : { ok: false, error: 'Браузер заблокировал новое окно.' }
      } catch { return { ok: false, error: 'Некорректный адрес сайта.' } }
    }
    return { ok: false, error: resource.kind === 'app'
      ? `«${resource.name}» можно запустить из настольной версии Дома.`
      : `«${resource.name}» — файл на компьютере. Его открытие доступно в настольной версии Дома.` }
  },
  osWindows: {
    async listOpen() { return [] },
    async minimize() { return true },
    async restore() { return true },
    async focus() { return true }
  },
  async getAutostart() { return false },
  async setAutostart() { return false },
  async fetchCalendar(url: string) {
    let target = url.trim()
    if (target.startsWith('webcal://')) target = 'https://' + target.slice(9)
    const res = await fetch(target)
    if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`)
    return await res.text()
  },
  async fetchSuggestions(query: string) {
    // Same rule as electron/main.cjs → browser:suggest: opt-in, never addresses, paths, e-mails or tokens.
    const q = query.trim()
    if (!q || /[\/\\:@]/.test(q) || /^\S+\.\S+$/.test(q) || /^\S{24,}$/.test(q) || (await transaction()).searchSuggestions !== true) return []
    try {
      const res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query.trim())}`)
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data[1]) ? data[1].slice(0, 8) : []
    } catch {
      return []
    }
  },
  async toggleFullScreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined)
      return false
    }
    await document.documentElement.requestFullscreen().catch(() => undefined)
    return Boolean(document.fullscreenElement)
  },
  async isFullScreen() {
    return Boolean(document.fullscreenElement)
  },
  async setTitleBarOverlay() { return true },
  async getRecentFiles() { return [] },
  onToast() { return () => undefined },
  onUpdateReady() { return () => undefined },
  async openReleasePage() { return false },
  async installUpdate() { return false },
  onFocusCapture() { return () => undefined },
  onVoiceToggle() { return () => undefined },
  onStateChanged() { return () => undefined }
}

export const bridge: DomBridge = window.dom ?? browserBridge
export const isDesktop = Boolean(window.dom)


