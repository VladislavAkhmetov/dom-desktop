export interface Interval { id: string; startAt: string; endAt: string }
export function layoutIntervals<T extends Interval>(items: T[], day: Date) {
  const end = new Date(day); end.setDate(end.getDate() + 1)
  const positioned = items.map(item => {
    const start = new Date(item.startAt), finish = new Date(item.endAt)
    const from = start < day ? 0 : start.getHours() * 60 + start.getMinutes()
    const to = finish >= end ? 1440 : finish.getHours() * 60 + finish.getMinutes()
    return { item, from, to: Math.max(from + 15, to), column: 0, columns: 1 }
  }).sort((a, b) => a.from - b.from || b.to - a.to)
  let group: typeof positioned = [], ends: number[] = [], groupEnd = -1
  const flush = () => { for (const item of group) item.columns = ends.length; group = []; ends = []; groupEnd = -1 }
  for (const item of positioned) {
    if (item.from >= groupEnd) flush()
    let column = ends.findIndex(end => end <= item.from)
    if (column < 0) column = ends.length
    ends[column] = item.to; item.column = column; group.push(item); groupEnd = Math.max(groupEnd, item.to)
  }
  flush()
  return positioned
}
