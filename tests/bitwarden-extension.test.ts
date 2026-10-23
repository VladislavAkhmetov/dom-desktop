import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { bitwardenExtensionStatus, PIN } from '../electron/bitwarden-extension.cjs'

describe('закреплённое расширение Bitwarden', () => {
  it('помнит официальный архив, который не запускается в Electron', () => {
    expect(PIN.version).toBe('2026.10.0')
    expect(PIN.sha256).toBe('7b9ec650b87dd8975e87a0e0bdd0c1f1a0fcf5b0a8da5ae759ec14cdffaad35d')
    expect(PIN.url).toBe('https://github.com/bitwarden/clients/releases/download/browser-v2026.10.0/dist-chrome-2026.10.0.zip')
    const status = bitwardenExtensionStatus()
    expect(status.loaded).toBe(false)
    expect(status.worker).toBe(false)
    expect(status.error).toContain('webNavigation')
  })

  it('не загружает сырое расширение и валидирует происхождение при сохранении пароля', () => {
    const main = readFileSync(path.join(process.cwd(), 'electron', 'main.cjs'), 'utf8')
    const browser = readFileSync(path.join(process.cwd(), 'electron', 'browser.cjs'), 'utf8')
    const preload = readFileSync(path.join(process.cwd(), 'electron', 'page-preload.cjs'), 'utf8')
    expect(main).not.toContain('loadExtension')
    expect(browser).toContain('pagePasswordSubmit')
    expect(browser).toContain('pageOrigin')
    expect(preload).toContain('page:password-submit')
    expect(preload).toContain('page:autofill')
  })
})
