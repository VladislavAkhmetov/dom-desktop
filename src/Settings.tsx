import { useId, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, FolderInput, KeyRound, Mail, Newspaper, Plus, Search, Settings2, ShieldCheck, User, X } from 'lucide-react'
import { bridge, isDesktop } from './bridge'
import { isDemo } from './demo'
import { Dialog } from './Dialog'
import { FluidGroup } from './FluidMotion'
import { IntegrationSettings } from './IntegrationSettings'
import { PasswordSettings } from './PasswordSettings'
import { PrivacySettings } from './PrivacySettings'
import { SettingsList } from './SettingsList'
import type { AppState, SupportedLocale } from './types'
import { getUserProfile, updateUserProfile, PROFILE_TONES, PROFILE_EMOJIS } from './userProfile'
import { useI18n, SUPPORTED_LOCALES, translate, type TranslationKey } from './i18n'
import { sound } from './sound'
import './settings.css'
import './profile.css'

export type SettingsSectionId = 'profile' | 'general' | 'passwords' | 'calendars' | 'mail' | 'news' | 'privacy'

export function Settings({ state, onChange, onClose, onDashboard, autostart, onAutostart, onBackup, calendarName, calendarUrl, onCalendarName, onCalendarUrl, onAddCalendar, onRemoveCalendar, onCalendarRefresh, calendarRefreshing, onNewsRefresh, newsRefreshing, initialSection, onImport }: {
  state: AppState
  onChange: (update: (state: AppState) => AppState) => unknown
  onClose: () => void
  onDashboard: () => void
  autostart: boolean
  onAutostart: (enabled: boolean) => unknown
  onBackup: () => unknown
  calendarName: string
  calendarUrl: string
  onCalendarName: (value: string) => void
  onCalendarUrl: (value: string) => void
  onAddCalendar: () => unknown
  onRemoveCalendar: (id: string) => unknown
  onCalendarRefresh: () => unknown
  calendarRefreshing: boolean
  onNewsRefresh: () => unknown
  newsRefreshing: boolean
  initialSection?: SettingsSectionId
  onImport?: () => void
}) {
  const i18n = useI18n()
  const currentLocale: SupportedLocale = state.locale || i18n.locale || 'ru'
  const t = (key: TranslationKey, params?: Record<string, string | number>) => translate(currentLocale, key, params)

  const sections = useMemo(() => [
    { id: 'profile' as const, label: t('settings.sections.profile'), icon: User, description: t('settings.sections.profile_desc'), keywords: t('settings.sections.profile_keywords'), group: t('settings.groups.app') },
    { id: 'general' as const, label: t('settings.sections.general'), icon: Settings2, description: t('settings.sections.general_desc'), keywords: t('settings.sections.general_keywords'), group: t('settings.groups.app') },
    { id: 'passwords' as const, label: t('settings.sections.passwords'), icon: KeyRound, description: t('settings.sections.passwords_desc'), keywords: t('settings.sections.passwords_keywords'), group: t('settings.groups.security') },
    { id: 'calendars' as const, label: t('settings.sections.calendars'), icon: CalendarDays, description: t('settings.sections.calendars_desc'), keywords: t('settings.sections.calendars_keywords'), group: t('settings.groups.connections') },
    { id: 'mail' as const, label: t('settings.sections.mail'), icon: Mail, description: t('settings.sections.mail_desc'), keywords: t('settings.sections.mail_keywords'), group: t('settings.groups.connections') },
    { id: 'news' as const, label: t('settings.sections.news'), icon: Newspaper, description: t('settings.sections.news_desc'), keywords: t('settings.sections.news_keywords'), group: t('settings.groups.connections') },
    { id: 'privacy' as const, label: t('settings.sections.privacy'), icon: ShieldCheck, description: t('settings.sections.privacy_desc'), keywords: t('settings.sections.privacy_keywords'), group: t('settings.groups.security') }
  ], [currentLocale])

  const groups = useMemo(() => [
    t('settings.groups.app'),
    t('settings.groups.connections'),
    t('settings.groups.security')
  ], [currentLocale])

  const [active, setActive] = useState<SettingsSectionId>(initialSection || 'general')
  const [query, setQuery] = useState('')
  const id = useId()
  const normalizedQuery = query.trim().toLocaleLowerCase(currentLocale)
  const matches = sections.filter(section => `${section.label} ${section.keywords}`.toLocaleLowerCase(currentLocale).includes(normalizedQuery))
  const selected = sections.find(section => section.id === active) || sections[0]
  const [soundEnabled, setSoundEnabled] = useState(() => sound.enabled)

  const handleToggleSound = () => {
    const next = sound.toggle()
    setSoundEnabled(next)
  }

  const handleLocaleChange = (newLocale: SupportedLocale) => {
    i18n.setLocale(newLocale)
    onChange(prev => ({ ...prev, locale: newLocale }))
  }

  return <Dialog title={t('settings.title')} className="app-dialog settings-dialog" onClose={onClose}>
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
            return entries.length > 0 && <div className="settings-nav-group" key={group}><span className="settings-nav-label">{group}</span>{entries.map(section => <button key={section.id} id={`${id}-${section.id}-tab`} aria-current={active === section.id ? 'page' : undefined} aria-controls={`${id}-${section.id}-panel`} data-dialog-focus={section.id === 'general' ? true : undefined} onClick={() => setActive(section.id)}><section.icon size={18} strokeWidth={1.7} /><span>{section.label}</span></button>)}</div>
          })}
          {matches.length === 0 && <p className="settings-search-empty">{t('settings.not_found')}</p>}
        </FluidGroup>
      </aside>
      <div className="settings-content">
        <header className="settings-section-heading"><h3>{selected.label}</h3><p>{selected.description}</p></header>
        {sections.map(section => <section key={section.id} className="settings-panel" id={`${id}-${section.id}-panel`} aria-label={section.label} hidden={active !== section.id}>
          {section.id === 'profile' && (() => {
            const profile = getUserProfile(state)
            return (
              <div className="settings-columns">
                <div className="settings-card">
                  <div className="profile-preview-card">
                    <div className={`profile-avatar-large tone-${profile.avatarTone || 'sage'}`}>
                      {profile.avatarEmoji || profile.name.charAt(0).toUpperCase() || 'П'}
                    </div>
                    <div className="profile-info">
                      <strong style={{ fontSize: 16, color: 'var(--ink)' }}>{profile.name}</strong>
                      <small style={{ color: 'var(--muted)' }}>{profile.status || t('settings.profile.local_profile')}</small>
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
                    <span style={{ fontSize: 12, color: '#647b6a', display: 'block', marginBottom: 8 }}>{t('settings.profile.color_tone')}</span>
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
                    <span style={{ fontSize: 12, color: '#647b6a', display: 'block', marginBottom: 8 }}>{t('settings.profile.emoji_icon')}</span>
                    <div className="profile-emojis-bar">
                      {PROFILE_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          className={`profile-emoji-btn ${profile.avatarEmoji === emoji ? 'active' : ''}`}
                          onClick={() => onChange(prev => updateUserProfile(prev, { avatarEmoji: emoji }))}
                          aria-label={`Эмодзи ${emoji}`}
                        >
                          {emoji}
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
                    <div style={{ borderTop: '1px solid rgba(69,102,78,.1)', paddingTop: 14 }}>
                      <h4 style={{ margin: '0 0 6px' }}>{t('settings.profile.data_migration')}</h4>
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#647b6a', lineHeight: 1.4 }}>
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
          {section.id === 'general' && <div className="settings-general">
            <div className="settings-card">
              <div className="settings-card-heading">
                <h4>{t('settings.general.language_title')}</h4>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)' }}>
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
              <div className="setting-row"><span><strong>{t('settings.general.home_heading')}</strong><small>{t('settings.general.home_sub')}</small></span><button className="soft-button" onClick={onDashboard}>{t('common.configure')} <ArrowRight size={16} /></button></div>
              <div className="setting-row"><span><strong>{t('settings.general.quick_entry_heading')}</strong><small>{t('settings.general.quick_entry_sub')}</small></span><kbd>{bridge.platform === 'darwin' ? '⌘ ⇧ Space' : 'Ctrl + Shift + Space'}</kbd></div>
            </div>
            <div className="settings-card">
              {isDesktop && <div className="setting-row"><span><strong>{t('settings.general.autostart_heading')}</strong><small>{t('settings.general.autostart_sub')}</small></span><button className={`toggle ${autostart ? 'on' : ''}`} onClick={() => onAutostart(!autostart)} disabled={isDemo} role="switch" aria-checked={autostart} aria-label={t('settings.general.autostart_heading')}><span /></button></div>}
              <div className="setting-row"><span><strong>{state.locale === 'en' ? 'Calm Tech tactile sound' : 'Тактильные звуки Calm Tech'}</strong><small>{state.locale === 'en' ? 'Soft procedural wood snaps, paper rustle, and exhale without harsh frequencies' : 'Мягкие процедурные щелчки дерева, шелест бумаги и выдох без резких частот'}</small></span><button className={`toggle ${soundEnabled ? 'on' : ''}`} role="switch" aria-checked={soundEnabled} aria-label={state.locale === 'en' ? 'Calm Tech tactile sound' : 'Тактильные звуки Calm Tech'} onClick={handleToggleSound}><span /></button></div>
              <div className="setting-row"><span><strong>{t('settings.general.hints_heading')}</strong><small>{t('settings.general.hints_sub')}</small></span><button className={`toggle ${state.liveHints ? 'on' : ''}`} role="switch" aria-checked={Boolean(state.liveHints)} aria-label={t('settings.general.hints_heading')} onClick={() => onChange(previous => ({ ...previous, liveHints: !previous.liveHints }))}><span /></button></div>
              {!isDemo && <div className="setting-row"><span><strong>{t('settings.general.backup_heading')}</strong><small>{t('settings.general.backup_sub')}</small></span><button className="soft-button" onClick={onBackup}>{t('settings.general.backup_btn')}</button></div>}
            </div>
          </div>}
          {section.id === 'passwords' && <PasswordSettings />}
          {section.id === 'calendars' && <div className="settings-columns">
            <div className="settings-card settings-collection-card"><div className="settings-card-heading"><h4>{t('settings.calendars.connected')}</h4>{Boolean(state.calendarSubscriptions?.length) && <button className="soft-button" disabled={calendarRefreshing} onClick={onCalendarRefresh}>{calendarRefreshing ? t('common.refreshing') : t('common.refresh')}</button>}</div>
              <SettingsList items={state.calendarSubscriptions || []} label={t('settings.sections.calendars')} empty={t('settings.calendars.empty')} renderItem={sub => <><div className="settings-item-copy"><strong>{sub.name}</strong><small title={sub.error || (sub.secretId ? t('settings.calendars.protected_secret') : sub.url)}>{sub.error || (sub.secretId ? t('settings.calendars.protected_secret') : sub.url)}</small></div><button className="calm-icon" onClick={() => onRemoveCalendar(sub.id)} aria-label={t('settings.calendars.remove_calendar', { name: sub.name })}><X size={16} /></button></>} />
            </div>
            <div className="settings-card">
              <h4>{t('settings.calendars.connect_calendar')}</h4>
              <div className="form-stack">
                <label>{t('settings.calendars.name_label')}<input value={calendarName} onChange={event => onCalendarName(event.target.value)} /></label>
                <label>{t('settings.calendars.url_label')}<input value={calendarUrl} onChange={event => onCalendarUrl(event.target.value)} placeholder={t('settings.calendars.url_placeholder')} /></label>
                <button className="soft-button" disabled={!calendarUrl.trim()} onClick={onAddCalendar}><Plus size={15} />{t('common.connect')}</button>
              </div>
              <details className="calm-details" style={{ marginTop: 14 }}>
                <summary style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>{t('settings.calendars.help_summary')}</summary>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginTop: 8 }}>
                  <p style={{ margin: '0 0 6px' }}><strong>Google:</strong> {t('settings.calendars.google_help')}</p>
                  <p style={{ margin: '0 0 6px' }}><strong>Apple iCloud:</strong> {t('settings.calendars.apple_help')}</p>
                  <p style={{ margin: 0 }}><strong>Яндекс / Outlook:</strong> {t('settings.calendars.yandex_help')}</p>
                </div>
              </details>
            </div>
          </div>}
          {(section.id === 'mail' || section.id === 'news') && <IntegrationSettings section={section.id} state={state} onChange={onChange} onNewsRefresh={onNewsRefresh} newsRefreshing={newsRefreshing} />}
          {section.id === 'privacy' && <PrivacySettings />}
        </section>)}
      </div>
    </div>
  </Dialog>
}
