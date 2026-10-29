// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Settings } from '../src/Settings'
import type { AppState, SupportedLocale } from '../src/types'
import { I18nProvider } from '../src/i18n'

vi.mock('../src/bridge', () => ({ bridge: { platform: 'win32' }, isDesktop: true }))
vi.mock('../src/demo', () => ({ isDemo: false }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root
let current: AppState
const onClose = vi.fn()
const onDashboard = vi.fn()
const onBackup = vi.fn()
const initial: AppState = {
  version: 2,
  locale: 'ru',
  spaces: [],
  reminders: [],
  dismissedUntil: null
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  onClose.mockReset()
  onDashboard.mockReset()
  onBackup.mockReset()
  document.body.innerHTML = '<div id="test-root"></div>'
  root = createRoot(document.getElementById('test-root')!)
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

function Harness({ initialLocale = 'ru' }: { initialLocale?: SupportedLocale }) {
  const [state, setState] = useState<AppState>({ ...structuredClone(initial), locale: initialLocale })
  current = state
  return (
    <I18nProvider locale={state.locale} onLocaleChange={locale => setState(prev => ({ ...prev, locale }))}>
      <Settings
        state={state}
        onChange={setState}
        onClose={onClose}
        onDashboard={onDashboard}
        autostart={false}
        onAutostart={vi.fn()}
        onBackup={onBackup}
        calendarName=""
        calendarUrl=""
        onCalendarName={vi.fn()}
        onCalendarUrl={vi.fn()}
        onAddCalendar={vi.fn()}
        onRemoveCalendar={vi.fn()}
        onCalendarRefresh={vi.fn()}
        calendarRefreshing={false}
        onNewsRefresh={vi.fn()}
        newsRefreshing={false}
      />
    </I18nProvider>
  )
}

async function mount(initialLocale: SupportedLocale = 'ru') {
  await act(async () => root.render(<Harness initialLocale={initialLocale} />))
}

function button(text: string) {
  const result = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim().includes(text))
  if (!result) throw new Error(`Button not found: ${text}`)
  return result
}

async function click(element: HTMLElement) {
  await act(async () => element.click())
}

describe('Settings language switching', () => {
  it('renders default Russian labels initially', async () => {
    await mount('ru')
    expect(document.querySelector('.settings-section-heading h3')?.textContent).toBe('Общие')
    expect(document.querySelector('.settings-card-heading h4')?.textContent).toBe('Язык интерфейса')
    expect(button('English')).toBeDefined()
    expect(button('Deutsch')).toBeDefined()
  })

  it('switches to English when clicking English', async () => {
    await mount('ru')
    await click(button('English'))
    expect(current.locale).toBe('en')
    expect(document.querySelector('.settings-section-heading h3')?.textContent).toBe('General')
    expect(document.querySelector('.settings-card-heading h4')?.textContent).toBe('Interface Language')
    expect(button('General')).toBeDefined()
    expect(button('Profile')).toBeDefined()
  })

  it('switches to German when clicking Deutsch', async () => {
    await mount('ru')
    await click(button('Deutsch'))
    expect(current.locale).toBe('de')
    expect(document.querySelector('.settings-section-heading h3')?.textContent).toBe('Allgemein')
    expect(document.querySelector('.settings-card-heading h4')?.textContent).toBe('Oberflächensprache')
    expect(button('Allgemein')).toBeDefined()
    expect(button('Profil')).toBeDefined()
  })

  it('switches to Spanish when clicking Español', async () => {
    await mount('ru')
    await click(button('Español'))
    expect(current.locale).toBe('es')
    expect(document.querySelector('.settings-section-heading h3')?.textContent).toBe('General')
    expect(document.querySelector('.settings-card-heading h4')?.textContent).toBe('Idioma de la interfaz')
    expect(button('Perfil')).toBeDefined()
  })

  it('switches to French when clicking Français', async () => {
    await mount('ru')
    await click(button('Français'))
    expect(current.locale).toBe('fr')
    expect(document.querySelector('.settings-section-heading h3')?.textContent).toBe('Général')
    expect(document.querySelector('.settings-card-heading h4')?.textContent).toBe('Langue de l\'interface')
    expect(button('Profil')).toBeDefined()
  })

  it('switches to Chinese when clicking 中文', async () => {
    await mount('ru')
    await click(button('中文'))
    expect(current.locale).toBe('zh')
    expect(document.querySelector('.settings-section-heading h3')?.textContent).toBe('通用')
    expect(document.querySelector('.settings-card-heading h4')?.textContent).toBe('界面语言')
    expect(button('个人资料')).toBeDefined()
  })
})
