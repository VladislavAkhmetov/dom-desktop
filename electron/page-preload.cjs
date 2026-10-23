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

// --- Secure Password Detection & Autofill ---
function extractCredentials(container) {
  try {
    if (!container) return null
    const passwordInputs = Array.from(container.querySelectorAll('input[type="password"]'))
    const activePassword = passwordInputs.find(inp => inp.value && inp.offsetParent !== null) || passwordInputs.find(inp => inp.value)
    if (!activePassword || !activePassword.value) return null

    const otherInputs = Array.from(container.querySelectorAll('input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])'))
    let usernameInput = otherInputs.find(inp => {
      const auto = (inp.getAttribute('autocomplete') || '').toLowerCase()
      const type = (inp.getAttribute('type') || '').toLowerCase()
      const name = (inp.getAttribute('name') || '').toLowerCase()
      const id = (inp.getAttribute('id') || '').toLowerCase()
      return (
        auto.includes('username') ||
        auto.includes('email') ||
        type === 'email' ||
        name.includes('user') ||
        name.includes('email') ||
        name.includes('login') ||
        id.includes('user') ||
        id.includes('email') ||
        id.includes('login')
      ) && inp.value && inp.offsetParent !== null
    })

    if (!usernameInput) {
      usernameInput = otherInputs.find(inp => inp.value && inp.offsetParent !== null)
    }

    const username = (usernameInput ? usernameInput.value : '').trim()
    const password = activePassword.value

    return { username, password }
  } catch {
    return null
  }
}

function trySubmitCredentials(container) {
  try {
    const cred = extractCredentials(container)
    if (cred && cred.password && cred.password.length > 0) {
      ipcRenderer.send('page:password-submit', {
        origin: window.location.origin,
        username: cred.username,
        password: cred.password
      })
    }
  } catch {}
}

ipcRenderer.on('page:autofill', (_event, cred) => {
  try {
    if (!cred) return
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'))
    const activePassword = passwordInputs.find(inp => inp.offsetParent !== null) || passwordInputs[0]

    const otherInputs = Array.from(document.querySelectorAll('input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])'))
    let usernameInput = otherInputs.find(inp => {
      const auto = (inp.getAttribute('autocomplete') || '').toLowerCase()
      const type = (inp.getAttribute('type') || '').toLowerCase()
      const name = (inp.getAttribute('name') || '').toLowerCase()
      const id = (inp.getAttribute('id') || '').toLowerCase()
      return (
        auto.includes('username') ||
        auto.includes('email') ||
        type === 'email' ||
        name.includes('user') ||
        name.includes('email') ||
        name.includes('login') ||
        id.includes('user') ||
        id.includes('email') ||
        id.includes('login')
      ) && inp.offsetParent !== null
    }) || otherInputs.find(inp => inp.offsetParent !== null)

    const setNativeValue = (element, value) => {
      const proto = Object.getPrototypeOf(element)
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, value)
      } else {
        element.value = value
      }
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }

    if (usernameInput && cred.username) {
      setNativeValue(usernameInput, cred.username)
    }
    if (activePassword && cred.password) {
      setNativeValue(activePassword, cred.password)
    }
  } catch {}
})

window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('input', event => { if (event.target.matches('input:not([type=search]),textarea,[contenteditable=true]')) dirty = true; report() }, true)
  document.addEventListener('change', event => { if (event.target.matches('select,input[type=checkbox],input[type=radio]')) dirty = true; report() }, true)
  document.addEventListener('submit', event => {
    dirty = false
    trySubmitCredentials(event.target)
    report()
  }, true)
  document.addEventListener('click', event => {
    const target = event.target
    if (target && target.closest) {
      const btn = target.closest('button, input[type="submit"]')
      if (btn) {
        const formOrContainer = btn.closest('form, [role="form"], [role="dialog"], .modal, main, body')
        trySubmitCredentials(formOrContainer)
      }
    }
  }, true)
  for (const name of ['play', 'pause', 'ended']) document.addEventListener(name, report, true)
  window.addEventListener('scroll', report, { passive: true })
})
window.addEventListener('DOMContentLoaded', () => {
  const props = inspectPageProperties()
  ipcRenderer.send('page:signal', { dirty: false, playing: false, scrollY: 0, readerable: props.readerable, lang: props.lang })
})
