// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NewsWidget } from '../src/NewsWidget'
import { QuickEntry } from '../src/QuickEntry'
import { articleImage, parseFeed } from '../src/feedParser'
import { articleTopic, newsForTopic, newsPreview, newsRailArticles, newsTimeLabel } from '../src/newsModel'
import { defaultNewsSources, initializeNews, newsArticleAddress, newsSourceAddress } from '../src/newsCatalog'
import { exampleDay, saveExample } from '../src/demo'
import { useNews } from '../src/news'
import { HorizontalRail } from '../src/HorizontalRail'
import { dashboardWidgets, defaultWidgets } from '../src/dashboard'
import type { AppState, FeedArticle } from '../src/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
vi.mock('../src/bridge', () => ({ bridge: {}, isDesktop: false }))
const article = (id: string, topic: string, hour: number): FeedArticle => ({ id, title: `Новость ${id}`, url: `https://example.com/${id}`, source: topic, sourceId: topic, topic, summary: `Фрагмент ${id}`, publishedAt: new Date(2026, 9, 1, hour).toISOString() })
const initial: AppState = { version: 1, spaces: [], reminders: [], dismissedUntil: null, feedSources: ['ИТ', 'Спорт', 'Политика'].map(topic => ({ id: topic, name: topic, topic, url: `https://example.com/${encodeURIComponent(topic)}` })), newsPreferences: { topics: ['ИТ', 'Спорт', 'Политика'] } }

describe('подбор новостей', () => {
  it('показывает три свежие темы в главном, сохраняя самые свежие новости внутри темы', () => {
    const articles = [article('it-old', 'ИТ', 8), article('sport', 'Спорт', 9), article('it-new', 'ИТ', 12), article('world', 'Политика', 10), article('it-next', 'ИТ', 11)]
    expect(newsPreview(articles, 'all', initial).map(item => item.id)).toEqual(['it-new', 'world', 'sport'])
    expect(newsPreview(articles, 'ИТ', initial).map(item => item.id)).toEqual(['it-new', 'it-next', 'it-old'])
    expect(newsRailArticles(articles, 'all', initial).map(item => item.id)).toEqual(['it-new', 'world', 'sport', 'it-next', 'it-old'])
    expect(newsRailArticles(articles, 'ИТ', initial).map(item => item.id)).toEqual(['it-new', 'it-next', 'it-old'])
    expect(articles[0].id).toBe('it-old')
  })
  it('учитывает изменённую тему источника и исключённые интересы для сохранённых выпусков', () => {
    const news = article('one', 'ИТ', 8)
    const state = { ...initial, feedSources: initial.feedSources?.map(source => source.id === 'ИТ' ? { ...source, topic: 'Наука' } : source), newsPreferences: { topics: ['Спорт'] } }
    expect(articleTopic(news, state)).toBe('Наука')
    expect(newsForTopic([news, article('sport', 'Спорт', 9)], 'all', state).map(item => item.id)).toEqual(['sport'])
    expect(newsForTopic([news], 'Наука', state)).toEqual([news])
  })
  it('не придумывает дату публикации и сохраняет пользовательскую раскладку', () => {
    expect(newsTimeLabel('')).toBe('')
    expect(dashboardWidgets([{ id: 'resume', type: 'resume', size: 'M' }, { id: 'day', type: 'day', size: 'M' }, { id: 'capture', type: 'capture', size: 'L' }])).toEqual(defaultWidgets)
    const custom = [{ id: 'capture', type: 'capture' as const, size: 'M' as const }]
    expect(dashboardWidgets(custom)).toBe(custom)
    expect(dashboardWidgets([])).toEqual([])
  })
  it('читает картинки и тему RSS, удаляя HTML и отказывая опасным адресам', () => {
    const raw = '<rss><channel><item><title>Заголовок</title><link>https://example.com/news</link><description><![CDATA[<img src="https://example.com/photo.jpg"><script>опасный код</script><p>Короткий фрагмент</p>]]></description></item><item><title>Плохая ссылка</title><link>javascript:alert(1)</link></item></channel></rss>'
    const items = parseFeed(raw, initial.feedSources![0])
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ sourceId: 'ИТ', topic: 'ИТ', image: 'https://example.com/photo.jpg', summary: 'Короткий фрагмент', publishedAt: '' })
    expect(parseFeed(raw.replace('https://example.com/photo.jpg', 'https://user:secret@example.com/photo.jpg'), initial.feedSources![0])[0].image).toBeUndefined()
  })
  it('берёт изображение, выбранное издателем, и ограничивает прокси известными сайтами', () => {
    expect(articleImage('<meta property="og:image" content="/article.jpg"><meta name="twitter:image" content="/other.jpg">', 'https://habr.com/ru/news/1/')).toBe('https://habr.com/article.jpg')
    expect(articleImage('<meta name="twitter:image" content="https://example.com/image.jpg">', 'https://example.com/news')).toBe('https://example.com/image.jpg')
    expect(articleImage('<meta property="og:image" content="javascript:alert(1)">', 'https://example.com/news')).toBeUndefined()
    expect(articleImage('<meta property="og:image" content="https://user:secret@example.com/image.jpg">', 'https://example.com/news')).toBeUndefined()
    expect(newsArticleAddress('https://habr.com/ru/news/1/?view=full')).toBe('/news-page/news-habr/ru/news/1/?view=full')
    expect(newsArticleAddress('https://other.example.com/news')).toBe('https://other.example.com/news')
  })
})

let root: Root
beforeEach(() => {
  sessionStorage.clear(); document.body.innerHTML = '<div id="test-root"></div>'; root = createRoot(document.getElementById('test-root')!)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
async function click(selector: string) { await act(async () => (document.querySelector(selector) as HTMLElement).click()) }
async function fill(value: string) {
  await act(async () => { const input = document.querySelector('textarea')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
}

function NewsScreen() {
  const [state, setState] = useState(exampleDay)
  const onChange = (update: (value: AppState) => AppState) => { setState(previous => { const next = update(previous); saveExample(next); return next }); return true }
  const news = useNews(state, onChange)
  return <NewsWidget state={state} onSettings={vi.fn()} onChange={onChange} onAssistant={vi.fn()} onOpen={vi.fn()} onRefresh={news.refresh} refreshing={news.refreshing} />
}

describe('обновление сохранённого экрана новостей', () => {
  it('до первого запроса показывает загрузку, не объявляя ошибку заранее', () => {
    const markup = renderToStaticMarkup(<NewsScreen />)
    expect(markup).toContain('Загружаем новости')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).not.toContain('Не удалось загрузить новости')
  })
  it('заменяет старые примеры источниками и рубриками, сохраняя изменённые дела и пространства', () => {
    const saved = exampleDay()
    saved.spaces[0].name = 'Моя мастерская'
    saved.reminders[0].title = 'Обсудить обложку'
    delete saved.feedSources; delete saved.newsPreferences
    saved.newsEditions = [{ id: 'example-edition', createdAt: new Date().toISOString(), articles: [{ ...article('old', '', 8), source: 'Демонстрационный источник' }] }]
    sessionStorage.setItem('dom-example-day-v2', JSON.stringify(saved))
    const updated = exampleDay()
    expect(updated.spaces).toEqual(saved.spaces)
    expect(updated.reminders).toEqual(saved.reminders)
    expect(updated.feedSources).toEqual(defaultNewsSources)
    expect(updated.newsPreferences?.topics).toEqual(['ИТ', 'Спорт', 'Политика'])
    expect(updated.newsEditions).toEqual([])
    expect(exampleDay()).toEqual(updated)
  })
  it('сохраняет выбранные источники, отключение источников и настоящие сохранённые новости', () => {
    expect(initializeNews(initial)).toBe(initial)
    const disabled = { ...initial, feedSources: [] }
    expect(initializeNews(disabled)).toBe(disabled)
    const saved = { ...initial, feedSources: undefined, newsEditions: [{ id: 'real', createdAt: new Date().toISOString(), articles: [article('saved', 'ИТ', 8)] }] }
    expect(initializeNews(saved).newsEditions).toEqual(saved.newsEditions)
  })
  it('после открытия старого экрана автоматически загружает изображения и новости разных рубрик', async () => {
    const saved = exampleDay()
    delete saved.feedSources; delete saved.newsPreferences
    saved.newsEditions = [{ id: 'example-edition', createdAt: new Date().toISOString(), articles: [{ ...article('old', '', 8), source: 'Демонстрационный источник' }] }]
    sessionStorage.setItem('dom-example-day-v2', JSON.stringify(saved))
    const fetcher = vi.fn(async (address: string) => {
      const source = defaultNewsSources.find(item => newsSourceAddress(item) === address)!
      return { ok: true, text: async () => `<rss><channel>${[1, 2].map(index => `<item><title>Материал ${source.id} ${index}</title><link>https://example.com/${source.id}/${index}</link><description><![CDATA[<img src="https://example.com/${source.id}/${index}.jpg"><p>Фрагмент материала</p>]]></description><pubDate>Thu, 01 Oct 2026 08:00:00 GMT</pubDate></item>`).join('')}</channel></rss>` }
    })
    vi.stubGlobal('fetch', fetcher)
    await act(async () => root.render(<NewsScreen />))
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect([...document.querySelectorAll('.news-tabs button')].map(item => item.textContent)).toEqual(['Главное', 'ИТ', 'Спорт', 'Политика'])
    expect(document.querySelectorAll('.news-tile img')).toHaveLength(6)
    expect(new Set([...document.querySelectorAll('.news-tile-category')].slice(0, 3).map(item => item.textContent))).toEqual(new Set(['ИТ', 'Спорт', 'Политика']))
    expect(document.querySelector('.news-preview')?.getAttribute('aria-busy')).toBe('false')
    expect(exampleDay().newsEditions?.[0].articles).toHaveLength(6)
    expect(document.body.textContent).not.toContain('Демонстрационный источник')
  })
})

describe('чтение и быстрый ввод', () => {
  it('показывает все карточки без ограничения в три и сохраняет читаемый текст при ошибке картинки', async () => {
    const articles = Array.from({ length: 5 }, (_, index) => ({ ...article(String(index), 'ИТ', index), image: `https://example.com/${index}.jpg` }))
    await act(async () => root.render(<NewsWidget state={{ ...initial, newsEditions: [{ id: 'edition', createdAt: new Date().toISOString(), articles }] }} onSettings={vi.fn()} onChange={vi.fn()} onAssistant={vi.fn()} onOpen={vi.fn()} />))
    expect(document.querySelectorAll('.news-tile')).toHaveLength(5)
    const first = document.querySelector('.news-tile')!
    await act(async () => first.querySelector('img')!.dispatchEvent(new Event('error')))
    expect(first.querySelector('img')).toBeNull()
    expect(first.querySelector('.news-tile-media')).toBeNull()
    expect(first.querySelector('.news-tile-excerpt')?.textContent).toBe('Фрагмент 4')
    expect(first.textContent).toContain('Новость 4')
    expect(first.textContent).toContain('ИТ')
    await act(async () => (first.querySelector('button') as HTMLElement).click())
    expect(document.querySelector('.news-article-dialog h2')?.textContent).toBe('Новость 4')
  })
  it('сохраняет открытый выпуск при фоновом обновлении и передаёт выбранный фрагмент помощнику', async () => {
    const onAssistant = vi.fn(), onOpen = vi.fn()
    const state = { ...initial, newsEditions: [{ id: 'first', createdAt: new Date().toISOString(), articles: [article('first', 'ИТ', 8)] }] }
    const render = (value: AppState) => root.render(<NewsWidget state={value} onSettings={vi.fn()} onChange={vi.fn()} onAssistant={onAssistant} onOpen={onOpen} />)
    await act(async () => render(state))
    await click('[aria-label="Настроить темы и источники"]')
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Все новости')!.click())
    await act(async () => render({ ...state, newsEditions: [{ ...state.newsEditions[0], id: 'new', articles: [article('new', 'ИТ', 12)] }] }))
    expect(document.querySelector('.news-edition-list')?.textContent).toContain('Новость first')
    expect(document.querySelector('.news-edition-list')?.textContent).not.toContain('Новость new')
    await click('.news-edition-list .news-row')
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Обсудить с ИИ')!.click())
    expect(onAssistant.mock.calls[0][1]).toEqual([{ id: 'first', title: 'Новость first', url: 'https://example.com/first', text: 'Фрагмент first' }])
    expect(onOpen).not.toHaveBeenCalled()
  })
  it('сохраняет раздельные черновики при переключении режима и повторном открытии', async () => {
    const render = (mode: 'note' | 'ai') => root.render(<QuickEntry mode={mode} showModes={false} onSave={vi.fn()} onAssistant={vi.fn()} />)
    await act(async () => render('note')); await fill('Мысль для завтра')
    await act(async () => render('ai')); await fill('Объясни новость')
    await act(async () => render('note'))
    expect(document.querySelector('textarea')?.value).toBe('Мысль для завтра')
    await act(async () => root.render(null))
    await act(async () => render('ai'))
    expect(document.querySelector('textarea')?.value).toBe('Объясни новость')
  })
  it('не теряет запись при ошибке сохранения и очищает её только после успешного повторения', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('storage')).mockResolvedValue(true)
    await act(async () => root.render(<QuickEntry showModes={false} onSave={save} onAssistant={vi.fn()} />))
    await fill('Проверить макет')
    await click('button[type="submit"]')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Не удалось сохранить')
    expect(sessionStorage.getItem('dom-quick-draft')).toBe('Проверить макет')
    await click('button[type="submit"]')
    expect(document.querySelector('textarea')?.value).toBe('')
    expect(sessionStorage.getItem('dom-quick-draft')).toBeNull()
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })
})

describe('горизонтальная полоса прокрутки', () => {
  async function mountRail(resetKey = 'all') {
    await act(async () => root.render(<HorizontalRail label="Новости" itemCount={5} resetKey={resetKey}>{Array.from({ length: 5 }, (_, index) => <div data-rail-item key={index}>Новость {index}</div>)}</HorizontalRail>))
    const viewport = document.querySelector<HTMLElement>('.horizontal-rail-viewport')!
    Object.defineProperties(viewport, { clientWidth: { configurable: true, value: 300 }, scrollWidth: { configurable: true, value: 1500 } })
    viewport.scrollTo = vi.fn(({ left }: ScrollToOptions) => { viewport.scrollLeft = left || 0; viewport.dispatchEvent(new Event('scroll')) }) as typeof viewport.scrollTo
    await act(async () => viewport.dispatchEvent(new Event('scroll')))
    return viewport
  }
  it('синхронизирует позицию, поддерживает End/Home и возвращает начало после смены рубрики', async () => {
    const viewport = await mountRail()
    const scrollbar = document.querySelector<HTMLElement>('[role="scrollbar"]')!
    await act(async () => scrollbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })))
    expect(viewport.scrollLeft).toBe(1200)
    expect(scrollbar.getAttribute('aria-valuenow')).toBe('1200')
    expect(document.querySelector('.horizontal-rail')?.classList.contains('has-after')).toBe(false)
    await mountRail('ИТ')
    expect(viewport.scrollLeft).toBe(0)
    expect(scrollbar.getAttribute('aria-valuenow')).toBe('0')
    await act(async () => scrollbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })))
    expect(viewport.scrollLeft).toBe(300)
    await act(async () => scrollbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })))
    expect(viewport.scrollLeft).toBe(0)
  })
  it('позволяет нажать на дорожку и перетащить ползунок до конца', async () => {
    const viewport = await mountRail()
    const scrollbar = document.querySelector<HTMLElement>('[role="scrollbar"]')!
    const thumb = document.querySelector<HTMLElement>('.horizontal-rail-thumb')!
    scrollbar.getBoundingClientRect = () => ({ left: 0, right: 200, width: 200, top: 0, bottom: 24, height: 24, x: 0, y: 0, toJSON() {} })
    thumb.getBoundingClientRect = () => ({ left: 0, right: 40, width: 40, top: 10, bottom: 14, height: 4, x: 0, y: 10, toJSON() {} })
    scrollbar.setPointerCapture = vi.fn(); scrollbar.releasePointerCapture = vi.fn(); scrollbar.hasPointerCapture = vi.fn(() => true)
    const pointer = async (type: string, clientX: number) => { const event = new MouseEvent(type, { bubbles: true, button: 0, clientX }); Object.defineProperty(event, 'pointerId', { value: 1 }); await act(async () => scrollbar.dispatchEvent(event)) }
    await pointer('pointerdown', 100)
    expect(viewport.scrollLeft).toBe(600)
    await pointer('pointermove', 180)
    expect(viewport.scrollLeft).toBe(1200)
    await pointer('pointerup', 180)
    expect(scrollbar.releasePointerCapture).toHaveBeenCalledWith(1)
  })
})
