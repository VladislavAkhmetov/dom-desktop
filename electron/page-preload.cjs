const { ipcRenderer } = require('electron')
let dirty = false
let timeout
function report() {
  clearTimeout(timeout)
  timeout = setTimeout(() => ipcRenderer.send('page:signal', { dirty, playing: [...document.querySelectorAll('video,audio')].some(item => !item.paused && !item.ended), scrollY: window.scrollY }), 300)
}
window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('input', event => { if (event.target.matches('input:not([type=search]),textarea,[contenteditable=true]')) dirty = true; report() }, true)
  document.addEventListener('submit', () => { dirty = false; report() }, true)
  for (const name of ['play', 'pause', 'ended']) document.addEventListener(name, report, true)
  window.addEventListener('scroll', report, { passive: true })
})
window.addEventListener('DOMContentLoaded', () => ipcRenderer.send('page:signal', { dirty: false, playing: false, scrollY: 0 }))
