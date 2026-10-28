import ICAL from 'ical.js'
import type { CalendarEvent } from '../types'
import { extractMeetingUrl } from './ical'

import { calendarRange } from './range'
export { calendarRange }

function toDate(time: ICAL.Time, zone: string): Date {
  if (time.isDate || !zone || zone === 'floating') return new Date(time.year, time.month - 1, time.day, time.hour, time.minute, time.second)
  if (time.zone.tzid !== 'floating') return time.toJSDate()
  // Intl includes the runtime IANA database; VTIMEZONE, when provided, takes precedence.
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const wall = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second)
  let value = wall
  for (let step = 0; step < 3; step++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(part => [part.type, part.value]))
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
    const next = value + wall - represented
    if (next === value) break
    value = next
  }
  return new Date(value)
}

export function parseCalendar(raw: string, reference = new Date(), sourceId = 'calendar'): CalendarEvent[] {
  ICAL.TimezoneService.reset()
  const component = new ICAL.Component(ICAL.parse(raw))
  for (const timezone of component.getAllSubcomponents('vtimezone')) {
    const tzid = String(timezone.getFirstPropertyValue('tzid'))
    ICAL.TimezoneService.register(new ICAL.Timezone({ component: timezone, tzid }), tzid)
  }
  const events = component.getAllSubcomponents('vevent').map(item => new ICAL.Event(item))
  const masterIds = new Set(events.filter(event => !event.isRecurrenceException()).map(event => event.uid))
  const { start, end } = calendarRange(reference)
  const results: CalendarEvent[] = []
  const add = (event: ICAL.Event, startTime: ICAL.Time, endTime: ICAL.Time, recurrenceId?: string) => {
    if (event.component.getFirstPropertyValue('status') === 'CANCELLED') return
    const zone = String(event.component.getFirstProperty('dtstart')?.getParameter('tzid') || startTime.zone.tzid)
    const from = toDate(startTime, zone), until = toDate(endTime, zone)
    if (until < start || from > end) return
    const url = String(event.component.getFirstPropertyValue('url') || '')
    const meetingUrl = extractMeetingUrl([url, event.location, event.description].join(' '))
    results.push({ id: `${sourceId}:${event.uid}:${recurrenceId || startTime.toString()}`, sourceId, uid: event.uid, recurrenceId, title: event.summary || 'Событие', startAt: from.toISOString(), endAt: until.toISOString(), allDay: startTime.isDate, startDate: startTime.isDate ? startTime.toString() : undefined, endDate: endTime.isDate ? endTime.toString() : undefined, timeZone: zone, location: event.location || undefined, meetingUrl, category: meetingUrl ? 'meeting' : 'personal' })
  }
  for (const event of events) {
    if (event.isRecurrenceException() && masterIds.has(event.uid)) continue
    if (!event.isRecurring()) { add(event, event.startDate, event.endDate); continue }
    const iterator = event.iterator()
    let count = 0
    for (let occurrence = iterator.next(); occurrence; occurrence = iterator.next()) {
      if (++count > 250000) throw new Error('Слишком частые повторения календаря. Ограничьте серию в исходном календаре.')
      const details = event.getOccurrenceDetails(occurrence)
      add(details.item, details.startDate, details.endDate, occurrence.toString())
      const zone = String(event.component.getFirstProperty('dtstart')?.getParameter('tzid') || occurrence.zone.tzid)
      if (toDate(occurrence, zone) > end) break
    }
  }
  return results.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
}
