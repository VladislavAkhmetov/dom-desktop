const { ipcRenderer } = require('electron')

// Remove navigator.webdriver signature to prevent Google Auth and Cloudflare blocks
try {
  Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
    get: () => false,
    configurable: true,
    enumerable: true
  })
} catch {}
try {
  Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
    configurable: true,
    enumerable: true
  })
} catch {}

function injectMainWorldWebdriverFix() {
  try {
    const script = document.createElement('script')
    script.textContent = `
      try {
        Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
          get: () => false,
          configurable: true,
          enumerable: true
        });
      } catch (e) {}
      try {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
          configurable: true,
          enumerable: true
        });
      } catch (e) {}
    `
    const parent = document.head || document.documentElement
    if (parent) {
      parent.appendChild(script)
      script.remove()
    } else {
      window.addEventListener('DOMContentLoaded', () => {
        try {
          (document.head || document.documentElement)?.appendChild(script)
          script.remove()
        } catch {}
      }, { once: true })
    }
  } catch {}
}

if (typeof document !== 'undefined') {
  if (document.documentElement) {
    injectMainWorldWebdriverFix()
  } else {
    window.addEventListener('DOMContentLoaded', injectMainWorldWebdriverFix, { once: true })
  }
}

let dirty = false
let timeout
function inspectPageProperties() {
  try {
    const articleElem = document.querySelector('article, [role="article"], .article, .post-content, .entry-content')
    const paragraphs = document.querySelectorAll('p')
    let totalPText = 0
    for (let i = 0; i < Math.min(paragraphs.length, 25); i++) {
      totalPText += (paragraphs[i].textContent || '').length
    }
    const readerable = Boolean(articleElem || (paragraphs.length >= 4 && totalPText >= 800))

    const docLang = (document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.content || '').toLowerCase()
    let lang = ''
    if (docLang) {
      lang = docLang.split('-')[0]
    } else {
      const sample = (document.body?.innerText || '').slice(0, 500)
      const hasCyrillic = /[\u0400-\u04FF]/.test(sample)
      if (!hasCyrillic && /[a-zA-Z]{5,}/.test(sample)) {
        lang = 'en'
      } else if (hasCyrillic) {
        lang = 'ru'
      }
    }
    return { readerable, lang }
  } catch {
    return { readerable: false, lang: '' }
  }
}

function report() {
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    const props = inspectPageProperties()
    ipcRenderer.send('page:signal', {
      dirty,
      playing: [...document.querySelectorAll('video,audio')].some(item => !item.paused && !item.ended),
      scrollY: window.scrollY,
      readerable: props.readerable,
      lang: props.lang
    })
  }, 300)
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
  document.addEventListener('change', event => { if (event.target.matches('select,input[type=checkbox],input[type=radio]')) dirty = true; report() }, true)
  document.addEventListener('submit', event => { dirty = false; report(); inspectAndOffer(event.target) }, true)
  document.addEventListener('click', event => {
    const btn = event.target?.closest?.('button, input[type="submit"]')
    if (btn) inspectAndOffer(btn)
  }, true)
  for (const name of ['play', 'pause', 'ended']) document.addEventListener(name, report, true)
  window.addEventListener('scroll', report, { passive: true })
})
window.addEventListener('DOMContentLoaded', () => {
  const props = inspectPageProperties()
  ipcRenderer.send('page:signal', { dirty: false, playing: false, scrollY: 0, readerable: props.readerable, lang: props.lang })
})
