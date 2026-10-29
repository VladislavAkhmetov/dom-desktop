import { useId, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  Compass,
  Database,
  ExternalLink,
  FolderInput,
  Info,
  Play,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  User,
  X
} from 'lucide-react'
import { bridge, isDesktop } from './bridge'
import { isDemo } from './demo'
import { Dialog } from './Dialog'
import { FluidGroup } from './FluidMotion'
import { PasswordSettings } from './PasswordSettings'
import { PrivacySettings } from './PrivacySettings'
import type { AppState, SupportedLocale } from './types'
import { getUserProfile, updateUserProfile, PROFILE_TONES } from './userProfile'
import { PROFILE_ICONS, ProfileGlyph } from './ProfileGlyph'
import { useI18n, SUPPORTED_LOCALES, translate, type TranslationKey } from './i18n'
import { sound } from './sound'
import { WallpaperPicker } from './WallpaperPicker'
import { useUpdateReady } from './useUpdateReady'
import './settings.css'
import './profile.css'

export type SettingsSectionId = 'profile' | 'general' | 'browser' | 'passwords' | 'about' | 'calendars' | 'mail' | 'news' | 'privacy'

export function Settings({
  state,
  onChange,
  onClose,
  onDashboard,
  autostart,
  onAutostart,
  onBackup,
  initialSection,
  onImport
}: {
  state: AppState
  onChange: (update: (state: AppState) => AppState) => unknown
  onClose: () => void
  onDashboard: () => void
  autostart: boolean
  onAutostart: (enabled: boolean) => unknown
  onBackup: () => unknown
  initialSection?: SettingsSectionId
  onImport?: () => void
  // Legacy props kept as optional for backward compatibility
  calendarName?: string
  calendarUrl?: string
  onCalendarName?: (value: string) => void
  onCalendarUrl?: (value: string) => void
  onAddCalendar?: () => unknown
  onRemoveCalendar?: (id: string) => unknown
  onCalendarRefresh?: () => unknown
  calendarRefreshing?: boolean
  onNewsRefresh?: () => unknown
  newsRefreshing?: boolean
}) {
  const i18n = useI18n()
  const currentLocale: SupportedLocale = state.locale || i18n.locale || 'ru'
  const t = (key: TranslationKey, params?: Record<string, string | number>) => translate(currentLocale, key, params)
  const updateReady = useUpdateReady()

  const sections = useMemo(() => [
    {
      id: 'profile' as const,
      label: t('settings.sections.profile'),
      icon: User,
      description: t('settings.sections.profile_desc'),
      keywords: t('settings.sections.profile_keywords'),
      group: t('settings.groups.app')
    },
    {
      id: 'general' as const,
      label: t('settings.sections.general'),
      icon: Settings2,
      description: t('settings.sections.general_desc'),
      keywords: `${t('settings.sections.general_keywords')} обои фон видео wallpaper background sound звук`,
      group: t('settings.groups.app')
    },
    {
      id: 'browser' as const,
      label: t('settings.sections.browser') || (currentLocale === 'ru' ? 'Браузер и память' : 'Browser & Memory'),
      icon: Compass,
      description: t('settings.sections.browser_desc') || (currentLocale === 'ru' ? 'Поисковая система, управление памятью и быстрый ввод.' : 'Search engine, memory parking and quick entry.'),
      keywords: t('settings.sections.browser_keywords') || 'браузер поиск search google duckduckgo yandex память вкладки выгрузка park ram autostart',
      group: t('settings.groups.browser') || (currentLocale === 'ru' ? 'Браузер' : 'Browser')
    },
    {
      id: 'passwords' as const,
      label: t('settings.sections.passwords'),
      icon: ShieldCheck,
      description: t('settings.sections.passwords_desc'),
      keywords: `${t('settings.sections.passwords_keywords')} adblock реклама трекеры ghostery safeStorage bitwarden`,
      group: t('settings.groups.security')
    },
    {
      id: 'about' as const,
      label: t('settings.sections.about') || (currentLocale === 'ru' ? 'О программе' : 'About Dombro'),
      icon: Info,
      description: t('settings.sections.about_desc') || (currentLocale === 'ru' ? 'Версия Dombro, обновления и резервная копия.' : 'Dombro version, updates and SQLite backup.'),
      keywords: t('settings.sections.about_keywords') || 'о программе версия updates обновления копия backup sqlite релизы github about',
      group: t('settings.groups.system') || (currentLocale === 'ru' ? 'Система' : 'System')
    }
  ], [currentLocale])

  const groups = useMemo(() => [
    t('settings.groups.app'),
    t('settings.groups.browser') || (currentLocale === 'ru' ? 'Браузер' : 'Browser'),
    t('settings.groups.security'),
    t('settings.groups.system') || (currentLocale === 'ru' ? 'Система' : 'System')
  ], [currentLocale])

  const normalizedInitial = (initialSection === 'privacy' || initialSection === 'passwords')
    ? 'passwords'
    : (initialSection === 'calendars' || initialSection === 'mail' || initialSection === 'news')
      ? 'browser'
      : (initialSection || 'general')

  const [active, setActive] = useState<SettingsSectionId>(normalizedInitial)
  const [query, setQuery] = useState('')
  const id = useId()
  const normalizedQuery = query.trim().toLocaleLowerCase(currentLocale)
  const matches = sections.filter(section => `${section.label} ${section.keywords}`.toLocaleLowerCase(currentLocale).includes(normalizedQuery))
  const selected = sections.find(section => section.id === active) || sections[0]
  const [soundEnabled, setSoundEnabled] = useState(() => sound.enabled)
  const [parkingStatus, setParkingStatus] = useState<string | null>(null)

  const handleToggleSound = () => {
    const next = sound.toggle()
    setSoundEnabled(next)
  }

  const handleLocaleChange = (newLocale: SupportedLocale) => {
    i18n.setLocale(newLocale)
    onChange(prev => ({ ...prev, locale: newLocale }))
  }

  const handleManualPark = async () => {
    if (!bridge.browser?.park) return
    setParkingStatus('Выгружаем неактивные вкладки…')
    try {
      const res = await bridge.browser.park([])
      setParkingStatus(`Освобождено памяти: ${res?.freedMB || 0} МБ (защищено активных вкладок: ${res?.protectedCount || 0})`)
      setTimeout(() => setParkingStatus(null), 4000)
    } catch {
      setParkingStatus('Вкладки защищены от выгрузки')
      setTimeout(() => setParkingStatus(null), 3000)
    }
  }

  const handleToggleAdblock = async () => {
    const next = state.adblockEnabled === false
    onChange(prev => ({ ...prev, adblockEnabled: next }))
    try {
      await bridge.browser?.toggleAdblockGlobal?.(next)
    } catch {
      // safe fallback
    }
  }

  return (
    <Dialog title={t('settings.title')} className="app-dialog settings-dialog" onClose={onClose}>
      <div className="settings-layout">
        <aside className="settings-sidebar">
          <div className="settings-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label={t('settings.search_placeholder')}
              placeholder={t('settings.search_placeholder')}
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            {query && <button aria-label={t('settings.clear_search')} onClick={() => setQuery('')}><X size={15} /></button>}
          </div>
          <FluidGroup as="nav" className="settings-nav" aria-label={t('settings.title')} axis="y" itemSelector=".settings-nav-group > button">
            {groups.map(group => {
              const entries = matches.filter(section => section.group === group)
              return entries.length > 0 && (
                <div className="settings-nav-group" key={group}>
                  <span className="settings-nav-label">{group}</span>
                  {entries.map(section => (
                    <button
                      key={section.id}
                      id={`${id}-${section.id}-tab`}
                      aria-current={active === section.id ? 'page' : undefined}
                      aria-controls={`${id}-${section.id}-panel`}
                      data-dialog-focus={section.id === 'general' ? true : undefined}
                      onClick={() => setActive(section.id)}
                    >
                      <section.icon size={18} strokeWidth={1.7} />
                      <span>{section.label}</span>
                    </button>
                  ))}
                </div>
              )
            })}
            {matches.length === 0 && <p className="settings-search-empty">{t('settings.not_found')}</p>}
          </FluidGroup>
        </aside>

        <div className="settings-content">
          <header
            className="settings-section-heading"
            onWheel={event => {
              const activePanel = event.currentTarget.parentElement?.querySelector<HTMLElement>('.settings-panel:not([hidden])')
              if (activePanel) activePanel.scrollTop += event.deltaY
            }}
          >
            <h3>{selected.label}</h3>
            <p>{selected.description}</p>
          </header>

          {sections.map(section => (
            <section
              key={section.id}
              className="settings-panel"
              id={`${id}-${section.id}-panel`}
              aria-label={section.label}
              hidden={active !== section.id}
            >
              {/* 1. ПРОФИЛЬ */}
              {section.id === 'profile' && (() => {
                const profile = getUserProfile(state)
                return (
                  <div className="settings-columns">
                    <div className="settings-card">
                      <div className="profile-preview-card">
                        <div className={`profile-avatar-large tone-${profile.avatarTone || 'sage'}`}>
                          <ProfileGlyph profile={profile} size={26} />
                        </div>
                        <div className="profile-info">
                          <strong style={{ fontSize: 16, color: 'var(--ink-1)' }}>{profile.name}</strong>
                          <small style={{ color: 'var(--ink-3)' }}>{profile.status || t('settings.profile.local_profile')}</small>
                        </div>
                      </div>
                      <div className="form-stack">
                        <label>
                          {t('settings.profile.user_name')}
                          <input
                            aria-label={t('settings.profile.user_name')}
                            value={profile.name}
                            onChange={e => onChange(prev => updateUserProfile(prev, { name: e.target.value }))}
                            placeholder={t('settings.profile.user_name_placeholder')}
                          />
                        </label>
                        <label>
                          {t('settings.profile.user_status')}
                          <input
                            aria-label={t('settings.profile.user_status')}
                            value={profile.status || ''}
                            onChange={e => onChange(prev => updateUserProfile(prev, { status: e.target.value }))}
                            placeholder={t('settings.profile.user_status_placeholder')}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <h4 style={{ margin: '0 0 10px' }}>{t('settings.profile.avatar_style')}</h4>
                        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-3)', display: 'block', marginBottom: 8 }}>{t('settings.profile.color_tone')}</span>
                        <div className="profile-tones-bar" role="radiogroup" aria-label="Цвет профиля">
                          {PROFILE_TONES.map(item => (
                            <button
                              key={item.tone}
                              type="button"
                              className={`profile-tone-btn tone-${item.tone} ${profile.avatarTone === item.tone ? 'active' : ''}`}
                              title={item.label}
                              aria-label={item.label}
                              aria-checked={profile.avatarTone === item.tone}
                              role="radio"
                              onClick={() => onChange(prev => updateUserProfile(prev, { avatarTone: item.tone }))}
                              style={{ background: `rgba(var(--space-tint, 186, 216, 185), 0.85)` }}
                            >
                              {profile.avatarTone === item.tone && <Check size={12} color="#fff" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--ink-3)', display: 'block', marginBottom: 8 }}>{t('settings.profile.emoji_icon')}</span>
                        <div className="profile-emojis-bar">
                          {PROFILE_ICONS.map(({ id: iconId, Icon, label }) => (
                            <button
                              key={iconId}
                              type="button"
                              className={`profile-emoji-btn ${profile.avatarEmoji === iconId ? 'active' : ''}`}
                              onClick={() => onChange(prev => updateUserProfile(prev, { avatarEmoji: iconId }))}
                              aria-label={`Значок: ${label}`}
                              aria-pressed={profile.avatarEmoji === iconId}
                            >
                              <Icon size={16} aria-hidden="true" />
                            </button>
                          ))}
                          <button
                            type="button"
                            className="profile-emoji-clear"
                            onClick={() => onChange(prev => updateUserProfile(prev, { avatarEmoji: '' }))}
                            title={t('settings.profile.reset_initial')}
                          >
                            {t('settings.profile.reset_btn')}
                          </button>
                        </div>
                      </div>

                      {onImport && (
                        <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
                          <h4 style={{ margin: '0 0 6px' }}>{t('settings.profile.data_migration')}</h4>
                          <p style={{ margin: '0 0 10px', fontSize: 'var(--fs-meta)', color: 'var(--ink-3)', lineHeight: 1.4 }}>
                            {t('settings.profile.import_chrome_desc')}
                          </p>
                          <button className="soft-button" onClick={() => { onClose(); onImport() }}>
                            <FolderInput size={15} style={{ marginRight: 6 }} />
                            {t('settings.profile.import_chrome_btn')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* 2. ВНЕШНИЙ ВИД И ЗВУК (GENERAL) */}
              {section.id === 'general' && (
                <div className="settings-general">
                  <div className="settings-card">
                    <div className="settings-card-heading">
                      <h4>{t('settings.general.language_title')}</h4>
                    </div>
                    <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-meta)', color: 'var(--ink-3)' }}>
                      {t('settings.general.language_desc')}
                    </p>
                    <div className="language-selector-grid" role="radiogroup" aria-label={t('settings.general.language_title')}>
                      {SUPPORTED_LOCALES.map(loc => (
                        <button
                          key={loc.code}
                          type="button"
                          className={`language-option-btn ${currentLocale === loc.code ? 'active' : ''}`}
                          role="radio"
                          aria-checked={currentLocale === loc.code}
                          onClick={() => handleLocaleChange(loc.code)}
                        >
                          <span className="language-flag">{loc.flag}</span>
                          <span className="language-name">{loc.nativeName}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-card">
                    <WallpaperPicker
                      current={state.backgroundImage}
                      onChange={url => onChange(prev => ({ ...prev, backgroundImage: url }))}
                    />
                  </div>

                  <div className="settings-card">
                    <div className="setting-row">
                      <span>
                        <strong>{currentLocale === 'en' ? 'Calm Tech tactile sound' : 'Тактильные звуки Calm Tech'}</strong>
                        <small>{currentLocale === 'en' ? 'Soft procedural wood snaps, paper rustle, and exhale without harsh frequencies' : 'Мягкие процедурные щелчки дерева, шелест бумаги и выдох без резких частот'}</small>
                      </span>
                      <button
                        className={`toggle ${soundEnabled ? 'on' : ''}`}
                        role="switch"
                        aria-checked={soundEnabled}
                        aria-label={currentLocale === 'en' ? 'Calm Tech tactile sound' : 'Тактильные звуки Calm Tech'}
                        onClick={handleToggleSound}
                      >
                        <span />
                      </button>
                    </div>

                    {soundEnabled && (
                      <div className="setting-row sound-preview-row">
                        <span>
                          <strong>{currentLocale === 'en' ? 'Listen' : 'Послушать'}</strong>
                          <small>{currentLocale === 'en' ? 'Soft plucked and wooden sounds, quieter than the system' : 'Мягкие щипки и дерево — тише системных звуков'}</small>
                        </span>
                        <div className="sound-preview" role="group" aria-label={currentLocale === 'en' ? 'Sound preview' : 'Прослушать звуки'}>
                          {([
                            ['Напоминание', 'Reminder', () => sound.playReminderChime()],
                            ['Встреча', 'Meeting', () => sound.playEventSoon()],
                            ['Сделано', 'Done', () => sound.playTaskDone()],
                            ['Позже', 'Later', () => sound.playReminderLater()]
                          ] as const).map(([ru, en, play]) => (
                            <button key={ru} type="button" className="calm-chip sound-preview-chip" onClick={play}>
                              <Play size={14} aria-hidden="true" />
                              {currentLocale === 'en' ? en : ru}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="setting-row">
                      <span>
                        <strong>{t('settings.general.hints_heading')}</strong>
                        <small>{t('settings.general.hints_sub')}</small>
                      </span>
                      <button
                        className={`toggle ${state.liveHints !== false ? 'on' : ''}`}
                        role="switch"
                        aria-checked={state.liveHints !== false}
                        aria-label={t('settings.general.hints_heading')}
                        onClick={() => onChange(previous => ({ ...previous, liveHints: previous.liveHints === false }))}
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. БРАУЗЕР И ПАМЯТЬ */}
              {section.id === 'browser' && (
                <div className="settings-general">
                  <div className="settings-card">
                    <h4>{currentLocale === 'en' ? 'Search Engine & Omnibox' : 'Поиск в интернете и адресная строка'}</h4>
                    <div className="setting-row">
                      <span>
                        <strong>{currentLocale === 'en' ? 'Default search engine' : 'Поисковая система по умолчанию'}</strong>
                        <small>{currentLocale === 'en' ? 'Used when typing search queries directly into the address bar' : 'Используется при вводе поисковых запросов в омнибокс'}</small>
                      </span>
                      <select
                        aria-label="Поисковая система"
                        value={state.searchEngine || 'google'}
                        onChange={e => onChange(prev => ({ ...prev, searchEngine: e.target.value as any }))}
                        style={{ minWidth: 160, minHeight: 38, padding: '0 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-strong)', background: 'var(--surface-field)', color: 'var(--ink-1)', fontSize: 'var(--fs-meta)' }}
                      >
                        <option value="google">Google</option>
                        <option value="duckduckgo">DuckDuckGo (Конфиденциальный)</option>
                        <option value="yandex">Яндекс</option>
                        <option value="ecosia">Ecosia</option>
                      </select>
                    </div>

                    <div className="setting-row">
                      <span>
                        <strong>{currentLocale === 'en' ? 'Search suggestions from Google' : 'Подсказки поиска от Google'}</strong>
                        <small>{currentLocale === 'en' ? 'Typed words are sent to Google. Addresses, paths and e-mails are never sent.' : 'Введённые слова уходят в Google. Адреса, пути и почта не отправляются никогда.'}</small>
                      </span>
                      <button
                        className={`toggle ${state.searchSuggestions ? 'on' : ''}`}
                        role="switch"
                        aria-checked={Boolean(state.searchSuggestions)}
                        aria-label={currentLocale === 'en' ? 'Search suggestions from Google' : 'Подсказки поиска от Google'}
                        onClick={() => onChange(previous => ({ ...previous, searchSuggestions: !previous.searchSuggestions }))}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="setting-row">
                      <span>
                        <strong>{t('settings.general.quick_entry_heading')}</strong>
                        <small>{t('settings.general.quick_entry_sub')}</small>
                      </span>
                      <kbd>{bridge.platform === 'darwin' ? '⌘ ⇧ Space' : 'Ctrl + Shift + Space'}</kbd>
                    </div>

                    <div className="setting-row">
                      <span>
                        <strong>{t('settings.general.home_heading')}</strong>
                        <small>{t('settings.general.home_sub')}</small>
                      </span>
                      <button className="soft-button" onClick={onDashboard}>
                        {t('common.configure')} <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="settings-card">
                    <h4>{currentLocale === 'en' ? 'Memory & Tabs Parking' : 'Сбережение оперативной памяти (Tab Parking)'}</h4>
                    <p style={{ margin: '0 0 14px', fontSize: 'var(--fs-meta)', color: 'var(--ink-3)', lineHeight: 1.5 }}>
                      {currentLocale === 'en'
                        ? 'Inactive spaces and background tabs are safely unloaded from RAM. Tabs playing audio or containing unsaved forms are always protected.'
                        : 'Неактивные пространства и фоновые вкладки автоматически выгружаются из оперативной памяти. Вкладки со звуком и несохранёнными формами всегда защищены.'}
                    </p>

                    <div className="setting-row">
                      <span>
                        <strong>{currentLocale === 'en' ? 'Unload idle tabs after' : 'Выгрузка неактивных вкладок'}</strong>
                        <small>{currentLocale === 'en' ? 'Period of inactivity before background tabs sleep' : 'Время бездействия до мягкой выгрузки страницы из RAM'}</small>
                      </span>
                      <select
                        aria-label="Выгрузка неактивных вкладок"
                        value={state.tabParkingTimeoutMinutes ?? 30}
                        onChange={e => onChange(prev => ({ ...prev, tabParkingTimeoutMinutes: Number(e.target.value) }))}
                        style={{ minWidth: 160, minHeight: 38, padding: '0 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-strong)', background: 'var(--surface-field)', color: 'var(--ink-1)', fontSize: 'var(--fs-meta)' }}
                      >
                        <option value={15}>Через 15 минут</option>
                        <option value={30}>Через 30 минут (рекомендуется)</option>
                        <option value={60}>Через 1 час</option>
                        <option value={0}>Никогда</option>
                      </select>
                    </div>

                    <div className="setting-row">
                      <span>
                        <strong>{currentLocale === 'en' ? 'Free memory immediately' : 'Освободить память сейчас'}</strong>
                        <small>{currentLocale === 'en' ? 'Unloads all eligible background tabs to free RAM' : 'Выгружает фоновые страницы и сохраняет zero-flicker обложки'}</small>
                      </span>
                      <button className="soft-button" onClick={handleManualPark}>
                        <RotateCcw size={14} style={{ marginRight: 6 }} />
                        {currentLocale === 'en' ? 'Park tabs' : 'Выгрузить неактивные'}
                      </button>
                    </div>

                    {parkingStatus && (
                      <p style={{ margin: '10px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--accent-quiet-ink)', fontWeight: 500 }}>
                        {parkingStatus}
                      </p>
                    )}
                  </div>

                  {isDesktop && (
                    <div className="settings-card">
                      <div className="setting-row">
                        <span>
                          <strong>{t('settings.general.autostart_heading')}</strong>
                          <small>{t('settings.general.autostart_sub')}</small>
                        </span>
                        <button
                          className={`toggle ${autostart ? 'on' : ''}`}
                          onClick={() => onAutostart(!autostart)}
                          disabled={isDemo}
                          role="switch"
                          aria-checked={autostart}
                          aria-label={t('settings.general.autostart_heading')}
                        >
                          <span />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. ЗАЩИТА И ПАРОЛИ */}
              {section.id === 'passwords' && (
                <div className="settings-general">
                  <div className="settings-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 16 }}>{currentLocale === 'en' ? 'Ghostery Adblock & Tracker Protection' : 'Встроенная блокировка рекламы и трекеров'}</h4>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--ink-3)' }}>
                          {currentLocale === 'en'
                            ? 'Native Ghostery engine in Chromium blocks intrusive ads, trackers and malware scripts without extensions.'
                            : 'Встроенный фильтр Ghostery в Chromium блокирует баннеры, трекеры слежки и ускоряет загрузку сайтов.'}
                        </p>
                      </div>
                    </div>

                    <div className="setting-row">
                      <span>
                        <strong>{currentLocale === 'en' ? 'Block ads and tracking scripts' : 'Блокировать рекламу и слежку'}</strong>
                        <small>{currentLocale === 'en' ? 'Enabled globally for all browser spaces and tabs' : 'Активно во всех пространствах и вкладках браузера'}</small>
                      </span>
                      <button
                        className={`toggle ${state.adblockEnabled !== false ? 'on' : ''}`}
                        role="switch"
                        aria-checked={state.adblockEnabled !== false}
                        aria-label="Блокировка рекламы"
                        onClick={handleToggleAdblock}
                      >
                        <span />
                      </button>
                    </div>

                    <div className="setting-row">
                      <span>
                        <strong>{currentLocale === 'en' ? 'Client Hints fingerprint protection' : 'Антидетект цифрового отпечатка (Client Hints)'}</strong>
                        <small>{currentLocale === 'en' ? 'Masks device architecture and platform specifics to prevent cross-site profiling' : 'Маскирует системные заголовки для предотвращения межсайтового профилирования'}</small>
                      </span>
                      <span className="settings-badge" style={{ padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-quiet)', color: 'var(--accent-quiet-ink)', fontSize: 'var(--fs-meta)', fontWeight: 600 }}>
                        {currentLocale === 'en' ? 'Active' : 'Активно'}
                      </span>
                    </div>
                  </div>

                  <PasswordSettings />
                  <PrivacySettings />
                </div>
              )}

              {/* 5. О ПРОГРАММЕ И РЕЗЕРВНАЯ КОПИЯ */}
              {section.id === 'about' && (
                <div className="settings-general">
                  <div className="settings-card">
                    <div className="settings-about-hero">
                      <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                        <Compass size={24} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <strong style={{ fontSize: 18, color: 'var(--ink-1)' }}>dombro</strong>
                          <span className="settings-about-badge">v0.0.1</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-meta)', color: 'var(--ink-3)', lineHeight: 1.45 }}>
                          {currentLocale === 'en'
                            ? 'A serene local-first browser and personal workspace for life and work. Calm Tech, local SQLite and Chromium sandbox.'
                            : 'Спокойный локальный браузер и персональный кабинет для жизни и работы. Архитектура Calm Tech, SQLite и безопасная песочница Chromium.'}
                        </p>
                      </div>
                    </div>

                    <div className="setting-row">
                      <span>
                        <strong>{currentLocale === 'en' ? 'Application updates' : 'Обновления приложения'}</strong>
                        <small>
                          {updateReady
                            ? (currentLocale === 'en' ? `Update ready: version ${updateReady.version}` : `Загружено обновление: версия ${updateReady.version}`)
                            : (currentLocale === 'en' ? 'You have the latest version' : 'У вас установлена актуальная версия')}
                        </small>
                      </span>
                      {updateReady ? (
                        <button className="calm-primary" onClick={() => bridge.installUpdate?.()}>
                          {currentLocale === 'en' ? 'Install & restart' : 'Установить и перезапустить'}
                        </button>
                      ) : (
                        <button
                          className="soft-button"
                          onClick={() => {
                            if (bridge.openReleasePage) {
                              void bridge.openReleasePage()
                            } else {
                              window.open('https://github.com/d0mbr0/dombro/releases', '_blank')
                            }
                          }}
                        >
                          <ExternalLink size={14} style={{ marginRight: 6 }} />
                          {currentLocale === 'en' ? 'Releases on GitHub' : 'Релизы на GitHub'}
                        </button>
                      )}
                    </div>
                  </div>

                  {!isDemo && (
                    <div className="settings-card">
                      <h4>{t('settings.general.backup_heading')}</h4>
                      <p style={{ margin: '0 0 14px', fontSize: 'var(--fs-meta)', color: 'var(--ink-3)', lineHeight: 1.5 }}>
                        {currentLocale === 'en'
                          ? 'All spaces, tasks, notes, history and passwords reside in a local SQLite file on your disk. Creating a backup saves a complete standalone snapshot.'
                          : 'Все ваши вкладки, дела, пространства и пароли хранятся в файле SQLite на вашем диске. Создание резервной копии сохраняет полный снимок в выбранную папку.'}
                      </p>
                      <div className="setting-row">
                        <span>
                          <strong>{t('settings.general.backup_heading')}</strong>
                          <small>{t('settings.general.backup_sub')}</small>
                        </span>
                        <button className="soft-button" onClick={onBackup}>
                          <Database size={14} style={{ marginRight: 6 }} />
                          {t('settings.general.backup_btn')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
