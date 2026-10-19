import type { Resource } from './types'

export function recentMaterials(resources: Resource[]): Resource[] {
  return [...resources].sort((a, b) => Number(a.kind === 'app') - Number(b.kind === 'app') || Date.parse(b.lastOpenedAt || b.createdAt) - Date.parse(a.lastOpenedAt || a.createdAt))
}

export function resourceAppLabel(resource: Resource): string {
  if (resource.kind === 'window') {
    return resource.exeName ? resource.exeName.replace(/\.exe$/i, '') : 'Окно Windows'
  }
  if (resource.kind === 'app') return 'Приложение'
  if (resource.kind === 'link') {
    try {
      const host = new URL(resource.target).hostname.replace(/^www\./, '')
      return host === 'figma.com' ? 'Figma' : host
    } catch { return 'Сайт' }
  }
  return 'Программа по умолчанию'
}
