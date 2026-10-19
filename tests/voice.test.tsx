// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  AudioRecorder,
  isAudioRecordingSupported,
  isSpeechRecognitionSupported,
  useVoiceCapture
} from '../src/voice'
import { bridge } from '../src/bridge'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function () {
    return new Uint8Array([1, 2, 3, 4]).buffer
  }
}

describe('voice module', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('feature detection', () => {
    it('detects missing MediaRecorder in standard environment', () => {
      expect(typeof isAudioRecordingSupported()).toBe('boolean')
      expect(typeof isSpeechRecognitionSupported()).toBe('boolean')
    })
  })

  describe('AudioRecorder', () => {
    it('throws if recording is not supported', async () => {
      const recorder = new AudioRecorder()
      await expect(recorder.start()).rejects.toThrow('не поддерживается')
    })

    it('records audio chunks and stops tracks on stop', async () => {
      const stopTrack = vi.fn()
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: stopTrack }])
      }

      class MockMediaRecorder {
        state = 'inactive'
        mimeType = 'audio/webm'
        ondataavailable: ((event: any) => void) | null = null
        onstop: (() => void) | null = null

        start() {
          this.state = 'recording'
          setTimeout(() => {
            this.ondataavailable?.({ data: new Blob(['chunk'], { type: 'audio/webm' }) })
          }, 10)
        }

        stop() {
          this.state = 'inactive'
          setTimeout(() => {
            this.onstop?.()
          }, 10)
        }

        static isTypeSupported() {
          return true
        }
      }

      const originalMediaDevices = navigator.mediaDevices
      const originalMediaRecorder = (globalThis as any).MediaRecorder

      try {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: {
            getUserMedia: vi.fn().mockResolvedValue(mockStream)
          },
          configurable: true
        });
        (globalThis as any).MediaRecorder = MockMediaRecorder

        const recorder = new AudioRecorder()
        await recorder.start()
        expect(recorder.isRecording).toBe(true)

        const result = await recorder.stop()
        expect(result.mimeType).toBe('audio/webm')
        expect(result.buffer).toBeInstanceOf(ArrayBuffer)
        expect(stopTrack).toHaveBeenCalled()
        expect(recorder.isRecording).toBe(false)
      } finally {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: originalMediaDevices,
          configurable: true
        });
        (globalThis as any).MediaRecorder = originalMediaRecorder
      }
    })
  })

  describe('useVoiceCapture in React', () => {
    it('initializes in idle state and reports supported status', async () => {
      let captureState: any = null
      function TestComponent() {
        captureState = useVoiceCapture()
        return null
      }

      const container = document.createElement('div')
      const root = createRoot(container)
      await act(async () => {
        root.render(<TestComponent />)
      })

      expect(captureState.status).toBe('idle')
      expect(captureState.error).toBeNull()
      expect(typeof captureState.start).toBe('function')
      expect(typeof captureState.stop).toBe('function')
      expect(typeof captureState.toggle).toBe('function')

      await act(async () => {
        root.unmount()
      })
    })

    it('invokes transcribeAudio bridge when audio is recorded', async () => {
      const stopTrack = vi.fn()
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: stopTrack }])
      }

      class MockMediaRecorder {
        state = 'inactive'
        mimeType = 'audio/webm'
        ondataavailable: ((event: any) => void) | null = null
        onstop: (() => void) | null = null

        start() {
          this.state = 'recording'
          setTimeout(() => {
            this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) })
          }, 10)
        }

        stop() {
          this.state = 'inactive'
          setTimeout(() => {
            this.onstop?.()
          }, 10)
        }

        static isTypeSupported() {
          return true
        }
      }

      const originalMediaDevices = navigator.mediaDevices
      const originalMediaRecorder = (globalThis as any).MediaRecorder

      try {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: {
            getUserMedia: vi.fn().mockResolvedValue(mockStream)
          },
          configurable: true
        });
        (globalThis as any).MediaRecorder = MockMediaRecorder

        if (!bridge.integrations) {
          bridge.integrations = {} as any
        }
        bridge.integrations.transcribeAudio = vi.fn().mockResolvedValue({ text: 'Напомнить через 10 минут' })

        const onTranscribed = vi.fn()
        let captureState: any = null
        function TestComponent() {
          captureState = useVoiceCapture({ onTranscribed })
          return null
        }

        const container = document.createElement('div')
        const root = createRoot(container)
        await act(async () => {
          root.render(<TestComponent />)
        })

        await act(async () => {
          await captureState.start()
        })
        expect(captureState.status).toBe('listening')

        let result: any = null
        await act(async () => {
          result = await captureState.stop()
        })

        expect(result).toBe('Напомнить через 10 минут')
        expect(onTranscribed).toHaveBeenCalledWith('Напомнить через 10 минут')
        expect(captureState.status).toBe('idle')

        await act(async () => {
          root.unmount()
        })
      } finally {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: originalMediaDevices,
          configurable: true
        });
        (globalThis as any).MediaRecorder = originalMediaRecorder
      }
    })
  })
})
