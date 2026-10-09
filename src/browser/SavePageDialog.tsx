import { useRef, useState } from 'react'
import { Bookmark, Check, Folder, Plus } from 'lucide-react'
import { Dialog } from '../Dialog'
import type { AppState, BrowserTab } from '../types'
import { BOOKMARKS, defaultBookmarkDestination, type SavePageRequest } from './bookmarks'

export function SavePageDialog({ state, tab, sourceSpaceId, onClose, onSave }: {
  state: AppState
  tab: BrowserTab
  sourceSpaceId?: string
  onClose: () => void
  onSave: (request: SavePageRequest) => Promise<boolean>
}) {
  const [destination, setDestination] = useState(() => defaultBookmarkDestination(state, sourceSpaceId))
  const [name, setName] = useState(tab.title || tab.url)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const bookmarks = destination.spaceId === BOOKMARKS
  const web = state.spaces.find(space => space.kind === 'web' && !space.archivedAt)
  const spaces = state.spaces.filter(space => space.kind !== 'web' && !space.archivedAt)
  const owner = bookmarks ? web : spaces.find(space => space.id === destination.spaceId)
  const existing = !creatingGroup ? owner?.resources.find(item => item.kind === 'link' && item.target === tab.url && (!bookmarks || item.bookmarkGroupId === destination.groupId)) : undefined
  const alreadySaved = Boolean(existing)
  async function save() {
    if (inFlight.current || (creatingGroup && !groupName.trim())) return
    inFlight.current = true; setPending(true); setError('')
    try {
      const saved = await onSave({ destination, name, ...(bookmarks && creatingGroup ? { newGroupName: groupName.trim() } : {}) })
      if (saved) onClose(); else setError('Не удалось сохранить страницу. Попробуйте ещё раз.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить страницу.') }
    finally { inFlight.current = false; setPending(false) }
  }
  return <Dialog title="Сохранить страницу" className="save-page-dialog" onClose={() => { if (!inFlight.current) onClose() }}>
    <p className="save-page-url" title={tab.url}>{tab.url}</p>
    <form onSubmit={event => { event.preventDefault(); void save() }} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }}>
      <fieldset disabled={pending}>
        <label className="save-page-field">Название<input value={existing?.name || name} disabled={alreadySaved} maxLength={200} onChange={event => setName(event.target.value)} /></label>
        <div className="save-page-destinations" aria-label="Куда сохранить">
          <button type="button" aria-pressed={bookmarks} onClick={() => { setDestination({ spaceId: BOOKMARKS }); setCreatingGroup(false) }}><Bookmark size={17} />Закладки</button>
          <button type="button" aria-pressed={!bookmarks} disabled={!spaces.length} onClick={() => { setDestination({ spaceId: spaces.find(space => space.id === sourceSpaceId)?.id || spaces[0].id }); setCreatingGroup(false) }}><Folder size={17} />Пространство</button>
        </div>
        {bookmarks ? <>
          <div className="save-page-field"><label htmlFor="save-page-group">Группа</label><select id="save-page-group" value={creatingGroup ? '' : destination.groupId || ''} disabled={creatingGroup} onChange={event => setDestination({ spaceId: BOOKMARKS, ...(event.target.value ? { groupId: event.target.value } : {}) })}><option value="">Без группы</option>{web?.bookmarkGroups?.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
          {creatingGroup ? <div className="save-page-new-group"><label className="save-page-field">Название новой группы<input autoFocus value={groupName} maxLength={80} onChange={event => setGroupName(event.target.value)} /></label><button type="button" onClick={() => setCreatingGroup(false)}>Отменить создание группы</button></div> : <button type="button" className="save-page-create-group" onClick={() => setCreatingGroup(true)}><Plus size={15} />Новая группа</button>}
        </> : <div className="save-page-field"><label htmlFor="save-page-space">Пространство</label><select id="save-page-space" value={destination.spaceId} onChange={event => setDestination({ spaceId: event.target.value })}>{spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></div>}
        {alreadySaved && <p className="save-page-existing"><Check size={15} />Страница уже сохранена здесь</p>}
        <p className="save-page-hint">Вкладка останется открытой. Место запомнится для следующего сохранения.</p>
        <div className="calm-dialog-actions"><button type="button" className="calm-text-button" onClick={onClose}>Отмена</button><button type="submit" data-dialog-focus className="calm-primary" disabled={(creatingGroup && !groupName.trim()) || (!bookmarks && !owner)}>{pending ? 'Сохраняем…' : alreadySaved ? 'Готово' : 'Сохранить'}<Check size={17} /></button></div>
      </fieldset>
      {error && <p className="browser-day-warning" role="alert">{error}</p>}
    </form>
  </Dialog>
}
