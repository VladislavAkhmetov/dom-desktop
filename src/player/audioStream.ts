export interface RadioStation {
  id: string
  name: string
  subtitle: string
  streamUrl: string
  tag: string
}

export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'lofigirl',
    name: 'Lofi Girl',
    subtitle: 'Beats to relax & study',
    streamUrl: 'https://play.streamafrica.net/lofigirl',
    tag: 'Lo-Fi'
  },
  {
    id: 'somafm-groove',
    name: 'Groove Salad',
    subtitle: 'Downtempo ambient chill',
    streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
    tag: 'Ambient'
  },
  {
    id: 'chillhop',
    name: 'Chillhop Cafe',
    subtitle: 'Mellow instrumental flow',
    streamUrl: 'https://streams.ilovemusic.de/iloveradio17.mp3',
    tag: 'Chill'
  },
  {
    id: 'somafm-drone',
    name: 'Drone Zone',
    subtitle: 'Deep atmospheric soundscapes',
    streamUrl: 'https://ice1.somafm.com/dronezone-128-mp3',
    tag: 'Focus'
  }
]

export type MusicProvider = 'lofi' | 'spotify' | 'yandex'

class AudioManager {
  private audio: HTMLAudioElement | null = null
  private currentStationIndex = 0
  private currentProvider: MusicProvider = 'lofi'
  private isPlaying = false
  private volume = 0.65
  private listeners: Set<() => void> = new Set()
  private fadeInterval: number | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio()
      this.audio.preload = 'none'
      this.audio.volume = this.volume

      this.audio.addEventListener('playing', () => {
        this.isPlaying = true
        this.notify()
      })

      this.audio.addEventListener('pause', () => {
        this.isPlaying = false
        this.notify()
      })

      this.audio.addEventListener('error', () => {
        this.isPlaying = false
        this.notify()
      })
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach(fn => fn())
  }

  public getStation(): RadioStation {
    return RADIO_STATIONS[this.currentStationIndex]
  }

  public getStationIndex(): number {
    return this.currentStationIndex
  }

  public getProvider(): MusicProvider {
    return this.currentProvider
  }

  public setProvider(provider: MusicProvider) {
    this.currentProvider = provider
    if (provider !== 'lofi' && this.isPlaying) {
      this.pause()
    }
    this.notify()
  }

  public getIsPlaying(): boolean {
    return this.isPlaying
  }

  public getVolume(): number {
    return this.volume
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val))
    if (this.audio) this.audio.volume = this.volume
    this.notify()
  }

  public setStation(index: number) {
    if (index < 0 || index >= RADIO_STATIONS.length) return
    const wasPlaying = this.isPlaying
    this.currentStationIndex = index

    if (this.audio) {
      this.audio.src = RADIO_STATIONS[index].streamUrl
      if (wasPlaying) {
        this.audio.play().catch(() => { this.isPlaying = false; this.notify() })
      }
    }
    this.notify()
  }

  public nextStation() {
    const nextIdx = (this.currentStationIndex + 1) % RADIO_STATIONS.length
    this.setStation(nextIdx)
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause()
    } else {
      this.play()
    }
  }

  public play() {
    if (!this.audio) return
    if (!this.audio.src || this.audio.src === '' || this.audio.src === window.location.href) {
      this.audio.src = this.getStation().streamUrl
    }
    this.audio.volume = this.volume
    this.audio.play().catch(e => {
      console.warn('Playback error:', e)
      this.isPlaying = false
      this.notify()
    })
  }

  public pause() {
    if (!this.audio) return
    this.audio.pause()
  }

  /**
   * Smoothly fades out audio over given milliseconds, then pauses.
   */
  public fadeOutAndPause(durationMs = 3000): Promise<void> {
    return new Promise(resolve => {
      if (!this.audio || !this.isPlaying) {
        resolve()
        return
      }

      if (this.fadeInterval) window.clearInterval(this.fadeInterval)

      const startVol = this.audio.volume
      const steps = 25
      const stepTime = durationMs / steps
      const volStep = startVol / steps

      this.fadeInterval = window.setInterval(() => {
        if (!this.audio) {
          if (this.fadeInterval) clearInterval(this.fadeInterval)
          resolve()
          return
        }

        const nextVol = Math.max(0, this.audio.volume - volStep)
        this.audio.volume = nextVol

        if (nextVol <= 0.02) {
          if (this.fadeInterval) clearInterval(this.fadeInterval)
          this.audio.pause()
          this.audio.volume = this.volume // reset target volume
          this.isPlaying = false
          this.notify()
          resolve()
        }
      }, stepTime)
    })
  }

  /**
   * Smoothly fades in audio when starting focus session.
   */
  public fadeInAndPlay(durationMs = 2500): Promise<void> {
    return new Promise(resolve => {
      if (!this.audio) {
        resolve()
        return
      }

      if (this.fadeInterval) window.clearInterval(this.fadeInterval)

      if (!this.audio.src || this.audio.src === window.location.href) {
        this.audio.src = this.getStation().streamUrl
      }

      const targetVol = this.volume
      this.audio.volume = 0
      this.audio.play().catch(() => undefined)

      const steps = 25
      const stepTime = durationMs / steps
      const volStep = targetVol / steps

      this.fadeInterval = window.setInterval(() => {
        if (!this.audio) {
          if (this.fadeInterval) clearInterval(this.fadeInterval)
          resolve()
          return
        }

        const nextVol = Math.min(targetVol, this.audio.volume + volStep)
        this.audio.volume = nextVol

        if (nextVol >= targetVol - 0.02) {
          if (this.fadeInterval) clearInterval(this.fadeInterval)
          this.audio.volume = targetVol
          resolve()
        }
      }, stepTime)
    })
  }
}

export const audioManager = new AudioManager()
