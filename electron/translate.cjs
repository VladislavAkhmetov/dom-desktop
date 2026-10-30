const https = require('node:https')

function decodeHtmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

async function translateChunk(chunk, targetLang = 'ru') {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=autodetect|${targetLang}`
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  const json = await res.json()
  if (json.responseData && json.responseData.translatedText) {
    return decodeHtmlEntities(json.responseData.translatedText)
  }
  return chunk
}

async function translateText(text, targetLang = 'ru') {
  if (!text || typeof text !== 'string') return ''
  const trimmed = text.trim()
  if (!trimmed) return ''

  try {
    if (trimmed.length <= 400) {
      return await translateChunk(trimmed, targetLang)
    }
    const sentences = trimmed.match(/[^.!?]+[.!?]+|\S+$/g) || [trimmed]
    let chunk = ''
    const result = []
    for (const s of sentences) {
      if ((chunk + s).length > 400) {
        if (chunk.trim()) result.push(await translateChunk(chunk.trim(), targetLang))
        chunk = s
      } else {
        chunk += (chunk ? ' ' : '') + s
      }
    }
    if (chunk.trim()) result.push(await translateChunk(chunk.trim(), targetLang))
    return result.join(' ')
  } catch (err) {
    console.warn('[Translate] Ошибка перевода через MyMemory:', err.message)
    return trimmed
  }
}

module.exports = { translateText }
