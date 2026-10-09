import type { AppState, SpaceTone, UserProfile } from './types'

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Пользователь',
  avatarTone: 'sage',
  avatarEmoji: '',
  status: ''
}

export const PROFILE_TONES: { tone: SpaceTone; label: string }[] = [
  { tone: 'sage', label: 'Шалфей' },
  { tone: 'lilac', label: 'Лаванда' },
  { tone: 'sand', label: 'Песок' },
  { tone: 'blue', label: 'Лазурь' }
]

export const PROFILE_EMOJIS = ['🌿', '☕', '⚡', '🎨', '📚', '💻', '🚀', '✳']

export function getUserProfile(state?: AppState | null): UserProfile {
  return {
    name: state?.userProfile?.name?.trim() || DEFAULT_PROFILE.name,
    avatarTone: state?.userProfile?.avatarTone || DEFAULT_PROFILE.avatarTone,
    avatarEmoji: state?.userProfile?.avatarEmoji || '',
    status: state?.userProfile?.status || ''
  }
}

export function updateUserProfile(state: AppState, updates: Partial<UserProfile>): AppState {
  const current = getUserProfile(state)
  const nextProfile: UserProfile = {
    ...current,
    ...updates,
    name: updates.name !== undefined ? (updates.name.trim().slice(0, 50) || DEFAULT_PROFILE.name) : current.name,
    status: updates.status !== undefined ? updates.status.trim().slice(0, 80) : current.status
  }
  return {
    ...state,
    userProfile: nextProfile
  }
}
