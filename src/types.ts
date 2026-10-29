export type ResourceKind = 'app' | 'file' | 'link' | 'window'
export type SpaceTone = 'sage' | 'lilac' | 'sand' | 'blue'
export type SupportedLocale = 'ru' | 'en' | 'de' | 'es' | 'fr' | 'zh'

export interface Resource {
  id: string
  name: string
  kind: ResourceKind
  target: string
  createdAt: string
  lastOpenedAt?: string
  pinnedToDock?: boolean
  completedAt?: string
  bookmarkGroupId?: string
  windowHwnd?: string
  windowTitle?: string
  exeName?: string
}

export interface OpenWindowItem {
  hwnd: string
  title: string
  exeName: string
  exePath: string
  isMinimized: boolean
}

export interface BookmarkGroup { id: string; name: string }
export interface BookmarkDestination { spaceId: string; groupId?: string }

/** 'day': the «Сегодня» draft and past days (src/dayDraft.ts). */
export type SpaceKind = 'base' | 'stream' | 'web' | 'day'

export interface RecentFile {
  name: string
  target: string
  modifiedAt: string
}

export interface BrowserTab {
  id: string
  contextId?: string
  title: string
  url: string
  pinned?: boolean
  favicon?: string
  lastAccessedAt?: string
  parentTabId?: string
  branchId?: string
  scrollY?: number
  protected?: boolean
  error?: string
  closedIndex?: number
  readerable?: boolean
  lang?: string
  blockedCount?: number
}

export interface BrowserSession {
  tabs: BrowserTab[]
  activeTabId: string
  splitTabId?: string | null
  checkpointNote?: string
  savedAt?: string
  closedTabs?: BrowserTab[]
}

export interface ResearchSource {
  title: string
  domain: string
  url: string
}

export interface ResearchArtifact {
  id: string
  query: string
  sources: ResearchSource[]
  summary: string
  table?: {
    headers: string[]
    rows: string[][]
  }
  conclusion: string
  createdAt: string
  spaceId?: string
}

export interface Space {
  id: string
  name: string
  tone: SpaceTone
  kind?: SpaceKind
  /** Day drafts only: YYYY-MM-DD of the day (boundary 04:00). */
  day?: string
  /** Day drafts only: retired into «Прошлые дни» (renamed to its date). */
  dayRetired?: boolean
  resources: Resource[]
  bookmarkGroups?: BookmarkGroup[]
  lastActiveAt?: string
  archivedAt?: string | null
  activeSession?: BrowserSession
  workContexts?: WorkContext[]
  activeContextId?: string
  researchArtifacts?: ResearchArtifact[]
  checkpoint?: Checkpoint
  checkpointHistory?: Checkpoint[]
  label?: 'work' | 'personal'
  pinned?: boolean
  nameOrigin?: 'temporary' | 'suggested' | 'manual'
  legacyOrigin?: { spaceId: string; spaceName: string; contextId: string }
}

export interface Checkpoint {
  id: string
  spaceId: string
  contextId?: string
  resourceId?: string
  note: string
  nextStep: string
  savedAt: string
  session?: BrowserSession
}

export interface WorkContext {
  id: string
  title: string
  documentIds: string[]
  excludedDocumentIds?: string[]
  activeTabId?: string
  splitTabId?: string | null
  lastActiveAt?: string
  checkpoint?: Checkpoint
  completedAt?: string
}

export interface Reminder {
  id: string
  title: string
  createdAt: string
  dueAt: string | null
  done: boolean
  notifiedAt?: string
  kind?: 'task' | 'note'
  plannedDate?: string | null
  deadline?: string | null
  spaceId?: string
  sourceUrl?: string
  meetingUrl?: string
  trigger?: { kind: 'return'; spaceId: string; armedAt: string } | { kind: 'event'; eventId: string; offsetMinutes: number }
}

export interface CalendarEvent {
  id: string
  title: string
  startAt: string
  endAt: string
  category: 'meeting' | 'design' | 'focus' | 'personal'
  meetingUrl?: string
  location?: string
  sourceId?: string
  uid?: string
  recurrenceId?: string
  allDay?: boolean
  timeZone?: string
  startDate?: string
  endDate?: string
  spaceId?: string
  noticeMinutes?: number
}

export interface CalendarSubscription {
  id: string
  name: string
  url: string
  color?: string
  lastFetchedAt?: string
  error?: string
  secretId?: string
}

export interface MailAccount { id: string; email: string; historyId?: string; lastSyncedAt?: string; error?: string; importantSenders?: string[] }
export interface MailMessage { id: string; accountId: string; gmailId: string; threadId: string; from: string; subject: string; snippet: string; receivedAt: string; unread: boolean; important: boolean; gmailImportant?: boolean; url: string }
export interface FeedSource { id: string; name: string; url: string; error?: string; topic?: string }
export interface FeedArticle { id: string; title: string; url: string; source: string; summary: string; publishedAt: string; sourceId?: string; topic?: string; image?: string }
export interface NewsEdition { id: string; createdAt: string; articles: FeedArticle[] }
export interface AIConfiguration { provider: 'openai' | 'anthropic' | 'compatible'; model: string; endpoint?: string; role: 'chat' | 'helper' | 'agent'; dailyRequestLimit: number; maxOutputTokens: number; background?: { enabled: boolean; hour: number; mail: boolean; news: boolean }; configured?: boolean }
export interface AIContext { id: string; title: string; url?: string; text: string }
export interface AIRequest { id: string; prompt: string; contexts: AIContext[]; consent: boolean; history?: { role: 'user' | 'assistant'; text: string }[] }
export interface AIEvent { id: string; type: 'delta' | 'done' | 'error'; text?: string }
export interface AIJournalEntry { id: string; at: string; model: string; sources: { title: string; url?: string }[]; status: 'running' | 'done' | 'cancelled' | 'error'; inputTokens?: number; outputTokens?: number; error?: string; background?: boolean; result?: string }

export interface MorningTab {
  id: string
  title: string
  url: string
  domain: string
  cluster: string
  readTimeMin: number
  visitedAt: string
  done?: boolean
}

export interface InboxMessage {
  id: string
  source: 'telegram' | 'mail' | 'slack'
  sender: string
  preview: string
  time: string
  unread: boolean
}

export interface NewsItem {
  id: string
  title: string
  source: string
  tag: string
  time: string
}

export interface UserProfile {
  name: string
  avatarTone?: SpaceTone
  avatarEmoji?: string
  status?: string
}

export interface HistoryItem {
  id: string
  url: string
  title: string
  visitedAt: string
  favicon?: string
  spaceId?: string
}

export interface DashboardCustomPreset {
  id: string
  name: string
  widgets: WidgetConfig[]
  createdAt: string
}

export interface AppState {
  version: 1 | 2
  revision?: number
  cabinetVersion?: 1
  locale?: SupportedLocale
  userProfile?: UserProfile
  backgroundImage?: string
  dashboard?: {
    preset: string
    widgets: WidgetConfig[]
    gridVersion?: number
    customPresets?: DashboardCustomPreset[]
    resumeDismissed?: boolean
  }
  /** «Анимация напоминаний»: on unless explicitly turned off (row hint in the plan, bell sway in the island). */
  liveHints?: boolean
  /** Off by default: typed search text goes to Google only after the user turns this on (docs/security.md). */
  searchSuggestions?: boolean
  /** Default search engine for omnibox queries. */
  searchEngine?: 'google' | 'duckduckgo' | 'yandex' | 'ecosia'
  /** Global adblock filter toggle (Ghostery Blocker). Defaults to true. */
  adblockEnabled?: boolean
  /** Idle time before background tabs are automatically parked (in minutes). 0 = never. Defaults to 30. */
  tabParkingTimeoutMinutes?: number
  dismissedNotices?: string[]
  notifiedNotices?: string[]
  mailAccounts?: MailAccount[]
  mailMessages?: MailMessage[]
  feedSources?: FeedSource[]
  newsEditions?: NewsEdition[]
  newsPreferences?: { topics: string[]; activeTopic?: string }
  aiConfiguration?: AIConfiguration
  aiJournal?: AIJournalEntry[]
  activeSpaceId?: string
  lastBookmarkDestination?: BookmarkDestination
  spaces: Space[]
  reminders: Reminder[]
  dismissedUntil: string | null
  starterAppsAdded?: boolean
  events?: CalendarEvent[]
  calendarSubscriptions?: CalendarSubscription[]
  morningTabs?: MorningTab[]
  inboxMessages?: InboxMessage[]
  newsItems?: NewsItem[]
  history?: HistoryItem[]
  aiInsight?: string
  checkpoint?: {
    spaceId: string
    resourceId?: string
    note: string
    nextStep: string
    savedAt: string
  }
  scratchpadNote?: string
  habitsState?: HabitsState
}

export interface SavedCredential {
  id: string
  origin: string
  username: string
  password: string
  title?: string
  updatedAt: string
}

/** What the interface receives from the vault: never the password (see docs/security.md). */
export type CredentialSummary = Omit<SavedCredential, 'password'>

export interface OpenResult { ok: boolean; error?: string }

export interface DomBridge {
  platform?: string
  cabinetPilot?: boolean
  getState(): Promise<AppState>
  saveState(state: AppState): Promise<boolean>
  applyChanges(changes: import('../shared/state').StateChange[]): Promise<AppState>
  search(query: string): Promise<{ id: string; spaceId: string; title: string; target: string }[]>
  backup(): Promise<boolean>
  closeCapture?(): Promise<void>
  vault?: {
    /** With a page address or host: only that exact site (www. ignored). */
    listCredentials(site?: string): Promise<CredentialSummary[]>
    /** One password, for an explicit user action in settings. */
    revealPassword(id: string): Promise<string>
    saveCredential(cred: { id?: string; origin: string; username: string; password: string; title?: string }): Promise<CredentialSummary>
    /** Saves the password captured from a page; it never left the main process. `password` overrides it. */
    saveOffer(token: string, username: string, password?: string): Promise<CredentialSummary>
    removeCredential(id: string): Promise<boolean>
    importCredentials(csv: string): Promise<number>
    /** Writes a Bitwarden-compatible CSV via a save dialog; false when cancelled. */
    exportCredentials(): Promise<boolean>
  }
  integrations?: {
    configureGoogle(clientId: string): Promise<void>
    googleConfigured(): Promise<boolean>
    connectMail(): Promise<void>
    syncMail(id?: string): Promise<void>
    disconnectMail(id: string): Promise<void>
    fetchFeed(url: string): Promise<string>
    readMaterial(id: string): Promise<AIContext>
    addCalendar(name: string, url: string): Promise<void>
    fetchCalendarSource(id: string): Promise<string>
    removeCalendar(id: string): Promise<void>
    configureAI(configuration: AIConfiguration, key?: string): Promise<void>
    runAI(request: AIRequest): Promise<void>
    cancelAI(id: string): Promise<void>
    transcribeAudio?(buffer: Uint8Array | ArrayBuffer, mimeType?: string): Promise<{ text: string }>
    onAI(callback: (event: AIEvent) => void): () => void
  }
  browser?: {
    show(value: { tab: BrowserTab; spaceId: string; bounds: { x: number; y: number; width: number; height: number } }): Promise<void>
    hide(id: string): Promise<void>
    move?(id: string, spaceId: string): Promise<void>
    block(value: boolean): Promise<void>
    close(id: string): Promise<boolean>
    park(ids: string[]): Promise<{ protectedCount: number; freedMB?: number }>
    action(id: string, action: 'back' | 'forward' | 'reload' | 'stop' | 'zoomIn' | 'zoomOut' | 'zoomReset'): Promise<void>
    text(id: string): Promise<{ url: string; title: string; text: string }>
    respondPermission?(id: string, allowed: boolean | null): Promise<boolean | void>
    onEvent(callback: (value: NativeBrowserEvent) => void): () => void
    getAdblockStatus?(tabId?: string, hostname?: string): Promise<AdblockStatus>
    toggleAdblockSite?(hostname: string, disabled: boolean): Promise<AdblockStatus>
    toggleAdblockCookies?(enabled: boolean): Promise<AdblockStatus>
    toggleAdblockGlobal?(enabled: boolean): Promise<AdblockStatus>
    toggleDarkSite?(tabId: string, hostname: string, enabled: boolean): Promise<AdblockStatus>
    getReaderContent?(tabId: string): Promise<ReaderArticle | null>
    translateText?(text: string, targetLang?: string): Promise<string>
    translateTab?(tabId: string): Promise<{ ok: boolean; count?: number; error?: string }>
    autofill?(tabId: string, credentialId: string): Promise<boolean>
  }
  bitwardenStatus?(): Promise<BitwardenExtensionStatus>
  pickResource(kind: 'app' | 'file'): Promise<string | null>
  openResource(resource: Resource): Promise<OpenResult>
  osWindows?: {
    listOpen(): Promise<OpenWindowItem[]>
    minimize(toPark: string[], activeKeep?: string[]): Promise<boolean>
    restore(hwndList: string[], focusDomWindow?: boolean): Promise<boolean>
    focus(hwnd: string): Promise<boolean>
  }
  getAutostart(): Promise<boolean>
  setAutostart(value: boolean): Promise<boolean>
  fetchCalendar?(url: string): Promise<string>
  fetchSuggestions?(query: string): Promise<string[]>
  toggleFullScreen?(): Promise<boolean>
  isFullScreen?(): Promise<boolean>
  setTitleBarOverlay?(options?: { color?: string; symbolColor?: string; height?: number }): Promise<boolean>
  getRecentFiles?(): Promise<RecentFile[]>
  onToast?(callback: (message: string) => void): () => void
  onUpdateReady?(callback: (update: AppUpdate) => void): () => void
  openReleasePage?(): Promise<boolean>
  installUpdate?(): Promise<boolean>
  onFocusCapture(callback: () => void): () => void
  onVoiceToggle?(callback: () => void): () => void
  onStateChanged(callback: (state: AppState) => void): () => void
}

export interface ReaderArticle {
  title: string
  byline: string
  content: string
  textContent: string
  excerpt: string
  siteName: string
  length: number
  readingTimeMinutes: number
}

export interface AdblockStatus {
  enabled: boolean
  siteDisabled: boolean
  blockedCount: number
  blockCookies: boolean
  isDark: boolean
}

export type WidgetType = 'resume' | 'day' | 'capture' | 'spaces' | 'mail' | 'news' | 'focus' | 'reading' | 'notes' | 'weather' | 'map' | 'habits'
export type WidgetSize = 'S' | 'M' | 'L'
export interface WidgetConfig {
  id: string
  type: WidgetType
  size?: WidgetSize
  colSpan?: number
  rowSpan?: number
  detail?: 'titles' | 'short' | 'full'
}

export type HabitKind = 'counter' | 'checkbox' | 'timer'

export interface HabitItem {
  id: string
  title: string
  description?: string
  kind: HabitKind
  targetCount?: number
  currentCount?: number
  completedToday?: boolean
  unit?: string
  custom?: boolean
  timerMinutes?: number
}

export interface HabitsState {
  date: string
  items: HabitItem[]
}

export interface BitwardenExtensionStatus {
  loaded: boolean
  version: string
  id?: string
  worker?: boolean
  error?: string
}

export interface PasswordSavePromptInfo {
  id: string
  tabId: string
  origin: string
  hostname: string
  username: string
  /** Opaque handle of the password kept in the main process. */
  token: string
}

export type NativeBrowserEvent =
  | { type: 'update'; tabId: string; spaceId: string; updates: Partial<BrowserTab> }
  | { type: 'new-tab'; spaceId: string; parentTabId: string; url: string; background: boolean }
  | { type: 'shortcut'; key: string; shift: boolean; alt: boolean }
  | { type: 'cover'; tabId: string; image: string }
  | { type: 'permission-request'; id: string; tabId?: string; hostname: string; origin: string; permission: string; details?: string }
  | { type: 'adblock-stats'; tabId: string; count: number }
  | { type: 'password-save-offer'; tabId: string; origin: string; hostname: string; username: string; token: string }

/** manual: portable build — a newer release exists and has to be downloaded from its page. */
export interface AppUpdate {
  version: string
  manual?: boolean
}
