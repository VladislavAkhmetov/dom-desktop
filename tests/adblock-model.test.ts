import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { AdblockManager } from '../electron/adblock.cjs'

describe('AdblockManager', () => {
  const tmpDir = path.join(os.tmpdir(), `dom-adblock-test-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  it('инициализирует настройки по умолчанию', () => {
    const mgr = new AdblockManager({ userDataPath: tmpDir })
    expect(mgr.settings.enabled).toBe(true)
    expect(mgr.settings.blockCookies).toBe(true)
    expect(mgr.settings.whitelist).toEqual([])
    expect(mgr.settings.darkSites).toEqual([])
  })

  it('корректно нормализует хосты из URL', () => {
    const mgr = new AdblockManager({ userDataPath: tmpDir })
    expect(mgr.normalizeHost('https://Habr.com/ru/articles/123')).toBe('habr.com')
    expect(mgr.normalizeHost('http://Sub.Example.ORG:8080/path')).toBe('sub.example.org')
    expect(mgr.normalizeHost('GITHUB.COM')).toBe('github.com')
  })

  it('управляет белым списком доменов и поддоменов', () => {
    const mgr = new AdblockManager({ userDataPath: tmpDir })
    expect(mgr.isSiteDisabled('habr.com')).toBe(false)

    // Добавляем в белый список
    mgr.toggleSite('habr.com', true)
    expect(mgr.isSiteDisabled('habr.com')).toBe(true)
    expect(mgr.isSiteDisabled('sub.habr.com')).toBe(true)
    expect(mgr.isSiteDisabled('other.com')).toBe(false)

    // Убираем из белого списка
    mgr.toggleSite('habr.com', false)
    expect(mgr.isSiteDisabled('habr.com')).toBe(false)
  })

  it('управляет списком сайтов с принудительной тёмной темой', () => {
    const mgr = new AdblockManager({ userDataPath: tmpDir })
    expect(mgr.isDarkSite('news.ycombinator.com')).toBe(false)

    mgr.toggleDarkSite('news.ycombinator.com', true)
    expect(mgr.isDarkSite('news.ycombinator.com')).toBe(true)

    mgr.toggleDarkSite('news.ycombinator.com', false)
    expect(mgr.isDarkSite('news.ycombinator.com')).toBe(false)
  })

  it('сбрасывает и возвращает статистику заблокированных элементов по вкладкам', () => {
    const mgr = new AdblockManager({ userDataPath: tmpDir })
    mgr.tabStats.set('tab-1', 5)
    expect(mgr.getTabStats('tab-1')).toBe(5)

    mgr.resetTabStats('tab-1')
    expect(mgr.getTabStats('tab-1')).toBe(0)
  })

  it('формирует статус для UI без исключений', () => {
    const mgr = new AdblockManager({ userDataPath: tmpDir })
    mgr.tabStats.set('tab-2', 12)
    const status = mgr.getStatus('tab-2', 'https://example.com')
    expect(status).toEqual({
      enabled: true,
      siteDisabled: false,
      blockedCount: 12,
      blockCookies: true,
      isDark: false
    })
  })
})
