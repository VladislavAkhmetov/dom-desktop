import { createRequire } from 'node:module'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { idleTabs, discardDelay, DISCARD_AFTER_MS } = require('../electron/tab-memory.cjs')

it('выгружает давно скрытые и лишние фоновые вкладки, не трогая видимые и защищённые', () => {
  const now = 10 * DISCARD_AFTER_MS
  const tab = (id: string, hiddenFor: number | null, extra = {}) => ({ id, desired: hiddenFor === null, hiddenAt: hiddenFor === null ? undefined : now - hiddenFor, ...extra })
  const records = [
    tab('visible', null),
    tab('old', DISCARD_AFTER_MS),
    tab('fresh', 1000),
    tab('form', 2 * DISCARD_AFTER_MS, { protected: true }),
    tab('music', 2 * DISCARD_AFTER_MS, { playing: true }),
    tab('audio', 2 * DISCARD_AFTER_MS, { audible: true })
  ]
  expect(idleTabs(records, now).map((record: { id: string }) => record.id)).toEqual(['old'])
  const many = Array.from({ length: 5 }, (_, index) => tab(`t${index}`, 1000 * (5 - index)))
  expect(idleTabs(many, now, { keep: 3 }).map((record: { id: string }) => record.id)).toEqual(['t0', 't1'])
})

it('срок выгрузки берётся из настройки; пусто или неверное значение — 30 минут, 0 — никогда', () => {
  expect(discardDelay(15)).toBe(15 * 60_000)
  expect(discardDelay(60)).toBe(60 * 60_000)
  expect(discardDelay(0)).toBe(0)
  for (const value of [undefined, null, NaN, -5, '30']) expect(discardDelay(value)).toBe(DISCARD_AFTER_MS)
  const records = [{ id: 'hidden', desired: false, hiddenAt: 1_000_000 }]
  expect(idleTabs(records, 1_000_000 + 16 * 60_000, { after: discardDelay(15) }).map((tab: { id: string }) => tab.id)).toEqual(['hidden'])
  expect(idleTabs(records, 1_000_000 + 16 * 60_000, { after: discardDelay(60) })).toEqual([])
})
