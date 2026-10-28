const fs = require('node:fs')
const path = require('node:path')

/*
 * Local files and programs dombro may open or read. A path gets here only through the main process:
 * the OS file picker (resource:pick), the Windows «Recent» list, the open-windows list, the
 * Ctrl+Shift+S shortcut, or the one-time adoption of resources that existed before this list.
 * The renderer can write any path into app state (state:apply), so state alone is not trusted.
 * Kept in its own file in userData — not reachable through state:apply.
 */
class ApprovedPaths {
  constructor(directory, platform = process.platform) {
    this.file = path.join(directory, 'approved-paths.json')
    this.platform = platform
    let data = {}
    try { data = JSON.parse(fs.readFileSync(this.file, 'utf8')) } catch { /* first run or unreadable: start empty */ }
    this.migrated = data.migrated === true
    this.paths = new Set(Array.isArray(data.paths) ? data.paths.filter(item => typeof item === 'string') : [])
  }
  key(value) {
    if (typeof value !== 'string' || !value || value.length > 4096 || !path.isAbsolute(value)) return ''
    const resolved = path.resolve(value)
    return this.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  has(value) {
    const key = this.key(value)
    return Boolean(key) && this.paths.has(key)
  }
  approve(...values) {
    let changed = false
    for (const value of values.flat()) {
      const key = this.key(value)
      if (key && !this.paths.has(key)) { this.paths.add(key); changed = true }
    }
    if (changed) this.save()
  }
  // Resources saved before this list existed were added by the user; adopt them once.
  adopt(state) {
    if (this.migrated) return
    const targets = (state?.spaces || []).flatMap(space => space.resources || []).filter(item => ['file', 'app', 'window'].includes(item.kind)).map(item => item.target)
    this.migrated = true
    this.approve(targets)
    this.save()
  }
  save() {
    const temporary = `${this.file}.tmp`
    fs.writeFileSync(temporary, JSON.stringify({ migrated: this.migrated, paths: [...this.paths] }), { mode: 0o600 })
    fs.renameSync(temporary, this.file)
  }
}

module.exports = { ApprovedPaths }
