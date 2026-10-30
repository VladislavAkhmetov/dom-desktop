import { useEffect, useRef, useState } from 'react'
import { bridge } from './bridge'
import type { AppState, FeedArticle } from './types'

import { articleImage, parseFeed } from './feedParser'
import { initializeNews, newsArticleAddress, newsSourceAddress } from './newsCatalog'

async function translateArticle(article: FeedArticle): Promise<FeedArticle> {
  if (/[\u0400-\u04FF]/.test(article.title)) return article
  if (typeof window !== 'undefined' && (window as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT && !bridge.browser?.translateText) {
    return article
  }
  try {
    const translate = bridge.browser?.translateText
      ? (text: string) => bridge.browser!.translateText!(text, 'ru')
      : async (text: string) => {
          const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=autodetect|ru`, { signal: AbortSignal.timeout(4000) })
          const json = await res.json()
          return (json.responseData?.translatedText || text)
            .replace(/&quot;/g, '"')
            .replace(/&#39;|&apos;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
        }

    const titlePromise = translate(article.title)
    const summaryPromise = article.summary && article.summary !== article.title
      ? translate(article.summary.slice(0, 450))
      : Promise.resolve(article.summary)

    const [translatedTitle, translatedSummary] = await Promise.all([titlePromise, summaryPromise])
    return {
      ...article,
      title: translatedTitle || article.title,
      summary: translatedSummary || article.summary,
    }
  } catch {
    return article
  }
}

async function enrichImages(editionId: string, articles: FeedArticle[], commit: (update: (state: AppState) => AppState) => unknown) {
  const queue = articles.filter(article => !article.image).slice(0, 12)
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
    for (let article = queue.shift(); article; article = queue.shift()) {
      try {
        const raw = bridge.integrations ? await bridge.integrations.fetchFeed(article.url) : await fetch(newsArticleAddress(article.url), { credentials: 'omit', signal: AbortSignal.timeout(10000) }).then(response => { if (!response.ok) throw new Error('Изображение недоступно'); return response.text() })
        const image = articleImage(raw, article.url)
        if (!image) continue
        const articleId = article.id
        await commit(previous => {
          const edition = previous.newsEditions?.find(item => item.id === editionId)
          if (!edition?.articles.some(item => item.id === articleId && !item.image)) return previous
          return { ...previous, newsEditions: previous.newsEditions?.map(item => item.id === editionId ? { ...item, articles: item.articles.map(value => value.id === articleId ? { ...value, image } : value) } : item) }
        })
      } catch { /* A failed image must not hide a news article or interrupt the feed. */ }
    }
  }))
}
export function useNews(state: AppState | null, commit: (update: (state: AppState) => AppState) => unknown) {
  const [refreshing, setRefreshing] = useState(false)
  const busy = useRef(false)
  const refreshAgain = useRef(false)
  const requestedSources = useRef('')
  const current = useRef(state); current.current = state
  useEffect(() => {
    if (state) {
      const updated = initializeNews(state)
      if (updated !== state) commit(() => updated)
    }
  }, [Boolean(state), state?.feedSources === undefined])
  async function refresh() {
    const value = current.current
    if (!value?.feedSources?.length) return
    if (busy.current) { refreshAgain.current = true; return }
    busy.current = true; setRefreshing(true)
    try {
      const results = await Promise.all(value.feedSources.map(async source => { try { const raw = bridge.integrations ? await bridge.integrations.fetchFeed(source.url) : await fetch(newsSourceAddress(source), { signal: AbortSignal.timeout(25000) }).then(response => { if (!response.ok) throw new Error(`Источник ответил ${response.status}`); return response.text() }); return { source, articles: parseFeed(raw, source), error: undefined } } catch (error) { return { source, articles: [] as FeedArticle[], error: error instanceof Error ? error.message : 'Источник недоступен' } } }))
      const previousSources = current.current?.feedSources || []
      const previousEditions = current.current?.newsEditions || []
      const available = results.filter(item => previousSources.some(source => source.id === item.source.id && source.url === item.source.url))
      const sorted = available.flatMap(item => item.articles).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
      const reserved = available.flatMap(item => item.articles.slice(0, Math.max(1, Math.floor(12 / Math.max(1, available.length)))))
      const images = new Map(previousEditions.flatMap(edition => edition.articles.filter(article => article.image).map(article => [article.url, article.image] as const)))
      const cached = new Map(previousEditions.flatMap(edition => edition.articles.map(article => [article.url, article] as const)))

      const rawArticles = [...new Map([...reserved, ...sorted].map(item => [item.url, item])).values()].slice(0, 30).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))

      const articles = await Promise.all(rawArticles.map(async article => {
        const existing = cached.get(article.url)
        const image = article.image || existing?.image || images.get(article.url)
        if (existing && /[\u0400-\u04FF]/.test(existing.title)) {
          return { ...article, title: existing.title, summary: existing.summary || article.summary, image }
        }
        if (!/[\u0400-\u04FF]/.test(article.title)) {
          const translated = await translateArticle(article)
          return { ...translated, image }
        }
        return { ...article, image }
      }))

      const editionId = crypto.randomUUID()
      let freshArticles: FeedArticle[] = articles
      await commit(previous => {
        return {
          ...previous,
          feedSources: previous.feedSources?.map(source => {
            const result = available.find(item => item.source.id === source.id)
            return result ? { ...source, error: result.error } : source
          }),
          newsEditions: articles.length
            ? [{ id: editionId, createdAt: new Date().toISOString(), articles }, ...(previous.newsEditions || [])].slice(0, 7)
            : previous.newsEditions,
        }
      })
      if (freshArticles.length) void enrichImages(editionId, freshArticles, commit)
    } finally { busy.current = false; setRefreshing(false); if (refreshAgain.current) { refreshAgain.current = false; void refresh() } }
  }
  const key = state?.feedSources?.map(item => `${item.id}:${item.url}:${item.topic || ''}`).join('|') || ''
  useEffect(() => {
    if (!key) return
    requestedSources.current = key
    const maybeRefresh = () => { const edition = current.current?.newsEditions?.[0]; if (!edition || new Date(edition.createdAt).toDateString() !== new Date().toDateString()) refresh() }
    refresh(); const timer = window.setInterval(maybeRefresh, 30 * 60000); return () => window.clearInterval(timer)
  }, [key])
  return { refresh, refreshing: refreshing || Boolean(key && requestedSources.current !== key) }
}
