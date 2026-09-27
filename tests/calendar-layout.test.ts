import { expect, it } from 'vitest'
import { layoutIntervals } from '../src/calendar/layout'
it('разводит пересекающиеся события по колонкам и возвращает полную ширину следующему', () => {
  const day = new Date(2026, 8, 27)
  const iso = (hour: number) => new Date(2026, 8, 27, hour).toISOString()
  const slots = layoutIntervals([{ id: 'one', startAt: iso(9), endAt: iso(11) }, { id: 'two', startAt: iso(10), endAt: iso(12) }, { id: 'three', startAt: iso(13), endAt: iso(14) }], day)
  expect(slots.map(item => [item.column, item.columns])).toEqual([[0, 2], [1, 2], [0, 1]])
})
