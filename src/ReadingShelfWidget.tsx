import { useState, useEffect, useRef, useMemo } from 'react'
import { Bookmark, Check, Plus, List, LayoutGrid } from 'lucide-react'
import type { AppState, Resource, BrowserTab } from './types'

interface Props {
  state: AppState
  onChange: (update: (prev: AppState) => AppState) => void
  onOpen: (resource: Resource) => void
  onAddLink: () => void
  colSpan?: number
  covers?: Record<string, string>
}

function getDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host === 'localhost' || host === '127.0.0.1' ? '' : host
  } catch {
    return ''
  }
}

function estimateReadingTime(resource: Resource): number {
  // Rough estimate based on title words, default between 3 and 15 mins
  const words = (resource.name || '').split(/\s+/).length
  return Math.max(3, Math.min(15, Math.round(words * 0.8) + 3))
}

const TONES = [
  { bg: '#EBF1EB', color: '#273C2C', sub: '#68826F', border: 'rgba(39, 60, 44, 0.08)' }, // Sage
  { bg: '#F2EDE5', color: '#44382B', sub: '#8F7D6B', border: 'rgba(68, 56, 43, 0.08)' }, // Warm Sand
  { bg: '#F4ECE6', color: '#453227', sub: '#997B6B', border: 'rgba(69, 50, 39, 0.08)' }, // Clay
  { bg: '#E7EEF1', color: '#213740', sub: '#647E8A', border: 'rgba(33, 55, 64, 0.08)' }, // Slate
  { bg: '#EAEBE5', color: '#33372B', sub: '#79806F', border: 'rgba(51, 55, 43, 0.08)' }, // Stone
  { bg: '#EFEAE8', color: '#403233', sub: '#8E7375', border: 'rgba(64, 50, 51, 0.08)' }, // Muted Mauve
]

function getTone(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return TONES[Math.abs(hash) % TONES.length]
}

function getMonogram(domain: string, title: string): string {
  if (domain) {
    const parts = domain.split('.')
    const name = parts[0] === 'm' && parts.length > 2 ? parts[1] : parts[0]
    if (name.length <= 2) return name.toUpperCase()
    if (name === 'github') return 'GH'
    if (name === 'youtube') return 'YT'
    if (name === 'habr') return 'H'
    if (name === 'medium') return 'M'
    if (name === 'figma') return 'F'
    return name.slice(0, 2).toUpperCase()
  }
  const clean = title.trim()
  if (!clean) return '✦'
  const words = clean.split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return clean.slice(0, 2).toUpperCase()
}

function findCover(targetUrl: string, covers?: Record<string, string>, state?: AppState): string | undefined {
  if (!covers || Object.keys(covers).length === 0) return undefined
  if (covers[targetUrl]) return covers[targetUrl]
  const cleanTarget = targetUrl.replace(/\/$/, '')
  const tabs: BrowserTab[] = []
  if (state?.spaces) {
    for (const sp of state.spaces) {
      if (sp.activeSession?.tabs) tabs.push(...sp.activeSession.tabs)
      if ((sp as any).session?.tabs) tabs.push(...(sp as any).session.tabs)
      if (sp.checkpoint?.session?.tabs) tabs.push(...sp.checkpoint.session.tabs)
      if (sp.checkpointHistory) {
        for (const cp of sp.checkpointHistory) {
          if (cp.session?.tabs) tabs.push(...cp.session.tabs)
        }
      }
    }
  }
  const match = tabs.find(t => t.url && (t.url === targetUrl || t.url.replace(/\/$/, '') === cleanTarget))
  if (match && covers[match.id]) {
    return covers[match.id]
  }
  return undefined
}

type ViewMode = 'list' | 'grid'
const PAGE_SIZE = 12

export function ReadingShelfWidget({ state, onChange, onOpen, onAddLink, colSpan, covers }: Props) {
  const isSmall = colSpan !== undefined && colSpan <= 5
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('dombro:reading-shelf-view')
      if (saved === 'list' || saved === 'grid') return saved
    } catch {
      // ignore
    }
    return 'list'
  })

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [scrollEdges, setScrollEdges] = useState({ before: false, after: false })
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem('dombro:reading-shelf-view', mode)
    } catch {
      // ignore
    }
  }

  // Collect all links across active spaces that are not completed
  const links = useMemo(() => {
    const list: { resource: Resource; spaceId: string; spaceName: string }[] = []
    for (const space of state.spaces) {
      // «Избранное» (bookmarks of the browsing space) is a separate shelf: the new tab in «Браузинг».
      if (space.archivedAt || space.kind === 'web') continue
      for (const res of space.resources) {
        if (res.kind === 'link' && !res.completedAt && !/figma\.com\/(design|file)/i.test(res.target)) {
          list.push({ resource: res, spaceId: space.id, spaceName: space.name })
        }
      }
    }
    // Sort: most recently added or opened first
    list.sort((a, b) => {
      const timeA = Date.parse(a.resource.lastOpenedAt || a.resource.createdAt || '') || 0
      const timeB = Date.parse(b.resource.lastOpenedAt || b.resource.createdAt || '') || 0
      return timeB - timeA
    })
    return list
  }, [state.spaces])

  const measureScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const max = Math.max(0, el.scrollHeight - el.clientHeight)
    const offset = Math.max(0, Math.min(max, el.scrollTop))
    setScrollEdges({
      before: offset > 4,
      after: offset < max - 4,
    })
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const max = Math.max(0, el.scrollHeight - el.clientHeight)
    const offset = Math.max(0, Math.min(max, el.scrollTop))
    setScrollEdges({
      before: offset > 4,
      after: offset < max - 4,
    })
    // Progressive load: when user scrolls near bottom and overflow exists
    if (max > 0 && offset + el.clientHeight >= el.scrollHeight - 60) {
      setVisibleCount(prev => (prev < links.length ? Math.min(links.length, prev + PAGE_SIZE) : prev))
    }
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    measureScroll()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureScroll) : null
    if (ro) ro.observe(el)
    return () => ro?.disconnect()
  }, [links.length, viewMode, visibleCount])

  function markCompleted(resourceId: string) {
    const now = new Date().toISOString()
    onChange(prev => ({
      ...prev,
      spaces: prev.spaces.map(space => ({
        ...space,
        resources: space.resources.map(res =>
          res.id === resourceId ? { ...res, completedAt: now } : res
        ),
      })),
    }))
  }

  const visibleLinks = links.slice(0, visibleCount)

  return (
    <div className={`reading-shelf-widget ${isSmall ? 'is-small-card' : ''}`} aria-label="Почитать">
      <div className="reading-shelf-header calm-card-heading">
        <div className="reading-shelf-title">
          <Bookmark size={17} />
          <strong>Почитать</strong>
          {links.length > 0 && <span className="reading-shelf-badge">{links.length}</span>}
        </div>

        <div className="reading-shelf-header-actions">
          {links.length > 0 && (
            <div className="reading-shelf-modes" role="group" aria-label="Вид отображения">
              <button
                type="button"
                className={`reading-mode-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                onClick={() => handleSetViewMode('list')}
                title="Отображение списком"
                aria-label="Отображение списком"
                aria-pressed={viewMode === 'list'}
              >
                <List size={15} />
              </button>
              <button
                type="button"
                className={`reading-mode-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
                onClick={() => handleSetViewMode('grid')}
                title="Отображение плитками"
                aria-label="Отображение плитками"
                aria-pressed={viewMode === 'grid'}
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          )}

          <button
            type="button"
            className="calm-icon"
            onClick={onAddLink}
            title="Сохранить ссылку"
            aria-label="Добавить ссылку"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {links.length === 0 ? (
        <div className="reading-shelf-empty">
          <p className="card-accent">Всё прочитано</p>
          <button type="button" className="calm-text-button" onClick={onAddLink}>
            Сохранить ссылку <Plus size={14} />
          </button>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={`reading-shelf-scroll ${scrollEdges.before ? 'has-before' : ''} ${scrollEdges.after ? 'has-after' : ''}`}
        >
          {viewMode === 'list' ? (
            <div className="reading-shelf-list">
              {visibleLinks.map(({ resource, spaceName }) => {
                const domain = getDomain(resource.target)
                const readMins = estimateReadingTime(resource)
                return (
                  <div key={resource.id} className="reading-shelf-row">
                    <button
                      type="button"
                      className="reading-shelf-open"
                      onClick={() => onOpen(resource)}
                      title={`${resource.name}\n${resource.target}`}
                    >
                      <span className="reading-row-icon" aria-hidden="true">
                        {domain ? <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" onError={e => { e.currentTarget.style.display = 'none' }} /> : null}
                        <span>{getMonogram(domain, resource.name)}</span>
                      </span>
                      <span className="reading-row-text">
                      <span className="reading-shelf-name">{resource.name}</span>
                      <div className="reading-shelf-meta">
                        <span className="reading-shelf-domain">
                          {[
                            domain,
                            `${readMins} мин`,
                            !isSmall && spaceName ? spaceName : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      </span>
                    </button>
                    <div className="reading-shelf-actions">
                      <button
                        type="button"
                        className="reading-shelf-check"
                        onClick={() => markCompleted(resource.id)}
                        title="Отметить прочитанным"
                        aria-label={`Отметить прочитанным: ${resource.name}`}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="reading-shelf-grid">
              {visibleLinks.map(({ resource, spaceName }) => {
                const domain = getDomain(resource.target)
                const readMins = estimateReadingTime(resource)
                const cover = findCover(resource.target, covers, state)
                const tone = getTone(domain || resource.name)
                const monogram = getMonogram(domain, resource.name)

                return (
                  <div key={resource.id} className="reading-shelf-tile">
                    <button
                      type="button"
                      className="reading-shelf-open reading-tile-card"
                      onClick={() => onOpen(resource)}
                      title={`${resource.name}\n${resource.target}`}
                    >
                      <div
                        className="reading-tile-thumb"
                        style={{
                          backgroundColor: tone.bg,
                          borderColor: tone.border,
                        }}
                      >
                        {cover ? (
                          <img src={cover} alt="" className="reading-tile-cover-img" />
                        ) : (
                          <div className="reading-tile-art" style={{ color: tone.color }}>
                            {domain && (
                              <div className="reading-tile-favicon-badge">
                                <img
                                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                                  alt=""
                                  className="reading-tile-favicon"
                                  onError={e => {
                                    const badge = e.currentTarget.parentElement
                                    if (badge) badge.style.display = 'none'
                                  }}
                                />
                              </div>
                            )}
                            <span className="reading-tile-monogram">{monogram}</span>
                          </div>
                        )}
                        <span className="reading-tile-time-badge">{readMins} мин</span>
                      </div>

                      <div className="reading-tile-info">
                        <span className="reading-tile-title">{resource.name}</span>
                        <span className="reading-tile-domain">{domain || spaceName || 'Материал'}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="reading-shelf-check reading-tile-check"
                      onClick={e => {
                        e.stopPropagation()
                        markCompleted(resource.id)
                      }}
                      title="Отметить прочитанным"
                      aria-label={`Отметить прочитанным: ${resource.name}`}
                    >
                      <Check size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
