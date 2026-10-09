import { describe, expect, it } from 'vitest'
import { applyChanges, diffState } from '../shared/state'
import { cabinetContents, reorderCabinets } from '../src/cabinetInteractions'
import { removeBrowserTab } from '../src/browser/tabModel'
import { upgradeCabinets } from '../src/cabinetModel'
import type { AppState } from '../src/types'

const state = (): AppState => upgradeCabinets({ version: 2, reminders: [], dismissedUntil: null, spaces: [
  { id: 'logo', name: 'Логотип', tone: 'sage', resources: [{ id: 'saved', name: 'Референс', kind: 'link', target: 'https://ref.test/', createdAt: '2026-10-07T10:00:00Z' }, { id: 'file', name: 'Логотип.ai', kind: 'file', target: 'D:\\Design\\Logo.ai', createdAt: '2026-10-07T10:00:00Z' }, { id: 'app', name: 'Illustrator', kind: 'app', target: 'D:\\Adobe\\Illustrator.exe', createdAt: '2026-10-07T10:00:00Z' }], activeSession: { tabs: [{ id: 'ref', title: 'Референс', url: 'https://ref.test/' }], activeTabId: 'ref' } },
  { id: 'slides', name: 'Презентация', tone: 'blue', resources: [], pinned: false },
  { id: 'archive', name: 'Архив', tone: 'sand', resources: [], archivedAt: '2026-10-07T10:00:00Z' }
] })

describe('организация кабинета', () => {
  it('скрывает только дублирующее представление сохранённой ссылки и возвращает материал после закрытия вкладки', () => {
    const input = state(), before = structuredClone(input)
    expect(cabinetContents(input.spaces[0]).materials.map(item => item.id)).toEqual(['file'])
    expect(cabinetContents(input.spaces[0]).tools.map(item => item.id)).toEqual(['app'])
    expect(input).toEqual(before)
    const closed = removeBrowserTab(input, 'logo', 'ref')
    expect(cabinetContents(closed.spaces[0]).materials.map(item => item.id)).toEqual(['saved', 'file'])
    expect(closed.spaces[0].resources).toEqual(input.spaces[0].resources)
  })
  it('сохраняет порядок и закрепление через существующие операции хранения, без изменения вкладок и ресурсов', () => {
    const input = state(), next = reorderCabinets(input, 'slides', 'logo', false, true)
    expect(next.spaces.map(space => space.id)).toEqual(['slides', 'logo', 'archive'])
    expect(next.spaces[0].pinned).toBe(true)
    expect(next.spaces[1]).toBe(input.spaces[0])
    expect(input.spaces[1].pinned).toBe(false)
    expect(applyChanges(input, diffState(input, next)).spaces).toEqual(next.spaces)
    expect(reorderCabinets(next, 'slides', 'logo', true).spaces.map(space => space.id)).toEqual(['logo', 'slides', 'archive'])
  })
  it('не меняет состояние при неизвестном, архивном или совпадающем получателе', () => {
    const input = state()
    expect(reorderCabinets(input, 'logo', 'missing')).toBe(input)
    expect(reorderCabinets(input, 'logo', 'archive')).toBe(input)
    expect(reorderCabinets(input, 'logo', 'logo', true)).toBe(input)
  })
})
