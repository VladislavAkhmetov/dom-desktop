// Kept apart from parse.ts so callers can use the range without loading ical.js (~80 KB).
export function calendarRange(reference: Date) {
  const start = new Date(reference); start.setDate(start.getDate() - 31); start.setHours(0, 0, 0, 0)
  const end = new Date(reference); end.setDate(end.getDate() + 93); end.setHours(23, 59, 59, 999)
  return { start, end }
}
