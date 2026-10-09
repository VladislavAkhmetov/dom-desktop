import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type HTMLAttributes } from 'react'
import {
  AppWindow, Archive, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, History, Pencil,
  ExternalLink, FileText, Folder, Globe2, Link2,
  LayoutGrid, Pin, Plus, Search, Settings2, Sparkles, Trash2, X
} from 'lucide-react'
import { bridge, isDesktop } from './bridge'
import { Home } from './Home'
import { Capture } from './Capture'
import { planTime } from './dayModel'
import { isDemo } from './demo'
import { formatDue, toLocalInput } from './reminders'
import type { AppState, BrowserSession, BrowserTab, CalendarEvent, CalendarSubscription, OpenResult, Reminder, ResearchSource, Resource, ResourceKind, Space, SpaceTone } from './types'
import { localDate, normalizeSpace } from '../shared/state'
import { activateContext, contextDocuments, contextSession, contextTitle, createContext, currentContext, documentPathKey, recordDocumentOpen, updateContextSession } from './workContexts'
import { resumeDocuments, type ResumeResult } from './resumeContext'
import { normalizeCalendarUrl } from './calendar/ical'
import { calendarRange, parseCalendar } from './calendar/parse'
import { cachedUfaWeather, fetchUfaWeather, type UfaWeather } from './weather'
import { AmbientDate, AmbientWeather, WeatherDetails } from './AmbientPreviews'
import { Workstage } from './browser/Workstage'
import { BottomDock } from './BottomDock'
import { FluidGroup } from './FluidMotion'
import { useWorkspaceTransition, type WorkspaceRoute } from './workspaceTransition'
import { AssistantPanel } from './CloudAssistant'
import { assistantRoles, defaultAssistantPreferences } from './assistantModel'
import { recentMaterials, resourceAppLabel } from './resourcePresentation'
import { zenTimer } from './focus/zenTimer'
import { FocusPanel } from './focus/FocusPanel'
import { usePersistentState } from './statePersistence'
import { saveCheckpoint } from './checkpoints'
import { ImportTabs, type ImportGroup } from './browser/ImportTabs'
import './browser/compact.css'
import { AttentionIsland } from './AttentionIsland'
import { TabOverview } from './browser/TabOverview'
import { createSpaceAndMoveTab, ensureWebSpace, moveBrowserTab, orderedTabs, removeBrowserTab, reorderBrowserTabs, restoreBrowserTab, selectBrowserTab, tabEntries, webSpaceId } from './browser/tabModel'
import { Settings, type SettingsSectionId } from './Settings'
import { ProfilePopover } from './ProfilePopover'
import { getUserProfile, updateUserProfile } from './userProfile'
import './profile.css'
import { useNews } from './news'
import { ContextSearch } from './ContextSearch'
import { ChangesOverview } from './ChangesOverview'
import { BrowserChrome } from './browser/BrowserChrome'
import { BrowserHistory } from './browser/BrowserHistory'
import { clearHistory, isValidHistoryUrl, recordHistory, removeHistoryItem } from './browser/historyModel'
import { BrowserDayPanel } from './browser/BrowserDayPanel'
import { browserDayModel } from './browser/browserDayModel'
import { SavePageDialog } from './browser/SavePageDialog'
import { BOOKMARKS, favoriteResources, removeFavoritePage, savePageToDestination, type SavePageRequest } from './browser/bookmarks'
import { PageActions, type FavoritePageRequest } from './browser/PageActions'
import { Dialog } from './Dialog'
import { ActionMenu, type MenuAction } from './ActionMenu'
import { SpacePreview, spaceContents } from './SpacePreview'
import { SpacesOverview } from './SpacesOverview'
import { DEFAULT_WALLPAPER, resolveWallpaperUrl } from './WallpaperPicker'
import { DashboardSettings } from './DashboardSettings'
import { dashboardWidgets } from './dashboard'
import { isCabinetPreview } from './cabinetMode'
import { cabinetFromTabs, copyMaterial, hasCabinetWork, nameFromMaterials, newCabinet, suggestInitialName } from './cabinetModel'
import { SpacePanel } from './browser/SpacePanel'
import { CabinetContents } from './CabinetContents'
import { useContextMenu } from './ContextMenu'
import { readCabinetDrag, reorderCabinets, writeCabinetDrag, type CabinetDrag } from './cabinetInteractions'
import { useCabinetPointerDrag } from './useCabinetPointerDrag'
import './cabinet.css'
import type { AIContext } from './types'

const emptySession = (): BrowserSession => ({ tabs: [], activeTabId: '', splitTabId: null })

function addressToUrl(input: string): string {
  const value = input.trim()
  if (/^https?:\/\//i.test(value)) return new URL(value).toString()
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(value)) return new URL(`http://${value}`).toString()
  if (/^[^\s]+\.[^\s]+$/.test(value)) return new URL(`https://${value}`).toString()
  return `https://yandex.ru/search/?text=${encodeURIComponent(value)}`
}

type Modal = 'capture' | 'newSpace' | 'newStream' | 'renameSpace' | 'newLink' | 'settings' | 'dashboard' | 'focus' | 'weather' | 'import' | 'search' | 'changes' | 'archive' | 'context' | 'splitSpace' | 'documentReference' | 'deleteSpace' | 'history' | null
type AppRoute = WorkspaceRoute
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
  const [route, setRouteState] = useState<AppRoute>({ type: 'home' })
  const routeRef = useRef(route)
  routeRef.current = route
  const shellRef = useRef<HTMLDivElement>(null)
  const dashboardRoute = useRef<Exclude<AppRoute, { type: 'browse' }>>({ type: 'home' })
  useEffect(() => { if (route.type !== 'browse') dashboardRoute.current = route }, [route])
  const contentViewport = useRef<HTMLDivElement>(null)
  const [hubBounds, setHubBounds] = useState({ width: 1200, height: 504 })
  const viewSpaceId = route.type === 'space' ? route.spaceId : null
  const workstageSpaceId = route.type === 'browse' ? route.spaceId : null
  const showSpaces = route.type === 'spaces'
  const [resourcePage, setResourcePage] = useState(0)
  const [modal, setModal] = useState<Modal>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId | undefined>(undefined)
  const profileAnchorRef = useRef<HTMLButtonElement>(null)
  function openSettings(section?: SettingsSectionId) { setSettingsSection(section); setModal('settings') }
  const [focusTaskId, setFocusTaskId] = useState<string | undefined>()
  const [searchReminderId, setSearchReminderId] = useState('')
  const [calendarRequested, setCalendarRequested] = useState(false)
  const [tabsOverviewOpen, setTabsOverviewOpen] = useState(false)
  const [tabsOverviewScope, setTabsOverviewScope] = useState<'space' | 'all'>('all')
  const [browserDayOpen, setBrowserDayOpen] = useState(false)
  const [spacePanelOpen, setSpacePanelOpen] = useState(false)
  const [spaceActionId, setSpaceActionId] = useState('')
  const [splitTabIds, setSplitTabIds] = useState<string[]>([])
  const [documentTarget, setDocumentTarget] = useState('')
  const [documentName, setDocumentName] = useState('')
  const [browserDayPinned, setBrowserDayPinned] = useState(false)
  const [savePage, setSavePage] = useState<{ tab: BrowserTab; sourceSpaceId?: string } | null>(null)
  const [browserFocus, setBrowserFocus] = useState(zenTimer.getState())
  useEffect(() => zenTimer.subscribe(setBrowserFocus), [])
  useEffect(() => { if (route.type !== 'browse' && !browserDayPinned) setBrowserDayOpen(false) }, [route.type, browserDayPinned])
  const [tabCovers, setTabCovers] = useState<Record<string, string>>({})
  const setRoute = useWorkspaceTransition(shellRef, route, setRouteState, tabCovers)
  const [cabinetDrag, setCabinetDrag] = useState<CabinetDrag | null>(null)
  const cabinetDragRef = useRef<CabinetDrag | null>(null)
  const [cabinetDrop, setCabinetDrop] = useState<{ id: string; after: boolean; pin: boolean } | null>(null)
  const [cabinetTabDrop, setCabinetTabDrop] = useState('')
  const spaceContext = useContextMenu()
  const pointerCabinet = useCabinetPointerDrag({
    onStart: value => { cabinetDragRef.current = value; setCabinetDrag(value) },
    onOver: (value, x, y) => {
      const target = document.elementFromPoint(x, y)
      const tab = target?.closest<HTMLElement>('.cabinet-tab-card')
      setCabinetTabDrop(value.kind === 'tab' && tab?.dataset.cabinetOwner === value.spaceId && tab.dataset.tabId !== value.id ? tab.dataset.tabId || '' : '')
      const item = target?.closest<HTMLElement>('[data-cabinet-space-target]'), id = item?.dataset.spaceId
      if (!item || !id || id === value.spaceId) { setCabinetDrop(null); return }
      const bounds = item.getBoundingClientRect(), after = x > bounds.left + bounds.width / 2, pin = item.classList.contains('chrome-space')
      setCabinetDrop(previous => previous?.id === id && previous.after === after && previous.pin === pin ? previous : { id, after, pin })
    },
    onDrop: (value, x, y) => {
      const target = document.elementFromPoint(x, y), tab = target?.closest<HTMLElement>('.cabinet-tab-card')
      if (value.kind === 'tab' && tab?.dataset.cabinetOwner === value.spaceId && tab.dataset.tabId && tab.dataset.tabId !== value.id) {
        const source = state?.spaces.find(space => space.id === value.spaceId), bounds = tab.getBoundingClientRect()
        if (source) reorderTab(source.id, currentContext(source).id, value.id, tab.dataset.tabId, x > bounds.left + bounds.width / 2)
        return
      }
      const item = target?.closest<HTMLElement>('[data-cabinet-space-target]'), destination = item?.dataset.spaceId
      const source = state?.spaces.find(space => space.id === value.spaceId && !space.archivedAt)
      if (!source || !item || !destination || source.id === destination) return
      if (value.kind === 'space') { const bounds = item.getBoundingClientRect(); reorderSpace(source.id, destination, x > bounds.left + bounds.width / 2, item.classList.contains('chrome-space')) }
      else if (value.kind === 'tab') moveTab(source.id, value.id, destination)
      else { const resource = source.resources.find(resource => resource.id === value.id); if (resource) void copyToCabinet(resource, destination) }
    },
    onFinish: finishCabinetDrag
  })
  const [toast, setToast] = useState('')
  const [contextEditor, setContextEditor] = useState<{ spaceId: string; contextId: string; isNew: boolean } | null>(null)
  const [contextName, setContextName] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [contextNextStep, setContextNextStep] = useState('')
  const [contextDocumentIds, setContextDocumentIds] = useState<string[]>([])
  const [resumeStatus, setResumeStatus] = useState<{ spaceId: string; contextId: string; pending: boolean; result?: ResumeResult } | null>(null)
  const resumeInFlight = useRef(false)
  const resourceInFlight = useRef(new Map<string, Promise<OpenResult>>())
  const [undoAction, setUndoAction] = useState<{ label: string; restore: () => void; open?: () => void } | null>(null)
  const { state, commit } = usePersistentState(setToast)
  const news = useNews(state, commit)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceTone, setNewSpaceTone] = useState<SpaceTone>('sage')
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkSpaceId, setLinkSpaceId] = useState('')
  const [captureDefaultWhen, setCaptureDefaultWhen] = useState('')
  const [captureTimed, setCaptureTimed] = useState(false)
  const [autostart, setAutostart] = useState(false)
  const [weather, setWeather] = useState<UfaWeather | null>(cachedUfaWeather)
  const [newCalendarName, setNewCalendarName] = useState('')
  const [newCalendarUrl, setNewCalendarUrl] = useState('')
  const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false)
  const isWorkstageOpen = route.type === 'browse'
  useLayoutEffect(() => {
    const viewport = contentViewport.current
    if (!viewport || isWorkstageOpen) return
    const measure = () => {
      const width = viewport.clientWidth, height = viewport.clientHeight
      setHubBounds(previous => previous.width === width && previous.height === height ? previous : { width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [Boolean(state), isWorkstageOpen])
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantDraft, setAssistantDraft] = useState('')
  const [assistantContexts, setAssistantContexts] = useState<AIContext[]>([])
  const [assistantPreferences, setAssistantPreferences] = useState(defaultAssistantPreferences)
  useEffect(() => { const role = state?.aiConfiguration?.role; if (role) setAssistantPreferences(previous => previous.role === role ? previous : { ...previous, role }) }, [state?.aiConfiguration?.role])
  const [omniboxUrl, setOmniboxUrl] = useState('')
  const [passwordOffer, setPasswordOffer] = useState<{ origin: string; username: string; password: string; title?: string } | null>(null)
  const targetWorkstageSpace = state?.spaces.find(space => space.id === (workstageSpaceId || state.activeSpaceId)) || state?.spaces[0]
  const session = targetWorkstageSpace ? contextSession(targetWorkstageSpace) : emptySession()
  const tabs = session.tabs
  const activeTabId = tabs.some(tab => tab.id === session.activeTabId) ? session.activeTabId : tabs[0]?.id || ''
  const splitTabId = tabs.some(tab => tab.id === session.splitTabId) ? session.splitTabId || null : null
  const activeTab = tabs.find(tab => tab.id === activeTabId)

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
    const observer = new MutationObserver(() => bridge.browser!.block(Boolean(document.querySelector('[role="dialog"], [role="menu"], [data-browser-drag-layer], [data-workspace-transition]'))).catch(() => undefined))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return bridge.browser?.onEvent(event => {
      if (event.type === 'cover' && /^data:image\/png;base64,/i.test(event.image)) {
        setTabCovers(previous => Object.fromEntries([...Object.entries(previous).filter(([id]) => id !== event.tabId), [event.tabId, event.image]].slice(-40)))
      }
      else if (event.type === 'update') commit(previous => {
        let updatedTab: BrowserTab | undefined
        const nextSpaces = previous.spaces.map(space => {
          if (!space.activeSession?.tabs.some(tab => tab.id === event.tabId)) return space
          const value = normalizeSpace(space)
          const source = value.activeSession?.tabs.find(tab => tab.id === event.tabId)
          const visibleNavigation = isWorkstageOpen && value.id === targetWorkstageSpace?.id && [activeTabId, splitTabId].includes(event.tabId) && Boolean(event.updates.url && event.updates.url !== source?.url)
          if (source) {
            updatedTab = { ...source, ...event.updates }
            return updateContextSession(value, session => ({ ...session, tabs: session.tabs.map(tab => tab.id === event.tabId ? { ...tab, ...event.updates, id: tab.id, contextId: tab.contextId } : tab) }), new Date().toISOString(), source.contextId, visibleNavigation)
          }
          return space
        })
        const effectiveUrl = updatedTab?.url || event.updates.url
        const effectiveTitle = updatedTab?.title || event.updates.title
        const effectiveFavicon = updatedTab?.favicon || event.updates.favicon
        const nextHistory = (effectiveUrl && isValidHistoryUrl(effectiveUrl))
          ? recordHistory(previous.history, { url: effectiveUrl, title: effectiveTitle, favicon: effectiveFavicon, spaceId: event.spaceId })
          : previous.history
        return { ...previous, spaces: nextSpaces, history: nextHistory }
      })
      else if (event.type === 'new-tab') commit(previous => ({ ...previous, spaces: previous.spaces.map(space => {
        if (!space.activeSession?.tabs.some(tab => tab.id === event.parentTabId)) return space
        const value = normalizeSpace(space)
        const parent = value.activeSession?.tabs.find(item => item.id === event.parentTabId)
        if (!parent) return space
        const tab: BrowserTab = { id: crypto.randomUUID(), url: event.url, title: event.url, parentTabId: event.parentTabId, branchId: parent.branchId }
        return updateContextSession(value, session => ({ ...session, tabs: [...session.tabs, tab], activeTabId: event.background ? session.activeTabId : tab.id }), new Date().toISOString(), parent.contextId, !event.background)
      }) }))
      else if (event.type === 'shortcut') handleShortcut(event.key, event.shift, event.alt)
      else if (event.type === 'password-offer') {
        setPasswordOffer({
          origin: event.origin,
          username: event.username,
          password: event.password,
          title: event.title
        })
      }
    })
  }, [state, activeTabId, splitTabId, isWorkstageOpen])

  useEffect(() => {
    zenTimer.setOnComplete(() => setToast('Сессия фокуса завершена.'))
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
    if (isWorkstageOpen) {
      const activeTab = tabs.find(t => t.id === activeTabId)
      setOmniboxUrl(activeTab?.url || '')
    } else {
      setOmniboxUrl('')
    }
  }, [isWorkstageOpen, activeTabId, workstageSpaceId, tabs.find(tab => tab.id === activeTabId)?.url])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null)
      }
      if (event.ctrlKey && event.altKey && event.code === 'Space') {
        event.preventDefault()
        openCapture()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') { event.preventDefault(); setModal(prev => prev === 'history' ? null : 'history') }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setModal('search') }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') { event.preventDefault(); openTabsOverview() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        focusAddress()
      }
      if ((event.ctrlKey || event.metaKey) && ['d', 't', 'w', 'tab', 'h'].includes(event.key.toLowerCase())) { event.preventDefault(); handleShortcut(event.key.toLowerCase(), event.shiftKey, event.altKey) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTabId, tabs, isWorkstageOpen])

  function handleShortcut(key: string, shift = false, alt = false) {
    if (key === 'h') setModal(prev => prev === 'history' ? null : 'history')
    if (key === 'a' && shift) openTabsOverview()
    if (key === 'k') setModal('search')
    if (key === 'l') focusAddress()
    if (key === 'd' && isWorkstageOpen && activeTab?.url) {
      const favorite = document.querySelector<HTMLButtonElement>('.browser-favorite-page')
      if (favorite) favorite.click(); else requestSaveTab(activeTab)
    }
    if (alt && key === ' ') openCapture()
    if (key === 't') {
      if (shift) { const closed = session.closedTabs?.[0]; if (closed && targetWorkstageSpace) { commit(previous => selectBrowserTab(restoreBrowserTab(previous, targetWorkstageSpace.id, closed), targetWorkstageSpace.id, closed.id)); setRoute({ type: 'browse', spaceId: targetWorkstageSpace.id }) } }
      else handleAddTab()
    }
    if (document.querySelector('[role="dialog"]') && ['w', 'tab'].includes(key)) return
    if (key === 'w' && isWorkstageOpen) handleCloseTab(activeTabId)
    if (key === 'tab' && tabs.length) { const list = orderedTabs(tabs), index = list.findIndex(item => item.id === activeTabId); const next = list[(index + (shift ? -1 : 1) + list.length) % list.length]; updateSession(previous => ({ ...previous, activeTabId: next.id, splitTabId: previous.splitTabId === next.id ? previous.activeTabId : previous.splitTabId })) }
  }

  function openTabsOverview(scope: 'space' | 'all' = isWorkstageOpen || currentSpace ? 'space' : 'all') {
    if (document.querySelector('[role="dialog"]:not(.tab-desk-dialog)')) return
    if (tabsOverviewOpen) {
      document.querySelector<HTMLButtonElement>('.tab-desk-dialog [aria-haspopup="menu"][aria-expanded="true"]')?.click()
      document.querySelector<HTMLInputElement>('.tab-desk-search input')?.focus()
      return
    }
    setTabsOverviewScope(scope)
    setTabsOverviewOpen(true)
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
        ? updateContextSession(space, updater)
        : space)
    }))
  }

  function openWorkstage(spaceId?: string, artifactId?: string, contextId?: string) {
    const selected = state?.spaces.find(space => space.id === spaceId) || targetWorkstageSpace
    if (!selected) { setToast('Сначала создайте пространство.'); return }
    const returning = state?.reminders.filter(item => !item.done && item.trigger?.kind === 'return' && item.trigger.spaceId === selected.id) || []
    if (returning.length) commit(previous => ({ ...previous, reminders: previous.reminders.map(item => returning.some(value => value.id === item.id) ? { ...item, dueAt: new Date().toISOString(), trigger: undefined, notifiedAt: undefined } : item) }))
    const artifact = selected.researchArtifacts?.find(item => item.id === artifactId)
    const researchTab: BrowserTab | undefined = artifact ? { id: crypto.randomUUID(), title: artifact.query, url: `research://${artifact.id}` } : undefined
    commit(previous => ({ ...previous, activeSpaceId: selected.id, spaces: previous.spaces.map(space => {
      if (space.id !== selected.id) return space
      const contextSpace = activateContext(space, contextId || currentContext(space).id)
      return updateContextSession(contextSpace, previousSession => {
        if (!researchTab) return previousSession
        const existing = previousSession.tabs.find(tab => tab.url === researchTab.url)
        return { ...previousSession, tabs: existing ? previousSession.tabs : [...previousSession.tabs, researchTab], activeTabId: existing?.id || researchTab.id }
      })
    }) }))
    setRoute({ type: 'browse', spaceId: selected.id })
  }

  const currentSpace = state?.spaces.find(space => space.id === viewSpaceId) || null
  const currentSpaceCheckpoint = currentSpace ? currentContext(currentSpace).checkpoint : undefined
  const visibleSpaceCheckpoint = currentSpaceCheckpoint && (!isCabinetPreview || currentSpaceCheckpoint.nextStep || currentSpaceCheckpoint.note) ? currentSpaceCheckpoint : undefined
  async function createEmptyCabinet(presentation: 'dashboard' | 'browser' = 'browser') {
    if (!state) return
    const id = crypto.randomUUID(), tabId = crypto.randomUUID()
    const previousId = isWorkstageOpen ? targetWorkstageSpace?.id : currentSpace?.id
    const saved = await commit(previous => {
      const previousSpace = previous.spaces.find(space => space.id === previousId)
      const saved = previousSpace && hasCabinetWork(previousSpace) ? saveCheckpoint(previous, previousSpace.id) : previous
      return newCabinet(saved, id, tabId, tones[previous.spaces.filter(space => space.kind !== 'web').length % tones.length])
    })
    if (!saved) return
    setSpacePanelOpen(false); setBrowserDayOpen(false); setModal(null)
    setResourcePage(0)
    setRoute({ type: presentation === 'browser' ? 'browse' : 'space', spaceId: id })
  }

  function toggleSpacePin(space: Space) {
    commit(previous => ({ ...previous, spaces: previous.spaces.map(item => item.id === space.id ? { ...item, pinned: !item.pinned } : item) }))
  }

  function renameCabinet(space: Space) {
    setSpaceActionId(space.id); setNewSpaceName(space.name); setModal('renameSpace')
  }

  function openSplitSpace() {
    setSplitTabIds(activeTab ? [activeTab.id] : [])
    setModal('splitSpace')
  }

  async function splitCabinet() {
    if (!state || !targetWorkstageSpace || !splitTabIds.length) return
    const id = crypto.randomUUID(), sourceId = targetWorkstageSpace.id
    const moved = [...splitTabIds]
    const saved = await commit(previous => cabinetFromTabs(previous, sourceId, moved, id, tones[previous.spaces.length % tones.length]))
    if (!saved) return
    setModal(null); setSpacePanelOpen(false); setRoute({ type: 'browse', spaceId: id })
    setUndoAction({ label: 'Вкладки перенесены в новое пространство', restore: () => {
      commit(previous => {
        let restored = previous
        for (const tabId of moved) restored = moveBrowserTab(restored, id, tabId, sourceId)
        return { ...restored, activeSpaceId: sourceId }
      })
      setRoute({ type: 'browse', spaceId: sourceId })
    } })
  }

  function addDocumentReference(spaceId?: string) {
    if (isDesktop) { void addPicked('file', spaceId); return }
    if (!isCabinetPreview) { void addPicked('file', spaceId); return }
    setSpaceActionId(spaceId || targetWorkstageSpace?.id || currentSpace?.id || '')
    setDocumentName(''); setDocumentTarget(''); setModal('documentReference')
  }

  async function saveDocumentReference() {
    const target = documentTarget.trim()
    if (!target || !spaceActionId) return
    if (!/^(?:[a-z]:[\\/]|\\\\|\/)/i.test(target)) { setToast('Укажите полный путь к документу. Сайты и Figma добавляются как ссылки.'); return }
    const resource: Resource = { id: crypto.randomUUID(), kind: 'file', target, name: documentName.trim() || shortName(target, 'file'), createdAt: new Date().toISOString() }
    const saved = await commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id !== spaceActionId || space.resources.some(item => item.kind === 'file' && documentPathKey(item.target) === documentPathKey(target)) ? space
      : suggestInitialName({ ...space, resources: [...space.resources, resource] })) }))
    if (saved) { setModal(null); setToast('Ссылка на документ сохранена в пространстве') }
  }

  async function copyToCabinet(resource: Resource, destinationId: string) {
    const destination = state?.spaces.find(space => space.id === destinationId)
    if (!destination || destination.resources.some(item => item.kind === resource.kind && (resource.kind === 'file' ? documentPathKey(item.target) === documentPathKey(resource.target) : item.target === resource.target))) {
      setToast('Материал уже доступен в этом пространстве'); return
    }
    const id = crypto.randomUUID()
    const saved = await commit(previous => copyMaterial(previous, resource, destinationId, id))
    if (saved) setUndoAction({ label: 'Материал добавлен в другое пространство', restore: () => commit(previous => ({ ...previous,
      spaces: previous.spaces.map(space => space.id !== destinationId ? space : { ...space, resources: space.resources.filter(item => item.id !== id) }) })) })
  }

  function reorderSpace(id: string, targetId: string, after = false, pin = false) {
    commit(previous => reorderCabinets(previous, id, targetId, after, pin))
  }

  function spaceActions(space: Space): MenuAction[] {
    const spaces = state?.spaces.filter(item => !item.archivedAt && item.kind !== 'web') || []
    const index = spaces.findIndex(item => item.id === space.id)
    return [
      { label: space.pinned ? 'Открепить из меню' : 'Закрепить в меню', icon: <Pin size={16} />, onSelect: () => toggleSpacePin(space) },
      { label: 'Переименовать', icon: <Pencil size={16} />, onSelect: () => renameCabinet(space) },
      ...(index > 0 ? [{ label: 'Передвинуть раньше', icon: <ChevronLeft size={16} />, onSelect: () => reorderSpace(space.id, spaces[index - 1].id) }] : []),
      ...(index >= 0 && index < spaces.length - 1 ? [{ label: 'Передвинуть дальше', icon: <ChevronRight size={16} />, onSelect: () => reorderSpace(space.id, spaces[index + 1].id, true) }] : []),
      { label: 'В архив', icon: <Archive size={16} />, onSelect: () => archiveSpace(space) },
      { label: 'Удалить пространство', icon: <Trash2 size={16} />, onSelect: () => { setSpaceActionId(space.id); setModal('deleteSpace') } }
    ]
  }

  function startCabinetDrag(event: DragEvent<HTMLElement>, value: CabinetDrag) {
    if (pointerCabinet.isPending()) { event.preventDefault(); return }
    event.stopPropagation(); writeCabinetDrag(event, value); cabinetDragRef.current = value; setCabinetDrag(value)
  }
  function finishCabinetDrag() { cabinetDragRef.current = null; setCabinetDrag(null); setCabinetDrop(null); setCabinetTabDrop('') }

  function spaceInteractions(space: Space, pin = false): HTMLAttributes<HTMLElement> {
    if (!isCabinetPreview) return {}
    return {
      draggable: true,
      onPointerDown: event => pointerCabinet.start(event, { kind: 'space', spaceId: space.id, id: space.id }),
      onContextMenu: event => spaceContext.open(event, `Действия с пространством «${space.name}»`, spaceActions(space)),
      onKeyDown: event => spaceContext.open(event, `Действия с пространством «${space.name}»`, spaceActions(space)),
      onDragStart: event => startCabinetDrag(event, { kind: 'space', spaceId: space.id, id: space.id }),
      onDragEnd: finishCabinetDrag,
      onDragOver: event => {
        const dragging = cabinetDragRef.current
        if (!dragging || dragging.spaceId === space.id) return
        event.preventDefault(); event.dataTransfer.dropEffect = dragging.kind === 'resource' ? 'copy' : 'move'
        const bounds = event.currentTarget.getBoundingClientRect(), after = event.clientX > bounds.left + bounds.width / 2
        setCabinetDrop(previous => previous?.id === space.id && previous.after === after && previous.pin === pin ? previous : { id: space.id, after, pin })
      },
      onDragLeave: event => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setCabinetDrop(previous => previous?.id === space.id ? null : previous) },
      onDrop: event => {
        const value = readCabinetDrag(event)
        if (!value || value.spaceId === space.id) return
        event.preventDefault(); event.stopPropagation()
        const source = state?.spaces.find(item => item.id === value.spaceId && !item.archivedAt)
        if (source && value.kind === 'space' && value.id === source.id) {
          const bounds = event.currentTarget.getBoundingClientRect()
          reorderSpace(source.id, space.id, event.clientX > bounds.left + bounds.width / 2, pin)
        } else if (source && value.kind === 'tab') moveTab(source.id, value.id, space.id)
        else if (source && value.kind === 'resource') {
          const resource = source.resources.find(item => item.id === value.id)
          if (resource) void copyToCabinet(resource, space.id)
        }
        finishCabinetDrag()
      }
    }
  }

  async function deleteCabinet(spaceId: string) {
    const space = state?.spaces.find(item => item.id === spaceId)
    if (!space) return
    const reminders = state!.reminders.filter(item => item.spaceId === spaceId).map(item => item.id)
    const events = state!.events?.filter(item => item.spaceId === spaceId).map(item => item.id) || []
    const bookmarkDestination = state!.lastBookmarkDestination?.spaceId === spaceId ? state!.lastBookmarkDestination : undefined
    const saved = await commit(previous => ({ ...previous, spaces: previous.spaces.filter(item => item.id !== spaceId),
      activeSpaceId: previous.activeSpaceId === spaceId ? undefined : previous.activeSpaceId,
      lastBookmarkDestination: previous.lastBookmarkDestination?.spaceId === spaceId ? undefined : previous.lastBookmarkDestination,
      reminders: previous.reminders.map(item => item.spaceId === spaceId ? { ...item, spaceId: undefined } : item),
      events: previous.events?.map(item => item.spaceId === spaceId ? { ...item, spaceId: undefined } : item) }))
    if (!saved) return
    setModal(null); setRoute({ type: 'spaces' })
    setUndoAction({ label: 'Пространство удалено', restore: () => commit(previous => ({ ...previous,
      spaces: previous.spaces.some(item => item.id === space.id) ? previous.spaces : [...previous.spaces, space],
      lastBookmarkDestination: previous.lastBookmarkDestination || bookmarkDestination,
      reminders: previous.reminders.map(item => reminders.includes(item.id) && !item.spaceId ? { ...item, spaceId } : item),
      events: previous.events?.map(item => events.includes(item.id) && !item.spaceId ? { ...item, spaceId } : item) })) })
  }
  function openCapture() {
    if (document.querySelector('.dock-entry-anchor')) {
      setModal(null)
      window.dispatchEvent(new Event('dom:quick-entry'))
      return
    }
    setCaptureDefaultWhen('')
    setCaptureTimed(false)
    setModal('capture')
  }

  function planCapture(offset: number) {
    setCaptureDefaultWhen(toLocalInput(planTime(offset).toISOString()))
    setCaptureTimed(false)
    setModal('capture')
  }

  function captureAt(date: Date, timed: boolean) {
    setCaptureDefaultWhen(toLocalInput(date.toISOString()))
    setCaptureTimed(timed)
    setModal('capture')
  }

  async function saveCapture(title: string, dueAt: string | null, plannedDate: string | null = null, kind: 'note' | 'task' = plannedDate || dueAt ? 'task' : 'note') {
    const reminder: Reminder = { id: crypto.randomUUID(), title, createdAt: new Date().toISOString(), dueAt, plannedDate, kind, done: false, spaceId: isWorkstageOpen ? targetWorkstageSpace?.id : undefined }
    const saved = await commit(previous => ({ ...previous, reminders: [reminder, ...previous.reminders] }))
    if (saved !== true) return false
    setModal(null)
    setToast(dueAt ? `Напоминание: ${formatDue(dueAt).toLowerCase()}` : 'Сохранено')
    return true
  }
  function createSpace() {
    const name = newSpaceName.trim()
    if (!name) { setToast('Дайте пространству имя.'); return }
    const renameTarget = isCabinetPreview ? state?.spaces.find(space => space.id === spaceActionId) || currentSpace : currentSpace
    if (modal === 'renameSpace' && renameTarget) {
      commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === renameTarget.id ? { ...space, name, ...(isCabinetPreview ? { nameOrigin: 'manual' as const } : {}) } : space) }))
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
    if (isCabinetPreview) { void createEmptyCabinet('dashboard'); return }
    setNewSpaceName('')
    setNewSpaceTone(tones[(state?.spaces.length || 0) % tones.length])
    setModal('newSpace')
  }

  async function addPicked(kind: 'app' | 'file', spaceId?: string) {
    if (!state) return
    const targetSpace = spaceId || viewSpaceId || targetWorkstageSpace?.id
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
    await commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === targetSpace ? { ...space, resources: [...space.resources, resource] } : space) }))
    setToast(kind === 'app' ? 'Приложение добавлено' : 'Документ сохранён в материалы пространства')
    return resource
  }

  function startLink(spaceId?: string) {
    const targetSpace = spaceId || viewSpaceId || targetWorkstageSpace?.id
    if (!targetSpace) { setToast('Сначала создайте пространство.'); return }
    setLinkSpaceId(targetSpace)
    setLinkName('')
    setLinkUrl('')
    setModal('newLink')
  }

  function editContext(spaceId: string, contextId?: string, isNew = false) {
    const space = state?.spaces.find(item => item.id === spaceId)
    if (!space) return
    const context = normalizeSpace(space).workContexts!.find(item => item.id === contextId) || currentContext(space)
    setContextEditor({ spaceId, contextId: isNew ? crypto.randomUUID() : context.id, isNew })
    setContextName(isNew ? '' : isCabinetPreview ? space.name : context.title)
    setContextNote(isNew ? '' : context.checkpoint?.note || '')
    setContextNextStep(isNew ? '' : context.checkpoint?.nextStep || '')
    setContextDocumentIds(isNew ? [] : contextDocuments(space, context).map(item => item.id))
    setModal('context')
  }

  async function saveContext() {
    if (!contextEditor || (contextEditor.isNew && !contextName.trim())) return
    const { spaceId, contextId, isNew } = contextEditor
    const saved = await commit(previous => {
      let next = { ...previous, spaces: previous.spaces.map(original => {
        if (original.id !== spaceId) return original
        const space = isNew ? createContext(original, contextId, contextName) : normalizeSpace(original)
        return { ...space, ...(isCabinetPreview ? { name: contextName.trim() || space.name, nameOrigin: contextName.trim() && contextName.trim() !== space.name ? 'manual' as const : space.nameOrigin } : {}), workContexts: space.workContexts!.map(context => context.id === contextId ? {
          ...context, title: isCabinetPreview ? '' : contextName.trim(), documentIds: contextDocumentIds,
          excludedDocumentIds: [...new Set([...(context.excludedDocumentIds || []), ...context.documentIds.filter(id => !contextDocumentIds.includes(id))])].filter(id => !contextDocumentIds.includes(id)),
          lastActiveAt: contextDocumentIds.length ? new Date().toISOString() : context.lastActiveAt
        } : context) }
      }) }
      const context = next.spaces.find(item => item.id === spaceId)?.workContexts?.find(item => item.id === contextId)
      if (contextNote.trim() || contextNextStep.trim() || context?.checkpoint) next = saveCheckpoint(next, spaceId, { contextId, note: contextNote.trim(), nextStep: contextNextStep.trim() })
      return next
    })
    if (!saved) return
    setModal(null)
    if (isNew) openWorkstage(spaceId, undefined, contextId)
  }

  function completeContext(spaceId: string, contextId: string) {
    if (isCabinetPreview) { const space = state?.spaces.find(item => item.id === spaceId); if (space) archiveSpace(space); return }
    const original = state?.spaces.find(item => item.id === spaceId)
    const context = original && normalizeSpace(original).workContexts!.find(item => item.id === contextId)
    if (!context || resumeInFlight.current) return
    commit(previous => ({ ...previous, spaces: previous.spaces.map(original => {
      if (original.id !== spaceId) return original
      const space = normalizeSpace(original)
      return { ...space, workContexts: space.workContexts!.map(item => item.id === contextId ? { ...item, completedAt: new Date().toISOString() } : item) }
    }) }))
    setUndoAction({ label: 'Дело завершено', restore: () => commit(previous => ({ ...previous, spaces: previous.spaces.map(original => {
      if (original.id !== spaceId) return original
      const space = normalizeSpace(original)
      return { ...space, workContexts: space.workContexts!.map(item => item.id === contextId ? { ...item, completedAt: context.completedAt } : item) }
    }) })) })
  }

  async function resumeContext(spaceId: string, contextId: string, retry = false) {
    if (resumeInFlight.current) return
    const original = state?.spaces.find(item => item.id === spaceId && !item.archivedAt)
    if (!original) return
    const space = normalizeSpace(original)
    const context = space.workContexts!.find(item => item.id === contextId)
    if (!context) return
    resumeInFlight.current = true
    const successfulIds = retry && resumeStatus?.contextId === contextId ? resumeStatus.result?.successfulIds || [] : []
    setResumeStatus({ spaceId, contextId, pending: true })
    try {
      const result: ResumeResult = isCabinetPreview ? { successfulIds: [], failures: [] }
        : await resumeDocuments(contextDocuments(space, context), document => openResource(document, contextId), successfulIds)
      setResumeStatus({ spaceId, contextId, pending: false, result })
      const hasTabs = contextSession(space, contextId).tabs.some(tab => tab.url)
      commit(previous => ({ ...previous, activeSpaceId: spaceId, spaces: previous.spaces.map(item => item.id === spaceId ? activateContext(item, contextId) : item) }))
      if (isCabinetPreview) { openSpace(spaceId) }
      else if (hasTabs) openWorkstage(spaceId, undefined, contextId)
      else if (!contextDocuments(space, context).length) openSpace(spaceId)
      setToast(isCabinetPreview ? 'Пространство открыто.' : result.failures.length ? `Не удалось открыть документов: ${result.failures.length}. ${hasTabs ? 'Группа вкладок открыта.' : 'Остальные документы переданы в программы.'}` : hasTabs ? 'Открыто продолжение дела.' : contextDocuments(space, context).length ? 'Документы переданы в программы по умолчанию.' : 'Открыто пространство дела.')
    } finally { resumeInFlight.current = false }
  }

  function selectExistingTab(spaceId: string, tabId: string) {
    const owner = state?.spaces.find(item => item.id === spaceId)
    if (!owner) return
    const tab = normalizeSpace(owner).activeSession?.tabs.find(item => item.id === tabId)
    if (!tab) return
    commit(previous => selectBrowserTab(previous, spaceId, tabId))
    setRoute({ type: 'browse', spaceId })
  }

  function addLink() {
    try {
      const url = new URL(linkUrl.trim())
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error()
      const resource: Resource = {
        id: crypto.randomUUID(), kind: 'link', name: linkName.trim() || url.hostname.replace(/^www\./, ''),
        target: url.toString(), createdAt: new Date().toISOString()
      }
      commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === linkSpaceId ? isCabinetPreview ? suggestInitialName({ ...space, resources: [...space.resources, resource] }) : { ...space, resources: [...space.resources, resource] } : space) }))
      setModal(null)
      setToast('Ссылка добавлена.')
    } catch { setToast('Некорректный адрес сайта') }
  }

  async function openResource(resource: Resource, contextId?: string): Promise<OpenResult> {
    if (resource.kind === 'link' && /^https?:\/\//i.test(resource.target)) {
      const space = state?.spaces.find(item => item.resources.some(value => value.id === resource.id)) || targetWorkstageSpace
      if (!space) return { ok: false, error: 'Пространство не найдено.' }
      const id = contextId || currentContext(space).id
      const tab: BrowserTab = { id: crypto.randomUUID(), title: resource.name, url: resource.target }
      commit(previous => ({ ...previous, activeSpaceId: space.id, spaces: previous.spaces.map(item => {
        if (item.id !== space.id) return item
        const value = activateContext(item, id)
        return updateContextSession({ ...value, resources: value.resources.map(value => value.id === resource.id ? { ...value, lastOpenedAt: new Date().toISOString() } : value) }, session => {
          const existing = session.tabs.find(item => item.url === resource.target)
          return { ...session, tabs: existing ? session.tabs : [...session.tabs, tab], activeTabId: existing?.id || tab.id }
        })
      }) }))
      setRoute({ type: 'browse', spaceId: space.id })
      return { ok: true }
    }
    const owner = state?.spaces.find(space => space.resources.some(item => item.id === resource.id))
    const id = contextId || (owner ? currentContext(owner).id : undefined)
    const resourceKey = documentPathKey(resource.target)
    let pending = resourceInFlight.current.get(resourceKey)
    if (!pending) {
      pending = bridge.openResource(resource).catch(error => ({ ok: false, error: error instanceof Error ? error.message : 'Не удалось открыть ресурс.' }))
      resourceInFlight.current.set(resourceKey, pending)
      void pending.finally(() => resourceInFlight.current.delete(resourceKey))
    }
    const result = await pending
    if (!result.ok) { setToast(result.error || 'Не удалось открыть ресурс.'); return result }
    commit(previous => ({ ...previous, activeSpaceId: resource.kind === 'file' && owner ? owner.id : previous.activeSpaceId, spaces: previous.spaces.map(space => space.id === owner?.id ? resource.kind === 'file'
      ? recordDocumentOpen(activateContext(space, id!), resource, id)
      : { ...space, resources: space.resources.map(item => item.id === resource.id ? { ...item, lastOpenedAt: new Date().toISOString() } : item) } : space) }))
    return result
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

  function focusAddress() {
    if (document.querySelector('[role="dialog"], [role="menu"]')) return
    const input = document.querySelector<HTMLInputElement>(isWorkstageOpen
      ? '.browser-omnibox-input'
      : '.omnibox-input')
    input?.focus()
    input?.select()
  }

  function handleOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      const val = omniboxUrl.trim()
      if (!val) return
      openAddress(val, undefined, isWorkstageOpen ? targetWorkstageSpace?.id : currentSpace?.id, !isWorkstageOpen)
      e.currentTarget.blur()
    }
  }

  function openAddress(address: string, title?: string, requestedSpaceId?: string, newPage = true, tabId?: string) {
    if (!state || !address.trim()) return
    let url: string
    try { url = addressToUrl(address) }
    catch { setToast('Не удалось распознать адрес.'); return }
    const webId = webSpaceId(state)
    const destinationId = requestedSpaceId || state.spaces.find(space => space.kind === 'web')?.id || webId
    const tab: BrowserTab = { id: crypto.randomUUID(), title: title || (url.startsWith('https://yandex.ru/search/') ? `Поиск: ${address}` : new URL(url).hostname), url }
    const now = new Date().toISOString()
    commit(previous => {
      const draft = requestedSpaceId ? previous : ensureWebSpace(previous, webId).state
      const nextHistory = isValidHistoryUrl(url)
        ? recordHistory(draft.history, { url, title: tab.title, spaceId: destinationId })
        : draft.history
      return { ...draft, activeSpaceId: destinationId, history: nextHistory,
        reminders: draft.reminders.map(item => !item.done && item.trigger?.kind === 'return' && item.trigger.spaceId === destinationId ? { ...item, dueAt: now, trigger: undefined, notifiedAt: undefined } : item),
        spaces: draft.spaces.map(space => space.id !== destinationId ? space : (isCabinetPreview ? suggestInitialName : (value: Space) => value)(updateContextSession(space, session => {
          const current = session.tabs.find(item => item.id === (tabId || session.activeTabId))
          const existing = title && newPage && current?.url ? session.tabs.find(item => item.url === url) : undefined
          if (existing) return { ...session, activeTabId: existing.id, splitTabId: session.splitTabId === existing.id ? session.activeTabId : session.splitTabId }
          if (current && (!newPage || !current.url)) return { ...session, tabs: session.tabs.map(item => item.id === current.id ? { ...item, title: tab.title, url, favicon: undefined, error: undefined } : item) }
          return { ...session, tabs: [...session.tabs, tab], activeTabId: tab.id }
        }, now))) }
    })
    setTabsOverviewOpen(false)
    setOmniboxUrl(url)
    setRoute({ type: 'browse', spaceId: destinationId })
  }

  function openWeb() {
    if (!state) return
    if (isCabinetPreview) {
      const last = state.spaces.find(space => space.id === state.activeSpaceId && !space.archivedAt && space.kind !== 'web')
        || state.spaces.find(space => !space.archivedAt && space.kind !== 'web')
      if (last) openWorkstage(last.id)
      else void createEmptyCabinet()
      return
    }
    const webId = webSpaceId(state)
    const tab: BrowserTab = { id: crypto.randomUUID(), title: 'Новая вкладка', url: '' }
    commit(previous => {
      const draft = ensureWebSpace(previous, webId).state
      return { ...draft, activeSpaceId: webId, spaces: draft.spaces.map(space => space.id !== webId || contextSession(space).tabs.length ? space
        : updateContextSession(space, session => ({ ...session, tabs: [tab], activeTabId: tab.id }))) }
    })
    setRoute({ type: 'browse', spaceId: webId })
  }

  function returnHome() {
    if (isCabinetPreview && isWorkstageOpen && targetWorkstageSpace && hasCabinetWork(targetWorkstageSpace)) commit(previous => saveCheckpoint(previous, targetWorkstageSpace.id))
    setRoute({ type: 'home' })
  }

  function returnToDashboard() {
    if (isCabinetPreview && isWorkstageOpen && targetWorkstageSpace && hasCabinetWork(targetWorkstageSpace)) commit(previous => saveCheckpoint(previous, targetWorkstageSpace.id))
    const destination = dashboardRoute.current
    if (destination.type === 'space' && !state?.spaces.some(space => space.id === destination.spaceId && !space.archivedAt && space.kind !== 'web')) {
      returnHome()
      return
    }
    if (destination.type === 'space') commit(previous => ({ ...previous, activeSpaceId: destination.spaceId }))
    setRoute(destination)
  }

  function openFocus(taskId?: string) {
    setFocusTaskId(taskId)
    setModal('focus')
  }

  async function handleCloseTab(tabId: string, spaceId = targetWorkstageSpace?.id) {
    if (!state || !spaceId) return
    const owner = state.spaces.find(space => space.id === spaceId)
    const tab = owner && tabEntries({ ...state, spaces: [owner] }).find(entry => entry.tab.id === tabId)?.tab
    if (!owner || !tab) return
    const index = orderedTabs(contextSession(owner, tab.contextId).tabs).findIndex(item => item.id === tabId)
    if (bridge.browser) {
      try { if (!await bridge.browser.close(tabId)) return }
      catch { setToast('Не удалось закрыть вкладку'); return }
    }
    commit(previous => removeBrowserTab(previous, spaceId, tabId))
    setUndoAction({ label: 'Вкладка закрыта', restore: () => {
      commit(previous => selectBrowserTab(restoreBrowserTab(previous, spaceId, { ...tab, closedIndex: index }), spaceId, tab.id))
      setRoute({ type: 'browse', spaceId })
      setTabsOverviewOpen(false)
    } })
  }

  async function parkSpace() {
    if (!targetWorkstageSpace) return
    commit(previous => saveCheckpoint(previous, targetWorkstageSpace.id))
    returnHome()
    await Promise.all(tabs.map(tab => bridge.browser?.hide(tab.id).catch(() => undefined)))
    setToast(isCabinetPreview ? 'Пространство сохранено. Можно вернуться позже.' : 'Дело сохранено. Вкладки остаются открытыми.')
  }

  function importTabs(groups: ImportGroup[]) {
    const spaces: Space[] = groups.map((group, index) => normalizeSpace({ id: crypto.randomUUID(), name: group.name, ...(isCabinetPreview ? { nameOrigin: 'manual' as const, pinned: false } : {}), tone: tones[index % tones.length], resources: [], lastActiveAt: new Date().toISOString(), activeSession: { tabs: group.tabs, activeTabId: group.tabs[0]?.id || '' } }))
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

  function handleAddTab(spaceId?: string) {
    if (!state) return
    if (document.querySelector('[role="dialog"]:not(.tab-desk-dialog)')) return
    const requestedSpaceId = spaceId || (isWorkstageOpen ? targetWorkstageSpace?.id : currentSpace?.id)
    const webId = webSpaceId(state)
    const destinationId = requestedSpaceId || webId
    const tab: BrowserTab = { id: crypto.randomUUID(), title: 'Новая вкладка', url: '' }
    commit(previous => {
      const draft = requestedSpaceId ? previous : ensureWebSpace(previous, webId).state
      return { ...draft, activeSpaceId: destinationId, spaces: draft.spaces.map(space => space.id !== destinationId ? space
        : updateContextSession(space, session => ({ ...session, tabs: [...session.tabs, tab], activeTabId: tab.id, splitTabId: null }))) }
    })
    setTabsOverviewOpen(false)
    setRoute({ type: 'browse', spaceId: destinationId })
  }

  function closeBrowserDay() {
    setBrowserDayOpen(false)
    setBrowserDayPinned(false)
    document.querySelector<HTMLButtonElement>('.browser-day-pulse')?.focus()
  }

  async function completeBrowserDayTask(id: string) {
    const task = state?.reminders.find(item => item.id === id)
    if (!task) return false
    const saved = await commit(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === id ? { ...item, done: true } : item) }))
    if (saved) setUndoAction({ label: 'Дело завершено', restore: () => commit(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === id ? { ...item, done: task.done } : item) })) })
    return saved === true
  }

  function reorderTab(spaceId: string, contextId: string, tabId: string, targetId: string, after: boolean) {
    commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id !== spaceId ? space : updateContextSession(space, session => ({ ...session, tabs: reorderBrowserTabs(session.tabs, tabId, targetId, after) }), undefined, contextId, false)) }))
  }

  async function moveTab(fromSpaceId: string, tabId: string, requestedSpaceId: string, newSpaceName?: string) {
    if (!state) return false
    const source = state.spaces.find(space => space.id === fromSpaceId)
    const entry = source && tabEntries({ ...state, spaces: [source] }).find(entry => entry.tab.id === tabId)
    if (!source || !entry || source.archivedAt) return false
    let toSpaceId = newSpaceName ? crypto.randomUUID() : requestedSpaceId === '@web' ? webSpaceId(state) : requestedSpaceId
    let sourceSession = contextSession(source, entry.contextId), sourceContextId = entry.contextId
    let index = sourceSession.tabs.findIndex(tab => tab.id === tabId)
    let targetSession: BrowserSession | undefined, targetContextId: string | undefined, created = false, moved = false, targetName = ''
    const saved = await commit(previous => {
      const owner = previous.spaces.find(space => space.id === fromSpaceId && !space.archivedAt)
      const current = owner && tabEntries({ ...previous, spaces: [owner] }).find(item => item.tab.id === tabId)
      if (!owner || !current) return previous
      sourceContextId = current.contextId; sourceSession = contextSession(owner, current.contextId); index = sourceSession.tabs.findIndex(tab => tab.id === tabId)
      const name = newSpaceName?.trim().slice(0, 80)
      const existing = name ? previous.spaces.find(space => !space.archivedAt && space.kind !== 'web' && space.name.trim().toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru')) : undefined
      if (existing) toSpaceId = existing.id
      if (toSpaceId === fromSpaceId) return previous
      const ready = requestedSpaceId === '@web' ? ensureWebSpace(previous, toSpaceId).state : previous
      const target = ready.spaces.find(space => space.id === toSpaceId && !space.archivedAt)
      if (target) { targetContextId = currentContext(target).id; targetSession = contextSession(target); targetName = target.kind === 'web' ? 'Браузинг' : target.name }
      const result = name && !existing ? createSpaceAndMoveTab(ready, fromSpaceId, tabId, toSpaceId, name, tones[previous.spaces.filter(space => space.kind !== 'web').length % tones.length])
        : moveBrowserTab(ready, fromSpaceId, tabId, toSpaceId)
      moved = result !== ready
      created = moved && Boolean(name && !existing)
      if (created) targetName = name!
      return result
    })
    if (!saved || !moved) return false
    bridge.browser?.move?.(tabId, toSpaceId).catch(() => undefined)
    setUndoAction({ label: `${created ? 'Создано пространство. ' : ''}Вкладка перенесена в «${targetName}»`, open: async () => {
      let available = false
      const selected = await commit(previous => { const next = selectBrowserTab(previous, toSpaceId, tabId); available = next !== previous; return next })
      if (selected && available) setRoute({ type: 'browse', spaceId: toSpaceId })
    }, restore: async () => {
      let returned = false
      const restored = await commit(previous => {
        const next = moveBrowserTab(previous, toSpaceId, tabId, fromSpaceId, sourceContextId, index)
        if (next === previous) return previous
        returned = true
        const spaces = next.spaces.map(space => {
          const snapshot = space.id === fromSpaceId ? sourceSession : space.id === toSpaceId ? targetSession : undefined
          const contextId = space.id === fromSpaceId ? sourceContextId : targetContextId
          if (!snapshot || !contextId) return space
          return updateContextSession(space, session => ({ ...session,
            activeTabId: session.tabs.some(tab => tab.id === snapshot.activeTabId) ? snapshot.activeTabId : session.activeTabId,
            splitTabId: session.tabs.some(tab => tab.id === snapshot.splitTabId && tab.id !== snapshot.activeTabId) ? snapshot.splitTabId : null
          }), undefined, contextId, false)
        }).filter(space => !(created && space.id === toSpaceId && space.name === targetName && !space.activeSession?.tabs.length && !space.resources.length
          && !space.checkpoint && !space.workContexts?.some(context => context.documentIds.length || context.checkpoint)
          && !previous.reminders.some(item => item.spaceId === toSpaceId) && !previous.events?.some(item => item.spaceId === toSpaceId)))
        return { ...next, activeSpaceId: next.activeSpaceId === toSpaceId && !spaces.some(space => space.id === toSpaceId) ? fromSpaceId : next.activeSpaceId, spaces }
      })
      if (restored && returned) {
        bridge.browser?.move?.(tabId, fromSpaceId).catch(() => undefined)
        if (routeRef.current.type === 'browse' && routeRef.current.spaceId === toSpaceId) setRoute({ type: 'browse', spaceId: fromSpaceId })
      }
    } })
    return true
  }

  function splitExistingTab(spaceId: string, tabId: string) {
    if (!state) return
    const owner = state.spaces.find(space => space.id === spaceId)
    const entry = owner && tabEntries({ ...state, spaces: [owner] }).find(entry => entry.tab.id === tabId)
    if (!owner || !entry) return
    commit(previous => ({ ...previous, activeSpaceId: spaceId, spaces: previous.spaces.map(space => space.id !== spaceId ? space : updateContextSession(activateContext(space, entry.contextId), session => {
      const other = session.tabs.find(tab => tab.id !== tabId)
      if (!other) return { ...session, activeTabId: tabId }
      return { ...session, activeTabId: session.activeTabId === tabId ? other.id : session.activeTabId || other.id, splitTabId: tabId }
    })) }))
    setRoute({ type: 'browse', spaceId })
    setTabsOverviewOpen(false)
  }

  function pinExistingTab(spaceId: string, tabId: string) {
    if (!state) return
    const entry = tabEntries(state).find(entry => entry.space.id === spaceId && entry.tab.id === tabId)
    if (!entry) return
    commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id !== spaceId ? space : updateContextSession(space, session => ({ ...session, tabs: session.tabs.map(tab => tab.id === tabId ? { ...tab, pinned: !tab.pinned } : tab) }), undefined, entry.contextId, false)) }))
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

  function requestSaveTab(tab: BrowserTab, spaceId = targetWorkstageSpace?.id) {
    if (!tab.url || document.querySelector('[role="dialog"]:not(.tab-desk-dialog)')) return
    setTabsOverviewOpen(false)
    setSavePage({ tab: { ...tab }, sourceSpaceId: spaceId })
  }

  async function saveBrowserPage(request: SavePageRequest) {
    if (!savePage) return false
    let label = '', alreadySaved = false
    const saved = await commit(previous => {
      const result = savePageToDestination(previous, savePage.tab, request)
      label = result.label; alreadySaved = result.alreadySaved
      return result.state
    })
    if (saved) setToast(`${alreadySaved ? 'Уже сохранено' : 'Сохранено'}: ${label}.`)
    return saved === true
  }

  async function saveFavorite(tab: BrowserTab, request: FavoritePageRequest) {
    let ownerId = '', before: Resource[] = [], newGroupId: string | undefined, label = 'Общее'
    const saved = await commit(previous => {
      before = favoriteResources(previous.spaces, tab.url)
      const groups = previous.spaces.find(space => space.kind === 'web' && !space.archivedAt)?.bookmarkGroups || []
      const result = savePageToDestination(previous, tab, { destination: { spaceId: BOOKMARKS, groupId: request.groupId }, name: tab.title || tab.url, newGroupName: request.newGroupName })
      const owner = result.state.spaces.find(space => space.kind === 'web' && !space.archivedAt)!
      ownerId = owner.id
      if (result.resource.bookmarkGroupId) {
        label = owner.bookmarkGroups!.find(group => group.id === result.resource.bookmarkGroupId)!.name
        if (!groups.some(group => group.id === result.resource.bookmarkGroupId)) newGroupId = result.resource.bookmarkGroupId
      }
      return result.state
    })
    if (saved) setUndoAction({ label: `Сохранено в избранное: ${label}`, restore: () => { void commit(previous => {
      const next = removeFavoritePage(previous, tab.url)
      return { ...next, spaces: next.spaces.map(space => space.id !== ownerId ? space : {
        ...space, resources: [...space.resources, ...before],
        bookmarkGroups: space.bookmarkGroups?.filter(group => group.id !== newGroupId || space.resources.some(resource => resource.bookmarkGroupId === group.id))
      }) }
    }) } })
    return saved === true
  }

  async function removeFavorite(tab: BrowserTab) {
    let before: Resource[] = [], ownerId = ''
    const saved = await commit(previous => {
      before = favoriteResources(previous.spaces, tab.url)
      ownerId = previous.spaces.find(space => space.kind === 'web' && !space.archivedAt)?.id || ''
      return removeFavoritePage(previous, tab.url)
    })
    if (saved && before.length) setUndoAction({ label: 'Ссылка удалена из избранного', restore: () => { void commit(previous => {
      const next = removeFavoritePage(previous, tab.url)
      return { ...next, spaces: next.spaces.map(space => space.id === ownerId ? { ...space, resources: [...space.resources, ...before] } : space) }
    }) } })
    return saved === true
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
    commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === spaceId ? updateContextSession({ ...space, resources: space.resources.map(item => item.id === resource.id ? { ...item, lastOpenedAt: openedAt } : item) }, session => ({ ...session, tabs: session.tabs.map(item => item.id === tab.id ? { ...item, lastAccessedAt: openedAt } : item) }), openedAt) : space) }))
  }

  if (!state) return <div className="loading-screen"><span className="brand-mark">✳</span><span>{toast || 'Загрузка…'}</span></div>

  const collectionColumns = hubBounds.width > 1000 ? 3 : hubBounds.width > 600 ? 2 : 1
  const resourceRows = !visibleSpaceCheckpoint && hubBounds.height >= 480 && hubBounds.width > 600 ? 2 : 1
  const resourcePageSize = collectionColumns * resourceRows
  const resourcePages = Math.max(1, Math.ceil((currentSpace?.resources.length || 0) / resourcePageSize))
  const visibleResourcePage = Math.min(resourcePage, resourcePages - 1)
  const sortedResources = recentMaterials(currentSpace?.resources || [])
  const browserDay = browserDayModel(state, time, browserFocus)
  const activeTopSpaceId = currentSpace?.id || targetWorkstageSpace?.id
  const availableTopSpaces = state.spaces.filter(space => !space.archivedAt && space.kind !== 'web')
  const visibleTopSpaces = isCabinetPreview ? availableTopSpaces.filter(space => space.pinned) : availableTopSpaces.slice(0, 3)
  if (activeTopSpaceId && !visibleTopSpaces.some(space => space.id === activeTopSpaceId)) {
    const activeSpace = availableTopSpaces.find(space => space.id === activeTopSpaceId)
    if (activeSpace) { if (isCabinetPreview) visibleTopSpaces.push(activeSpace); else visibleTopSpaces.splice(2, 1, activeSpace) }
  }
  return (
    <div
      ref={shellRef}
      className={`app-shell ${bridge.platform === "darwin" ? "platform-mac" : ""} ${isWorkstageOpen ? 'browsing' : ''} ${isDesktop ? 'desktop' : ''}`}
      style={{ '--app-bg': `url("${resolveWallpaperUrl(state?.backgroundImage || DEFAULT_WALLPAPER)}")` } as React.CSSProperties}
    >
      <div className="page-wrap">
        {!isWorkstageOpen && <div className="hub-ambient">
          <AmbientDate now={time} onOpenCalendar={() => { returnHome(); setCalendarRequested(true) }} />
          <AttentionIsland state={state} now={time} onChange={commit} onOpen={openResource} onSpace={openSpace} onFocus={openFocus} compact={isWorkstageOpen} />
          <div className="hub-status">
            <time dateTime={time.toLocaleTimeString('ru-RU', { hour12: false })} aria-label={`Время ${time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}>{time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>
            <AmbientWeather weather={weather} now={time} onOpenForecast={() => setModal('weather')} />
          </div>
        </div>}
        {isWorkstageOpen && targetWorkstageSpace ? <BrowserChrome
          space={targetWorkstageSpace} spaces={state.spaces} tab={activeTab} pulse={browserDay.pulse}
          dayOpen={browserDayOpen} nativeNavigation={Boolean(bridge.browser)}
          onHome={returnToDashboard} onSpace={id => openWorkstage(id)} onSpaceDashboard={() => isCabinetPreview ? (setBrowserDayOpen(false), setSpacePanelOpen(value => !value)) : openSpace(targetWorkstageSpace.id)} onWeb={openWeb} onAllSpaces={() => setRoute({ type: 'spaces' })}
          onNewSpace={() => void createEmptyCabinet('browser')} onPinSpace={() => toggleSpacePin(targetWorkstageSpace)} onRenameSpace={() => renameCabinet(targetWorkstageSpace)} onArchiveSpace={() => archiveSpace(targetWorkstageSpace)} materialsOpen={spacePanelOpen}
          onNavigate={address => openAddress(address, undefined, targetWorkstageSpace.id, false)}
          onNavigation={action => { void bridge.browser?.action(activeTabId, action).catch(() => setToast('Не удалось выполнить действие со страницей.')) }}
          onSave={() => { if (activeTab?.url) requestSaveTab(activeTab) }}
          pageActions={<PageActions spaceId={targetWorkstageSpace.id} spaces={state.spaces} tab={activeTab} onFavorite={saveFavorite} onRemoveFavorite={removeFavorite}
            onMove={(tabId, destination, name) => moveTab(targetWorkstageSpace.id, tabId, destination, name)} />}
          onDay={() => { setSpacePanelOpen(false); browserDayOpen ? closeBrowserDay() : setBrowserDayOpen(true) }}
          onCapture={openCapture} onAssistant={() => { setAssistantContexts([]); setAssistantOpen(true) }}
          profile={state?.userProfile}
          onProfile={anchor => { profileAnchorRef.current = anchor as HTMLButtonElement; setProfileOpen(prev => !prev) }}
          onSearch={() => setModal('search')} onHistory={() => setModal('history')} onSettings={() => openSettings()} onPark={parkSpace}
        /> : <header className="browser-chrome">
          <div className="chrome-main">
            <button className="brand" onClick={isWorkstageOpen ? returnToDashboard : returnHome} aria-label={isWorkstageOpen ? 'Вернуться в дашборд' : 'На главную dombro'}>
              <span className="brand-mark">✳</span><span>dombro<span className="brand-dot">.</span></span>
            </button>
            {isWorkstageOpen && targetWorkstageSpace && targetWorkstageSpace.kind !== 'web' && <button className="browser-space-chip" onClick={() => openSpace(targetWorkstageSpace.id)} aria-label={`Вернуться в пространство ${targetWorkstageSpace.name}`} title={targetWorkstageSpace.name}><Folder size={16} /><span>{targetWorkstageSpace.name}</span></button>}
            {!isWorkstageOpen && <div className="calm-omnibox">
              <Globe2 size={17} className="omnibox-icon" />
              <input type="text" className="omnibox-input" value={omniboxUrl}
                onChange={e => setOmniboxUrl(e.target.value)} onKeyDown={handleOmniboxKeyDown}
                placeholder="Поиск или адрес сайта" aria-label="Поиск или адрес сайта" />
              <kbd>Ctrl L</kbd>
            </div>}
            <div className="chrome-actions">
              <button className={`chrome-button chrome-browser ${isWorkstageOpen && targetWorkstageSpace?.kind === 'web' ? 'selected' : ''}`} onClick={openWeb} aria-label="Браузер" aria-pressed={isWorkstageOpen && targetWorkstageSpace?.kind === 'web'} title="Браузер"><Globe2 size={18} /><span>Браузер</span></button>
              <button className="chrome-button chrome-tab-desk" onClick={() => openTabsOverview()} title="Стол · Ctrl Shift A" aria-label="Обзор и поиск вкладок"><LayoutGrid size={18} /></button>
              <button className={`chrome-button chrome-assistant ${assistantOpen ? 'selected' : ''}`} onClick={() => { setAssistantContexts([]); setAssistantOpen(true) }} aria-label="ИИ в Доме" title={`ИИ · ${assistantRoles[assistantPreferences.role].label}`}><Sparkles size={19} strokeWidth={1.7} /></button>
              <button className="chrome-button" onClick={() => setModal('search')} title="Поиск в Доме · Ctrl K" aria-label="Поиск в Доме"><Search size={19} /></button>
              <button className="chrome-button" onClick={() => openSettings()} aria-label="Настройки"><Settings2 size={19} /></button>
              {(() => {
                const userProfile = getUserProfile(state)
                return (
                  <button
                    className={`chrome-button chrome-profile ${profileOpen ? 'selected' : ''}`}
                    ref={profileAnchorRef}
                    onClick={() => setProfileOpen(prev => !prev)}
                    aria-label={`Профиль: ${userProfile.name}`}
                    title={`Профиль: ${userProfile.name}`}
                  >
                    <span className={`profile-avatar-pill tone-${userProfile.avatarTone || 'sage'}`}>
                      {userProfile.avatarEmoji || (userProfile.name.trim().charAt(0).toUpperCase() || 'П')}
                    </span>
                  </button>
                )
              })()}
            </div>
          </div>
          {!isWorkstageOpen && <div className="chrome-secondary">
            <FluidGroup as="nav" className="chrome-spaces" aria-label="Пространства" itemSelector=":scope > .chrome-space">
              <button className={`chrome-space ${!isWorkstageOpen && !currentSpace && !showSpaces ? 'selected' : ''}`} onClick={returnHome}>Мой день</button>
              {visibleTopSpaces.map(space => <button {...spaceInteractions(space, true)} key={space.id} data-space-id={space.id} data-cabinet-space-target={isCabinetPreview || undefined}
                className={`chrome-space ${(isWorkstageOpen && space.id === targetWorkstageSpace?.id) || currentSpace?.id === space.id ? 'selected' : ''}${cabinetDrop?.id === space.id ? ' is-drop-target' : ''}`}
                onClick={() => openSpace(space.id)} title={`Продолжить: ${space.name}`}>{space.name}</button>)}
              <button className={`chrome-space ${showSpaces ? 'selected' : ''}`} onClick={() => setRoute({ type: 'spaces' })}>Все пространства</button>
              <button className="chrome-new-space" onClick={createStream} aria-label="Создать пространство" title="Создать пространство"><Plus size={17} /></button>
            </FluidGroup>
          </div>}
        </header>}

        <div className={isWorkstageOpen ? 'browser-content' : 'hub-content'} ref={contentViewport}>
        {!showSpaces && !currentSpace ? (
          !isWorkstageOpen ? (
            <Home
              viewportWidth={hubBounds.width}
              viewportHeight={hubBounds.height}
              calendarRequested={calendarRequested}
              onCalendarHandled={() => setCalendarRequested(false)}
              initialReminderId={searchReminderId}
              onSearchHandled={() => setSearchReminderId('')}
              state={state}
              now={time}
              onChange={commit}
              onCapture={openCapture}
              onFocus={openFocus}
              onPlan={planCapture}
              onCreateAt={captureAt}
              onSpace={openSpace}
              onOpen={openResource}
              onAddLink={() => startLink()}
              onOpenWorkstage={openWorkstage}
              onOpenContext={(spaceId, contextId) => openWorkstage(spaceId, undefined, contextId)}
              onEditContext={editContext}
              onCompleteContext={completeContext}
              onOpenDocument={openResource}
              onResume={resumeContext}
              resumeStatus={resumeStatus}
              onAssistant={(draft, contexts) => { setAssistantDraft(draft || ""); setAssistantContexts(contexts || []); setAssistantOpen(true) }}
              onSaveThought={saveCapture}
              onImport={() => setModal('import')}
              onNewTab={() => handleAddTab()}
              onSettings={() => setModal('settings')}
              onNewsRefresh={news.refresh}
              newsRefreshing={news.refreshing}
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
              onAddTab={() => handleAddTab(targetWorkstageSpace?.id)}
              onNavigate={(address, title, tabId) => openAddress(address, title, targetWorkstageSpace?.id, false, tabId)}
              onFocusAddress={focusAddress}
              onOverview={() => openTabsOverview()}
              sidePanel={isCabinetPreview && spacePanelOpen && targetWorkstageSpace!.kind !== 'web' ? <SpacePanel key={targetWorkstageSpace!.id}
                space={targetWorkstageSpace!} onClose={() => { setSpacePanelOpen(false); document.querySelector<HTMLButtonElement>('.browser-materials-toggle')?.focus() }}
                onOpen={openResource} onEdit={() => editContext(targetWorkstageSpace!.id)} onPin={() => toggleSpacePin(targetWorkstageSpace!)}
                onAddLink={() => startLink(targetWorkstageSpace!.id)} onAddDocument={() => addDocumentReference(targetWorkstageSpace!.id)}
                onRemove={removeResource} onCopy={copyToCabinet} destinations={availableTopSpaces.filter(space => space.id !== targetWorkstageSpace!.id)}
              /> : browserDayOpen ? <BrowserDayPanel
                state={state} model={browserDay} now={time} focus={browserFocus} pinned={browserDayPinned}
                onPin={() => setBrowserDayPinned(value => !value)} onClose={closeBrowserDay}
                onHome={returnHome} onCalendar={() => { returnHome(); setCalendarRequested(true) }}
                onFocus={() => openFocus()} onCapture={openCapture} onAssistant={() => { setAssistantContexts([]); setAssistantOpen(true) }}
                onOpen={openResource} onSpace={openSpace} onComplete={completeBrowserDayTask}
                onAddTask={title => saveCapture(title, null, localDate(time), 'task')}
              /> : undefined}
              onCloseSplit={() => updateSession(previous => ({ ...previous, splitTabId: null }))}
              onOpenSourceInSplit={handleOpenSourceInSplit}
              onGoHome={returnHome}
              onOpenTab={openBrowserTab}
              onSaveTab={tab => requestSaveTab(tab)}
              onUpdateTab={handleUpdateTab}
              onOpenResource={openResource}
              onAddLink={() => startLink(targetWorkstageSpace?.id)}
              onPark={parkSpace}
              onImport={() => setModal('import')}
              onBranch={openBranch}
              onSelectContext={contextId => openWorkstage(targetWorkstageSpace!.id, undefined, contextId)}
              onNewContext={() => isCabinetPreview ? openSplitSpace() : editContext(targetWorkstageSpace!.id, undefined, true)}
              onEditContext={() => editContext(targetWorkstageSpace!.id)}
              spaces={state.spaces.filter(space => !space.archivedAt)}
              onReorderTab={(tabId, targetId, after) => reorderTab(targetWorkstageSpace!.id, currentContext(targetWorkstageSpace!).id, tabId, targetId, after)}
              onMoveTab={(tabId, spaceId) => moveTab(targetWorkstageSpace!.id, tabId, spaceId)}
              onSplitTab={tabId => splitExistingTab(targetWorkstageSpace!.id, tabId)}
            />
          )
        ) : showSpaces && !currentSpace ? (
          <SpacesOverview spaces={availableTopSpaces} hasArchive={state.spaces.some(space => space.archivedAt)} onOpen={openSpace} onCreate={createStream} onArchive={() => setModal('archive')}
            onPin={toggleSpacePin} onRename={renameCabinet} onArchiveSpace={archiveSpace} onDelete={space => { setSpaceActionId(space.id); setModal('deleteSpace') }} interactions={spaceInteractions} actionsForSpace={isCabinetPreview ? spaceActions : undefined} dropSpaceId={cabinetDrop?.id} />
        ) : currentSpace && (
          <main className={`collection-stage space-detail tone-context-${currentSpace.tone}${isCabinetPreview ? ' cabinet-detail' : ''}`} aria-label={currentSpace.name}>
            <div className="collection-header">
              <div>
                <button className="back-button" onClick={() => setRoute({ type: 'spaces' })}><ChevronLeft size={18} /> Пространства</button>
                <div className="space-title-row" {...spaceInteractions(currentSpace)}>
                  <h1 title={currentSpace.name}>{currentSpace.name}</h1>
                  <button className="calm-icon" aria-label="Переименовать пространство" onClick={() => { if (isCabinetPreview) renameCabinet(currentSpace); else { setNewSpaceName(currentSpace.name); setModal('renameSpace') } }}><Pencil size={17} /></button>
                </div>
                {spaceContents(currentSpace) && <p className="space-detail-meta">{spaceContents(currentSpace)}</p>}
              </div>
              <div className="space-add-actions">
                <button className="space-open-tabs" data-workspace-navigation onClick={() => openWorkstage(currentSpace.id)}>
                  <Globe2 size={18} /> Открыть вкладки
                </button>
                <ActionMenu label="Добавить в пространство" triggerContent={<><Plus size={18} />Добавить<ChevronDown size={14} /></>} actions={[
                  { label: 'Сайт', icon: <Link2 size={17} />, onSelect: () => startLink(currentSpace.id) },
                  { label: 'Документ', icon: <FileText size={17} />, onSelect: () => addDocumentReference(currentSpace.id) },
                  { label: 'Приложение', icon: <AppWindow size={17} />, onSelect: () => addPicked('app', currentSpace.id) }
                ]} />
                <ActionMenu label="Действия с пространством" actions={[
                  ...(isCabinetPreview ? [
                    { label: 'Настроить продолжение пространства', icon: <Pencil size={17} />, onSelect: () => editContext(currentSpace.id) },
                    ...spaceActions(currentSpace)
                  ] : []),
                  { label: 'Что изменилось', icon: <History size={17} />, onSelect: () => setModal('changes') },
                  ...(!isCabinetPreview ? [{ label: 'В архив', icon: <Archive size={17} />, onSelect: () => archiveSpace(currentSpace) }] : [])
                ]} />
              </div>
            </div>
            {!isCabinetPreview && <nav className="space-contexts" aria-label="Текущее дело для открываемых документов"><span>Дело</span>{normalizeSpace(currentSpace).workContexts!.map(context => <button className="soft-button" key={context.id} aria-pressed={context.id === currentContext(currentSpace).id} title={`Открываемые документы добавятся в «${contextTitle(currentSpace, context)}»`} onClick={() => commit(previous => ({ ...previous, spaces: previous.spaces.map(space => space.id === currentSpace.id ? activateContext(space, context.id) : space) }))}><span>{contextTitle(currentSpace, context)}{context.completedAt ? ' · завершено' : ''}</span></button>)}<button className="calm-text-button" onClick={() => editContext(currentSpace.id, undefined, true)}><Plus size={15} />Новое дело</button><button className="calm-icon" title="Настроить продолжение текущего дела" aria-label="Настроить продолжение текущего дела" onClick={() => editContext(currentSpace.id)}><Pencil size={15} /></button></nav>}
            {visibleSpaceCheckpoint && <section className="space-continuation card">
              <div className="continuation-copy"><time className="continuation-kicker" dateTime={visibleSpaceCheckpoint.savedAt}>{new Date(visibleSpaceCheckpoint.savedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</time><h2>{visibleSpaceCheckpoint.nextStep || (isCabinetPreview ? 'Продолжить работу' : 'Продолжить дело')}</h2>{visibleSpaceCheckpoint.note && <p>{visibleSpaceCheckpoint.note}</p>}</div>
              {isCabinetPreview ? <button className="primary-button" onClick={() => editContext(currentSpace.id)}>Настроить <Pencil size={18} /></button> : <button className="primary-button" onClick={() => resumeContext(currentSpace.id, currentContext(currentSpace).id)}>Продолжить <ArrowRight size={18} /></button>}
              {Boolean(currentSpace.checkpointHistory?.length) && <details><summary><History size={15} />Предыдущие сохранения</summary>{currentSpace.checkpointHistory?.filter(point => (point.contextId || `${currentSpace.id}:context`) === currentContext(currentSpace).id).map(point => <p key={point.id}>{new Date(point.savedAt).toLocaleString('ru-RU')} · {point.nextStep || point.note || 'Вкладки сохранены'}</p>)}</details>}
            </section>}
            {isCabinetPreview ? <CabinetContents key={currentSpace.id} space={currentSpace} destinations={availableTopSpaces.filter(space => space.id !== currentSpace.id)} covers={tabCovers} drag={cabinetDrag}
              pointerTabTarget={cabinetTabDrop} onPointerStart={pointerCabinet.start}
              onSelectTab={id => selectExistingTab(currentSpace.id, id)} onCloseTab={id => handleCloseTab(id, currentSpace.id)} onSaveTab={tab => requestSaveTab(tab, currentSpace.id)}
              onMoveTab={(id, destination) => moveTab(currentSpace.id, id, destination)} onReorderTab={(id, target, after) => reorderTab(currentSpace.id, currentContext(currentSpace).id, id, target, after)}
              onOpen={resource => { void openResource(resource) }} onRemove={removeResource} onCopy={copyToCabinet} onAddDocument={() => addDocumentReference(currentSpace.id)} onAddLink={() => startLink(currentSpace.id)}
              onStartDrag={startCabinetDrag} onFinishDrag={finishCabinetDrag} /> : currentSpace.resources.length ? <><div className="resource-grid" style={{ '--resource-rows': resourceRows, gridTemplateColumns: `repeat(${collectionColumns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${resourceRows}, minmax(0, 1fr))` } as React.CSSProperties}>{sortedResources.slice(visibleResourcePage * resourcePageSize, visibleResourcePage * resourcePageSize + resourcePageSize).map(resource => <div className="resource-card card" key={resource.id}><button className="resource-open" onClick={() => openResource(resource)}><span className={`resource-kind kind-${resource.kind}`}>{resourceIcon(resource.kind, 25)}</span><span className="resource-name" title={resource.name}>{resource.name}</span><span className="resource-open-label">{resourceAppLabel(resource)} <ExternalLink size={15} /></span></button><button className="resource-remove" onClick={() => removeResource(resource.id)} aria-label={`Убрать ${resource.name}`} title="Убрать из пространства"><X size={16} /></button></div>)}</div></> : <div className="empty-space card"><span className="empty-space-icon"><Folder size={28} strokeWidth={1.3} /></span><div className="empty-space-copy"><h2>Нет материалов</h2></div><div className="empty-space-actions"><button onClick={() => startLink(currentSpace.id)}><Link2 size={17} />Сохранить сайт</button><button onClick={() => addDocumentReference(currentSpace.id)}><Plus size={17} />Документ</button></div></div>}
            {!isCabinetPreview && currentSpace.resources.length > resourcePageSize && <div className="page-controls"><div><button onClick={() => setResourcePage(visibleResourcePage - 1)} disabled={visibleResourcePage === 0} aria-label="Предыдущая страница"><ChevronLeft size={20} /></button><span>{visibleResourcePage + 1} / {resourcePages}</span><button onClick={() => setResourcePage(visibleResourcePage + 1)} disabled={visibleResourcePage >= resourcePages - 1} aria-label="Следующая страница"><ChevronRight size={20} /></button></div></div>}
          </main>
        )}
        </div>
        {!isWorkstageOpen && <BottomDock
          state={state}
          onChange={commit}
          onAddApp={spaceId => addPicked('app', spaceId)}
          now={time}
          currentSpaceId={currentSpace?.id || targetWorkstageSpace?.id}
          appIcon={productIcon}
          onCapture={openCapture}
          onFocus={() => openFocus()}
          onSaveThought={saveCapture}
          onAssistant={draft => { setAssistantDraft(draft || ''); setAssistantContexts([]); setAssistantOpen(true) }}
          onOpenResource={openResource}
          onAddLink={startLink}
          onAddFile={addDocumentReference}
          onOpenSettings={() => setModal('settings')}
        />}
      </div>

      {spaceContext.menu}
      {cabinetDrag && <div className="cabinet-drop-hint" data-browser-drag-layer role="status">{cabinetDrop ? cabinetDrag.kind === 'space'
        ? `${cabinetDrop.pin && !state.spaces.find(space => space.id === cabinetDrag.id)?.pinned ? 'Закрепить' : 'Переставить'} ${cabinetDrop.after ? 'после' : 'перед'} «${state.spaces.find(space => space.id === cabinetDrop.id)?.name}»`
        : `${cabinetDrag.kind === 'tab' ? 'Перенести вкладку' : 'Добавить материал'} в «${state.spaces.find(space => space.id === cabinetDrop.id)?.name}»`
        : cabinetDrag.kind === 'space' ? 'Перетащите пространство, чтобы изменить порядок' : cabinetDrag.kind === 'tab' ? 'Перетащите вкладку на другое пространство или рядом с вкладкой' : 'Перетащите материал на другое пространство — исходный останется здесь'}</div>}
      {tabsOverviewOpen && <TabOverview state={state} currentSpaceId={currentSpace?.id || targetWorkstageSpace?.id} initialScope={tabsOverviewScope} covers={tabCovers}
        undo={undoAction ? { label: undoAction.label, onRestore: () => { undoAction.restore(); setUndoAction(null) }, onDismiss: () => setUndoAction(null) } : undefined}
        onClose={() => setTabsOverviewOpen(false)} onSelect={(spaceId, tabId) => { selectExistingTab(spaceId, tabId); setTabsOverviewOpen(false) }}
        onCloseTab={(spaceId, tabId) => { handleCloseTab(tabId, spaceId) }} onSplit={splitExistingTab} onMove={moveTab} onReorder={reorderTab} onPin={pinExistingTab}
        onSave={(spaceId, tabId) => { const tab = state.spaces.find(space => space.id === spaceId)?.activeSession?.tabs.find(tab => tab.id === tabId); if (tab) requestSaveTab(tab, spaceId) }}
        onNew={spaceId => handleAddTab(spaceId)} onImport={() => { setTabsOverviewOpen(false); setModal('import') }} />}
      {assistantOpen && <AssistantPanel state={state} onChange={commit} spaceId={targetWorkstageSpace?.id} tabId={activeTabId} initialContexts={assistantContexts} onOpen={openResource} draft={assistantDraft} preferences={assistantPreferences} onPreferencesChange={setAssistantPreferences} onDraftChange={setAssistantDraft} onClose={() => setAssistantOpen(false)} />}
      {savePage && <SavePageDialog state={state} tab={savePage.tab} sourceSpaceId={savePage.sourceSpaceId} onClose={() => setSavePage(null)} onSave={saveBrowserPage} />}
      {modal === 'capture' && <Capture initialWhen={captureDefaultWhen} initialReminderAt={captureTimed ? captureDefaultWhen : undefined} onClose={() => setModal(null)} onSave={saveCapture} />}
      {modal === 'search' && <ContextSearch state={state} localOnly={isDemo || !isDesktop} onClose={() => setModal(null)} onSelect={item => {
        const owner = state.spaces.find(space => space.id === item.spaceId)
        const resource = owner?.resources.find(value => value.id === item.id)
        const tab = owner?.activeSession?.tabs.find(value => value.id === item.id)
        if (resource) openResource(resource)
        else if (tab && owner) selectExistingTab(owner.id, tab.id)
        else if (state.reminders.some(value => value.id === item.id)) { setRoute({ type: 'home' }); setSearchReminderId(item.id) }
        else if (owner) openSpace(owner.id)
      }} />}
      {modal === 'changes' && currentSpace && <ChangesOverview state={state} space={currentSpace} onClose={() => setModal(null)} />}
      {modal === 'import' && <ImportTabs onClose={() => setModal(null)} onImport={importTabs} />}
      {modal === 'splitSpace' && targetWorkstageSpace && <Dialog title="Выделить в новое пространство" onClose={() => setModal(null)}>
        <p className="context-edit-copy">Выберите вкладки другой задачи. Они переедут в отдельное пространство; сохранённые материалы останутся доступными в исходном.</p>
        <div className="cabinet-tab-selection">{contextSession(targetWorkstageSpace).tabs.map(tab => <label key={tab.id}><input type="checkbox" checked={splitTabIds.includes(tab.id)} onChange={event => setSplitTabIds(previous => event.target.checked ? [...previous, tab.id] : previous.filter(id => id !== tab.id))} /><span>{tab.title || 'Новая вкладка'}</span></label>)}</div>
        <div className="calm-dialog-actions"><button className="calm-primary" disabled={!splitTabIds.length} onClick={splitCabinet}>Создать и перенести <ArrowRight size={17} /></button></div>
      </Dialog>}
      {modal === 'documentReference' && <Dialog title="Документ в пространстве" onClose={() => setModal(null)}>
        <p className="cabinet-notice">В браузерном пилоте сохраняется ссылка на файл. Открытие в Photoshop, Illustrator и других программах будет доступно в настольной версии.</p>
        <div className="calm-form"><label>Полный путь к файлу<input autoFocus value={documentTarget} onChange={event => setDocumentTarget(event.target.value)} /></label><label>Название · необязательно<input maxLength={100} value={documentName} onChange={event => setDocumentName(event.target.value)} /></label></div>
        <div className="calm-dialog-actions"><button className="calm-primary" disabled={!documentTarget.trim()} onClick={saveDocumentReference}>Сохранить ссылку <ArrowRight size={17} /></button></div>
      </Dialog>}
      {modal === 'deleteSpace' && <Dialog title="Удалить пространство?" onClose={() => setModal(null)}>
        <p className="context-edit-copy">«{state.spaces.find(space => space.id === spaceActionId)?.name}» и его сохранённые вкладки будут убраны из Дома. Файлы на диске, страницы и облачные документы сохранятся. Удаление можно отменить сразу после действия.</p>
        <div className="calm-dialog-actions"><button className="soft-button" onClick={() => setModal(null)}>Оставить</button><button className="calm-primary" onClick={() => deleteCabinet(spaceActionId)}>Удалить пространство</button></div>
      </Dialog>}
      {modal === 'context' && contextEditor && <Dialog title={isCabinetPreview ? 'Продолжение пространства' : contextEditor.isNew ? 'Новое дело' : 'Настроить продолжение'} onClose={() => setModal(null)}>
        <p className="context-edit-copy">{isCabinetPreview ? 'Вкладки сохраняются автоматически. Следующий шаг и короткая заметка помогут вернуться к работе.' : '«Продолжить» откроет выбранные документы и вкладки этого дела.'}</p>
        <div className="calm-form"><label>{isCabinetPreview ? 'Название пространства' : 'Название дела'}{!contextEditor.isNew && ' · необязательно'}<input autoFocus maxLength={100} value={contextName} onChange={event => setContextName(event.target.value)} /></label><label>Следующий шаг · необязательно<input maxLength={180} value={contextNextStep} onChange={event => setContextNextStep(event.target.value)} /></label><label>Заметка · необязательно<textarea rows={2} maxLength={400} value={contextNote} onChange={event => setContextNote(event.target.value)} /></label></div>
        <details className="calm-details" open><summary>Документы для продолжения · {contextDocumentIds.length}</summary><div className="context-document-list">{state.spaces.find(space => space.id === contextEditor.spaceId)?.resources.filter(resource => resource.kind === 'file' && !resource.completedAt && !/\.(exe|com|msi|cmd|bat|ps1|vbs|js|lnk|url)$/i.test(resource.target)).map(resource => <label key={resource.id}><input type="checkbox" checked={contextDocumentIds.includes(resource.id)} onChange={event => setContextDocumentIds(previous => event.target.checked ? [...previous, resource.id] : previous.filter(id => id !== resource.id))} /><span>{resource.name}</span></label>)}</div>{(!isCabinetPreview || isDesktop) && <button className="calm-text-button" onClick={async () => { const resource = await addPicked('file', contextEditor.spaceId); if (resource) setContextDocumentIds(previous => [...previous, resource.id]) }}><Plus size={16} />Добавить документ</button>}<p className="context-edit-copy">{isDesktop ? 'Отметьте документы, которые нужно открыть вместе с пространством. При продолжении они откроются в установленных программах.' : isCabinetPreview ? 'Отметьте документы, с которыми хотите продолжить работу. В браузере они остаются ссылками в материалах; автоматическое открытие проверим в настольной версии.' : 'Программа по умолчанию открывает документы. Вкладки сохраняются автоматически; успешно открытые из Дома документы добавляются сами. Само сохранение материала в пространство не включает его в продолжение. Документы, открытые вне Дома, добавьте вручную.'}</p></details>
        <div className="calm-dialog-actions"><button className="calm-primary" disabled={contextEditor.isNew && !contextName.trim()} onClick={saveContext}>Сохранить <ArrowRight size={17} /></button></div>
      </Dialog>}
      {modal === 'archive' && <Dialog title="Архив пространств" onClose={() => setModal(null)}><div className="archive-list">{state.spaces.filter(space => space.archivedAt).map(space => <button className="soft-button" key={space.id} onClick={() => commit(previous => ({ ...previous, spaces: previous.spaces.map(item => item.id === space.id ? { ...item, archivedAt: null } : item) }))}>Вернуть «{space.name}»</button>)}{!state.spaces.some(space => space.archivedAt) && <p>Все пространства возвращены.</p>}</div></Dialog>}
      {modal === 'dashboard' && <DashboardSettings widgets={dashboardWidgets(state.dashboard?.widgets)} backgroundImage={state.backgroundImage} onBackgroundChange={url => commit(previous => ({ ...previous, backgroundImage: url }))} onChange={widgets => commit(previous => ({ ...previous, dashboard: { preset: 'overview', widgets } }))} onClose={() => setModal('settings')} />}
      {modal === 'focus' && <FocusPanel state={state} now={time} initialTaskId={focusTaskId} onClose={() => setModal(null)} onDay={() => { setModal(null); returnHome() }} onCapture={openCapture} onComplete={async task => {
        const saved = await commit(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === task.id ? { ...item, done: true } : item) }))
        if (saved) setUndoAction({ label: 'Дело завершено', restore: () => commit(previous => ({ ...previous, reminders: previous.reminders.map(item => item.id === task.id ? { ...item, done: task.done } : item) })) })
        return saved
      }} />}
      {profileOpen && (
        <ProfilePopover
          profile={state?.userProfile}
          onChangeProfile={updates => commit(previous => updateUserProfile(previous, updates))}
          onOpenSettings={section => openSettings(section as any)}
          onOpenImport={() => { setProfileOpen(false); setModal('import') }}
          onOpenWallpaper={() => { setProfileOpen(false); setModal('dashboard') }}
          onClose={() => setProfileOpen(false)}
          anchorElement={profileAnchorRef.current}
        />
      )}
      {modal === 'history' && (
        <BrowserHistory
          history={state.history}
          onClose={() => setModal(null)}
          onNavigate={(url, newTab) => openAddress(url, undefined, targetWorkstageSpace?.id, newTab)}
          onRemove={id => commit(prev => ({ ...prev, history: removeHistoryItem(prev.history, id) }))}
          onClear={() => commit(prev => ({ ...prev, history: clearHistory() }))}
        />
      )}
      {modal === 'settings' && <Settings state={state} onChange={commit} onClose={() => { setModal(null); setSettingsSection(undefined) }} onDashboard={() => setModal('dashboard')} autostart={autostart} onAutostart={changeAutostart} onBackup={async () => { try { await bridge.backup(); setToast('Резервная копия сохранена.') } catch { setToast('Не удалось создать резервную копию.') } }} calendarName={newCalendarName} calendarUrl={newCalendarUrl} onCalendarName={setNewCalendarName} onCalendarUrl={setNewCalendarUrl} onAddCalendar={addCalendar} onRemoveCalendar={removeCalendar} onCalendarRefresh={() => syncCalendars()} calendarRefreshing={isRefreshingCalendar} onNewsRefresh={news.refresh} newsRefreshing={news.refreshing} initialSection={settingsSection} onImport={() => setModal('import')} />}
      {modal && !['context', 'splitSpace', 'documentReference', 'deleteSpace', 'capture', 'import', 'search', 'changes', 'archive', 'dashboard', 'focus', 'settings', 'history'].includes(modal) && <Dialog className={`app-dialog ${modal === 'weather' ? 'weather-dialog' : ['newSpace', 'newStream', 'renameSpace'].includes(modal) ? 'space-create-dialog' : ''}`} title={modal === 'renameSpace' ? 'Новое название' : modal === 'newLink' ? 'Новая ссылка' : modal === 'weather' ? 'Погода' : modal === 'newStream' ? 'Новый поток' : 'Новое пространство'} onClose={() => setModal(null)}>
        {(modal === 'newSpace' || modal === 'newStream' || modal === 'renameSpace') && <>
          {modal !== 'renameSpace' && <div className={`space-create-preview tone-${newSpaceTone}`}><SpacePreview space={{ resources: [] }} /><span><strong>{newSpaceName.trim() || 'Новое пространство'}</strong></span></div>}
          <div className="calm-form"><label>Название пространства<input className="large-input" autoFocus maxLength={70} value={newSpaceName} onChange={event => setNewSpaceName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) createSpace() }} /></label></div>
          {isCabinetPreview && modal === 'renameSpace' && (() => { const space = state.spaces.find(item => item.id === spaceActionId); const name = space && nameFromMaterials(space); return name ? <button className="calm-text-button" onClick={() => setNewSpaceName(name)}>По материалам: {name}</button> : null })()}
          {modal === 'newSpace' && <div className="capture-options space-name-suggestions">{['Работа', 'Личное', 'Учёба', 'Поездка'].map(name => <button key={name} onClick={() => setNewSpaceName(name)}>{name}</button>)}</div>}
          <div className="modal-bottom">{modal !== 'renameSpace' && <div className="space-tone-picker" role="group" aria-label="Цвет пространства">{tones.map((tone, index) => <button key={tone} className={`tone-choice tone-${tone}`} aria-label={['Шалфей', 'Сирень', 'Песок', 'Небо'][index]} aria-pressed={newSpaceTone === tone} onClick={() => setNewSpaceTone(tone)}><span /></button>)}</div>}<button className="primary-button" disabled={!newSpaceName.trim()} onClick={createSpace}>{modal === 'renameSpace' ? 'Сохранить' : 'Создать пространство'} <ArrowRight size={17} /></button></div>
        </>}
        {modal === 'newLink' && <><span className="modal-kicker"><Globe2 size={16} /> СОХРАНИТЬ САЙТ</span><div className="form-stack"><label>Название<input value={linkName} onChange={event => setLinkName(event.target.value)} /></label><label>Адрес<input value={linkUrl} onChange={event => setLinkUrl(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addLink() }} /></label></div><div className="modal-bottom end"><button className="primary-button" onClick={addLink}>Добавить <ArrowRight size={17} /></button></div></>}
        {modal === 'weather' && <WeatherDetails weather={weather} now={time} onOpenTraffic={openTraffic} />}
      </Dialog>}
      {passwordOffer && (
        <div className="calm-password-prompt" role="alert">
          <div className="calm-password-prompt-info">
            <span className="calm-password-prompt-title">Сохранить пароль?</span>
            <span className="calm-password-prompt-sub">
              {passwordOffer.username ? `${passwordOffer.username} · ` : ''}{(() => {
                try { return new URL(passwordOffer.origin).hostname } catch { return passwordOffer.origin }
              })()}
            </span>
          </div>
          <div className="calm-password-prompt-actions">
            <button className="soft-button" onClick={() => setPasswordOffer(null)}>Не сейчас</button>
            <button className="calm-primary" onClick={async () => {
              try {
                if (bridge.vault) {
                  await bridge.vault.saveCredential({
                    origin: passwordOffer.origin,
                    username: passwordOffer.username,
                    password: passwordOffer.password,
                    title: passwordOffer.title || new URL(passwordOffer.origin).hostname
                  })
                  setToast('Пароль сохранён в локальный менеджер')
                }
              } catch {
                setToast('Не удалось сохранить пароль')
              } finally {
                setPasswordOffer(null)
              }
            }}>Сохранить</button>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status"><span>{toast}</span>{Boolean(resumeStatus?.result?.failures.length) && <button disabled={resumeStatus?.pending} onClick={() => resumeContext(resumeStatus!.spaceId, resumeStatus!.contextId, true)}>Повторить неоткрытые</button>}<button onClick={() => setToast('')} aria-label="Закрыть"><X size={15} /></button></div>}
      {undoAction && !tabsOverviewOpen && <div className="calm-undo" role="status"><span>{undoAction.label}</span>{undoAction.open && <button onClick={undoAction.open}>Открыть</button>}<button onClick={() => { undoAction.restore(); setUndoAction(null) }}>Вернуть</button><button aria-label="Закрыть" onClick={() => setUndoAction(null)}><X size={15} /></button></div>}
    </div>
  )
}

export default App



