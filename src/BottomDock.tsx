import { useEffect, useState, type ReactNode } from 'react'
import { Globe2, Plus, Timer } from 'lucide-react'
import type { AppState, Resource } from './types'
import { zenTimer } from './focus/zenTimer'
import { PlayerIsland } from './player/PlayerIsland'
import { AppLauncherPopover } from './AppLauncherPopover'

interface Props {
  state: AppState
  now: Date
  currentSpaceId?: string
  isWorkstageOpen: boolean
  appIcon: (name: string) => ReactNode
  onCapture: () => void
  onOpenWorkstage: (spaceId?: string) => void
  onOpenResource: (resource: Resource) => void
  onAddLink: (spaceId?: string) => void
  onAddFile: (spaceId?: string) => void
  onOpenSpace: (spaceId: string) => void
  onOpenSettings: () => void
}

export function BottomDock({ state, now, currentSpaceId, isWorkstageOpen, appIcon, onCapture, onOpenWorkstage, onOpenResource, onAddLink, onAddFile, onOpenSpace, onOpenSettings }: Props) {
  const [zenState, setZenState] = useState(zenTimer.getState())
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  useEffect(() => zenTimer.subscribe(setZenState), [])

  const apps = state.spaces.flatMap(space => space.resources.filter(resource => resource.kind === 'app'))
    .filter((app, index, all) => all.findIndex(item => item.target.toLowerCase() === app.target.toLowerCase()) === index).slice(0, 4)
  const currentSpace = state.spaces.find(space => space.id === currentSpaceId) || state.spaces[0]

  function getAppDocuments(app: Resource) {
    const docs = state.spaces.flatMap(space => space.resources
      .filter(resource => resource.kind !== 'app')
      .map(resource => ({ ...resource, spaceName: space.name })))
    const matches = docs.filter(doc => {
      if (/figma/i.test(app.name)) return doc.kind === 'link' && /figma\.com/i.test(doc.target)
      if (/illustrator/i.test(app.name)) return doc.kind === 'file' && /\.(ai|eps|svg|ait)$/i.test(doc.target)
      return doc.target.toLowerCase().includes(app.name.toLowerCase())
    })
    return matches.sort((a, b) => Date.parse(b.lastOpenedAt || b.createdAt) - Date.parse(a.lastOpenedAt || a.createdAt))
  }

  function newDocument(app: Resource) {
    if (/figma/i.test(app.name)) {
      onOpenResource({ id: crypto.randomUUID(), name: 'Новый холст Figma', kind: 'link', target: 'https://figma.new', createdAt: new Date().toISOString() })
    } else {
      onOpenResource(app)
    }
  }

  function addDocument(app: Resource) {
    if (/figma/i.test(app.name)) onAddLink(currentSpace?.id)
    else if (/illustrator/i.test(app.name)) onAddFile(currentSpace?.id)
    else if (currentSpace) onOpenSpace(currentSpace.id)
  }

  return <footer className="calm-dock" aria-label="Быстрые действия">
    <div className="calm-dock-left">
      <button className="calm-capture" onClick={onCapture} title="Записать мысль · Ctrl + Alt + Space">
        <Plus size={19} /><span>Записать</span><kbd>Ctrl Alt Space</kbd>
      </button>
      <button className={`calm-dock-timer ${zenState.status === 'running' ? 'active' : ''}`} onClick={() => zenState.status === 'running' ? zenTimer.stop() : zenTimer.start(30, false)} title={zenState.status === 'running' ? 'Остановить сессию фокуса' : 'Начать фокус на 30 минут'}>
        <Timer size={18} /><span>{zenState.status === 'running' ? `Фокус ${Math.ceil(zenState.remainingSeconds / 60)} мин` : 'Фокус · 30 мин'}</span>
      </button>
      <button className={`calm-dock-timer dock-browser ${isWorkstageOpen ? 'active' : ''}`} onClick={() => onOpenWorkstage(currentSpace?.id)} title={currentSpace ? `Открыть вкладки «${currentSpace.name}»` : 'Открыть браузер'}>
        <Globe2 size={18} /><span>Браузер</span>
      </button>
    </div>
    <PlayerIsland onOpenSettings={onOpenSettings} />
    <div className="calm-apps" aria-label="Приложения">
      {apps.map(app => <div className="calm-app-wrapper" key={app.id}>
        <button className={`calm-app-btn ${activeAppId === app.id ? 'active' : ''}`} onClick={() => setActiveAppId(current => current === app.id ? null : app.id)} title={app.name} aria-expanded={activeAppId === app.id}>
          <span className="calm-app-icon">{appIcon(app.name)}</span><span>{app.name}</span>
        </button>
        {activeAppId === app.id && <AppLauncherPopover
          app={app}
          recentDocuments={getAppDocuments(app)}
          now={now}
          appIcon={appIcon}
          onOpenDocument={resource => { onOpenResource(resource); setActiveAppId(null) }}
          onOpenApp={resource => { onOpenResource(resource); setActiveAppId(null) }}
          onNewDocument={() => { newDocument(app); setActiveAppId(null) }}
          onAddDocument={() => { addDocument(app); setActiveAppId(null) }}
          onClose={() => setActiveAppId(null)}
        />}
      </div>)}
    </div>
  </footer>
}
