import { useState } from 'react'
import { ArrowUpRight, Check, Globe2, Sparkles } from 'lucide-react'
import type { ResearchArtifact, ResearchSource } from '../types'

interface Props {
  initialArtifact?: ResearchArtifact
  onOpenSource: (source: ResearchSource) => void
  onSaveToSpace: (artifact: ResearchArtifact) => void
}

const defaultSources: ResearchSource[] = [
  { title: 'Svelte 5 Runes Documentation', domain: 'svelte.dev', url: 'https://svelte.dev/docs/svelte/what-are-runes' },
  { title: 'React 19 Server Actions & Compiler', domain: 'react.dev', url: 'https://react.dev/blog/2024/04/25/react-19' },
  { title: 'JS Framework Benchmark 2026', domain: 'github.com', url: 'https://github.com/krausest/js-framework-benchmark' }
]

export function ResearchCanvas({ initialArtifact, onOpenSource, onSaveToSpace }: Props) {
  const [query] = useState(initialArtifact?.query || 'Svelte 5 против React 19: сравнение реактивности и архитектуры')
  const [followup, setFollowup] = useState('')
  const [saved, setSaved] = useState(false)

  const handleFollowupSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!followup.trim()) return
    setFollowup('')
  }

  const handleSave = () => {
    const artifact: ResearchArtifact = {
      id: initialArtifact?.id || crypto.randomUUID(),
      query,
      sources: defaultSources,
      summary: 'Svelte 5 перешёл на тонкие сигналы ($state), обеспечивая прямое обновление DOM без виртуального дерева. React 19 оптимизирует рендеринг через новый компилятор, сохраняя привычные хуки.',
      conclusion: 'Для приложений с частыми локальными обновлениями (редакторы, дашборды) Svelte 5 экономит до 35% ресурсов процессора. React 19 предпочтителен для проектов с тяжелой экосистемой.',
      createdAt: new Date().toISOString()
    }
    onSaveToSpace(artifact)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="research-container" role="main" aria-label="Исследование">
      <div className="research-inner">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
          <h1 className="research-title">{query}</h1>
          <button
            className={`workstage-btn ${saved ? 'active' : ''}`}
            onClick={handleSave}
            style={{ flexShrink: 0, marginTop: '4px' }}
          >
            {saved ? <><Check size={16} /> Сохранено в Пространство</> : <>Сохранить в Пространство</>}
          </button>
        </div>

        {/* ПЕРВОИСТОЧНИКИ */}
        <div className="research-sources">
          {defaultSources.map(source => (
            <button
              key={source.url}
              className="source-card"
              onClick={() => onOpenSource(source)}
              title={`Открыть ${source.url} рядом`}
            >
              <Globe2 size={16} color="#455f50" />
              <span>{source.domain} · {source.title.split(' ')[0]}</span>
              <ArrowUpRight size={15} color="#6d8475" />
            </button>
          ))}
        </div>

        {/* СИНТЕЗИРОВАННЫЙ ДОКУМЕНТ */}
        <div className="research-content">
          <p>
            Оба решения в 2026 году направлены на снижение накладных расходов при обновлении интерфейса, однако применяют принципиально разные парадигмы:
          </p>

          <table className="clean-matrix-table">
            <thead>
              <tr>
                <th>Параметр</th>
                <th>Svelte 5 (Runes)</th>
                <th>React 19 (Compiler)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Принцип реактивности</td>
                <td>Прямые мутации DOM через сигналы</td>
                <td>Virtual DOM с авто-мемоизацией</td>
              </tr>
              <tr>
                <td>Область объявления состояния</td>
                <td>В любом <code>.ts</code> или <code>.js</code> файле</td>
                <td>Строго внутри компонентов и хуков</td>
              </tr>
              <tr>
                <td>Размер базового рантайма</td>
                <td>~2.4 KB</td>
                <td>~42 KB</td>
              </tr>
              <tr>
                <td>Кривая входа для команды</td>
                <td>Минимальная (нативный JS)</td>
                <td>Привычная для React-разработчиков</td>
              </tr>
            </tbody>
          </table>

          <div style={{ padding: '20px 24px', borderRadius: '18px', background: '#eef5ec', color: '#243b2c' }}>
            <strong style={{ display: 'block', marginBottom: '6px', fontSize: '17px' }}>Вывод для дизайн-системы:</strong>
            Компоненты на Svelte 5 изолируются без глобального стейт-менеджера и передают события напрямую, что ускоряет рендеринг сложных интерактивных сеток и графиков.
          </div>
        </div>

        {/* ПОЛЕ УТОЧНЕНИЯ */}
        <form className="followup-box" onSubmit={handleFollowupSubmit}>
          <Sparkles size={18} color="#1a68ff" />
          <input
            type="text"
            placeholder="Задать уточняющий вопрос или углубить исследование..."
            value={followup}
            onChange={e => setFollowup(e.target.value)}
          />
          <button type="submit" className="followup-submit">
            Уточнить
          </button>
        </form>

      </div>
    </div>
  )
}
