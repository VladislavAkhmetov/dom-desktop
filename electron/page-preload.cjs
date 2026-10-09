const { ipcRenderer } = require('electron')
let dirty = false
let timeout
function report() {
  clearTimeout(timeout)
  timeout = setTimeout(() => ipcRenderer.send('page:signal', { dirty, playing: [...document.querySelectorAll('video,audio')].some(item => !item.paused && !item.ended), scrollY: window.scrollY }), 300)
}
let lastOfferKey = ''
let lastOfferTime = 0

function inspectAndOffer(target) {
  try {
    if (!target) return
    const container = (typeof target.querySelectorAll === 'function')
      ? target
      : (target.closest && (target.closest('form') || target.closest('div')))
    if (!container || typeof container.querySelectorAll !== 'function') return
    const passwordInput = container.querySelector('input[type="password"]')
    if (passwordInput && passwordInput.value && passwordInput.value.length >= 2) {
      const usernameInput = container.querySelector('input[type="text"], input[type="email"], input[name*="user" i], input[name*="login" i], input[autocomplete="username"]')
      const username = usernameInput?.value?.trim() || ''
      const password = passwordInput.value
      const origin = window.location.origin
      const title = document.title || window.location.hostname
      const key = `${origin}:${username}:${password}`
      const now = Date.now()
      if (key === lastOfferKey && (now - lastOfferTime) < 3000) return
      lastOfferKey = key
      lastOfferTime = now
      if (origin && (origin.startsWith('http://') || origin.startsWith('https://'))) {
        ipcRenderer.send('page:password-offer', { origin, username, password, title })
      }
    }
  } catch {
    // safe fallback
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('input', event => { if (event.target.matches('input:not([type=search]),textarea,[contenteditable=true]')) dirty = true; report() }, true)
  document.addEventListener('submit', event => { dirty = false; report(); inspectAndOffer(event.target) }, true)
  document.addEventListener('click', event => {
    const btn = event.target?.closest?.('button, input[type="submit"]')
    if (btn) inspectAndOffer(btn)
  }, true)
  for (const name of ['play', 'pause', 'ended']) document.addEventListener(name, report, true)
  window.addEventListener('scroll', report, { passive: true })
})
window.addEventListener('DOMContentLoaded', () => ipcRenderer.send('page:signal', { dirty: false, playing: false, scrollY: 0 }))
