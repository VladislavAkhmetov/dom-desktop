import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Archive, ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, Clock3, Folder, FolderPlus, Globe2, History, LayoutGrid, Mail, PencilLine, Pin, RotateCw, Search, Settings2, Sparkles, Star, Timer } from 'lucide-react'
import type { BrowserTab, Space, UserProfile } from '../types'
import type { BrowserPulse } from './browserDayModel'
import { getUserProfile } from '../userProfile'
import { ActionMenu } from '../ActionMenu'
import { isCabinetPreview } from '../cabinetMode'
import '../cabinet.css'
import '../profile.css'

export interface BrowserChromeProps {
  space: Space
  spaces: Space[]
  tab?: BrowserTab
  pulse: BrowserPulse
  dayOpen: boolean
  nativeNavigation: boolean
  onHome: () => void
  onSpace: (spaceId: string) => void
  onSpaceDashboard: () => void
  onWeb: () => void
  onAllSpaces: () => void
  onNavigate: (address: string) => void
  onNavigation: (action: 'back' | 'forward' | 'reload') => void
  onSave: () => void
  pageActions?: ReactNode
  onDay: () => void
  onCapture: () => void
  onAssistant: () => void
  onHistory?: () => void
  onSearch: () => void
  onSettings: () => void
  onPark: () => void
  profile?: UserProfile
  onProfile?: (anchor: HTMLElement) => void
  onNewSpace?: () => void
  onPinSpace?: () => void
  onRenameSpace?: () => void
  onArchiveSpace?: () => void
  materialsOpen?: boolean
}

export function BrowserChrome({ space, spaces, tab, pulse, dayOpen, nativeNavigation, onHome, onSpace, onSpaceDashboard, onWeb, onAllSpaces, onNavigate, onNavigation, onSave, pageActions, onDay, onCapture, onAssistant, onHistory, onSearch, onSettings, onPark, profile, onProfile, onNewSpace, onPinSpace, onRenameSpace, onArchiveSpace, materialsOpen }: BrowserChromeProps) {
  const [address, setAddress] = useState(tab?.url || '')
  const input = useRef<HTMLInputElement>(null)
  const editing = useRef(false)
  useEffect(() => {
    editing.current = false
    setAddress(tab?.url || '')
    if (!tab?.url) input.current?.focus()
  }, [tab?.id, space.id])
  useEffect(() => { if (!editing.current) setAddress(tab?.url || '') }, [tab?.url])
  const saved = Boolean(tab?.url && spaces.some(owner => !owner.archivedAt && owner.resources.some(item => item.kind === 'link' && item.target === tab.url)))
  const PulseIcon = pulse.kind === 'focus' ? Timer : pulse.kind === 'mail' ? Mail : pulse.kind === 'event' || pulse.kind === 'task' ? Clock3 : LayoutGrid
  return <header className="browser-chrome browser-topbar">
    <div className="browser-topbar-main">
      <button className="brand browser-home" data-workspace-navigation onClick={onHome} aria-label="Вернуться в дашборд" title="Вернуться в дашборд"><span className="brand-mark">✳</span><span>dombro<span className="brand-dot">.</span></span></button>
      <ActionMenu className="browser-menu browser-context-menu" label="Выбрать пространство" triggerContent={<>{space.kind === 'web' ? <Globe2 size={17} /> : <Folder size={17} />}<span>{space.kind === 'web' ? 'Браузинг' : space.name}</span><ChevronDown size={14} /></>} actions={[
        ...(space.kind !== 'web' ? [{ id: 'current-space', label: 'Материалы пространства', icon: <Folder size={17} />, onSelect: onSpaceDashboard }] : []),
        { id: 'web', label: isCabinetPreview ? 'Избранное' : 'Браузинг и избранное', icon: space.kind === 'web' ? <Check size={17} /> : <Star size={17} />, onSelect: onWeb },
        ...spaces.filter(item => !item.archivedAt && item.kind !== 'web').map(item => ({ id: item.id, label: item.name, icon: item.id === space.id ? <Check size={17} /> : <Folder size={17} />, onSelect: () => onSpace(item.id) })),
        { id: 'spaces', label: 'Все пространства', icon: <LayoutGrid size={17} />, onSelect: onAllSpaces },
        ...(isCabinetPreview && space.kind !== 'web' ? [
          { id: 'pin-space', label: space.pinned ? 'Открепить от меню' : 'Закрепить в меню', icon: <Pin size={17} />, onSelect: () => onPinSpace?.() },
          { id: 'rename-space', label: 'Переименовать пространство', icon: <PencilLine size={17} />, onSelect: () => onRenameSpace?.() },
          { id: 'archive-space', label: 'В архив', icon: <Archive size={17} />, onSelect: () => onArchiveSpace?.() }
        ] : [])
      ]} />
      {isCabinetPreview && <button className="browser-new-cabinet" onClick={onNewSpace} title="Новое пространство — начать другую задачу" aria-label="Новое пространство"><FolderPlus size={18} /><span>Новое</span></button>}
      {isCabinetPreview && space.kind !== 'web' && <button className={`browser-materials-toggle ${materialsOpen ? 'is-selected' : ''}`} onClick={onSpaceDashboard} aria-expanded={Boolean(materialsOpen)} aria-label="Материалы пространства" title="Материалы и продолжение"><Folder size={17} /><span>Материалы</span></button>}
      <div className="browser-topbar-navigation" aria-label="Навигация страницы">
        <button onClick={() => onNavigation('back')} disabled={!nativeNavigation || !tab?.url} aria-label="Назад" title="Назад"><ArrowLeft size={18} /></button>
        <button onClick={() => onNavigation('forward')} disabled={!nativeNavigation || !tab?.url} aria-label="Вперёд" title="Вперёд"><ArrowRight size={18} /></button>
        <button onClick={() => onNavigation('reload')} disabled={!nativeNavigation || !tab?.url} aria-label="Обновить страницу" title="Обновить страницу"><RotateCw size={17} /></button>
        {onHistory && <button onClick={onHistory} aria-label="История браузера" title="История · Ctrl H"><History size={17} /></button>}
      </div>
      <form className="browser-omnibox" onSubmit={event => { event.preventDefault(); if (address.trim()) { editing.current = false; onNavigate(address.trim()); input.current?.blur() } }}>
        <Search size={17} aria-hidden="true" />
        <input ref={input} className="browser-omnibox-input" aria-label="Адрес или поиск" placeholder="Адрес или поиск" value={address} autoComplete="off" spellCheck={false}
          onChange={event => setAddress(event.target.value)} onFocus={event => { editing.current = true; event.currentTarget.select() }}
          onBlur={() => { editing.current = false; setAddress(tab?.url || '') }}
          onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); if (event.key === 'Escape') { event.stopPropagation(); setAddress(tab?.url || ''); event.currentTarget.blur() } }} />
        <button className="browser-address-submit" type="submit" aria-label="Перейти" title="Перейти" disabled={!address.trim()} onPointerDown={event => event.preventDefault()}><ArrowRight size={16} /></button>
        {pageActions || <button className={`browser-save-page ${saved ? 'is-saved' : ''}`} type="button" onClick={onSave} disabled={!tab?.url} aria-label={saved ? 'Страница сохранена — выбрать место' : 'Сохранить страницу'} title={tab?.url ? 'Сохранить страницу · Ctrl D' : 'Сначала откройте страницу'}>{saved ? <Check size={17} /> : <Bookmark size={17} />}</button>}
      </form>
      <button className={`browser-day-pulse ${pulse.urgent ? 'is-urgent' : ''} ${dayOpen ? 'is-open' : ''}`} onClick={onDay} aria-expanded={dayOpen} aria-controls={dayOpen ? 'browser-day-panel' : undefined} aria-label={`Мой день: ${pulse.title}. ${pulse.detail}`} title={`${pulse.title} · ${pulse.detail}`}>
        <span className="browser-pulse-icon"><PulseIcon size={15} /></span><span className="browser-pulse-copy"><strong>{pulse.title}</strong><small>{pulse.detail}</small></span><ChevronDown size={14} />
      </button>
      {onProfile && (() => {
        const userProfile = getUserProfile(profile ? { userProfile: profile } as any : undefined)
        return (
          <button
            className="chrome-button chrome-profile browser-profile-btn"
            onClick={event => onProfile(event.currentTarget)}
            aria-label={`Профиль: ${userProfile.name}`}
            title={`Профиль: ${userProfile.name}`}
          >
            <span className={`profile-avatar-pill tone-${userProfile.avatarTone || 'sage'}`}>
              {userProfile.avatarEmoji || (userProfile.name.trim().charAt(0).toUpperCase() || 'П')}
            </span>
          </button>
        )
      })()}
      <ActionMenu className="browser-menu browser-main-menu" label="Меню Дома" actions={[
        { label: 'Записать', icon: <PencilLine size={18} />, onSelect: onCapture },
        { label: 'Спросить ИИ', icon: <Sparkles size={18} />, onSelect: onAssistant },
        ...(onHistory ? [{ label: 'История', icon: <History size={18} />, onSelect: onHistory }] : []),
        { label: 'Поиск в Доме', icon: <Search size={18} />, onSelect: onSearch },
        { label: 'Сохранить и вернуться', icon: <Archive size={18} />, onSelect: onPark },
        { label: 'Настройки', icon: <Settings2 size={18} />, onSelect: onSettings }
      ]} />
    </div>
  </header>
}
