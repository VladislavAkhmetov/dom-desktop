// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { emptyState } from '../shared/state'
import { BrowserChrome, type BrowserChromeProps } from '../src/browser/BrowserChrome'
import type { BrowserTab } from '../src/types'

const pip = vi.hoisted(() => vi.fn())
vi.mock('../src/cabinetMode', () => ({ isCabinetPreview: true }))
vi.mock('../src/bridge', () => ({ isDesktop: true, bridge: { browser: { pictureInPicture: pip }, vault: undefined, fetchSuggestions: undefined } }))
vi.mock('../src/focus/zenTimer', () => ({ zenTimer: { getState: () => ({ status: 'idle', remainingSeconds: 1800, durationMinutes: 30 }), subscribe: () => () => {} } }))
vi.mock('../src/player/audioStream', () => ({ audioManager: { getIsPlaying: () => false, subscribe: () => () => {}, togglePlay: vi.fn() } }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
beforeEach(() => { pip.mockReset(); pip.mockResolvedValue({ ok: true, state: 'opened' }); document.body.innerHTML = '<div id="test-root"></div>'; root = createRoot(document.getElementById('test-root')!) })
afterEach(async () => { await act(async () => root.unmount()) })
async function render(tab: BrowserTab) {
  const state = emptyState(), noop = () => {}
  const props: BrowserChromeProps = { space: state.spaces[0], spaces: state.spaces, tab, nativeNavigation: true, attentionIsland: () => null,
    onHome: noop, onSpace: noop, onSpaceDashboard: noop, onWeb: noop, onAllSpaces: noop, onNavigate: noop, onNavigation: noop, onSave: noop,
    onDay: noop, onCapture: noop, onAssistant: noop, onFocus: noop, onSearch: noop, onSettings: noop, onPark: noop }
  await act(async () => root.render(<BrowserChrome {...props} />))
}
const button = () => document.querySelector<HTMLButtonElement>('button[aria-label="Картинка в картинке"]')

it('кнопка «Картинка в картинке» есть только у страницы с видео и просит окно у главного процесса', async () => {
  await render({ id: 'text', title: 'Статья', url: 'https://site.test/', hasVideo: false })
  expect(button()).toBeNull()
  await render({ id: 'movie', title: 'Лекция', url: 'https://site.test/video', hasVideo: true })
  expect(button()).not.toBeNull()
  await act(async () => button()!.click())
  expect(pip).toHaveBeenCalledWith('movie')
})
