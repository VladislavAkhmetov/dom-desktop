async function readLimited(response, limit) {
  if (!response.ok) { const error = new Error(`Сервис ответил ${response.status}`); error.status = response.status; throw error }
  const reader = response.body.getReader(); const chunks = []; let length = 0
  try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > limit) throw new Error('Ответ слишком большой'); chunks.push(value) } }
  finally { await reader.cancel().catch(() => undefined) }
  return Buffer.concat(chunks).toString('utf8')
}

function checkWebAddress(url) {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Нужен адрес HTTP или HTTPS без пароля')
  return parsed
}

async function fetchLimited(url, options = {}, limit = 5_000_000, fetcher = fetch) {
  checkWebAddress(url)
  const response = await fetcher(url, { ...options, signal: options.signal || AbortSignal.timeout(25_000) })
  return readLimited(response, limit)
}

// This computer and private networks (router admin pages, NAS, local services). Literal hosts only:
// a public name that resolves to a private address (DNS rebinding) is not caught here.
function isPrivateHost(hostname) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host.replace(/^::ffff:/, ''))
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  if (host.includes(':')) return host === '::' || host === '::1' || /^f[cd][0-9a-f]{0,2}:/.test(host) || /^fe[89ab][0-9a-f]?:/.test(host) || host.startsWith('::ffff:')
  return false
}

// For addresses that come from the user or from feeds (RSS, iCal, saved links): public internet only,
// redirects followed by hand so every hop is checked again.
async function fetchPublic(url, options = {}, limit = 5_000_000, fetcher = fetch) {
  let current = url
  for (let hop = 0; hop <= 5; hop++) {
    const parsed = checkWebAddress(current)
    if (isPrivateHost(parsed.hostname)) throw new Error('Адреса этого компьютера и локальной сети не загружаются')
    const response = await fetcher(current, { ...options, redirect: 'manual', signal: options.signal || AbortSignal.timeout(25_000) })
    const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null
    if (!location) return readLimited(response, limit)
    await response.body?.cancel().catch(() => undefined)
    current = new URL(location, current).href
  }
  throw new Error('Слишком много перенаправлений')
}

module.exports = { fetchLimited, fetchPublic, isPrivateHost }
