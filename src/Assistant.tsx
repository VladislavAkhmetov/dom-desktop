import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, ChevronLeft, Settings2 } from 'lucide-react'
import { Dialog } from './Dialog'
import { assistantRoles, type AssistantPreferences, type AssistantRole } from './assistantModel'

interface PanelProps {
  draft: string
  preferences: AssistantPreferences
  onPreferencesChange: (preferences: AssistantPreferences) => void
  onDraftChange: (value: string) => void
  onClose: () => void
}

export function AssistantPanel({ draft, preferences, onPreferencesChange, onDraftChange, onClose }: PanelProps) {
  const [view, setView] = useState<'request' | 'connection'>('request')
  const { role, provider, model, endpoint } = preferences
  const update = (patch: Partial<AssistantPreferences>) => onPreferencesChange({ ...preferences, ...patch })
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(view === 'request' ? 'textarea' : '.assistant-back')?.focus()
  }, [view])

  return <div className="assistant-layer" ref={panelRef}>
    <Dialog title="ИИ в Доме" onClose={onClose}>
      <div className="assistant-panel-status"><span className="status-dot" /> Модель не подключена</div>
      {view === 'connection' ? <div className="assistant-connection">
        <button className="assistant-back" onClick={() => setView('request')}><ChevronLeft size={16} /> К запросу</button>
        <div className="assistant-providers" aria-label="Провайдер ИИ">
          {['OpenAI', 'Claude', 'Другой'].map(name => <button key={name} aria-pressed={provider === name} onClick={() => update({ provider: name, model: '' })}><span className={`provider-symbol provider-${name === 'OpenAI' ? 'openai' : name === 'Claude' ? 'claude' : 'other'}`} aria-hidden="true">{name === 'OpenAI' ? '◎' : name === 'Claude' ? '✳' : '＋'}</span>{name}</button>)}
        </div>
        <div className="calm-form assistant-connection-form">
          {provider === 'Другой' && <label>Адрес API<input type="url" value={endpoint} onChange={event => update({ endpoint: event.target.value })} placeholder="https://…" /></label>}
          <label>Модель<input value={model} onChange={event => update({ model: event.target.value })} placeholder="Название модели" /></label>
          <label>API-ключ<input type="password" disabled placeholder="Подключение пока недоступно" /></label>
        </div>
        <button className="assistant-connect-button" disabled>Подключить {provider === 'Другой' ? 'сервис' : provider}<ArrowRight size={17} /></button>
      </div> : <div className="assistant-request">
        <fieldset className="assistant-role-picker">
          <legend>Режим</legend>
          <div>{(Object.keys(assistantRoles) as AssistantRole[]).map(value => <label key={value} className={role === value ? 'selected' : ''}><input type="radio" name="assistant-role" value={value} checked={role === value} onChange={() => update({ role: value })} /><span>{assistantRoles[value].label}</span></label>)}</div>
        </fieldset>
        {role === 'chat' ? <div className="assistant-prompt-list">
          {['Помоги сформулировать мысль', 'Разложи задачу на шаги'].map(prompt => <button key={prompt} onClick={() => onDraftChange(prompt)}>{prompt}<ArrowUp size={15} /></button>)}
        </div> : null}
        <details className="assistant-context-picker">
          <summary>Контекст запроса <span>{[preferences.day, preferences.page, preferences.materials].filter(Boolean).length || 'Только сообщение'}</span></summary>
          <div>
            {([['day', 'План дня'], ['page', 'Текущая страница браузера'], ['materials', 'Выбранные материалы пространства']] as const).map(([key, label]) => <label key={key} className="assistant-context"><input type="checkbox" checked={preferences[key]} onChange={event => update({ [key]: event.target.checked })} /><span>{label}</span></label>)}
          </div>
        </details>
        <div className="assistant-composer">
          <label className="visually-hidden" htmlFor="assistant-draft">Ваш запрос</label>
          <textarea id="assistant-draft" value={draft} onChange={event => onDraftChange(event.target.value)} placeholder="Ваш запрос" rows={3} />
          <div className="assistant-composer-bottom"><button onClick={() => setView('connection')} aria-label="Настроить модель"><Settings2 size={18} /></button></div>
        </div>
        <button className="assistant-connect-button" onClick={() => setView('connection')}>Выбрать модель<ArrowRight size={17} /></button>
      </div>}
    </Dialog>
  </div>
}
