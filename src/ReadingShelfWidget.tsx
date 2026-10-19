import { Bookmark, Check, Clock3, Plus } from 'lucide-react'
import type { AppState, Resource } from './types'

interface Props {
  state: AppState
  onChange: (update: (prev: AppState) => AppState) => void
  onOpen: (resource: Resource) => void
  onAddLink: () => void
  colSpan?: number
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Ссылка'
  }
}

function estimateReadingTime(resource: Resource): number {
  // Rough estimate: based on title words, default to 5 minutes
  const words = (resource.name || '').split(/\s+/).length
  return Math.max(3, Math.min(15, Math.round(words * 0.8) + 3))
}

export function ReadingShelfWidget({ state, onChange, onOpen, onAddLink, colSpan }: Props) {
  const isSmall = colSpan !== undefined && colSpan <= 5
  // Collect all links across spaces that are not completed
  const links: { resource: Resource; spaceId: string; spaceName: string }[] = []

  for (const space of state.spaces) {
    if (space.archivedAt) continue
    for (const res of space.resources) {
      if (res.kind === 'link' && !res.completedAt && !/figma\.com\/(design|file)/i.test(res.target)) {
        links.push({ resource: res, spaceId: space.id, spaceName: space.name })
      }
    }
  }

  // Sort: most recently added or opened first
  links.sort((a, b) => {
    const timeA = Date.parse(a.resource.lastOpenedAt || a.resource.createdAt || '') || 0
    const timeB = Date.parse(b.resource.lastOpenedAt || b.resource.createdAt || '') || 0
    return timeB - timeA
  })

  function markCompleted(resourceId: string) {
    const now = new Date().toISOString()
    onChange(prev => ({
      ...prev,
      spaces: prev.spaces.map(space => ({
        ...space,
        resources: space.resources.map(res =>
          res.id === resourceId ? { ...res, completedAt: now } : res
        )
      }))
    }))
  }

  return (
    <div className={`reading-shelf-widget ${isSmall ? 'is-small-card' : ''}`} aria-label="Почитать">
      <div className="reading-shelf-header calm-card-heading">
        <div className="reading-shelf-title">
          <Bookmark size={17} />
          <strong>Почитать</strong>
          {links.length > 0 && <span className="reading-shelf-badge">{links.length}</span>}
        </div>
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

      <div className="reading-shelf-list">
        {links.length === 0 ? (
          <div className="reading-shelf-empty">
            <p>Все сохранённые материалы прочитаны</p>
            <button type="button" className="calm-text-button" onClick={onAddLink}>
              Сохранить ссылку <Plus size={14} />
            </button>
          </div>
        ) : (
          links.slice(0, 5).map(({ resource, spaceName }) => {
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
                  <span className="reading-shelf-name">{resource.name}</span>
                  <div className="reading-shelf-meta">
                    {isSmall ? (
                      <span className="reading-shelf-domain">{domain} · {readMins} м</span>
                    ) : (
                      <>
                        <span className="reading-shelf-domain">{domain}</span>
                        <span className="reading-shelf-time">
                          <Clock3 size={12} /> ~{readMins} мин
                        </span>
                        {spaceName && <span className="reading-shelf-space">{spaceName}</span>}
                      </>
                    )}
                  </div>
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
          })
        )}
      </div>
    </div>
  )
}
