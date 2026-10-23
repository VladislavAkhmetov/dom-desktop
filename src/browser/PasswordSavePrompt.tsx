import { useEffect, useRef, useState } from 'react'
import { KeyRound, Eye, EyeOff, X } from 'lucide-react'
import type { PasswordSavePromptInfo } from '../types'
import './password-prompt.css'

export interface PasswordSavePromptProps {
  prompt: PasswordSavePromptInfo
  onSave: (username: string, password: string) => void
  onDismiss: () => void
}

export function PasswordSavePrompt({ prompt, onSave, onDismiss }: PasswordSavePromptProps) {
  const [username, setUsername] = useState(prompt.username || '')
  const [password, setPassword] = useState(prompt.password || '')
  const [showPassword, setShowPassword] = useState(false)
  const saveBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    saveBtnRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onDismiss()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onDismiss])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    onSave(username.trim(), password)
  }

  return (
    <div
      className="chrome-password-bubble"
      role="dialog"
      aria-labelledby="password-bubble-heading"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="password-bubble-header">
        <div className="password-bubble-title-row">
          <div className="password-bubble-icon" aria-hidden="true">
            <KeyRound size={17} />
          </div>
          <div>
            <h3 id="password-bubble-heading" className="password-bubble-heading">
              Сохранить пароль?
            </h3>
            <p className="password-bubble-sub" title={prompt.hostname}>
              {prompt.hostname}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="password-close-btn"
          aria-label="Закрыть"
          title="Закрыть"
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            onDismiss()
          }}
        >
          <X size={15} />
        </button>
      </div>

      <form className="password-bubble-form" onSubmit={handleSubmit}>
        <div className="password-field-group">
          <label className="password-field-label" htmlFor="password-prompt-user">
            Имя пользователя
          </label>
          <input
            id="password-prompt-user"
            className="password-input-text"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Логин или email"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="password-field-group">
          <label className="password-field-label" htmlFor="password-prompt-pass">
            Пароль
          </label>
          <div className="password-field-input-wrap">
            <input
              id="password-prompt-pass"
              className="password-input-text password-input-with-eye"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <button
              type="button"
              className="password-eye-btn"
              onClick={() => setShowPassword(prev => !prev)}
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="password-bubble-actions">
          <button
            type="button"
            className="password-btn password-btn-dismiss"
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              onDismiss()
            }}
          >
            Не сейчас
          </button>
          <button
            ref={saveBtnRef}
            type="submit"
            className="password-btn password-btn-save"
            disabled={!password}
          >
            Сохранить
          </button>
        </div>
      </form>
    </div>
  )
}
