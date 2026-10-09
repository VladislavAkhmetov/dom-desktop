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
      const content = text('description', 'summary', 'encoded', 'content')
      const html = new DOMParser().parseFromString(content, 'text/html')
      const media = [...item.getElementsByTagName('*')].find(element => ['thumbnail', 'content', 'enclosure'].includes(element.localName) && (element.getAttribute('type')?.startsWith('image/') || element.getAttribute('medium') === 'image' || element.localName === 'thumbnail'))
      const imageAddress = media?.getAttribute('url') || html.querySelector('img')?.getAttribute('src')
      let image: string | undefined
      if (imageAddress) { try { const address = new URL(imageAddress, source.url); if (address.protocol === 'https:' && !address.username && !address.password) image = address.href } catch { /* A malformed thumbnail doesn't invalidate the article. */ } }
      return [{ id: url.toString(), title: clean(text('title')) || source.name, url: url.toString(), source: source.name, sourceId: source.id, topic: source.topic, image, summary: clean(content), publishedAt: Number.isFinite(Date.parse(published)) ? new Date(published).toISOString() : '' }]
    } catch { return [] }
  })
}

export function articleImage(raw: string, articleUrl: string): string | undefined {
  const document = new DOMParser().parseFromString(raw, 'text/html')
  const value = document.querySelector('meta[property="og:image"], meta[name="og:image"]')?.getAttribute('content')
    || document.querySelector('meta[name="twitter:image"], meta[property="twitter:image"]')?.getAttribute('content')
    || document.querySelector('link[rel="image_src"]')?.getAttribute('href')
  if (!value) return
  try { const image = new URL(value, articleUrl); if (image.protocol === 'https:' && !image.username && !image.password) return image.href } catch { /* Missing or invalid images leave the article readable. */ }
}
