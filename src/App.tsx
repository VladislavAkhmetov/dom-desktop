import { useEffect, useRef, useState } from 'react'
import {
  AppWindow, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Pencil,
  Cloud, CloudRain, CloudSnow, CloudSun, ExternalLink, FileText, Folder, Globe2, Link2,
  Plus, Settings2, Sun, X
} from 'lucide-react'
import { bridge, isDesktop } from './bridge'
import { Home } from './Home'
import { Capture } from './Capture'
import { planTime } from './dayModel'
import { exampleDay, isDemo, resetExample, saveExample } from './demo'
import { formatDue, toLocalInput } from './reminders'
import type { AppState, CalendarEvent, CalendarSubscription, Reminder, Resource, ResourceKind, Space, SpaceTone } from './types'
import { parseICal, normalizeCalendarUrl } from './calendar/ical'
import { cachedUfaWeather, fetchUfaWeather, weatherDescription, type UfaWeather } from './weather'

type Modal = 'capture' | 'newSpace' | 'renameSpace' | 'newLink' | 'settings' | 'weather' | null
const tones: SpaceTone[] = ['sage', 'lilac', 'sand', 'blue']
const trafficResource: Resource = { id: 'traffic-ufa', name: 'Пробки в Уфе', kind: 'link', target: 'https://yandex.ru/maps/172/ufa/?ll=55.9721%2C54.7388&z=12&l=trf%2Ctrfe', createdAt: new Date().toISOString() }

function resourceIcon(kind: ResourceKind, size = 20) {
  if (kind === 'app') return <AppWindow size={size} strokeWidth={1.8} />
  if (kind === 'link') return <Globe2 size={size} strokeWidth={1.8} />
  return <FileText size={size} strokeWidth={1.8} />
}

function shortName(target: string, kind: ResourceKind) {
  if (kind === 'link') {
    try { return new URL(target).hostname.replace(/^www\./, '') } catch { return target }
  }
  return target.split(/[\\/]/).pop()?.replace(/\.(exe|lnk)$/i, '') || 'Ресурс'
}

function weatherIcon(code: number) {
  if (code === 0) return <Sun size={25} strokeWidth={1.6} />
  if ([1, 2].includes(code)) return <CloudSun size={25} strokeWidth={1.6} />
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return <CloudRain size={25} strokeWidth={1.6} />
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow size={25} strokeWidth={1.6} />
  return <Cloud size={25} strokeWidth={1.6} />
}

function productIcon(name: string) {
  if (/figma/i.test(name)) return <span className="figma-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>
  if (/illustrator/i.test(name)) return <span className="illustrator-mark" aria-hidden="true">Ai</span>
  return <AppWindow size={27} strokeWidth={1.5} />
}

function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [time, setTime] = useState(new Date())
  const [viewSpaceId, setViewSpaceId] = useState<string | null>(null)
  const [showSpaces, setShowSpaces] = useState(false)
  const [spacePage, setSpacePage] = useState(0)
  const [resourcePage, setResourcePage] = useState(0)
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState('')
  const [newSpaceName, setNewSpaceName] = useState('')
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkSpaceId, setLinkSpaceId] = useState('')
  const [captureDefaultWhen, setCaptureDefaultWhen] = useState('')
  const [autostart, setAutostart] = useState(false)
  const [weather, setWeather] = useState<UfaWeather | null>(cachedUfaWeather)
  const [newCalendarName, setNewCalendarName] = useState('')
  const [newCalendarUrl, setNewCalendarUrl] = useState('')
  const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())

  async function syncCalendars(targetState?: AppState) {
    const s = targetState || state
    if (!s) return
    const subs = s.calendarSubscriptions || []
    if (!subs.length) return
    setIsRefreshingCalendar(true)
    try {
      const allEvents: CalendarEvent[] = []
      for (const sub of subs) {
        try {
          const raw = bridge.fetchCalendar
            ? await bridge.fetchCalendar(sub.url)
            : await fetch(normalizeCalendarUrl(sub.url)).then(r => r.text())
          const parsed = parseICal(raw, new Date())
          allEvents.push(...parsed)
        } catch (e) {
          console.warn('Calendar sync error for', sub.name, e)
        }
      }
      const seen = new Set<string>()
      const unique = allEvents.filter(ev => {
        const key = `${ev.title}-${ev.startAt}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      commit(prev => ({ ...prev, events: unique }))
      setToast(`Календарь обновлён: событий ${unique.length}`)
    } catch {
      setToast('Не удалось обновить календарь.')
    } finally {
      setIsRefreshingCalendar(false)
    }
  }

  function addCalendar() {
    const url = newCalendarUrl.trim()
    const name = newCalendarName.trim() || 'Мой календарь'
    if (!url) { setToast('Укажите ссылку на календарь.'); return }
    const sub: CalendarSubscription = {
      id: crypto.randomUUID(),
      name,
      url: normalizeCalendarUrl(url),
      lastFetchedAt: new Date().toISOString()
    }
    const nextSubs = [...(state?.calendarSubscriptions || []), sub]
    commit(prev => ({ ...prev, calendarSubscriptions: nextSubs }))
    setNewCalendarName('')
    setNewCalendarUrl('')
    setToast(`Календарь «${name}» добавлен.`)
    if (state) syncCalendars({ ...state, calendarSubscriptions: nextSubs })
  }

  function removeCalendar(id: string) {
    commit(prev => ({
      ...prev,
      calendarSubscriptions: (prev.calendarSubscriptions || []).filter(s => s.id !== id)
    }))
    setToast('Календарь отключён.')
  }


  useEffect(() => {
    const initialState = isDemo ? Promise.resolve(exampleDay()) : bridge.getState()
    initialState.then(setState).catch(() => setToast('Не удалось загрузить локальные данные.'))
    bridge.getAutostart().then(setAutostart).catch(() => undefined)
    const timer = window.setInterval(() => setTime(new Date()), 30_000)
    const offFocus = bridge.onFocusCapture(openCapture)
    const offState = bridge.onStateChanged(value => { if (!isDemo) setState(value) })
    return () => { window.clearInterval(timer); offFocus(); offState() }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])


  useEffect(() => {
    let active = true
    const refresh = () => fetchUfaWeather().then(value => { if (active) setWeather(value) })
      .catch(() => undefined)
    refresh()
    const timer = window.setInterval(refresh, 15 * 60 * 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null)

      }
      if (event.ctrlKey && event.altKey && event.code === 'Space') {
        event.preventDefault()
        openCapture()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function commit(updater: (previous: AppState) => AppState) {
    setState(previous => {
      if (!previous) return previous
      const next = updater(previous)
      saveQueue.current = saveQueue.current.catch(() => undefined).then(() => isDemo ? saveExample(next) : bridge.saveState(next))
        .catch(() => setToast('Изменение не сохранилось. Попробуйте ещё раз.'))
      return next
    })
  }

  const currentSpace = state?.spaces.find(space => space.id === viewSpaceId) || null
  function openCapture() {
    setCaptureDefaultWhen('')
    setModal('capture')
  }

  function planCapture(offset: number) {
    setCaptureDefaultWhen(toLocalInput(planTime(offset).toISOString()))
    setModal('capture')
  }

  function saveCapture(title: string, dueAt: string | null) {
    const reminder: Reminder = { id: crypto.randomUUID(), title, createdAt: new Date().toISOString(), dueAt, done: false }
    commit(previous => ({ ...previous, reminders: [reminder, ...previous.reminders] }))
    setModal(null)
    setToast(dueAt ? `Напомним: ${formatDue(dueAt).toLowerCase()}.` : 'Сохранено. Можно вернуться позже.')
  }
  function createSpace() {
    const name = newSpaceName.trim()
    if (!name) { setToast('Дайте пространству имя.'); return }
    if (modal === 'renameSpace' && currentSpace) {
      commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === currentSpace.id ? { ...space, name } : space) }))
      setModal(null)
      return
    }
    const space: Space = { id: crypto.randomUUID(), name, tone: tones[(state?.spaces.length || 0) % tones.length], resources: [] }
    commit(previous => ({ ...previous, spaces: [...previous.spaces, space] }))
    setNewSpaceName('')
    setModal(null)
    setViewSpaceId(space.id)
    setShowSpaces(false)
    setResourcePage(0)
  }

  function openSpace(id: string) {
    setViewSpaceId(id)
    setShowSpaces(false)
    setResourcePage(0)
  }

  async function addPicked(kind: 'app' | 'file', spaceId?: string) {
    if (!state) return
    const targetSpace = spaceId || state.spaces[0]?.id
    if (!targetSpace) { setToast('Сначала создайте пространство.'); return }
    const target = await bridge.pickResource(kind)
    if (!target) {
      if (!isDesktop) setToast('Выбор приложений и файлов доступен в настольной версии.')
      return
    }
    const resource: Resource = {
      id: crypto.randomUUID(), name: shortName(target, kind), kind, target,
      createdAt: new Date().toISOString()
    }
    commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === targetSpace ? { ...space, resources: [...space.resources, resource] } : space) }))
    setToast(kind === 'app' ? 'Приложение добавлено.' : 'Документ добавлен. Откройте его здесь — и завтра мы сможем предложить продолжить.')
  }

  function startLink(spaceId?: string) {
    const targetSpace = spaceId || state?.spaces[0]?.id
    if (!targetSpace) { setToast('Сначала создайте пространство.'); return }
    setLinkSpaceId(targetSpace)
    setLinkName('')
    setLinkUrl('')
    setModal('newLink')
  }

  function addLink() {
    try {
      const url = new URL(linkUrl.trim())
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error()
      const resource: Resource = {
        id: crypto.randomUUID(), kind: 'link', name: linkName.trim() || url.hostname.replace(/^www\./, ''),
        target: url.toString(), createdAt: new Date().toISOString()
      }
      commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === linkSpaceId ? { ...space, resources: [...space.resources, resource] } : space) }))
      setModal(null)
      setToast('Ссылка добавлена.')
    } catch { setToast('Введите адрес сайта, начинающийся с https:// или http://.') }
  }

  async function openResource(resource: Resource) {
    const result = await bridge.openResource(resource)
    if (!result.ok) { setToast(result.error || 'Не удалось открыть ресурс.'); return }
    commit(previous => ({
      ...previous,
      spaces: previous.spaces.map(space => ({ ...space, resources: space.resources.map(item => item.id === resource.id ? { ...item, lastOpenedAt: new Date().toISOString(), completedAt: undefined } : item) }))
    }))
  }

  async function openTraffic() {
    const result = await bridge.openResource(trafficResource)
    if (!result.ok) setToast(result.error || 'Не удалось открыть карту пробок.')
  }

  function removeResource(id: string) {
    commit(previous => ({ ...previous, spaces: previous.spaces.map(space => ({ ...space, resources: space.resources.filter(resource => resource.id !== id) })) }))
    setToast('Убрано из пространства. Файл на компьютере не удалён.')
  }

  async function changeAutostart(value: boolean) {
    if (isDemo) return
    try { setAutostart(await bridge.setAutostart(value)) }
    catch { setToast('Не удалось изменить автозапуск.') }
  }

  if (!state) return <div className="loading-screen"><span className="brand-mark">✳</span><span>Собираем ваш день…</span></div>

  const visibleResourcePage = Math.min(resourcePage, Math.max(0, Math.ceil((currentSpace?.resources.length || 0) / 6) - 1))

  return (
    <div className="app-shell">
      <div className="page-wrap">
        <header className="topbar calm-topbar">
          <div className="topbar-left">
            <button className="brand" onClick={() => { setViewSpaceId(null); setShowSpaces(false) }} aria-label="На главную"><span className="brand-mark">✳</span><span>дом<span className="brand-dot">.</span></span></button>
            <button className="calm-weather" onClick={() => setModal('weather')} aria-label="Погода и дороги в Уфе"><span>Уфа</span>{weather ? weatherIcon(weather.code) : <Cloud size={20} />}<span>{weather ? `${Math.round(weather.temperature)}°` : '—°'}</span></button>
          </div>
          <div className="calm-clock">{isDemo ? <a className="calm-demo" href="/" title="Вернуться к своим данным">Пример дня <X size={13} /></a> : <><span>{time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>{!isDesktop && <a className="calm-demo-link" href="/?demo=1">Пример дня</a>}</>}</div>
          <div className="topbar-right"><nav className="top-nav" aria-label="Главное меню"><button className={!currentSpace && !showSpaces ? 'nav-active' : ''} onClick={() => { setViewSpaceId(null); setShowSpaces(false) }}>Сегодня</button><button className={currentSpace || showSpaces ? 'nav-active' : ''} onClick={() => { setViewSpaceId(null); setShowSpaces(true) }}>Пространства</button></nav><button className="round-button settings-button" onClick={() => setModal('settings')} aria-label="Настройки"><Settings2 size={19} /></button></div>
        </header>

        {!currentSpace && !showSpaces ? (
          <Home state={state} now={time} onChange={commit} onCapture={openCapture} onPlan={planCapture} onSpace={openSpace} onOpen={openResource} onAddLink={() => startLink()} onAddFile={() => addPicked('file')} onOpenSettings={() => setModal('settings')} appIcon={productIcon} />
        ) : showSpaces && !currentSpace ? (
          <main className="collection-stage" aria-label="Пространства">
            <div className="collection-header"><div><h1>Пространства</h1></div><button className="primary-button" onClick={() => setModal('newSpace')}><Plus size={18} /> Создать</button></div>
            <div className="space-overview-grid">{state.spaces.slice(spacePage * 8, spacePage * 8 + 8).map(space => <button className={`overview-space card tone-${space.tone}`} key={space.id} onClick={() => openSpace(space.id)}><Folder size={28} strokeWidth={1.3} /><span><strong>{space.name}</strong></span><ArrowUpRight className="overview-arrow" size={19} /></button>)}</div>
            {state.spaces.length > 8 && <div className="page-controls"><span>{state.spaces.length} всего</span><div><button onClick={() => setSpacePage(page => Math.max(0, page - 1))} disabled={spacePage === 0} aria-label="Предыдущая страница"><ChevronLeft size={20} /></button><span>{spacePage + 1} / {Math.ceil(state.spaces.length / 8)}</span><button onClick={() => setSpacePage(page => Math.min(Math.ceil(state.spaces.length / 8) - 1, page + 1))} disabled={spacePage >= Math.ceil(state.spaces.length / 8) - 1} aria-label="Следующая страница"><ChevronRight size={20} /></button></div></div>}
          </main>
        ) : currentSpace && (
          <main className="collection-stage" aria-label={currentSpace.name}>
            <div className="collection-header"><div><button className="back-button" onClick={() => { setViewSpaceId(null); setShowSpaces(true) }}><ChevronLeft size={18} /> Пространства</button><div className="space-title-row"><h1>{currentSpace.name}</h1><button className="calm-icon" aria-label="Переименовать пространство" onClick={() => { setNewSpaceName(currentSpace.name); setModal('renameSpace') }}><Pencil size={17} /></button></div></div><div className="space-add-actions"><button onClick={() => addPicked('file', currentSpace.id)}><FileText size={18} /> Документ</button><button onClick={() => addPicked('app', currentSpace.id)}><AppWindow size={18} /> Приложение</button><button onClick={() => startLink(currentSpace.id)}><Link2 size={18} /> Сайт</button></div></div>
            {currentSpace.resources.length ? <div className="resource-grid">{currentSpace.resources.slice(visibleResourcePage * 6, visibleResourcePage * 6 + 6).map(resource => <div className="resource-card card" key={resource.id}><button className="resource-open" onClick={() => openResource(resource)}><span className={`resource-kind kind-${resource.kind}`}>{resourceIcon(resource.kind, 25)}</span><span className="resource-name">{resource.name}</span><span className="resource-open-label">Открыть <ExternalLink size={15} /></span></button><button className="resource-remove" onClick={() => removeResource(resource.id)} aria-label={`Убрать ${resource.name}`} title="Убрать из пространства"><X size={16} /></button></div>)}</div> : <div className="empty-space card"><span className="empty-space-icon"><Plus size={32} strokeWidth={1.3} /></span><h2>Здесь пока пусто.</h2><p>Добавьте документ, приложение или сайт.</p></div>}
            {currentSpace.resources.length > 6 && <div className="page-controls"><span>{currentSpace.resources.length} ресурсов</span><div><button onClick={() => setResourcePage(page => Math.max(0, page - 1))} disabled={visibleResourcePage === 0} aria-label="Предыдущая страница"><ChevronLeft size={20} /></button><span>{visibleResourcePage + 1} / {Math.ceil(currentSpace.resources.length / 6)}</span><button onClick={() => setResourcePage(page => Math.min(Math.ceil(currentSpace.resources.length / 6) - 1, page + 1))} disabled={visibleResourcePage >= Math.ceil(currentSpace.resources.length / 6) - 1} aria-label="Следующая страница"><ChevronRight size={20} /></button></div></div>}
          </main>
        )}
      </div>

      {modal === 'capture' && <Capture initialWhen={captureDefaultWhen} onClose={() => setModal(null)} onSave={saveCapture} onVoiceHint={() => setToast('Для диктовки нажмите Win + H.')} />}
      {modal && modal !== 'capture' && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null) }}><div className="modal" role="dialog" aria-modal="true" aria-label="Действие"><button className="modal-close" onClick={() => setModal(null)} aria-label="Закрыть"><X size={19} /></button>
        {(modal === 'newSpace' || modal === 'renameSpace') && <><span className="modal-kicker"><Folder size={16} /> Пространство</span><h2>{modal === 'renameSpace' ? 'Новое название' : 'Для чего оставим место?'}</h2><input className="large-input" autoFocus maxLength={70} value={newSpaceName} onChange={event => setNewSpaceName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') createSpace() }} aria-label="Название пространства" />{modal === 'newSpace' && <div className="capture-options">{['Работа', 'Личное', 'Учёба', 'Поездка'].map(name => <button key={name} onClick={() => setNewSpaceName(name)}>{name}</button>)}</div>}<div className="modal-bottom end"><button className="primary-button" disabled={!newSpaceName.trim()} onClick={createSpace}>{modal === 'renameSpace' ? 'Сохранить' : 'Создать'} <ArrowRight size={17} /></button></div></>}
        {modal === 'newLink' && <><span className="modal-kicker"><Globe2 size={16} /> СОХРАНИТЬ САЙТ</span><h2>Новая ссылка</h2><div className="form-stack"><label>Название<input value={linkName} onChange={event => setLinkName(event.target.value)} /></label><label>Адрес<input value={linkUrl} onChange={event => setLinkUrl(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addLink() }} /></label></div><div className="modal-bottom end"><button className="primary-button" onClick={addLink}>Добавить <ArrowRight size={17} /></button></div></>}
        {modal === 'settings' && <><span className="modal-kicker"><Settings2 size={16} /> НАСТРОЙКИ</span><h2>Настройки</h2>{isDemo && <div className="setting-row"><span>Пример хранится отдельно от ваших записей.</span><button className="soft-button" onClick={() => { setState(resetExample()); setModal(null) }}>Начать заново</button></div>}<div className="setting-row"><span><strong>Открывать после входа в Windows</strong></span><button className={`toggle ${autostart ? 'on' : ''}`} onClick={() => changeAutostart(!autostart)} disabled={isDemo} role="switch" aria-checked={autostart} aria-label="Автозапуск"><span /></button></div><div className="setting-row"><span><strong>Быстрый ввод</strong><small>Ctrl + Alt + Space</small></span></div>
        <div className="setting-row" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
          <span><strong>Календари (iCal / Webcal)</strong><small>События на сегодня и ссылки на звонки</small></span>
          {Boolean(state?.calendarSubscriptions?.length) && <button className="soft-button" disabled={isRefreshingCalendar} onClick={() => syncCalendars()}>{isRefreshingCalendar ? 'Обновляем…' : 'Обновить'}</button>}
        </div>
        {state?.calendarSubscriptions?.map(sub => (
          <div key={sub.id} className="setting-sub-row">
            <div>
              <strong>{sub.name}</strong>
              <small title={sub.url}>{sub.url}</small>
            </div>
            <button className="calm-icon-mini" onClick={() => removeCalendar(sub.id)} aria-label="Удалить календарь"><X size={15} /></button>
          </div>
        ))}
        <div className="form-stack" style={{ marginTop: 8 }}>
          <label>Имя календаря<input placeholder="Например: Рабочий Google, Яндекс" value={newCalendarName} onChange={e => setNewCalendarName(e.target.value)} /></label>
          <label>Ссылка на iCal (.ics или webcal://)<input placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" value={newCalendarUrl} onChange={e => setNewCalendarUrl(e.target.value)} /></label>
          <button className="soft-button" style={{ alignSelf: 'flex-start' }} disabled={!newCalendarUrl.trim()} onClick={addCalendar}><Plus size={15} /> Подключить</button>
        </div>
        <div className="privacy-note" style={{ marginTop: 12 }}>В Google или Яндекс Календаре откройте настройки нужного календаря и скопируйте «Секретный адрес в формате iCal». События синхронизируются локально.</div>
        <div className="privacy-note" style={{ marginTop: 8 }}>Данные хранятся на этом компьютере. Диктовка: Win + H.</div></>}
        {modal === 'weather' && <><span className="modal-kicker">Уфа</span><h2>{weather ? `${Math.round(weather.temperature)}° · ${weatherDescription(weather.code)}` : 'Погода недоступна'}</h2><p className="modal-intro">{weather ? `Open-Meteo · ${weather.observedAt.replace('T', ' ')}` : 'Попробуем обновить данные позже.'}</p><button className="soft-button" onClick={openTraffic}>Пробки на карте <ArrowUpRight size={17} /></button></>}
      </div></div>}
      {toast && <div className="toast" role="status"><span>{toast}</span><button onClick={() => setToast('')} aria-label="Закрыть"><X size={15} /></button></div>}
    </div>
  )
}

export default App



