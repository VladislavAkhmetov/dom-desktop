import { useState } from 'react'
import type { AppState, AIContext, MailMessage, NewsEdition, Resource, WidgetConfig } from './types'
import { localDate } from '../shared/state'
import { Dialog } from './Dialog'
import './integrations.css'
import { isDemo } from './demo'
import { mailIsImportant } from './mailModel'

interface Props { state: AppState; widget?: WidgetConfig; onSettings: () => void; onOpen: (resource: Resource) => void; onChange: (update: (state: AppState) => AppState) => unknown; onAssistant: (prompt: string, contexts: AIContext[]) => void }
const link = (id: string, title: string, url: string): Resource => ({ id, name: title, target: url, kind: 'link', createdAt: new Date().toISOString() })
export function MailWidget({ state, widget, onSettings, onOpen, onChange, onAssistant }: Props) {
  const [selected, setSelected] = useState<MailMessage | null>(null), [all, setAll] = useState(false)
  const messages = (state.mailMessages || []).filter(item => item.unread).map(item => ({ ...item, important: mailIsImportant(state, item) })).sort((a, b) => Number(b.important) - Number(a.important) || Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
  const limit = widget?.size === 'S' ? 2 : widget?.size === 'L' ? 8 : 4
  const row = (item: MailMessage) => <button className="feed-row" key={item.id} onClick={() => setSelected(item)}><strong>{item.subject}</strong><small>{item.important ? 'Важное · ' : ''}{item.from}</small></button>
  return <><div className="feed-heading"><h2>Почта</h2>{isDemo && <small>Пример</small>}<button onClick={onSettings}>Настроить</button></div>{!state.mailAccounts?.length ? <p>Подключите Gmail, чтобы видеть важные входящие.</p> : <><div className="finite-feed">{messages.slice(0, limit).map(row)}</div>{!messages.length && <p>Непрочитанных входящих нет.</p>}{state.mailAccounts.some(item => item.error) && <p className="feed-error">Есть ошибка подключения. Показаны сохранённые письма.</p>}{messages.length > limit && <button className="calm-text-button" onClick={() => setAll(true)}>Все входящие · {messages.length}</button>}</>}
    {all && !selected && <Dialog title="Входящие" onClose={() => setAll(false)}><div className="finite-feed">{messages.map(row)}</div></Dialog>}
    {selected && <Dialog title={selected.subject} onClose={() => setSelected(null)}><p>{selected.from}</p><p className="mail-snippet">{selected.snippet}</p><small>Фрагмент письма из Gmail. Полный текст — в оригинале.</small><div className="calm-dialog-actions"><button className="calm-text-button" onClick={() => { onOpen(link(selected.id, selected.subject, selected.url)); setSelected(null); setAll(false) }}>Оригинал</button><button className="calm-text-button" onClick={() => { onAssistant('Перескажи этот фрагмент письма и выдели возможное действие. Не делай выводов о непереданной части письма.', [{ id: selected.id, title: selected.subject, url: selected.url, text: `${selected.from}\n${selected.snippet}` }]); setSelected(null); setAll(false) }}>Обсудить с ИИ</button><button className="calm-primary" onClick={() => { onChange(previous => ({ ...previous, reminders: [{ id: crypto.randomUUID(), title: `Ответить: ${selected.subject}`, kind: 'task', plannedDate: localDate(new Date()), dueAt: null, done: false, sourceUrl: selected.url, createdAt: new Date().toISOString() }, ...previous.reminders] })); setSelected(null) }}>Дело из письма</button></div></Dialog>}
  </>
}
export function NewsWidget({ state, widget, onSettings, onOpen, onAssistant }: Props) {
  const [all, setAll] = useState(false)
  const edition = state.newsEditions?.[0]
  const [openedEdition, setOpenedEdition] = useState<NewsEdition | null>(null)
  const displayed = all ? openedEdition : edition
  const limit = widget?.size === 'S' ? 3 : widget?.size === 'L' ? 10 : 5
  const rows = (complete = false) => displayed?.articles.slice(0, complete ? 30 : limit).map(item => <button className="feed-row" key={item.id} onClick={() => { onOpen(link(item.id, item.title, item.url)); setAll(false) }}><strong>{item.title}</strong><small>{item.source}</small>{widget?.detail !== 'titles' && <p>{item.summary.slice(0, widget?.detail === 'full' ? 700 : 160)}</p>}</button>)
  return <><div className="feed-heading"><h2>Дайджест</h2>{isDemo && <small>Пример</small>}<button onClick={onSettings}>Источники</button></div>{displayed ? <><small>Выпуск {new Date(displayed.createdAt).toLocaleString('ru-RU')}</small><div className="finite-feed">{rows()}</div><button className="calm-text-button" onClick={() => { setOpenedEdition(displayed); setAll(true) }}>Весь выпуск · {displayed.articles.length}</button>{state.feedSources?.some(item => item.error) && <p className="feed-error">Часть источников недоступна. Ошибки — в настройках.</p>}</> : <p>{state.feedSources?.length ? 'Источники пока не дали материалов. Можно обновить выпуск в настройках.' : 'Добавьте RSS или Atom. Выпуск остаётся на месте, пока вы его читаете.'}</p>}
    {all && displayed && <Dialog title="Выпуск новостей" onClose={() => setAll(false)}><div className="finite-feed">{rows(true)}</div><button className="calm-primary" onClick={() => { onAssistant('Сделай короткий дайджест этих материалов, со ссылками на источники. Переданы только заголовки и фрагменты.', displayed.articles.slice(0, 20).map(item => ({ id: item.id, title: item.title, url: item.url, text: item.summary }))); setAll(false) }}>Сжать с ИИ</button></Dialog>}
  </>
}
