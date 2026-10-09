import { audioManager } from '../player/audioStream'
import { playZenBowl } from './zenSound'

export type ZenTimerStatus = 'idle' | 'running' | 'completed'

export interface ZenTimerState {
  status: ZenTimerStatus
  durationMinutes: number
  remainingSeconds: number
  progress: number // 0 to 1
  task?: { id: string; title: string }
}

class ZenTimerManager {
  private status: ZenTimerStatus = 'idle'
  private durationMinutes = 30
  private remainingSeconds = 30 * 60
  private timerId: number | null = null
  private listeners: Set<(state: ZenTimerState) => void> = new Set()
  private onCompleteCallback?: () => void
  private startedMusic = false
  private endsAt = 0
  private task?: ZenTimerState['task']

  public subscribe(listener: (state: ZenTimerState) => void): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  public setOnComplete(cb: () => void) {
    this.onCompleteCallback = cb
  }

  public getState(): ZenTimerState {
    const total = this.durationMinutes * 60
    const progress = total > 0 ? (total - this.remainingSeconds) / total : 0
    return {
      status: this.status,
      durationMinutes: this.durationMinutes,
      remainingSeconds: this.remainingSeconds,
      progress,
      task: this.task ? { ...this.task } : undefined
    }
  }

  private notify() {
    const state = this.getState()
    this.listeners.forEach(fn => fn(state))
  }

  public start(minutes = 30, withMusic = true, task?: ZenTimerState['task']) {
    if (this.timerId) window.clearInterval(this.timerId)

    this.durationMinutes = minutes
    this.remainingSeconds = minutes * 60
    this.endsAt = Date.now() + minutes * 60000
    this.status = 'running'
    this.task = task ? { ...task } : undefined
    this.startedMusic = withMusic && !audioManager.getIsPlaying()
    this.notify()

    if (this.startedMusic) {
      audioManager.fadeInAndPlay(2500)
    }

    this.timerId = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000))
      if (seconds > 0) {
        this.remainingSeconds = seconds
        this.notify()
      } else {
        this.complete()
      }
    }, 1000)
  }

  public stop() {
    if (this.timerId) {
      window.clearInterval(this.timerId)
      this.timerId = null
    }
    this.status = 'idle'
    this.task = undefined
    if (this.startedMusic) audioManager.pause()
    this.startedMusic = false
    this.remainingSeconds = this.durationMinutes * 60
    this.notify()
  }

  private async complete() {
    if (this.timerId) {
      window.clearInterval(this.timerId)
      this.timerId = null
    }
    this.status = 'completed'
    this.remainingSeconds = 0
    this.notify()

    // 1. Gently fade out background music
    if (this.startedMusic) await audioManager.fadeOutAndPause(3500)
    this.startedMusic = false

    // 2. Play warm resonant singing bowl
    playZenBowl()

    // 3. Trigger completion modal / prompt in UI
    if (this.onCompleteCallback) {
      this.onCompleteCallback()
    }
  }

  public reset() {
    this.stop()
  }
}

export const zenTimer = new ZenTimerManager()
