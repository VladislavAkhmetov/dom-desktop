import { useEffect } from 'react'
import { Sparkles, X } from 'lucide-react'

interface Props {
  pageTitle: string
  url: string
  onClose: () => void
  onSaveToNotes: (text: string) => void
}

export function OnDemandAI({ pageTitle, url, onClose, onSaveToNotes }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Contextual answer tailored to the current open document/resource
  const isSvelte = /svelte/i.test(pageTitle) || /runes/i.test(url)
  const isFigma = /figma/i.test(pageTitle) || /figma/i.test(url)
  const isGithub = /github/i.test(pageTitle) || /pr/i.test(url)

  let summary = 'Страница содержит документацию и спецификацию. Все ключевые функции доступны без внешних зависимостей.'
  let keyPoint = 'Основной вывод: решение оптимизировано для высокой производительности и легко интегрируется в текущий проект.'

  if (isSvelte) {
    summary = 'Руны ($state, $derived, $effect) в Svelte 5 переносят реактивность из шаблонов в стандартный TypeScript/JavaScript код.'
    keyPoint = 'Ключевое преимущество: единая модель реактивности как внутри .svelte компонентов, так и в обычных утилитах без вызова сторов.'
  } else if (isFigma) {
    summary = 'Открыта мастер-ветка дизайн-системы. Все токены цветов, типографики и отступов синхронизированы с кодовой базой.'
    keyPoint = 'Статус: 12 компонентов готовы к верстке, форма чекаута ожидает согласования арт-директора.'
  } else if (isGithub) {
    summary = 'Пулл-реквест #184: оптимизация загрузки шрифтов и рефакторинг сборки. CI/CD тесты пройдены.'
    keyPoint = 'Остался 1 аппрув от лид-разработчика перед слиянием в основную ветку.'
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(`${summary}\n\n${keyPoint}`)
  }

  return (
    <div className="on-demand-ai-card" role="dialog" aria-modal="true" aria-label="Ответ ИИ по странице">
      <div className="ai-card-title-row">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#1a68ff' }}>
          <Sparkles size={18} strokeWidth={2} />
          <strong style={{ color: '#1e2933', fontWeight: 600 }}>Ответ по этой странице</strong>
        </span>
        <button
          onClick={onClose}
          style={{ cursor: 'pointer', color: '#687e71', padding: '4px' }}
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>
      </div>

      <div className="ai-card-body">
        <p style={{ marginBottom: '10px' }}>{summary}</p>
        <p style={{ color: '#243b2c', fontWeight: 500 }}>{keyPoint}</p>
      </div>

      <div className="ai-card-actions">
        <button
          className="ai-pill-btn primary"
          onClick={() => onSaveToNotes(`${summary}\n${keyPoint}`)}
        >
          В заметку
        </button>
        <button className="ai-pill-btn" onClick={handleCopy}>
          Скопировать
        </button>
        <button className="ai-pill-btn" onClick={onClose}>
          Закрыть (Esc)
        </button>
      </div>
    </div>
  )
}
