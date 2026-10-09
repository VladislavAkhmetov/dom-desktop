import { expect, it } from 'vitest'
import { calendarDates, rescheduleCalendarTask, slotTime } from '../src/calendar/model'
import { localDate } from '../shared/state'

it('неделя начинается с понедельника и корректно переходит между месяцами', () => {
  const dates = calendarDates(new Date(2026, 8, 30), 'week')
  expect(dates.map(localDate)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
})
it('месяц показывает только нужное число недель, включая високосный февраль', () => {
  expect(calendarDates(new Date(2026, 8, 30), 'month')).toHaveLength(35)
  const february = calendarDates(new Date(2028, 1, 29), 'month')
  expect(february.some(day => localDate(day) === '2028-02-29')).toBe(true)
  expect(calendarDates(new Date(2026, 7, 31), 'month')).toHaveLength(42)
})
it('навигация на день и последний получасовой интервал не меняют локальную дату', () => {
  const day = new Date(2026, 8, 30, 12)
  expect(calendarDates(day, 'day').map(localDate)).toEqual(['2026-09-30'])
  const last = slotTime(day, 47)
  expect(localDate(last)).toBe('2026-09-30')
  expect([last.getHours(), last.getMinutes()]).toEqual([23, 30])
})
it('перенос на дату сохраняет время напоминания и снимает старую отметку уведомления', () => {
  const task = { id: 'r', title: 'Проверить макет', createdAt: new Date(2026, 8, 30).toISOString(), dueAt: new Date(2026, 8, 30, 18, 30).toISOString(), done: false, notifiedAt: '2026-09-30' }
  const moved = rescheduleCalendarTask(task, new Date(2026, 9, 2))
  expect(moved.plannedDate).toBe('2026-10-02')
  expect([new Date(moved.dueAt!).getHours(), new Date(moved.dueAt!).getMinutes()]).toEqual([18, 30])
  expect(localDate(new Date(moved.dueAt!))).toBe('2026-10-02')
  expect(moved.notifiedAt).toBeUndefined()
  const timed = rescheduleCalendarTask(task, slotTime(new Date(2026, 9, 3), 21), true)
  expect([new Date(timed.dueAt!).getHours(), new Date(timed.dueAt!).getMinutes()]).toEqual([10, 30])
})
