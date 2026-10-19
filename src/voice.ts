import { useCallback, useEffect, useRef, useState } from 'react'
import { bridge } from './bridge'
import { sound } from './sound'

export type VoiceStatus = 'idle' | 'listening' | 'transcribing' | 'error'

export interface VoiceCaptureOptions {
  onTranscribed?: (text: string) => void
  onError?: (error: string) => void
}

export function isAudioRecordingSupported(): boolean {
  return typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  const win = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition)
}

export class AudioRecorder {
  private mediaStream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private startTime = 0

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  async start(): Promise<void> {
    if (!isAudioRecordingSupported()) {
      throw new Error('Запись звука не поддерживается в этом окружении')
    }
    this.cleanup()
    this.chunks = []
    this.startTime = Date.now()

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    })

    const mimeType = typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''

    this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined)
    this.mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data)
      }
    }
    this.mediaRecorder.start(200)
  }

  async stop(): Promise<{ buffer: ArrayBuffer; mimeType: string; durationMs: number }> {
    return new Promise((resolve, reject) => {
      const recorder = this.mediaRecorder
      if (!recorder || recorder.state === 'inactive') {
        this.cleanup()
        return reject(new Error('Запись не была запущена'))
      }

      recorder.onstop = async () => {
        try {
          const mimeType = recorder.mimeType || 'audio/webm'
          const blob = new Blob(this.chunks, { type: mimeType })
          let buffer: ArrayBuffer
          if (typeof blob.arrayBuffer === 'function') {
            buffer = await blob.arrayBuffer()
          } else if (typeof Response !== 'undefined') {
            buffer = await new Response(blob).arrayBuffer()
          } else {
            buffer = await new Promise<ArrayBuffer>((res, rej) => {
              const reader = new FileReader()
              reader.onload = () => res(reader.result as ArrayBuffer)
              reader.onerror = () => rej(reader.error)
              reader.readAsArrayBuffer(blob)
            })
          }
          const durationMs = Date.now() - this.startTime
          this.cleanup()
          resolve({ buffer, mimeType, durationMs })
        } catch (err) {
          this.cleanup()
          reject(err)
        }
      }

      recorder.stop()
    })
  }

  cleanup(): void {
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        try { track.stop() } catch { /* ignore */ }
      }
      this.mediaStream = null
    }
    this.mediaRecorder = null
    this.chunks = []
  }
}

export function useVoiceCapture({ onTranscribed, onError }: VoiceCaptureOptions = {}) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<AudioRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const speechTranscriptRef = useRef<string>('')

  const isSupported = isAudioRecordingSupported() || isSpeechRecognitionSupported()

  const cleanupAll = useCallback(() => {
    recorderRef.current?.cleanup()
    recorderRef.current = null
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanupAll()
    }
  }, [cleanupAll])

  const start = useCallback(async () => {
    setError(null)
    speechTranscriptRef.current = ''

    if (!isSupported) {
      const err = 'Голосовой ввод не поддерживается на этом устройстве'
      setError(err)
      setStatus('error')
      onError?.(err)
      return
    }

    try {
      // 1. Start audio recording
      if (isAudioRecordingSupported()) {
        const recorder = new AudioRecorder()
        recorderRef.current = recorder
        await recorder.start()
      }

      // 2. Parallel Web Speech API if available
      if (isSpeechRecognitionSupported()) {
        try {
          const win = window as any
          const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition
          if (SpeechRecognitionClass) {
            const recognition = new SpeechRecognitionClass()
            recognition.lang = 'ru-RU'
            recognition.continuous = false
            recognition.interimResults = false
            recognition.onresult = (event: any) => {
              const transcript = event.results?.[0]?.[0]?.transcript
              if (transcript) speechTranscriptRef.current = transcript.trim()
            }
            recognition.onerror = () => { /* ignore, fallback to Whisper API */ }
            recognition.start()
            recognitionRef.current = recognition
          }
        } catch {
          // ignore web speech error, recorder handles audio buffer
        }
      }

      setStatus('listening')
    } catch (err: any) {
      cleanupAll()
      let message = 'Не удалось получить доступ к микрофону'
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        message = 'Доступ к микрофону запрещён в настройках системы'
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        message = 'Микрофон не найден'
      } else if (err?.message) {
        message = err.message
      }
      setError(message)
      setStatus('error')
      onError?.(message)
    }
  }, [isSupported, onError, cleanupAll])

  const stop = useCallback(async (): Promise<string | null> => {
    if (status !== 'listening') return null

    setStatus('transcribing')

    // Stop Web Speech if active
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
    }

    let recordedAudio: { buffer: ArrayBuffer; mimeType: string; durationMs: number } | null = null
    if (recorderRef.current?.isRecording) {
      try {
        recordedAudio = await recorderRef.current.stop()
      } catch (err) {
        console.warn('Audio recording stop error:', err)
      }
    }
    cleanupAll()

    let resultText = speechTranscriptRef.current.trim()

    // If Web Speech didn't produce text or wasn't available, try Whisper API through Electron bridge
    if (!resultText && recordedAudio && bridge.integrations?.transcribeAudio) {
      try {
        const response = await bridge.integrations.transcribeAudio(recordedAudio.buffer, recordedAudio.mimeType)
        if (response?.text) {
          resultText = response.text.trim()
        }
      } catch (err: any) {
        console.warn('Whisper API transcribe error:', err)
        const errMsg = err?.message || 'Не удалось распознать запись'
        setError(errMsg)
        setStatus('error')
        onError?.(errMsg)
        return null
      }
    }

    if (!resultText) {
      const errMsg = 'Голос не распознан. Подключите AI-ключ в настройках или введите текст вручную.'
      setError(errMsg)
      setStatus('error')
      onError?.(errMsg)
      return null
    }

    setError(null)
    setStatus('idle')
    onTranscribed?.(resultText)
    return resultText
  }, [status, onError, onTranscribed, cleanupAll])

  const cancel = useCallback(() => {
    cleanupAll()
    setStatus('idle')
    setError(null)
  }, [cleanupAll])

  const toggle = useCallback(() => {
    const nextListening = status !== 'listening'
    sound.playCaptureToggle(nextListening)
    if (status === 'listening') {
      void stop()
    } else {
      void start()
    }
  }, [status, start, stop])

  return {
    status,
    error,
    isSupported,
    start,
    stop,
    cancel,
    toggle,
  }
}
