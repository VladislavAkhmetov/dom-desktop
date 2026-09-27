import { useEffect, useRef, useState } from 'react'
import { bridge } from './bridge'
import type { AppState, FeedArticle } from './types'

import { parseFeed } from './feedParser'
export function useNews(state: AppState | null, commit: (update: (state: AppState) => AppState) => unknown) {
  const [refreshing, setRefreshing] = useState(false)
  const busy = useRef(false)
  const current = useRef(state); current.current = state
  async function refresh() {
    const value = current.current
    if (!value?.feedSources?.length || busy.current) return
    busy.current = true; setRefreshing(true)
    try {
      const results = await Promise.all(value.feedSources.map(async source => { try { const raw = bridge.integrations ? await bridge.integrations.fetchFeed(source.url) : await fetch(source.url, { signal: AbortSignal.timeout(25000) }).then(response => { if (!response.ok) throw new Error(`Источник ответил ${response.status}`); return response.text() }); return { source, articles: parseFeed(raw, source), error: undefined } } catch (error) { return { source, articles: [] as FeedArticle[], error: error instanceof Error ? error.message : 'Источник недоступен' } } }))
      commit(previous => {
        const enabled = new Set(previous.feedSources?.map(item => item.id))
        const articles = [...new Map(results.filter(item => enabled.has(item.source.id)).flatMap(item => item.articles).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)).map(item => [item.url, item])).values()].slice(0, 30)
        return { ...previous, feedSources: previous.feedSources?.map(source => ({ ...source, error: results.find(item => item.source.id === source.id)?.error })), newsEditions: articles.length ? [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), articles }, ...(previous.newsEditions || [])].slice(0, 7) : previous.newsEditions }
      })
    } finally { busy.current = false; setRefreshing(false) }
  }
  const key = state?.feedSources?.map(item => `${item.id}:${item.url}`).join('|') || ''
  useEffect(() => {
    if (!key) return
    const maybeRefresh = () => { const edition = current.current?.newsEditions?.[0]; if (!edition || new Date(edition.createdAt).toDateString() !== new Date().toDateString()) refresh() }
    maybeRefresh(); const timer = window.setInterval(maybeRefresh, 30 * 60000); return () => window.clearInterval(timer)
  }, [key])
  return { refresh, refreshing }
}
