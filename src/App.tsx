import { useEffect, useState } from 'react'
import {
  AppWindow, Archive, ArrowRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, History, Pencil,
  ArrowLeft, RotateCw,
  Cloud, CloudRain, CloudSnow, CloudSun, Columns2, ExternalLink, FileText, Folder, Globe2, Link2,
  Plus, Settings2, Sparkles, Sun, X
} from 'lucide-react'
import { bridge, isDesktop } from './bridge'
import { Home } from './Home'
import { Capture } from './Capture'
import { planTime } from './dayModel'
import { isDemo, resetExample } from './demo'
import { formatDue, toLocalInput } from './reminders'
import type { AppState, BrowserSession, BrowserTab, CalendarEvent, CalendarSubscription, Reminder, ResearchSource, Resource, ResourceKind, Space, SpaceTone } from './types'
import { normalizeCalendarUrl } from './calendar/ical'
import { calendarRange, parseCalendar } from './calendar/parse'
import { cachedUfaWeather, fetchUfaWeather, weatherDescription, type UfaWeather } from './weather'
import { Workstage } from './browser/Workstage'
import { BottomDock } from './BottomDock'
import { AssistantPanel } from './CloudAssistant'
import { assistantRoles, defaultAssistantPreferences } from './assistantModel'
import { recentMaterials, resourceAppLabel } from './resourcePresentation'
import { zenTimer } from './focus/zenTimer'
import { usePersistentState } from './statePersistence'
import { saveCheckpoint } from './checkpoints'
import { ImportTabs, type ImportGroup } from './browser/ImportTabs'
import './browser/compact.css'
import { AttentionIsland } from './AttentionIsland'
import { IntegrationSettings } from './IntegrationSettings'
import { useNews } from './news'
import { ContextSearch } from './ContextSearch'
import { ChangesOverview } from './ChangesOverview'
import { BrowserTools } from './BrowserTools'
import { Dialog } from './Dialog'
import { ActionMenu } from './ActionMenu'
import { SpacePreview, spaceContents } from './SpacePreview'
import type { AIContext } from './types'

const emptySession = (): BrowserSession => ({ tabs: [], activeTabId: '', splitTabId: null })

function addressToUrl(input: string): string {
  const value = input.trim()
  if (/^https?:\/\//i.test(value)) return new URL(value).toString()
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(value)) return new URL(`http://${value}`).toString()
  if (/^[^\s]+\.[^\s]+$/.test(value)) return new URL(`https://${value}`).toString()
  return `https://yandex.ru/search/?text=${encodeURIComponent(value)}`
}

type Modal = 'capture' | 'newSpace' | 'newStream' | 'renameSpace' | 'newLink' | 'settings' | 'weather' | 'import' | 'search' | 'changes' | null
type AppRoute = { type: 'home' } | { type: 'spaces' } | { type: 'space'; spaceId: string } | { type: 'browse'; spaceId: string }
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
  if (/photoshop/i.test(name)) return <span className="photoshop-mark" aria-hidden="true">Ps</span>
  if (/indesign/i.test(name)) return <span className="indesign-mark" aria-hidden="true">Id</span>
  if (/word/i.test(name)) return <span className="word-mark" aria-hidden="true">W</span>
  if (/code|vs\s*code|visual studio/i.test(name)) return <span className="vscode-mark" aria-hidden="true">VS</span>
  if (/telegram/i.test(name)) return <span className="telegram-mark" aria-hidden="true">TG</span>
  if (/notion/i.test(name)) return <span className="notion-mark" aria-hidden="true">N</span>
  if (/spotify/i.test(name)) return <span className="spotify-mark" aria-hidden="true">♫</span>
  if (/obsidian/i.test(name)) return <span className="obsidian-mark" aria-hidden="true">✦</span>
  if (/slack/i.test(name)) return <span className="slack-mark" aria-hidden="true">#</span>
  if (/docs|документ/i.test(name)) return <span className="docs-mark" aria-hidden="true">D</span>
  return <AppWindow size={22} strokeWidth={1.5} />
}

function App() {
  const [time, setTime] = useState(new Date())
  const [route, setRoute] = useState<AppRoute>({ type: 'home' })
  const viewSpaceId = route.type === 'space' ? route.spaceId : null
  const workstageSpaceId = route.type === 'browse' ? route.spaceId : null
  const showSpaces = route.type === 'spaces'
  const [spacePage, setSpacePage] = useState(0)
  const [resourcePage, setResourcePage] = useState(0)
  const [modal, setModal] = useState<Modal>(null)
  const [searchReminderId, setSearchReminderId] = useState('')
  const [toast, setToast] = useState('')
  const [undoAction, setUndoAction] = useState<{ label: string; restore: () => void } | null>(null)
  const { state, commit, replace: setState } = usePersistentState(setToast)
  const news = useNews(state, commit)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceTone, setNewSpaceTone] = useState<SpaceTone>('sage')
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkSpaceId, setLinkSpaceId] = useState('')
  const [captureDefaultWhen, setCaptureDefaultWhen] = useState('')
  const [autostart, setAutostart] = useState(false)
  const [weather, setWeather] = useState<UfaWeather | null>(cachedUfaWeather)
  const [newCalendarName, setNewCalendarName] = useState('')
  const [newCalendarUrl, setNewCalendarUrl] = useState('')
  const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false)
  const isWorkstageOpen = route.type === 'browse'
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantDraft, setAssistantDraft] = useState('')
  const [assistantContexts, setAssistantContexts] = useState<AIContext[]>([])
  const [assistantPreferences, setAssistantPreferences] = useState(defaultAssistantPreferences)
  useEffect(() => { const role = state?.aiConfiguration?.role; if (role) setAssistantPreferences(previous => previous.role === role ? previous : { ...previous, role }) }, [state?.aiConfiguration?.role])
  const [omniboxUrl, setOmniboxUrl] = useState('')
  const targetWorkstageSpace = state?.spaces.find(space => space.id === (workstageSpaceId || state.activeSpaceId)) || state?.spaces[0]
  const session = targetWorkstageSpace?.activeSession || emptySession()
  const tabs = session.tabs
  const activeTabId = tabs.some(tab => tab.id === session.activeTabId) ? session.activeTabId : tabs[0]?.id || ''
  const splitTabId = tabs.some(tab => tab.id === session.splitTabId) ? session.splitTabId || null : null

  async function syncCalendars(targetState?: AppState, reference = new Date(), silent = false) {
    const s = targetState || state
    if (!s) return
    const subs = s.calendarSubscriptions || []
    if (!subs.length) return
    setIsRefreshingCalendar(true)
    try {
      const allEvents: CalendarEvent[] = []
      const results = new Map<string, { error?: string; lastFetchedAt?: string }>()
      for (const sub of subs) {
        try {
          const raw = bridge.integrations && sub.secretId ? await bridge.integrations.fetchCalendarSource(sub.id) : bridge.fetchCalendar
            ? await bridge.fetchCalendar(sub.url)
            : await fetch(normalizeCalendarUrl(sub.url)).then(r => r.text())
          const parsed = parseCalendar(raw, reference, sub.id)
          allEvents.push(...parsed)
          results.set(sub.id, { lastFetchedAt: new Date().toISOString() })
        } catch (e) {
          results.set(sub.id, { error: e instanceof Error ? e.message : 'Не удалось обновить календарь' })
        }
      }
      const range = calendarRange(reference)
      commit(prev => {
        const enabled = new Set(prev.calendarSubscriptions?.map(item => item.id))
        const retained = (prev.events || []).filter(event => !event.sourceId || enabled.has(event.sourceId) && (results.get(event.sourceId)?.error || Date.parse(event.endAt) < range.start.getTime() || Date.parse(event.startAt) > range.end.getTime()))
        const unique = new Map([...retained, ...allEvents.filter(event => enabled.has(event.sourceId!)).map(event => { const old = prev.events?.find(item => item.id === event.id); return { ...event, spaceId: old?.spaceId, noticeMinutes: old?.noticeMinutes } })].map(event => [event.id, event]))
        return { ...prev, events: [...unique.values()], reminders: prev.reminders.map(item => {
          if (item.trigger?.kind !== 'event') return item
          const event = unique.get(item.trigger.eventId)
          const dueAt = event ? new Date(Date.parse(event.endAt) + item.trigger.offsetMinutes * 60000).toISOString() : null
          return item.dueAt === dueAt ? item : { ...item, dueAt, notifiedAt: undefined }
        }), calendarSubscriptions: prev.calendarSubscriptions?.map(sub => results.has(sub.id) ? { ...sub, ...results.get(sub.id), error: results.get(sub.id)?.error } : sub) }
      })
      if (!silent) setToast(`Календарь обновлён: событий ${allEvents.length}. Ошибок: ${[...results.values()].filter(item => item.error).length}.`)
    } catch {
      setToast('Не удалось обновить календарь.')
    } finally {
      setIsRefreshingCalendar(false)
    }
  }

  async function addCalendar() {
    const url = newCalendarUrl.trim()
    const name = newCalendarName.trim() || 'Мой календарь'
    if (!url) { setToast('Укажите ссылку на календарь.'); return }
    if (bridge.integrations) {
      try { await bridge.integrations.addCalendar(name, url); setNewCalendarName(''); setNewCalendarUrl(''); setToast('Календарь подключён. Адрес сохранён в защищённом хранилище.') }
      catch (error) { setToast(error instanceof Error ? error.message : 'Не удалось подключить календарь') }
      return
    }
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
    if (bridge.integrations) { bridge.integrations.removeCalendar(id).then(() => setToast('Календарь отключён.')).catch(error => setToast(error.message)); return }
    commit(prev => ({
      ...prev,
      calendarSubscriptions: (prev.calendarSubscriptions || []).filter(s => s.id !== id)
      , events: (prev.events || []).filter(event => event.sourceId !== id)
    }))
    setToast('Календарь отключён.')
  }


  useEffect(() => {
    bridge.getAutostart().then(setAutostart).catch(() => undefined)
    const timer = window.setInterval(() => setTime(new Date()), 30_000)
    const offFocus = bridge.onFocusCapture(openCapture)
    return () => { window.clearInterval(timer); offFocus() }
  }, [])

  useEffect(() => {
    if (!bridge.browser) return
    const observer = new MutationObserver(() => bridge.browser!.block(Boolean(document.querySelector('[role="dialog"], [role="menu"]'))).catch(() => undefined))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return bridge.browser?.onEvent(event => {
      if (event.type === 'update') commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === event.spaceId && space.activeSession ? { ...space, activeSession: { ...space.activeSession, tabs: space.activeSession.tabs.map(tab => tab.id === event.tabId ? { ...tab, ...event.updates } : tab) } } : space) }))
      else if (event.type === 'new-tab') commit(previous => ({ ...previous, spaces: previous.spaces.map(space => {
        if (space.id !== event.spaceId) return space
        const session = space.activeSession || emptySession()
        const tab: BrowserTab = { id: crypto.randomUUID(), url: event.url, title: new URL(event.url).hostname, parentTabId: event.parentTabId, branchId: session.tabs.find(item => item.id === event.parentTabId)?.branchId }
        return { ...space, activeSession: { ...session, tabs: [...session.tabs, tab], activeTabId: event.background ? session.activeTabId : tab.id } }
      }) }))
      else if (event.type === 'shortcut') handleShortcut(event.key, event.shift, event.alt)
    })
  }, [state, activeTabId, isWorkstageOpen])

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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setModal('search') }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        const input = document.querySelector<HTMLInputElement>('.omnibox-input')
        input?.focus()
        input?.select()
      }
      if ((event.ctrlKey || event.metaKey) && ['t', 'w', 'tab'].includes(event.key.toLowerCase())) { event.preventDefault(); handleShortcut(event.key.toLowerCase(), event.shiftKey, event.altKey) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTabId, tabs, isWorkstageOpen])

  function handleShortcut(key: string, shift = false, alt = false) {
    if (key === 'k') setModal('search')
    if (key === 'l') { const input = document.querySelector<HTMLInputElement>('.omnibox-input'); input?.focus(); input?.select() }
    if (alt && key === ' ') openCapture()
    if (key === 't') {
      if (shift) { const closed = session.closedTabs?.[0]; if (closed) { updateSession(previous => ({ ...previous, tabs: [...previous.tabs, closed], activeTabId: closed.id, closedTabs: previous.closedTabs?.slice(1) })); openWorkstage() } }
      else handleAddTab()
    }
    if (key === 'w' && isWorkstageOpen) handleCloseTab(activeTabId)
    if (key === 'tab' && tabs.length) { const index = tabs.findIndex(item => item.id === activeTabId); const next = tabs[(index + (shift ? -1 : 1) + tabs.length) % tabs.length]; updateSession(previous => ({ ...previous, activeTabId: next.id, splitTabId: previous.splitTabId === next.id ? previous.activeTabId : previous.splitTabId })) }
  }

  const calendarSources = state?.calendarSubscriptions?.map(item => `${item.id}:${item.secretId || item.url}`).join('|') || ''
  useEffect(() => {
    if (!state || !calendarSources) return
    syncCalendars(state, new Date(), true)
    const timer = window.setInterval(() => syncCalendars(undefined, new Date(), true), 15 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [state === null, calendarSources])

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
    const returning = state?.reminders.filter(item => !item.done && item.trigger?.kind === 'return' && item.trigger.spaceId === selected.id) || []
    if (returning.length) commit(previous => ({ ...previous, reminders: previous.reminders.map(item => returning.some(value => value.id === item.id) ? { ...item, dueAt: new Date().toISOString(), trigger: undefined, notifiedAt: undefined } : item) }))
    const artifact = selected.researchArtifacts?.find(item => item.id === artifactId)
    const researchTab: BrowserTab | undefined = artifact ? { id: crypto.randomUUID(), title: artifact.query, url: `research://${artifact.id}` } : undefined
    commit(previous => ({ ...previous, activeSpaceId: selected.id, spaces: researchTab ? previous.spaces.map(space => {
      if (space.id !== selected.id) return space
      const previousSession = space.activeSession || emptySession()
      const existing = previousSession.tabs.find(tab => tab.url === researchTab.url)
      return { ...space, activeSession: { ...previousSession, tabs: existing ? previousSession.tabs : [...previousSession.tabs, researchTab], activeTabId: existing?.id || researchTab.id } }
    }) : previous.spaces }))
    setRoute({ type: 'browse', spaceId: selected.id })
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

  async function saveCapture(title: string, dueAt: string | null, plannedDate: string | null = null, kind: 'note' | 'task' = plannedDate || dueAt ? 'task' : 'note') {
    const reminder: Reminder = { id: crypto.randomUUID(), title, createdAt: new Date().toISOString(), dueAt, plannedDate, kind, done: false, spaceId: isWorkstageOpen ? targetWorkstageSpace?.id : undefined }
    const saved = await commit(previous => ({ ...previous, reminders: [reminder, ...previous.reminders] }))
    if (saved !== true) return false
    setModal(null)
    setToast(dueAt ? `Напомним: ${formatDue(dueAt).toLowerCase()}.` : 'Сохранено. Можно вернуться позже.')
    return true
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
    const space: Space = { id: crypto.randomUUID(), name, tone: newSpaceTone, kind: isStream ? 'stream' : 'base', resources: [], ...(isStream ? { activeSession: emptySession() } : {}) }
    commit(previous => ({ ...previous, activeSpaceId: space.id, spaces: [...previous.spaces, space] }))
    setNewSpaceName('')
    setModal(null)
    if (isStream) {
      setRoute({ type: 'browse', spaceId: space.id })
    } else {
      setRoute({ type: 'space', spaceId: space.id })
    }
    setResourcePage(0)
  }

  function openSpace(id: string) {
    commit(previous => ({ ...previous, activeSpaceId: id }))
    setRoute({ type: 'space', spaceId: id })
    setResourcePage(0)
  }

  function createStream() {
    setNewSpaceName('')
    setNewSpaceTone(tones[(state?.spaces.length || 0) % tones.length])
    setModal('newSpace')
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
    if (resource.kind === 'link' && /^https?:\/\//i.test(resource.target)) {
      const space = state?.spaces.find(item => item.resources.some(value => value.id === resource.id)) || targetWorkstageSpace
      if (!space) return
      const existing = space.activeSession?.tabs.find(item => item.url === resource.target)
      const tab: BrowserTab = existing || { id: crypto.randomUUID(), title: resource.name, url: resource.target }
      commit(previous => ({ ...previous, spaces: previous.spaces.map(item => item.id === space.id ? { ...item, lastActiveAt: new Date().toISOString(), resources: item.resources.map(value => value.id === resource.id ? { ...value, lastOpenedAt: new Date().toISOString() } : value), activeSession: { ...(item.activeSession || emptySession()), tabs: existing ? item.activeSession!.tabs : [...(item.activeSession?.tabs || []), tab], activeTabId: tab.id } } : item) }))
      openWorkstage(space.id)
      if (existing) setToast('Эта страница уже открыта — вернулись к ней.')
      return
    }
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
    const owner = state?.spaces.find(space => space.resources.some(item => item.id === id))
    const resource = owner?.resources.find(item => item.id === id)
    commit(previous => ({ ...previous, spaces: previous.spaces.map(space => ({ ...space, resources: space.resources.filter(resource => resource.id !== id) })) }))
    if (owner && resource) setUndoAction({ label: 'Материал убран', restore: () => commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === owner.id && !space.resources.some(item => item.id === id) ? { ...space, resources: [...space.resources, resource] } : space) })) })
  }

  function archiveSpace(space: Space) {
    commit(previous => ({ ...previous, spaces: previous.spaces.map(item => item.id === space.id ? { ...item, archivedAt: new Date().toISOString() } : item) }))
    setRoute({ type: 'spaces' })
    setUndoAction({ label: 'Пространство в архиве', restore: () => commit(previous => ({ ...previous, spaces: previous.spaces.map(item => item.id === space.id ? { ...item, archivedAt: null } : item) })) })
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
    setRoute({ type: 'home' })
  }

  async function handleCloseTab(tabId: string) {
    if (bridge.browser && !await bridge.browser.close(tabId)) return
    updateSession(previous => {
      const closed = previous.tabs.find(tab => tab.id === tabId)
      const nextTabs = previous.tabs.filter(tab => tab.id !== tabId)
      const nextActiveId = previous.activeTabId === tabId ? nextTabs[0]?.id || '' : previous.activeTabId
      const nextSplitId = previous.splitTabId === tabId || previous.splitTabId === nextActiveId ? null : previous.splitTabId
      return {
        ...previous,
        tabs: nextTabs,
        activeTabId: nextActiveId,
        splitTabId: nextSplitId
        , closedTabs: closed ? [closed, ...(previous.closedTabs || [])].slice(0, 30) : previous.closedTabs
      }
    })
  }

  async function parkSpace() {
    if (!targetWorkstageSpace) return
    const ids = tabs.map(tab => tab.id)
    commit(previous => saveCheckpoint(previous, targetWorkstageSpace.id))
    returnHome()
    const result = await bridge.browser?.park(ids)
    setToast(result?.protectedCount ? `Сохранено. Незавершённых страниц оставлено открытыми: ${result.protectedCount}.` : 'Вкладки сохранены. Можно продолжить с главной.')
  }

  function importTabs(groups: ImportGroup[]) {
    const spaces: Space[] = groups.map((group, index) => ({ id: crypto.randomUUID(), name: group.name, tone: tones[index % tones.length], resources: [], activeSession: { tabs: group.tabs, activeTabId: group.tabs[0]?.id || '' } }))
    commit(previous => ({ ...previous, spaces: [...previous.spaces, ...spaces] }))
    setModal(null)
    setRoute({ type: 'spaces' })
    setToast(`Перенесено вкладок: ${groups.reduce((count, group) => count + group.tabs.length, 0)}. Они загрузятся при открытии.`)
  }

  function openBranch() {
    const source = tabs.find(tab => tab.id === activeTabId)
    if (!source) return
    const tab: BrowserTab = { id: crypto.randomUUID(), title: 'Новая ветка', url: '', parentTabId: source.id, branchId: crypto.randomUUID() }
    updateSession(previous => ({ ...previous, tabs: [...previous.tabs, tab], activeTabId: tab.id }))
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

  if (!state) return <div className="loading-screen"><span className="brand-mark">✳</span><span>{toast || 'Собираем ваш день…'}</span></div>

  const visibleResourcePage = Math.min(resourcePage, Math.max(0, Math.ceil((currentSpace?.resources.length || 0) / 6) - 1))
  const sortedResources = recentMaterials(currentSpace?.resources || [])
  const activeTopSpaceId = currentSpace?.id || targetWorkstageSpace?.id
  const availableTopSpaces = state.spaces.filter(space => !space.archivedAt)
  const visibleSpacePage = Math.min(spacePage, Math.max(0, Math.ceil(availableTopSpaces.length / 8) - 1))
  const visibleTopSpaces = availableTopSpaces.slice(0, 3)
  if (activeTopSpaceId && !visibleTopSpaces.some(space => space.id === activeTopSpaceId)) {
    const activeSpace = availableTopSpaces.find(space => space.id === activeTopSpaceId)
    if (activeSpace) visibleTopSpaces.splice(2, 1, activeSpace)
  }
  return (
    <div className={`app-shell ${bridge.platform === "darwin" ? "platform-mac" : ""} ${isWorkstageOpen ? 'browsing' : ''} ${isDesktop ? 'desktop' : ''}`}>
      <div className="page-wrap">
        <header className="browser-chrome">
          <div className="chrome-main">
            <button className="brand" onClick={returnHome} aria-label="На главную Дом">
              <span className="brand-mark">✳</span><span>дом<span className="brand-dot">.</span></span>
            </button>
            {isWorkstageOpen && <div className="browser-navigation"><button onClick={() => bridge.browser?.action(activeTabId, 'back')} aria-label="Назад"><ArrowLeft size={16} /></button><button onClick={() => bridge.browser?.action(activeTabId, 'forward')} aria-label="Вперёд"><ArrowRight size={16} /></button><button onClick={() => bridge.browser?.action(activeTabId, 'reload')} aria-label="Обновить страницу"><RotateCw size={16} /></button></div>}
            <div className="calm-omnibox">
              <Globe2 size={17} className="omnibox-icon" />
              <input type="text" className="omnibox-input" value={omniboxUrl}
                onChange={e => setOmniboxUrl(e.target.value)} onKeyDown={handleOmniboxKeyDown}
                placeholder="Поиск или адрес сайта" aria-label="Поиск или адрес сайта" />
              <kbd>Ctrl L</kbd>
            </div>
            <div className="chrome-actions">
              {isWorkstageOpen ? <>
                <button className="chrome-button" onClick={() => targetWorkstageSpace && openSpace(targetWorkstageSpace.id)} title="Материалы текущего пространства"><Folder size={17} /><span>Материалы</span></button>
                <button className={`chrome-button ${splitTabId ? 'selected' : ''}`} onClick={handleToggleSplit} disabled={tabs.length < 2} title="Открыть вторую вкладку рядом"><Columns2 size={17} /><span>Рядом</span></button>
              </> : <button className="chrome-button" onClick={() => openWorkstage()} title="Открыть текущие вкладки"><Columns2 size={17} /><span>Вкладки</span><span className="chrome-tab-count">{tabs.length}</span></button>}
              {isWorkstageOpen && <BrowserTools />}<button className={`chrome-button chrome-assistant ${assistantOpen ? 'selected' : ''}`} onClick={() => { setAssistantContexts([]); setAssistantOpen(true) }} aria-label="ИИ в Доме" title={`ИИ · ${assistantRoles[assistantPreferences.role].label}`}><Sparkles size={19} strokeWidth={1.7} /></button>
              <button className="chrome-button" onClick={() => setModal("search")} title="Найти в Доме · Ctrl K" aria-label="Найти в Доме"><Folder size={18} /></button><button className="chrome-button" onClick={() => setModal('settings')} aria-label="Настройки"><Settings2 size={19} /></button>
            </div>
          </div>
          <div className="chrome-secondary">
            <nav className="chrome-spaces" aria-label="Пространства">
              <button className={`chrome-space ${!isWorkstageOpen && !currentSpace && !showSpaces ? 'selected' : ''}`} onClick={returnHome}>Мой день</button>
              {visibleTopSpaces.map(space => <button key={space.id}
                className={`chrome-space ${(isWorkstageOpen && space.id === targetWorkstageSpace?.id) || currentSpace?.id === space.id ? 'selected' : ''}`}
                onClick={() => isWorkstageOpen ? openWorkstage(space.id) : openSpace(space.id)} title={`Продолжить: ${space.name}`}>{space.name}</button>)}
              <button className={`chrome-space ${showSpaces ? 'selected' : ''}`} onClick={() => setRoute({ type: 'spaces' })}>Все пространства</button>
              <button className="chrome-new-space" onClick={createStream} aria-label="Создать пространство" title="Создать пространство"><Plus size={17} /></button>
            </nav>
            <AttentionIsland state={state} now={time} onChange={commit} onOpen={openResource} onSpace={openWorkstage} />
            <div className="chrome-status">
              {isDemo ? <a className="chrome-demo" href="/" title="Вернуться к своим данным">Пример дня <X size={12} /></a> : !isDesktop && <a className="chrome-demo" href="/?demo=1">Пример дня</a>}
              <button className="chrome-weather" onClick={() => setModal('weather')} aria-label="Погода и дороги в Уфе">{weather ? weatherIcon(weather.code) : <Cloud size={16} />}<span>Уфа · {weather ? `${Math.round(weather.temperature)}°` : '—°'}</span></button>
              <time>{time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          </div>
        </header>

        {!showSpaces && !currentSpace ? (
          !isWorkstageOpen ? (
            <Home
              initialReminderId={searchReminderId}
              onSearchHandled={() => setSearchReminderId('')}
              state={state}
              now={time}
              onChange={commit}
              onCapture={openCapture}
              onPlan={planCapture}
              onSpace={openSpace}
              onOpen={openResource}
              onAddLink={() => startLink()}
              onOpenWorkstage={openWorkstage}
              onAssistant={(draft, contexts) => { setAssistantDraft(draft || ""); setAssistantContexts(contexts || []); setAssistantOpen(true) }}
              onSaveThought={saveCapture}
              assistantRole={assistantPreferences.role}
              onImport={() => setModal('import')}
              onNewTab={handleAddTab}
              onSettings={() => setModal('settings')}
              onCalendarRange={date => syncCalendars(undefined, date, true)}
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
              onGoHome={returnHome}
              onOpenTab={openBrowserTab}
              onSaveTab={saveTabToSpace}
              onUpdateTab={handleUpdateTab}
              onOpenResource={openResource}
              onAddLink={() => startLink(targetWorkstageSpace?.id)}
              onPark={parkSpace}
              onImport={() => setModal('import')}
              onBranch={openBranch}
            />
          )
        ) : showSpaces && !currentSpace ? (
          <main className="collection-stage" aria-label="Пространства">
            <div className="collection-header">
              <div><span className="collection-eyebrow">КАЖДОМУ ДЕЛУ — СВОЁ МЕСТО</span><h1>Пространства</h1><p>Оставьте всё под рукой. Вернитесь, когда захотите.</p></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="primary-button" onClick={createStream}><Plus size={18} /> Новое пространство</button>
              </div>
            </div>
            <div className="space-overview-grid">
              {state.spaces.filter(space => !space.archivedAt).slice(visibleSpacePage * 8, visibleSpacePage * 8 + 8).map(space => (
                <button className={`overview-space card tone-${space.tone}`} key={space.id} title={space.name} onClick={() => space.activeSession?.tabs.some(tab => tab.url) ? openWorkstage(space.id) : openSpace(space.id)}>
                  <span className="space-card-top"><span className="space-presence" />{space.checkpoint ? 'Есть с чего продолжить' : space.resources.length ? 'Всё под рукой' : 'Чистый лист'}</span>
                  <SpacePreview space={space} />
                  <span className="space-card-copy">
                    <strong>{space.name}</strong>
                    <small>{space.checkpoint?.nextStep || spaceContents(space)}</small>
                  </span>
                  <span className="overview-arrow"><ArrowUpRight size={19} /></span>
                </button>
              ))}
            </div>
            {state.spaces.some(space => space.archivedAt) && <details className="space-archive"><summary>Архив</summary>{state.spaces.filter(space => space.archivedAt).map(space => <button className="soft-button" key={space.id} onClick={() => commit(previous => ({ ...previous, spaces: previous.spaces.map(item => item.id === space.id ? { ...item, archivedAt: null } : item) }))}>Вернуть «{space.name}»</button>)}</details>}
            {availableTopSpaces.length > 8 && <div className="page-controls"><span>{state.spaces.length} всего</span><div><button onClick={() => setSpacePage(page => Math.max(0, page - 1))} disabled={spacePage === 0} aria-label="Предыдущая страница"><ChevronLeft size={20} /></button><span>{spacePage + 1} / {Math.ceil(availableTopSpaces.length / 8)}</span><button onClick={() => setSpacePage(page => Math.min(Math.ceil(state.spaces.length / 8) - 1, page + 1))} disabled={spacePage >= Math.ceil(state.spaces.length / 8) - 1} aria-label="Следующая страница"><ChevronRight size={20} /></button></div></div>}
          </main>
        ) : currentSpace && (
          <main className={`collection-stage space-detail tone-context-${currentSpace.tone}`} aria-label={currentSpace.name}>
            <div className="collection-header">
              <div>
                <button className="back-button" onClick={() => setRoute({ type: 'spaces' })}><ChevronLeft size={18} /> Пространства</button>
                <div className="space-title-row">
                  <h1>{currentSpace.name}</h1>
                  <button className="calm-icon" aria-label="Переименовать пространство" onClick={() => { setNewSpaceName(currentSpace.name); setModal('renameSpace') }}><Pencil size={17} /></button>
                </div>
                <p className="space-detail-meta">{spaceContents(currentSpace)}</p>
              </div>
              <div className="space-add-actions">
                <button className="space-open-tabs" onClick={() => openWorkstage(currentSpace.id)}>
                  <Globe2 size={18} /> Открыть вкладки
                </button>
                <ActionMenu label="Добавить в пространство" triggerContent={<><Plus size={18} />Добавить<ChevronDown size={14} /></>} actions={[
                  { label: 'Сайт', icon: <Link2 size={17} />, onSelect: () => startLink(currentSpace.id) },
                  { label: 'Документ', icon: <FileText size={17} />, onSelect: () => addPicked('file', currentSpace.id) },
                  { label: 'Приложение', icon: <AppWindow size={17} />, onSelect: () => addPicked('app', currentSpace.id) }
                ]} />
                <ActionMenu label="Действия с пространством" actions={[
                  { label: 'Что изменилось', icon: <History size={17} />, onSelect: () => setModal('changes') },
                  { label: 'В архив', icon: <Archive size={17} />, onSelect: () => archiveSpace(currentSpace) }
                ]} />
              </div>
            </div>
            {currentSpace.checkpoint && <section className="space-continuation card">
              <div className="continuation-copy"><span className="continuation-kicker"><span className="resume-indicator" />С того места, где остановились<small>{new Date(currentSpace.checkpoint.savedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</small></span><h2>{currentSpace.checkpoint.nextStep || 'Продолжить работу'}</h2><p>{currentSpace.checkpoint.note}</p></div>
              <button className="primary-button" onClick={() => openWorkstage(currentSpace.id)}>Продолжить <ArrowRight size={18} /></button>
              {Boolean(currentSpace.checkpointHistory?.length) && <details><summary><History size={15} />Предыдущие сохранения</summary>{currentSpace.checkpointHistory?.map(point => <p key={point.id}>{new Date(point.savedAt).toLocaleString('ru-RU')} · {point.nextStep || point.note || 'Вкладки сохранены'}</p>)}</details>}
            </section>}
            {currentSpace.resources.length ? <><div className="materials-heading"><h2>Под рукой</h2><span>{currentSpace.resources.length}</span></div><div className="resource-grid">{sortedResources.slice(visibleResourcePage * 6, visibleResourcePage * 6 + 6).map(resource => <div className="resource-card card" key={resource.id}><button className="resource-open" onClick={() => openResource(resource)}><span className={`resource-kind kind-${resource.kind}`}>{resourceIcon(resource.kind, 25)}</span><span className="resource-name" title={resource.name}>{resource.name}</span><span className="resource-open-label">{resourceAppLabel(resource)} <ExternalLink size={15} /></span></button><button className="resource-remove" onClick={() => removeResource(resource.id)} aria-label={`Убрать ${resource.name}`} title="Убрать из пространства"><X size={16} /></button></div>)}</div></> : <div className="empty-space card"><span className="empty-space-icon"><Folder size={28} strokeWidth={1.3} /></span><div className="empty-space-copy"><h2>Место для нужного.</h2><p>{currentSpace.activeSession?.tabs.some(tab => tab.url) ? 'Вкладки уже здесь. Добавьте к ним материалы.' : 'Соберите здесь то, к чему хочется вернуться.'}</p></div><div className="empty-space-actions"><button onClick={() => startLink(currentSpace.id)}><Link2 size={17} />Сохранить сайт</button><button onClick={() => addPicked('file', currentSpace.id)}><Plus size={17} />Документ</button></div></div>}
            {currentSpace.resources.length > 6 && <div className="page-controls"><span>{currentSpace.resources.length} ресурсов</span><div><button onClick={() => setResourcePage(page => Math.max(0, page - 1))} disabled={visibleResourcePage === 0} aria-label="Предыдущая страница"><ChevronLeft size={20} /></button><span>{visibleResourcePage + 1} / {Math.ceil(currentSpace.resources.length / 6)}</span><button onClick={() => setResourcePage(page => Math.min(Math.ceil(currentSpace.resources.length / 6) - 1, page + 1))} disabled={visibleResourcePage >= Math.ceil(currentSpace.resources.length / 6) - 1} aria-label="Следующая страница"><ChevronRight size={20} /></button></div></div>}
          </main>
        )}
        {!isWorkstageOpen && <BottomDock
          state={state}
          now={time}
          currentSpaceId={currentSpace?.id || targetWorkstageSpace?.id}
          isHome={!isWorkstageOpen && !currentSpace && !showSpaces}
          appIcon={productIcon}
          onCapture={openCapture}
          onOpenResource={openResource}
          onAddLink={startLink}
          onAddFile={spaceId => addPicked('file', spaceId)}
          onOpenSettings={() => setModal('settings')}
        />}
      </div>

      {assistantOpen && <AssistantPanel state={state} onChange={commit} spaceId={targetWorkstageSpace?.id} tabId={activeTabId} initialContexts={assistantContexts} onOpen={openResource} draft={assistantDraft} preferences={assistantPreferences} onPreferencesChange={setAssistantPreferences} onDraftChange={setAssistantDraft} onClose={() => setAssistantOpen(false)} />}
      {modal === 'capture' && <Capture initialWhen={captureDefaultWhen} onClose={() => setModal(null)} onSave={saveCapture} onVoiceHint={() => setToast('Для диктовки нажмите Win + H.')} />}
      {modal === 'search' && <ContextSearch state={state} localOnly={isDemo || !isDesktop} onClose={() => setModal(null)} onSelect={item => {
        const owner = state.spaces.find(space => space.id === item.spaceId)
        const resource = owner?.resources.find(value => value.id === item.id)
        const tab = owner?.activeSession?.tabs.find(value => value.id === item.id)
        if (resource) openResource(resource)
        else if (tab && owner) { commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === owner.id ? { ...space, activeSession: { ...space.activeSession!, activeTabId: tab.id, splitTabId: space.activeSession?.splitTabId === tab.id ? null : space.activeSession?.splitTabId } } : space) })); openWorkstage(owner.id) }
        else if (state.reminders.some(value => value.id === item.id)) { setRoute({ type: 'home' }); setSearchReminderId(item.id) }
        else if (owner) openSpace(owner.id)
      }} />}
      {modal === 'changes' && currentSpace && <ChangesOverview state={state} space={currentSpace} onClose={() => setModal(null)} />}
      {modal === 'import' && <ImportTabs onClose={() => setModal(null)} onImport={importTabs} />}
      {modal && modal !== 'capture' && modal !== 'import' && modal !== 'search' && modal !== 'changes' && <Dialog className={`app-dialog ${['newSpace', 'newStream', 'renameSpace'].includes(modal) ? 'space-create-dialog' : ''}`} title={modal === 'settings' ? 'Настройки' : modal === 'renameSpace' ? 'Новое название' : modal === 'newLink' ? 'Новая ссылка' : modal === 'weather' ? 'Погода' : modal === 'newStream' ? 'Как назовём поток?' : 'Для чего оставим место?'} onClose={() => setModal(null)}>
        {(modal === 'newSpace' || modal === 'newStream' || modal === 'renameSpace') && <>
          {modal !== 'renameSpace' && <div className={`space-create-preview tone-${newSpaceTone}`}><SpacePreview space={{ resources: [] }} /><span><strong>{newSpaceName.trim() || 'Ваше новое пространство'}</strong><small>Вкладки, мысли и материалы — вместе.</small></span></div>}
          <div className="calm-form"><label>Название пространства<input className="large-input" autoFocus maxLength={70} value={newSpaceName} onChange={event => setNewSpaceName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) createSpace() }} /></label></div>
          {modal === 'newSpace' && <div className="capture-options space-name-suggestions">{['Работа', 'Личное', 'Учёба', 'Поездка'].map(name => <button key={name} onClick={() => setNewSpaceName(name)}>{name}</button>)}</div>}
          <div className="modal-bottom">{modal !== 'renameSpace' && <div className="space-tone-picker" role="group" aria-label="Цвет пространства">{tones.map((tone, index) => <button key={tone} className={`tone-choice tone-${tone}`} aria-label={['Шалфей', 'Сирень', 'Песок', 'Небо'][index]} aria-pressed={newSpaceTone === tone} onClick={() => setNewSpaceTone(tone)}><span /></button>)}</div>}<button className="primary-button" disabled={!newSpaceName.trim()} onClick={createSpace}>{modal === 'renameSpace' ? 'Сохранить' : 'Создать пространство'} <ArrowRight size={17} /></button></div>
        </>}
        {modal === 'newLink' && <><span className="modal-kicker"><Globe2 size={16} /> СОХРАНИТЬ САЙТ</span><div className="form-stack"><label>Название<input value={linkName} onChange={event => setLinkName(event.target.value)} /></label><label>Адрес<input value={linkUrl} onChange={event => setLinkUrl(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addLink() }} /></label></div><div className="modal-bottom end"><button className="primary-button" onClick={addLink}>Добавить <ArrowRight size={17} /></button></div></>}
        {modal === 'settings' && <><span className="modal-kicker"><Settings2 size={16} /> НАСТРОЙКИ</span>{isDemo && <div className="setting-row"><span>Пример хранится отдельно от ваших записей.</span><button className="soft-button" onClick={() => { setState(resetExample()); setRoute({ type: 'home' }); setModal(null) }}>Начать заново</button></div>}<div className="setting-row"><span><strong>Открывать после входа в систему</strong></span><button className={`toggle ${autostart ? 'on' : ''}`} onClick={() => changeAutostart(!autostart)} disabled={isDemo || !isDesktop} role="switch" aria-checked={autostart} aria-label="Автозапуск"><span /></button></div><div className="setting-row"><span><strong>Быстрый ввод</strong><small>{bridge.platform === "darwin" ? "Cmd + Option + Space" : "Ctrl + Alt + Space"}</small></span></div>
        <div className="setting-row"><span><strong>Живые подсказки</strong><small>Одно короткое движение актуального напоминания</small></span><button className={`toggle ${state.liveHints ? 'on' : ''}`} role="switch" aria-checked={Boolean(state.liveHints)} aria-label="Живые подсказки" onClick={() => commit(previous => ({ ...previous, liveHints: !previous.liveHints }))}><span /></button></div>
        <div className="setting-row"><span><strong>Резервная копия</strong><small>{isDemo ? 'Доступно в личном режиме' : 'Сохранить отдельную копию локальных данных'}</small></span><button className="soft-button" disabled={isDemo} onClick={async () => { try { await bridge.backup(); setToast('Резервная копия сохранена.') } catch { setToast('Не удалось создать резервную копию.') } }}>Создать</button></div>
        <div className="setting-row" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
          <span><strong>Календари (iCal / Webcal)</strong><small>События на сегодня и ссылки на звонки</small></span>
          {Boolean(state?.calendarSubscriptions?.length) && <button className="soft-button" disabled={isRefreshingCalendar} onClick={() => syncCalendars()}>{isRefreshingCalendar ? 'Обновляем…' : 'Обновить'}</button>}
        </div>
        {state?.calendarSubscriptions?.map(sub => (
          <div key={sub.id} className="setting-sub-row">
            <div>
              <strong>{sub.name}</strong>
              <small>{sub.error || (sub.secretId ? "Адрес защищён хранилищем ОС" : sub.url)}</small>
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
        <IntegrationSettings state={state} onChange={commit} onNewsRefresh={news.refresh} newsRefreshing={news.refreshing} /><div className="privacy-note" style={{ marginTop: 8 }}>Данные хранятся на этом компьютере. Диктовка: Win + H.</div></>}
        {modal === 'weather' && <><span className="modal-kicker">Уфа</span><h2>{weather ? `${Math.round(weather.temperature)}° · ${weatherDescription(weather.code)}` : 'Погода недоступна'}</h2><p className="modal-intro">{weather ? `Open-Meteo · ${weather.observedAt.replace('T', ' ')}` : 'Попробуем обновить данные позже.'}</p><button className="soft-button" onClick={openTraffic}>Пробки на карте <ArrowUpRight size={17} /></button></>}
      </Dialog>}
      {toast && <div className="toast" role="status"><span>{toast}</span><button onClick={() => setToast('')} aria-label="Закрыть"><X size={15} /></button></div>}
      {undoAction && <div className="calm-undo" role="status"><span>{undoAction.label}</span><button onClick={() => { undoAction.restore(); setUndoAction(null) }}>Вернуть</button><button aria-label="Закрыть" onClick={() => setUndoAction(null)}><X size={15} /></button></div>}
    </div>
  )
}

export default App



