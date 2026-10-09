// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePopover } from '../src/ProfilePopover'
import { getUserProfile, updateUserProfile, DEFAULT_PROFILE } from '../src/userProfile'
import type { AppState, UserProfile } from '../src/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root
const onClose = vi.fn()
const onOpenSettings = vi.fn()
const onOpenImport = vi.fn()
const onOpenWallpaper = vi.fn()
const onChangeProfile = vi.fn()

beforeEach(() => {
  onClose.mockReset()
  onOpenSettings.mockReset()
  onOpenImport.mockReset()
  onOpenWallpaper.mockReset()
  onChangeProfile.mockReset()
  document.body.innerHTML = '<div id="test-root"></div><button id="anchor-btn">Anchor</button>'
  root = createRoot(document.getElementById('test-root')!)
})

afterEach(async () => {
  await act(async () => root.unmount())
})

describe('модель профиля пользователя', () => {
  it('возвращает значения по умолчанию для пустого состояния', () => {
    const profile = getUserProfile(null)
    expect(profile.name).toBe(DEFAULT_PROFILE.name)
    expect(profile.avatarTone).toBe('sage')
    expect(profile.avatarEmoji).toBe('')
  })

  it('обновляет профиль в состоянии приложения', () => {
    const state: AppState = { version: 2, spaces: [], reminders: [], dismissedUntil: null }
    const updated = updateUserProfile(state, { name: 'Алексей', avatarTone: 'lilac', status: 'В работе' })
    expect(updated.userProfile).toEqual({
      name: 'Алексей',
      avatarTone: 'lilac',
      avatarEmoji: '',
      status: 'В работе'
    })
  })
})

describe('ProfilePopover компонент', () => {
  it('отображает имя, аватар и позволяет менять цвет и эмодзи', async () => {
    const anchor = document.getElementById('anchor-btn')!
    const profile: UserProfile = { name: 'Елена', avatarTone: 'sand', status: 'Дизайн' }

    await act(async () => {
      root.render(
        <ProfilePopover
          profile={profile}
          onChangeProfile={onChangeProfile}
          onOpenSettings={onOpenSettings}
          onOpenImport={onOpenImport}
          onOpenWallpaper={onOpenWallpaper}
          onClose={onClose}
          anchorElement={anchor}
        />
      )
    })

    const popover = document.querySelector('.profile-popover')!
    expect(popover).not.toBeNull()
    expect(popover.textContent).toContain('Елена')
    expect(popover.textContent).toContain('Дизайн')

    // Change tone
    const lilacBtn = document.querySelector<HTMLButtonElement>('.profile-tone-btn.tone-lilac')!
    await act(async () => lilacBtn.click())
    expect(onChangeProfile).toHaveBeenCalledWith({ avatarTone: 'lilac' })

    // Change emoji
    const emojiBtn = document.querySelector<HTMLButtonElement>('.profile-emoji-btn')!
    await act(async () => emojiBtn.click())
    expect(onChangeProfile).toHaveBeenCalledWith({ avatarEmoji: expect.any(String) })

    // Open import
    const importBtn = [...document.querySelectorAll<HTMLButtonElement>('.profile-action-btn')].find(b => b.textContent?.includes('Импорт'))!
    await act(async () => importBtn.click())
    expect(onOpenImport).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('закрывается по клавише Escape', async () => {
    const anchor = document.getElementById('anchor-btn')!
    await act(async () => {
      root.render(
        <ProfilePopover
          profile={{ name: 'Пользователь' }}
          onChangeProfile={onChangeProfile}
          onOpenSettings={onOpenSettings}
          onOpenImport={onOpenImport}
          onOpenWallpaper={onOpenWallpaper}
          onClose={onClose}
          anchorElement={anchor}
        />
      )
    })

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
