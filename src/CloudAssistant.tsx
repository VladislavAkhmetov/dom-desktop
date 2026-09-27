import { useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import { bridge } from './bridge'
import { assistantRoles, type AssistantPreferences, type AssistantRole } from './assistantModel'
import type { AIConfiguration, AIContext, AppState, Resource } from './types'
import { applyAssistantAction, proposedActions } from './assistantTools'
import './assistant.css'

interface Props { draft: string; preferences: AssistantPreferences; onPreferencesChange: (value: AssistantPreferences) => void; onDraftChange: (value: string) => void; onClose: () => void; state: AppState; onChange: (update: (state: AppState) => AppState) => unknown; spaceId?: string; tabId?: string; initialContexts: AIContext[]; onOpen: (resource: Resource) => void }
export function AssistantPanel({ draft, preferences, onPreferencesChange, onDraftChange, onClose, state, onChange, spaceId, tabId, initialContexts, onOpen }: Props) {
  const [connection, setConnection] = useState(!state.aiConfiguration?.configured)
  const [config, setConfig] = useState<AIConfiguration>(state.aiConfiguration || { provider: 'openai', model: '', role: preferences.role, dailyRequestLimit: 20, maxOutputTokens: 2000 })
  const [key, setKey] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [contexts, setContexts] = useState<AIContext[]>(initialContexts), [sources, setSources] = useState<AIContext[]>([])
  const [answer, setAnswer] = useState(''), [consent, setConsent] = useState(false), [applied, setApplied] = useState<number[]>([])
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const previousAnswer = useRef('')
  const id = useRef('')
  const role = preferences.role
  useEffect(() => {
    const off = bridge.integrations?.onAI(event => { if (event.id !== id.current) return; if (event.type === 'delta') { previousAnswer.current += event.text || ''; setAnswer(previousAnswer.current) } else { setBusy(false); if (event.type === 'error') setError(event.text || 'Ответ не завершён'); else { setHistory(previous => [...previous, { role: 'assistant' as const, text: previousAnswer.current }].slice(-12)); setConsent(false) } } })
    return () => { off?.(); if (id.current) bridge.integrations?.cancelAI(id.current) }
  }, [])
  const patch = (value: Partial<AIConfiguration>) => setConfig(previous => ({ ...previous, ...value }))
  const space = state.spaces.find(item => item.id === spaceId)
  function addContext(value: AIContext) { setContexts(previous => [...previous.filter(item => item.id !== value.id), value]); setConsent(false) }
  async function addPage() { try { if (!bridge.browser || !tabId) throw new Error('Откройте страницу в настольном браузере'); const page = await bridge.browser.text(tabId); addContext({ id: `page:${tabId}`, ...page }); setError('') } catch (error) { setError(error instanceof Error ? error.message : 'Страница недоступна') } }
  async function addMaterial(item: Resource) {
    try {
      if (!bridge.integrations) throw new Error('Чтение материалов доступно в настольном Доме')
      const context = await bridge.integrations.readMaterial(item.id)
      if (item.kind === 'link') { const document = new DOMParser().parseFromString(context.text, 'text/html'); document.querySelectorAll('script,style,noscript').forEach(item => item.remove()); context.text = (document.querySelector('article,main')?.textContent || document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 50000) }
      addContext(context); setError('')
    } catch (error) { setError(error instanceof Error ? error.message : 'Материал не удалось прочитать') }
  }
  async function run() {
    if (!bridge.integrations || !state.aiConfiguration?.configured) { setConnection(true); return }
    id.current = crypto.randomUUID(); previousAnswer.current = ''; setAnswer(''); setError(''); setApplied([]); setSources(contexts); setBusy(true)
    const prior = history.slice(-10)
    setHistory(previous => [...previous, { role: 'user' as const, text: draft }].slice(-11))
    try { await bridge.integrations.runAI({ id: id.current, prompt: draft, contexts, consent, history: prior }) } catch (error) { setError(error instanceof Error ? error.message : 'Ошибка запроса'); setBusy(false) }
  }
  const providerLabel = config.provider === 'openai' ? 'OpenAI' : config.provider === 'anthropic' ? 'Anthropic' : config.endpoint || 'Облачный API'
  return <div className="assistant-layer"><Dialog title="ИИ в Доме" onClose={onClose}>
    <div className="assistant-toolbar"><span>{state.aiConfiguration?.configured ? `${state.aiConfiguration.provider} · ${state.aiConfiguration.model}` : 'Модель не подключена'}</span><button onClick={() => setConnection(!connection)} disabled={busy}>{connection ? 'К запросу' : 'Подключение и лимиты'}</button></div>
    {connection ? <div className="calm-form">
      <label>Провайдер<select value={config.provider} onChange={event => patch({ provider: event.target.value as AIConfiguration['provider'] })}><option value="openai">OpenAI Responses</option><option value="anthropic">Anthropic Messages</option><option value="compatible">Совместимый облачный API</option></select></label>
      {config.provider === 'compatible' && <label>Базовый HTTPS endpoint · до /chat/completions<input type="url" value={config.endpoint || ''} onChange={event => patch({ endpoint: event.target.value })} /></label>}
      <label>Название модели<input value={config.model} onChange={event => patch({ model: event.target.value })} /></label>
      <label>API-ключ · хранится в защищённом хранилище ОС<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} /></label>
      <label>Запросов в день<input type="number" min={1} max={1000} value={config.dailyRequestLimit} onChange={event => patch({ dailyRequestLimit: Number(event.target.value) })} /></label>
      <label>Максимум токенов ответа<input type="number" min={128} max={16000} value={config.maxOutputTokens} onChange={event => patch({ maxOutputTokens: Number(event.target.value) })} /></label>
      <details><summary>Фоновый обзор · выключен по умолчанию</summary>
        <label className="assistant-check"><input type="checkbox" checked={Boolean(config.background?.enabled)} onChange={event => patch({ background: { hour: 9, mail: false, news: false, ...config.background, enabled: event.target.checked } })} />Разрешаю ежедневно отправлять выбранные ниже данные {providerLabel}</label>
        {config.background?.enabled && <><label>После какого часа<input type="number" min={0} max={23} value={config.background.hour} onChange={event => patch({ background: { ...config.background!, hour: Number(event.target.value) } })} /></label>{(['mail', 'news'] as const).map(type => <label key={type} className="assistant-check"><input type="checkbox" checked={config.background?.[type]} onChange={event => patch({ background: { ...config.background!, [type]: event.target.checked } })} />{type === 'mail' ? 'Фрагменты важных непрочитанных писем' : 'Заголовки и фрагменты текущего выпуска RSS'}</label>)}</>}
        <p>Один запрос в день, когда Дом запущен. Общий дневной лимит применяется. Лимит расходов в деньгах задайте у провайдера.</p>
      </details>
      <button className="calm-primary" disabled={!bridge.integrations || busy || !config.model.trim()} onClick={async () => { setBusy(true); setError(''); try { await bridge.integrations!.configureAI({ ...config, role }, key.trim() || undefined); setKey(''); setConnection(false) } catch (error) { setError(error instanceof Error ? error.message : 'Подключение недоступно') } finally { setBusy(false) } }}>Сохранить подключение</button>
      {!bridge.integrations && <p>Ключи и запросы доступны в настольном Доме.</p>}
    </div> : <>
      <fieldset className="assistant-role-picker"><legend>Глубина помощи</legend><div>{(Object.keys(assistantRoles) as AssistantRole[]).map(value => <label key={value} className={role === value ? 'selected' : ''}><input type="radio" name="assistant-role" checked={role === value} onChange={() => { onPreferencesChange({ ...preferences, role: value }); if (state.aiConfiguration) onChange(previous => ({ ...previous, aiConfiguration: { ...previous.aiConfiguration!, role: value } })) }} /><span>{assistantRoles[value].label}</span></label>)}</div></fieldset>
      <p className="assistant-boundary">{role === 'chat' ? 'Отвечает на ваш запрос. Контекст добавляете вы.' : role === 'helper' ? 'Пересказывает выбранные источники и предлагает шаги.' : 'Предлагает действия в Доме. Каждое действие можно проверить и применить отдельно.'}</p>
      <div className="context-buttons"><button disabled={busy} onClick={() => addContext({ id: 'day', title: 'План дня', text: JSON.stringify({ reminders: state.reminders.filter(item => !item.done), events: state.events?.filter(item => new Date(item.startAt).toDateString() === new Date().toDateString()), spaces: state.spaces.filter(item => !item.archivedAt).map(item => ({ id: item.id, name: item.name })) }) })}>Добавить план дня</button><button disabled={busy} onClick={addPage}>Текущая страница</button></div>
      {space && <details className="assistant-material-picker"><summary>Выбрать материалы «{space.name}»</summary>{space.resources.filter(item => item.kind !== 'app').map(item => <button key={item.id} disabled={busy} onClick={() => addMaterial(item)}>{item.name}</button>)}</details>}
      <div className="assistant-sources">{contexts.map((item, index) => <details key={item.id}><summary>[{index + 1}] {item.title} · {item.text.length} символов <button aria-label={`Убрать источник ${item.title}`} disabled={busy} onClick={event => { event.preventDefault(); setContexts(previous => previous.filter(value => value.id !== item.id)); setConsent(false) }}>×</button></summary><pre>{item.text}</pre></details>)}</div>
      {history.length > 0 && <details><summary>История диалога · {history.length} сообщений</summary>{history.map((item, index) => <p key={index} className="assistant-history-row"><strong>{item.role === "user" ? "Вы" : "Помощник"}</strong><br />{item.text}</p>)}<button className="calm-text-button" disabled={busy} onClick={() => { setHistory([]); setConsent(false) }}>Новый диалог</button></details>}<textarea className="assistant-prompt" aria-label="Ваш запрос" rows={3} value={draft} onChange={event => { onDraftChange(event.target.value); setConsent(false) }} disabled={busy} />
      <label className="assistant-check"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />Отправить этот запрос, последние сообщения диалога и выбранные {contexts.length} источников {state.aiConfiguration?.provider === 'compatible' ? state.aiConfiguration.endpoint : state.aiConfiguration?.provider || providerLabel}</label>
      <div className="calm-dialog-actions">{busy ? <button className="calm-primary" onClick={() => bridge.integrations?.cancelAI(id.current)}>Остановить</button> : <button className="calm-primary" disabled={!draft.trim() || !consent} onClick={run}>Отправить</button>}</div>
      {answer && <div className="assistant-answer"><pre>{answer}</pre><div>{sources.map((source, index) => source.url ? <button key={source.id} onClick={() => { onClose(); onOpen({ id: source.id, name: source.title, kind: 'link', target: source.url!, createdAt: new Date().toISOString() }) }}>[{index + 1}] {source.title}</button> : <span key={source.id}>[{index + 1}] {source.title}</span>)}</div></div>}
      {!busy && role !== 'chat' && proposedActions(answer).map((action, index) => <div className="assistant-proposal" key={index}><pre>{JSON.stringify(action, null, 2)}</pre><button className="calm-primary" disabled={applied.includes(index)} onClick={async () => { try { const saved = await onChange(previous => applyAssistantAction(previous, action)); if (saved === true) setApplied(previous => [...previous, index]) } catch (error) { setError(error instanceof Error ? error.message : 'Действие не выполнено') } }}>{applied.includes(index) ? 'Применено' : 'Применить это действие'}</button></div>)}
    </>}
    {error && <p role="alert" className="assistant-error">{error}</p>}
    <details className="assistant-journal"><summary>Журнал обработки и фоновые обзоры · {state.aiJournal?.length || 0}</summary>{[...(state.aiJournal || [])].reverse().slice(0, 30).map(entry => <details key={entry.id}><summary>{new Date(entry.at).toLocaleString('ru-RU')} · {entry.model} · {entry.status}{entry.background ? ' · обзор' : ''}</summary><p>{entry.error}</p><p>{entry.sources.map(item => item.title).join(', ')}</p><small>Токены: вход {entry.inputTokens ?? 'не сообщён'}, выход {entry.outputTokens ?? 'не сообщён'}</small><pre>{entry.result}</pre></details>)}</details>
  </Dialog></div>
}
