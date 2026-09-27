const http = require('node:http')
const crypto = require('node:crypto')
const { fetchLimited } = require('./network.cjs')
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const API = 'https://gmail.googleapis.com/gmail/v1/users/me'

function pkce() { const verifier = crypto.randomBytes(48).toString('base64url'); return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), state: crypto.randomBytes(32).toString('base64url') } }
function messageToRecord(account, item) {
  const headers = item.payload?.headers || []
  const header = name => headers.find(value => value.name.toLowerCase() === name)?.value || ''
  const from = header('from')
  return { id: `${account.id}:${item.id}`, accountId: account.id, gmailId: item.id, threadId: item.threadId, from, subject: header('subject') || '(Без темы)', snippet: item.snippet || '', receivedAt: new Date(Number(item.internalDate) || Date.now()).toISOString(), unread: item.labelIds?.includes('UNREAD') || false, gmailImportant: Boolean(item.labelIds?.includes('IMPORTANT')), important: Boolean(item.labelIds?.includes('IMPORTANT') || account.importantSenders?.some(sender => from.toLowerCase().includes(sender.toLowerCase()))), url: `https://mail.google.com/mail/u/${encodeURIComponent(account.email)}/#all/${item.threadId}` }
}
class Gmail {
  constructor({ vault, change, getState, openExternal, fetcher = fetch }) { Object.assign(this, { vault, change, getState, openExternal, fetcher }); this.busy = new Set(); this.connecting = false }
  async json(url, options) { return JSON.parse(await fetchLimited(url, options, 8_000_000, this.fetcher)) }
  configure(clientId) { if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error('Нужен OAuth Client ID типа Desktop app'); this.vault.set('google-client', { clientId }) }
  configured() { return Boolean(this.vault.get('google-client')?.clientId) }
  async connect() {
    if (this.connecting) throw new Error('Подключение уже открыто в браузере')
    const client = this.vault.get('google-client'); if (!client) throw new Error('Сначала укажите OAuth Client ID приложения')
    this.connecting = true
    const proof = pkce(); let timer; let server
    try {
      const code = await new Promise((resolve, reject) => {
        server = http.createServer((request, response) => {
          const incoming = new URL(request.url, 'http://127.0.0.1')
          if (incoming.pathname !== '/oauth' || incoming.searchParams.get('state') !== proof.state) { response.writeHead(400); response.end('Invalid authorization callback'); return }
          response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); response.end('Можно закрыть эту страницу и вернуться в Дом.')
          if (incoming.searchParams.has('error')) reject(new Error('Доступ к Gmail не предоставлен'))
          else if (incoming.searchParams.get('code')) resolve(incoming.searchParams.get('code'))
          else reject(new Error('Google не вернул код авторизации'))
        })
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
          this.redirect = `http://127.0.0.1:${server.address().port}/oauth`
          const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
          for (const [key, value] of Object.entries({ client_id: client.clientId, redirect_uri: this.redirect, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent select_account', state: proof.state, code_challenge: proof.challenge, code_challenge_method: 'S256' })) url.searchParams.set(key, value)
          Promise.resolve(this.openExternal(url.toString())).catch(reject)
        })
        timer = setTimeout(() => reject(new Error('Время подключения истекло. Попробуйте снова.')), 300_000)
      })
      const tokens = await this.json('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: client.clientId, code, redirect_uri: this.redirect, code_verifier: proof.verifier, grant_type: 'authorization_code' }) })
      const profile = await this.json(`${API}/profile`, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      const state = await this.getState(); const existing = state.mailAccounts?.find(item => item.email === profile.emailAddress)
      const account = { ...(existing || {}), id: existing?.id || crypto.randomUUID(), email: profile.emailAddress, error: undefined }
      this.vault.set(`gmail:${account.id}`, { ...tokens, expiresAt: Date.now() + tokens.expires_in * 1000 })
      await this.change(previous => ({ ...previous, mailAccounts: [...(previous.mailAccounts || []).filter(item => item.id !== account.id), account] }))
      await this.sync(account.id)
    } finally { clearTimeout(timer); server?.close(); this.connecting = false }
  }
  async access(id) {
    let tokens = this.vault.get(`gmail:${id}`); if (!tokens) throw new Error('Подключите аккаунт заново')
    if (tokens.expiresAt <= Date.now() + 60_000) {
      const client = this.vault.get('google-client')
      if (!tokens.refresh_token || !client) throw new Error('Доступ истёк. Подключите аккаунт заново')
      const fresh = await this.json('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: client.clientId, refresh_token: tokens.refresh_token, grant_type: 'refresh_token' }) })
      tokens = { ...tokens, ...fresh, expiresAt: Date.now() + fresh.expires_in * 1000 }; this.vault.set(`gmail:${id}`, tokens)
    }
    return tokens.access_token
  }
  async sync(id) {
    const initial = await this.getState()
    for (const account of (initial.mailAccounts || []).filter(item => !id || item.id === id)) {
      if (this.busy.has(account.id)) continue
      this.busy.add(account.id)
      try {
        const token = await this.access(account.id)
        const request = suffix => this.json(`${API}${suffix}`, { headers: { Authorization: `Bearer ${token}` } })
        const profile = await request('/profile')
        const ids = new Set(); const removed = new Set(); let full = !account.historyId
        if (!full) {
          try {
            let page = ''
            do { const data = await request(`/history?startHistoryId=${encodeURIComponent(account.historyId)}&maxResults=500${page ? '&pageToken=' + encodeURIComponent(page) : ''}`); for (const record of data.history || []) { for (const group of ['messagesAdded', 'labelsAdded', 'labelsRemoved']) for (const change of record[group] || []) ids.add(change.message.id); for (const item of record.messagesDeleted || []) removed.add(item.message.id) } page = data.nextPageToken || '' } while (page)
          } catch (error) { if (error.status === 404) full = true; else throw error }
        }
        if (full) { const data = await request('/messages?labelIds=INBOX&maxResults=100'); for (const item of data.messages || []) ids.add(item.id) }
        const messages = []
        const list = [...ids]
        for (let offset = 0; offset < list.length; offset += 5) {
          const batch = await Promise.all(list.slice(offset, offset + 5).map(async messageId => {
            try { const data = await request(`/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`); if (!data.labelIds?.includes('INBOX')) { removed.add(messageId); return null } return messageToRecord(account, data) }
            catch (error) { if (error.status === 404) { removed.add(messageId); return null } throw error }
          })); messages.push(...batch.filter(Boolean))
        }
        await this.change(previous => {
          if (!previous.mailAccounts?.some(item => item.id === account.id)) return previous
          const retained = (previous.mailMessages || []).filter(item => item.accountId !== account.id || !full && !ids.has(item.gmailId) && !removed.has(item.gmailId))
          const otherAccounts = retained.filter(item => item.accountId !== account.id)
          const accountMessages = [...retained.filter(item => item.accountId === account.id), ...messages].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)).slice(0, 500)
          return { ...previous, mailMessages: [...otherAccounts, ...accountMessages], mailAccounts: previous.mailAccounts.map(item => item.id === account.id ? { ...item, historyId: profile.historyId, lastSyncedAt: new Date().toISOString(), error: undefined } : item) }
        })
      } catch (error) { await this.change(previous => ({ ...previous, mailAccounts: previous.mailAccounts?.map(item => item.id === account.id ? { ...item, error: [400, 401, 403].includes(error.status) ? 'Доступ к Gmail недоступен. Проверьте подключение.' : error.message } : item) })) }
      finally { this.busy.delete(account.id) }
    }
  }
  async disconnect(id) {
    const tokens = this.vault.get(`gmail:${id}`)
    let error
    if (tokens) { try { await fetchLimited('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tokens.refresh_token || tokens.access_token }) }, 10000, this.fetcher) } catch (e) { error = e } }
    this.vault.set(`gmail:${id}`, undefined)
    await this.change(previous => ({ ...previous, mailAccounts: previous.mailAccounts?.filter(item => item.id !== id), mailMessages: previous.mailMessages?.filter(item => item.accountId !== id) }))
    if (error) throw new Error('Аккаунт отключён локально. Отзыв доступа в Google не подтверждён; проверьте разрешения аккаунта Google.')
  }
}
module.exports = { Gmail, pkce, messageToRecord, SCOPE }
