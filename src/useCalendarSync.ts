import { useEffect, useState } from 'react'
import { bridge } from './bridge'
import type { AppState, CalendarEvent, CalendarSubscription } from './types'
import { normalizeCalendarUrl } from './calendar/ical'
import { calendarRange } from './calendar/range'

type CommitState = (updater: (previous: AppState) => AppState) => unknown

export function useCalendarSync(state: AppState | null, commit: CommitState, setToast: (message: string) => void) {
  const [newCalendarName, setNewCalendarName] = useState('')
  const [newCalendarUrl, setNewCalendarUrl] = useState('')
  const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false)

  async function syncCalendars(targetState?: AppState, reference = new Date(), silent = false) {
    const s = targetState || state
    if (!s) return
    const subs = s.calendarSubscriptions || []
    if (!subs.length) return
    setIsRefreshingCalendar(true)
    try {
      // ical.js is loaded only when there is a calendar to sync.
      const { parseCalendar } = await import('./calendar/parse')
      const allEvents: CalendarEvent[] = []
      const results = new Map<string, { error?: string; lastFetchedAt?: string }>()
      for (const sub of subs) {
        try {
          const integrations = typeof window !== 'undefined' && window.dom ? bridge.integrations : undefined
          const raw = integrations && sub.secretId ? await integrations.fetchCalendarSource(sub.id) : bridge.fetchCalendar
            ? await bridge.fetchCalendar(sub.url)
            : await fetch(normalizeCalendarUrl(sub.url)).then(r => r.text())
          const parsed = parseCalendar(raw, reference, sub.id)
          allEvents.push(...parsed)
          results.set(sub.id, { lastFetchedAt: new Date().toISOString() })
        } catch (e) {
          results.set(sub.id, { error: e instanceof Error ? e.message : 'Не удалось обновить календарь' })
        }
      }
      const range = calendarRange(reference)
      commit(prev => {
        const enabled = new Set(prev.calendarSubscriptions?.map(item => item.id))
        const retained = (prev.events || []).filter(event => !event.sourceId || enabled.has(event.sourceId) && (results.get(event.sourceId)?.error || Date.parse(event.endAt) < range.start.getTime() || Date.parse(event.startAt) > range.end.getTime()))
        const unique = new Map([...retained, ...allEvents.filter(event => enabled.has(event.sourceId!)).map(event => { const old = prev.events?.find(item => item.id === event.id); return { ...event, spaceId: old?.spaceId, noticeMinutes: old?.noticeMinutes } })].map(event => [event.id, event]))
        return { ...prev, events: [...unique.values()], reminders: prev.reminders.map(item => {
          if (item.trigger?.kind !== 'event') return item
          const event = unique.get(item.trigger.eventId)
          const dueAt = event ? new Date(Date.parse(event.endAt) + item.trigger.offsetMinutes * 60000).toISOString() : null
          return item.dueAt === dueAt ? item : { ...item, dueAt, notifiedAt: undefined }
        }), calendarSubscriptions: prev.calendarSubscriptions?.map(sub => results.has(sub.id) ? { ...sub, ...results.get(sub.id), error: results.get(sub.id)?.error } : sub) }
      })
      if (!silent) setToast(`Календарь обновлён: событий ${allEvents.length}. Ошибок: ${[...results.values()].filter(item => item.error).length}.`)
    } catch {
      setToast('Не удалось обновить календарь.')
    } finally {
      setIsRefreshingCalendar(false)
    }
  }

  const osIntegrations = () => (typeof window !== 'undefined' && window.dom ? bridge.integrations : undefined)

  async function addCalendar() {
    const url = newCalendarUrl.trim()
    const name = newCalendarName.trim() || 'Мой календарь'
    if (!url) { setToast('Укажите ссылку на календарь.'); return }
    const integrations = osIntegrations()
    if (integrations) {
      try { await integrations.addCalendar(name, url); setNewCalendarName(''); setNewCalendarUrl(''); setToast('Календарь подключён. Адрес сохранён в защищённом хранилище.') }
      catch (error) { setToast(error instanceof Error ? error.message : 'Не удалось подключить календарь') }
      return
    }
    const sub: CalendarSubscription = {
      id: crypto.randomUUID(),
      name,
      url: normalizeCalendarUrl(url),
      lastFetchedAt: new Date().toISOString()
    }
    const nextSubs = [...(state?.calendarSubscriptions || []), sub]
    commit(prev => ({ ...prev, calendarSubscriptions: nextSubs }))
    setNewCalendarName('')
    setNewCalendarUrl('')
    setToast(`Календарь «${name}» добавлен.`)
    if (state) syncCalendars({ ...state, calendarSubscriptions: nextSubs })
  }

  function removeCalendar(id: string) {
    const integrations = typeof window !== 'undefined' && window.dom ? bridge.integrations : undefined
    if (integrations) { integrations.removeCalendar(id).then(() => setToast('Календарь отключён.')).catch(error => setToast(error.message)); return }
    commit(prev => ({
      ...prev,
      calendarSubscriptions: (prev.calendarSubscriptions || []).filter(s => s.id !== id)
      , events: (prev.events || []).filter(event => event.sourceId !== id)
    }))
    setToast('Календарь отключён.')
  }

  const calendarSources = state?.calendarSubscriptions?.map(item => `${item.id}:${item.secretId || item.url}`).join('|') || ''
  useEffect(() => {
    if (!state || !calendarSources) return
    syncCalendars(state, new Date(), true)
    const timer = window.setInterval(() => syncCalendars(undefined, new Date(), true), 15 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [state === null, calendarSources])

  return { newCalendarName, setNewCalendarName, newCalendarUrl, setNewCalendarUrl, isRefreshingCalendar, syncCalendars, addCalendar, removeCalendar }
}
