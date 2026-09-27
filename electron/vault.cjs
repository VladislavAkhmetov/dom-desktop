const fs = require('node:fs')
const path = require('node:path')

class Vault {
  constructor(directory, encryption) { this.file = path.join(directory, 'secrets.encrypted.json'); this.encryption = encryption; this.data = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {} }
  available() { return this.encryption.isEncryptionAvailable() && this.encryption.getSelectedStorageBackend?.() !== 'basic_text' }
  get(id) { if (!this.data[id]) return undefined; if (!this.available()) throw new Error('Хранилище ключей ОС недоступно'); return JSON.parse(this.encryption.decryptString(Buffer.from(this.data[id], 'base64'))) }
  set(id, value) {
    if (!this.available()) throw new Error('Хранилище ключей ОС недоступно. Ключ не сохранён.')
    const next = { ...this.data }
    if (value === undefined) delete next[id]
    else next[id] = this.encryption.encryptString(JSON.stringify(value)).toString('base64')
    const temporary = this.file + '.tmp'
    fs.writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 }); fs.renameSync(temporary, this.file); this.data = next
  }
}
module.exports = { Vault }
