import type { AppState } from '../src/types'
export interface StateChange { op: 'set' | 'remove' | 'order'; path: string[]; value?: unknown }
export function emptyState(): AppState
export function localDate(value: string | Date): string | null
export function migrateState(input: unknown): AppState
export function diffState(before: unknown, after: unknown, path?: string[]): StateChange[]
export function applyChanges(input: AppState, changes: StateChange[]): AppState
