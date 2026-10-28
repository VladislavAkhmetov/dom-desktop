const { parentPort, workerData } = require('node:worker_threads')
const fs = require('node:fs')
const path = require('node:path')
const Database = require('better-sqlite3')

async function start() {
  const { emptyState, migrateState, applyChanges } = await import('../shared/state.js')
  fs.mkdirSync(workerData.directory, { recursive: true })
  const db = new Database(path.join(workerData.directory, 'dom.sqlite'))
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.exec('CREATE TABLE IF NOT EXISTS globals (key TEXT PRIMARY KEY, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS entities (collection TEXT NOT NULL, id TEXT NOT NULL, ordinal INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(collection,id)); CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(id UNINDEXED, spaceId UNINDEXED, title, target, text, tokenize="unicode61");')
  const entityCollections = new Set(['spaces', 'reminders', 'events', 'calendarSubscriptions', 'morningTabs', 'inboxMessages', 'newsItems', 'mailAccounts', 'mailMessages', 'feedSources', 'newsEditions', 'aiJournal', 'history'])
  const upsert = db.prepare('INSERT INTO entities VALUES (?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET ordinal=excluded.ordinal,payload=excluded.payload WHERE ordinal!=excluded.ordinal OR payload!=excluded.payload')
  const updateOrdinal = db.prepare('UPDATE entities SET ordinal=? WHERE collection=? AND id=? AND ordinal!=?')
  const deleteEntity = db.prepare('DELETE FROM entities WHERE collection=? AND id=?')
  const putGlobal = db.prepare('INSERT INTO globals VALUES (?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload WHERE payload!=excluded.payload')
  // What each change touched: whole collection, single entities ('@id'), or only the order.
  function plan(changes) {
    const touched = new Map()
    for (const change of changes) {
      const [key, entity] = change.path
      if (!entityCollections.has(key)) continue
      let entry = touched.get(key)
      if (!entry) touched.set(key, entry = { full: false, ids: new Set(), order: false })
      if (change.path.length === 1) { if (change.op === 'order') entry.order = true; else entry.full = true }
      else if (typeof entity === 'string' && entity.startsWith('@')) {
        entry.ids.add(entity.slice(1))
        if (change.path.length === 2) entry.order = true // insert / replace / remove shifts positions
      } else entry.full = true
    }
    return touched
  }
  function writeCollection(key, value) {
    const ids = new Set(value.map(item => item.id))
    for (const row of db.prepare('SELECT id FROM entities WHERE collection=?').all(key)) if (!ids.has(row.id)) deleteEntity.run(key, row.id)
    value.forEach((item, index) => upsert.run(key, item.id, index, JSON.stringify(item)))
  }
  const write = db.transaction((state, changes) => {
    const roots = changes ? new Set(changes.map(change => change.path[0])) : null
    const touched = changes ? plan(changes) : new Map()
    if (roots) for (const key of roots) if (entityCollections.has(key) && !(key in state)) db.prepare('DELETE FROM entities WHERE collection=?').run(key)
    for (const [key, value] of Object.entries(state)) {
      if (roots && !roots.has(key) && key !== 'revision') continue
      if (entityCollections.has(key)) {
        const entry = touched.get(key)
        if (!changes || !entry || entry.full) { writeCollection(key, value); continue }
        // Only the entities named in the changes are serialised; the rest keep their rows.
        const index = new Map(value.map((item, position) => [item.id, position]))
        for (const id of entry.ids) {
          const position = index.get(id)
          if (position === undefined) deleteEntity.run(key, id)
          else upsert.run(key, id, position, JSON.stringify(value[position]))
        }
        if (entry.order) value.forEach((item, position) => updateOrdinal.run(position, key, item.id, position))
      } else putGlobal.run(key, JSON.stringify(value))
    }
    for (const row of db.prepare('SELECT key FROM globals').all()) if (!(row.key in state)) db.prepare('DELETE FROM globals WHERE key=?').run(row.key)
  })
  // Full-text index: rebuilt in one batch shortly after the last searchable change (and on startup),
  // not inside every write. A search request flushes a pending rebuild first.
  let searchTimer = null
  let searchDirty = false
  const rebuildSearch = db.transaction(state => {
    db.prepare('DELETE FROM search').run()
    const insert = db.prepare('INSERT INTO search VALUES (?,?,?,?,?)')
    for (const space of state.spaces) {
      insert.run(space.id, space.id, space.name, '', space.checkpoint?.nextStep || '')
      for (const resource of space.resources) insert.run(resource.id, space.id, resource.name, resource.target, resource.text || '')
      for (const tab of space.activeSession?.tabs || []) insert.run(tab.id, space.id, tab.title, tab.url, '')
    }
    for (const item of state.reminders) insert.run(item.id, item.spaceId || '', item.title, '', '')
  })
  function flushSearch() {
    clearTimeout(searchTimer)
    searchTimer = null
    if (!searchDirty) return
    searchDirty = false
    rebuildSearch(cache)
  }
  function scheduleSearch(changes) {
    // Scrolling and notification metadata do not change what search finds.
    const searchable = changes.some(change => ['spaces', 'reminders'].includes(change.path[0]) && !['scrollY', 'protected', 'error', 'favicon', 'lastAccessedAt', 'savedAt', 'notifiedAt', 'done'].includes(change.path.at(-1)))
    if (!searchable) return
    searchDirty = true
    clearTimeout(searchTimer)
    searchTimer = setTimeout(flushSearch, 400)
  }
  function read() {
    const state = Object.fromEntries(db.prepare('SELECT * FROM globals').all().map(row => [row.key, JSON.parse(row.payload)]))
    for (const key of entityCollections) {
      const rows = db.prepare('SELECT payload FROM entities WHERE collection=? ORDER BY ordinal').all(key)
      if (rows.length || key === 'spaces' || key === 'reminders') state[key] = rows.map(row => JSON.parse(row.payload))
    }
    return state
  }
  if (!db.prepare('SELECT 1 FROM globals WHERE key=?').get('version')) {
    const legacy = path.join(workerData.directory, 'state.json')
    if (fs.existsSync(legacy)) {
      fs.copyFileSync(legacy, `${legacy}.before-sqlite`)
      write(migrateState(JSON.parse(fs.readFileSync(legacy, 'utf8'))))
    } else write(emptyState())
  }
  // Recoverable backups are refreshed on startup, without replacing the legacy file.
  await db.backup(path.join(workerData.directory, 'dom.previous.sqlite'))
  // The worker is the only writer, so the state stays in memory instead of being re-read per change.
  let cache = read()
  searchDirty = true
  flushSearch()
  parentPort.on('message', async ({ id, action, changes, query }) => {
    try {
      let result
      if (action === 'get') result = cache
      else if (action === 'apply') { result = applyChanges(cache, changes); write(result, changes); cache = result; scheduleSearch(changes) }
      else if (action === 'search') {
        flushSearch()
        const words = String(query || '').match(/[\p{L}\p{N}]+/gu) || []
        result = words.length ? db.prepare('SELECT id,spaceId,title,target FROM search WHERE search MATCH ? ORDER BY rank LIMIT 50').all(words.map(word => `"${word}"*`).join(' AND ')) : []
      } else if (action === 'backup') { flushSearch(); await db.backup(path.join(workerData.directory, 'dom.manual.sqlite')); result = true }
      else throw new Error('Неизвестная операция хранения')
      parentPort.postMessage({ id, result })
    } catch (error) { parentPort.postMessage({ id, error: error.message }) }
  })
  parentPort.postMessage({ ready: true })
}
start().catch(error => { parentPort.postMessage({ fatal: error.message }); process.exitCode = 1 })
