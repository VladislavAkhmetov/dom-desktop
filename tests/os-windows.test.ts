import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { resourceAppLabel, recentMaterials } from '../src/resourcePresentation'
import { cabinetContents } from '../src/cabinetInteractions'
import type { Resource, Space } from '../src/types'

const require = createRequire(import.meta.url)
const osWindows = require('../electron/os-windows.cjs')

describe('Оконные ресурсы и интеграция Win32', () => {
  describe('resourceAppLabel', () => {
    it('возвращает имя программы без расширения .exe для ресурсов типа window', () => {
      const resWithExe: Resource = {
        id: 'w1',
        name: 'brand_guide.ai',
        kind: 'window',
        target: 'C:\\Program Files\\Adobe\\Illustrator.exe',
        createdAt: '2026-10-17T12:00:00Z',
        exeName: 'Illustrator.exe',
        windowHwnd: '0x12345',
        windowTitle: 'brand_guide.ai - Adobe Illustrator'
      }
      expect(resourceAppLabel(resWithExe)).toBe('Illustrator')
    })

    it('возвращает "Окно Windows", если exeName не указан', () => {
      const resWithoutExe: Resource = {
        id: 'w2',
        name: 'Без имени',
        kind: 'window',
        target: '',
        createdAt: '2026-10-17T12:00:00Z'
      }
      expect(resourceAppLabel(resWithoutExe)).toBe('Окно Windows')
    })
  })

  describe('cabinetContents', () => {
    it('помещает оконный ресурс в список materials кабинета, а не tools', () => {
      const space: Space = {
        id: 'space-design',
        name: 'Дизайн',
        tone: 'sage',
        resources: [
          {
            id: 'doc-1',
            name: 'Логотип',
            kind: 'window',
            target: 'C:\\Photoshop.exe',
            createdAt: '2026-10-17T12:00:00Z',
            exeName: 'Photoshop.exe',
            windowHwnd: '0xabc'
          },
          {
            id: 'app-1',
            name: 'Figma',
            kind: 'app',
            target: 'C:\\Figma.exe',
            createdAt: '2026-10-17T12:00:00Z'
          }
        ]
      }
      const contents = cabinetContents(space)
      expect(contents.materials.map(m => m.id)).toContain('doc-1')
      expect(contents.tools.map(t => t.id)).toContain('app-1')
      expect(contents.tools.map(t => t.id)).not.toContain('doc-1')
    })
  })

  describe('recentMaterials sorting', () => {
    it('сортирует оконные материалы по дате наравне с файлами и ссылками, оставляя app в конце', () => {
      const items: Resource[] = [
        { id: 'app', name: 'App', kind: 'app', target: 'app.exe', createdAt: '2026-10-17T15:00:00Z' },
        { id: 'win-old', name: 'Old Win', kind: 'window', target: 'w.exe', createdAt: '2026-10-17T10:00:00Z' },
        { id: 'win-new', name: 'New Win', kind: 'window', target: 'w.exe', createdAt: '2026-10-17T14:00:00Z' }
      ]
      const sorted = recentMaterials(items)
      expect(sorted.map(s => s.id)).toEqual(['win-new', 'win-old', 'app'])
    })
  })

  describe('electron/os-windows.cjs', () => {
    it('экспортирует полный набор функций управления окнами', () => {
      expect(typeof osWindows.getOpenWindows).toBe('function')
      expect(typeof osWindows.minimizeWindows).toBe('function')
      expect(typeof osWindows.restoreWindows).toBe('function')
      expect(typeof osWindows.isWindowAlive).toBe('function')
      expect(typeof osWindows.focusWindow).toBe('function')
    })

    if (process.platform === 'win32') {
      it('на Windows возвращает список окон пользователя с корректной структурой', () => {
        const windows = osWindows.getOpenWindows(process.pid)
        expect(Array.isArray(windows)).toBe(true)
        if (windows.length > 0) {
          const first = windows[0]
          expect(first.hwnd).toMatch(/^0x[0-9a-fA-F]+$/)
          expect(typeof first.title).toBe('string')
          expect(first.title.length).toBeGreaterThan(0)
          expect(typeof first.isMinimized).toBe('boolean')
          if (first.exeName) {
            expect(typeof first.exeName).toBe('string')
          }
        }
      })

      it('isWindowAlive корректно распознает реальные окна и отсекает несуществующие', () => {
        const windows = osWindows.getOpenWindows(process.pid)
        if (windows.length > 0) {
          expect(osWindows.isWindowAlive(windows[0].hwnd)).toBe(true)
        }
        expect(osWindows.isWindowAlive('0x99999999')).toBe(false)
        expect(osWindows.isWindowAlive(null)).toBe(false)
        expect(osWindows.isWindowAlive('invalid-hwnd')).toBe(false)
      })

      it('minimizeWindows и restoreWindows не выбрасывают исключений при корректных и пустых списках', () => {
        expect(() => osWindows.minimizeWindows([])).not.toThrow()
        expect(() => osWindows.minimizeWindows(null)).not.toThrow()
        expect(() => osWindows.restoreWindows([])).not.toThrow()
        expect(() => osWindows.restoreWindows(null)).not.toThrow()
        expect(() => osWindows.minimizeWindows(['0x99999999'])).not.toThrow()
        expect(() => osWindows.restoreWindows(['0x99999999'])).not.toThrow()
      })
    }
  })
})
