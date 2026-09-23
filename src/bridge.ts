import type { AppState, DomBridge } from './types'

const STORAGE_KEY = 'dom-browser-preview-v1'

function firstState(): AppState {
  return { version: 1, spaces: [{ id: 'first-space', name: 'Моё пространство', tone: 'sage', resources: [] }], reminders: [], dismissedUntil: null }
}
function withPreviewApps(state: AppState): AppState {
  const next = { ...state }
  const first = next.spaces[0] || { id: 'first-space', name: 'Моё пространство', tone: 'sage' as const, resources: [] }
  const existing = new Set(next.spaces.flatMap(space => space.resources.map(resource => resource.name.toLowerCase())))
  const starters = [
    { id: 'starter-figma', name: 'Figma', kind: 'app' as const, target: 'preview:figma', createdAt: new Date().toISOString() },
    { id: 'starter-illustrator-2025', name: 'Illustrator 2025', kind: 'app' as const, target: 'preview:illustrator', createdAt: new Date().toISOString() }
  ].filter(resource => !existing.has(resource.name.toLowerCase()))

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yAt = (hours: number, minutes = 0) => {
    const value = new Date(yesterday)
    value.setHours(hours, minutes, 0, 0)
    return value.toISOString()
  }

  const sampleDocs = [
    { id: 'starter-figma-checkout', name: 'Редизайн чекаута и оплаты v2', kind: 'link' as const, target: 'https://www.figma.com/design/d1/Checkout-v2', createdAt: yAt(10, 0), lastOpenedAt: yAt(18, 40) },
    { id: 'starter-figma-ds', name: 'UI Kit: компоненты и цвета', kind: 'link' as const, target: 'https://www.figma.com/design/d2/Design-System', createdAt: yAt(10, 0), lastOpenedAt: yAt(16, 15) },
    { id: 'starter-figma-landing', name: 'Промо-лендинг для осени', kind: 'link' as const, target: 'https://www.figma.com/design/d3/Promo-Landing', createdAt: yAt(10, 0), lastOpenedAt: yAt(14, 20) },
    { id: 'starter-figma-icons', name: 'Иконки и иллюстрации интерфейса', kind: 'link' as const, target: 'https://www.figma.com/design/d4/Interface-Icons', createdAt: yAt(10, 0), lastOpenedAt: yAt(11, 5) },
    { id: 'starter-ai-logo', name: 'Логотип_Мастер_2026.ai', kind: 'file' as const, target: 'D:\\Projects\\Brand\\Логотип_Мастер_2026.ai', createdAt: yAt(9, 30), lastOpenedAt: yAt(19, 10) },
    { id: 'starter-ai-patterns', name: 'Векторные_паттерны_v3.ai', kind: 'file' as const, target: 'D:\\Projects\\Brand\\Векторные_паттерны_v3.ai', createdAt: yAt(9, 30), lastOpenedAt: yAt(16, 45) },
    { id: 'starter-ai-packaging', name: 'Упаковка_и_этикетки.ai', kind: 'file' as const, target: 'D:\\Projects\\Store\\Упаковка_и_этикетки.ai', createdAt: yAt(9, 30), lastOpenedAt: yAt(15, 0) },
    { id: 'starter-ai-poster', name: 'Постер_А2_Печать.ai', kind: 'file' as const, target: 'D:\\Design\\Prints\\Постер_А2_Печать.ai', createdAt: yAt(9, 30), lastOpenedAt: yAt(12, 30) }
  ].filter(doc => !existing.has(doc.name.toLowerCase()))

  const allToAdd = [...starters, ...sampleDocs]
  if (!allToAdd.length) return next

  return {
    ...next,
    starterAppsAdded: true,
    spaces: next.spaces.length
      ? next.spaces.map((space, index) => index === 0 ? { ...space, resources: [...space.resources, ...allToAdd] } : space)
      : [{ ...first, resources: allToAdd }]
  }
}

const browserBridge: DomBridge = {
  async getState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const state = withPreviewApps(saved ? JSON.parse(saved) as AppState : firstState())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      return state
    } catch { return withPreviewApps(firstState()) }
  },
  async saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true },
  async pickResource() { return null },
  async openResource(resource) {
    if (resource.target === 'preview:figma') {
      window.open('https://www.figma.com/files/', '_blank', 'noopener,noreferrer')
      return { ok: true }
    }
    if (resource.target === 'preview:illustrator') {
      return { ok: false, error: 'Откройте настольное приложение, чтобы запустить Illustrator.' }
    }
    if (resource.kind === 'link') {
      window.open(resource.target, '_blank', 'noopener,noreferrer')
      return { ok: true }
    }
    return { ok: false, error: `Файл «${resource.name}» откроется в настольном приложении Illustrator.` }
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


