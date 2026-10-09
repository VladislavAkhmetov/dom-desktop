import { useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { bridge } from './bridge'
import type { SavedCredential } from './types'

export function PasswordSettings() {
  const [credentials, setCredentials] = useState<SavedCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [origin, setOrigin] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [title, setTitle] = useState('')
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importCsv, setImportCsv] = useState('')
  const [importStatus, setImportStatus] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      if (bridge.vault) {
        const list = await bridge.vault.listCredentials()
        setCredentials(list)
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    if (!origin.trim() || !username.trim() || !password.trim() || !bridge.vault) return
    try {
      await bridge.vault.saveCredential({
        origin: origin.trim(),
        username: username.trim(),
        password: password.trim(),
        title: title.trim() || undefined
      })
      setOrigin('')
      setUsername('')
      setPassword('')
      setTitle('')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось сохранить пароль')
    }
  }

  async function handleRemove(id: string) {
    if (!bridge.vault) return
    try {
      await bridge.vault.removeCredential(id)
      await load()
    } catch {}
  }

  async function handleCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  async function handleImport() {
    if (!importCsv.trim() || !bridge.vault) return
    try {
      const count = await bridge.vault.importCredentials(importCsv)
      setImportStatus(`Успешно импортировано записей: ${count}`)
      setImportCsv('')
      await load()
      setTimeout(() => {
        setImportOpen(false)
        setImportStatus(null)
      }, 2500)
    } catch (e) {
      setImportStatus(e instanceof Error ? e.message : 'Ошибка разбора CSV')
    }
  }

  return (
    <div className="settings-columns">
      <div className="settings-card settings-collection-card">
        <div className="settings-card-heading">
          <h4>Сохранённые пароли</h4>
          <button
            className="soft-button"
            type="button"
            onClick={() => setImportOpen(prev => !prev)}
            title="Импорт из Chrome/Safari/1Password"
          >
            <Upload size={14} style={{ marginRight: 5 }} />
            Импорт CSV
          </button>
        </div>

        {importOpen && (
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.7)', borderRadius: 14, marginBottom: 14, border: '1px solid rgba(100,143,125,0.25)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Импорт паролей из CSV
            </span>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
              Вставьте содержимое экспорта паролей (формат Chrome: <code>name,url,username,password</code>).
            </p>
            <textarea
              rows={4}
              value={importCsv}
              onChange={e => setImportCsv(e.target.value)}
              placeholder="url,username,password..."
              style={{ width: '100%', font: 'inherit', fontSize: 12, padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#fff', boxSizing: 'border-box' }}
            />
            {importStatus && <p style={{ fontSize: 12, color: '#386348', margin: '6px 0' }}>{importStatus}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="soft-button" type="button" onClick={() => setImportOpen(false)}>Отмена</button>
              <button className="calm-primary" type="button" onClick={handleImport} disabled={!importCsv.trim()}>Импортировать</button>
            </div>
          </div>
        )}

        <div className="settings-list" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
          {loading ? (
            <p className="settings-empty">Загрузка ключей…</p>
          ) : credentials.length === 0 ? (
            <p className="settings-empty">Пока нет сохранённых паролей.</p>
          ) : (
            credentials.map(item => {
              const show = Boolean(visiblePasswords[item.id])
              const isCopied = copiedId === item.id
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(100,143,125,0.15)'
                  }}
                >
                  <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1, marginRight: 8 }}>
                    <strong style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title || item.origin}
                    </strong>
                    <small style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.username} · {show ? item.password : '••••••••'}
                    </small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
                    <button
                      className="calm-icon"
                      type="button"
                      onClick={() => setVisiblePasswords(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                      title={show ? 'Скрыть пароль' : 'Показать пароль'}
                      aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      className="calm-icon"
                      type="button"
                      onClick={() => handleCopy(item.id, item.password)}
                      title={isCopied ? 'Скопировано!' : 'Скопировать пароль'}
                      aria-label={isCopied ? 'Скопировано' : 'Скопировать пароль'}
                    >
                      {isCopied ? <Check size={15} color="#2e6c49" /> : <Copy size={15} />}
                    </button>
                    <button
                      className="calm-icon"
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      title="Удалить запись"
                      aria-label={`Удалить пароль для ${item.origin}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="settings-card">
        <h4>Добавить пароль вручную</h4>
        <form className="form-stack" onSubmit={handleAdd}>
          <label>
            Адрес или домен сайта
            <input
              placeholder="https://github.com"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              required
            />
          </label>
          <label>
            Логин или эл. почта
            <input
              placeholder="name@domain.com"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Название (необязательно)
            <input
              placeholder="Например: GitHub"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </label>
          <button
            className="soft-button"
            type="submit"
            disabled={!origin.trim() || !username.trim() || !password.trim()}
          >
            <Plus size={15} />
            Сохранить в хранилище
          </button>
        </form>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(100,143,125,0.15)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <ShieldCheck size={20} color="#486955" style={{ flex: 'none', marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
            Пароли шифруются криптографией вашей операционной системы (DPAPI на Windows, Apple Keychain на Mac). Они никогда не отправляются на удалённые серверы.
          </p>
        </div>
      </div>
    </div>
  )
}
