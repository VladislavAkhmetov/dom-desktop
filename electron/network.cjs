async function fetchLimited(url, options = {}, limit = 5_000_000, fetcher = fetch) {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Нужен адрес HTTP или HTTPS без пароля')
  const response = await fetcher(url, { ...options, signal: options.signal || AbortSignal.timeout(25_000) })
  if (!response.ok) { const error = new Error(`Сервис ответил ${response.status}`); error.status = response.status; throw error }
  const reader = response.body.getReader(); const chunks = []; let length = 0
  try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > limit) throw new Error('Ответ слишком большой'); chunks.push(value) } }
  finally { await reader.cancel().catch(() => undefined) }
  return Buffer.concat(chunks).toString('utf8')
}
module.exports = { fetchLimited }
