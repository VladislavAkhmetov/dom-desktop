import type { AppState, DomBridge } from './types'
import { applyChanges, diffState, emptyState, migrateState } from '../shared/state'
import { searchState } from './search'

const STORAGE_KEY = 'dom-browser-preview-v1'

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
const database = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('dom-preview', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('state')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})
async function transaction(update?: (value: AppState) => AppState): Promise<AppState> {
  const db = await database
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', update ? 'readwrite' : 'readonly')
    const store = tx.objectStore('state')
    const request = store.get('app')
    let result: AppState
    request.onsuccess = () => {
      try {
        const legacy = localStorage.getItem(STORAGE_KEY)
        const value = request.result || (legacy ? migrateState(JSON.parse(legacy)) : firstState())
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
    return transaction(value => migrateState(value))
  },
  async saveState(state) { const previous = await transaction(); await transaction(value => applyChanges(value, diffState(previous, state))); return true },
  async applyChanges(changes) { return transaction(value => applyChanges(value, changes)) },
  async search(query) { return searchState(await transaction(), query) },
  async backup() { const value = await transaction(); localStorage.setItem(`${STORAGE_KEY}-backup`, JSON.stringify(value)); return true },
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
      ? `«${resource.name}» можно запустить из версии Дома для Windows.`
      : `«${resource.name}» — файл на компьютере. Его открытие доступно в версии Дома для Windows.` }
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


