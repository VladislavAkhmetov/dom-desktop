import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, FolderInput, Palette, Settings2, User } from 'lucide-react'
import type { UserProfile } from './types'
import { getUserProfile, PROFILE_TONES } from './userProfile'
import { PROFILE_ICONS, ProfileGlyph } from './ProfileGlyph'
import './profile.css'

export interface ProfilePopoverProps {
  profile?: UserProfile
  onChangeProfile: (updates: Partial<UserProfile>) => void
  onOpenSettings: (section?: string) => void
  onOpenImport: () => void
  onOpenWallpaper: () => void
  onClose: () => void
  anchorElement?: HTMLElement | null
}

export function ProfilePopover({
  profile,
  onChangeProfile,
  onOpenSettings,
  onOpenImport,
  onOpenWallpaper,
  onClose,
  anchorElement
}: ProfilePopoverProps) {
  const current = getUserProfile(profile ? { userProfile: profile } as any : undefined)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(current.name)
  const id = useId()

  useLayoutEffect(() => {
    if (!anchorElement) return
    const updatePosition = () => {
      const anchor = anchorElement.getBoundingClientRect()
      const popover = popoverRef.current
      const width = popover?.offsetWidth || 310
      const height = popover?.offsetHeight || 380

      const below = anchor.bottom + 8
      const top = below + height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - height - 8)
      const left = Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12))
      setPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorElement])

  useEffect(() => {
    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !anchorElement?.contains(target)
      ) {
        onClose()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('pointerdown', handleOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, anchorElement])


  const saveName = () => {
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== current.name) {
      onChangeProfile({ name: trimmed })
    }
    setIsEditingName(false)
  }

  return createPortal(
    <div
      ref={popoverRef}
      className="profile-popover"
      style={{ position: 'fixed', top: position.top, left: position.left }}
      role="dialog"
      aria-modal="false"
      aria-label={`Профиль: ${current.name}`}
      id={id}
    >
      <div className="profile-card-header">
        <div className={`profile-avatar-large tone-${current.avatarTone || 'sage'}`}>
          <ProfileGlyph profile={current} size={20} />
        </div>
        <div className="profile-info">
          {isEditingName ? (
            <input
              type="text"
              className="profile-name-input"
              value={nameDraft}
              autoFocus
              maxLength={40}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') {
                  setNameDraft(current.name)
                  setIsEditingName(false)
                }
              }}
              style={{
                fontSize: 15,
                fontWeight: 600,
                padding: '3px 6px',
                borderRadius: 8,
                border: '1px solid rgba(86,118,92,.25)',
                background: 'rgba(255,255,255,.9)',
                color: 'var(--ink)'
              }}
            />
          ) : (
            <button
              type="button"
              className="profile-name"
              onClick={() => {
                setNameDraft(current.name)
                setIsEditingName(true)
              }}
              title="Нажмите, чтобы изменить имя"
              style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              {current.name}
            </button>
          )}
          <span className="profile-status">
            {current.status || 'Личный профиль'}
          </span>
          <span className="profile-badge">
            <User size={12} />
            <span>Локальный профиль</span>
          </span>
        </div>
      </div>

      <div className="profile-customization">
        <div className="profile-section-title">Цвет профиля</div>
        <div className="profile-tones-bar" role="radiogroup" aria-label="Цвет профиля">
          {PROFILE_TONES.map(item => (
            <button
              key={item.tone}
              type="button"
              className={`profile-tone-btn tone-${item.tone} ${current.avatarTone === item.tone ? 'active' : ''}`}
              title={item.label}
              aria-label={item.label}
              aria-checked={current.avatarTone === item.tone}
              role="radio"
              onClick={() => onChangeProfile({ avatarTone: item.tone })}
              style={{
                background: `rgba(var(--space-tint, 186, 216, 185), 0.85)`
              }}
            >
              {current.avatarTone === item.tone && <Check size={12} color="#fff" />}
            </button>
          ))}
        </div>
      </div>

      <div className="profile-customization">
        <div className="profile-section-title">Значок</div>
        <div className="profile-emojis-bar">
          {PROFILE_ICONS.map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              className={`profile-emoji-btn ${current.avatarEmoji === id ? 'active' : ''}`}
              onClick={() => onChangeProfile({ avatarEmoji: id })}
              aria-label={`Значок: ${label}`}
              aria-pressed={current.avatarEmoji === id}
            >
              <Icon size={16} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            className="profile-emoji-clear"
            onClick={() => onChangeProfile({ avatarEmoji: '' })}
            title="Использовать первую букву имени"
          >
            {current.name.charAt(0).toUpperCase() || 'АБ'}
          </button>
        </div>
      </div>

      <div className="profile-divider" />

      <div className="profile-actions">
        <button
          type="button"
          className="profile-action-btn"
          onClick={() => {
            onClose()
            onOpenImport()
          }}
        >
          <FolderInput size={17} />
          <span>Импорт из Chrome (закладки)</span>
        </button>

        <button
          type="button"
          className="profile-action-btn"
          onClick={() => {
            onClose()
            onOpenWallpaper()
          }}
        >
          <Palette size={17} />
          <span>Фон и оформление</span>
        </button>

        <button
          type="button"
          className="profile-action-btn"
          onClick={() => {
            onClose()
            onOpenSettings('profile')
          }}
        >
          <Settings2 size={17} />
          <span>Настройки профиля</span>
        </button>
      </div>
    </div>,
    document.body
  )
}
