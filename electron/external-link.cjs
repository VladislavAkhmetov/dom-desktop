// A web address handed to the app from outside: `dombro.exe https://…` (a shortcut, «Open with»,
// another program) or a second launch while the app runs. Only http/https is accepted.
function webAddress(value) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}

// First address in a command line; flags (`--dev`, `--user-data-dir=…`) and paths are ignored.
function addressFromArgv(argv) {
  if (!Array.isArray(argv)) return ''
  for (const value of argv.slice(1)) {
    if (typeof value !== 'string' || value.startsWith('-')) continue
    const address = webAddress(value)
    if (address) return address
  }
  return ''
}

// Addresses wait here until the interface has loaded and asked for them (it may start after the launch).
function createLinkQueue(send) {
  let ready = false
  const waiting = []
  return {
    push(address) { if (!address) return; if (ready) send(address); else if (waiting.length < 10) waiting.push(address) },
    ready() { ready = true; while (waiting.length) send(waiting.shift()) },
    reset() { ready = false }
  }
}

module.exports = { webAddress, addressFromArgv, createLinkQueue }
