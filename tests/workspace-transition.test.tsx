// @vitest-environment jsdom
import { act, useLayoutEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceTransition, type WorkspaceRoute } from '../src/workspaceTransition'

const native = vi.hoisted(() => ({ block: vi.fn(async (_value: boolean) => {}), show: vi.fn() }))
vi.mock('../src/bridge', () => ({ bridge: { browser: native } }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

type TestAnimation = { playbackRate: number; onfinish: (() => void) | null; reverse: () => void; cancel: ReturnType<typeof vi.fn> }
let root: Root, animations: TestAnimation[], reduced: boolean, listeners: Set<() => void>

function App({ preview = false }: { preview?: boolean }) {
  const [route, setRoute] = useState<WorkspaceRoute>({ type: 'space', spaceId: 'work' })
  const shell = useRef<HTMLDivElement>(null)
  const navigate = useWorkspaceTransition(shell, route, setRoute, {})
  useLayoutEffect(() => { if (route.type === 'browse') native.show() }, [route])
  return <div className="app-shell" ref={shell} data-route={route.type}>
    {route.type === 'browse' ? <><div className="browser-context-menu"><button><span>Работа</span></button></div><main className="browser-content"><input aria-label="Live page" />{preview && <iframe className="prototype-page" src="/preview.html" title="Local preview" />}</main><button data-workspace-navigation onClick={() => navigate({ type: 'space', spaceId: 'work' })}>Return</button></>
      : <><div className="space-title-row"><h1>Работа</h1></div><div className="cabinet-contents-scroll"><section className="cabinet-content-section" aria-label="Вкладки пространства"><input aria-label="Draft" defaultValue="Saved draft" /></section></div><button data-workspace-navigation onClick={() => navigate({ type: 'browse', spaceId: 'work' })}>Enter</button></>}
  </div>
}

beforeEach(() => {
  animations = []; reduced = false; listeners = new Set()
  native.block.mockClear(); native.show.mockClear()
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced }, addEventListener: (_type: string, callback: () => void) => listeners.add(callback), removeEventListener: (_type: string, callback: () => void) => listeners.delete(callback) }))
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ x: 10, y: 20, left: 10, top: 20, right: 210, bottom: 120, width: 200, height: 100, toJSON() {} }))
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: vi.fn(() => {
    const animation: TestAnimation = { playbackRate: 1, onfinish: null, reverse() { this.playbackRate *= -1 }, cancel: vi.fn() }
    animations.push(animation)
    return animation
  }) })
  document.body.innerHTML = '<div id="workspace-test"></div>'
  root = createRoot(document.getElementById('workspace-test')!)
})

afterEach(async () => {
  await act(async () => root.unmount())
  delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate
  vi.restoreAllMocks(); vi.unstubAllGlobals()
})

const live = () => document.querySelector<HTMLElement>('#workspace-test .app-shell')!
const click = async (text: string) => act(async () => [...live().querySelectorAll('button')].find(button => button.textContent === text)!.click())
const finish = async () => act(async () => [...animations].reverse().find(animation => animation.onfinish && !animation.cancel.mock.calls.length)?.onfinish?.())

describe('workspace journey', () => {
  it('commits the live route immediately, blocks native views before show, and removes inert scenes when finished', async () => {
    await act(async () => root.render(<App />))
    await click('Enter')
    expect(live().dataset.route).toBe('browse')
    expect(native.block.mock.invocationCallOrder[0]).toBeLessThan(native.show.mock.invocationCallOrder[0])
    const layer = document.querySelector<HTMLElement>('[data-workspace-transition]')!
    expect(layer.getAttribute('aria-hidden')).toBe('true')
    expect(layer.inert).toBe(true)
    expect(layer.querySelectorAll('[role], [id]')).toHaveLength(0)
    await finish()
    expect(layer.isConnected).toBe(false)
    expect(native.block).toHaveBeenLastCalledWith(false)
  })

  it('reverses a second navigation from its current position without creating another layer', async () => {
    await act(async () => root.render(<App />))
    await click('Enter')
    const layer = document.querySelector('[data-workspace-transition]')
    const count = animations.length
    await click('Return')
    expect(live().dataset.route).toBe('space')
    expect(document.querySelector('[data-workspace-transition]')).toBe(layer)
    expect(animations).toHaveLength(count)
    expect(animations.every(animation => animation.playbackRate === -1)).toBe(true)
    await click('Enter')
    expect(animations.every(animation => animation.playbackRate === 1)).toBe(true)
    await finish()
    expect(document.querySelector('[data-workspace-transition]')).toBeNull()
  })

  it('restores dashboard scrolling and focus on return', async () => {
    await act(async () => root.render(<App />))
    live().querySelector('.cabinet-contents-scroll')!.scrollTop = 125
    live().querySelector<HTMLInputElement>('input')!.value = 'Current draft'
    live().querySelector<HTMLButtonElement>('button')!.focus()
    await click('Enter')
    expect(document.querySelector<HTMLInputElement>('.workspace-scene input')!.value).toBe('Current draft')
    await finish()
    await click('Return')
    expect(live().querySelector('.cabinet-contents-scroll')!.scrollTop).toBe(125)
    expect(document.activeElement?.textContent).toBe('Enter')
    await finish()
  })

  it('reveals live controls immediately on input and keeps another open dialog blocking native pages', async () => {
    await act(async () => root.render(<App />))
    await click('Enter')
    const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); document.body.append(dialog)
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    expect(document.querySelector('[data-workspace-transition]')).toBeNull()
    expect(native.block).toHaveBeenLastCalledWith(true)
    expect(animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true)
  })

  it('uses only a short fade for reduced motion and cancels movement when the preference changes', async () => {
    reduced = true
    await act(async () => root.render(<App />))
    await click('Enter')
    expect(animations).toHaveLength(1)
    expect(document.querySelector('.workspace-aperture')).toBeNull()
    await finish(); await click('Return'); await finish()
    await act(async () => { reduced = false; listeners.forEach(listener => listener()) })
    await click('Enter')
    expect(document.querySelector('.workspace-aperture')).not.toBeNull()
    await act(async () => { reduced = true; listeners.forEach(listener => listener()) })
    expect(document.querySelector('[data-workspace-transition]')).toBeNull()
    expect(native.block).toHaveBeenLastCalledWith(false)
  })

  it('copies a local page into an isolated inert preview without another iframe or executable script', async () => {
    await act(async () => root.render(<App preview />))
    await click('Enter'); await finish()
    const frame = live().querySelector<HTMLIFrameElement>('iframe')!
    const off = vi.spyOn(frame, 'removeEventListener')
    frame.contentDocument!.open()
    frame.contentDocument!.write('<!doctype html><html><head><style>body{color:green}</style></head><body><p onclick="alert(1)">Local page</p><script>window.previewRan = true</script></body></html>')
    frame.contentDocument!.close()
    await click('Return')
    const layer = document.querySelector<HTMLElement>('[data-workspace-transition]')!
    const preview = layer.querySelector<HTMLElement>('.prototype-page')!
    expect(layer.querySelector('iframe')).toBeNull()
    expect(preview.shadowRoot?.textContent).toContain('Local page')
    expect(preview.shadowRoot?.querySelector('script')).toBeNull()
    expect(preview.shadowRoot?.querySelector('[onclick]')).toBeNull()
    await finish()
    expect(off.mock.calls.some(([event]) => event === 'load')).toBe(true)
  })
})
