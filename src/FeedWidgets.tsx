import { useState } from 'react'
import type { AppState, AIContext, MailMessage, Resource, WidgetConfig } from './types'
import { localDate } from '../shared/state'
import { Dialog } from './Dialog'
import './integrations.css'
import { mailIsImportant } from './mailModel'

interface Props { state: AppState; widget?: WidgetConfig; onSettings: () => void; onOpen: (resource: Resource) => void; onChange: (update: (state: AppState) => AppState) => unknown; onAssistant: (prompt: string, contexts: AIContext[]) => void }
const link = (id: string, title: string, url: string): Resource => ({ id, name: title, target: url, kind: 'link', createdAt: new Date().toISOString() })
export function MailWidget({ state, widget, onSettings, onOpen, onChange, onAssistant }: Props) {
  const [selected, setSelected] = useState<MailMessage | null>(null), [all, setAll] = useState(false)
  const messages = (state.mailMessages || []).filter(item => item.unread).map(item => ({ ...item, important: mailIsImportant(state, item) })).sort((a, b) => Number(b.important) - Number(a.important) || Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
  const limit = widget?.size === 'S' ? 2 : widget?.size === 'L' ? 8 : 4
  const row = (item: MailMessage) => <button className="feed-row" key={item.id} onClick={() => setSelected(item)}><strong>{item.subject}</strong><small>{item.important ? 'Важное · ' : ''}{item.from}</small></button>
  return <><div className="feed-heading"><h2>Почта</h2><button onClick={onSettings}>{state.mailAccounts?.length ? 'Настроить' : 'Подключить Gmail'}</button></div>{!state.mailAccounts?.length ? <p>Нет подключённых аккаунтов</p> : <><div className="finite-feed">{messages.slice(0, limit).map(row)}</div>{!messages.length && <p>Нет непрочитанных писем</p>}{state.mailAccounts.some(item => item.error) && <p className="feed-error">Ошибка подключения</p>}{messages.length > limit && <button className="calm-text-button" onClick={() => setAll(true)}>Все входящие · {messages.length}</button>}</>}
    {all && !selected && <Dialog title="Входящие" onClose={() => setAll(false)}><div className="finite-feed">{messages.map(row)}</div></Dialog>}
    {selected && <Dialog title={selected.subject} onClose={() => setSelected(null)}><p>{selected.from}</p><p className="mail-snippet">{selected.snippet}</p><div className="calm-dialog-actions"><button className="calm-text-button" onClick={() => { onOpen(link(selected.id, selected.subject, selected.url)); setSelected(null); setAll(false) }}>Открыть письмо</button><button className="calm-text-button" onClick={() => { onAssistant('Перескажи этот фрагмент письма и выдели возможное действие. Не делай выводов о непереданной части письма.', [{ id: selected.id, title: selected.subject, url: selected.url, text: `${selected.from}\n${selected.snippet}` }]); setSelected(null); setAll(false) }}>Обсудить с ИИ</button><button className="calm-primary" onClick={() => { onChange(previous => ({ ...previous, reminders: [{ id: crypto.randomUUID(), title: `Ответить: ${selected.subject}`, kind: 'task', plannedDate: localDate(new Date()), dueAt: null, done: false, sourceUrl: selected.url, createdAt: new Date().toISOString() }, ...previous.reminders] })); setSelected(null) }}>Дело из письма</button></div></Dialog>}
  </>
}

export { NewsWidget } from './NewsWidget'
