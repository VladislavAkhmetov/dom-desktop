import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Client Hints and Automation Defense', () => {
  it('в browser.cjs реализована очистка заголовков Sec-CH-UA и User-Agent от Electron', () => {
    const browserCode = readFileSync(path.join(process.cwd(), 'electron', 'browser.cjs'), 'utf8')
    expect(browserCode).toContain('sec-ch-ua')
    expect(browserCode).toContain('Sec-CH-UA-Full-Version-List')
    expect(browserCode).toContain("replace(/Electron\\/\\S+\\s?/g, '')")
    expect(browserCode).toContain('Google Chrome')
  })

  it('в page-preload.cjs переопределен navigator.webdriver для защиты от ложных детекций', () => {
    const preloadCode = readFileSync(path.join(process.cwd(), 'electron', 'page-preload.cjs'), 'utf8')
    expect(preloadCode).toContain('navigator.webdriver')
    expect(preloadCode).toContain("Object.defineProperty(navigator, 'webdriver'")
    expect(preloadCode).toContain('get: () => false')
  })
})

