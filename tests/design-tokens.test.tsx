// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { MenuItems, type MenuAction } from '../src/ActionMenu'

// Guards the style table (docs/design-tokens.md): tokens.css is the only source of radii, surfaces, lines and focus.
const files = readdirSync('src', { recursive: true }).map(String).filter(file => file.endsWith('.css')).map(file => join('src', file))
const css = files.map(file => ({ file, text: readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }))
const rules = () => css.flatMap(({ file, text }) => [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ file, selector: selector.trim(), body })))
const value = (body: string, property: string) => body.match(new RegExp(`(?<![-\\w])${property}\\s*:\\s*([^;]+)`))?.[1].replace('!important', '').trim()

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('Таблица стилей', () => {
  it('каждый токен объявлен один раз', () => {
    const counts = new Map<string, number>()
    for (const { text } of css) {
      const plain = text.replace(/@media[^{]*prefers-reduced-motion[^{]*\{[\s\S]*?\}\s*\}/g, '')
      for (const [, body] of plain.matchAll(/:root\s*\{([^}]*)\}/g)) for (const [, name] of body.matchAll(/(--[\w-]+)\s*:/g)) counts.set(name, (counts.get(name) || 0) + 1)
    }
    expect([...counts].filter(([, count]) => count > 1)).toEqual([])
  })
  it('скругления — только токены шкалы', () => {
    const raw = rules().filter(({ file }) => !file.endsWith('tokens.css')).flatMap(({ file, selector, body }) => {
      const radius = value(body, 'border(?:-(?:top|bottom)-(?:left|right))?-radius')
      return radius && /\d(px|%)/.test(radius.replace(/var\([^)]*\)/g, '')) ? [`${file}: ${selector} → ${radius}`] : []
    })
    expect(raw).toEqual([])
  })
  it('фокус везде одним кольцом --focus-ring', () => {
    const rings = rules().flatMap(({ file, selector, body }) => {
      const outline = value(body, 'outline')
      return outline?.startsWith('2px solid') && !outline.includes('var(--focus-ring)') && !/drop-target/.test(selector) ? [`${file}: ${selector} → ${outline}`] : []
    })
    expect(rings).toEqual([])
  })
  it('всплывающие поверхности стоят на ролях поповера, листа или инверсной поверхности', () => {
    const surfaces = ['.action-menu-popover', '.space-switcher-panel', '.profile-popover', '.omnibox-dropdown', '.calm-player-popover', '.calm-app-popover', '.tab-peek', '.calm-dialog', '.island-details', '.calm-undo', '.calm-tooltip']
    const off = surfaces.flatMap(name => rules().filter(({ selector }) => selector.split(',').map(part => part.trim()).at(-1) === name).flatMap(({ file, body }) => {
      const background = value(body, 'background'), radius = value(body, 'border-radius'), shadow = value(body, 'box-shadow')
      return [background, radius, shadow].some(item => item && !item.startsWith('var(--')) ? [`${file}: ${name} bg=${background} r=${radius} shadow=${shadow}`] : []
    }))
    expect(off).toEqual([])
  })
  it('текст не мельче 14px: размеры меньше — только токены (--fs-glyph для букв в значках)', () => {
    const small = css.filter(({ file }) => !file.endsWith('tokens.css')).flatMap(({ file, text }) => [...text.matchAll(/(?<![-\w])font(?:-size)?\s*:[^;{}]*?(?<![\w.-])(\d*\.?\d+)px/g)].filter(([, size]) => Number(size) < 14).map(([match]) => `${file}: ${match}`))
    expect(small).toEqual([])
    const tsx = readdirSync('src', { recursive: true }).map(String).filter(file => file.endsWith('.tsx')).flatMap(file => [...readFileSync(join('src', file), 'utf8').matchAll(/fontSize:\s*([0-9]|1[0-3])\b/g)].map(([match]) => `${file}: ${match}`))
    expect(tsx).toEqual([])
  })
  it('значки профиля и пресетов — иконки, а не эмодзи', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u
    for (const file of ['src/userProfile.ts', 'src/ProfileGlyph.tsx', 'src/ProfilePopover.tsx', 'src/DashboardSettings.tsx', 'src/HabitsWidget.tsx']) {
      const code = readFileSync(file, 'utf8').replace(/const LEGACY_EMOJI[^\n]*/, '')
      expect(emoji.test(code), file).toBe(false)
    }
  })
  it('нет синих цветов чужой палитры (Chrome/Bootstrap)', () => {
    expect(css.filter(({ text }) => /#1a73e8|#1a68ff|#1557b0|#0f57eb|#2557d6|#2457dc|rgba\(26,\s*115,\s*232/i.test(text)).map(({ file }) => file)).toEqual([])
  })
  it('меню: группа с заголовком, разделитель перед опасным действием, отключённый пункт', async () => {
    const container = document.body.appendChild(document.createElement('div'))
    const root = createRoot(container)
    const pick = vi.fn()
    const actions: MenuAction[] = [
      { label: 'Открыть', icon: null, onSelect: () => {} },
      { label: 'Работа', group: 'Перенести в', icon: null, onSelect: () => {} },
      { label: 'Дом', group: 'Перенести в', icon: null, onSelect: () => {} },
      { label: 'Недоступно', disabled: true, icon: null, onSelect: () => {} },
      { label: 'Удалить', tone: 'danger', icon: null, onSelect: () => {} }
    ]
    await act(async () => root.render(<MenuItems actions={actions} onPick={pick} />))
    expect([...container.children].map(node => node.getAttribute('role') === 'separator' ? '—' : node.textContent)).toEqual(['Открыть', '—', 'Перенести в', 'Работа', 'Дом', '—', 'Недоступно', '—', 'Удалить'])
    expect(container.querySelector('[data-tone="danger"]')?.textContent).toBe('Удалить')
    expect(container.querySelector<HTMLButtonElement>('[aria-disabled="true"]')?.disabled).toBe(true)
    await act(async () => root.unmount())
  })
})
