import type { Resource } from './types'

export function recentMaterials(resources: Resource[]): Resource[] {
  return [...resources].sort((a, b) => Number(a.kind === 'app') - Number(b.kind === 'app') || Date.parse(b.lastOpenedAt || b.createdAt) - Date.parse(a.lastOpenedAt || a.createdAt))
}

export function resourceAppLabel(resource: Resource): string {
  if (resource.kind === 'app') return 'Приложение'
  if (resource.kind === 'link') {
    try {
      const host = new URL(resource.target).hostname.replace(/^www\./, '')
      return host === 'figma.com' ? 'Figma' : host
    } catch { return 'Сайт' }
  }
  const extension = resource.target.split('.').pop()?.toLowerCase()
  if (['ai', 'eps', 'ait'].includes(extension || '')) return 'Adobe Illustrator'
  if (['psd', 'psb'].includes(extension || '')) return 'Adobe Photoshop'
  if (['indd', 'idml'].includes(extension || '')) return 'Adobe InDesign'
  if (['doc', 'docx', 'rtf'].includes(extension || '')) return 'Документ Word'
  if (['xls', 'xlsx', 'csv'].includes(extension || '')) return 'Таблица'
  if (['ppt', 'pptx'].includes(extension || '')) return 'Презентация'
  return extension === 'pdf' ? 'PDF-документ' : 'Файл на компьютере'
}
