// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const require = createRequire(import.meta.url)
const { Vault } = require('../electron/vault.cjs')

describe('хранилище паролей Vault', () => {
  const mockEncryption = () => {
    return {
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => 'dpapi',
      encryptString: (str: string) => Buffer.from(`enc:${str}`),
      decryptString: (buf: Buffer) => buf.toString().replace(/^enc:/, '')
    }
  }

  it('сохраняет, получает и фильтрует пароли по источнику', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-vault-test-'))
    try {
      const vault = new Vault(tmp, mockEncryption())
      vault.saveCredential({
        origin: 'https://github.com',
        username: 'designer',
        password: 'secretPassword123',
        title: 'GitHub'
      })

      const all = vault.getCredentials()
      expect(all).toHaveLength(1)
      expect(all[0].origin).toBe('https://github.com')
      expect(all[0].username).toBe('designer')
      expect(all[0].password).toBe('secretPassword123')

      // The interface sees summaries for the exact site only, never the password.
      expect(vault.summaries('https://github.com/login')).toEqual([expect.not.objectContaining({ password: expect.anything() })])
      expect(vault.summaries('www.github.com')).toHaveLength(1)
      expect(vault.summaries('google.com')).toHaveLength(0)
      expect(vault.summaries('evilgithub.com')).toHaveLength(0)
      expect(vault.summaries('hub.com')).toHaveLength(0)
      expect(vault.summaries()[0]).not.toHaveProperty('password')
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('обновляет существующую запись для того же логина и домена', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-vault-test-'))
    try {
      const vault = new Vault(tmp, mockEncryption())
      vault.saveCredential({ origin: 'https://figma.com', username: 'user@test.ru', password: 'old' })
      vault.saveCredential({ origin: 'https://figma.com', username: 'user@test.ru', password: 'new' })

      const list = vault.summaries('figma.com')
      expect(list).toHaveLength(1)
      expect(vault.revealPassword(list[0].id)).toBe('new')
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('удаляет запись по идентификатору', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-vault-test-'))
    try {
      const vault = new Vault(tmp, mockEncryption())
      const saved = vault.saveCredential({ origin: 'https://test.ru', username: 'u', password: 'p' })
      expect(vault.getCredentials()).toHaveLength(1)

      vault.removeCredential(saved.id)
      expect(vault.getCredentials()).toHaveLength(0)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('импортирует пароли из CSV (формат Chrome)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-vault-test-'))
    try {
      const vault = new Vault(tmp, mockEncryption())
      const csv = `name,url,username,password
GitHub,https://github.com,alex,pass1
Figma,https://figma.com,designer,pass2`

      const count = vault.importCredentialsCsv(csv)
      expect(count).toBe(2)
      expect(vault.getCredentials()).toHaveLength(2)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('поддерживает сохранение и поиск паролей через веб-мост bridge.vault', async () => {
    const { bridge } = await import('../src/bridge')
    expect(bridge.vault).toBeDefined()
    if (bridge.vault) {
      await bridge.vault.saveCredential({
        origin: 'https://linear.app',
        username: 'dev@studio.design',
        password: 'linearPassword!',
        title: 'Linear'
      })

      expect(await bridge.vault.listCredentials('linear')).toHaveLength(0)
      const list = await bridge.vault.listCredentials('https://linear.app/team')
      const found = list.find(item => item.origin === 'https://linear.app')
      expect(found).toBeDefined()
      expect(found?.username).toBe('dev@studio.design')
      expect(found).not.toHaveProperty('password')
      expect(await bridge.vault.revealPassword(found!.id)).toBe('linearPassword!')

      await bridge.vault.removeCredential(found!.id)
      const after = await bridge.vault.listCredentials('linear.app')
      expect(after.find(item => item.id === found!.id)).toBeUndefined()
    }
  })

  it('отдаёт пароль для автозаполнения только своему сайту и экспортирует CSV в главном процессе', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-vault-test-'))
    try {
      const vault = new Vault(tmp, mockEncryption())
      const saved = vault.saveCredential({ origin: 'https://bank.ru', username: 'me', password: 'p"1', title: 'Банк' })
      expect(saved).not.toHaveProperty('password')
      expect(vault.credentialFor(saved.id, 'https://bank.ru/login')?.password).toBe('p"1')
      expect(vault.credentialFor(saved.id, 'https://www.bank.ru/')?.password).toBe('p"1')
      expect(vault.credentialFor(saved.id, 'https://bank.ru.evil.io/')).toBeNull()
      expect(vault.credentialFor(saved.id, 'https://mybank.ru/')).toBeNull()
      expect(vault.credentialFor('missing', 'https://bank.ru/')).toBeNull()
      expect(vault.exportCsv()).toBe('name,url,username,password\n"Банк","https://bank.ru","me","p""1"')
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
})
