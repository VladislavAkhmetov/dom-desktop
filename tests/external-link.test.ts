import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { webAddress, addressFromArgv, createLinkQueue } = require('../electron/external-link.cjs')

describe('адрес из вне приложения', () => {
  it('принимает только http и https', () => {
    expect(webAddress('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(webAddress('  http://example.com  ')).toBe('http://example.com/')
    for (const value of ['javascript:alert(1)', 'file:///C:/secret.txt', 'C:\\Users\\a\\doc.html', 'example.com', '', null, 42]) expect(webAddress(value)).toBe('')
  })

  it('берёт первый адрес из командной строки, пропуская флаги и пути', () => {
    expect(addressFromArgv(['dombro.exe', 'https://example.com/'])).toBe('https://example.com/')
    expect(addressFromArgv(['electron', '.', '--dev', '--user-data-dir=C:\\tmp', 'http://a.test/x'])).toBe('http://a.test/x')
    expect(addressFromArgv(['dombro.exe', '--flag=https://evil.test/', 'C:\\doc.pdf'])).toBe('')
    expect(addressFromArgv(['https://first-is-the-executable.test/', 'https://second.test/'])).toBe('https://second.test/')
    expect(addressFromArgv(['dombro.exe'])).toBe('')
    expect(addressFromArgv(undefined)).toBe('')
  })

  it('держит адреса, пока интерфейс не готов, и отдаёт их по порядку; после перезагрузки снова ждёт', () => {
    const send = vi.fn()
    const queue = createLinkQueue(send)
    queue.push('https://one.test/'); queue.push(''); queue.push('https://two.test/')
    expect(send).not.toHaveBeenCalled()
    queue.ready()
    expect(send.mock.calls.map(call => call[0])).toEqual(['https://one.test/', 'https://two.test/'])
    queue.push('https://three.test/')
    expect(send).toHaveBeenLastCalledWith('https://three.test/')
    queue.reset()
    queue.push('https://four.test/')
    expect(send).toHaveBeenCalledTimes(3)
    queue.ready()
    expect(send).toHaveBeenLastCalledWith('https://four.test/')
  })

  it('не копит больше десяти ожидающих адресов', () => {
    const send = vi.fn()
    const queue = createLinkQueue(send)
    for (let index = 0; index < 25; index++) queue.push(`https://site${index}.test/`)
    queue.ready()
    expect(send).toHaveBeenCalledTimes(10)
  })
})
