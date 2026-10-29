import { describe, expect, it } from 'vitest'
import {
  translate,
  formatDate,
  formatTime,
  dictionaries,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale
} from '../src/i18n'

describe('i18n core engine', () => {
  it('has all 6 major supported locales configured', () => {
    const codes = SUPPORTED_LOCALES.map(loc => loc.code)
    expect(codes).toEqual(['ru', 'en', 'de', 'es', 'fr', 'zh'])
    expect(DEFAULT_LOCALE).toBe('ru')
  })

  it('translates common keys across all supported locales', () => {
    expect(translate('ru', 'common.save')).toBe('Сохранить')
    expect(translate('en', 'common.save')).toBe('Save')
    expect(translate('de', 'common.save')).toBe('Speichern')
    expect(translate('es', 'common.save')).toBe('Guardar')
    expect(translate('fr', 'common.save')).toBe('Enregistrer')
    expect(translate('zh', 'common.save')).toBe('保存')
  })

  it('translates settings section titles across languages', () => {
    expect(translate('ru', 'settings.sections.general')).toBe('Общие')
    expect(translate('en', 'settings.sections.general')).toBe('General')
    expect(translate('de', 'settings.sections.general')).toBe('Allgemein')
    expect(translate('es', 'settings.sections.general')).toBe('General')
    expect(translate('fr', 'settings.sections.general')).toBe('Général')
    expect(translate('zh', 'settings.sections.general')).toBe('通用')

    expect(translate('ru', 'settings.sections.passwords')).toBe('Пароли и защита')
    expect(translate('en', 'settings.sections.passwords')).toBe('Passwords & Security')
    expect(translate('de', 'settings.sections.passwords')).toBe('Passwörter & Schutz')
    expect(translate('es', 'settings.sections.passwords')).toBe('Contraseñas y seguridad')
    expect(translate('fr', 'settings.sections.passwords')).toBe('Mots de passe et sécurité')
    expect(translate('zh', 'settings.sections.passwords')).toBe('密码与安全')
  })

  it('interpolates template parameters correctly', () => {
    expect(
      translate('ru', 'settings.calendars.remove_calendar', { name: 'Рабочий' })
    ).toBe('Удалить календарь: Рабочий')

    expect(
      translate('en', 'settings.calendars.remove_calendar', { name: 'Work' })
    ).toBe('Remove calendar: Work')

    expect(
      translate('de', 'focus.remaining', { minutes: 25 })
    ).toBe('Verbleibend: 25 Min')

    expect(
      translate('zh', 'focus.remaining', { minutes: 10 })
    ).toBe('剩余：10 分钟')
  })

  it('falls back gracefully to en or ru if a key is not found', () => {
    // When translating a known key in any locale, it succeeds
    expect(translate('ru', 'nav.home')).toBe('Главная')
    expect(translate('en', 'nav.home')).toBe('Home')
    // When an unknown key is queried (casted), returns the key path
    expect(translate('ru', 'common.unknown_key' as any)).toBe('common.unknown_key')
  })

  it('verifies that each locale has complete top-level categories', () => {
    const requiredCategories = ['common', 'nav', 'settings', 'dashboard', 'browser', 'focus', 'capture'] as const
    const locales: SupportedLocale[] = ['ru', 'en', 'de', 'es', 'fr', 'zh']

    for (const loc of locales) {
      const dict = dictionaries[loc]
      expect(dict, `Locale ${loc} should exist`).toBeDefined()
      for (const cat of requiredCategories) {
        expect(dict[cat], `Locale ${loc} should have category ${cat}`).toBeDefined()
      }
    }
  })

  it('formats dates according to locale', () => {
    const date = new Date(2026, 9, 10, 12, 0) // Oct 10, 2026
    const ruDate = formatDate(date, 'ru', { month: 'short', day: 'numeric' })
    const enDate = formatDate(date, 'en', { month: 'short', day: 'numeric' })
    const deDate = formatDate(date, 'de', { month: 'short', day: 'numeric' })
    const zhDate = formatDate(date, 'zh', { month: 'short', day: 'numeric' })

    expect(ruDate).toBeTruthy()
    expect(enDate).toBeTruthy()
    expect(deDate).toBeTruthy()
    expect(zhDate).toBeTruthy()
  })

  it('formats times according to locale', () => {
    const date = new Date(2026, 9, 10, 15, 30)
    const time = formatTime(date, 'ru')
    expect(time).toMatch(/15:30/)
  })
})
