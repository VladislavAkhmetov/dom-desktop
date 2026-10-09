import { useState } from 'react'
import { Check, Plus, RotateCw, X } from 'lucide-react'
import type { AppState } from './types'
import { newsTopics, suggestedNewsTopics } from './newsModel'
import { defaultNewsSources } from './newsCatalog'
import './digest.css'

export function NewsSetup({ state, onChange, onRefresh, refreshing = false }: {
  state: AppState
  onChange: (update: (state: AppState) => AppState) => unknown
  onRefresh?: () => unknown
  refreshing?: boolean
}) {
  const topics = newsTopics(state)
  const [customTopic, setCustomTopic] = useState('')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [topic, setTopic] = useState('')
  const [error, setError] = useState('')
  const choices = [...new Set([...suggestedNewsTopics, ...topics])]
  const updateTopics = (next: string[]) => onChange(previous => ({ ...previous, newsPreferences: { topics: next, activeTopic: next.includes(previous.newsPreferences?.activeTopic || '') ? previous.newsPreferences?.activeTopic : 'all' } }))

  function addTopic() {
    const value = customTopic.trim().replace(/\s+/g, ' ')
    if (!value || value === 'Главное') return
    updateTopics([...new Set([...topics, value])]); setCustomTopic('')
  }

  async function addSource() {
    setError('')
    try {
      const address = new URL(url.trim())
      if (!['https:', 'http:'].includes(address.protocol) || address.username || address.password) throw new Error('Укажите адрес RSS или Atom.')
      if (state.feedSources?.some(source => source.url === address.href)) throw new Error('Этот источник уже добавлен.')
      if ((state.feedSources?.length || 0) >= 20) throw new Error('Можно добавить до 20 источников.')
      const result = await onChange(previous => ({ ...previous, feedSources: [...(previous.feedSources || []), { id: crypto.randomUUID(), name: name.trim() || address.hostname, url: address.href, topic: topic || undefined }] }))
      if (result === false) throw new Error('Не удалось сохранить источник. Попробуйте ещё раз.')
      setName(''); setUrl('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Укажите корректный адрес RSS или Atom.') }
  }

  return <div className="news-setup">
    <section aria-labelledby="news-topics-heading">
      <h3 id="news-topics-heading">Темы</h3>
      <div className="news-topic-choices">{choices.map(value => <button key={value} aria-pressed={topics.includes(value)} onClick={() => updateTopics(topics.includes(value) ? topics.filter(item => item !== value) : [...topics, value])}>{topics.includes(value) && <Check size={17} />}{value}</button>)}</div>
      <form className="news-custom-topic" onSubmit={event => { event.preventDefault(); addTopic() }}><input aria-label="Своя тема" placeholder="Своя тема" maxLength={32} value={customTopic} onChange={event => setCustomTopic(event.target.value)} /><button className="calm-icon" type="submit" disabled={!customTopic.trim()} aria-label="Добавить тему"><Plus size={20} /></button></form>
    </section>
    <section aria-labelledby="news-sources-heading">
      <div className="news-setup-heading"><h3 id="news-sources-heading">Источники</h3>{onRefresh && Boolean(state.feedSources?.length) && <button className="calm-text-button" disabled={refreshing} onClick={onRefresh}><RotateCw size={17} className={refreshing ? 'news-refreshing' : ''} />{refreshing ? 'Обновляем…' : 'Обновить'}</button>}</div>
      <div className="news-source-presets">{defaultNewsSources.filter(preset => !state.feedSources?.some(source => source.url === preset.url)).map(preset => <button key={preset.id} onClick={() => onChange(previous => ({ ...previous, feedSources: previous.feedSources?.some(source => source.url === preset.url) ? previous.feedSources : [...(previous.feedSources || []), { ...preset }], newsPreferences: { ...previous.newsPreferences, topics: [...new Set([...newsTopics(previous), preset.topic!])] } }))}><Plus size={17} />{preset.name}</button>)}</div>
      <div className="news-source-list">{state.feedSources?.map(source => <div className="news-source" key={source.id}>
        <span><strong>{source.name}</strong>{source.error && <span className="news-source-error" role="status">Не удалось обновить</span>}</span>
        <select aria-label={`Тема источника: ${source.name}`} value={source.topic || ''} onChange={event => { const value = event.target.value; onChange(previous => ({ ...previous, feedSources: previous.feedSources?.map(item => item.id === source.id ? { ...item, topic: value || undefined } : item) })) }}><option value="">Все темы</option>{[...new Set([...choices, ...(source.topic ? [source.topic] : [])])].map(value => <option key={value}>{value}</option>)}</select>
        <button className="calm-icon" aria-label={`Убрать источник: ${source.name}`} onClick={() => onChange(previous => ({ ...previous, feedSources: previous.feedSources?.filter(item => item.id !== source.id) }))}><X size={19} /></button>
      </div>)}</div>
      <details className="news-add-source" open={!state.feedSources?.length || undefined}><summary><Plus size={18} />Добавить источник</summary>
        <form onSubmit={event => { event.preventDefault(); void addSource() }}>
          <label>Название<input value={name} onChange={event => setName(event.target.value)} /></label>
          <label>Адрес RSS или Atom<input type="url" required value={url} onChange={event => setUrl(event.target.value)} /></label>
          <label>Тема<select value={topic} onChange={event => setTopic(event.target.value)}><option value="">Все темы</option>{choices.map(value => <option key={value}>{value}</option>)}</select></label>
          <button type="submit" className="calm-primary" disabled={!url.trim()}>Добавить</button>
        </form>
      </details>
      {error && <p className="news-source-error" role="alert">{error}</p>}
    </section>
  </div>
}
