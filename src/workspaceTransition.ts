import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { bridge } from './bridge'
import { useFluidReducedMotion } from './motion'

export type WorkspaceRoute = { type: 'home' } | { type: 'spaces' } | { type: 'space'; spaceId: string } | { type: 'browse'; spaceId: string }
type Box = { x: number; y: number; width: number; height: number }
type ScrollPosition = { path: string; top: number; left: number }
type Journey = { dashboard: WorkspaceRoute; focus: string | null; source: Box }
type Transition = { layer: HTMLElement; from: WorkspaceRoute; to: WorkspaceRoute; outgoing: HTMLElement; animations: Animation[]; cleanup: Array<() => void>; reverse: boolean; started: boolean; source: Box; sourceTitle: HTMLElement | null; finish: () => void }

export const workspaceTiming = { duration: 320, easing: 'cubic-bezier(.22,.68,.24,1)', fill: 'both' } as const
const sameRoute = (a: WorkspaceRoute, b: WorkspaceRoute) => a.type === b.type && ('spaceId' in a ? 'spaceId' in b && a.spaceId === b.spaceId : true)
const routeKey = (route: WorkspaceRoute) => route.type + ('spaceId' in route ? `:${route.spaceId}` : '')

function elementPath(element: Element, root: Element): string | null {
  const parts: string[] = []
  for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
    if (!node.parentElement) return null
    parts.unshift(`:nth-child(${[...node.parentElement.children].indexOf(node) + 1})`)
  }
  return root.contains(element) ? `:scope > ${parts.join(' > ')}` : null
}

export function rememberScroll(root: HTMLElement): ScrollPosition[] {
  return [...root.querySelectorAll<HTMLElement>('*')].filter(element => element.scrollTop || element.scrollLeft)
    .map(element => ({ path: elementPath(element, root)!, top: element.scrollTop, left: element.scrollLeft }))
}

export function restoreScroll(root: HTMLElement, positions: ScrollPosition[]) {
  for (const position of positions) {
    const element = root.querySelector<HTMLElement>(position.path)
    if (element) { element.scrollTop = position.top; element.scrollLeft = position.left }
  }
}

function visibleBox(element: Element | null): Box | null {
  if (!element) return null
  const r = element.getBoundingClientRect()
  const x = Math.max(0, r.left), y = Math.max(0, r.top)
  const width = Math.min(innerWidth, r.right) - x, height = Math.min(innerHeight, r.bottom) - y
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

function sourceSurface(root: HTMLElement) {
  const focused = document.activeElement
  return focused instanceof HTMLElement && root.contains(focused) && focused.closest('.cabinet-tab-card')
    || root.querySelector('.cabinet-content-section[aria-label="Вкладки пространства"]')
    || root.querySelector('.resume-card') || root.querySelector('.hub-content')
}

function titleElement(root: HTMLElement, route: WorkspaceRoute): HTMLElement | null {
  if (route.type === 'browse') return root.querySelector('.browser-context-menu .menu-trigger > span')
  if (route.type === 'space') return root.querySelector('.space-title-row h1')
  return root.querySelector('.resume-space-link > span')
}

/** Read-only DOM preview for our same-origin demo pages; no second live iframe. */
function framePreview(frame: HTMLIFrameElement, host: HTMLElement) {
  try {
    const page = frame.contentDocument
    if (!page?.body || page.URL === 'about:blank') return
    const html = page.documentElement.cloneNode(true) as HTMLElement
    html.querySelectorAll('script, iframe, webview, audio, video, meta, base, link:not([rel="stylesheet"])').forEach(element => element.remove())
    html.querySelectorAll<HTMLElement>('*').forEach(element => {
      for (const attribute of [...element.attributes]) if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name)
    })
    const images = [...page.querySelectorAll('img')]
    html.querySelectorAll<HTMLImageElement>('img').forEach((image, index) => { image.src = images[index].currentSrc || images[index].src; image.removeAttribute('srcset'); image.loading = 'eager' })
    const sheets = [...page.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
    html.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((sheet, index) => { sheet.href = sheets[index].href })
    html.style.width = '100%'
    html.style.transform = `translate(${-frame.contentWindow!.scrollX}px, ${-frame.contentWindow!.scrollY}px)`
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' })
    shadow.replaceChildren(html)
    const bodyStyle = frame.contentWindow!.getComputedStyle(page.body)
    host.style.background = bodyStyle.backgroundColor
    host.style.font = bodyStyle.font
    host.style.color = bodyStyle.color
  } catch { /* External pages use the native cover; cross-origin documents are never read. */ }
}

/** Clone only inert visuals. Frames stay live only in the actual renderer. */
function snapshot(root: HTMLElement, covers: Record<string, string>, cleanup: Array<() => void>): HTMLElement {
  const scene = root.cloneNode(true) as HTMLElement
  scene.classList.add('workspace-scene')
  scene.setAttribute('aria-hidden', 'true')
  scene.inert = true
  const originals = [...root.querySelectorAll<HTMLElement>('*')]
  const copies = [...scene.querySelectorAll<HTMLElement>('*')]
  copies.forEach((copy, index) => {
    copy.removeAttribute('id'); copy.removeAttribute('role'); copy.removeAttribute('autofocus')
    copy.removeAttribute('aria-controls'); copy.removeAttribute('aria-labelledby'); copy.removeAttribute('aria-describedby')
    if (copy instanceof HTMLInputElement && originals[index] instanceof HTMLInputElement) copy.value = originals[index].value
    if (copy instanceof HTMLTextAreaElement && originals[index] instanceof HTMLTextAreaElement) copy.value = originals[index].value
    if (copy instanceof HTMLImageElement) copy.loading = 'eager'
    if (copy instanceof HTMLIFrameElement && originals[index] instanceof HTMLIFrameElement) {
      const frame = originals[index]
      const host = document.createElement('div')
      host.className = copy.className
      host.style.cssText = copy.style.cssText
      host.style.overflow = 'hidden'
      copy.replaceWith(host)
      const fill = () => framePreview(frame, host)
      fill()
      frame.addEventListener('load', fill)
      cleanup.push(() => frame.removeEventListener('load', fill))
    }
  })
  scene.querySelectorAll('iframe, webview, script, audio, video').forEach(element => element.remove())
  // The root ref is deliberately absent from snapshots; no duplicate live identifiers.
  scene.removeAttribute('id')
  fillNativePreviews(scene, covers)
  return scene
}

function fillNativePreviews(scene: HTMLElement, covers: Record<string, string>) {
  scene.querySelectorAll<HTMLElement>('[data-workspace-tab-id]').forEach(viewport => {
    const cover = covers[viewport.dataset.workspaceTabId!]
    if (!cover || !/^data:image\/png;base64,/i.test(cover)) return
    let image = viewport.querySelector<HTMLImageElement>('.native-cover')
    if (!image) { image = document.createElement('img'); image.className = 'native-cover'; image.alt = ''; viewport.append(image) }
    if (image.getAttribute('src') !== cover) image.src = cover
  })
}

function clip(box: Box, radius: number) {
  return `inset(${box.y}px ${Math.max(0, innerWidth - box.x - box.width)}px ${Math.max(0, innerHeight - box.y - box.height)}px ${box.x}px round ${radius}px)`
}

export function useWorkspaceTransition(rootRef: RefObject<HTMLDivElement | null>, route: WorkspaceRoute, setRoute: (route: WorkspaceRoute) => void, covers: Record<string, string>) {
  const reduced = useFluidReducedMotion()
  const current = useRef(route)
  current.current = route
  const pending = useRef<Transition | null>(null)
  const journey = useRef<Journey | null>(null)
  const scrollCache = useRef(new Map<string, ScrollPosition[]>())
  const coversRef = useRef(covers)
  coversRef.current = covers

  function navigate(next: WorkspaceRoute) {
    const previous = current.current
    if (sameRoute(previous, next)) { setRoute(next); return }
    const root = rootRef.current
    // JSDOM and older renderers retain immediate navigation. Modals own their own exits.
    if (!root || typeof root.animate !== 'function' || document.querySelector('[role="dialog"]')) { pending.current?.finish(); setRoute(next); return }
    const crossing = (previous.type === 'browse') !== (next.type === 'browse')
    const existing = pending.current
    if (crossing && existing?.started && (sameRoute(next, existing.from) || sameRoute(next, existing.to)) && !reduced) {
      const reverse = sameRoute(next, existing.from)
      if (existing.reverse !== reverse) existing.animations.forEach(animation => animation.reverse())
      existing.reverse = reverse
      existing.layer.dataset.direction = existing.reverse ? 'reverse' : 'forward'
      current.current = next
      setRoute(next)
      return
    }
    existing?.finish()
    if (!crossing) { current.current = next; setRoute(next); return }
    scrollCache.current.set(routeKey(previous), rememberScroll(root))
    const entering = next.type === 'browse'
    const source = visibleBox(entering ? sourceSurface(root) : root.querySelector('.browser-content'))
      || { x: 0, y: 0, width: innerWidth, height: innerHeight }
    const focus = document.activeElement instanceof HTMLElement ? elementPath(document.activeElement, root) : null
    if (entering) journey.current = { dashboard: previous, focus, source }
    const layer = document.createElement('div')
    layer.className = 'workspace-transition'
    layer.dataset.workspaceTransition = entering ? 'enter' : 'leave'
    layer.dataset.direction = 'forward'
    layer.setAttribute('aria-hidden', 'true')
    layer.inert = true
    const cleanup: Array<() => void> = []
    const outgoing = snapshot(root, coversRef.current, cleanup)
    layer.append(outgoing)
    document.body.append(layer)
    restoreScroll(outgoing, scrollCache.current.get(routeKey(previous)) || [])
    // Enqueue blocking before NativePane enqueues show: pages load at their final size underneath.
    void bridge.browser?.block(true).catch(() => undefined)
    const finish = () => {
      if (pending.current?.layer !== layer) return
      const transition = pending.current
      pending.current = null
      transition.animations.forEach(animation => animation.cancel())
      transition.cleanup.forEach(dispose => dispose())
      layer.remove()
      const blocked = Boolean(document.querySelector('[role="dialog"], [role="menu"], [data-browser-drag-layer], [data-workspace-transition]'))
      void bridge.browser?.block(blocked).catch(() => undefined)
    }
    pending.current = { layer, from: previous, to: next, outgoing, source, sourceTitle: titleElement(outgoing, previous), animations: [], cleanup, reverse: false, started: false, finish }
    current.current = next
    setRoute(next)
  }

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const remembered = scrollCache.current.get(routeKey(route))
    if (remembered) restoreScroll(root, remembered)
    const transition = pending.current
    if (!transition) return
    const entering = route.type === 'browse'
    const focus = entering ? root.querySelector<HTMLElement>('.browser-context-menu > button')
      : journey.current && sameRoute(route, journey.current.dashboard) && journey.current.focus ? root.querySelector<HTMLElement>(journey.current.focus) : null
    focus?.focus({ preventScroll: true })
    if (transition.started) return
    transition.started = true
    if (reduced) {
      const animation = transition.outgoing.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'both' })
      transition.animations = [animation]
      animation.onfinish = transition.finish
      return
    }
    const incoming = snapshot(root, coversRef.current, transition.cleanup)
    const viewport = { x: 0, y: 0, width: innerWidth, height: innerHeight }
    const destination = entering ? viewport : visibleBox(sourceSurface(root)) || journey.current?.source || viewport
    const aperture = document.createElement('div')
    aperture.className = 'workspace-aperture'
    if (entering) { aperture.append(incoming); transition.layer.append(aperture) }
    else { transition.layer.prepend(incoming); aperture.append(transition.outgoing); transition.layer.append(aperture) }
    restoreScroll(incoming, remembered || [])
    const fromBox = entering ? transition.source : viewport, toBox = destination
    const movement = aperture.animate([{ clipPath: clip(fromBox, entering ? 28 : 0) }, { clipPath: clip(toBox, entering ? 0 : 28) }], workspaceTiming)
    const content = (entering ? incoming : transition.outgoing).animate([
      { transform: `scale(${entering ? .985 : 1})` },
      { transform: `scale(${entering ? 1 : .985})` },
    ], workspaceTiming)
    const frame = document.createElement('div')
    frame.className = 'workspace-transition-frame'
    transition.layer.append(frame)
    const frameMotion = frame.animate([
      { left: `${fromBox.x}px`, top: `${fromBox.y}px`, width: `${fromBox.width}px`, height: `${fromBox.height}px`, borderRadius: entering ? '28px' : '0px', opacity: .55 },
      { left: `${toBox.x}px`, top: `${toBox.y}px`, width: `${toBox.width}px`, height: `${toBox.height}px`, borderRadius: entering ? '0px' : '28px', opacity: 0 },
    ], workspaceTiming)
    transition.animations = [movement, content, frameMotion]
    const sourceTitle = transition.sourceTitle, targetTitle = titleElement(incoming, route)
    const sourceBox = visibleBox(sourceTitle), targetBox = visibleBox(targetTitle)
    if (sourceTitle && targetTitle && sourceBox && targetBox && sourceTitle.textContent?.trim() === targetTitle.textContent?.trim()) {
      const label = document.createElement('span')
      label.className = 'workspace-transition-title'
      label.textContent = targetTitle.textContent
      const fromStyle = getComputedStyle(sourceTitle), toStyle = getComputedStyle(targetTitle)
      sourceTitle.style.visibility = 'hidden'; targetTitle.style.visibility = 'hidden'
      transition.layer.append(label)
      transition.animations.push(label.animate([
        { left: `${sourceBox.x}px`, top: `${sourceBox.y}px`, width: `${sourceBox.width}px`, fontSize: fromStyle.fontSize, fontWeight: fromStyle.fontWeight, color: fromStyle.color },
        { left: `${targetBox.x}px`, top: `${targetBox.y}px`, width: `${targetBox.width}px`, fontSize: toStyle.fontSize, fontWeight: toStyle.fontWeight, color: toStyle.color },
      ], workspaceTiming))
    }
    movement.onfinish = transition.finish
  }, [route])

  useEffect(() => {
    const transition = pending.current
    if (transition) fillNativePreviews(transition.layer, covers)
  }, [covers])

  useEffect(() => {
    if (reduced && pending.current?.started) pending.current.finish()
  }, [reduced])

  useEffect(() => {
    const interrupt = (event: Event) => {
      if (event.type === 'pointerdown' && event.target instanceof Element && event.target.closest('[data-workspace-navigation]')) return
      pending.current?.finish()
    }
    const visibility = () => { if (document.hidden) pending.current?.finish() }
    document.addEventListener('pointerdown', interrupt, true)
    document.addEventListener('keydown', interrupt, true)
    document.addEventListener('wheel', interrupt, { capture: true, passive: true })
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('resize', interrupt)
    return () => {
      document.removeEventListener('pointerdown', interrupt, true)
      document.removeEventListener('keydown', interrupt, true)
      document.removeEventListener('wheel', interrupt, true)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('resize', interrupt)
      pending.current?.finish()
    }
  }, [])

  return navigate
}
