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
}

export interface BrowserSession {
  tabs: BrowserTab[]
  activeTabId: string
  splitTabId?: string | null
  checkpointNote?: string
  savedAt?: string
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
}

export interface Reminder {
  id: string
  title: string
  createdAt: string
  dueAt: string | null
  done: boolean
  notifiedAt?: string
}

export interface CalendarEvent {
  id: string
  title: string
  startAt: string
  endAt: string
  category: 'meeting' | 'design' | 'focus' | 'personal'
  meetingUrl?: string
  location?: string
}

export interface CalendarSubscription {
  id: string
  name: string
  url: string
  color?: string
  lastFetchedAt?: string
  error?: string
}

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
  version: 1
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
  getState(): Promise<AppState>
  saveState(state: AppState): Promise<boolean>
  pickResource(kind: 'app' | 'file'): Promise<string | null>
  openResource(resource: Resource): Promise<OpenResult>
  getAutostart(): Promise<boolean>
  setAutostart(value: boolean): Promise<boolean>
  fetchCalendar?(url: string): Promise<string>
  onFocusCapture(callback: () => void): () => void
  onStateChanged(callback: (state: AppState) => void): () => void
}
