import { normalizeSpace } from '../shared/state'
import { nameFromMaterials } from './cabinetModel'
import type { AppState, BrowserTab, Space } from './types'

/*
 * Day draft «Сегодня» (docs/day-draft.md). Free browsing lands in a space of kind 'day'; the first
 * launch after 04:00 retires yesterday's draft into «Прошлые дни» (renamed to its date, kept 14 days)
 * and starts a clean one. Pinned and protected tabs carry over. Pure functions over AppState.
 */
export const DAY_BOUNDARY_HOUR = 4
export const DAY_DRAFT_RETENTION_DAYS = 14
export const TODAY_NAME = 'Сегодня'

const pad = (value: number) => String(value).padStart(2, '0')
const localKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Calendar day of the draft: before 04:00 it is still «yesterday». */
export function dayKey(now = new Date()) {
  return localKey(new Date(now.getTime() - DAY_BOUNDARY_HOUR * 3600000))
}

function shiftKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localKey(date)
}

/** «Вторник, 27 октября» */
export function dayLabel(key: string) {
  const text = new Date(`${key}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const isDayDraft = (space: Space) => space.kind === 'day'
/** A retired day («Прошлые дни»): read back, promote or delete — never a destination for new tabs. */
export const isPastDay = (space: Space) => space.kind === 'day' && Boolean(space.dayRetired)
const pages = (space: Space) => (space.activeSession?.tabs || []).filter(tab => tab.url)

/** Today's draft (after ensureDayDraft there is always exactly one). */
export function todayDraft(state: AppState, now = new Date()) {
  return state.spaces.find(space => isDayDraft(space) && space.day === dayKey(now))
}

/** Earlier drafts, newest first. */
export function pastDays(state: AppState, now = new Date()) {
  const key = dayKey(now)
  return state.spaces.filter(space => isDayDraft(space) && (space.day || '') < key).sort((a, b) => (b.day || '').localeCompare(a.day || ''))
}

// The empty starter space created on first launch («Моё пространство») — removed, the day starts with «Сегодня».
function untouchedStarter(space: Space) {
  return space.id === 'first-space' && !space.resources.length && !pages(space).length && !space.checkpoint
    && !normalizeSpace(space).workContexts!.some(context => context.checkpoint)
}

export function ensureDayDraft(state: AppState, now = new Date()): AppState {
  const key = dayKey(now)
  const cutoff = shiftKey(key, -DAY_DRAFT_RETENTION_DAYS)
  let changed = false
  const carried: BrowserTab[] = []
  const spaces: Space[] = []
  for (const space of state.spaces) {
    if (untouchedStarter(space)) { changed = true; continue }
    if (!isDayDraft(space) || (space.day || '') >= key) { spaces.push(space); continue }
    if ((space.day || '') < cutoff) { changed = true; continue } // older than 14 days: forgotten (links stay in history)
    if (space.dayRetired) { spaces.push(space); continue } // already a past day
    // Retire yesterday's draft: pinned and protected tabs move on, the rest stays under its date.
    changed = true
    const tabs = space.activeSession?.tabs || []
    const keep = tabs.filter(tab => tab.url && (tab.pinned || tab.protected))
    const rest = tabs.filter(tab => !keep.includes(tab))
    carried.push(...keep)
    if (!rest.some(tab => tab.url)) continue // nothing left to look back at: no empty past day
    spaces.push({ ...space, name: dayLabel(space.day!), nameOrigin: 'manual', dayRetired: true, activeSession: { ...space.activeSession!, tabs: rest, activeTabId: rest.find(tab => tab.url)?.id || '', splitTabId: null } })
  }
  if (!spaces.some(space => isDayDraft(space) && space.day === key)) {
    changed = true
    // A promoted draft keeps its id, so the next «Сегодня» of the same day needs a fresh one.
    let id = `day-${key}`, suffix = 2
    while (spaces.some(space => space.id === id)) id = `day-${key}-${suffix++}`
    spaces.push(normalizeSpace({ id, name: TODAY_NAME, nameOrigin: 'manual', kind: 'day', day: key, tone: 'sage', pinned: false, resources: [],
      activeSession: { tabs: carried.map(({ contextId: _contextId, ...tab }) => tab), activeTabId: carried[0]?.id || '' }, lastActiveAt: carried.length ? now.toISOString() : undefined }))
  }
  if (!changed) return state
  const activeSpaceId = spaces.some(space => space.id === state.activeSpaceId) ? state.activeSpaceId : spaces.find(space => isDayDraft(space) && space.day === key)!.id
  return { ...state, spaces, activeSpaceId }
}

/** «Сделать пространством»: the draft becomes a regular space named after its content; a new «Сегодня» takes its place. */
export function promoteDayDraft(state: AppState, id: string, now = new Date(), chosenName?: string): AppState {
  const draft = state.spaces.find(space => space.id === id && isDayDraft(space))
  if (!draft) return state
  const name = chosenName?.trim() || nameFromMaterials(draft) || (draft.dayRetired ? draft.name : dayLabel(draft.day!))
  const { day: _day, kind: _kind, dayRetired: _retired, ...rest } = draft
  const promoted: Space = { ...rest, name, nameOrigin: chosenName?.trim() ? 'manual' : 'suggested', pinned: false, lastActiveAt: now.toISOString() }
  return ensureDayDraft({ ...state, spaces: state.spaces.map(space => space.id === id ? promoted : space) }, now)
}
