// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CalmSoundEngine, sound } from '../src/sound'

describe('CalmSoundEngine', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('по умолчанию включен и читает сохраненное значение из localStorage', () => {
    localStorage.setItem('dombro:sound-enabled', 'false')
    const engine = new CalmSoundEngine()
    expect(engine.enabled).toBe(false)

    localStorage.setItem('dombro:sound-enabled', 'true')
    const engine2 = new CalmSoundEngine()
    expect(engine2.enabled).toBe(true)
  })

  it('toggle переключает состояние и сохраняет его в localStorage', () => {
    const engine = new CalmSoundEngine()
    engine.enabled = true
    const next = engine.toggle()
    expect(next).toBe(false)
    expect(engine.enabled).toBe(false)
    expect(localStorage.getItem('dombro:sound-enabled')).toBe('false')

    const next2 = engine.toggle()
    expect(next2).toBe(true)
    expect(engine.enabled).toBe(true)
    expect(localStorage.getItem('dombro:sound-enabled')).toBe('true')
  })

  it('безопасно работает без AudioContext в JSDOM без ошибок', () => {
    const engine = new CalmSoundEngine()
    expect(() => {
      engine.playWoodSnap('hover')
      engine.playWoodSnap('land')
      engine.playPaperFold()
      engine.playCaptureToggle(true)
      engine.playCaptureToggle(false)
      engine.playCalmExhale()
    }).not.toThrow()
  })

  it('при наличии AudioContext синтезирует тактильные звуки с фильтрами без ошибок', () => {
    const createdNodes: string[] = []

    const mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    }

    const mockFilter = {
      type: 'lowpass',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      Q: {
        setValueAtTime: vi.fn()
      },
      connect: vi.fn()
    }

    const mockBufferSource = {
      buffer: null as any,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }

    class MockAudioContext {
      currentTime = 0.5
      sampleRate = 44100
      state = 'running'
      destination = {}

      createOscillator() {
        createdNodes.push('oscillator')
        return { ...mockOscillator }
      }

      createGain() {
        createdNodes.push('gain')
        return { ...mockGain }
      }

      createBiquadFilter() {
        createdNodes.push('filter')
        return { ...mockFilter }
      }

      createBuffer(channels: number, length: number, sampleRate: number) {
        createdNodes.push('buffer')
        const channelData = new Float32Array(length)
        return {
          getChannelData: () => channelData
        }
      }

      createBufferSource() {
        createdNodes.push('bufferSource')
        return { ...mockBufferSource }
      }

      resume() {
        return Promise.resolve()
      }
    }

    (window as any).AudioContext = MockAudioContext

    const engine = new CalmSoundEngine()
    engine.enabled = true

    // 1. Деревянный щелчок
    createdNodes.length = 0
    engine.playWoodSnap('land')
    expect(createdNodes).toContain('oscillator')
    expect(createdNodes).toContain('filter')
    expect(createdNodes).toContain('gain')

    // 2. Шелест бумаги
    createdNodes.length = 0
    engine.playPaperFold()
    expect(createdNodes).toContain('buffer')
    expect(createdNodes).toContain('bufferSource')
    expect(createdNodes).toContain('filter')
    expect(createdNodes).toContain('gain')

    // 3. Тумблер
    createdNodes.length = 0
    engine.playCaptureToggle(true)
    expect(createdNodes).toContain('oscillator')
    expect(createdNodes).toContain('gain')

    // 4. Выдох / сброс
    createdNodes.length = 0
    engine.playCalmExhale()
    expect(createdNodes).toContain('buffer')
    expect(createdNodes).toContain('bufferSource')
    expect(createdNodes).toContain('filter')
    expect(createdNodes).toContain('gain')

    // При отключении звука методы ничего не вызывают
    engine.enabled = false
    createdNodes.length = 0
    engine.playWoodSnap('land')
    engine.playPaperFold()
    engine.playCaptureToggle(true)
    engine.playCalmExhale()
    expect(createdNodes.length).toBe(0)

    delete (window as any).AudioContext
  })
})
