import type { AppState, FeedArticle } from './types'

export const suggestedNewsTopics = ['ИТ', 'ИИ', 'Спорт', 'Политика', 'Наука', 'Культура', 'Бизнес']

export function newsTopics(state: AppState): string[] {
  return [...new Set(state.newsPreferences?.topics ?? state.feedSources?.map(source => source.topic).filter((topic): topic is string => Boolean(topic)) ?? [])]
}

export function articleTopic(article: FeedArticle, state: AppState): string | undefined {
  const source = state.feedSources?.find(item => article.sourceId ? item.id === article.sourceId : item.name === article.source)
  return source?.topic || article.topic
}

export function newsForTopic(articles: FeedArticle[], topic: string, state: AppState): FeedArticle[] {
  const topics = newsTopics(state)
  return articles.filter(article => topic === 'all' ? !topics.length || !articleTopic(article, state) || topics.includes(articleTopic(article, state)!) : articleTopic(article, state) === topic)
    .map((article, index) => ({ article, index }))
    .sort((a, b) => (Date.parse(b.article.publishedAt) || 0) - (Date.parse(a.article.publishedAt) || 0) || a.index - b.index)
    .map(item => item.article)
}

export function newsTimeLabel(value: string, now = new Date()): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function newsPreview(articles: FeedArticle[], topic: string, state: AppState): FeedArticle[] {
  const sorted = newsForTopic(articles, topic, state)
  if (topic !== 'all') return sorted.slice(0, 3)
  const selected: FeedArticle[] = []
  const seen = new Set<string>()
  for (const article of sorted) {
    const value = articleTopic(article, state) || article.source
    if (!seen.has(value)) { selected.push(article); seen.add(value) }
    if (selected.length === 3) return selected
  }
  return [...selected, ...sorted.filter(article => !selected.includes(article))].slice(0, 3)
}

export function newsRailArticles(articles: FeedArticle[], topic: string, state: AppState): FeedArticle[] {
  const leading = newsPreview(articles, topic, state)
  const ids = new Set(leading.map(article => article.id))
  return [...leading, ...newsForTopic(articles, topic, state).filter(article => !ids.has(article.id))]
}

export function newsExcerpt(article: FeedArticle): string {
  const summary = article.summary.replace(/\s+/g, ' ').replace(/\s*(Читать далее|Читать полностью|Read more)\s*[.…]*\s*$/i, '').trim()
  return summary === article.title ? '' : summary
}
