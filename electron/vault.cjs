const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

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

  getCredentials(originFilter) {
    const list = this.get('credentials:list') || []
    if (!originFilter) return list
    const norm = originFilter.trim().toLowerCase()
    return list.filter(item => item.origin.toLowerCase().includes(norm) || (item.title && item.title.toLowerCase().includes(norm)))
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
    return entry
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

module.exports = { Vault }
