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

// «.psd · Photoshop» for files; site or app label otherwise. Shared by the space page and the new tab.
export function documentFormat(resource: Resource) {
  const extension = resource.target.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  if (extension) {
    switch (extension) {
      case 'psd': return '.psd · Photoshop'
      case 'ai': return '.ai · Illustrator'
      case 'fig': return 'Figma · Документ'
      case 'pdf': return '.pdf · Документ'
      case 'docx':
      case 'doc': return `.${extension} · Word`
      case 'xlsx':
      case 'xls': return `.${extension} · Excel`
      case 'pptx':
      case 'ppt': return `.${extension} · PowerPoint`
      default: return `.${extension} · Документ`
    }
  }
  return resourceAppLabel(resource)
}
