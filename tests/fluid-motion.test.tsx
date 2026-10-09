// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AnimatePresence } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FluidGroup, FluidSurface } from '../src/FluidMotion'
import { useFluidReducedMotion } from '../src/motion'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root, reduced = false
let listeners: Set<() => void>
beforeEach(() => {
  reduced = false
  listeners = new Set()
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reduced },
    addEventListener: (_type: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_type: string, callback: () => void) => listeners.delete(callback),
    addListener() {}, removeListener() {},
  }))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  document.body.innerHTML = '<div id="motion-test"></div>'
  root = createRoot(document.getElementById('motion-test')!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('fluid motion accessibility', () => {
  it('responds to the system motion preference without a reload and removes subscriptions', async () => {
    function Preference() { return <output>{useFluidReducedMotion() ? 'reduced' : 'full'}</output> }
    await act(async () => root.render(<Preference />))
    expect(document.querySelector('output')?.textContent).toBe('full')
    await act(async () => { reduced = true; listeners.forEach(callback => callback()) })
    expect(document.querySelector('output')?.textContent).toBe('reduced')
    await act(async () => root.render(null))
    expect(listeners.size).toBe(0)
  })

  it('removes a closing panel from focus and accessibility before its visual exit ends', async () => {
    function Panel() {
      const [open, setOpen] = useState(true)
      return <><button onClick={() => setOpen(false)}>Close panel</button><AnimatePresence>{open && <FluidSurface role="dialog" aria-label="Quick entry"><input aria-label="Draft" /></FluidSurface>}</AnimatePresence></>
    }
    await act(async () => root.render(<Panel />))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    await act(async () => document.querySelector<HTMLButtonElement>('button')!.click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    const exiting = document.querySelector<HTMLElement>('.fluid-surface')!
    expect(exiting.hasAttribute('inert')).toBe(true)
    expect(exiting.getAttribute('aria-hidden')).toBe('true')
    expect(exiting.style.pointerEvents).toBe('none')
  })

  it('keeps empty space inert and retains the existing selected and disabled controls', async () => {
    const choose = vi.fn()
    await act(async () => root.render(<FluidGroup as="nav" aria-label="Spaces"><button className="selected" aria-current="page" onClick={choose}>My day</button><button disabled onClick={choose}>Unavailable</button></FluidGroup>))
    await act(async () => document.querySelector<HTMLElement>('nav')!.click())
    expect(choose).not.toHaveBeenCalled()
    await act(async () => document.querySelectorAll<HTMLButtonElement>('button')[1].click())
    expect(choose).not.toHaveBeenCalled()
    await act(async () => document.querySelector<HTMLButtonElement>('button')!.click())
    expect(choose).toHaveBeenCalledOnce()
    expect(document.querySelector('button')?.getAttribute('aria-current')).toBe('page')
  })
})
