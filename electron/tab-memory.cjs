// Memory Saver: hidden, unprotected tabs give their renderer process back after a while. The tab stays
// in the session (URL, scroll position, cover); showing it again recreates the page.
const DISCARD_AFTER_MS = 30 * 60_000
const MAX_HIDDEN_LIVE = 12

// Which live tabs to close: hidden for DISCARD_AFTER_MS or longer, plus the oldest hidden ones beyond
// MAX_HIDDEN_LIVE. Visible and protected tabs (form input, playback, audio) are never chosen.
function idleTabs(records, now = Date.now(), { after = DISCARD_AFTER_MS, keep = MAX_HIDDEN_LIVE } = {}) {
  const hidden = records
    .filter(record => !record.desired && !record.protected && !record.audible && !record.playing && record.hiddenAt)
    .sort((a, b) => a.hiddenAt - b.hiddenAt)
  const excess = Math.max(0, hidden.length - keep)
  return hidden.filter((record, index) => index < excess || now - record.hiddenAt >= after)
}

module.exports = { DISCARD_AFTER_MS, MAX_HIDDEN_LIVE, idleTabs }
