const collections = new Set(['spaces', 'reminders', 'events', 'calendarSubscriptions', 'morningTabs', 'inboxMessages', 'newsItems', 'mailAccounts', 'mailMessages', 'feedSources', 'newsEditions', 'aiJournal'])
const forbidden = new Set(['__proto__', 'prototype', 'constructor'])

export function emptyState() {
  return { version: 2, revision: 0, spaces: [{ id: 'first-space', name: 'Моё пространство', tone: 'sage', resources: [] }], reminders: [], dismissedUntil: null }
}

export function localDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function migrateState(input) {
  if (!input || ![1, 2].includes(input.version) || !Array.isArray(input.spaces) || !Array.isArray(input.reminders)) throw new Error('Некорректные данные приложения. Исходный файл сохранён.')
  const state = structuredClone(input)
  if (state.version === 1) {
    state.reminders = state.reminders.map(item => ({ ...item, kind: item.dueAt ? 'task' : 'note', plannedDate: item.dueAt ? localDate(item.dueAt) : null }))
    if (state.checkpoint) {
      const space = state.spaces.find(item => item.id === state.checkpoint.spaceId)
      if (space) {
        space.checkpoint = { ...state.checkpoint, id: `legacy-${state.checkpoint.savedAt}`, session: structuredClone(space.activeSession) }
        space.checkpointHistory = [space.checkpoint]
      }
      delete state.checkpoint
    }
  }
  state.version = 2
  state.revision = Number.isSafeInteger(state.revision) ? state.revision : 0
  return state
}

function keyed(array) { return Array.isArray(array) && array.every(item => item && typeof item === 'object' && typeof item.id === 'string') }

export function diffState(before, after, path = []) {
  if (Object.is(before, after) || JSON.stringify(before) === JSON.stringify(after)) return []
  if (keyed(before) && keyed(after)) {
    const changes = []
    const previous = new Map(before.map(item => [item.id, item]))
    const next = new Map(after.map(item => [item.id, item]))
    for (const [id] of previous) if (!next.has(id)) changes.push({ op: 'remove', path: [...path, `@${id}`] })
    for (const [id, value] of next) changes.push(...diffState(previous.get(id), value, [...path, `@${id}`]))
    if (before.map(item => item.id).join('\0') !== after.map(item => item.id).join('\0')) changes.push({ op: 'order', path, value: after.map(item => item.id) })
    return changes
  }
  if (before && after && !Array.isArray(before) && !Array.isArray(after) && typeof before === 'object' && typeof after === 'object') {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => key !== 'revision').flatMap(key => diffState(before[key], after[key], [...path, key]))
  }
  return [{ op: after === undefined ? 'remove' : 'set', path, ...(after === undefined ? {} : { value: structuredClone(after) }) }]
}

export function applyChanges(input, changes) {
  const state = structuredClone(input)
  for (const change of changes) {
    const { path, op, value } = change
    if (!Array.isArray(path) || !path.length || path.length > 24 || path.some(key => typeof key !== 'string' || forbidden.has(key)) || path[0] === 'revision' || path[0] === 'version' || !['set', 'remove', 'order'].includes(op)) throw new Error('Некорректная операция хранения')
    let parent = state
    let missing = false
    for (const key of path.slice(0, -1)) {
      if (key.startsWith('@') && Array.isArray(parent)) {
        parent = parent.find(item => item.id === key.slice(1))
        if (!parent) { missing = true; break }
      } else {
        if (parent[key] === undefined) parent[key] = collections.has(key) || key === 'tabs' || key === 'resources' || key === 'checkpointHistory' ? [] : {}
        parent = parent[key]
      }
      if (!parent || typeof parent !== 'object') throw new Error('Некорректный путь хранения')
    }
    if (missing) continue // An edit must not resurrect a concurrently removed entity.
    const key = path.at(-1)
    if (op === 'order') {
      const array = parent[key]
      if (!Array.isArray(array) || !Array.isArray(value)) throw new Error('Некорректный порядок элементов')
      const rank = new Map(value.map((id, index) => [id, index]))
      array.sort((a, b) => (rank.get(a.id) ?? value.length) - (rank.get(b.id) ?? value.length))
    } else if (key.startsWith('@') && Array.isArray(parent)) {
      const index = parent.findIndex(item => item.id === key.slice(1))
      if (op === 'remove') { if (index >= 0) parent.splice(index, 1) }
      else if (index >= 0) parent[index] = structuredClone(value)
      else parent.push(structuredClone(value))
    } else if (op === 'remove') delete parent[key]
    else parent[key] = structuredClone(value)
  }
  state.revision = (input.revision || 0) + (changes.length ? 1 : 0)
  return state
}
