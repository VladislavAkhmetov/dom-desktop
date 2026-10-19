import { useEffect, useState } from 'react'
import { BookOpen, X } from 'lucide-react'
import type { ReaderArticle } from '../types'
import './reader-view.css'

export interface ReaderViewProps {
  article: ReaderArticle
  onClose: () => void
}

type ReaderTheme = 'light' | 'sepia' | 'night' | 'paper'

export function ReaderView({ article, onClose }: ReaderViewProps) {
  const [fontSize, setFontSize] = useState<number>(18)
  const [theme, setTheme] = useState<ReaderTheme>('light')

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className={`reader-view-overlay theme-${theme}`}>
      <header className="reader-view-toolbar">
        <div className="reader-view-meta">
          <BookOpen size={16} />
          <span>{article.siteName || 'Режим чтения'}</span>
          <span>·</span>
          <span>~{article.readingTimeMinutes} мин чтения</span>
        </div>

        <div className="reader-view-controls">
          <button
            type="button"
            className="reader-ctrl-btn"
            onClick={() => setFontSize(prev => Math.max(14, prev - 2))}
            title="Уменьшить шрифт"
            aria-label="Уменьшить шрифт"
          >
            A-
          </button>
          <button
            type="button"
            className="reader-ctrl-btn"
            onClick={() => setFontSize(prev => Math.min(26, prev + 2))}
            title="Увеличить шрифт"
            aria-label="Увеличить шрифт"
          >
            A+
          </button>

          <div className="reader-theme-picker" role="radiogroup" aria-label="Тема оформления">
            <button
              type="button"
              className={`reader-theme-dot dot-light ${theme === 'light' ? 'is-active' : ''}`}
              onClick={() => setTheme('light')}
              title="Светлая"
              aria-label="Светлая тема"
            />
            <button
              type="button"
              className={`reader-theme-dot dot-sepia ${theme === 'sepia' ? 'is-active' : ''}`}
              onClick={() => setTheme('sepia')}
              title="Сепия"
              aria-label="Тема сепия"
            />
            <button
              type="button"
              className={`reader-theme-dot dot-paper ${theme === 'paper' ? 'is-active' : ''}`}
              onClick={() => setTheme('paper')}
              title="Бумага"
              aria-label="Тема бумага"
            />
            <button
              type="button"
              className={`reader-theme-dot dot-night ${theme === 'night' ? 'is-active' : ''}`}
              onClick={() => setTheme('night')}
              title="Тёмная"
              aria-label="Тёмная тема"
            />
          </div>

          <button
            type="button"
            className="reader-close-btn"
            onClick={onClose}
            title="Выйти из режима чтения (Esc)"
            aria-label="Закрыть режим чтения"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <main className="reader-article-container" style={{ fontSize: `${fontSize}px` }}>
        <h1 className="reader-article-title">{article.title}</h1>
        {article.byline && (
          <div className="reader-article-byline">{article.byline}</div>
        )}
        <div
          className="reader-article-body"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </main>
    </div>
  )
}
