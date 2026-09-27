import { expect, it } from 'vitest'
import { parseCalendar } from '../src/calendar/parse'
const calendar = (events: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR`
const event = (properties: string) => `BEGIN:VEVENT\r\n${properties}\r\nEND:VEVENT`
const now = new Date('2026-09-27T00:00:00Z')
it('разворачивает повторения и исключения', () => {
  const value = parseCalendar(calendar(event('UID:series\r\nSUMMARY:Встреча\r\nDTSTART:20260927T090000Z\r\nDTEND:20260927T100000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEXDATE:20260928T090000Z')), now, 'source')
  expect(value).toHaveLength(2)
  expect(value[1].startAt).toBe('2026-09-29T09:00:00.000Z')
})
it('учитывает перенесённый экземпляр серии', () => {
  const value = parseCalendar(calendar(event('UID:series\r\nSUMMARY:Встреча\r\nDTSTART:20260927T090000Z\r\nDTEND:20260927T100000Z\r\nRRULE:FREQ=DAILY;COUNT=2') + '\r\n' + event('UID:series\r\nRECURRENCE-ID:20260928T090000Z\r\nSUMMARY:Перенесено\r\nDTSTART:20260928T120000Z\r\nDTEND:20260928T130000Z')), now)
  expect(value).toHaveLength(2)
  expect(value[1]).toMatchObject({ title: 'Перенесено', startAt: '2026-09-28T12:00:00.000Z' })
})
it('использует IANA зону без VTIMEZONE', () => {
  const value = parseCalendar(calendar(event('UID:zone\r\nSUMMARY:Зона\r\nDTSTART;TZID=Asia/Yekaterinburg:20260927T090000\r\nDTEND;TZID=Asia/Yekaterinburg:20260927T100000')), now)
  expect(value[0].startAt).toBe('2026-09-27T04:00:00.000Z')
})
it('переходит через DST в повторяющейся серии', () => {
  const value = parseCalendar(calendar(event('UID:dst\r\nSUMMARY:Встреча\r\nDTSTART;TZID=Europe/Berlin:20261024T090000\r\nDTEND;TZID=Europe/Berlin:20261024T100000\r\nRRULE:FREQ=DAILY;COUNT=3')), new Date('2026-10-24T00:00:00Z'))
  expect(value.map(item => item.startAt)).toEqual(['2026-10-24T07:00:00.000Z', '2026-10-25T08:00:00.000Z', '2026-10-26T08:00:00.000Z'])
})
it('сохраняет даты событий на весь день и изолирует идентификаторы источников', () => {
  const raw = calendar(event('UID:same\r\nSUMMARY:Отпуск\r\nDTSTART;VALUE=DATE:20260927\r\nDTEND;VALUE=DATE:20260929'))
  const a = parseCalendar(raw, now, 'a')[0], b = parseCalendar(raw, now, 'b')[0]
  expect(a).toMatchObject({ allDay: true, startDate: '2026-09-27', endDate: '2026-09-29' })
  expect(a.id).not.toBe(b.id)
})
it('не показывает отменённое событие', () => expect(parseCalendar(calendar(event('UID:cancel\r\nSUMMARY:Отмена\r\nSTATUS:CANCELLED\r\nDTSTART:20260927T090000Z')), now)).toEqual([]))
it('применяет VTIMEZONE и не переносит определение в другой источник', () => {
  const zone = 'BEGIN:VTIMEZONE\r\nTZID:Custom\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0300\r\nTZOFFSETTO:+0300\r\nEND:STANDARD\r\nEND:VTIMEZONE'
  const value = parseCalendar(calendar(zone + '\r\n' + event('UID:custom\r\nSUMMARY:Зона\r\nDTSTART;TZID=Custom:20260927T090000\r\nDTEND;TZID=Custom:20260927T100000')), now)
  expect(value[0].startAt).toBe('2026-09-27T06:00:00.000Z')
})
