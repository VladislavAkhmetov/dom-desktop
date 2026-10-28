import { describe, expect, it } from 'vitest'
import { renderPluck } from '../src/sound'

// Guards the «not digital, not alarming» sound rules (docs/calm-sound-engine.md) on the pure pluck model.
const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const rms = (data: Float32Array, from: number, to: number) => Math.sqrt(data.slice(from, to).reduce((sum, v) => sum + v * v, 0) / Math.max(1, to - from))

describe('Спокойные звуки', () => {
  const sr = 48000
  for (const freq of [329.63, 392, 493.88, 523.25]) it(`щипок ${freq} Гц: тёплый, без верхов, затухает`, () => {
    const data = renderPluck(sr, freq, 1.2, 0.996, seeded(7))
    expect(Math.max(...data.map(Math.abs))).toBeLessThanOrEqual(1)
    // Zero-crossing rate ≈ 2 × dominant frequency: no energy drifting into the 2.5 kHz «alarm» band
    let crossings = 0; for (let i = 1; i < sr * 0.2; i++) if ((data[i - 1] < 0) !== (data[i] < 0)) crossings++
    expect(crossings / 0.2 / 2).toBeLessThan(2000) // raw model before the engine's low-pass; the rule is < 2.5 kHz
    expect(rms(data, data.length - sr * 0.1, data.length)).toBeLessThan(rms(data, 0, sr * 0.1) * 0.6)
  })
  it('уровень одинаковый при разном тембре (нормализация удара)', () => {
    const peaks = [1, 2, 3, 4, 5].map(seed => Math.max(...renderPluck(sr, 392, 0.3, 0.996, seeded(seed)).map(Math.abs)))
    expect(Math.max(...peaks) - Math.min(...peaks)).toBeLessThan(0.05)
  })
})
