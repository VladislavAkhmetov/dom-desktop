import { useEffect, useRef } from 'react'
import { MapPin, Bell, Camera, Mic, Clipboard, X, Globe } from 'lucide-react'
import './permission-prompt.css'

export interface PermissionRequestInfo {
  id: string
  tabId?: string
  hostname: string
  origin: string
  permission: string
  details?: string
}

interface PermissionPromptProps {
  request: PermissionRequestInfo
  onRespond: (allowed: boolean | null) => void
}

export function PermissionPrompt({ request, onRespond }: PermissionPromptProps) {
  const allowButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    allowButtonRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onRespond(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onRespond])

  const getPermissionMeta = () => {
    switch (request.permission) {
      case 'geolocation':
        return {
          icon: <MapPin size={18} className="perm-icon perm-icon-geo" />,
          title: 'Доступ к геопозиции',
          description: 'Запрашивает доступ к данным о вашем местоположении'
        }
      case 'notifications':
        return {
          icon: <Bell size={18} className="perm-icon perm-icon-bell" />,
          title: 'Уведомления',
          description: 'Запрашивает разрешение на отправку уведомлений'
        }
      case 'media':
        return {
          icon: request.details?.includes('audio') && !request.details?.includes('video')
            ? <Mic size={18} className="perm-icon perm-icon-media" />
            : <Camera size={18} className="perm-icon perm-icon-media" />,
          title: 'Камера и микрофон',
          description: request.details ? `Запрашивает доступ: ${request.details}` : 'Запрашивает доступ к камере и микрофону'
        }
      case 'clipboard-read':
        return {
          icon: <Clipboard size={18} className="perm-icon perm-icon-clip" />,
          title: 'Буфер обмена',
          description: 'Запрашивает доступ к чтению буфера обмена'
        }
      default:
        return {
          icon: <Globe size={18} className="perm-icon" />,
          title: 'Разрешение сайта',
          description: `Запрашивает доступ: ${request.permission}`
        }
    }
  }

  const meta = getPermissionMeta()

  return (
    <div
      className="chrome-permission-bubble"
      role="dialog"
      aria-labelledby="perm-host-heading"
      aria-describedby="perm-desc"
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
    >
      <div className="perm-bubble-header">
        <div className="perm-host-row">
          <Globe size={14} className="perm-globe-icon" aria-hidden="true" />
          <strong id="perm-host-heading" className="perm-hostname" title={request.hostname}>{request.hostname}</strong>
        </div>
        <button
          type="button"
          className="perm-close-btn"
          aria-label="Закрыть"
          title="Закрыть"
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            onRespond(null)
          }}
        >
          <X size={15} />
        </button>
      </div>

      <div className="perm-bubble-body">
        <div className="perm-icon-wrapper">
          {meta.icon}
        </div>
        <div className="perm-text-wrapper">
          <p id="perm-desc" className="perm-description">
            {meta.description}
          </p>
        </div>
      </div>

      <div className="perm-bubble-actions">
        <button
          type="button"
          className="perm-btn perm-btn-block"
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            onRespond(false)
          }}
        >
          Блокировать
        </button>
        <button
          ref={allowButtonRef}
          type="button"
          className="perm-btn perm-btn-allow"
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            onRespond(true)
          }}
        >
          Разрешить
        </button>
      </div>
    </div>
  )
}
