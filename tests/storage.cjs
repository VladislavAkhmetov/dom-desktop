const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createStorage } = require('../electron/storage.cjs')

async function run() {
  const directory = path.resolve(__dirname, '../.cache/storage-tests', String(Date.now()))
  fs.mkdirSync(directory, { recursive: true })
  const legacy = { version: 1, spaces: [{ id: 's', name: 'Работа', tone: 'sage', resources: [] }], reminders: [{ id: 'r', title: 'Заказ', createdAt: '2026-09-26T12:00:00Z', dueAt: '2026-09-27T12:00:00Z', done: false, notifiedAt: '2026-09-27T12:00:00Z' }], dismissedUntil: null }
  fs.writeFileSync(path.join(directory, 'state.json'), JSON.stringify(legacy))
  let storage = createStorage(directory)
  try {
    await storage.ready
    const state = await storage.get()
    assert.equal(state.version, 2)
    assert.equal(state.reminders[0].notifiedAt, legacy.reminders[0].notifiedAt)
    assert.ok(fs.existsSync(path.join(directory, 'state.json.before-sqlite')))
    await Promise.all([
      storage.apply([{ op: 'set', path: ['reminders', '@r', 'title'], value: 'Изменено' }]),
      storage.apply([{ op: 'set', path: ['spaces', '@s', 'name'], value: 'Проект' }])
    ])
    const saved = await storage.get()
    assert.equal(saved.reminders[0].title, 'Изменено')
    assert.equal(saved.spaces[0].name, 'Проект')
    assert.equal(saved.reminders[0].notifiedAt, legacy.reminders[0].notifiedAt)
    assert.equal((await storage.search('Измен'))[0].id, 'r')
    await storage.apply([{ op: 'set', path: ['spaces', '@s', 'resources'], value: [{ id: 'large', kind: 'link', name: 'Большой материал', target: 'https://example.org', text: 'а'.repeat(2_100_000), createdAt: new Date().toISOString() }] }])
    // Partial writes: insert, remove and reorder single entities, then check the order after a restart.
    const reminder = id => ({ id, title: id, createdAt: '2026-09-26T12:00:00Z', dueAt: null, done: false })
    await storage.apply([{ op: 'set', path: ['reminders', '@a'], value: reminder('a') }, { op: 'set', path: ['reminders', '@b'], value: reminder('b') }])
    await storage.apply([{ op: 'remove', path: ['reminders', '@r'] }])
    await storage.apply([{ op: 'set', path: ['reminders', '@c'], value: reminder('c') }])
    await storage.apply([{ op: 'order', path: ['reminders'], value: ['c', 'a', 'b'] }])
    await storage.apply([{ op: 'set', path: ['reminders', '@a', 'title'], value: 'А' }])
    assert.equal((await storage.search('Измен')).length, 0)
    await storage.backup()
  } finally { await storage.close() }
  storage = createStorage(directory)
  try {
    await storage.ready
    const reopened = await storage.get()
    assert.equal(reopened.spaces[0].resources[0].text.length, 2_100_000)
    assert.deepEqual(reopened.reminders.map(item => item.id), ['c', 'a', 'b'])
    assert.equal(reopened.reminders[1].title, 'А')
    assert.equal((await storage.search('Проект'))[0].id, 's')
  }
  finally { await storage.close() }
  const damaged = path.join(directory, 'damaged')
  fs.mkdirSync(damaged)
  fs.writeFileSync(path.join(damaged, 'state.json'), '{broken')
  storage = createStorage(damaged)
  try { await assert.rejects(storage.ready); assert.equal(fs.readFileSync(path.join(damaged, 'state.json'), 'utf8'), '{broken') }
  finally { await storage.close() }
  console.log('SQLite: миграция, параллельные и частичные изменения, порядок, поиск, резервная копия, перезапуск и повреждённые данные — OK')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
