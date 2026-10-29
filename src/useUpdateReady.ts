import { useEffect, useState } from 'react'
import type { AppUpdate } from './types'
import { bridge } from './bridge'

let currentUpdateReady: AppUpdate | null = null
const updateListeners = new Set<(update: AppUpdate | null) => void>()

if (typeof window !== 'undefined') {
  bridge.onUpdateReady?.((data) => {
    currentUpdateReady = data
    updateListeners.forEach(fn => fn(data))
  })
}

export function useUpdateReady() {
  const [update, setUpdate] = useState<AppUpdate | null>(currentUpdateReady)
  useEffect(() => {
    const listener = (data: AppUpdate | null) => setUpdate(data)
    updateListeners.add(listener)
    return () => { updateListeners.delete(listener) }
  }, [])
  return update
}

/** For tests or manual preview */
export function setMockUpdateReady(data: AppUpdate | null) {
  currentUpdateReady = data
  updateListeners.forEach(fn => fn(data))
}
