import { BookOpen, Coffee, Laptop, Leaf, Palette, Rocket, Sparkle, Zap, type LucideIcon } from 'lucide-react'
import { PROFILE_ICON_IDS, profileIconId, type ProfileIconId } from './userProfile'
import type { UserProfile } from './types'

// Profile marks come from the project's icon set (lucide), not emoji.
const ICONS: Record<ProfileIconId, { Icon: LucideIcon; label: string }> = {
  leaf: { Icon: Leaf, label: 'Лист' },
  coffee: { Icon: Coffee, label: 'Кофе' },
  zap: { Icon: Zap, label: 'Молния' },
  palette: { Icon: Palette, label: 'Палитра' },
  book: { Icon: BookOpen, label: 'Книга' },
  laptop: { Icon: Laptop, label: 'Ноутбук' },
  rocket: { Icon: Rocket, label: 'Ракета' },
  sparkle: { Icon: Sparkle, label: 'Искра' }
}

export const PROFILE_ICONS = PROFILE_ICON_IDS.map(id => ({ id, ...ICONS[id] }))

/** The avatar content: the chosen icon, otherwise the first letter of the name. */
export function ProfileGlyph({ profile, size = 16 }: { profile: Pick<UserProfile, 'name' | 'avatarEmoji'>; size?: number }) {
  const id = profileIconId(profile.avatarEmoji)
  const icon = id ? ICONS[id] : undefined
  if (icon) return <icon.Icon size={size} strokeWidth={2} aria-hidden="true" />
  return <>{profile.name.trim().charAt(0).toUpperCase() || 'П'}</>
}
