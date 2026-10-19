import { describe, expect, it } from 'vitest'
import { parseReaderContent } from '../electron/reader.cjs'

describe('parseReaderContent', () => {
  it('парсит чистый контент статьи из HTML и рассчитывает время чтения', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Архитектура Calm Tech в современном вебе</title>
        </head>
        <body>
          <nav><a href="/">Меню</a></nav>
          <article>
            <h1>Архитектура Calm Tech в современном вебе</h1>
            <p class="byline">Автор: Инженер Дома</p>
            <p>${'Интерфейс должен снижать когнитивный шум и беречь внимание человека. '.repeat(40)}</p>
            <p>${'Вкладки и материалы сохраняются локально и транзакционно без потерь. '.repeat(40)}</p>
          </article>
          <footer>Реклама и счетчики</footer>
        </body>
      </html>
    `

    const result = parseReaderContent(html, 'https://dom.local/article')
    expect(result).not.toBeNull()
    expect(result?.title).toBe('Архитектура Calm Tech в современном вебе')
    expect(result?.readingTimeMinutes).toBeGreaterThanOrEqual(1)
    expect(result?.textContent).toContain('когнитивный шум')
    // Навигация и футер должны быть вычищены
    expect(result?.content).not.toContain('<footer>')
  })

  it('безопасно возвращает null при пустом или невалидном контенте', () => {
    expect(parseReaderContent('', 'https://example.com')).toBeNull()
    expect(parseReaderContent('<div>Короткий текст без статьи</div>', 'https://example.com')).toBeNull()
  })
})
