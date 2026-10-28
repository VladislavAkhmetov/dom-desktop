const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

function siteHost(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(text) ? text : `https://${text}`).hostname.replace(/^www\./, '') } catch { return '' }
}

function summary({ password: _password, ...rest }) {
  return rest
}

class Vault {
  constructor(directory, encryption) {
    this.file = path.join(directory, 'secrets.encrypted.json')
    this.encryption = encryption
    this.data = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {}
  }
  available() {
    return this.encryption.isEncryptionAvailable() && this.encryption.getSelectedStorageBackend?.() !== 'basic_text'
  }
  get(id) {
    if (!this.data[id]) return undefined
    if (!this.available()) throw new Error('Хранилище ключей ОС недоступно')
    return JSON.parse(this.encryption.decryptString(Buffer.from(this.data[id], 'base64')))
  }
  set(id, value) {
    if (!this.available()) throw new Error('Хранилище ключей ОС недоступно. Ключ не сохранён.')
    const next = { ...this.data }
    if (value === undefined) delete next[id]
    else next[id] = this.encryption.encryptString(JSON.stringify(value)).toString('base64')
    const temporary = this.file + '.tmp'
    fs.writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 })
    fs.renameSync(temporary, this.file)
    this.data = next
  }

  // Full records, passwords included — main process only. Never return this over IPC.
  getCredentials() {
    return this.get('credentials:list') || []
  }

  // What the interface may see: no passwords. With a page address/host, only that exact site
  // (www. ignored) — `a.com` never lists credentials saved for `data.com`.
  summaries(site) {
    const host = site ? siteHost(site) : ''
    if (site && !host) return []
    return this.getCredentials().filter(item => !host || siteHost(item.origin) === host).map(summary)
  }

  // One password for an explicit user action (show / copy in settings).
  revealPassword(id) {
    const item = this.getCredentials().find(entry => entry.id === id)
    if (!item) throw new Error('Пароль не найден')
    return item.password
  }

  // Autofill target check lives here, next to the secret: the record must belong to the page's site.
  credentialFor(id, pageUrl) {
    const item = this.getCredentials().find(entry => entry.id === id)
    const host = siteHost(pageUrl)
    return item && host && siteHost(item.origin) === host ? item : null
  }

  exportCsv() {
    const escape = value => `"${String(value || '').replace(/"/g, '""')}"`
    return 'name,url,username,password\n' + this.getCredentials().map(item => [item.title || item.origin, item.origin, item.username, item.password].map(escape).join(',')).join('\n')
  }

  saveCredential(cred) {
    if (!cred || !cred.origin || !cred.username || !cred.password) throw new Error('Некорректные данные пароля')
    const list = this.get('credentials:list') || []
    const id = cred.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const entry = {
      id,
      origin: cred.origin.trim(),
      username: cred.username.trim(),
      password: String(cred.password),
      title: (cred.title || cred.origin).trim(),
      updatedAt: now
    }
    const existingIndex = list.findIndex(item => item.id === id || (item.origin.toLowerCase() === entry.origin.toLowerCase() && item.username.toLowerCase() === entry.username.toLowerCase()))
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...entry, id: list[existingIndex].id }
    } else {
      list.push(entry)
    }
    this.set('credentials:list', list)
    return summary(entry)
  }

  removeCredential(id) {
    const list = this.get('credentials:list') || []
    const next = list.filter(item => item.id !== id)
    this.set('credentials:list', next)
    return true
  }

  importCredentialsCsv(csvContent) {
    if (!csvContent || typeof csvContent !== 'string') return 0
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim())
    if (!lines.length) return 0
    let count = 0
    const first = lines[0].toLowerCase()
    const startIndex = (first.includes('url') || first.includes('username') || first.includes('password')) ? 1 : 0
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
      if (parts.length >= 3) {
        let title, origin, username, password
        if (parts.length >= 4) {
          title = parts[0]
          origin = parts[1]
          username = parts[2]
          password = parts[3]
        } else {
          origin = parts[0]
          username = parts[1]
          password = parts[2]
          title = origin
        }
        if (origin && username && password) {
          try {
            this.saveCredential({ origin, username, password, title })
            count++
          } catch {}
        }
      }
    }
    return count
  }
}

module.exports = { Vault, siteHost }
