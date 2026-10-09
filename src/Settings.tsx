import { useId, useState } from 'react'
import { ArrowRight, CalendarDays, Check, FolderInput, KeyRound, Mail, Newspaper, Plus, Search, Settings2, ShieldCheck, User, X } from 'lucide-react'
import { bridge, isDesktop } from './bridge'
import { isDemo } from './demo'
import { Dialog } from './Dialog'
import { FluidGroup } from './FluidMotion'
import { IntegrationSettings } from './IntegrationSettings'
import { PasswordSettings } from './PasswordSettings'
import { PrivacySettings } from './PrivacySettings'
import { SettingsList } from './SettingsList'
import type { AppState } from './types'
import { getUserProfile, updateUserProfile, PROFILE_TONES, PROFILE_EMOJIS } from './userProfile'
import './settings.css'
import './profile.css'

const sections = [
  { id: 'profile', label: 'Профиль', icon: User, description: 'Имя, аватар и персональные настройки.', keywords: 'профиль имя аватар статус персональные данные хром закладки импорт', group: 'Приложение' },
  { id: 'general', label: 'Общие', icon: Settings2, description: 'Главная, запуск и поведение приложения.', keywords: 'главная виджеты фон оформление автозапуск быстрый ввод анимация напоминаний резервная копия', group: 'Приложение' },
  { id: 'passwords', label: 'Пароли и ключи', icon: KeyRound, description: 'Сохранённые учётные данные и безопасное автозаполнение.', keywords: 'пароли логины ключи vault safeStorage автозаполнение экспорт импорт csv безопасность', group: 'Безопасность' },
  { id: 'calendars', label: 'Календари', icon: CalendarDays, description: 'Подключённые календари и подписки на события.', keywords: 'календарь события ical webcal подключение', group: 'Подключения' },
  { id: 'mail', label: 'Почта Gmail', icon: Mail, description: 'Аккаунты и отправители, чьи письма важны для вас.', keywords: 'почта gmail аккаунт отправители oauth подключение', group: 'Подключения' },
  { id: 'news', label: 'Дайджест', icon: Newspaper, description: 'Источники новостей и обновление выпуска.', keywords: 'источники новости rss atom ленты подключение', group: 'Подключения' },
  { id: 'privacy', label: 'Приватность', icon: ShieldCheck, description: 'Политика локальных данных и безопасность Дома.', keywords: 'приватность безопасность local-first sqlite шифрование dpapi keychain', group: 'Безопасность' }
] as const
export type SettingsSectionId = typeof sections[number]['id']

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
  const [active, setActive] = useState<SettingsSectionId>(initialSection || 'general')
  const [query, setQuery] = useState('')
  const id = useId()
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU')
  const matches = sections.filter(section => `${section.label} ${section.keywords}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery))
  const selected = sections.find(section => section.id === active)!
  return <Dialog title="Настройки" className="app-dialog settings-dialog" onClose={onClose}>
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <div className="settings-search"><Search size={16} aria-hidden="true" /><input aria-label="Найти раздел настроек" type="search" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="Очистить поиск разделов" onClick={() => setQuery('')}><X size={15} /></button>}</div>
        <FluidGroup as="nav" className="settings-nav" aria-label="Разделы настроек" axis="y" itemSelector=".settings-nav-group > button">
          {['Приложение', 'Подключения', 'Безопасность'].map(group => {
            const entries = matches.filter(section => section.group === group)
            return entries.length > 0 && <div className="settings-nav-group" key={group}><span className="settings-nav-label">{group}</span>{entries.map(section => <button key={section.id} id={`${id}-${section.id}-tab`} aria-current={active === section.id ? 'page' : undefined} aria-controls={`${id}-${section.id}-panel`} data-dialog-focus={section.id === 'general' ? true : undefined} onClick={() => setActive(section.id)}><section.icon size={18} strokeWidth={1.7} /><span>{section.label}</span></button>)}</div>
          })}
          {matches.length === 0 && <p className="settings-search-empty">Раздел не найден</p>}
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
                      <small style={{ color: 'var(--muted)' }}>{profile.status || 'Локальный профиль'}</small>
                    </div>
                  </div>
                  <div className="form-stack">
                    <label>
                      Имя пользователя
                      <input
                        aria-label="Имя пользователя"
                        value={profile.name}
                        onChange={e => onChange(prev => updateUserProfile(prev, { name: e.target.value }))}
                        placeholder="Ваше имя"
                      />
                    </label>
                    <label>
                      Статус или короткая заметка
                      <input
                        aria-label="Статус профиля"
                        value={profile.status || ''}
                        onChange={e => onChange(prev => updateUserProfile(prev, { status: e.target.value }))}
                        placeholder="Например: В потоке"
                      />
                    </label>
                  </div>
                </div>

                <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h4 style={{ margin: '0 0 10px' }}>Оформление аватара</h4>
                    <span style={{ fontSize: 12, color: '#647b6a', display: 'block', marginBottom: 8 }}>Цветовой тон</span>
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
                    <span style={{ fontSize: 12, color: '#647b6a', display: 'block', marginBottom: 8 }}>Значок или эмодзи</span>
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
                        title="Сбросить на инициал"
                      >
                        Сбросить
                      </button>
                    </div>
                  </div>

                  {onImport && (
                    <div style={{ borderTop: '1px solid rgba(69,102,78,.1)', paddingTop: 14 }}>
                      <h4 style={{ margin: '0 0 6px' }}>Перенос данных</h4>
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#647b6a', lineHeight: 1.4 }}>
                        Импортируйте закладки (HTML/JSON) или скопированные ссылки из Google Chrome.
                      </p>
                      <button className="soft-button" onClick={() => { onClose(); onImport() }}>
                        <FolderInput size={15} style={{ marginRight: 6 }} />
                        Импортировать из Chrome
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
          {section.id === 'general' && <div className="settings-general">
            <div className="settings-card">
              <div className="setting-row"><span><strong>Главная</strong><small>Виджеты, фон и оформление</small></span><button className="soft-button" onClick={onDashboard}>Настроить <ArrowRight size={16} /></button></div>
              <div className="setting-row"><span><strong>Быстрый ввод</strong><small>Открыть запись из любого приложения</small></span><kbd>{bridge.platform === 'darwin' ? '⌘ ⌥ Space' : 'Ctrl + Alt + Space'}</kbd></div>
            </div>
            <div className="settings-card">
              {isDesktop && <div className="setting-row"><span><strong>Автозапуск</strong><small>Открывать Дом при входе в систему</small></span><button className={`toggle ${autostart ? 'on' : ''}`} onClick={() => onAutostart(!autostart)} disabled={isDemo} role="switch" aria-checked={autostart} aria-label="Автозапуск"><span /></button></div>}
              <div className="setting-row"><span><strong>Анимация напоминаний</strong><small>Движение в подсказках и напоминаниях</small></span><button className={`toggle ${state.liveHints ? 'on' : ''}`} role="switch" aria-checked={Boolean(state.liveHints)} aria-label="Анимация напоминаний" onClick={() => onChange(previous => ({ ...previous, liveHints: !previous.liveHints }))}><span /></button></div>
              {!isDemo && <div className="setting-row"><span><strong>Резервная копия</strong><small>Сохранить копию данных Дома</small></span><button className="soft-button" onClick={onBackup}>Создать</button></div>}
            </div>
          </div>}
          {section.id === 'passwords' && <PasswordSettings />}
          {section.id === 'calendars' && <div className="settings-columns">
            <div className="settings-card settings-collection-card"><div className="settings-card-heading"><h4>Подключённые</h4>{Boolean(state.calendarSubscriptions?.length) && <button className="soft-button" disabled={calendarRefreshing} onClick={onCalendarRefresh}>{calendarRefreshing ? 'Обновляем…' : 'Обновить'}</button>}</div>
              <SettingsList items={state.calendarSubscriptions || []} label="Календари" empty="Пока нет подключённых календарей." renderItem={sub => <><div className="settings-item-copy"><strong>{sub.name}</strong><small title={sub.error || (sub.secretId ? 'Адрес защищён хранилищем ОС' : sub.url)}>{sub.error || (sub.secretId ? 'Адрес защищён хранилищем ОС' : sub.url)}</small></div><button className="calm-icon" onClick={() => onRemoveCalendar(sub.id)} aria-label={`Удалить календарь: ${sub.name}`}><X size={16} /></button></>} />
            </div>
            <div className="settings-card">
              <h4>Подключить календарь</h4>
              <div className="form-stack">
                <label>Название<input value={calendarName} onChange={event => onCalendarName(event.target.value)} /></label>
                <label>Адрес iCal / Webcal<input value={calendarUrl} onChange={event => onCalendarUrl(event.target.value)} placeholder="https://... или webcal://..." /></label>
                <button className="soft-button" disabled={!calendarUrl.trim()} onClick={onAddCalendar}><Plus size={15} />Подключить</button>
              </div>
              <details className="calm-details" style={{ marginTop: 14 }}>
                <summary style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>Как получить секретную ссылку iCal?</summary>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginTop: 8 }}>
                  <p style={{ margin: '0 0 6px' }}><strong>Google:</strong> Настройки календаря → Интеграция календаря → <em>«Секретный адрес в формате iCal»</em>.</p>
                  <p style={{ margin: '0 0 6px' }}><strong>Apple iCloud:</strong> В приложении Календарь значок общего доступа → включите <em>«Открытый календарь»</em> → скопируйте ссылку.</p>
                  <p style={{ margin: 0 }}><strong>Яндекс / Outlook:</strong> Настройки календаря → Экспорт / Подписка → скопируйте ссылку на <code>.ics</code>.</p>
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
