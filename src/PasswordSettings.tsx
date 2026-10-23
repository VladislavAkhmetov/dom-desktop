import { useEffect, useState } from 'react'
import { Check, Copy, Download, ExternalLink, Eye, EyeOff, KeyRound, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { bridge } from './bridge'
import type { BitwardenExtensionStatus, SavedCredential } from './types'
import { useI18n } from './i18n'

function bitwardenLine(status: BitwardenExtensionStatus | null) {
  if (!status) return 'Проверяю расширение Bitwarden…'
  if (status.loaded && status.worker) return `Расширение Bitwarden ${status.version} загружено во вкладки, его процесс запущен. Подсказку на странице рисует оно. Своего запроса «Сохранить пароль?» у dombro нет.`
  if (status.loaded) return `Файлы Bitwarden ${status.version} прочитаны, но его процесс не запустился. Строки «Сохранить пароль?» не будет.`
  return status.error || 'Расширение Bitwarden не загрузилось. Строки «Сохранить пароль?» не будет.'
}

export function PasswordSettings() {
  const { t } = useI18n()
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
  const [bitwarden, setBitwarden] = useState<BitwardenExtensionStatus | null>(null)

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
    let alive = true
    bridge.bitwardenStatus?.().then(value => { if (alive) setBitwarden(value) }).catch(() => {
      if (alive) setBitwarden({ loaded: false, version: '', worker: false, error: 'статус недоступен' })
    })
    return () => { alive = false }
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

  function handleExportCsv() {
    if (!credentials.length) return
    const header = 'name,url,username,password\n'
    const rows = credentials.map(c => {
      const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
      return `${escape(c.title || c.origin)},${escape(c.origin)},${escape(c.username)},${escape(c.password)}`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dombro-passwords-bitwarden-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function openBitwarden() {
    try {
      window.open('bitwarden://', '_blank')
    } catch {
      window.open('https://bitwarden.com/download/', '_blank')
    }
  }

  return (
    <div className="settings-columns">
      {/* Рекомендуемый безопасный менеджер: Bitwarden в 1-2 касания */}
      <div className="settings-card" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, rgba(23,93,220,0.06), rgba(40,167,69,0.04))', border: '1px solid rgba(23,93,220,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#175ddc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 16 }}>Менеджер паролей: Bitwarden</h4>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                Пароль остаётся в Bitwarden. dombro поле пароля не читает и не сохраняет.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="soft-button" type="button" onClick={handleExportCsv} disabled={!credentials.length} title="Экспорт существующих паролей в Bitwarden CSV">
              <Download size={14} style={{ marginRight: 5 }} />
              Экспорт в Bitwarden CSV
            </button>
            <button className="calm-primary" type="button" onClick={openBitwarden}>
              <ExternalLink size={14} style={{ marginRight: 5 }} />
              Открыть Bitwarden
            </button>
          </div>
        </div>

        <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.45 }}>{bitwardenLine(bitwarden)}</p>
      </div>

      <div className="settings-card settings-collection-card">
        <div className="settings-card-heading">
          <h4>{t('settings.passwords.title')} (Резерв)</h4>
          <button
            className="soft-button"
            type="button"
            onClick={() => setImportOpen(prev => !prev)}
            title="Импорт из Chrome/Safari/1Password"
          >
            <Upload size={14} style={{ marginRight: 5 }} />
            {t('settings.passwords.import_btn')}
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
              <button className="soft-button" type="button" onClick={() => setImportOpen(false)}>{t('common.cancel')}</button>
              <button className="calm-primary" type="button" onClick={handleImport} disabled={!importCsv.trim()}>{t('settings.passwords.import_btn')}</button>
            </div>
          </div>
        )}

        <div className="settings-list" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
          {loading ? (
            <p className="settings-empty">{t('common.loading')}</p>
          ) : credentials.length === 0 ? (
            <p className="settings-empty">{t('settings.passwords.empty')}</p>
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
        <h4>{t('settings.passwords.add_title')}</h4>
        <form className="form-stack" onSubmit={handleAdd}>
          <label>
            {t('settings.passwords.origin')}
            <input
              placeholder={t('settings.passwords.origin_placeholder')}
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              required
            />
          </label>
          <label>
            {t('settings.passwords.username')}
            <input
              placeholder="name@domain.com"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            {t('settings.passwords.password')}
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </label>
          <label>
            {t('settings.passwords.note')}
            <input
              placeholder="GitHub"
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
            {t('settings.passwords.save_btn')}
          </button>
        </form>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(100,143,125,0.15)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <ShieldCheck size={20} color="#486955" style={{ flex: 'none', marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
            Пароли в этом списке шифруются средствами ОС. Со страницы они сюда не попадают. Автозаполнение с сайта в этой сборке не работает.
          </p>
        </div>
      </div>
    </div>
  )
}
