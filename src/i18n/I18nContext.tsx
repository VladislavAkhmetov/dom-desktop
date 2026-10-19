import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react'
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type LocaleInfo,
  type SupportedLocale,
  type TranslationKey
} from './types'
import { translate, formatDate as intlFormatDate, formatTime as intlFormatTime } from './i18n'

export interface I18nContextValue {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
  formatTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
  supportedLocales: LocaleInfo[]
}

const defaultContextValue: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
  formatDate: (date, options) => intlFormatDate(date, DEFAULT_LOCALE, options),
  formatTime: (date, options) => intlFormatTime(date, DEFAULT_LOCALE, options),
  supportedLocales: SUPPORTED_LOCALES
}

export const I18nContext = createContext<I18nContextValue>(defaultContextValue)

interface I18nProviderProps {
  locale?: SupportedLocale
  onLocaleChange?: (locale: SupportedLocale) => void
  children: ReactNode
}

export function I18nProvider({ locale: externalLocale, onLocaleChange, children }: I18nProviderProps) {
  const [internalLocale, setInternalLocale] = useState<SupportedLocale>(externalLocale || DEFAULT_LOCALE)

  const activeLocale = externalLocale || internalLocale

  useEffect(() => {
    if (externalLocale && externalLocale !== internalLocale) {
      setInternalLocale(externalLocale)
    }
  }, [externalLocale])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = activeLocale
    }
  }, [activeLocale])

  const setLocale = (newLocale: SupportedLocale) => {
    setInternalLocale(newLocale)
    if (onLocaleChange) {
      onLocaleChange(newLocale)
    }
  }

  const value = useMemo<I18nContextValue>(() => ({
    locale: activeLocale,
    setLocale,
    t: (key: TranslationKey, params?: Record<string, string | number>) => translate(activeLocale, key, params),
    formatDate: (date, options) => intlFormatDate(date, activeLocale, options),
    formatTime: (date, options) => intlFormatTime(date, activeLocale, options),
    supportedLocales: SUPPORTED_LOCALES
  }), [activeLocale, onLocaleChange])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}

export const useTranslation = useI18n
