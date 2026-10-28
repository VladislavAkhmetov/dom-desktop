import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calmEase, exitEase, motionDuration, pressOpacity } from '../src/motion'

// Guards the motion DNA (docs/motion.md): one curve, six durations, hover never moves things.
const files = readdirSync('src', { recursive: true }).map(String).filter(file => file.endsWith('.css')).map(file => join('src', file))
const css = files.map(file => ({ file, text: readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }))
const declarations = (property: RegExp) => css.flatMap(({ file, text }) => [...text.matchAll(new RegExp(`(?<![-\\w])(${property.source})\\s*:\\s*([^;{}]+)`, 'g'))].map(match => ({ file, value: match[2].trim() })))
const seconds = (value: string) => [...value.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)].map(([, n, unit]) => Number(n) / (unit === 'ms' ? 1000 : 1))
// Deliberate slow motion that is not UI feedback: breathing pace, a 1 s timer, the letter-by-letter greeting.
const exempt = (value: string) => { const [duration] = seconds(value); return duration >= .45 || duration < .005 } // later times are delays

describe('ДНК микроанимаций', () => {
  it('переходы и анимации берут длительность и кривую из токенов', () => {
    const raw = [...declarations(/transition(?:-duration)?|animation(?:-duration)?/)]
      .filter(({ value }) => value !== 'none' && !value.startsWith('none') && seconds(value).length && !exempt(value))
    expect(raw).toEqual([])
  })
  it('нет transition: all и сырых кривых вне motion.css', () => {
    expect(declarations(/transition(?:-property)?/).filter(({ value }) => /(^|[\s,])all([\s,]|$)/.test(value))).toEqual([])
    expect(css.filter(({ file, text }) => !file.endsWith('motion.css') && /cubic-bezier\(|\bease-(?:in|out|in-out)\b|:\s*ease\b|\s\.?\d+m?s ease\b/.test(text)).map(({ file }) => file)).toEqual([])
  })
  it('наведение и нажатие не двигают и не масштабируют элементы', () => {
    const moves: string[] = []
    for (const { file, text } of css) for (const [, selector, body] of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const transform = body.match(/(?<![-\w])transform\s*:\s*([^;]+)/)?.[1].replace('!important', '').trim()
      if (!transform || transform === 'none') continue
      if (/:hover/.test(selector) && !/^translateX\((0|2px)\)$|^translateY\(-50%\)$|^scale[XY]\(1\)$/.test(transform) && !/sheet-/.test(selector)) moves.push(`${file}: ${selector.trim()} → ${transform}`)
      if (/:active/.test(selector) && /scale\(|translate[XY]?\((?!-50%)/.test(transform)) moves.push(`${file}: ${selector.trim()} → ${transform}`)
    }
    expect(moves).toEqual([])
  })
  it('появления используют общий calm-in, отдельные keyframes — только для живых состояний', () => {
    const names = css.flatMap(({ text }) => [...text.matchAll(/@keyframes\s+([\w-]+)/g)].map(match => match[1])).sort()
    expect(names).toEqual(['calm-breathe', 'calm-in', 'calm-spin', 'calm-voice-pulse', 'calmWave', 'gentlePulse', 'island-bell', 'island-halo', 'tab-peek-fade'].sort())
  })
  it('токены CSS и src/motion.ts совпадают', () => {
    const tokens = readFileSync('src/motion.css', 'utf8')
    const ms = (name: string) => Number(tokens.match(new RegExp(`--motion-${name}:\\s*(\\d+)ms`))![1]) / 1000
    for (const [name, value] of Object.entries(motionDuration)) expect(ms(name), name).toBe(value)
    expect(tokens).toContain(`--ease-calm: cubic-bezier(${calmEase.join(', ')})`)
    expect(tokens).toContain(`--ease-exit: cubic-bezier(${exitEase.join(', ')})`)
    expect(tokens).toContain(`--press-opacity: ${String(pressOpacity).replace(/^0/, '')};`)
  })
})
