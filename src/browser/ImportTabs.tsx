import { useMemo, useState } from 'react'
import { Dialog } from '../Dialog'
import type { BrowserTab } from '../types'

export interface ImportGroup { name: string; tabs: BrowserTab[] }
export function parseTabImport(raw: string): ImportGroup[] {
  const link = (url: string, title?: string, pinned?: boolean, branchId?: string): BrowserTab | null => {
    try { const value = new URL(url); return ['https:', 'http:'].includes(value.protocol) ? { id: crypto.randomUUID(), url: value.toString(), title: title || value.hostname, pinned, branchId } : null } catch { return null }
  }
  if (!raw.trim()) return []
  if (raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
    const data = JSON.parse(raw)
    const windows = Array.isArray(data) ? [{ name: 'Перенесённые вкладки', tabs: data }] : data.windows || [{ name: data.name || 'Перенесённые вкладки', tabs: data.tabs }]
    return windows.map((window: { name?: string; tabs: { url: string; title?: string; pinned?: boolean; groupId?: number }[] }, index: number) => ({ name: window.name || `Окно ${index + 1}`, tabs: (window.tabs || []).map(item => link(item.url, item.title, item.pinned, item.groupId !== undefined && item.groupId >= 0 ? `import-${index}-${item.groupId}` : undefined)).filter(Boolean) })).filter((group: ImportGroup) => group.tabs.length)
  }
  if (/<a\s/i.test(raw)) {
    const document = new DOMParser().parseFromString(raw, 'text/html')
    return [{ name: 'Закладки', tabs: [...document.querySelectorAll('a[href]')].map(item => link(item.getAttribute('href')!, item.textContent || '')).filter((item): item is BrowserTab => Boolean(item)) }]
  }
  return [{ name: 'Перенесённые вкладки', tabs: raw.split(/\s+/).map(value => link(value)).filter((item): item is BrowserTab => Boolean(item)) }]
}

export function ImportTabs({ onClose, onImport }: { onClose: () => void; onImport: (groups: ImportGroup[]) => void }) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState('')
  const parsed = useMemo(() => { try { return { groups: parseTabImport(raw), error: '' } } catch { return { groups: [], error: 'Не удалось прочитать экспорт' } } }, [raw])
  return <Dialog title="Перенести вкладки" onClose={onClose}><div className="calm-form"><label>Адреса или экспорт вкладок<textarea rows={5} value={raw} onChange={event => setRaw(event.target.value)} /></label><label>Файл вкладок или закладок<input type="file" accept=".json,.html,.htm,.txt" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 5_000_000) { setError('Файл больше 5 МБ'); return } setError(''); setRaw(await file.text()) }} /></label></div>{(error || parsed.error) && <p role="alert">{error || parsed.error}</p>}<div className="import-preview">{parsed.groups.map((group, index) => <p key={index}>{group.name} · {group.tabs.length} вкладок</p>)}</div><div className="calm-dialog-actions"><button className="calm-primary" disabled={!parsed.groups.some(group => group.tabs.length) || Boolean(error)} onClick={() => onImport(parsed.groups)}>Добавить пространства</button></div></Dialog>
}
