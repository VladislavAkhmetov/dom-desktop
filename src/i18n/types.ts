export type SupportedLocale = 'ru' | 'en' | 'de' | 'es' | 'fr' | 'zh'

export interface LocaleInfo {
  code: SupportedLocale
  name: string
  nativeName: string
  flag: string
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' }
]

export const DEFAULT_LOCALE: SupportedLocale = 'ru'

export interface TranslationsSchema {
  common: {
    save: string
    cancel: string
    close: string
    delete: string
    add: string
    create: string
    edit: string
    search: string
    loading: string
    refresh: string
    refreshing: string
    back: string
    forward: string
    done: string
    reset: string
    clear: string
    copy: string
    copied: string
    configure: string
    connect: string
    open: string
    remove: string
    apply: string
    undo: string
    not_found: string
    empty: string
    error: string
  }
  nav: {
    home: string
    spaces: string
    browser: string
    calendar: string
    focus: string
    settings: string
    assistant: string
    history: string
    bookmarks: string
    search_dom: string
    profile: string
  }
  settings: {
    title: string
    search_placeholder: string
    clear_search: string
    not_found: string
    groups: {
      app: string
      connections: string
      security: string
    }
    sections: {
      profile: string
      profile_desc: string
      profile_keywords: string
      general: string
      general_desc: string
      general_keywords: string
      passwords: string
      passwords_desc: string
      passwords_keywords: string
      calendars: string
      calendars_desc: string
      calendars_keywords: string
      mail: string
      mail_desc: string
      mail_keywords: string
      news: string
      news_desc: string
      news_keywords: string
      privacy: string
      privacy_desc: string
      privacy_keywords: string
    }
    general: {
      language_title: string
      language_desc: string
      home_heading: string
      home_sub: string
      quick_entry_heading: string
      quick_entry_sub: string
      autostart_heading: string
      autostart_sub: string
      hints_heading: string
      hints_sub: string
      backup_heading: string
      backup_sub: string
      backup_btn: string
      backup_success: string
      backup_error: string
    }
    profile: {
      user_name: string
      user_name_placeholder: string
      user_status: string
      user_status_placeholder: string
      avatar_style: string
      color_tone: string
      emoji_icon: string
      reset_initial: string
      reset_btn: string
      data_migration: string
      import_chrome_desc: string
      import_chrome_btn: string
      local_profile: string
    }
    calendars: {
      connected: string
      empty: string
      connect_calendar: string
      name_label: string
      url_label: string
      url_placeholder: string
      help_summary: string
      google_help: string
      apple_help: string
      yandex_help: string
      protected_secret: string
      remove_calendar: string
    }
    passwords: {
      title: string
      add_title: string
      origin: string
      origin_placeholder: string
      username: string
      password: string
      note: string
      save_btn: string
      empty: string
      import_btn: string
      export_btn: string
      copied: string
      remove_confirm: string
    }
    privacy: {
      title: string
      storage_info: string
      storage_desc: string
      encryption_info: string
      encryption_desc: string
      clear_data: string
      clear_data_desc: string
    }
    news: {
      sources: string
      add_source: string
      source_name: string
      source_url: string
      empty: string
    }
  }
  dashboard: {
    greeting_morning: string
    greeting_day: string
    greeting_evening: string
    greeting_night: string
    weather: string
    tasks: string
    news: string
    customize: string
    widgets: string
  }
  browser: {
    new_tab: string
    search_or_url: string
    back: string
    forward: string
    reload: string
    pin: string
    unpin: string
    close_tab: string
    history: string
    bookmarks: string
    save_page: string
    clear_history: string
    tabs: string
    spaces: string
  }
  focus: {
    title: string
    start: string
    pause: string
    resume: string
    reset: string
    sound: string
    duration: string
    remaining: string
  }
  capture: {
    title: string
    placeholder: string
    save: string
    today: string
    tomorrow: string
  }
}

type NestedKeyOfHelper<ObjectType, Prefix extends string = ''> = {
  [Key in keyof ObjectType & string]: ObjectType[Key] extends object
    ? NestedKeyOfHelper<ObjectType[Key], `${Prefix}${Key}.`>
    : `${Prefix}${Key}`
}[keyof ObjectType & string]

export type TranslationKey = NestedKeyOfHelper<TranslationsSchema>
