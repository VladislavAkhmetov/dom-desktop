const { Worker } = require('node:worker_threads')
const path = require('node:path')

function createStorage(directory) {
  const worker = new Worker(path.join(__dirname, 'storage-worker.cjs'), { workerData: { directory } })
  let sequence = 0
  const pending = new Map()
  let failReady
  const ready = new Promise((resolve, reject) => {
    failReady = reject
    worker.on('message', message => {
      if (message.ready) resolve()
      else if (message.fatal) { reject(new Error(message.fatal)); for (const request of pending.values()) request.reject(new Error(message.fatal)); pending.clear() }
      else { const request = pending.get(message.id); if (request) { pending.delete(message.id); message.error ? request.reject(new Error(message.error)) : request.resolve(message.result) } }
    })
  })
  worker.on('error', error => { failReady(error); for (const request of pending.values()) request.reject(error); pending.clear() })
  worker.on('exit', code => { const error = new Error(`Хранилище остановлено (${code}). Данные сохранены на диске.`); failReady(error); for (const request of pending.values()) request.reject(error); pending.clear() })
  const call = async (action, args = {}) => { await ready; return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); worker.postMessage({ id, action, ...args }) }) }
  return { ready, get: () => call('get'), apply: changes => call('apply', { changes }), search: query => call('search', { query }), backup: () => call('backup'), close: () => worker.terminate() }
}
module.exports = { createStorage }
