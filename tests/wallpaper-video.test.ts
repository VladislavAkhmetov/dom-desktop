import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WALLPAPER,
  FALLBACK_IMAGE_WALLPAPER,
  defaultWallpapers,
  isVideoWallpaper,
  resolveWallpaperUrl
} from '../src/WallpaperPicker'

describe('Видеофон и сохранение статических изображений', () => {
  it('корректно определяет видеоформаты обоев', () => {
    expect(isVideoWallpaper('/bg.mp4')).toBe(true)
    expect(isVideoWallpaper('/video/ambient.webm')).toBe(true)
    expect(isVideoWallpaper('/video/nature.ogg')).toBe(true)
    expect(isVideoWallpaper('data:video/mp4;base64,AAAA')).toBe(true)
    expect(isVideoWallpaper('/backgrounds/abstract-hills.jpg')).toBe(false)
    expect(isVideoWallpaper('/meadow-background-v2.png')).toBe(false)
    expect(isVideoWallpaper(undefined)).toBe(false)
    expect(isVideoWallpaper('')).toBe(false)
  })

  it('сохраняет все исходные фоновые изображения и новые спокойные темы в списке пресетов', () => {
    const urls = defaultWallpapers.map(preset => preset.url)
    expect(urls).toContain('/bg.mp4')
    expect(urls).toContain('/backgrounds/abstract-sky.jpg')
    expect(urls).toContain('/backgrounds/abstract-ocean.jpg')
    expect(urls).toContain('/backgrounds/abstract-hills.jpg')
    expect(urls).toContain('/backgrounds/abstract-morning.jpg')
    expect(urls).toContain('/backgrounds/abstract-dusk.jpg')
    expect(urls).toContain('/meadow-background-v2.png')
  })

  it('предоставляет резервное статическое изображение для доступности и reduced-motion', () => {
    expect(FALLBACK_IMAGE_WALLPAPER).toBe('/backgrounds/abstract-hills.jpg')
    expect(resolveWallpaperUrl(FALLBACK_IMAGE_WALLPAPER)).toContain('/backgrounds/abstract-hills.jpg')
  })

  it('по умолчанию выбран статичный фон с волнами холмов', () => {
    expect(DEFAULT_WALLPAPER).toBe('/backgrounds/abstract-hills.jpg')
    expect(isVideoWallpaper(DEFAULT_WALLPAPER)).toBe(false)
  })

  it('resolveWallpaperUrl корректно возвращает путь к видео и изображениям', () => {
    expect(resolveWallpaperUrl('/bg.mp4')).toBe('/bg.mp4')
    expect(resolveWallpaperUrl()).toBe(DEFAULT_WALLPAPER)
  })
})
