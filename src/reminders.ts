import { localDate } from '../shared/state'

export interface ParsedCapture { title: string; dueAt: string | null; plannedDate: string | null; kind: 'note' | 'task' }

export function parseCapture(raw: string, now = new Date()): ParsedCapture {
  let text = raw.trim()
    .replace(/^(?:(?:ну|пожалуйста|в)\s+)?(?:напомни(?:\s+мне)?|напомнить)\s+/iu, '')
    .replace(/^напомни(?:\s+мне)?\s+/iu, '')
  let dueAt: Date | null = null
  let plannedDate: string | null = null

  const relative = text.match(/(?<![\p{L}\p{N}])через\s+(\d+)\s+(минут[уы]?|минуту|час(?:а|ов)?)(?![\p{L}\p{N}])/iu)
  if (relative) {
    const amount = Number(relative[1])
    const minutes = relative[2].toLowerCase().startsWith('час') ? amount * 60 : amount
    if (!(amount > 0 && minutes <= 525600)) return { title: raw.trim(), dueAt: null, plannedDate: null, kind: 'note' }
    dueAt = new Date(now.getTime() + minutes * 60_000)
    plannedDate = localDate(dueAt)
    text = text.replace(relative[0], '')
  } else {
    const dayWord = text.match(/(?<![\p{L}\p{N}])(сегодня|завтра|послезавтра)(?![\p{L}\p{N}])/iu)
    const dateMatch = text.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?\b/)
    const timeMatch = text.match(/(?<![\p{L}\p{N}])(?:в|к)\s+([01]?\d|2[0-3])(?::([0-5]\d))?(?:\s*(?:часов|часам|часа|час|ч))?(?![\p{L}\p{N}])/iu)
    if (dayWord || dateMatch || timeMatch) {
      const date = new Date(now)
      date.setSeconds(0, 0)
      if (dayWord) {
        const offset = dayWord[1].toLowerCase() === 'сегодня' ? 0 : dayWord[1].toLowerCase() === 'завтра' ? 1 : 2
        date.setDate(date.getDate() + offset)
        text = text.replace(dayWord[0], '')
      }
      if (dateMatch) {
        const day = Number(dateMatch[1])
        const month = Number(dateMatch[2]) - 1
        const year = dateMatch[3] ? Number(dateMatch[3]) : now.getFullYear()
        date.setFullYear(year, month, day)
        if (date.getDate() !== day || date.getMonth() !== month) return { title: raw.trim(), dueAt: null, plannedDate: null, kind: 'note' }
        if (!dateMatch[3] && localDate(date)! < localDate(now)!) date.setFullYear(year + 1)
        text = text.replace(dateMatch[0], '')
      }
      if (timeMatch) {
        date.setHours(Number(timeMatch[1]), Number(timeMatch[2] ?? 0), 0, 0)
        text = text.replace(timeMatch[0], '')
        if (!dayWord && !dateMatch && date <= now) date.setDate(date.getDate() + 1)
        dueAt = date
      }
      plannedDate = localDate(date)
    }
  }

  text = text.replace(/^[,.:;\s]+|[,.:;\s]+$/g, '').replace(/\s{2,}/g, ' ')
  return { title: text || raw.trim(), dueAt: dueAt?.toISOString() ?? null, plannedDate, kind: plannedDate ? 'task' : 'note' }
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function formatDue(iso: string | null): string {
  if (!iso) return 'Без времени'
  const date = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const day = sameDay(date, today) ? 'Сегодня' : sameDay(date, tomorrow) ? 'Завтра' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  return `${day}, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
}

export interface CountdownInfo {
  label: string
  isUrgent: boolean
  isPast: boolean
}

export function formatCountdown(iso: string | null, now = new Date()): CountdownInfo {
  if (!iso) return { label: 'Сегодня', isUrgent: false, isPast: false }
  const due = new Date(iso)
  const diffMs = due.getTime() - now.getTime()
  const diffMin = Math.round(diffMs / 60_000)

  if (diffMin > 0 && diffMin <= 60) {
    return { label: `-${diffMin} мин`, isUrgent: diffMin <= 15, isPast: false }
  }
  if (diffMin <= 0 && diffMin >= -30) {
    return { label: 'Прямо сейчас', isUrgent: true, isPast: true }
  }
  if (diffMin > 60 && diffMin < 24 * 60) {
    const hours = Math.floor(diffMin / 60)
    const mins = diffMin % 60
    return {
      label: mins > 0 ? `через ${hours}ч ${mins}м` : `через ${hours}ч`,
      isUrgent: false,
      isPast: false
    }
  }
  return {
    label: due.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    isUrgent: false,
    isPast: diffMs < 0
  }
}
