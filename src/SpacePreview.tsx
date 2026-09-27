import { Folder, Globe2, FileText, AppWindow } from 'lucide-react'
import type { Space } from './types'

export function spaceContents(space: Space) {
  const tabs = space.activeSession?.tabs.filter(tab => tab.url).length || 0
  const materials = space.resources.length
  const count = (value: number, forms: string[]) => `${value} ${forms[value % 100 >= 11 && value % 100 <= 14 ? 2 : value % 10 === 1 ? 0 : value % 10 >= 2 && value % 10 <= 4 ? 1 : 2]}`
  return [tabs ? count(tabs, ['вкладка', 'вкладки', 'вкладок']) : '', materials ? count(materials, ['материал', 'материала', 'материалов']) : ''].filter(Boolean).join(' · ') || 'Можно начать с одной ссылки'
}

/** A small, decorative view of the actual resource types in a space. */
export function SpacePreview({ space }: { space: Pick<Space, 'resources' | 'activeSession'> }) {
  const kinds = [...space.resources.slice(0, 3).map(item => item.kind)]
  if (!kinds.length && space.activeSession?.tabs.some(tab => tab.url)) kinds.push('link')
  return <span className="space-preview" aria-hidden="true">
    <span className="preview-sheet sheet-back" />
    <span className="preview-sheet sheet-middle" />
    <span className="preview-sheet sheet-front"><span className="preview-window-dots"><i /><i /><i /></span><span className="preview-resource-icons">{kinds.length ? kinds.map((kind, index) => kind === 'link' ? <Globe2 key={index} size={23} /> : kind === 'app' ? <AppWindow key={index} size={23} /> : <FileText key={index} size={23} />) : <Folder size={28} strokeWidth={1.4} />}</span><span className="preview-lines"><i /><i /></span></span>
  </span>
}
