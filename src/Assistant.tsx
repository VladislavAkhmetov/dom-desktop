import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, ChevronLeft, Settings2, Sparkles } from 'lucide-react'
import { Dialog } from './Dialog'

interface EntryProps {
  onOpen: (draft?: string) => void
}

export function AssistantEntry({ onOpen }: EntryProps) {
  const [draft, setDraft] = useState('')
  return <section className="assistant-entry" aria-label="Помощник">
    <div className="assistant-entry-heading">
      <span><Sparkles size={18} strokeWidth={1.6} /> Помощник</span>
      <button onClick={() => onOpen()}>Выбрать модель <ArrowRight size={14} /></button>
    </div>
    <form className="assistant-entry-input" onSubmit={event => { event.preventDefault(); onOpen(draft) }}>
      <input aria-label="Запрос помощнику" placeholder="Что хочется упростить?" value={draft} onChange={event => setDraft(event.target.value)} />
      <button type="submit" aria-label="Открыть запрос в помощнике"><ArrowUp size={19} /></button>
    </form>
    <div className="assistant-suggestions">
      <button onClick={() => onOpen('Помоги выбрать, с чего начать сегодня.')}><span>С чего начать</span><ArrowUp size={12} /></button>
      <button onClick={() => onOpen('Помоги разбить дело на небольшие шаги.')}><span>Разбить дело на шаги</span><ArrowUp size={12} /></button>
    </div>
  </section>
}

interface PanelProps {
  draft: string
  onDraftChange: (value: string) => void
  onClose: () => void
}

export function AssistantPanel({ draft, onDraftChange, onClose }: PanelProps) {
  const [view, setView] = useState<'request' | 'connection'>(draft ? 'request' : 'connection')
  const [provider, setProvider] = useState('OpenAI')
  const [model, setModel] = useState('')
  const [includeDay, setIncludeDay] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(view === 'request' ? 'textarea' : '.assistant-back')?.focus()
  }, [view])

  return <div className="assistant-layer" ref={panelRef}>
    <Dialog title="Помощник" onClose={onClose}>
      <div className="assistant-panel-status"><span className="status-dot" /> Модель не подключена <span>Предпросмотр</span></div>
      {view === 'connection' ? <div className="assistant-connection">
        <button className="assistant-back" onClick={() => setView('request')}><ChevronLeft size={16} /> К запросу</button>
        <div className="assistant-panel-intro"><Sparkles size={30} strokeWidth={1.3} /><h3>Ваш привычный ИИ.<br />Теперь в Доме.</h3><p>Выберите сервис, которым вам удобно пользоваться.</p></div>
        <div className="assistant-providers" aria-label="Провайдер ИИ">
          {['OpenAI', 'Claude', 'Другой'].map(name => <button key={name} aria-pressed={provider === name} onClick={() => { setProvider(name); setModel('') }}><span className={`provider-symbol provider-${name === 'OpenAI' ? 'openai' : name === 'Claude' ? 'claude' : 'other'}`} aria-hidden="true">{name === 'OpenAI' ? '◎' : name === 'Claude' ? '✳' : '＋'}</span>{name}</button>)}
        </div>
        <div className="calm-form assistant-connection-form">
          {provider === 'Другой' && <label>Адрес API<input type="url" placeholder="https://…" /></label>}
          <label>Модель<input value={model} onChange={event => setModel(event.target.value)} placeholder="Название модели" /></label>
          <label>API-ключ<input type="password" disabled placeholder="Добавление ключа — на следующем этапе" /></label>
        </div>
        <p className="assistant-preview-note">Сейчас это пример интерфейса. Подключение сервиса и отправка запросов появятся позже.</p>
        <button className="assistant-connect-button" disabled>Подключить {provider === 'Другой' ? 'сервис' : provider}<ArrowRight size={17} /></button>
      </div> : <div className="assistant-request">
        <div className="assistant-panel-intro"><Sparkles size={30} strokeWidth={1.3} /><h3>Можно начать<br />с одной мысли.</h3><p>Разобрать сложное, наметить следующий шаг или просто собрать мысли.</p></div>
        <div className="assistant-prompt-list">
          {['Помоги выбрать одно дело на сегодня', 'Разложи большую задачу на шаги', 'Помоги сформулировать мысль'].map(prompt => <button key={prompt} onClick={() => onDraftChange(prompt)}>{prompt}<ArrowUp size={15} /></button>)}
        </div>
        <div className="assistant-composer">
          <label className="assistant-context"><input type="checkbox" checked={includeDay} onChange={event => setIncludeDay(event.target.checked)} /><span>Добавить план на сегодня</span></label>
          <label className="visually-hidden" htmlFor="assistant-draft">Ваш запрос</label>
          <textarea id="assistant-draft" value={draft} onChange={event => onDraftChange(event.target.value)} placeholder="Можно как есть, без идеальной формулировки…" rows={4} />
          <div className="assistant-composer-bottom"><span>Сначала выберите модель</span><button onClick={() => setView('connection')} aria-label="Настроить модель"><Settings2 size={18} /></button></div>
        </div>
        <button className="assistant-connect-button" onClick={() => setView('connection')}>Выбрать модель<ArrowRight size={17} /></button>
      </div>}
    </Dialog>
  </div>
}
