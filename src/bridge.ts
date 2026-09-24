import type { AppState, DomBridge } from './types'

const STORAGE_KEY = 'dom-browser-preview-v1'

function openExternalPreview(target: string) {
  const opened = window.open('about:blank', '_blank')
  if (!opened) return false
  opened.opener = null
  opened.location.replace(target)
  return true
}

function firstState(): AppState {
  return { version: 1, spaces: [{ id: 'first-space', name: 'Моё пространство', tone: 'sage', resources: [] }], reminders: [], dismissedUntil: null }
}
const browserBridge: DomBridge = {
  async getState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const state = saved ? JSON.parse(saved) as AppState : firstState()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      return state
    } catch { return firstState() }
  },
  async saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true },
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


