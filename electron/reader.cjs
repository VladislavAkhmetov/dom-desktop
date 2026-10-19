const fs = require('node:fs')
const { JSDOM } = require('jsdom')
const { Readability, isProbablyReaderable } = require('@mozilla/readability')

let darkReaderCode = null
function getDarkReaderCode() {
  if (!darkReaderCode) {
    try {
      darkReaderCode = fs.readFileSync(require.resolve('darkreader/darkreader.js'), 'utf8')
    } catch {
      darkReaderCode = ''
    }
  }
  return darkReaderCode
}

function parseReaderContent(html, url) {
  if (!html) return null
  try {
    const doc = new JSDOM(html, { url })
    const reader = new Readability(doc.window.document, {
      charThreshold: 200,
      classesToPreserve: ['caption', 'code', 'highlight']
    })
    const article = reader.parse()
    if (!article || (article.length || 0) < 100) return null

    const words = (article.textContent || '').trim().split(/\s+/).filter(Boolean).length
    const readingTimeMinutes = Math.max(1, Math.round(words / 200))

    return {
      title: article.title || '',
      byline: article.byline || '',
      content: article.content || '',
      textContent: article.textContent || '',
      excerpt: article.excerpt || '',
      siteName: article.siteName || '',
      length: article.length || 0,
      readingTimeMinutes
    }
  } catch (err) {
    console.error('[Reader] Ошибка парсинга статьи:', err)
    return null
  }
}

async function applyDarkMode(webContents, enabled) {
  if (!webContents || webContents.isDestroyed()) return
  if (enabled) {
    const code = getDarkReaderCode()
    if (code) {
      await webContents.executeJavaScript(`
        (() => {
          if (typeof DarkReader === 'undefined') {
            ${code}
          }
          if (typeof DarkReader !== 'undefined') {
            DarkReader.setFetchMethod(window.fetch);
            DarkReader.enable({
              brightness: 100,
              contrast: 95,
              sepia: 10
            });
          }
        })();
      `).catch(() => undefined)
    }
  } else {
    await webContents.executeJavaScript(`
      (() => {
        if (typeof DarkReader !== 'undefined') {
          DarkReader.disable();
        }
      })();
    `).catch(() => undefined)
  }
}

module.exports = {
  parseReaderContent,
  applyDarkMode
}
