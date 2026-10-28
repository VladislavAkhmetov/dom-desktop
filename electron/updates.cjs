// Release channel: GitHub Releases of this repository. Must match "publish" in electron-builder.json
// (tests/updates.test.ts keeps both in sync).
const RELEASES = Object.freeze({ owner: 'VladislavAkhmetov', repo: 'dom-desktop' })

// electron-updater replaces only NSIS installs. The portable exe is a single self-extracting file
// that cannot replace itself, so it only learns about a newer release and links to its page.
function isPortable(env = process.env) {
  return Boolean(env.PORTABLE_EXECUTABLE_FILE)
}

function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(value || '').trim())
  return match ? { parts: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4] || '' } : null
}

// True when `candidate` is a newer stable release than `current`. Pre-releases are never offered.
function isNewer(candidate, current) {
  const next = parseVersion(candidate), now = parseVersion(current)
  if (!next || !now || next.prerelease) return false
  for (let index = 0; index < 3; index++) {
    if (next.parts[index] !== now.parts[index]) return next.parts[index] > now.parts[index]
  }
  return Boolean(now.prerelease)
}

// Reads the latest published (non-draft) release. The page URL is built from the fixed repository
// and a validated tag — nothing from the response is opened verbatim.
async function latestRelease(fetchText, releases = RELEASES) {
  const text = await fetchText(`https://api.github.com/repos/${releases.owner}/${releases.repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'dombro-updater' } }, 200_000)
  const data = JSON.parse(text)
  const tag = typeof data?.tag_name === 'string' ? data.tag_name : ''
  if (!parseVersion(tag) || data.draft || data.prerelease) return null
  return { version: tag.replace(/^v/, ''), url: `https://github.com/${releases.owner}/${releases.repo}/releases/tag/${encodeURIComponent(tag)}` }
}

function initUpdates({ window, autoUpdater, fetchText, currentVersion, env = process.env, delay = 10_000 }) {
  let releasePage = ''
  const notify = payload => { if (window && !window.isDestroyed()) window.webContents.send('app:update-ready', payload) }
  const timer = setTimeout(() => {
    if (isPortable(env)) {
      latestRelease(fetchText).then(release => {
        if (!release || !isNewer(release.version, currentVersion)) return
        releasePage = release.url
        notify({ version: release.version, manual: true })
      }).catch(() => undefined) // Offline or rate-limited: stay silent (Calm Tech).
      return
    }
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true // Installs quietly when the user quits in the evening.
    autoUpdater.allowPrerelease = false
    autoUpdater.allowDowngrade = false
    autoUpdater.on('update-downloaded', info => notify({ version: info.version, manual: false }))
    autoUpdater.on('error', () => undefined)
    autoUpdater.checkForUpdates().catch(() => undefined)
  }, delay)
  return {
    // Only ever opens the page found by latestRelease(); the renderer cannot pass a URL.
    releasePage: () => releasePage,
    dispose: () => clearTimeout(timer)
  }
}

module.exports = { RELEASES, isPortable, parseVersion, isNewer, latestRelease, initUpdates }
