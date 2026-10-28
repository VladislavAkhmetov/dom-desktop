import { useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Globe2, RotateCw, X } from 'lucide-react'
import { bridge } from '../bridge'
import type { BrowserPaneProps } from './BrowserPane'
import { NewPage } from './NewPage'
import { isCabinetPreview } from '../cabinetMode'

export function NativePane({ tab, space, spaces, history, favorites, isSplit, isPaired, coverImage, onCloseSplit, onOpenExternal, onOpenResource, onAddLink, onNavigate }: BrowserPaneProps) {
  const viewport = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [cover, setCover] = useState(coverImage || '')
  useLayoutEffect(() => {
    if (coverImage && !cover) setCover(coverImage)
  }, [coverImage])
  const prototypeUrl = tab?.url && !bridge.browser && (() => { try { const url = new URL(tab.url); return url.origin === window.location.origin && (url.pathname === '/prototype/weekend.html' || isCabinetPreview && url.pathname === '/assets/moodboard/index.html') ? url.href : null } catch { return null } })()
  useLayoutEffect(() => {
    if (!tab || !bridge.browser || !/^https?:\/\//i.test(tab.url) || tab.error) { if (tab?.error) bridge.browser?.hide(tab.id); return }
    const element = viewport.current!
    const show = () => { const bounds = element.getBoundingClientRect(); bridge.browser!.show({ tab, spaceId: space.id, bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } }).catch(() => undefined) }
    show()
    const observer = new ResizeObserver(show)
    observer.observe(element)
    window.addEventListener('resize', show)
    const off = bridge.browser.onEvent(event => { if (event.type === 'cover' && event.tabId === tab.id) setCover(event.image) })
    return () => { observer.disconnect(); window.removeEventListener('resize', show); off(); bridge.browser?.hide(tab.id) }
  }, [tab?.id, tab?.url, tab?.error, space.id, isSplit, isPaired])
  return <section className="native-pane" aria-label={isSplit ? 'Страница рядом' : 'Текущая страница'}>
    {(isPaired || isSplit) && <div className="split-label"><span>{tab?.title || 'Страница рядом'}</span>{isSplit && <button onClick={onCloseSplit} aria-label="Закрыть просмотр рядом"><X size={18} /></button>}</div>}
    <div className="native-viewport" ref={viewport} data-workspace-tab-id={tab?.id}>
      {tab?.error ? <div className="browser-handoff"><h2>Не удалось открыть страницу</h2><p>{tab.error}</p><button className="resume-primary" onClick={() => bridge.browser?.action(tab.id, 'reload')}><RotateCw size={16} /> Попробовать снова</button></div>
      : tab?.url ? bridge.browser ? <>{cover && <motion.img layoutId={reduced ? undefined : `tab-cover-${space.id}-${tab.id}`} className="native-cover" src={cover} alt="" />}</> : prototypeUrl ? <iframe className="prototype-page" title={tab.title || 'Страница пространства'} src={prototypeUrl} sandbox="allow-same-origin" /> : <div className="browser-handoff"><Globe2 size={32} /><h2>{tab.title}</h2><button className="resume-primary" onClick={() => onOpenExternal(tab)}>Открыть в браузере <ArrowUpRight size={20} /></button></div>
      : <NewPage space={space} spaces={spaces} history={history} favorites={favorites} autoFocus={!isSplit} onOpen={(address, title) => onNavigate?.(address, title)} onOpenResource={onOpenResource} onAddLink={onAddLink} />}
    </div>
  </section>
}
