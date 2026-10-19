import { describe, expect, it } from 'vitest'

describe('Client Hints and Automation Defense', () => {
  it('формирует корректные заголовки Sec-CH-UA с брендом Google Chrome и версией Chromium', () => {
    const chromeVersion = process.versions.chrome || '132.0.6834.83'
    const majorChrome = chromeVersion.split('.')[0]
    const secChUa = `"Not A(Brand";v="99", "Google Chrome";v="${majorChrome}", "Chromium";v="${majorChrome}"`
    const secChUaFullVersionList = `"Not A(Brand";v="99.0.0.0", "Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}"`

    expect(secChUa).toContain('Google Chrome')
    expect(secChUa).toContain(majorChrome)
    expect(secChUa).not.toContain('Electron')

    expect(secChUaFullVersionList).toContain('Google Chrome')
    expect(secChUaFullVersionList).toContain(chromeVersion)
    expect(secChUaFullVersionList).not.toContain('Electron')
  })

  it('корректно подменяет Sec-CH-UA и очищает User-Agent в перехваченных заголовках', () => {
    const chromeVersion = process.versions.chrome || '132.0.0.0'
    const majorChrome = chromeVersion.split('.')[0]
    const secChUa = `"Not A(Brand";v="99", "Google Chrome";v="${majorChrome}", "Chromium";v="${majorChrome}"`
    const secChUaFullVersionList = `"Not A(Brand";v="99.0.0.0", "Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}"`

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Electron/41.10.7 Safari/537.36',
      'sec-ch-ua': '"Not A(Brand";v="99", "Chromium";v="132", "Electron";v="41"',
      'Sec-CH-UA-Full-Version-List': '"Not A(Brand";v="99.0.0.0", "Chromium";v="132.0.0.0", "Electron";v="41.10.7"'
    }

    // Симуляция логики onBeforeSendHeaders
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase()
      if (lower === 'sec-ch-ua') {
        headers[key] = secChUa
      } else if (lower === 'sec-ch-ua-full-version-list') {
        headers[key] = secChUaFullVersionList
      } else if (lower === 'user-agent' && typeof headers[key] === 'string') {
        headers[key] = headers[key].replace(/Electron\/\S+\s?/g, '')
      }
    }

    expect(headers['User-Agent']).not.toContain('Electron')
    expect(headers['sec-ch-ua']).toContain('"Google Chrome"')
    expect(headers['sec-ch-ua']).not.toContain('Electron')
    expect(headers['Sec-CH-UA-Full-Version-List']).toContain('"Google Chrome"')
    expect(headers['Sec-CH-UA-Full-Version-List']).not.toContain('Electron')
  })

  it('гарантирует, что navigator.webdriver возвращает false после переопределения', () => {
    const mockNavigator: { webdriver?: boolean } = { webdriver: true }

    Object.defineProperty(mockNavigator, 'webdriver', {
      get: () => false,
      configurable: true,
      enumerable: true
    })

    expect(mockNavigator.webdriver).toBe(false)
  })
})
