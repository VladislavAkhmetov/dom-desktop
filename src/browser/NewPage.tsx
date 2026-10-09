import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, FileText, Search, CornerDownRight, Plus } from 'lucide-react'
import type { Resource, Space } from '../types'
import { recentMaterials } from '../resourcePresentation'
import { TabIcon } from './TabIcon'
import { currentContext } from '../workContexts'
import { isCabinetPreview } from '../cabinetMode'

function materialLabel(resource: Resource) {
  if (resource.kind !== 'link') return resource.kind === 'file' ? 'Документ' : 'Приложение'
  try { return new URL(resource.target).hostname.replace(/^www\./, '') } catch { return 'Ссылка' }
}

export function NewPage({ space, onOpen, onOpenResource, onAddLink, onFocusAddress, autoFocus = true }: {
  space: Space
  onOpen: (address: string, title?: string) => void
  onOpenResource: (resource: Resource) => void
  onAddLink: () => void
  onFocusAddress?: () => void
  autoFocus?: boolean
}) {
  const [address, setAddress] = useState('')
  const [groupId, setGroupId] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const filterId = useId()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (autoFocus && !onFocusAddress) input.current?.focus() }, [autoFocus, onFocusAddress])
  const bookmarks = space.kind === 'web'
  const allMaterials = recentMaterials(space.resources).filter(item => !item.completedAt && (item.kind !== 'link' || /^https?:\/\//i.test(item.target)))
    .filter(item => !bookmarks || groupId === 'all' || (groupId === 'none' ? !item.bookmarkGroupId : item.bookmarkGroupId === groupId))
  const materials = showAll ? allMaterials : allMaterials.slice(0, 6)
  const nextStep = space.kind !== 'web' ? currentContext(space).checkpoint?.nextStep : undefined
  return <div className="browser-start-screen new-page"><div className="browser-start-card new-page-content">
    <div className="new-page-heading"><span className="new-page-eyebrow">{space.kind === 'web' ? 'Браузинг' : isCabinetPreview ? space.name : 'Рабочее пространство'}</span><h2>{isCabinetPreview && space.nameOrigin === 'temporary' ? 'С чего начнём?' : 'Новая вкладка'}</h2></div>
    {onFocusAddress ? <button className="new-page-address-launch" onClick={onFocusAddress}><Search size={19} /><span>Открыть сайт или найти</span><kbd>Ctrl L</kbd><ArrowRight size={18} /></button> : <form className="new-page-form" onSubmit={event => { event.preventDefault(); if (address.trim()) onOpen(address.trim()) }} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }}>
      <Search size={22} aria-hidden="true" />
      <input ref={input} autoFocus={autoFocus} value={address} onChange={event => setAddress(event.target.value)} placeholder="Адрес или поиск" aria-label="Адрес или поиск" autoComplete="off" spellCheck={false} />
      <button type="submit" disabled={!address.trim()} aria-label="Открыть"><ArrowRight size={22} /></button>
    </form>}
    {nextStep && <div className="new-page-next-step"><CornerDownRight size={19} /><div><span>Следующий шаг</span><p>{nextStep}</p></div></div>}
    <div className="new-page-materials-heading"><h3>{bookmarks ? 'Избранное' : 'Материалы под рукой'}</h3><button onClick={onAddLink}><Plus size={15} />Ссылка</button></div>
    {bookmarks && Boolean(space.bookmarkGroups?.length) && <div className="new-page-bookmark-filter"><label htmlFor={filterId}>Категория</label><select id={filterId} value={groupId} onChange={event => { setGroupId(event.target.value); setShowAll(false) }}><option value="all">Всё избранное</option><option value="none">Общее</option>{space.bookmarkGroups!.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>}
    {materials.length > 0 ? <div className="new-page-material-grid">{materials.map(item => <button key={item.id} title={item.name} onClick={() => item.kind === 'link' ? onOpen(item.target, item.name) : onOpenResource(item)}>{item.kind === 'link' ? <TabIcon tab={{ id: item.id, title: item.name, url: item.target }} /> : <FileText size={20} />}<span><strong>{item.name}</strong><small>{materialLabel(item)}</small></span><ArrowRight size={16} /></button>)}</div> : <div className="new-page-materials-empty"><FileText size={23} /><p>{isCabinetPreview && !bookmarks ? 'Здесь будут ссылки, референсы и документы для этой задачи.' : 'Сохраните полезную ссылку — она появится здесь.'}</p><button onClick={onAddLink}>Добавить ссылку <Plus size={15} /></button></div>}
    {!showAll && allMaterials.length > materials.length && <button className="new-page-show-all" onClick={() => setShowAll(true)}>Показать все · {allMaterials.length}<ArrowRight size={14} /></button>}
    {space.kind !== 'web' && <p className="new-page-footnote">{isCabinetPreview ? 'Вкладки сохраняются в этом пространстве. Для другой задачи создайте новое.' : 'Новые вкладки остаются в текущем деле.'}</p>}
  </div></div>
}
