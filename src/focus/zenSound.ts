/**
 * Synthesizes a soothing Tibetan Singing Bowl / Zen Chime using Web Audio API.
 * 100% local, no external audio files required, zero latency.
 */
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

export function playZenBowl(): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // Frequencies of a Tibetan singing bowl (fundamental + overtone partials)
    const baseFreq = 432 // 432 Hz calming frequency
    const partials = [
      { ratio: 1.0, gain: 0.35, decay: 4.5 },
      { ratio: 2.71, gain: 0.22, decay: 3.8 },
      { ratio: 4.25, gain: 0.12, decay: 2.5 },
      { ratio: 5.85, gain: 0.06, decay: 1.8 }
    ]

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.7, now)
    masterGain.connect(ctx.destination)

    partials.forEach(({ ratio, gain: partGain, decay }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(baseFreq * ratio, now)

      // Slight subtle vibrato (detune LFO)
      osc.detune.setValueAtTime(Math.random() * 4 - 2, now)

      gain.gain.setValueAtTime(0, now)
      // Soft attack (30ms) to prevent clicks
      gain.gain.linearRampToValueAtTime(partGain, now + 0.04)
      // Long exponential decay
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay)

      osc.connect(gain)
      gain.connect(masterGain)

      osc.start(now)
      osc.stop(now + decay + 0.1)
    })
  } catch (err) {
    console.warn('Zen chime audio failed:', err)
  }
}
