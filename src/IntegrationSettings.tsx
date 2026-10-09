import { useEffect, useState } from 'react'
import { bridge } from './bridge'
import { isDemo } from './demo'
import { mailIsImportant } from './mailModel'
import { NewsSetup } from './NewsSetup'
import type { AppState } from './types'
import './integrations.css'

export function IntegrationSettings({ section, state, onChange, onNewsRefresh, newsRefreshing }: { section: 'mail' | 'news'; state: AppState; onChange: (update: (state: AppState) => AppState) => unknown; onNewsRefresh: () => unknown; newsRefreshing: boolean }) {
  const [clientId, setClientId] = useState('')
  const [configured, setConfigured] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false)
  const mailAvailable = Boolean(bridge.integrations) && !isDemo
  const accounts = state.mailAccounts || []
  const account = accounts.find(item => item.id === accountId) || accounts[0]
  useEffect(() => {
    if (section === 'mail' && mailAvailable) bridge.integrations?.googleConfigured().then(setConfigured).catch(error => setStatus(error.message))
  }, [section, mailAvailable])
  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true); setStatus('')
    try { await action(); setStatus(success) }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Не удалось выполнить действие') }
    finally { setBusy(false) }
  }
  return <div className="integration-settings settings-integration">
    {section === 'mail' ? <div className="settings-columns">
      <div className="settings-card"><h4>Подключение Gmail</h4>{!mailAvailable && <p className="settings-hint">Подключение недоступно</p>}
        <details><summary>OAuth</summary><div className="form-stack"><label>OAuth Client ID<input value={clientId} onChange={event => setClientId(event.target.value)} /></label><button className="soft-button" disabled={!mailAvailable || !clientId.trim() || busy} onClick={() => perform(async () => { await bridge.integrations!.configureGoogle(clientId); setClientId(''); setConfigured(true) }, 'Конфигурация сохранена')}>Сохранить</button></div></details>
        <button className="soft-button" disabled={!mailAvailable || !configured || busy} onClick={() => perform(() => bridge.integrations!.connectMail(), 'Аккаунт подключён')}>{busy ? 'Ожидаем…' : 'Подключить аккаунт Gmail'}</button>
      </div>
      <div className="settings-card"><h4>Аккаунты</h4>{account ? <div className="settings-mail-account">
        {accounts.length > 1 ? <label className="settings-field">Аккаунт Gmail<select aria-label="Аккаунт Gmail" value={account.id} onChange={event => setAccountId(event.target.value)}>{accounts.map(item => <option key={item.id} value={item.id}>{item.email}</option>)}</select></label> : <strong className="settings-account-email">{account.email}</strong>}
        <small>{account.error || (account.lastSyncedAt ? `Обновлено ${new Date(account.lastSyncedAt).toLocaleString('ru-RU')}` : 'Ещё не обновлялось')}</small>
        <label className="settings-field">Важные отправители · по одному в строке<textarea rows={3} value={account.importantSenders?.join('\n') || ''} onChange={event => { const senders = event.target.value.split('\n').map(value => value.trim()).filter(Boolean); onChange(previous => { const next = { ...previous, mailAccounts: previous.mailAccounts?.map(item => item.id === account.id ? { ...item, importantSenders: senders } : item) }; return { ...next, mailMessages: next.mailMessages?.map(item => item.accountId === account.id ? { ...item, important: mailIsImportant(next, item) } : item) } }) }} /></label>
        <div className="settings-card-actions"><button className="soft-button" disabled={!mailAvailable || busy} onClick={() => perform(() => bridge.integrations!.syncMail(account.id), 'Почта обновлена')}>Обновить</button><button className="soft-button" disabled={!mailAvailable || busy} onClick={() => perform(() => bridge.integrations!.disconnectMail(account.id), 'Аккаунт отключён')}>Отключить</button></div>
      </div> : <p className="settings-empty">Пока нет подключённых аккаунтов.</p>}</div>
    </div> : <NewsSetup state={state} onChange={onChange} onRefresh={onNewsRefresh} refreshing={newsRefreshing} />}
    {status && <p className="settings-status" role="status">{status}</p>}
  </div>
}
