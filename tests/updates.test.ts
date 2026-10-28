import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { RELEASES, isPortable, isNewer, latestRelease, initUpdates } = require('../electron/updates.cjs')

describe('канал обновлений', () => {
  it('совпадает с publish в electron-builder.json', () => {
    const config = JSON.parse(readFileSync(new URL('../electron-builder.json', import.meta.url), 'utf8'))
    expect(config.publish[0]).toMatchObject({ provider: 'github', owner: RELEASES.owner, repo: RELEASES.repo, releaseType: 'draft' })
    expect(config.electronFuses).toMatchObject({ runAsNode: false, enableNodeOptionsEnvironmentVariable: false, enableNodeCliInspectArguments: false, onlyLoadAppFromAsar: true })
  })

  it('сравнивает версии и не предлагает пре-релизы', () => {
    expect(isNewer('0.0.2', '0.0.1')).toBe(true)
    expect(isNewer('v0.1.0', '0.0.9')).toBe(true)
    expect(isNewer('0.0.1', '0.0.1')).toBe(false)
    expect(isNewer('0.0.1', '0.0.2')).toBe(false)
    expect(isNewer('0.0.3-beta.1', '0.0.2')).toBe(false)
    expect(isNewer('0.0.2', '0.0.2-beta.1')).toBe(true)
    expect(isNewer('latest', '0.0.1')).toBe(false)
  })

  it('строит адрес страницы выпуска из своего репозитория, а не из ответа', async () => {
    const fetchText = vi.fn(async () => JSON.stringify({ tag_name: 'v0.0.5', html_url: 'https://evil.example/', draft: false, prerelease: false }))
    await expect(latestRelease(fetchText)).resolves.toEqual({ version: '0.0.5', url: `https://github.com/${RELEASES.owner}/${RELEASES.repo}/releases/tag/v0.0.5` })
    expect(fetchText.mock.calls[0][0]).toBe(`https://api.github.com/repos/${RELEASES.owner}/${RELEASES.repo}/releases/latest`)
    await expect(latestRelease(async () => JSON.stringify({ tag_name: '../../x' }))).resolves.toBeNull()
  })

  it('portable только сообщает о новой версии, установщик качает через electron-updater', async () => {
    vi.useFakeTimers()
    try {
      const send = vi.fn()
      const window = { isDestroyed: () => false, webContents: { send } }
      const autoUpdater = { on: vi.fn(), checkForUpdates: vi.fn(async () => undefined) }
      const portable = initUpdates({ window, autoUpdater, currentVersion: '0.0.1', env: { PORTABLE_EXECUTABLE_FILE: 'C:/dombro.exe' }, delay: 10, fetchText: async () => JSON.stringify({ tag_name: 'v0.0.2' }) })
      await vi.advanceTimersByTimeAsync(20)
      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
      expect(send).toHaveBeenCalledWith('app:update-ready', { version: '0.0.2', manual: true })
      expect(portable.releasePage()).toContain('/releases/tag/v0.0.2')

      const installed = initUpdates({ window, autoUpdater, currentVersion: '0.0.1', env: {}, delay: 10, fetchText: vi.fn() })
      await vi.advanceTimersByTimeAsync(20)
      expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce()
      expect(installed.releasePage()).toBe('')
      expect(isPortable({})).toBe(false)
    } finally { vi.useRealTimers() }
  })
})
