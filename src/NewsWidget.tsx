import { useId, useState, type KeyboardEvent } from 'react'
import { ArrowUpRight, ChevronRight, Newspaper, Settings2, Sparkles } from 'lucide-react'
import type { AppState, AIContext, FeedArticle, NewsEdition, Resource, WidgetConfig } from './types'
import { Dialog } from './Dialog'
import { NewsSetup } from './NewsSetup'
import { HorizontalRail } from './HorizontalRail'
import { articleTopic, newsExcerpt, newsForTopic, newsRailArticles, newsTimeLabel, newsTopics } from './newsModel'
import './digest.css'

function NewsTile({ article, category, onOpen }: { article: FeedArticle; category: string; onOpen: () => void }) {
  const [failedImage, setFailedImage] = useState<string>()
  const hasImage = Boolean(article.image && article.image !== failedImage)
  return <article className="news-tile" data-rail-item role="listitem">
    <button className={`news-tile-button${hasImage ? '' : ' news-tile-no-image'}`} title={article.title} onClick={onOpen}>
      {hasImage && <span className="news-tile-media" aria-hidden="true"><img src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedImage(article.image)} /></span>}
      <strong className="news-tile-title">{article.title.replace(/^Пример:\s*/, '')}</strong>
      {!hasImage && newsExcerpt(article) && <span className="news-tile-excerpt">{newsExcerpt(article)}</span>}
      <span className="news-tile-category">{category}{article.source === 'Демонстрационный источник' && category !== 'Пример' ? ' · Пример' : ''}</span>
    </button>
  </article>
}

export function NewsWidget({ state, onOpen, onChange, onAssistant, onRefresh, refreshing = false }: {
  state: AppState
  widget?: WidgetConfig
  onSettings: () => void
  onOpen: (resource: Resource) => void
  onChange: (update: (state: AppState) => AppState) => unknown
  onAssistant: (prompt: string, contexts: AIContext[]) => void
  onRefresh?: () => unknown
  refreshing?: boolean
}) {
  const id = useId()
  const [settings, setSettings] = useState(false)
  const [opened, setOpened] = useState<NewsEdition | null>(null)
  const [selected, setSelected] = useState<FeedArticle | null>(null)
  const topics = newsTopics(state)
  const active = topics.includes(state.newsPreferences?.activeTopic || '') ? state.newsPreferences!.activeTopic! : 'all'
  const edition = state.newsEditions?.[0]
  const articles = newsRailArticles(edition?.articles || [], active, state)
  const tabs = [{ value: 'all', label: 'Главное' }, ...topics.map(topic => ({ value: topic, label: topic }))]
  const choose = (topic: string) => onChange(previous => ({ ...previous, newsPreferences: { topics: newsTopics(previous), activeTopic: topic } }))
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    event.preventDefault(); choose(tabs[next].value)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  function openArticle(article: FeedArticle) { setSelected(article) }
  function openSource(article: FeedArticle) {
    onOpen({ id: article.id, name: article.title, target: article.url, kind: 'link', createdAt: new Date().toISOString() })
    setSelected(null); setOpened(null)
  }
  const row = (article: FeedArticle, full = false) => <button type="button" className={`news-row ${full ? 'news-row-full' : ''}`} key={article.id} onClick={() => openArticle(article)}>
    <span className="news-row-copy"><span className="news-row-meta"><span>{article.source === 'Демонстрационный источник' ? 'Пример' : article.source}</span>{newsTimeLabel(article.publishedAt) && <time dateTime={article.publishedAt}>{newsTimeLabel(article.publishedAt)}</time>}</span><strong>{article.title.replace(/^Пример:\s*/, '')}</strong>{newsExcerpt(article) && <span className="news-excerpt">{newsExcerpt(article)}</span>}</span>{article.image && <img className="news-thumbnail" src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none' }} />}
  </button>

  return <>
    <div className="news-card-heading">
      <div className="news-tabs calm-tabs" role="tablist" aria-label="Темы новостей">{tabs.map((tab, index) => <button id={`${id}-tab-${index}`} key={tab.value} className={active === tab.value ? 'selected' : ''} role="tab" aria-selected={active === tab.value} aria-controls={`${id}-panel`} tabIndex={active === tab.value ? 0 : -1} onClick={() => choose(tab.value)} onKeyDown={event => keyboard(event, index)}>{tab.label}</button>)}</div>
      <button className="calm-icon news-settings-button" title="Темы и источники" aria-label="Настроить темы и источники" onClick={() => setSettings(true)}><Settings2 size={19} /></button>
    </div>
    <div className="news-preview" role="tabpanel" aria-busy={refreshing} id={`${id}-panel`} aria-labelledby={`${id}-tab-${tabs.findIndex(tab => tab.value === active)}`}>
      {articles.length ? <HorizontalRail label="Новости" itemCount={articles.length} resetKey={active}>{articles.map(article => <NewsTile key={article.id} article={article} category={articleTopic(article, state) || (article.source === 'Демонстрационный источник' ? 'Пример' : 'Новости')} onOpen={() => openArticle(article)} />)}</HorizontalRail> : refreshing ? <div className="news-loading" role="status" aria-label="Загружаем новости">{Array.from({ length: 4 }, (_, index) => <div className="news-skeleton" key={index} aria-hidden="true"><span className="news-tile-media" /><span className="news-skeleton-title"><span /><span /><span /></span><span className="news-skeleton-category" /></div>)}</div> : <div className="news-empty"><Newspaper size={26} strokeWidth={1.5} aria-hidden="true" /><div><p>{!state.feedSources?.length && !edition ? 'Новости по вашим интересам' : active !== 'all' ? 'В этой теме пока нет новостей' : 'Не удалось загрузить новости'}</p><button className="calm-text-button" onClick={state.feedSources?.length && active === 'all' && onRefresh ? onRefresh : () => setSettings(true)}>{state.feedSources?.length && active === 'all' && onRefresh ? 'Обновить' : state.feedSources?.length || edition ? 'Темы и источники' : 'Выбрать темы'}<ChevronRight size={17} /></button></div></div>}
    </div>
    {settings && <Dialog title="Темы и источники" className="news-settings-dialog" onClose={() => setSettings(false)}>{edition && <button className="calm-text-button news-more" onClick={() => { setOpened(structuredClone(edition)); setSettings(false) }}>Все новости<ChevronRight size={17} /></button>}<NewsSetup state={state} onChange={onChange} onRefresh={onRefresh} refreshing={refreshing} /></Dialog>}
    {opened && !selected && <Dialog title="Дайджест" className="news-edition-dialog" onClose={() => setOpened(null)}><div className="news-edition-list">{newsForTopic(opened.articles, active, state).map(article => row(article, true))}</div>{!newsForTopic(opened.articles, active, state).length && <p>В этой теме пока нет новостей.</p>}<div className="calm-dialog-actions"><button className="calm-primary" disabled={!newsForTopic(opened.articles, active, state).length} onClick={() => { onAssistant('Сделай короткий дайджест этих материалов со ссылками на источники. Переданы только заголовки и фрагменты.', newsForTopic(opened.articles, active, state).slice(0, 20).map(article => ({ id: article.id, title: article.title, url: article.url, text: article.summary }))); setOpened(null) }}><Sparkles size={18} />Сжать с ИИ</button></div></Dialog>}
    {selected && <Dialog title={selected.title} className="news-article-dialog" onClose={() => setSelected(null)}><div className="news-article-meta"><span>{selected.source}</span>{newsTimeLabel(selected.publishedAt) && <time dateTime={selected.publishedAt}>{newsTimeLabel(selected.publishedAt)}</time>}</div>{selected.summary && <p className="news-article-summary">{selected.summary}</p>}<div className="calm-dialog-actions"><button className="calm-text-button" onClick={() => { onAssistant('Кратко объясни эту новость, опираясь только на переданный фрагмент. Приложи ссылку на источник.', [{ id: selected.id, title: selected.title, url: selected.url, text: selected.summary }]); setSelected(null); setOpened(null) }}><Sparkles size={18} />Обсудить с ИИ</button><button className="calm-primary" onClick={() => openSource(selected)}>Читать источник<ArrowUpRight size={18} /></button></div></Dialog>}
  </>
}
