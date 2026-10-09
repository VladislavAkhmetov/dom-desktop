import { useState, type ReactNode } from 'react'
import { AppWindow, Pin, Plus } from 'lucide-react'
import type { AppState, Resource } from './types'
import { Dialog } from './Dialog'
import { isDesktop } from './bridge'

export function QuickAppsSettings({ state, currentSpaceId, onChange, onPick, onClose, appIcon }: { state: AppState; currentSpaceId?: string; onChange: (update: (state: AppState) => AppState) => unknown; onPick: () => void; onClose: () => void; appIcon: (name: string) => ReactNode }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const apps = state.spaces.flatMap(space => space.resources.filter(item => item.kind === 'app')).sort((a, b) => Number(Boolean(b.pinnedToDock)) - Number(Boolean(a.pinnedToDock))).filter((app, index, all) => all.findIndex(item => item.target.toLowerCase() === app.target.toLowerCase()) === index)
  const pinned = apps.filter(app => app.pinnedToDock).length
  return <Dialog title="Быстрые приложения" onClose={onClose} className="quick-apps-dialog">
    <div className="quick-apps-list">{apps.map(app => <div key={app.id}><span className="calm-app-icon">{appIcon(app.name)}</span><strong>{app.name}</strong><button aria-label={`${app.pinnedToDock ? 'Открепить' : 'Закрепить'} ${app.name}`} aria-pressed={Boolean(app.pinnedToDock)} disabled={!app.pinnedToDock && pinned >= 4} onClick={() => onChange(previous => ({ ...previous, spaces: previous.spaces.map(space => ({ ...space, resources: space.resources.map(item => item.kind === 'app' && item.target.toLowerCase() === app.target.toLowerCase() ? { ...item, pinnedToDock: !app.pinnedToDock } : item) })) }))}><Pin size={15} />{app.pinnedToDock ? 'Закреплено' : 'Закрепить'}</button></div>)}</div>
    <form className="quick-apps-form" onSubmit={async event => {
      event.preventDefault(); setError('')
      let target: URL
      try { target = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : 'https://' + url.trim()); if (!['https:', 'http:'].includes(target.protocol) || !target.hostname.includes('.')) throw new Error() } catch { setError('Некорректный адрес сайта'); return }
      if (apps.some(item => item.target === target.href)) { setError('Приложение уже добавлено'); return }
      const app: Resource = { id: crypto.randomUUID(), name: name.trim(), kind: 'app', target: target.href, createdAt: new Date().toISOString(), pinnedToDock: pinned < 4 }
      const owner = state.spaces.find(space => space.id === currentSpaceId) || state.spaces.find(space => !space.archivedAt)
      if (!owner) { setError('Создайте пространство для приложения.'); return }
      setSaving(true)
      try { const result = await onChange(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === owner.id ? { ...space, resources: [...space.resources, app] } : space) })); if (result !== false) { setName(''); setUrl('') } else setError('Не удалось сохранить. Попробуйте ещё раз.') } finally { setSaving(false) }
    }}>
      <h3>Добавить своё</h3><label>Название<input required maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Telegram" /></label><label>Адрес веб-приложения<input required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://web.telegram.org" /></label>
      {error && <p role="alert">{error}</p>}<div><button type="submit" className="primary-button" disabled={saving || !name.trim() || !url.trim()}><Plus size={16} />{pinned < 4 ? 'Добавить и закрепить' : 'Добавить'}</button>{isDesktop && <button type="button" className="soft-button" onClick={onPick}><AppWindow size={16} />С компьютера</button>}</div>
    </form>
  </Dialog>
}
