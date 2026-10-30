import type { AppState, FeedSource } from './types'

export const defaultNewsSources: FeedSource[] = [
  { id: 'news-habr', name: 'Хабр', url: 'https://habr.com/ru/rss/news/?fl=ru', topic: 'ИТ' },
  { id: 'news-theverge-ai', name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', topic: 'ИИ' },
  { id: 'news-techcrunch-ai', name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', topic: 'ИИ' },
  { id: 'news-sports', name: 'Спортс', url: 'https://www.sports.ru/rss/topnews.xml', topic: 'Спорт' },
  { id: 'news-world', name: 'Лента.ру', url: 'https://lenta.ru/rss/news/world', topic: 'Политика' },
]

export function initializeNews(state: AppState): AppState {
  if (state.feedSources !== undefined) {
    const hasPreset = state.feedSources.some(source => source.id.startsWith('news-'))
    const hasAi = state.feedSources.some(source => source.topic === 'ИИ')
    if (hasPreset && !hasAi) {
      const aiSources = defaultNewsSources.filter(source => source.topic === 'ИИ')
      const feedSources = [...state.feedSources, ...structuredClone(aiSources)]
      const currentTopics = state.newsPreferences?.topics ?? state.feedSources.map(s => s.topic).filter(Boolean) as string[]
      const topics = currentTopics.includes('ИИ')
        ? currentTopics
        : [...currentTopics.slice(0, 1), 'ИИ', ...currentTopics.slice(1)]
      return {
        ...state,
        feedSources,
        newsPreferences: { ...state.newsPreferences, topics },
      }
    }
    return state
  }
  return {
    ...state,
    feedSources: structuredClone(defaultNewsSources),
    newsPreferences: state.newsPreferences ?? { topics: [...new Set(defaultNewsSources.map(source => source.topic!))] },
    newsEditions: state.newsEditions?.filter(edition => edition.id !== 'example-edition' || !edition.articles.every(article => article.source === 'Демонстрационный источник')) ?? [],
  }
}

export function newsSourceAddress(source: FeedSource): string {
  const preset = defaultNewsSources.find(item => item.url === source.url)
  // The desktop bridge fetches the original URL. Vite serves these fixed feeds
  // through the same origin in browser development and preview, avoiding CORS.
  return preset ? `/news-feed/${preset.id}` : source.url
}

export function newsArticleAddress(address: string): string {
  const article = new URL(address)
  const preset = defaultNewsSources.find(source => new URL(source.url).origin === article.origin)
  return preset ? `/news-page/${preset.id}${article.pathname}${article.search}` : address
}
