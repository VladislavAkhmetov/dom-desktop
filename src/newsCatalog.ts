import type { AppState, FeedSource } from './types'

export const defaultNewsSources: FeedSource[] = [
  { id: 'news-habr', name: 'Хабр', url: 'https://habr.com/ru/rss/news/?fl=ru', topic: 'ИТ' },
  { id: 'news-sports', name: 'Спортс', url: 'https://www.sports.ru/rss/topnews.xml', topic: 'Спорт' },
  { id: 'news-world', name: 'Лента.ру', url: 'https://lenta.ru/rss/news/world', topic: 'Политика' },
]

export function initializeNews(state: AppState): AppState {
  if (state.feedSources !== undefined) return state
  return {
    ...state,
    feedSources: structuredClone(defaultNewsSources),
    newsPreferences: state.newsPreferences ?? { topics: defaultNewsSources.map(source => source.topic!) },
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
