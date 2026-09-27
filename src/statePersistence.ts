import { useEffect, useRef, useState } from 'react'
import type { AppState } from './types'
import { applyChanges, diffState, migrateState, type StateChange } from '../shared/state'
import { bridge } from './bridge'
import { exampleDay, isDemo, saveExample } from './demo'

export function usePersistentState(onError: (message: string) => void) {
  const [state, setState] = useState<AppState | null>(null)
  const current = useRef<AppState | null>(null)
  const base = useRef<AppState | null>(null)
  const pending = useRef<{ id: number; changes: StateChange[] }[]>([])
  const sequence = useRef(0)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const errors = useRef(onError)
  errors.current = onError
  const publish = (value: AppState) => { current.current = value; setState(value) }
  const rebase = (remote: AppState) => {
    if (base.current && (remote.revision || 0) < (base.current.revision || 0)) return
    base.current = remote
    publish(pending.current.reduce((value, request) => applyChanges(value, request.changes), remote))
  }
  useEffect(() => {
    let active = true
    ;(isDemo ? Promise.resolve(migrateState(exampleDay())) : bridge.getState()).then(value => { if (active) rebase(value) }).catch(error => errors.current(`Не удалось загрузить данные: ${error.message}`))
    const off = bridge.onStateChanged(value => { if (active && !isDemo) rebase(value) })
    return () => { active = false; off() }
  }, [])
  function commit(updater: (previous: AppState) => AppState) {
    const previous = current.current
    if (!previous) return
    const next = updater(previous)
    const changes = diffState(previous, next)
    if (!changes.length) return Promise.resolve(true)
    if (isDemo) { publish(next); saveExample(next); return Promise.resolve(true) }
    const id = ++sequence.current
    pending.current.push({ id, changes })
    publish(next)
    queue.current = queue.current.catch(() => undefined).then(async () => {
      try {
        const remote = await bridge.applyChanges(changes)
        pending.current = pending.current.filter(request => request.id !== id)
        rebase(remote)
        return true
      } catch (error) {
        pending.current = pending.current.filter(request => request.id !== id)
        if (base.current) rebase(base.current)
        errors.current(`Изменение не сохранилось: ${error instanceof Error ? error.message : 'ошибка хранения'}`)
        return false
      }
    })
    return queue.current
  }
  function replace(value: AppState) { commit(() => migrateState(value)) }
  return { state, commit, replace }
}
