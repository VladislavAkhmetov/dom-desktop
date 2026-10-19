import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Archive, ArrowLeft, ArrowRight, Bookmark, BookOpen, CalendarDays, Check, ChevronDown, Folder, Globe2, History, LayoutGrid, Music2, PanelRight, Pause, PencilLine, Pin, RotateCw, Search, Settings2, Sparkles, SquarePlus, Star, Timer } from 'lucide-react'
import type { BrowserTab, HistoryItem, Space, UserProfile } from '../types'
import { audioManager } from '../player/audioStream'
import { getUserProfile } from '../userProfile'
import { ActionMenu } from '../ActionMenu'
import { isCabinetPreview } from '../cabinetMode'
import { buildOmniboxSuggestions, type OmniboxSuggestionItem } from './omniboxSuggestions'
import { bridge } from '../bridge'
import { PermissionPrompt, type PermissionRequestInfo } from './PermissionPrompt'
import { AdblockShield } from './AdblockShield'
import { TranslateButton } from './TranslateButton'
import '../cabinet.css'
import '../profile.css'

export interface BrowserChromeProps {
  space: Space
  spaces: Space[]
  tab?: BrowserTab
  history?: HistoryItem[]
  attentionIsland: (layoutLocked: boolean) => ReactNode
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
  onFocus: () => void
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
  permissionRequest?: PermissionRequestInfo | null
  onPermissionResponse?: (id: string, allowed: boolean | null) => void
  onReaderMode?: () => void
  isReaderActive?: boolean
}

export function BrowserChrome({ space, spaces, tab, history = [], attentionIsland, nativeNavigation, onHome, onSpace, onSpaceDashboard, onWeb, onAllSpaces, onNavigate, onNavigation, onSave, pageActions, onDay, onCapture, onAssistant, onFocus, onHistory, onSearch, onSettings, onPark, profile, onProfile, onNewSpace, onPinSpace, onRenameSpace, onArchiveSpace, materialsOpen, permissionRequest, onPermissionResponse, onReaderMode, isReaderActive }: BrowserChromeProps) {
  const [address, setAddress] = useState(tab?.url || '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [googleSuggestions, setGoogleSuggestions] = useState<string[]>([])
  const [hoveredControl, setHoveredControl] = useState(false)
  const [focusedControl, setFocusedControl] = useState(false)
  const [playing, setPlaying] = useState(audioManager.getIsPlaying())
  useEffect(() => audioManager.subscribe(() => setPlaying(audioManager.getIsPlaying())), [])
  const input = useRef<HTMLInputElement>(null)
  const omniboxRef = useRef<HTMLFormElement>(null)
  const editing = useRef(false)
  const keyboard = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    editing.current = false
    setShowSuggestions(false)
    setSelectedIndex(-1)
    setAddress(tab?.url || '')
    if (!tab?.url) input.current?.focus()
  }, [tab?.id, space.id])

  useEffect(() => {
    if (!editing.current) setAddress(tab?.url || '')
  }, [tab?.url])

  // Fetch Google suggestions on input change
  useEffect(() => {
    if (!editing.current || !address.trim()) {
      setGoogleSuggestions([])
      return
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      bridge.fetchSuggestions?.(address.trim())
        .then(results => {
          if (editing.current) setGoogleSuggestions(results || [])
        })
        .catch(() => setGoogleSuggestions([]))
    }, 150)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [address])

  // Click outside listener
  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!omniboxRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    }
    window.addEventListener('pointerdown', handleOutside)
    return () => window.removeEventListener('pointerdown', handleOutside)
  }, [])

  const suggestions = showSuggestions ? buildOmniboxSuggestions({
    query: address,
    spaces,
    history,
    googleSuggestions
  }) : []

  const handleSelectSuggestion = (item: OmniboxSuggestionItem) => {
    editing.current = false
    setShowSuggestions(false)
    setSelectedIndex(-1)
    onNavigate(item.value)
    input.current?.blur()
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSelectSuggestion(suggestions[selectedIndex])
      return
    }
    if (address.trim()) {
      editing.current = false
      setShowSuggestions(false)
      setSelectedIndex(-1)
      onNavigate(address.trim())
      input.current?.blur()
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && event.nativeEvent.isComposing) {
      event.preventDefault()
      return
    }
    if (event.key === 'ArrowDown') {
      if (suggestions.length > 0) {
        event.preventDefault()
        if (!showSuggestions) {
          setShowSuggestions(true)
          setSelectedIndex(0)
        } else {
          setSelectedIndex(prev => (prev + 1) % suggestions.length)
        }
      }
      return
    }
    if (event.key === 'ArrowUp') {
      if (suggestions.length > 0 && showSuggestions) {
        event.preventDefault()
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
      }
      return
    }
    if (event.key === 'Escape') {
      event.stopPropagation()
      setShowSuggestions(false)
      setSelectedIndex(-1)
      setAddress(tab?.url || '')
      event.currentTarget.blur()
    }
  }

  const saved = Boolean(tab?.url && spaces.some(owner => !owner.archivedAt && owner.resources.some(item => item.kind === 'link' && item.target === tab.url)))
  const holdsLayout = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('input, [role="menu"], [role="listbox"], button:not(.browser-day-pulse)'))
  const holdsFocus = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('input, [role="menu"], [role="listbox"]') || keyboard.current && target.closest('button:not(.browser-day-pulse)'))
  return <header className="browser-chrome browser-topbar">
    <div className="browser-topbar-main"
      onPointerOverCapture={event => setHoveredControl(event.currentTarget.contains(event.target as Node) && holdsLayout(event.target))}
      onPointerOutCapture={event => setHoveredControl(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget) && holdsLayout(event.relatedTarget))}
      onPointerLeave={() => setHoveredControl(false)}
      onPointerDownCapture={event => { keyboard.current = false; setFocusedControl(holdsFocus(event.target)) }}
      onKeyDownCapture={event => { keyboard.current = true; setFocusedControl(holdsFocus(event.target)) }}
      onFocusCapture={event => setFocusedControl(holdsFocus(event.target))}
      onBlurCapture={event => setFocusedControl(holdsFocus(event.relatedTarget))}>
      <div className="browser-context-controls">
      <button className="brand browser-home" data-workspace-navigation onClick={onHome} aria-label="Вернуться в дашборд" title="Вернуться в дашборд"><span className="brand-mark">✳</span><span>dombro<span className="brand-dot">.</span></span></button>
      <ActionMenu className="browser-menu browser-context-menu" label="Выбрать пространство" triggerContent={<><span>{space.kind === 'web' ? 'Браузинг' : space.name}</span><ChevronDown size={14} /></>} actions={[
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
      {isCabinetPreview && <button className="browser-new-cabinet" onClick={onNewSpace} title="Новое пространство — начать другую задачу" aria-label="Новое пространство"><SquarePlus size={18} /></button>}
      {isCabinetPreview && space.kind !== 'web' && <button className={`browser-materials-toggle ${materialsOpen ? 'is-selected' : ''}`} onClick={onSpaceDashboard} aria-expanded={Boolean(materialsOpen)} aria-label="Материалы пространства" title="Материалы и продолжение"><PanelRight size={17} /><span className="browser-materials-label">Материалы</span></button>}
      </div>
      <div className="browser-topbar-navigation" aria-label="Навигация страницы">
        <button onClick={() => onNavigation('back')} disabled={!nativeNavigation || !tab?.url} aria-label="Назад" title="Назад"><ArrowLeft size={18} /></button>
        <button onClick={() => onNavigation('forward')} disabled={!nativeNavigation || !tab?.url} aria-label="Вперёд" title="Вперёд"><ArrowRight size={18} /></button>
        <button onClick={() => onNavigation('reload')} disabled={!nativeNavigation || !tab?.url} aria-label="Обновить страницу" title="Обновить страницу"><RotateCw size={17} /></button>
      </div>
      <form ref={omniboxRef} className="browser-omnibox" onSubmit={handleSubmit}>
        <Search size={17} aria-hidden="true" />
        <input ref={input} className="browser-omnibox-input" aria-label="Адрес или поиск" placeholder="Адрес или поиск" value={address} autoComplete="off" spellCheck={false}
          onChange={event => {
            setAddress(event.target.value)
            setShowSuggestions(true)
            setSelectedIndex(-1)
          }}
          onFocus={event => {
            editing.current = true
            setShowSuggestions(true)
            setSelectedIndex(-1)
            event.currentTarget.select()
          }}
          onBlur={event => {
            if (omniboxRef.current?.contains(event.relatedTarget as Node)) return
            editing.current = false
            setShowSuggestions(false)
            setSelectedIndex(-1)
            setAddress(tab?.url || '')
          }}
          onKeyDown={handleKeyDown} />
        <button className="browser-address-submit" type="submit" aria-label="Перейти" title="Перейти" disabled={!address.trim()} onPointerDown={event => event.preventDefault()}><ArrowRight size={16} /></button>
        {tab?.readerable && onReaderMode && (
          <button
            type="button"
            className={`browser-reader-toggle ${isReaderActive ? 'is-active' : ''}`}
            onClick={onReaderMode}
            aria-label={isReaderActive ? 'Выйти из режима чтения' : 'Режим чистого чтения'}
            title={isReaderActive ? 'Выйти из режима чтения' : 'Режим чистого чтения'}
          >
            <BookOpen size={16} />
          </button>
        )}
        <TranslateButton tabId={tab?.id} lang={tab?.lang} onAiSummary={onAssistant} />
        <AdblockShield tabId={tab?.id} url={tab?.url} blockedCount={tab?.blockedCount} onReload={() => onNavigation('reload')} />
        {pageActions || <button className={`browser-save-page ${saved ? 'is-saved' : ''}`} type="button" onClick={onSave} disabled={!tab?.url} aria-label={saved ? 'Страница сохранена — выбрать место' : 'Сохранить страницу'} title={tab?.url ? 'Сохранить страницу · Ctrl D' : 'Сначала откройте страницу'}>{saved ? <Check size={17} /> : <Bookmark size={17} />}</button>}

        {permissionRequest && onPermissionResponse && (
          <PermissionPrompt
            request={permissionRequest}
            onRespond={allowed => onPermissionResponse(permissionRequest.id, allowed)}
          />
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className="omnibox-dropdown" role="listbox" aria-label="Подсказки адресной строки">
            {suggestions.map((item, index) => {
              const isSelected = index === selectedIndex
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`omnibox-suggestion-item ${isSelected ? 'is-selected' : ''}`}
                  onMouseDown={event => {
                    event.preventDefault()
                    handleSelectSuggestion(item)
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="omnibox-suggestion-icon" aria-hidden="true">
                    {item.type === 'search' && <Search size={15} />}
                    {item.type === 'url' && <Globe2 size={15} />}
                    {item.type === 'tab' && <SquarePlus size={15} />}
                    {item.type === 'bookmark' && <Bookmark size={15} />}
                    {item.type === 'history' && <History size={15} />}
                  </span>
                  <span className="omnibox-suggestion-content">
                    <span className="omnibox-suggestion-title">{item.title}</span>
                    {item.subtitle && <span className="omnibox-suggestion-subtitle">{item.subtitle}</span>}
                  </span>
                  <span className="omnibox-suggestion-badge">
                    {item.type === 'search' && 'Google'}
                    {item.type === 'url' && 'Сайт'}
                    {item.type === 'tab' && 'Вкладка'}
                    {item.type === 'bookmark' && 'Избранное'}
                    {item.type === 'history' && 'История'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </form>
      {attentionIsland(hoveredControl || focusedControl)}
      <div className="browser-quick-actions" aria-label="Быстрые действия">
        <button onClick={onCapture} aria-label="Записать" title="Записать мысль или дело"><PencilLine size={18} /></button>
        <button onClick={onAssistant} aria-label="Спросить ИИ" title="Спросить ИИ"><Sparkles size={18} /></button>
      </div>
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
        { label: 'План дня', icon: <CalendarDays size={18} />, onSelect: onDay },
        { label: 'Фокус', icon: <Timer size={18} />, onSelect: onFocus },
        { label: playing ? 'Пауза музыки' : 'Включить музыку', icon: playing ? <Pause size={18} /> : <Music2 size={18} />, onSelect: () => audioManager.togglePlay() },
        ...(onHistory ? [{ label: 'История', icon: <History size={18} />, onSelect: onHistory }] : []),
        { label: 'Поиск в Доме', icon: <Search size={18} />, onSelect: onSearch },
        { label: 'Сохранить и вернуться', icon: <Archive size={18} />, onSelect: onPark },
        { label: 'Настройки', icon: <Settings2 size={18} />, onSelect: onSettings }
      ]} />
    </div>
  </header>
}
