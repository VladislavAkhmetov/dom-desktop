import { useEffect, useId, useRef, useState } from 'react'
import { AppWindow, ArrowRight, ChevronDown, FileText, Plus, Search } from 'lucide-react'
import type { HistoryItem, Resource, Space } from '../types'
import { OmniboxSuggestionList } from './OmniboxSuggestionList'
import { useAddressSuggestions } from './useAddressSuggestions'
import { documentFormat, recentMaterials } from '../resourcePresentation'
import { TabIcon } from './TabIcon'
import { currentContext } from '../workContexts'
import { isCabinetPreview } from '../cabinetMode'
import { FileTypeBadge } from '../FileTypeBadge'
import { NextStepLine } from '../NextStepLine'
import { dayLabel } from '../dayDraft'

/*
 * New tab as a threshold (same pattern as the space page): the space name is the Literata heading,
 * the optional next step a quiet line under it, one address field, then the space's materials as rows
 * with the shared file/site marks. Legacy (non-cabinet) mode keeps the step as the heading.
 */
function MaterialMark({ item }: { item: Resource }) {
  if (item.kind === 'link') return <span className="new-page-mark is-site"><TabIcon tab={{ id: item.id, title: item.name, url: item.target }} /></span>
  if (item.kind === 'file') return <span className="new-page-mark"><FileTypeBadge name={item.target || item.name} /></span>
  return <span className="new-page-mark is-icon">{item.kind === 'window' || item.kind === 'app' ? <AppWindow size={18} /> : <FileText size={18} />}</span>
}

export function NewPage({ space, favorites, spaces = [], history, onOpen, onOpenResource, onAddLink, autoFocus = true }: {
  space: Space
  favorites?: Space
  onOpen: (address: string, title?: string) => void
  onOpenResource: (resource: Resource) => void
  onAddLink: () => void
  /** Sources for the field's suggestions — the same as the address bar's. */
  spaces?: Space[]
  history?: HistoryItem[]
  autoFocus?: boolean
}) {
  const field = useAddressSuggestions({ spaces, history, onNavigate: onOpen })
  const [groupId, setGroupId] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const [showAllFavorites, setShowAllFavorites] = useState(false)
  const filterId = useId()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])
  const bookmarks = space.kind === 'web'
  const allMaterials = recentMaterials(space.resources).filter(item => !item.completedAt && (item.kind !== 'link' || /^https?:\/\//i.test(item.target)))
    .filter(item => !bookmarks || groupId === 'all' || (groupId === 'none' ? !item.bookmarkGroupId : item.bookmarkGroupId === groupId))
  const materials = showAll ? allMaterials : allMaterials.slice(0, 6)
  // «Избранное» outside spaces: bookmarks from the hidden browsing space, grouped as the user filed them.
  const groupOrder = new Map((favorites?.bookmarkGroups || []).map((group, index) => [group.id, index]))
  const favoriteLinks = favorites && favorites.id !== space.id ? favorites.resources.filter(item => item.kind === 'link' && !item.completedAt && /^https?:\/\//i.test(item.target)).sort((a, b) => (groupOrder.get(a.bookmarkGroupId || '') ?? 99) - (groupOrder.get(b.bookmarkGroupId || '') ?? 99)) : []
  const groupName = (item: Resource) => favorites?.bookmarkGroups?.find(group => group.id === item.bookmarkGroupId)?.name || ''
  const nextStep = space.kind !== 'web' ? currentContext(space).checkpoint?.nextStep?.trim() : undefined
  const place = bookmarks ? 'Браузинг' : isCabinetPreview ? space.name : 'Рабочее пространство'
  const named = isCabinetPreview && !bookmarks
  const isDay = space.kind === 'day'
  const heading = named ? (space.nameOrigin === 'temporary' ? 'С чего начнём?' : space.name) : nextStep || 'Новая вкладка'
  return <div className="browser-start-screen new-page"><div className="browser-start-card new-page-content">
    <div className="new-page-heading">
      <span className="new-page-eyebrow">{isDay && space.day ? dayLabel(space.day) : named ? 'Новая вкладка' : nextStep ? `${place} · следующий шаг` : place}</span>
      <h2 className={nextStep && !named ? 'is-step' : undefined}>{heading}</h2>
      {named && !isDay && <NextStepLine step={nextStep} className="new-page-next" />}
    </div>
    {/* Typing happens where the user clicked: the field has the address bar's suggestions right under it. */}
    <form ref={field.root} className={`new-page-form${field.suggestions.length ? ' has-suggestions' : ''}`} onSubmit={event => { event.preventDefault(); field.submit() }}>
      <Search size={18} aria-hidden="true" />
      <input ref={input} autoFocus={autoFocus} value={field.address} onChange={event => field.change(event.target.value)} onFocus={field.open} onKeyDown={field.keyDown}
        placeholder="Открыть сайт или найти" aria-label="Открыть сайт или найти" role="combobox" aria-expanded={field.suggestions.length > 0} aria-autocomplete="list" autoComplete="off" spellCheck={false} />
      <button type="submit" disabled={!field.address.trim()} aria-label="Открыть"><ArrowRight size={18} /></button>
      {field.suggestions.length > 0 && <OmniboxSuggestionList className="new-page-suggestions" items={field.suggestions} selectedIndex={field.selectedIndex} onSelect={field.select} onHover={field.setSelectedIndex} />}
    </form>
    {!(isDay && !allMaterials.length) && <section className="new-page-materials" aria-label={bookmarks ? 'Избранное' : 'Материалы'}>
      <div className="new-page-materials-heading">
        <h3>{bookmarks ? 'Избранное' : 'Материалы'}{allMaterials.length > 0 && <span>{allMaterials.length}</span>}</h3>
        <button onClick={onAddLink}><Plus size={16} />Ссылка</button>
      </div>
      {bookmarks && Boolean(space.bookmarkGroups?.length) && <div className="new-page-bookmark-filter"><label htmlFor={filterId}>Категория</label><select id={filterId} value={groupId} onChange={event => { setGroupId(event.target.value); setShowAll(false) }}><option value="all">Всё избранное</option><option value="none">Общее</option>{space.bookmarkGroups!.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>}
      {materials.length > 0
        ? <div className="new-page-material-grid">{materials.map(item => <button key={item.id} title={item.target || item.name} onClick={() => item.kind === 'link' ? onOpen(item.target, item.name) : onOpenResource(item)}><MaterialMark item={item} /><span><strong>{item.name}</strong><small>{documentFormat(item)}</small></span></button>)}</div>
        : <div className="new-page-materials-empty"><p>{isCabinetPreview && !bookmarks ? 'Здесь будут ссылки, референсы и документы для этой задачи.' : 'Сохранённые ссылки появятся здесь.'}</p></div>}
      {!showAll && allMaterials.length > materials.length && <button className="new-page-show-all" onClick={() => setShowAll(true)}>Показать все · {allMaterials.length}<ChevronDown size={16} /></button>}
    </section>}
    {favoriteLinks.length > 0 && <section className="new-page-materials new-page-favorites" aria-label="Избранное">
      <div className="new-page-materials-heading"><h3>Избранное<span>{favoriteLinks.length}</span></h3></div>
      <div className="new-page-material-grid">{(showAllFavorites ? favoriteLinks : favoriteLinks.slice(0, 6)).map(item => <button key={item.id} title={item.target} onClick={() => onOpen(item.target, item.name)}><MaterialMark item={item} /><span><strong>{item.name}</strong><small>{[groupName(item), documentFormat(item)].filter(Boolean).join(' · ')}</small></span></button>)}</div>
      {!showAllFavorites && favoriteLinks.length > 6 && <button className="new-page-show-all" onClick={() => setShowAllFavorites(true)}>Показать все · {favoriteLinks.length}<ChevronDown size={16} /></button>}
    </section>}
  </div></div>
}
