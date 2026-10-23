import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PenLine, Pin, Plus, Sparkles, Timer, X } from 'lucide-react'
import type { AppState, RecentFile, Resource } from './types'
import { zenTimer } from './focus/zenTimer'
import { PlayerIsland } from './player/PlayerIsland'
import { AppLauncherPopover } from './AppLauncherPopover'
import { QuickAppsSettings } from './QuickAppsSettings'
import { QuickEntry } from './QuickEntry'
import { AnimatePresence } from 'motion/react'
import { FluidButton, FluidSurface } from './FluidMotion'
import { isAssistantEnabled } from './assistantModel'
import './digest.css'

interface Props {
  state: AppState
  now: Date
  currentSpaceId?: string
  recentFiles?: RecentFile[]
  appIcon: (name: string) => ReactNode
  onCapture: () => void
  onFocus: () => void
  onSaveThought: (title: string, dueAt: string | null, plannedDate?: string | null, kind?: 'note' | 'task') => unknown
  onAssistant: (draft?: string) => void
  onOpenResource: (resource: Resource) => void
  onAddLink: (spaceId?: string) => void
  onAddFile: (spaceId?: string) => void
  onOpenSettings: () => void
  onChange: (update: (state: AppState) => AppState) => unknown
  onAddApp: (spaceId?: string) => void
}

export function BottomDock({ state, now, currentSpaceId, recentFiles, appIcon, onFocus, onSaveThought, onAssistant, onOpenResource, onAddLink, onAddFile, onOpenSettings, onChange, onAddApp }: Props) {
  const [entryMode, setEntryMode] = useState<'note' | 'ai' | null>(null)
  const entryAnchor = useRef<HTMLDivElement>(null)
  const noteButton = useRef<HTMLButtonElement>(null)
  const aiButton = useRef<HTMLButtonElement>(null)
  const closeEntry = (restoreFocus = false) => {
    if (restoreFocus) (entryMode === 'ai' ? aiButton : noteButton).current?.focus()
    setEntryMode(null)
  }
  useEffect(() => {
    const open = () => { setActiveAppId(null); setEntryMode('note') }
    window.addEventListener('dom:quick-entry', open)
    return () => window.removeEventListener('dom:quick-entry', open)
  }, [])
  useEffect(() => {
    if (!entryMode) return
    const outside = (event: PointerEvent) => { if (!entryAnchor.current?.contains(event.target as Node)) setEntryMode(null) }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('.calm-backdrop')) return
      event.preventDefault(); closeEntry(true)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [entryMode])
  const [zenState, setZenState] = useState(zenTimer.getState())
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  const [editingApps, setEditingApps] = useState(false)
  useEffect(() => zenTimer.subscribe(setZenState), [])

  const apps = state.spaces.flatMap(space => space.resources.filter(resource => resource.kind === 'app'))
    .sort((a, b) => Number(Boolean(b.pinnedToDock)) - Number(Boolean(a.pinnedToDock)) || Date.parse(b.lastOpenedAt || b.createdAt) - Date.parse(a.lastOpenedAt || a.createdAt))
    .filter((app, index, all) => all.findIndex(item => item.target.toLowerCase() === app.target.toLowerCase()) === index).slice(0, 4)
  const currentSpace = state.spaces.find(space => space.id === currentSpaceId) || state.spaces[0]

  function getAppDocuments(app: Resource) {
    const docs = state.spaces.flatMap(space => space.resources
      .filter(resource => resource.kind !== 'app')
      .map(resource => ({ ...resource, spaceName: space.name })))
    const matches = docs.filter(doc => {
      if (/figma/i.test(app.name)) return doc.kind === 'link' && /figma\.com/i.test(doc.target)
      if (/illustrator/i.test(app.name)) return doc.kind === 'file' && /\.(ai|eps|svg|ait)$/i.test(doc.target)
      if (/photoshop/i.test(app.name)) return doc.kind === 'file' && /\.(psd|psb)$/i.test(doc.target)
      if (/indesign/i.test(app.name)) return doc.kind === 'file' && /\.(indd|idml)$/i.test(doc.target)
      if (/word/i.test(app.name)) return doc.kind === 'file' && /\.(docx?|rtf)$/i.test(doc.target)
      if (/excel/i.test(app.name)) return doc.kind === 'file' && /\.(xlsx?|csv)$/i.test(doc.target)
      if (/powerpoint/i.test(app.name)) return doc.kind === 'file' && /\.pptx?$/i.test(doc.target)
      return doc.target.toLowerCase().includes(app.name.toLowerCase())
    })
    const extraDocs: Array<Resource & { spaceName?: string }> = []
    if (recentFiles?.length) {
      for (const rf of recentFiles) {
        const ext = rf.target.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || ''
        let match = false
        if (/photoshop/i.test(app.name) && ['psd', 'psb', 'png', 'jpg', 'jpeg'].includes(ext)) match = true
        else if (/illustrator/i.test(app.name) && ['ai', 'eps', 'svg'].includes(ext)) match = true
        else if (/word/i.test(app.name) && ['doc', 'docx', 'rtf'].includes(ext)) match = true
        else if (/excel/i.test(app.name) && ['xls', 'xlsx', 'csv'].includes(ext)) match = true
        else if (/powerpoint/i.test(app.name) && ['ppt', 'pptx'].includes(ext)) match = true
        else if (/indesign/i.test(app.name) && ['indd', 'idml'].includes(ext)) match = true
        else if (rf.target.toLowerCase().includes(app.name.toLowerCase())) match = true
        if (match && !docs.some(d => d.target.toLowerCase() === rf.target.toLowerCase())) {
          extraDocs.push({
            id: `recent:${rf.target}`,
            name: rf.name,
            kind: 'file',
            target: rf.target,
            createdAt: rf.modifiedAt,
            lastOpenedAt: rf.modifiedAt,
            spaceName: 'Недавний в системе'
          })
        }
      }
    }
    const combined = [...matches, ...extraDocs]
    return combined.sort((a, b) => Date.parse(b.lastOpenedAt || b.createdAt) - Date.parse(a.lastOpenedAt || a.createdAt))
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
    else onAddFile(currentSpace?.id)
  }

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  const captureShortcut = isMac ? 'Cmd + Shift + Space' : 'Ctrl + Shift + Space'

  return <footer className="hub-bottom" aria-label="Быстрые действия"><div className="calm-dock">
    <div className="calm-dock-left">
      <div className="dock-entry-anchor" ref={entryAnchor}>
        <FluidButton ref={noteButton} className="calm-capture dock-entry-button" onClick={() => { setActiveAppId(null); setEntryMode(entryMode === 'note' ? null : 'note') }} title={`Записать · ${captureShortcut}`} aria-expanded={entryMode === 'note'} aria-controls={entryMode ? 'dock-quick-entry' : undefined} aria-haspopup="dialog"><PenLine size={19} /><span>Записать</span></FluidButton>
        {isAssistantEnabled && (
          <FluidButton ref={aiButton} className="dock-entry-button" onClick={() => { setActiveAppId(null); setEntryMode(entryMode === 'ai' ? null : 'ai') }} aria-expanded={entryMode === 'ai'} aria-controls={entryMode ? 'dock-quick-entry' : undefined} aria-haspopup="dialog"><Sparkles size={19} /><span>Спросить ИИ</span></FluidButton>
        )}
        <AnimatePresence>{entryMode && <FluidSurface key="quick-entry" className="dock-entry-popover" id="dock-quick-entry" role="dialog" aria-label={entryMode === 'note' ? 'Быстрая запись' : 'Вопрос ИИ'} style={{ x: '-50%', transformOrigin: 'bottom center' }}>
          <button className="dock-entry-close calm-icon" aria-label="Закрыть быстрый ввод" onClick={() => closeEntry(true)}><X size={20} /></button>
          <QuickEntry mode={entryMode} onModeChange={setEntryMode} showModes={false} autoFocus onSave={onSaveThought} onAssistant={draft => { setEntryMode(null); onAssistant(draft) }} />
        </FluidSurface>}</AnimatePresence>
      </div>
      <FluidButton className={`calm-dock-timer ${zenState.status === 'running' ? 'active' : ''}`} onClick={onFocus} title={zenState.task?.title || (zenState.status === 'running' ? 'Открыть сессию фокуса' : 'Выбрать дело для фокуса')}>
        <Timer size={18} /><span>{zenState.status === 'running' ? `Фокус · ${String(Math.floor(zenState.remainingSeconds / 60)).padStart(2, '0')}:${String(zenState.remainingSeconds % 60).padStart(2, '0')}` : zenState.status === 'completed' ? 'Фокус завершён' : 'Фокус'}</span>
      </FluidButton>
    </div>
    <PlayerIsland onOpenSettings={onOpenSettings} />
    </div>
    <div className="calm-apps" aria-label="Приложения">
      {apps.map(app => <div className="calm-app-wrapper" key={app.id}>
        <button className={`calm-app-btn ${activeAppId === app.id ? 'active' : ''}`} onClick={() => setActiveAppId(current => current === app.id ? null : app.id)} title={`${app.name}${app.pinnedToDock ? ' · закреплено' : ' · недавнее'}`} aria-label={app.name} aria-expanded={activeAppId === app.id}>
          <span className="calm-app-icon">{appIcon(app.name)}</span>{app.pinnedToDock && <Pin size={10} className="quick-app-pin" />}
        </button>
        {activeAppId === app.id && <AppLauncherPopover
          app={app}
          recentDocuments={getAppDocuments(app)}
          now={now}
          appIcon={appIcon}
          onOpenDocument={resource => { onOpenResource(resource); setActiveAppId(null) }}
          onOpenApp={resource => { onOpenResource(/^https?:\/\//i.test(resource.target) ? { ...resource, kind: 'link' } : resource); setActiveAppId(null) }}
          onNewDocument={() => { newDocument(app); setActiveAppId(null) }}
          onAddDocument={() => { addDocument(app); setActiveAppId(null) }}
          onClose={() => setActiveAppId(null)}
        />}
      </div>)}
      <button className="quick-app-add" aria-label="Настроить быстрые приложения" title="Добавить или закрепить приложение" onClick={() => { setActiveAppId(null); setEditingApps(true) }}><Plus size={18} strokeWidth={2} /></button>
    </div>
    {editingApps && <QuickAppsSettings state={state} onChange={onChange} currentSpaceId={currentSpace?.id} appIcon={appIcon} onPick={() => onAddApp(currentSpace?.id)} onClose={() => setEditingApps(false)} />}
  </footer>
}
