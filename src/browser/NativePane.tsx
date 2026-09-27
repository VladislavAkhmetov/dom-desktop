import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, FileText, Globe2, Plus, RotateCw, X } from 'lucide-react'
import { bridge } from '../bridge'
import type { BrowserPaneProps } from './BrowserPane'
import { recentMaterials, resourceAppLabel } from '../resourcePresentation'

export function NativePane({ tab, space, isSplit, onCloseSplit, onOpenExternal, onOpenResource, onAddLink, onSelectQuickUrl }: BrowserPaneProps) {
  const viewport = useRef<HTMLDivElement>(null)
  const [cover, setCover] = useState('')
  useEffect(() => {
    if (!tab || !bridge.browser || !/^https?:\/\//i.test(tab.url) || tab.error) { if (tab?.error) bridge.browser?.hide(tab.id); return }
    const element = viewport.current!
    const show = () => { const bounds = element.getBoundingClientRect(); bridge.browser!.show({ tab, spaceId: space.id, bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } }).catch(() => undefined) }
    show()
    const observer = new ResizeObserver(show)
    observer.observe(element)
    window.addEventListener('resize', show)
    const off = bridge.browser.onEvent(event => { if (event.type === 'cover' && event.tabId === tab.id) setCover(event.image) })
    return () => { observer.disconnect(); window.removeEventListener('resize', show); off(); bridge.browser?.hide(tab.id) }
  }, [tab?.id, tab?.url, tab?.error, space.id])
  return <section className="native-pane" aria-label={isSplit ? 'Страница рядом' : 'Текущая страница'}>
    {isSplit && <div className="split-label"><span>{tab?.title || 'Страница рядом'}</span><button onClick={onCloseSplit} aria-label="Закрыть просмотр рядом"><X size={16} /></button></div>}
    <div className="native-viewport" ref={viewport}>
      {tab?.error ? <div className="browser-handoff"><h2>Не удалось открыть страницу</h2><p>{tab.error}</p><button className="resume-primary" onClick={() => bridge.browser?.action(tab.id, 'reload')}><RotateCw size={16} /> Попробовать снова</button></div>
      : tab?.url ? bridge.browser ? <>{cover && <img className="native-cover" src={cover} alt="" />}<span className="native-status">{tab.title}</span></> : <div className="browser-handoff"><Globe2 size={28} /><h2>{tab.title}</h2><p>Просмотр сайтов внутри Дома доступен в настольной версии.<br />В этом прототипе ссылка откроется в соседней вкладке.</p><button className="resume-primary" onClick={() => onOpenExternal(tab)}>Открыть сайт <ArrowUpRight size={17} /></button></div>
      : <div className="browser-start-screen"><div className="browser-start-card"><span className="browser-start-eyebrow">Материалы пространства</span><h2>{space.name}</h2><p>Введите адрес сверху или продолжите с сохранённого материала.</p><div className="browser-materials">{recentMaterials(space.resources).filter(item => !item.completedAt).slice(0, 6).map(item => <button className="browser-material" key={item.id} onClick={() => item.kind === 'link' ? onSelectQuickUrl?.(item.target, item.name) : onOpenResource(item)}>{item.kind === 'link' ? <Globe2 size={19} /> : <FileText size={19} />}<span><strong>{item.name}</strong><small>{resourceAppLabel(item)}</small></span><ArrowUpRight size={15} /></button>)}</div><button className="browser-add-material" onClick={onAddLink}><Plus size={17} /> Сохранить ссылку</button></div></div>}
    </div>
  </section>
}
