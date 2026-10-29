import { useRef, useState } from 'react'
import { Check, Film, Link2, RotateCcw, Upload, X } from 'lucide-react'

export interface WallpaperOption {
  id: string
  name: string
  url: string
  description?: string
}

export const FALLBACK_IMAGE_WALLPAPER = '/backgrounds/abstract-hills.jpg'
export const DEFAULT_WALLPAPER = '/backgrounds/abstract-hills.jpg'

export function isVideoWallpaper(url?: string): boolean {
  if (!url) return false
  const clean = url.split('?')[0].toLowerCase()
  return clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.ogg') || clean.startsWith('data:video/')
}

export function resolveWallpaperUrl(url?: string): string {
  const target = url || DEFAULT_WALLPAPER
  if (target.startsWith('data:') || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('blob:')) {
    return target
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    const clean = target.replace(/^\/+/, '')
    const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1)
    return `${base}${clean}`
  }
  return target
}

export const defaultWallpapers: WallpaperOption[] = [
  {
    id: 'abstract-hills',
    name: 'Волны: Полдень (по умолчанию)',
    url: '/backgrounds/abstract-hills.jpg',
    description: 'Зелёные холмы и лазурное небо'
  },
  {
    id: 'video-bg',
    name: 'Живые волны (видео)',
    url: '/bg.mp4',
    description: 'Плавный живой видеофон для спокойной концентрации'
  },
  {
    id: 'abstract-sky',
    name: 'Облака и небо',
    url: '/backgrounds/abstract-sky.jpg',
    description: 'Мягкие волны облаков, лазурный простор и теплый свет'
  },
  {
    id: 'abstract-ocean',
    name: 'Кораллы и дно',
    url: '/backgrounds/abstract-ocean.jpg',
    description: 'Океанские дюны, морское дно и спокойные кораллы'
  },
  {
    id: 'abstract-morning',
    name: 'Волны: Рассвет',
    url: '/backgrounds/abstract-morning.jpg',
    description: 'Утренний свет и тёплые золотистые волны'
  },
  {
    id: 'abstract-dusk',
    name: 'Волны: Сумерки',
    url: '/backgrounds/abstract-dusk.jpg',
    description: 'Изумрудные дюны и лавандовые сумерки'
  },
  {
    id: 'meadow',
    name: 'Классический луг',
    url: '/meadow-background-v2.png',
    description: 'Спокойный природный пейзаж'
  },
]

export function resizeImageFile(file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Не удалось загрузить изображение'))
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

interface WallpaperPickerProps {
  current?: string
  onChange: (url: string) => void
  onToast?: (message: string) => void
  allowCustom?: boolean
}

export function WallpaperPicker({ current, onChange, onToast, allowCustom = false }: WallpaperPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [uploading, setUploading] = useState(false)

  const activeUrl = current || DEFAULT_WALLPAPER
  const isCustom = !defaultWallpapers.some(preset => preset.url === activeUrl)

  const handleSelect = (url: string) => {
    onChange(url)
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await resizeImageFile(file)
      onChange(dataUrl)
      if (onToast) onToast('Фоновое изображение обновлено')
    } catch {
      if (onToast) onToast('Не удалось загрузить выбранное изображение')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleUrlSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const cleanUrl = urlDraft.trim()
    if (!cleanUrl) return
    onChange(cleanUrl)
    setUrlDraft('')
    setShowUrlInput(false)
    if (onToast) onToast('Фоновое изображение обновлено')
  }

  return (
    <div className="wallpaper-section">
      <div className="wallpaper-header">
        <div>
          <strong>Фоновое оформление</strong>
          <small>Выберите спокойный живой или статический фон из коллекции</small>
        </div>
        {activeUrl !== DEFAULT_WALLPAPER && (
          <button
            type="button"
            className="calm-text-button calm-reset-wallpaper"
            onClick={() => handleSelect(DEFAULT_WALLPAPER)}
            title="Вернуть исходный фон"
          >
            <RotateCcw size={14} />
            <span>По умолчанию</span>
          </button>
        )}
      </div>

      <div className="wallpaper-grid" role="radiogroup" aria-label="Варианты фонового изображения">
        {defaultWallpapers.map(preset => {
          const isSelected = activeUrl === preset.url
          const isVideo = isVideoWallpaper(preset.url)
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`wallpaper-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelect(preset.url)}
              title={preset.description || preset.name}
            >
              <div
                className="wallpaper-preview"
                style={isVideo ? undefined : { backgroundImage: `url("${resolveWallpaperUrl(preset.url)}")` }}
              >
                {isVideo && (
                  <span className="wallpaper-kind-badge" title="Живой видеофон">
                    <Film size={13} aria-hidden="true" />
                    <span>Видео</span>
                  </span>
                )}
                {isVideo && (
                  <video
                    className="wallpaper-preview-video"
                    src={resolveWallpaperUrl(preset.url)}
                    muted
                    autoPlay
                    loop
                    playsInline
                  />
                )}
                {isSelected && (
                  <span className="wallpaper-active-badge" aria-label="Выбран">
                    <Check size={14} strokeWidth={2.6} />
                  </span>
                )}
              </div>
              <div className="wallpaper-info">
                <span className="wallpaper-title">{preset.name}</span>
              </div>
            </button>
          )
        })}

        {isCustom && (
          <button
            type="button"
            role="radio"
            aria-checked={true}
            className="wallpaper-card selected"
            onClick={() => handleSelect(activeUrl)}
            title="Пользовательское изображение"
          >
            <div
              className="wallpaper-preview"
              style={isVideoWallpaper(activeUrl) ? undefined : { backgroundImage: `url("${resolveWallpaperUrl(activeUrl)}")` }}
            >
              {isVideoWallpaper(activeUrl) && (
                <video
                  className="wallpaper-preview-video"
                  src={resolveWallpaperUrl(activeUrl)}
                  muted
                  autoPlay
                  loop
                  playsInline
                />
              )}
              <span className="wallpaper-active-badge" aria-label="Выбран">
                <Check size={14} strokeWidth={2.6} />
              </span>
            </div>
            <div className="wallpaper-info">
              <span className="wallpaper-title">Своё фото</span>
            </div>
          </button>
        )}
      </div>

      {allowCustom && (
        <div className="wallpaper-custom-actions">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/webp,image/avif"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="soft-button wallpaper-upload-btn"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={15} />
            <span>{uploading ? 'Загрузка…' : 'Загрузить файл'}</span>
          </button>

          {!showUrlInput ? (
            <button
              type="button"
              className="soft-button"
              onClick={() => setShowUrlInput(true)}
            >
              <Link2 size={15} />
              <span>По ссылке</span>
            </button>
          ) : (
            <form className="wallpaper-url-form" onSubmit={handleUrlSubmit}>
              <input
                type="url"
                placeholder="https://example.com/wallpaper.jpg"
                value={urlDraft}
                onChange={e => setUrlDraft(e.target.value)}
                autoFocus
              />
              <button type="submit" className="calm-primary-mini" disabled={!urlDraft.trim()}>
                OK
              </button>
              <button
                type="button"
                className="calm-icon-mini"
                onClick={() => { setShowUrlInput(false); setUrlDraft('') }}
                aria-label="Отмена"
              >
                <X size={14} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
