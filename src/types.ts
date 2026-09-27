export type ResourceKind = 'app' | 'file' | 'link'
export type SpaceTone = 'sage' | 'lilac' | 'sand' | 'blue'

export interface Resource {
  id: string
  name: string
  kind: ResourceKind
  target: string
  createdAt: string
  lastOpenedAt?: string
  completedAt?: string
}

export type SpaceKind = 'base' | 'stream'

export interface BrowserTab {
  id: string
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
  resources: Resource[]
  lastActiveAt?: string
  archivedAt?: string | null
  activeSession?: BrowserSession
  researchArtifacts?: ResearchArtifact[]
  checkpoint?: Checkpoint
  checkpointHistory?: Checkpoint[]
  label?: 'work' | 'personal'
}

export interface Checkpoint {
  id: string
  spaceId: string
  resourceId?: string
  note: string
  nextStep: string
  savedAt: string
  session?: BrowserSession
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
export interface FeedSource { id: string; name: string; url: string; error?: string }
export interface FeedArticle { id: string; title: string; url: string; source: string; summary: string; publishedAt: string }
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

export interface AppState {
  version: 1 | 2
  revision?: number
  dashboard?: { preset: 'overview' | 'quiet'; widgets: WidgetConfig[] }
  liveHints?: boolean
  dismissedNotices?: string[]
  notifiedNotices?: string[]
  mailAccounts?: MailAccount[]
  mailMessages?: MailMessage[]
  feedSources?: FeedSource[]
  newsEditions?: NewsEdition[]
  aiConfiguration?: AIConfiguration
  aiJournal?: AIJournalEntry[]
  activeSpaceId?: string
  spaces: Space[]
  reminders: Reminder[]
  dismissedUntil: string | null
  starterAppsAdded?: boolean
  events?: CalendarEvent[]
  calendarSubscriptions?: CalendarSubscription[]
  morningTabs?: MorningTab[]
  inboxMessages?: InboxMessage[]
  newsItems?: NewsItem[]
  aiInsight?: string
  checkpoint?: {
    spaceId: string
    resourceId?: string
    note: string
    nextStep: string
    savedAt: string
  }
}

export interface OpenResult { ok: boolean; error?: string }

export interface DomBridge {
  platform?: string
  getState(): Promise<AppState>
  saveState(state: AppState): Promise<boolean>
  applyChanges(changes: import('../shared/state').StateChange[]): Promise<AppState>
  search(query: string): Promise<{ id: string; spaceId: string; title: string; target: string }[]>
  backup(): Promise<boolean>
  closeCapture?(): Promise<void>
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
    onAI(callback: (event: AIEvent) => void): () => void
  }
  browser?: {
    show(value: { tab: BrowserTab; spaceId: string; bounds: { x: number; y: number; width: number; height: number } }): Promise<void>
    hide(id: string): Promise<void>
    block(value: boolean): Promise<void>
    close(id: string): Promise<boolean>
    park(ids: string[]): Promise<{ protectedCount: number }>
    action(id: string, action: 'back' | 'forward' | 'reload' | 'stop' | 'zoomIn' | 'zoomOut' | 'zoomReset'): Promise<void>
    text(id: string): Promise<{ url: string; title: string; text: string }>
    onEvent(callback: (value: NativeBrowserEvent) => void): () => void
  }
  pickResource(kind: 'app' | 'file'): Promise<string | null>
  openResource(resource: Resource): Promise<OpenResult>
  getAutostart(): Promise<boolean>
  setAutostart(value: boolean): Promise<boolean>
  fetchCalendar?(url: string): Promise<string>
  onFocusCapture(callback: () => void): () => void
  onStateChanged(callback: (state: AppState) => void): () => void
}

export type WidgetType = 'resume' | 'day' | 'capture' | 'spaces' | 'mail' | 'news' | 'focus'
export interface WidgetConfig { id: string; type: WidgetType; size: 'S' | 'M' | 'L'; detail?: 'titles' | 'short' | 'full' }

export type NativeBrowserEvent =
  | { type: 'update'; tabId: string; spaceId: string; updates: Partial<BrowserTab> }
  | { type: 'new-tab'; spaceId: string; parentTabId: string; url: string; background: boolean }
  | { type: 'shortcut'; key: string; shift: boolean; alt: boolean }
  | { type: 'cover'; tabId: string; image: string }
