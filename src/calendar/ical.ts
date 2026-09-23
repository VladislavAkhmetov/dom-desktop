import type { CalendarEvent } from '../types'

export interface ParsedEvent {
  id: string
  title: string
  startAt: string
  endAt: string
  location?: string
  description?: string
  meetingUrl?: string
  category: 'meeting' | 'design' | 'focus' | 'personal'
}

/**
 * Unfolds iCalendar content lines (lines starting with space or tab are continuation of previous line).
 */
export function unfoldICal(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const unfolded: string[] = []

  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1)
    } else {
      unfolded.push(line)
    }
  }

  return unfolded
}

/**
 * Parses iCal date-time strings:
 * - 20260923T143000Z
 * - 20260923T143000
 * - 20260923 (all-day)
 */
export function parseICalDate(val: string): Date | null {
  if (!val) return null

  // Value might have params: e.g. "VALUE=DATE:20260923" or "TZID=Asia/Yekaterinburg:20260923T143000"
  const clean = val.includes(':') ? val.split(':').pop() || val : val
  const trimmed = clean.trim()

  // All-day: YYYYMMDD
  if (/^\d{8}$/.test(trimmed)) {
    const y = parseInt(trimmed.slice(0, 4), 10)
    const m = parseInt(trimmed.slice(4, 6), 10) - 1
    const d = parseInt(trimmed.slice(6, 8), 10)
    return new Date(y, m, d, 0, 0, 0)
  }

  // DateTime: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/)
  if (match) {
    const [, y, mo, d, h, mi, s, z] = match
    if (z) {
      return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    }
    // Local floating time
    return new Date(+y, +mo - 1, +d, +h, +mi, +s)
  }

  const fallback = new Date(trimmed)
  return isNaN(fallback.getTime()) ? null : fallback
}

/**
 * Extracts meeting link (Google Meet, Zoom, Yandex Telemost, MS Teams) from text.
 */
export function extractMeetingUrl(text?: string): string | undefined {
  if (!text) return undefined
  const patterns = [
    /https?:\/\/meet\.google\.com\/[a-z0-9-]+/i,
    /https?:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/j\/\d+(?:\?[^\s"'>]+)?/i,
    /https?:\/\/telemost\.yandex\.ru\/j\/\d+/i,
    /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'>]+/i
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[0]
  }

  return undefined
}

/**
 * Categorizes an event based on title and presence of video conference.
 */
function categorizeEvent(title: string, hasMeeting: boolean): CalendarEvent['category'] {
  const lower = title.toLowerCase()
  if (hasMeeting || /созвон|митинг|встреча|sync|call|standup|дейли/i.test(lower)) return 'meeting'
  if (/дизайн|design|figma|макет|интерфейс|ui|ux/i.test(lower)) return 'design'
  if (/фокус|focus|код|dev|работа/i.test(lower)) return 'focus'
  return 'personal'
}

/**
 * Parses raw iCal (.ics) string into array of CalendarEvents within window (-1 day to +7 days).
 */
export function parseICal(raw: string, referenceDate = new Date()): CalendarEvent[] {
  const lines = unfoldICal(raw)
  const events: CalendarEvent[] = []

  let inEvent = false
  let current: Partial<ParsedEvent> = {}

  const minTime = referenceDate.getTime() - 24 * 60 * 60 * 1000
  const maxTime = referenceDate.getTime() + 7 * 24 * 60 * 60 * 1000

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true
      current = {}
      continue
    }

    if (line.startsWith('END:VEVENT')) {
      if (inEvent && current.title && current.startAt) {
        const start = Date.parse(current.startAt)
        if (!isNaN(start) && start >= minTime && start <= maxTime) {
          const meetingUrl = current.meetingUrl || extractMeetingUrl(current.location) || extractMeetingUrl(current.description)
          events.push({
            id: current.id || crypto.randomUUID(),
            title: current.title,
            startAt: current.startAt,
            endAt: current.endAt || new Date(start + 30 * 60 * 1000).toISOString(),
            category: categorizeEvent(current.title, Boolean(meetingUrl)),
            meetingUrl,
            location: current.location
          })
        }
      }
      inEvent = false
      continue
    }

    if (!inEvent) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const propHeader = line.slice(0, colonIdx)
    const val = line.slice(colonIdx + 1).trim()
    const propName = propHeader.split(';')[0].toUpperCase()

    if (propName === 'UID') {
      current.id = val
    } else if (propName === 'SUMMARY') {
      // Decode escaped commas, semicolons, newlines
      current.title = val.replace(/\\n/g, ' ').replace(/\\([,;])/g, '$1')
    } else if (propName === 'DTSTART') {
      const d = parseICalDate(line.slice(propName.length))
      if (d) current.startAt = d.toISOString()
    } else if (propName === 'DTEND') {
      const d = parseICalDate(line.slice(propName.length))
      if (d) current.endAt = d.toISOString()
    } else if (propName === 'LOCATION') {
      current.location = val.replace(/\\n/g, ' ').replace(/\\([,;])/g, '$1')
    } else if (propName === 'DESCRIPTION') {
      current.description = val.replace(/\\n/g, '\n').replace(/\\([,;])/g, '$1')
    } else if (propName === 'URL') {
      current.meetingUrl = val
    }
  }

  return events.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
}

/**
 * Normalizes webcal URLs to https://
 */
export function normalizeCalendarUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed.startsWith('webcal://')) {
    return 'https://' + trimmed.slice(9)
  }
  return trimmed
}
