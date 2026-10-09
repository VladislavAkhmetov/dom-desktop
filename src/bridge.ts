import type { AppState, DomBridge } from './types'
import { applyChanges, diffState, emptyState, migrateState } from '../shared/state'
import { searchState } from './search'
import { isCabinetPreview } from './cabinetMode'
import { upgradeCabinets } from './cabinetModel'

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
const browserBridge: DomBridge = {
  async getState() {
    return transaction(value => isCabinetPreview ? upgradeCabinets(migrateState(value)) : migrateState(value))
  },
  async saveState(state) { const previous = await transaction(); await transaction(value => applyChanges(value, diffState(previous, state))); return true },
  async applyChanges(changes) { return transaction(value => applyChanges(value, changes)) },
  async search(query) { return searchState(await transaction(), query) },
  async backup() { const value = await transaction(); localStorage.setItem(`${STORAGE_KEY}-backup`, JSON.stringify(value)); return true },
  vault: {
    async listCredentials(origin?: string) {
      try {
        const raw = localStorage.getItem('dom-vault-credentials')
        const list: import('./types').SavedCredential[] = raw ? JSON.parse(raw) : []
        if (!origin) return list
        const norm = origin.trim().toLowerCase()
        return list.filter(item => item.origin.toLowerCase().includes(norm) || (item.title && item.title.toLowerCase().includes(norm)))
      } catch { return [] }
    },
    async saveCredential(cred: { id?: string; origin: string; username: string; password: string; title?: string }) {
      const raw = localStorage.getItem('dom-vault-credentials')
      const list: import('./types').SavedCredential[] = raw ? JSON.parse(raw) : []
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
      localStorage.setItem('dom-vault-credentials', JSON.stringify(list))
      return entry
    },
    async removeCredential(id: string) {
      const raw = localStorage.getItem('dom-vault-credentials')
      const list: import('./types').SavedCredential[] = raw ? JSON.parse(raw) : []
      localStorage.setItem('dom-vault-credentials', JSON.stringify(list.filter(item => item.id !== id)))
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
    }
  },
  async pickResource() { return null },
  async openResource(resource) {
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
  async getAutostart() { return false },
  async setAutostart() { return false },
  async fetchCalendar(url: string) {
    let target = url.trim()
    if (target.startsWith('webcal://')) target = 'https://' + target.slice(9)
    const res = await fetch(target)
    if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`)
    return await res.text()
  },
  onFocusCapture() { return () => undefined },
  onStateChanged() { return () => undefined }
}

export const bridge: DomBridge = window.dom ?? browserBridge
export const isDesktop = Boolean(window.dom)


