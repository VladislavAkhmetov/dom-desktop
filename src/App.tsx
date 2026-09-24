import { useEffect, useRef, useState } from 'react'
import {
  AppWindow, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Pencil,
  Cloud, CloudRain, CloudSnow, CloudSun, Columns2, ExternalLink, FileText, Folder, Globe2, Link2,
  Plus, Settings2, Sun, X
} from 'lucide-react'
import { bridge, isDesktop } from './bridge'
import { Home } from './Home'
import { Capture } from './Capture'
import { planTime } from './dayModel'
import { exampleDay, isDemo, resetExample, saveExample } from './demo'
import { formatDue, toLocalInput } from './reminders'
import type { AppState, BrowserSession, BrowserTab, CalendarEvent, CalendarSubscription, Reminder, ResearchSource, Resource, ResourceKind, Space, SpaceTone } from './types'
import { parseICal, normalizeCalendarUrl } from './calendar/ical'
import { cachedUfaWeather, fetchUfaWeather, weatherDescription, type UfaWeather } from './weather'
import { Workstage } from './browser/Workstage'
import { BottomDock } from './BottomDock'
import { zenTimer } from './focus/zenTimer'

const emptySession = (): BrowserSession => ({ tabs: [], activeTabId: '', splitTabId: null })

function addressToUrl(input: string): string {
  const value = input.trim()
  if (/^https?:\/\//i.test(value)) return new URL(value).toString()
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(value)) return new URL(`http://${value}`).toString()
  if (/^[^\s]+\.[^\s]+$/.test(value)) return new URL(`https://${value}`).toString()
  return `https://yandex.ru/search/?text=${encodeURIComponent(value)}`
}

type Modal = 'capture' | 'newSpace' | 'newStream' | 'renameSpace' | 'newLink' | 'settings' | 'weather' | null
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
  const [workstageSpaceId, setWorkstageSpaceId] = useState<string | null>(null)
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
  const [isWorkstageOpen, setIsWorkstageOpen] = useState(true)
  const [omniboxUrl, setOmniboxUrl] = useState('')
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const targetWorkstageSpace = state?.spaces.find(space => space.id === (workstageSpaceId || state.activeSpaceId)) || state?.spaces[0]
  const session = targetWorkstageSpace?.activeSession || emptySession()
  const tabs = session.tabs
  const activeTabId = tabs.some(tab => tab.id === session.activeTabId) ? session.activeTabId : tabs[0]?.id || ''
  const splitTabId = tabs.some(tab => tab.id === session.splitTabId) ? session.splitTabId || null : null

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
    zenTimer.setOnComplete(() => setToast('Сессия фокуса завершена.'))
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!state) return
    saveQueue.current = saveQueue.current.catch(() => undefined)
      .then(() => isDemo ? saveExample(state) : bridge.saveState(state))
      .catch(() => setToast('Изменение не сохранилось. Попробуйте ещё раз.'))
  }, [state])

  useEffect(() => {
    if (!state) return
    const targetSpace = state.spaces.find(space => space.id === (workstageSpaceId || state.activeSpaceId)) || state.spaces[0]
    if (targetSpace && (!targetSpace.activeSession || targetSpace.activeSession.tabs.length === 0)) {
      const initialTab: BrowserTab = {
        id: crypto.randomUUID(),
        title: 'Новая вкладка',
        url: '',
        favicon: 'web'
      }
      commit(previous => ({
        ...previous,
        spaces: previous.spaces.map(s => s.id === targetSpace.id ? {
          ...s,
          activeSession: { tabs: [initialTab], activeTabId: initialTab.id, splitTabId: null }
        } : s)
      }))
    }
  }, [state === null, workstageSpaceId])


  useEffect(() => {
    let active = true
    const refresh = () => fetchUfaWeather().then(value => { if (active) setWeather(value) })
      .catch(() => undefined)
    refresh()
    const timer = window.setInterval(refresh, 15 * 60 * 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (isWorkstageOpen) {
      const activeTab = tabs.find(t => t.id === activeTabId)
      setOmniboxUrl(activeTab?.url || '')
    } else {
      setOmniboxUrl('')
    }
  }, [isWorkstageOpen, activeTabId, workstageSpaceId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null)
      }
      if (event.ctrlKey && event.altKey && event.code === 'Space') {
        event.preventDefault()
        openCapture()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        const input = document.querySelector<HTMLInputElement>('.omnibox-input')
        input?.focus()
        input?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function commit(updater: (previous: AppState) => AppState) {
    setState(previous => previous ? updater(previous) : previous)
  }

  function updateSession(updater: (previous: BrowserSession) => BrowserSession) {
    const spaceId = targetWorkstageSpace?.id
    if (!spaceId) return
    commit(previous => ({
      ...previous,
      spaces: previous.spaces.map(space => space.id === spaceId
        ? { ...space, activeSession: { ...updater(space.activeSession || emptySession()), savedAt: new Date().toISOString() }, lastActiveAt: new Date().toISOString() }
        : space)
    }))
  }

  function openWorkstage(spaceId?: string, artifactId?: string) {
    const selected = state?.spaces.find(space => space.id === spaceId) || targetWorkstageSpace
    if (!selected) { setToast('Сначала создайте пространство.'); return }
    const artifact = selected.researchArtifacts?.find(item => item.id === artifactId)
    const researchTab: BrowserTab | undefined = artifact ? { id: crypto.randomUUID(), title: artifact.query, url: `research://${artifact.id}` } : undefined
    commit(previous => ({ ...previous, activeSpaceId: selected.id, spaces: researchTab ? previous.spaces.map(space => {
      if (space.id !== selected.id) return space
      const previousSession = space.activeSession || emptySession()
      const existing = previousSession.tabs.find(tab => tab.url === researchTab.url)
      return { ...space, activeSession: { ...previousSession, tabs: existing ? previousSession.tabs : [...previousSession.tabs, researchTab], activeTabId: existing?.id || researchTab.id } }
    }) : previous.spaces }))
    setWorkstageSpaceId(selected.id)
    setViewSpaceId(null)
    setShowSpaces(false)
    setIsWorkstageOpen(true)
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
    const isStream = modal === 'newStream'
    const space: Space = { id: crypto.randomUUID(), name, tone: tones[(state?.spaces.length || 0) % tones.length], kind: isStream ? 'stream' : 'base', resources: [], ...(isStream ? { activeSession: emptySession() } : {}) }
    commit(previous => ({ ...previous, activeSpaceId: space.id, spaces: [...previous.spaces, space] }))
    setNewSpaceName('')
    setModal(null)
    if (isStream) {
      setWorkstageSpaceId(space.id)
      setViewSpaceId(null)
      setIsWorkstageOpen(true)
      setShowSpaces(false)
    } else {
      setViewSpaceId(space.id)
      setWorkstageSpaceId(space.id)
      setIsWorkstageOpen(false)
      setShowSpaces(false)
    }
    setResourcePage(0)
  }

  function openSpace(id: string) {
    commit(previous => ({ ...previous, activeSpaceId: id }))
    setViewSpaceId(id)
    setWorkstageSpaceId(id)
    setShowSpaces(false)
    setIsWorkstageOpen(false)
    setResourcePage(0)
  }

  function createStream() {
    setNewSpaceName('')
    setModal('newStream')
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

  function handleOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const val = omniboxUrl.trim()
      if (!val) return
      let fullUrl: string
      try { fullUrl = addressToUrl(val) }
      catch { setToast('Не удалось распознать адрес.'); return }
      const newTab: BrowserTab = {
        id: crypto.randomUUID(),
        title: fullUrl.startsWith('https://yandex.ru/search/') ? `Поиск: ${val}` : new URL(fullUrl).hostname,
        url: fullUrl,
        favicon: 'web'
      }
      if (isWorkstageOpen && activeTabId) {
        updateSession(previous => ({ ...previous, tabs: previous.tabs.map(tab => tab.id === activeTabId ? { ...tab, title: newTab.title, url: fullUrl } : tab) }))
      } else {
        updateSession(previous => ({ ...previous, tabs: [...previous.tabs, newTab], activeTabId: newTab.id }))
      }
      setOmniboxUrl(fullUrl)
      openWorkstage()
      e.currentTarget.blur()
    }
  }

  function handleToggleSplit() {
    if (splitTabId) {
      updateSession(previous => ({ ...previous, splitTabId: null }))
    } else {
      const candidate = tabs.find(t => t.id !== activeTabId)
      if (candidate) {
        updateSession(previous => ({ ...previous, splitTabId: candidate.id }))
      }
    }
  }

  function returnHome() {
    setIsWorkstageOpen(false)
  }

  function handleCloseTab(tabId: string) {
    updateSession(previous => {
      const nextTabs = previous.tabs.filter(tab => tab.id !== tabId)
      const nextActiveId = previous.activeTabId === tabId ? nextTabs[0]?.id || '' : previous.activeTabId
      const nextSplitId = previous.splitTabId === tabId || previous.splitTabId === nextActiveId ? null : previous.splitTabId
      return {
        ...previous,
        tabs: nextTabs,
        activeTabId: nextActiveId,
        splitTabId: nextSplitId
      }
    })
  }

  function handleAddTab() {
    const newTab: BrowserTab = {
      id: crypto.randomUUID(),
      title: 'Новая вкладка',
      url: '',
      favicon: 'web'
    }
    updateSession(previous => ({ ...previous, tabs: [...previous.tabs, newTab], activeTabId: newTab.id }))
    openWorkstage()
    window.setTimeout(() => document.querySelector<HTMLInputElement>('.omnibox-input')?.focus(), 0)
  }

  function handleUpdateTab(tabId: string, updates: Partial<BrowserTab>) {
    updateSession(previous => ({
      ...previous,
      tabs: previous.tabs.map(tab => tab.id === tabId ? { ...tab, ...updates } : tab)
    }))
    if (tabId === activeTabId && updates.url) {
      setOmniboxUrl(updates.url)
    }
  }

  function handleOpenSourceInSplit(source: ResearchSource) {
    let targetTab = tabs.find(t => t.url === source.url)
    if (!targetTab) {
      targetTab = {
        id: `tab-src-${Date.now()}`,
        title: source.title,
        url: source.url,
        favicon: 'web'
      }
      updateSession(previous => ({ ...previous, tabs: [...previous.tabs, targetTab!] }))
    }
    updateSession(previous => ({ ...previous, splitTabId: targetTab.id }))
  }

  function saveTabToSpace(tab: BrowserTab) {
    const spaceId = targetWorkstageSpace?.id
    if (!spaceId || !tab.url) return
    const resource: Resource = { id: crypto.randomUUID(), kind: 'link', name: tab.title, target: tab.url, createdAt: new Date().toISOString() }
    commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === spaceId && !space.resources.some(item => item.kind === 'link' && item.target === tab.url)
      ? { ...space, resources: [...space.resources, resource] }
      : space) }))
    setToast('Ссылка добавлена в материалы пространства.')
  }

  async function openBrowserTab(tab: BrowserTab) {
    if (!tab.url) return
    const savedResource = targetWorkstageSpace?.resources.find(resource => resource.kind === 'link' && resource.target === tab.url)
    const resource: Resource = savedResource || { id: tab.id, kind: 'link', name: tab.title, target: tab.url, createdAt: new Date().toISOString() }
    const result = await bridge.openResource(resource)
    if (!result.ok) { setToast(result.error || 'Не удалось открыть сайт.'); return }
    const openedAt = new Date().toISOString()
    const spaceId = targetWorkstageSpace?.id
    if (!spaceId) return
    commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === spaceId ? {
      ...space,
      lastActiveAt: openedAt,
      activeSession: {
        ...(space.activeSession || emptySession()),
        tabs: (space.activeSession?.tabs || []).map(item => item.id === tab.id ? { ...item, lastAccessedAt: openedAt } : item)
      },
      resources: space.resources.map(item => item.id === resource.id ? { ...item, lastOpenedAt: openedAt } : item)
    } : space) }))
  }

  if (!state) return <div className="loading-screen"><span className="brand-mark">✳</span><span>Собираем ваш день…</span></div>

  const visibleResourcePage = Math.min(resourcePage, Math.max(0, Math.ceil((currentSpace?.resources.length || 0) / 6) - 1))
  const sortedResources = [...(currentSpace?.resources || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const activeTopSpaceId = currentSpace?.id || targetWorkstageSpace?.id
  const availableTopSpaces = state.spaces.filter(space => !space.archivedAt)
  const visibleTopSpaces = availableTopSpaces.slice(0, 3)
  if (activeTopSpaceId && !visibleTopSpaces.some(space => space.id === activeTopSpaceId)) {
    const activeSpace = availableTopSpaces.find(space => space.id === activeTopSpaceId)
    if (activeSpace) visibleTopSpaces.splice(2, 1, activeSpace)
  }
  return (
    <div className="app-shell">
      <div className="page-wrap">
        <header className="topbar calm-topbar unified-topbar">
          <div className="topbar-left">
            <button
              className="brand"
              onClick={() => {
                setViewSpaceId(null)
                setShowSpaces(false)
                setIsWorkstageOpen(previous => !previous)
              }}
              aria-label="Переключить Дом и Браузер"
              title={isWorkstageOpen ? 'Открыть главную Дом' : 'Вернуться в браузер'}
            >
              <span className="brand-mark">✳</span>
              <span>дом<span className="brand-dot">.</span></span>
            </button>

            <button className="calm-weather" onClick={() => setModal('weather')} aria-label="Погода и дороги в Уфе">
              <span>Уфа</span>
              {weather ? weatherIcon(weather.code) : <Cloud size={20} />}
              <span>{weather ? `${Math.round(weather.temperature)}°` : '—°'}</span>
            </button>

            <div className="topbar-spaces">
              {visibleTopSpaces.map(s => (
                <button
                  key={s.id}
                  className={`space-nav-pill ${(isWorkstageOpen && s.id === targetWorkstageSpace?.id) || currentSpace?.id === s.id ? 'active' : ''}`}
                  onClick={() => openWorkstage(s.id)}
                  title={`Открыть ${s.name}`}
                >
                  {s.name}
                </button>
              ))}
              <button className="space-nav-pill" onClick={() => { setShowSpaces(true); setViewSpaceId(null); setIsWorkstageOpen(false) }}>Все</button>
              <button className="space-nav-pill add-stream" onClick={createStream} title="Создать быстрый поток">
                <Plus size={15} /> Поток
              </button>
            </div>
          </div>

          <div className="topbar-center">
            <div className="calm-omnibox">
              <Globe2 size={16} className="omnibox-icon" />
              <input
                type="text"
                className="omnibox-input"
                value={omniboxUrl}
                onChange={e => setOmniboxUrl(e.target.value)}
                onKeyDown={handleOmniboxKeyDown}
                placeholder="Поиск или адрес сайта · Ctrl L"
                aria-label="Поиск или адрес сайта"
              />
            </div>
          </div>

          <div className="topbar-right">
            {!isWorkstageOpen ? (
              <>
                <button className="calm-pill-btn" onClick={() => openWorkstage()} title="Открыть текущий поток">
                  <Globe2 size={15} />
                  <span>Вкладки ({tabs.length})</span>
                </button>
                <div className="calm-clock">
                  {isDemo ? (
                    <a className="calm-demo" href="/" title="Вернуться к своим данным">Пример дня <X size={13} /></a>
                  ) : (
                    <>
                      <span>{time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                      {!isDesktop && <a className="calm-demo-link" href="/?demo=1">Пример дня</a>}
                    </>
                  )}
                </div>
                <button className="round-button settings-button" onClick={() => setModal('settings')} aria-label="Настройки">
                  <Settings2 size={19} />
                </button>
              </>
            ) : (
              <>
                <button className="calm-pill-btn" onClick={() => targetWorkstageSpace && openSpace(targetWorkstageSpace.id)} title="Материалы текущего пространства">
                  <Folder size={16} /><span>Материалы</span>
                </button>
                <button className={`calm-pill-btn ${splitTabId ? 'active' : ''}`} onClick={handleToggleSplit} disabled={tabs.length < 2} title="Открыть вторую вкладку рядом">
                  <Columns2 size={16} /><span>Рядом</span>
                </button>

                <button
                  className="calm-pill-btn leave-tomorrow-pill"
                  onClick={returnHome}
                  title="Вернуться в Дом. Вкладки сохраняются автоматически"
                >
                  <span>В Дом</span>
                </button>

                <button className="round-button settings-button" onClick={() => setModal('settings')} aria-label="Настройки">
                  <Settings2 size={19} />
                </button>
              </>
            )}
          </div>
        </header>

        {!showSpaces && !currentSpace ? (
          !isWorkstageOpen ? (
            <Home
              state={state}
              now={time}
              onChange={commit}
              onCapture={openCapture}
              onPlan={planCapture}
              onSpace={openSpace}
              onOpen={openResource}
              onAddLink={() => startLink()}
              onOpenWorkstage={openWorkstage}
            />
          ) : (
            <Workstage
              space={targetWorkstageSpace!}
              tabs={tabs}
              activeTabId={activeTabId}
              splitTabId={splitTabId}
              onSelectTab={tabId => updateSession(previous => tabId === previous.splitTabId
                ? { ...previous, activeTabId: tabId, splitTabId: previous.activeTabId }
                : { ...previous, activeTabId: tabId })}
              onCloseTab={handleCloseTab}
              onAddTab={handleAddTab}
              onCloseSplit={() => updateSession(previous => ({ ...previous, splitTabId: null }))}
              onOpenSourceInSplit={handleOpenSourceInSplit}
              onGoHome={() => setIsWorkstageOpen(false)}
              onOpenTab={openBrowserTab}
              onSaveTab={saveTabToSpace}
              onUpdateTab={handleUpdateTab}
            />
          )
        ) : showSpaces && !currentSpace ? (
          <main className="collection-stage" aria-label="Пространства">
            <div className="collection-header">
              <div><h1>Пространства и потоки</h1></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="primary-button" style={{ background: '#1a68ff' }} onClick={createStream}><Plus size={18} /> Новый поток</button>
                <button className="primary-button" onClick={() => { setNewSpaceName(''); setModal('newSpace') }}><Folder size={18} /> Пространство</button>
              </div>
            </div>
            <div className="space-overview-grid">
              {state.spaces.slice(spacePage * 8, spacePage * 8 + 8).map(space => (
                <button className={`overview-space card tone-${space.tone}`} key={space.id} onClick={() => {
                  if (space.kind === 'stream' || space.activeSession) {
                    openWorkstage(space.id)
                  } else {
                    openSpace(space.id)
                  }
                }}>
                  {space.kind === 'stream' ? <Globe2 size={28} strokeWidth={1.3} color="#1a68ff" /> : <Folder size={28} strokeWidth={1.3} />}
                  <span>
                    <strong>{space.name}</strong>
                    {space.kind === 'stream' && <small style={{ display: 'block', fontSize: '13px', color: '#1a68ff', marginTop: '2px' }}>Рабочий поток</small>}
                  </span>
                  <ArrowUpRight className="overview-arrow" size={19} />
                </button>
              ))}
            </div>
            {state.spaces.length > 8 && <div className="page-controls"><span>{state.spaces.length} всего</span><div><button onClick={() => setSpacePage(page => Math.max(0, page - 1))} disabled={spacePage === 0} aria-label="Предыдущая страница"><ChevronLeft size={20} /></button><span>{spacePage + 1} / {Math.ceil(state.spaces.length / 8)}</span><button onClick={() => setSpacePage(page => Math.min(Math.ceil(state.spaces.length / 8) - 1, page + 1))} disabled={spacePage >= Math.ceil(state.spaces.length / 8) - 1} aria-label="Следующая страница"><ChevronRight size={20} /></button></div></div>}
          </main>
        ) : currentSpace && (
          <main className="collection-stage" aria-label={currentSpace.name}>
            <div className="collection-header">
              <div>
                <button className="back-button" onClick={() => { setViewSpaceId(null); setShowSpaces(true) }}><ChevronLeft size={18} /> Пространства</button>
                <div className="space-title-row">
                  <h1>{currentSpace.name}</h1>
                  <button className="calm-icon" aria-label="Переименовать пространство" onClick={() => { setNewSpaceName(currentSpace.name); setModal('renameSpace') }}><Pencil size={17} /></button>
                </div>
              </div>
              <div className="space-add-actions">
                <button onClick={() => openWorkstage(currentSpace.id)} style={{ background: '#eef3ff', color: '#1a68ff', fontWeight: 600 }}>
                  <Globe2 size={18} /> Открыть вкладки
                </button>
                <button onClick={() => addPicked('file', currentSpace.id)}><FileText size={18} /> Документ</button>
                <button onClick={() => addPicked('app', currentSpace.id)}><AppWindow size={18} /> Приложение</button>
                <button onClick={() => startLink(currentSpace.id)}><Link2 size={18} /> Сайт</button>
              </div>
            </div>
            {currentSpace.resources.length ? <div className="resource-grid">{sortedResources.slice(visibleResourcePage * 6, visibleResourcePage * 6 + 6).map(resource => <div className="resource-card card" key={resource.id}><button className="resource-open" onClick={() => openResource(resource)}><span className={`resource-kind kind-${resource.kind}`}>{resourceIcon(resource.kind, 25)}</span><span className="resource-name">{resource.name}</span><span className="resource-open-label">Открыть <ExternalLink size={15} /></span></button><button className="resource-remove" onClick={() => removeResource(resource.id)} aria-label={`Убрать ${resource.name}`} title="Убрать из пространства"><X size={16} /></button></div>)}</div> : <div className="empty-space card"><span className="empty-space-icon"><Plus size={32} strokeWidth={1.3} /></span><h2>Здесь пока пусто.</h2><p>Добавьте документ, приложение или сайт.</p></div>}
            {currentSpace.resources.length > 6 && <div className="page-controls"><span>{currentSpace.resources.length} ресурсов</span><div><button onClick={() => setResourcePage(page => Math.max(0, page - 1))} disabled={visibleResourcePage === 0} aria-label="Предыдущая страница"><ChevronLeft size={20} /></button><span>{visibleResourcePage + 1} / {Math.ceil(currentSpace.resources.length / 6)}</span><button onClick={() => setResourcePage(page => Math.min(Math.ceil(currentSpace.resources.length / 6) - 1, page + 1))} disabled={visibleResourcePage >= Math.ceil(currentSpace.resources.length / 6) - 1} aria-label="Следующая страница"><ChevronRight size={20} /></button></div></div>}
          </main>
        )}
        <BottomDock
          state={state}
          now={time}
          currentSpaceId={currentSpace?.id || targetWorkstageSpace?.id}
          isWorkstageOpen={isWorkstageOpen}
          appIcon={productIcon}
          onCapture={openCapture}
          onOpenWorkstage={openWorkstage}
          onOpenResource={openResource}
          onAddLink={startLink}
          onAddFile={spaceId => addPicked('file', spaceId)}
          onOpenSpace={openSpace}
          onOpenSettings={() => setModal('settings')}
        />
      </div>

      {modal === 'capture' && <Capture initialWhen={captureDefaultWhen} onClose={() => setModal(null)} onSave={saveCapture} onVoiceHint={() => setToast('Для диктовки нажмите Win + H.')} />}
      {modal && modal !== 'capture' && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null) }}><div className="modal" role="dialog" aria-modal="true" aria-label="Действие"><button className="modal-close" onClick={() => setModal(null)} aria-label="Закрыть"><X size={19} /></button>
        {(modal === 'newSpace' || modal === 'newStream' || modal === 'renameSpace') && <><span className="modal-kicker"><Folder size={16} /> {modal === 'newStream' ? 'НОВЫЙ ПОТОК' : 'ПРОСТРАНСТВО'}</span><h2>{modal === 'renameSpace' ? 'Новое название' : modal === 'newStream' ? 'Как назовём поток?' : 'Для чего оставим место?'}</h2><input className="large-input" autoFocus maxLength={70} value={newSpaceName} onChange={event => setNewSpaceName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') createSpace() }} aria-label="Название пространства" />{modal === 'newSpace' && <div className="capture-options">{['Работа', 'Личное', 'Учёба', 'Поездка'].map(name => <button key={name} onClick={() => setNewSpaceName(name)}>{name}</button>)}</div>}<div className="modal-bottom end"><button className="primary-button" disabled={!newSpaceName.trim()} onClick={createSpace}>{modal === 'renameSpace' ? 'Сохранить' : 'Создать'} <ArrowRight size={17} /></button></div></>}
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



