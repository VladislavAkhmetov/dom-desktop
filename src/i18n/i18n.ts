import { DEFAULT_LOCALE, type SupportedLocale, type TranslationKey, type TranslationsSchema } from './types'
import { ru } from './locales/ru'
import { en } from './locales/en'
import { de } from './locales/de'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { zh } from './locales/zh'

export const dictionaries: Record<SupportedLocale, TranslationsSchema> = {
  ru,
  en,
  de,
  es,
  fr,
  zh
}

function getNestedValue(obj: unknown, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof current === 'string' ? current : undefined
}

export function translate(
  locale: SupportedLocale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const currentDict = dictionaries[locale] || dictionaries[DEFAULT_LOCALE]
  let template = getNestedValue(currentDict, key)

  if (!template && locale !== 'en') {
    template = getNestedValue(dictionaries.en, key)
  }
  if (!template && locale !== 'ru') {
    template = getNestedValue(dictionaries.ru, key)
  }
  if (!template) {
    return key
  }

  if (params) {
    return template.replace(/\{(\w+)\}/g, (_, match) => {
      return match in params ? String(params[match]) : `{${match}}`
    })
  }

  return template
}

export function formatDate(
  date: Date | string | number,
  locale: SupportedLocale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'object' ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, options || { month: 'short', day: 'numeric' }).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

export function formatTime(
  date: Date | string | number,
  locale: SupportedLocale = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'object' ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(locale, options || { hour: '2-digit', minute: '2-digit' }).format(d)
  } catch {
    return d.toLocaleTimeString()
  }
}
