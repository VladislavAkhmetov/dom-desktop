import type { FeedArticle, FeedSource } from './types'
const clean = (value: string) => { const document = new DOMParser().parseFromString(value, 'text/html'); document.querySelectorAll('script,style').forEach(item => item.remove()); return (document.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 4000) }
export function parseFeed(raw: string, source: FeedSource): FeedArticle[] {
  const document = new DOMParser().parseFromString(raw, 'application/xml')
  if (document.querySelector('parsererror') || !['rss', 'feed', 'RDF'].includes(document.documentElement.localName)) throw new Error('Источник не содержит RSS или Atom')
  return [...document.querySelectorAll('item,entry')].slice(0, 100).flatMap(item => {
    const text = (...names: string[]) => { for (const name of names) { const child = [...item.children].find(element => element.localName === name); if (child?.textContent) return child.textContent } return '' }
    const link = [...item.children].find(element => element.localName === 'link' && (!element.getAttribute('rel') || element.getAttribute('rel') === 'alternate'))
    try {
      const address = (link?.getAttribute('href') || text('link')).trim()
      if (!address) return []
      const url = new URL(address, source.url)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return []
      const published = text('pubDate', 'published', 'updated', 'date')
      return [{ id: url.toString(), title: clean(text('title')) || source.name, url: url.toString(), source: source.name, summary: clean(text('description', 'summary', 'encoded', 'content')), publishedAt: Number.isFinite(Date.parse(published)) ? new Date(published).toISOString() : '' }]
    } catch { return [] }
  })
}
