const https = require('node:https')

async function translateText(text, targetLang = 'ru') {
  if (!text || typeof text !== 'string') return ''
  const trimmed = text.trim()
  if (!trimmed) return ''

  // Если текст короткий или средний (до 500 символов)
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed.slice(0, 500))}&langpair=autodetect|${targetLang}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.responseData && json.responseData.translatedText) {
      return json.responseData.translatedText
    }
  } catch (err) {
    console.warn('[Translate] Ошибка перевода через MyMemory:', err.message)
  }

  return trimmed
}

module.exports = { translateText }
