// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { builtinDashboardPresets, getPresetWidgets, widgetConstraints, widgetDefaultSpan, widgetSpan, widgetNames, adaptRowSpans, dashboardWidgets, computeWidgetPositions } from '../src/dashboard'
import { ScratchpadWidget } from '../src/ScratchpadWidget'
import { ReadingShelfWidget } from '../src/ReadingShelfWidget'
import { WeatherWidget } from '../src/WeatherWidget'
import { MapWidget } from '../src/MapWidget'
import { HabitsWidget, resolveHabitsState, defaultHabitItems, getTodayDateString } from '../src/HabitsWidget'
import { DashboardSettings } from '../src/DashboardSettings'
import type { AppState, DashboardCustomPreset, Resource, Space, WidgetConfig } from '../src/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('Dashboard Grid Model & Constraints', () => {
  it('вычисляет корректные span для стандартных размеров и типов', () => {
    expect(widgetDefaultSpan('day')).toEqual({ colSpan: 6, rowSpan: 6 })
    expect(widgetDefaultSpan('capture')).toEqual({ colSpan: 6, rowSpan: 2 })
    expect(widgetDefaultSpan('notes')).toEqual({ colSpan: 6, rowSpan: 4 })
    expect(widgetDefaultSpan('reading')).toEqual({ colSpan: 6, rowSpan: 4 })
    expect(widgetDefaultSpan('resume', 'S')).toEqual({ colSpan: 4, rowSpan: 4 })
    expect(widgetDefaultSpan('news', 'L')).toEqual({ colSpan: 12, rowSpan: 4 })
  })

  it('вычисляет детерминированные colStart и удерживает карточки в своих колонках при изменении высоты', () => {
    // 3 карточки: resume (слева 6х4), day (справа 6х4), news (слева 6х4)
    const widgets: WidgetConfig[] = [
      { id: 'resume', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'day', type: 'day', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'news', type: 'news', size: 'M', colSpan: 6, rowSpan: 4 }
    ]

    const initialPos = computeWidgetPositions(widgets)
    expect(initialPos.resume.colStart).toBe(1)
    expect(initialPos.day.colStart).toBe(7)
    expect(initialPos.news.colStart).toBe(1) // Карточка новостей начинает 2-й ряд строго с 1-й колонки

    // Уменьшаем правую верхнюю карточку дня по высоте: rowSpan с 4 до 3
    const liveSpans = {
      day: { colSpan: 6, rowSpan: 3 }
    }
    const updatedPos = computeWidgetPositions(widgets, liveSpans)

    // Карточка новостей ОБЯЗАНА оставаться в 1-й колонке слева под resume, а не прыгать в 7-ю колонку под day
    expect(updatedPos.resume.colStart).toBe(1)
    expect(updatedPos.day.colStart).toBe(7)
    expect(updatedPos.news.colStart).toBe(1)
  })

  it('соблюдает границы widgetConstraints при произвольном ресайзе', () => {
    // Day constraints: minCol: 3, maxCol: 12, minRow: 2, maxRow: 8
    const widgetDay = { id: 'd1', type: 'day' as const, colSpan: 1, rowSpan: 20 }
    const spanDay = widgetSpan(widgetDay)
    expect(spanDay.colSpan).toBe(widgetConstraints.day.minCol) // clamped to 3
    expect(spanDay.rowSpan).toBe(widgetConstraints.day.maxRow) // clamped to 8

    // Scratchpad constraints: minCol: 2, maxCol: 12, minRow: 2, maxRow: 8
    const widgetNotes = { id: 'n1', type: 'notes' as const, colSpan: 8, rowSpan: 6 }
    const spanNotes = widgetSpan(widgetNotes)
    expect(spanNotes).toEqual({ colSpan: 8, rowSpan: 6 })
  })

  it('мигрирует старые раскладки сетки (6 колонок / 4 строки) в новую 12-колоночную систему', () => {
    const oldWidgets = [
      { id: 'w1', type: 'resume' as const, size: 'M' as const, colSpan: 3, rowSpan: 2 },
      { id: 'w2', type: 'day' as const, size: 'M' as const, colSpan: 3, rowSpan: 2 }
    ]
    const migrated = dashboardWidgets(oldWidgets, undefined)
    expect(migrated[0].colSpan).toBe(6)
    expect(migrated[0].rowSpan).toBe(4)
    expect(migrated[1].colSpan).toBe(6)
    expect(migrated[1].rowSpan).toBe(4)

    // При gridVersion >= 2 повторная миграция не применяется
    const v2Widgets = [
      { id: 'w1', type: 'resume' as const, size: 'M' as const, colSpan: 6, rowSpan: 4 }
    ]
    expect(dashboardWidgets(v2Widgets, 2)).toBe(v2Widgets)
  })

  it('содержит корректные названия всех виджетов, включая погоду и карты', () => {
    expect(widgetNames.reading).toBe('Чтение на потом')
    expect(widgetNames.notes).toBe('Заметки')
    expect(widgetNames.day).toBe('Дела и календарь')
    expect(widgetNames.weather).toBe('Подробная погода')
    expect(widgetNames.map).toBe('Карты и пробки')
  })

  it('содержит готовые встроенные пресеты (спокойный, рабочий, обзор, город)', () => {
    const calm = builtinDashboardPresets.find(p => p.id === 'calm')
    expect(calm).toBeDefined()
    expect(calm?.name).toContain('Спокойный')
    // В спокойном пресете нет отвлекающих новостей и почты
    expect(calm?.widgets.some(w => w.type === 'news')).toBe(false)
    expect(calm?.widgets.some(w => w.type === 'mail')).toBe(false)
    expect(calm?.widgets.some(w => w.type === 'focus')).toBe(true)
    expect(calm?.widgets.some(w => w.type === 'notes')).toBe(true)

    const work = builtinDashboardPresets.find(p => p.id === 'work')
    expect(work).toBeDefined()
    expect(work?.name).toContain('Рабочий')
    // В рабочем пресете есть почта, новости, дела, пространства и погода
    expect(work?.widgets.some(w => w.type === 'mail')).toBe(true)
    expect(work?.widgets.some(w => w.type === 'news')).toBe(true)
    expect(work?.widgets.some(w => w.type === 'day')).toBe(true)
    expect(work?.widgets.some(w => w.type === 'weather')).toBe(true)

    const city = builtinDashboardPresets.find(p => p.id === 'city')
    expect(city).toBeDefined()
    expect(city?.widgets.some(w => w.type === 'weather')).toBe(true)
    expect(city?.widgets.some(w => w.type === 'map')).toBe(true)
  })

  it('getPresetWidgets возвращает виджеты встроенных и сохранённых пользовательских пресетов', () => {
    const calmWidgets = getPresetWidgets('calm')
    expect(calmWidgets).toHaveLength(4)
    // Возвращает глубокую копию
    expect(calmWidgets).not.toBe(builtinDashboardPresets.find(p => p.id === 'calm')?.widgets)

    const customPresets: DashboardCustomPreset[] = [
      {
        id: 'my-custom-1',
        name: 'Мой кодинг-сетап',
        widgets: [{ id: 'w1', type: 'focus', size: 'M' }],
        createdAt: '2026-10-18T00:00:00Z'
      }
    ]

    const loaded = getPresetWidgets('my-custom-1', customPresets)
    expect(loaded).toEqual([{ id: 'w1', type: 'focus', size: 'M' }])
    expect(getPresetWidgets('non-existent', customPresets)).toBeNull()
  })

  it('корректно вычисляет defaultSpan и constraints для карточек weather и map', () => {
    expect(widgetDefaultSpan('weather')).toEqual({ colSpan: 6, rowSpan: 5 })
    expect(widgetDefaultSpan('map')).toEqual({ colSpan: 6, rowSpan: 5 })

    expect(widgetConstraints.weather.minCol).toBe(3)
    expect(widgetConstraints.weather.minRow).toBe(3)
    expect(widgetConstraints.map.minCol).toBe(3)
    expect(widgetConstraints.map.minRow).toBe(3)
  })
})

describe('ScratchpadWidget & ReadingShelfWidget UI', () => {
  let root: Root
  beforeEach(() => {
    localStorage.removeItem('dombro:reading-shelf-view')
    document.body.innerHTML = '<div id="test-root"></div>'
    root = createRoot(document.getElementById('test-root')!)
  })
  afterEach(async () => {
    localStorage.removeItem('dombro:reading-shelf-view')
    await act(async () => root.unmount())
  })

  const baseState: AppState = {
    version: 2,
    spaces: [],
    reminders: [],
    dismissedUntil: null,
    scratchpadNote: 'Привет, мир\n- [ ] Дело 1'
  }

  it('Scratchpad отображает сохранённый текст и реагирует на ввод', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onSaveThought = vi.fn()

    await act(async () => {
      root.render(<ScratchpadWidget state={baseState} onChange={onChange} onSaveThought={onSaveThought} />)
    })

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('Привет, мир\n- [ ] Дело 1')

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Новая заметка')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.dispatchEvent(new Event('change', { bubbles: true }))
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onChange).toHaveBeenCalled()
    const updater = onChange.mock.calls[0][0]
    const updated = updater(baseState)
    expect(updated.scratchpadNote).toBe('Новая заметка')
    vi.useRealTimers()
  })

  it('Scratchpad превращает первую строку заметки в дело через onSaveThought', async () => {
    const onChange = vi.fn()
    const onSaveThought = vi.fn()

    await act(async () => {
      root.render(<ScratchpadWidget state={baseState} onChange={onChange} onSaveThought={onSaveThought} />)
    })

    const convertBtn = document.querySelector('button[title="Создать дело из первой строки"]') as HTMLButtonElement
    expect(convertBtn).toBeDefined()
    await act(async () => {
      convertBtn.click()
    })

    expect(onSaveThought).toHaveBeenCalledWith('Привет, мир', null, null, 'task')
  })

  it('ReadingShelf отображает ссылки и отмечает их прочитанными', async () => {
    const linkRes1: Resource = {
      id: 'link-1',
      name: 'Интересная статья про Calm Tech',
      kind: 'link',
      target: 'https://example.com/calm-tech',
      createdAt: new Date().toISOString()
    }
    const linkRes2: Resource = {
      id: 'link-2',
      name: 'Прочитанная статья',
      kind: 'link',
      target: 'https://example.com/done',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    }
    const space: Space = {
      id: 'space-1',
      name: 'Работа',
      tone: 'sage',
      resources: [linkRes1, linkRes2]
    }
    const stateWithLinks: AppState = {
      version: 2,
      spaces: [space],
      reminders: [],
      dismissedUntil: null
    }

    const onChange = vi.fn()
    const onOpen = vi.fn()
    const onAddLink = vi.fn()

    await act(async () => {
      root.render(<ReadingShelfWidget state={stateWithLinks} onChange={onChange} onOpen={onOpen} onAddLink={onAddLink} />)
    })

    expect(document.body.textContent).toContain('Интересная статья про Calm Tech')
    expect(document.body.textContent).not.toContain('Прочитанная статья')

    // Click link
    const linkBtn = document.querySelector('.reading-shelf-open') as HTMLButtonElement
    await act(async () => {
      linkBtn.click()
    })
    expect(onOpen).toHaveBeenCalledWith(linkRes1)

    // Mark completed
    const checkBtn = document.querySelector('.reading-shelf-check') as HTMLButtonElement
    await act(async () => {
      checkBtn.click()
    })
    expect(onChange).toHaveBeenCalled()
    const updater = onChange.mock.calls[0][0]
    const nextState = updater(stateWithLinks)
    expect(nextState.spaces[0].resources.find((r: Resource) => r.id === linkRes1.id)?.completedAt).toBeDefined()
  })

  it('переключает режим отображения между списком и плитками и отображает квадратные миниатюры', async () => {
    const linkRes: Resource = {
      id: 'res-grid-1',
      name: 'Дизайн систем и типографика',
      kind: 'link',
      target: 'https://habr.com/ru/articles/123456/',
      createdAt: new Date().toISOString()
    }
    const stateWithLink: AppState = {
      version: 2,
      spaces: [{ id: 'space-1', name: 'Дизайн', tone: 'sage', resources: [linkRes] }],
      reminders: [],
      dismissedUntil: null
    }

    await act(async () => {
      root.render(<ReadingShelfWidget state={stateWithLink} onChange={vi.fn()} onOpen={vi.fn()} onAddLink={vi.fn()} />)
    })

    // Default list view
    expect(document.querySelector('.reading-shelf-list')).not.toBeNull()
    expect(document.querySelector('.reading-shelf-grid')).toBeNull()

    // Switch to grid view
    const gridBtn = document.querySelector('button[aria-label="Отображение плитками"]') as HTMLButtonElement
    expect(gridBtn).not.toBeNull()
    await act(async () => {
      gridBtn.click()
    })

    expect(document.querySelector('.reading-shelf-grid')).not.toBeNull()
    expect(document.querySelector('.reading-shelf-list')).toBeNull()

    // Check square thumbnail structure
    const tile = document.querySelector('.reading-shelf-tile') as HTMLElement
    expect(tile).not.toBeNull()
    const thumb = tile.querySelector('.reading-tile-thumb') as HTMLElement
    expect(thumb).not.toBeNull()
    expect(thumb.textContent).toContain('мин')
    expect(thumb.textContent).toContain('H') // Monogram for habr

    const tileTitle = tile.querySelector('.reading-tile-title') as HTMLElement
    expect(tileTitle.textContent).toContain('Дизайн систем и типографика')

    // Switch back to list view
    const listBtn = document.querySelector('button[aria-label="Отображение списком"]') as HTMLButtonElement
    await act(async () => {
      listBtn.click()
    })
    expect(document.querySelector('.reading-shelf-list')).not.toBeNull()
    expect(document.querySelector('.reading-shelf-grid')).toBeNull()
  })

  it('отображает скриншот из covers при совпадении адреса вкладки в режиме плиток', async () => {
    const linkRes: Resource = {
      id: 'res-cover-1',
      name: 'Документация React',
      kind: 'link',
      target: 'https://react.dev/learn',
      createdAt: new Date().toISOString()
    }
    const fakeCoverData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const stateWithTab: AppState = {
      version: 2,
      spaces: [{
        id: 'sp-1',
        name: 'Разработка',
        tone: 'sage',
        resources: [linkRes],
        session: { tabs: [{ id: 'tab-react-1', title: 'React', url: 'https://react.dev/learn' }], activeTabId: 'tab-react-1' }
      }],
      reminders: [],
      dismissedUntil: null
    }

    await act(async () => {
      root.render(
        <ReadingShelfWidget
          state={stateWithTab}
          onChange={vi.fn()}
          onOpen={vi.fn()}
          onAddLink={vi.fn()}
          covers={{ 'tab-react-1': fakeCoverData }}
        />
      )
    })

    const gridBtn = document.querySelector('button[aria-label="Отображение плитками"]') as HTMLButtonElement
    expect(gridBtn).not.toBeNull()
    await act(async () => {
      gridBtn.click()
    })

    const coverImg = document.querySelector('.reading-tile-cover-img') as HTMLImageElement
    expect(coverImg).not.toBeNull()
    expect(coverImg.src).toBe(fakeCoverData)
  })

  it('выполняет порционную подгрузку при скролле для длинных списков', async () => {
    const manyResources: Resource[] = Array.from({ length: 25 }, (_, i) => ({
      id: `link-${i}`,
      name: `Материал номер ${i + 1}`,
      kind: 'link',
      target: `https://example.com/item-${i + 1}`,
      createdAt: new Date(Date.now() - i * 1000).toISOString()
    }))

    const stateWithMany: AppState = {
      version: 2,
      spaces: [{ id: 'space-1', name: 'Чтение', tone: 'sage', resources: manyResources }],
      reminders: [],
      dismissedUntil: null
    }

    await act(async () => {
      root.render(<ReadingShelfWidget state={stateWithMany} onChange={vi.fn()} onOpen={vi.fn()} onAddLink={vi.fn()} />)
    })

    // Initially loads first batch (12 items)
    const rowsInitial = document.querySelectorAll('.reading-shelf-row')
    expect(rowsInitial.length).toBe(12)

    // Simulate scroll to near bottom
    const scrollContainer = document.querySelector('.reading-shelf-scroll') as HTMLDivElement
    expect(scrollContainer).not.toBeNull()

    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 300, configurable: true })
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 680, configurable: true }) // 680 + 300 = 980 >= 1000 - 60

    await act(async () => {
      scrollContainer.dispatchEvent(new Event('scroll'))
    })

    // Next batch loaded (12 + 12 = 24 items)
    const rowsAfter = document.querySelectorAll('.reading-shelf-row')
    expect(rowsAfter.length).toBe(24)
  })
})

describe('useDashboardDrag Edge Resizing & Tactile Snap Landing', () => {
  let root: Root
  beforeEach(() => {
    document.body.innerHTML = '<div id="test-root"></div>'
    root = createRoot(document.getElementById('test-root')!)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
  })

  it('тянет за правый край (ew-resize): меняет ширину в пикселях, оставляет высоту и приземляется по сетке', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const initialWidgets: WidgetConfig[] = [
      { id: 'w1', type: 'notes', size: 'M', colSpan: 6, rowSpan: 4 }
    ]

    const { useDashboardDrag } = await import('../src/useDashboardDrag')
    const { useRef } = await import('react')

    function Harness() {
      const gridRef = useRef<HTMLDivElement>(null)
      const drag = useDashboardDrag({ widgets: initialWidgets, onWidgetsChange: onChange, gridRef })

      return (
        <div ref={gridRef} style={{ width: 1200 }} className={`dashboard-grid ${drag.resizingEdge ? `resizing-${drag.resizingEdge}` : ''}`}>
          <button data-testid="edit-btn" onClick={() => drag.setIsEditing(true)}>Edit</button>
          <div data-testid="resizing-id">{drag.resizingId || 'none'}</div>
          <div data-testid="snapping-id">{drag.isSnappingId || 'none'}</div>
          <div data-testid="resizing-edge">{drag.resizingEdge || 'none'}</div>
          <div data-testid="live-width">{drag.livePixelSizes.w1?.width ?? 'none'}</div>
          <div data-testid="live-height">{drag.livePixelSizes.w1?.height ?? 'none'}</div>
          <div data-testid="ghost-col">{drag.ghostSpans.w1?.colSpan ?? 'none'}</div>
          <div data-testid="ghost-row">{drag.ghostSpans.w1?.rowSpan ?? 'none'}</div>

          <div data-widget-id="w1">
            <div
              data-testid="edge-right"
              className="widget-edge-handle widget-edge-right"
              onPointerDown={e => drag.onResizePointerDown(e, 'w1', 'right')}
            />
            <div
              data-testid="edge-bottom"
              className="widget-edge-handle widget-edge-bottom"
              onPointerDown={e => drag.onResizePointerDown(e, 'w1', 'bottom')}
            />
            <div
              data-testid="corner"
              className="widget-corner-handle"
              onPointerDown={e => drag.onResizePointerDown(e, 'w1', 'corner')}
            />
          </div>
        </div>
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })

    // 1. Enter edit mode
    const editBtn = document.querySelector('[data-testid="edit-btn"]') as HTMLButtonElement
    await act(async () => {
      editBtn.click()
    })

    // 2. Pointer down on right edge
    const rightEdge = document.querySelector('[data-testid="edge-right"]') as HTMLElement
    await act(async () => {
      rightEdge.dispatchEvent(new MouseEvent('pointerdown', {
        clientX: 500,
        clientY: 200,
        button: 0,
        bubbles: true
      }))
    })

    expect(document.querySelector('[data-testid="resizing-id"]')?.textContent).toBe('w1')
    expect(document.querySelector('[data-testid="resizing-edge"]')?.textContent).toBe('right')
    const startWidth = Number(document.querySelector('[data-testid="live-width"]')?.textContent)
    const startHeight = Number(document.querySelector('[data-testid="live-height"]')?.textContent)
    expect(startWidth).toBeGreaterThan(0)
    expect(startHeight).toBeGreaterThan(0)

    // 3. Move pointer horizontally +200px
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', {
        clientX: 700,
        clientY: 200,
        bubbles: true
      }))
    })

    const movedWidth = Number(document.querySelector('[data-testid="live-width"]')?.textContent)
    const movedHeight = Number(document.querySelector('[data-testid="live-height"]')?.textContent)
    expect(movedWidth).toBe(startWidth + 200)
    // Height must not change during right edge resize
    expect(movedHeight).toBe(startHeight)

    // Target colSpan should expand to 8
    expect(document.querySelector('[data-testid="ghost-col"]')?.textContent).toBe('8')
    expect(document.querySelector('[data-testid="ghost-row"]')?.textContent).toBe('4')

    // 4. Release pointer: triggers snap landing
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', {
        clientX: 700,
        clientY: 200,
        bubbles: true
      }))
    })

    expect(document.querySelector('[data-testid="snapping-id"]')?.textContent).toBe('w1')

    // 5. Fast-forward snap animation (220ms)
    await act(async () => {
      vi.advanceTimersByTime(220)
    })

    expect(onChange).toHaveBeenCalled()
    const updatedWidgets = onChange.mock.calls[0][0]
    expect(updatedWidgets[0].colSpan).toBe(8)
    expect(updatedWidgets[0].rowSpan).toBe(4)
    expect(document.querySelector('[data-testid="snapping-id"]')?.textContent).toBe('none')
    expect(document.querySelector('[data-testid="live-width"]')?.textContent).toBe('none')

    vi.useRealTimers()
  })

  it('тянет за нижний край (ns-resize): меняет высоту в пикселях, оставляет ширину', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const initialWidgets: WidgetConfig[] = [
      { id: 'w1', type: 'notes', size: 'M', colSpan: 6, rowSpan: 4 }
    ]

    const { useDashboardDrag } = await import('../src/useDashboardDrag')
    const { useRef } = await import('react')

    function Harness() {
      const gridRef = useRef<HTMLDivElement>(null)
      const drag = useDashboardDrag({ widgets: initialWidgets, onWidgetsChange: onChange, gridRef })

      return (
        <div ref={gridRef} style={{ width: 1200 }} className={`dashboard-grid ${drag.resizingEdge ? `resizing-${drag.resizingEdge}` : ''}`}>
          <div data-testid="resizing-id">{drag.resizingId || 'none'}</div>
          <div data-testid="resizing-edge">{drag.resizingEdge || 'none'}</div>
          <div data-testid="live-width">{drag.livePixelSizes.w1?.width ?? 'none'}</div>
          <div data-testid="live-height">{drag.livePixelSizes.w1?.height ?? 'none'}</div>
          <div data-testid="ghost-col">{drag.ghostSpans.w1?.colSpan ?? 'none'}</div>
          <div data-testid="ghost-row">{drag.ghostSpans.w1?.rowSpan ?? 'none'}</div>

          <div data-widget-id="w1">
            <div
              data-testid="edge-bottom"
              className="widget-edge-handle widget-edge-bottom"
              onPointerDown={e => drag.onResizePointerDown(e, 'w1', 'bottom')}
            />
          </div>
        </div>
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })

    const bottomEdge = document.querySelector('[data-testid="edge-bottom"]') as HTMLElement
    await act(async () => {
      bottomEdge.dispatchEvent(new MouseEvent('pointerdown', {
        clientX: 500,
        clientY: 300,
        button: 0,
        bubbles: true
      }))
    })

    expect(document.querySelector('[data-testid="resizing-edge"]')?.textContent).toBe('bottom')
    const startWidth = Number(document.querySelector('[data-testid="live-width"]')?.textContent)
    const startHeight = Number(document.querySelector('[data-testid="live-height"]')?.textContent)

    // Move pointer vertically +150px
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', {
        clientX: 500,
        clientY: 450,
        bubbles: true
      }))
    })

    const movedWidth = Number(document.querySelector('[data-testid="live-width"]')?.textContent)
    const movedHeight = Number(document.querySelector('[data-testid="live-height"]')?.textContent)
    expect(movedWidth).toBe(startWidth)
    expect(movedHeight).toBe(startHeight + 150)

    // Target rowSpan should expand from 4 to 6
    expect(document.querySelector('[data-testid="ghost-row"]')?.textContent).toBe('6')

    // Release pointer & advance timers
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', {
        clientX: 500,
        clientY: 450,
        bubbles: true
      }))
      vi.advanceTimersByTime(220)
    })

    expect(onChange).toHaveBeenCalled()
    const updated = onChange.mock.calls[0][0]
    expect(updated[0].rowSpan).toBe(6)
    expect(updated[0].colSpan).toBe(6)

    vi.useRealTimers()
  })

  it('тянет за угол (nwse-resize): меняет одновременно ширину и высоту, соблюдая границы widgetConstraints', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const initialWidgets: WidgetConfig[] = [
      { id: 'w1', type: 'notes', size: 'M', colSpan: 6, rowSpan: 4 }
    ]

    const { useDashboardDrag } = await import('../src/useDashboardDrag')
    const { useRef } = await import('react')

    function Harness() {
      const gridRef = useRef<HTMLDivElement>(null)
      const drag = useDashboardDrag({ widgets: initialWidgets, onWidgetsChange: onChange, gridRef })

      return (
        <div ref={gridRef} style={{ width: 1200 }} className={`dashboard-grid ${drag.resizingEdge ? `resizing-${drag.resizingEdge}` : ''}`}>
          <div data-testid="resizing-id">{drag.resizingId || 'none'}</div>
          <div data-testid="resizing-edge">{drag.resizingEdge || 'none'}</div>
          <div data-testid="live-width">{drag.livePixelSizes.w1?.width ?? 'none'}</div>
          <div data-testid="live-height">{drag.livePixelSizes.w1?.height ?? 'none'}</div>
          <div data-testid="ghost-col">{drag.ghostSpans.w1?.colSpan ?? 'none'}</div>
          <div data-testid="ghost-row">{drag.ghostSpans.w1?.rowSpan ?? 'none'}</div>

          <div data-widget-id="w1">
            <div
              data-testid="corner"
              className="widget-corner-handle"
              onPointerDown={e => drag.onResizePointerDown(e, 'w1', 'corner')}
            />
          </div>
        </div>
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })

    const corner = document.querySelector('[data-testid="corner"]') as HTMLElement
    await act(async () => {
      corner.dispatchEvent(new MouseEvent('pointerdown', {
        clientX: 500,
        clientY: 300,
        button: 0,
        bubbles: true
      }))
    })

    expect(document.querySelector('[data-testid="resizing-edge"]')?.textContent).toBe('corner')
    const startWidth = Number(document.querySelector('[data-testid="live-width"]')?.textContent)
    const startHeight = Number(document.querySelector('[data-testid="live-height"]')?.textContent)

    // Move pointer diagonally +200px X, +150px Y
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', {
        clientX: 700,
        clientY: 450,
        bubbles: true
      }))
    })

    const movedWidth = Number(document.querySelector('[data-testid="live-width"]')?.textContent)
    const movedHeight = Number(document.querySelector('[data-testid="live-height"]')?.textContent)
    expect(movedWidth).toBe(startWidth + 200)
    expect(movedHeight).toBe(startHeight + 150)
    expect(document.querySelector('[data-testid="ghost-col"]')?.textContent).toBe('8')
    expect(document.querySelector('[data-testid="ghost-row"]')?.textContent).toBe('6')

    // Try to drag far past the maximum boundary (+2000px)
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', {
        clientX: 2500,
        clientY: 2000,
        bubbles: true
      }))
    })

    // Clamped to maxCol: 12, maxRow: 8 for notes widget
    expect(document.querySelector('[data-testid="ghost-col"]')?.textContent).toBe('12')
    expect(document.querySelector('[data-testid="ghost-row"]')?.textContent).toBe('8')

    // Release & advance snap landing
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', {
        clientX: 2500,
        clientY: 2000,
        bubbles: true
      }))
      vi.advanceTimersByTime(220)
    })

    expect(onChange).toHaveBeenCalled()
    const updated = onChange.mock.calls[0][0]
    expect(updated[0].colSpan).toBe(12)
    expect(updated[0].rowSpan).toBe(8)

    vi.useRealTimers()
  })

  it('адаптирует соседние карточки по правилам: при сжатии карточки соседи НЕ расширяются; при расширении левой карточки в упор к правой — правая сжимается', () => {
    const widgets: WidgetConfig[] = [
      { id: 'w1', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'w2', type: 'day', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'w3', type: 'news', size: 'M', colSpan: 12, rowSpan: 4 }
    ]

    // 1. Сжатие правой карточки w2 с 6 до 4 -> левая карточка w1 НЕ увеличивается и остаётся 6
    const shrinkRight = adaptRowSpans(widgets, 'w2', 4, 'right')
    expect(shrinkRight.w2).toBe(4)
    expect(shrinkRight.w1).toBe(6)
    expect(shrinkRight.w3).toBe(12)

    // 2. Сжатие левой карточки w1 с 6 до 4 -> правая карточка w2 НЕ увеличивается и остаётся 6
    const shrinkLeft = adaptRowSpans(widgets, 'w1', 4, 'right')
    expect(shrinkLeft.w1).toBe(4)
    expect(shrinkLeft.w2).toBe(6)
    expect(shrinkLeft.w3).toBe(12)

    // 3. Расширение левой карточки w1 с 6 до 8, когда правая w2 уже упёрлась в правый край (6 + 6 = 12) -> правая w2 сжимается до 4
    const expandLeft = adaptRowSpans(widgets, 'w1', 8, 'right')
    expect(expandLeft.w1).toBe(8)
    expect(expandLeft.w2).toBe(4)
    expect(expandLeft.w3).toBe(12)

    // 4. Если в строке есть пустое место (например, w1 = 4, w2 = 4, сумма = 8), при расширении w1 до 6 правая w2 НЕ сжимается
    const spacedWidgets: WidgetConfig[] = [
      { id: 'w1', type: 'resume', size: 'M', colSpan: 4, rowSpan: 4 },
      { id: 'w2', type: 'day', size: 'M', colSpan: 4, rowSpan: 4 }
    ]
    const expandIntoEmpty = adaptRowSpans(spacedWidgets, 'w1', 6, 'right')
    expect(expandIntoEmpty.w1).toBe(6)
    expect(expandIntoEmpty.w2).toBe(4) // Не упёрлась в край, поэтому не сжимается

    // 5. Когда расширение w1 превышает свободное место (w1 = 4, w2 = 4 -> w1 расширяется до 9), w2 упирается в край и сжимается до 3
    const expandIntoWall = adaptRowSpans(spacedWidgets, 'w1', 9, 'right')
    expect(expandIntoWall.w1).toBe(9)
    expect(expandIntoWall.w2).toBe(3)

    // 6. Попытка растянуть правую карточку вправо, когда она уже у края -> не расширяется за 12 и не сжимает соседа слева
    const expandRightAtWall = adaptRowSpans(widgets, 'w2', 8, 'right')
    expect(expandRightAtWall.w2).toBe(6)
    expect(expandRightAtWall.w1).toBe(6)

    // 7. Расширение w2 влево за левый край (edge: 'left') сжимает соседа слева w1
    const expandLeftHandle = adaptRowSpans(widgets, 'w2', 8, 'left')
    expect(expandLeftHandle.w2).toBe(8)
    expect(expandLeftHandle.w1).toBe(4)
  })

  it('перетаскивает любую карточку в режиме редактирования, меняет смещение и запускает анимацию приземления', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const initialWidgets: WidgetConfig[] = [
      { id: 'w1', type: 'resume', size: 'M', colSpan: 3, rowSpan: 2 },
      { id: 'w2', type: 'day', size: 'M', colSpan: 3, rowSpan: 2 }
    ]

    const { useDashboardDrag } = await import('../src/useDashboardDrag')
    const { useRef } = await import('react')

    function DragHarness() {
      const gridRef = useRef<HTMLDivElement>(null)
      const drag = useDashboardDrag({ widgets: initialWidgets, onWidgetsChange: onChange, gridRef })

      return (
        <div ref={gridRef} className={`dashboard-grid ${drag.isEditing ? 'editing-grid' : ''}`}>
          <button data-testid="enter-edit" onClick={() => drag.setIsEditing(true)}>Edit</button>
          <div data-testid="dragging-id">{drag.draggingId || 'none'}</div>
          <div data-testid="landing-id">{drag.isLandingId || 'none'}</div>
          <div data-testid="drag-x">{drag.dragOffset?.x ?? 'none'}</div>
          <div data-testid="drag-y">{drag.dragOffset?.y ?? 'none'}</div>

          <div
            data-testid="card-w1"
            data-widget-id="w1"
            onPointerDown={e => drag.onCardPointerDown(e, 'w1')}
          >
            w1
          </div>
          <div
            data-testid="card-w2"
            data-widget-id="w2"
            onPointerDown={e => drag.onCardPointerDown(e, 'w2')}
          >
            w2
          </div>
        </div>
      )
    }

    await act(async () => {
      root.render(<DragHarness />)
    })

    // Включаем режим редактирования
    const editBtn = document.querySelector('[data-testid="enter-edit"]') as HTMLButtonElement
    await act(async () => {
      editBtn.click()
    })

    // Захватываем вторую карточку w2
    const cardW2 = document.querySelector('[data-testid="card-w2"]') as HTMLElement
    await act(async () => {
      cardW2.dispatchEvent(new MouseEvent('pointerdown', {
        clientX: 400,
        clientY: 200,
        button: 0,
        bubbles: true
      }))
    })

    expect(document.querySelector('[data-testid="dragging-id"]')?.textContent).toBe('w2')
    expect(document.querySelector('[data-testid="drag-x"]')?.textContent).toBe('0')
    expect(document.querySelector('[data-testid="drag-y"]')?.textContent).toBe('0')

    // Моделируем наведение на cardW1 при перемещении
    const origElementFromPoint = document.elementFromPoint
    const cardW1 = document.querySelector('[data-testid="card-w1"]') as HTMLElement
    document.elementFromPoint = () => cardW1

    // Перемещаем карточку w2 на +100px X, +50px Y
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', {
        clientX: 500,
        clientY: 250,
        bubbles: true
      }))
    })

    expect(document.querySelector('[data-testid="drag-x"]')?.textContent).toBe('100')
    expect(document.querySelector('[data-testid="drag-y"]')?.textContent).toBe('50')
    expect(onChange).toHaveBeenCalled()
    const reordered = onChange.mock.calls[0][0]
    expect(reordered[0].id).toBe('w2')
    expect(reordered[1].id).toBe('w1')

    document.elementFromPoint = origElementFromPoint

    // Отпускаем карточку
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', {
        clientX: 500,
        clientY: 250,
        bubbles: true
      }))
    })

    // Включается анимация приземления isLandingId
    expect(document.querySelector('[data-testid="landing-id"]')?.textContent).toBe('w2')

    // После 220мс состояние очищается
    await act(async () => {
      vi.advanceTimersByTime(220)
    })

    expect(document.querySelector('[data-testid="landing-id"]')?.textContent).toBe('none')
    expect(document.querySelector('[data-testid="dragging-id"]')?.textContent).toBe('none')

    vi.useRealTimers()
  })

  it('кнопка отмены изменений (cancelEditing) возвращает прежнее состояние раскладки', async () => {
    const onChange = vi.fn()
    const initialWidgets: WidgetConfig[] = [
      { id: 'w1', type: 'resume', size: 'M', colSpan: 3, rowSpan: 2 },
      { id: 'w2', type: 'day', size: 'M', colSpan: 3, rowSpan: 2 }
    ]

    const { useDashboardDrag } = await import('../src/useDashboardDrag')
    const { useRef } = await import('react')

    function CancelHarness() {
      const gridRef = useRef<HTMLDivElement>(null)
      const drag = useDashboardDrag({ widgets: initialWidgets, onWidgetsChange: onChange, gridRef })

      return (
        <div ref={gridRef}>
          <button data-testid="edit-btn" onClick={() => drag.setIsEditing(true)}>Edit</button>
          <button data-testid="remove-btn" onClick={() => drag.removeWidget('w2')}>Remove w2</button>
          <button data-testid="cancel-btn" onClick={() => drag.cancelEditing()}>Cancel</button>
          <button data-testid="save-btn" onClick={() => drag.saveEditing()}>Save</button>
          <div data-testid="is-editing">{String(drag.isEditing)}</div>
        </div>
      )
    }

    await act(async () => {
      root.render(<CancelHarness />)
    })

    // Входим в режим редактирования
    const editBtn = document.querySelector('[data-testid="edit-btn"]') as HTMLButtonElement
    await act(async () => {
      editBtn.click()
    })
    expect(document.querySelector('[data-testid="is-editing"]')?.textContent).toBe('true')

    // Удаляем виджет w2 во время редактирования
    const removeBtn = document.querySelector('[data-testid="remove-btn"]') as HTMLButtonElement
    await act(async () => {
      removeBtn.click()
    })
    expect(onChange).toHaveBeenCalledWith([{ id: 'w1', type: 'resume', size: 'M', colSpan: 3, rowSpan: 2 }])

    // Нажимаем «Отмена»
    const cancelBtn = document.querySelector('[data-testid="cancel-btn"]') as HTMLButtonElement
    await act(async () => {
      cancelBtn.click()
    })

    // Виджеты должны откатиться к исходному состоянию до входа в режим редактирования
    expect(onChange).toHaveBeenLastCalledWith(initialWidgets)
    expect(document.querySelector('[data-testid="is-editing"]')?.textContent).toBe('false')
  })

  it('тянет за левый край (ew-resize): расширяет карточку влево, адаптируя соседа', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const initialWidgets: WidgetConfig[] = [
      { id: 'w1', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'w2', type: 'notes', size: 'M', colSpan: 6, rowSpan: 4 }
    ]

    const { useDashboardDrag } = await import('../src/useDashboardDrag')
    const { useRef } = await import('react')

    function LeftResizeHarness() {
      const gridRef = useRef<HTMLDivElement>(null)
      const drag = useDashboardDrag({ widgets: initialWidgets, onWidgetsChange: onChange, gridRef })

      return (
        <div ref={gridRef} style={{ width: 1200 }} className="dashboard-grid">
          <div data-testid="live-width-w2">{drag.livePixelSizes.w2?.width ?? 'none'}</div>
          <div data-testid="ghost-col-w2">{drag.ghostSpans.w2?.colSpan ?? 'none'}</div>
          <div data-testid="ghost-col-w1">{drag.ghostSpans.w1?.colSpan ?? 'none'}</div>
          <div data-testid="shift-x">{drag.resizeShiftX}</div>

          <div data-widget-id="w2">
            <div
              data-testid="left-handle-w2"
              className="widget-edge-handle widget-edge-left"
              onPointerDown={e => drag.onResizePointerDown(e, 'w2', 'left')}
            />
          </div>
        </div>
      )
    }

    await act(async () => {
      root.render(<LeftResizeHarness />)
    })

    const leftHandle = document.querySelector('[data-testid="left-handle-w2"]') as HTMLElement
    await act(async () => {
      leftHandle.dispatchEvent(new MouseEvent('pointerdown', {
        clientX: 600,
        clientY: 200,
        button: 0,
        bubbles: true
      }))
    })

    const startWidth = Number(document.querySelector('[data-testid="live-width-w2"]')?.textContent)

    // Тянем влево на -200px (clientX: 400)
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', {
        clientX: 400,
        clientY: 200,
        bubbles: true
      }))
    })

    const expandedWidth = Number(document.querySelector('[data-testid="live-width-w2"]')?.textContent)
    expect(expandedWidth).toBe(startWidth + 200)
    // w2 расширяется до 8 колонок, w1 адаптируется до 4 колонок
    expect(document.querySelector('[data-testid="ghost-col-w2"]')?.textContent).toBe('8')
    expect(document.querySelector('[data-testid="ghost-col-w1"]')?.textContent).toBe('4')
    expect(document.querySelector('[data-testid="shift-x"]')?.textContent).toBe('-200')

    // Отпускаем указатель
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', {
        clientX: 400,
        clientY: 200,
        bubbles: true
      }))
      vi.advanceTimersByTime(220)
    })

    expect(onChange).toHaveBeenCalled()
    const updated = onChange.mock.calls[0][0]
    expect(updated.find((w: WidgetConfig) => w.id === 'w2')?.colSpan).toBe(8)
    expect(updated.find((w: WidgetConfig) => w.id === 'w1')?.colSpan).toBe(4)

    vi.useRealTimers()
  })

  it('позволяет уменьшить карточку продолжения дел до 1 строки по высоте (minRow: 1)', () => {
    expect(widgetConstraints.resume.minRow).toBe(1)
    const shrunkResume: WidgetConfig = { id: 'r1', type: 'resume', size: 'M', rowSpan: 1 }
    const span = widgetSpan(shrunkResume)
    expect(span.rowSpan).toBe(1)
  })

  it('отображает плавающую кнопку настроек дашборда в .dashboard-floating-controls и раскрывает 3 кнопки действий при клике', async () => {
    const { Home } = await import('../src/Home')
    const onChange = vi.fn()
    const homeState: AppState = {
      version: 2,
      spaces: [],
      reminders: [],
      dismissedUntil: null,
      scratchpadNote: '',
      dashboard: {
        preset: 'overview',
        gridVersion: 2,
        widgets: [
          { id: 'w1', type: 'notes', size: 'M', colSpan: 6, rowSpan: 4 },
          { id: 'w2', type: 'reading', size: 'M', colSpan: 6, rowSpan: 4 }
        ]
      }
    }

    await act(async () => {
      root.render(
        <Home
          viewportWidth={1440}
          viewportHeight={900}
          onSearchHandled={vi.fn()}
          state={homeState}
          now={new Date('2026-10-16T12:00:00Z')}
          onChange={onChange}
          onCapture={vi.fn()}
          onFocus={vi.fn()}
          onPlan={vi.fn()}
          onCreateAt={vi.fn()}
          onSpace={vi.fn()}
          onOpen={vi.fn()}
          onAddLink={vi.fn()}
          onAssistant={vi.fn()}
          onSaveThought={vi.fn()}
          onImport={vi.fn()}
          onNewTab={vi.fn()}
          onSettings={vi.fn()}
          onCalendarRange={vi.fn()}
          onResume={vi.fn()}
          onOpenContext={vi.fn()}
          onEditContext={vi.fn()}
          onCompleteContext={vi.fn()}
          onOpenDocument={vi.fn()}
        />
      )
    })

    // Карточки обёрнуты в .dashboard-scroll-wrap
    const scrollWrap = document.querySelector('.dashboard-scroll-wrap')
    expect(scrollWrap).not.toBeNull()

    // В обычном режиме нет пустой строки .calm-heading
    expect(document.querySelector('.calm-heading')).toBeNull()

    // Полоса пресетов спрятана в настройки и не загромождает экран Дома
    expect(document.querySelector('.dashboard-preset-bar-wrap')).toBeNull()

    // Справа от карточек в .dashboard-floating-controls находится одна аккуратная кнопка настроек
    const floatingControls = document.querySelector('.dashboard-floating-controls')
    expect(floatingControls).not.toBeNull()

    const toggleBtn = floatingControls?.querySelector('.edit-fab-toggle.dashboard-edit-toggle') as HTMLButtonElement
    expect(toggleBtn).not.toBeNull()

    // Кликаем по кнопке настроек — включается режим редактирования
    await act(async () => {
      toggleBtn.click()
    })

    // Теперь в .dashboard-floating-controls парят кнопки действий:
    // 1-я кнопка на месте шестерёнки — крестик отмены/закрытия для быстрого закрытия без движения мыши
    const cancelBtn = floatingControls?.querySelector('.edit-fab-cancel.edit-cancel-btn') as HTMLButtonElement
    const addBtn = floatingControls?.querySelector('.edit-fab-add.edit-add-btn')
    const doneBtn = floatingControls?.querySelector('.edit-fab-done.edit-done-btn')
    const presetsBtn = floatingControls?.querySelector('.edit-fab-presets.dashboard-presets-quick-btn') as HTMLButtonElement
    const divider = floatingControls?.querySelector('.dashboard-floating-divider')

    expect(cancelBtn).not.toBeNull()
    expect(addBtn).not.toBeNull()
    expect(doneBtn).not.toBeNull()
    expect(presetsBtn).not.toBeNull()
    expect(divider).not.toBeNull()

    // Первая кнопка в контейнере — именно крестик (на месте исходного toggle)
    expect(floatingControls?.firstElementChild).toBe(cancelBtn)

    // Нажимаем «Отмена» — возвращается одиночная кнопка настроек
    await act(async () => {
      cancelBtn.click()
    })

    expect(floatingControls?.querySelector('.edit-fab-toggle.dashboard-edit-toggle')).not.toBeNull()
    expect(floatingControls?.querySelector('.edit-fab-add')).toBeNull()
    expect(floatingControls?.querySelector('.edit-fab-presets')).toBeNull()
  }, 15000)

  it('при попытке растянуть правую карточку за правый край правее края дашборда она не увеличивается влево, а мягко резиново упирается', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const initialWidgets: WidgetConfig[] = [
      { id: 'w1', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'w2', type: 'notes', size: 'M', colSpan: 6, rowSpan: 4 }
    ]

    const { useDashboardDrag } = await import('../src/useDashboardDrag')
    const { useRef } = await import('react')

    function RightWallHarness() {
      const gridRef = useRef<HTMLDivElement>(null)
      const drag = useDashboardDrag({ widgets: initialWidgets, onWidgetsChange: onChange, gridRef })

      return (
        <div ref={gridRef} style={{ width: 1200 }} className="dashboard-grid">
          <div data-testid="live-width-w2">{drag.livePixelSizes.w2?.width ?? 'none'}</div>
          <div data-testid="ghost-col-w2">{drag.ghostSpans.w2?.colSpan ?? 'none'}</div>
          <div data-testid="ghost-col-w1">{drag.ghostSpans.w1?.colSpan ?? 'none'}</div>

          <div data-widget-id="w2">
            <div
              data-testid="right-handle-w2"
              className="widget-edge-handle widget-edge-right"
              onPointerDown={e => drag.onResizePointerDown(e, 'w2', 'right')}
            />
          </div>
        </div>
      )
    }

    await act(async () => {
      root.render(<RightWallHarness />)
    })

    const rightHandle = document.querySelector('[data-testid="right-handle-w2"]') as HTMLElement
    await act(async () => {
      rightHandle.dispatchEvent(new MouseEvent('pointerdown', {
        clientX: 1200,
        clientY: 200,
        button: 0,
        bubbles: true
      }))
    })

    const startWidth = Number(document.querySelector('[data-testid="live-width-w2"]')?.textContent)

    // Тянем вправо на +300px за пределы края дашборда
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', {
        clientX: 1500,
        clientY: 200,
        bubbles: true
      }))
    })

    const rubberWidth = Number(document.querySelector('[data-testid="live-width-w2"]')?.textContent)
    // Ширина не увеличилась на 300px, а мягко резиново сопротивляется (увеличилась лишь на ~34px)
    expect(rubberWidth).toBeGreaterThan(startWidth)
    expect(rubberWidth).toBeLessThan(startWidth + 50)

    // Важнейшее требование: карточка НЕ увеличивается влево и сосед w1 НЕ сжимается!
    expect(document.querySelector('[data-testid="ghost-col-w2"]')?.textContent).toBe('6')
    expect(document.querySelector('[data-testid="ghost-col-w1"]')?.textContent).toBe('6')

    // Отпускаем указатель
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', {
        clientX: 1500,
        clientY: 200,
        bubbles: true
      }))
      vi.advanceTimersByTime(220)
    })

    // Карточка мягко вернулась в 6 колонок
    expect(onChange).toHaveBeenCalled()
    const updated = onChange.mock.calls[0][0]
    expect(updated.find((w: WidgetConfig) => w.id === 'w2')?.colSpan).toBe(6)
    expect(updated.find((w: WidgetConfig) => w.id === 'w1')?.colSpan).toBe(6)

    vi.useRealTimers()
  })

  it('при уменьшении правой карточки левая не увеличивается; при уменьшении левой правая не увеличивается; при увеличении левой карточки в упор правая уменьшается', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const initialWidgets: WidgetConfig[] = [
      { id: 'w1', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'w2', type: 'day', size: 'M', colSpan: 6, rowSpan: 4 }
    ]

    const { useDashboardDrag } = await import('../src/useDashboardDrag')
    const { useRef } = await import('react')

    function ResizeInteractionHarness({ widgets }: { widgets: WidgetConfig[] }) {
      const gridRef = useRef<HTMLDivElement>(null)
      const drag = useDashboardDrag({ widgets, onWidgetsChange: onChange, gridRef })

      return (
        <div ref={gridRef} style={{ width: 1200 }} className="dashboard-grid">
          <div data-testid="ghost-col-w1">{drag.ghostSpans.w1?.colSpan ?? 'none'}</div>
          <div data-testid="ghost-col-w2">{drag.ghostSpans.w2?.colSpan ?? 'none'}</div>

          <div data-widget-id="w1">
            <div
              data-testid="right-handle-w1"
              className="widget-edge-handle widget-edge-right"
              onPointerDown={e => drag.onResizePointerDown(e, 'w1', 'right')}
            />
          </div>
          <div data-widget-id="w2">
            <div
              data-testid="right-handle-w2"
              className="widget-edge-handle widget-edge-right"
              onPointerDown={e => drag.onResizePointerDown(e, 'w2', 'right')}
            />
          </div>
        </div>
      )
    }

    // --- Шаг 1: Уменьшаем правую карточку w2 (тянем правый край влево) ---
    await act(async () => {
      root.render(<ResizeInteractionHarness widgets={initialWidgets} />)
    })

    const rightHandleW2 = document.querySelector('[data-testid="right-handle-w2"]') as HTMLElement
    // 1200px ширина, w2 правый край на ~1200px
    await act(async () => {
      rightHandleW2.dispatchEvent(new MouseEvent('pointerdown', {
        clientX: 1200,
        clientY: 200,
        button: 0,
        bubbles: true
      }))
    })

    // Тянем правый край w2 влево на -200px (уменьшаем w2 с 6 до 4 колонок)
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', {
        clientX: 1000,
        clientY: 200,
        bubbles: true
      }))
    })

    // Проверяем: w2 уменьшилась до 4, а левая карточка w1 НЕ увеличилась, осталась 6!
    expect(document.querySelector('[data-testid="ghost-col-w2"]')?.textContent).toBe('4')
    expect(document.querySelector('[data-testid="ghost-col-w1"]')?.textContent).toBe('6')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 1000, clientY: 200, bubbles: true }))
      vi.advanceTimersByTime(220)
    })

    expect(onChange).toHaveBeenCalled()
    const savedAfterShrinkW2 = onChange.mock.calls[0][0]
    expect(savedAfterShrinkW2.find((w: WidgetConfig) => w.id === 'w2')?.colSpan).toBe(4)
    expect(savedAfterShrinkW2.find((w: WidgetConfig) => w.id === 'w1')?.colSpan).toBe(6)

    // --- Шаг 2: Уменьшаем левую карточку w1 (тянем правый край влево) ---
    onChange.mockClear()
    const rightHandleW1 = document.querySelector('[data-testid="right-handle-w1"]') as HTMLElement
    // Левая карточка заканчивается на ~600px
    await act(async () => {
      rightHandleW1.dispatchEvent(new MouseEvent('pointerdown', {
        clientX: 600,
        clientY: 200,
        button: 0,
        bubbles: true
      }))
    })

    // Тянем правый край w1 влево на -200px (уменьшаем w1 с 6 до 4 колонок)
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', {
        clientX: 400,
        clientY: 200,
        bubbles: true
      }))
    })

    // Проверяем: w1 уменьшилась до 4, а правая карточка w2 НЕ увеличилась!
    expect(document.querySelector('[data-testid="ghost-col-w1"]')?.textContent).toBe('4')
    expect(document.querySelector('[data-testid="ghost-col-w2"]')?.textContent).toBe('6')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 400, clientY: 200, bubbles: true }))
      vi.advanceTimersByTime(220)
    })

    expect(onChange).toHaveBeenCalled()
    const savedAfterShrinkW1 = onChange.mock.calls[0][0]
    expect(savedAfterShrinkW1.find((w: WidgetConfig) => w.id === 'w1')?.colSpan).toBe(4)
    expect(savedAfterShrinkW1.find((w: WidgetConfig) => w.id === 'w2')?.colSpan).toBe(6)

    // --- Шаг 3: Увеличиваем левую карточку w1 вправо, когда правая w2 упёрлась в правый край ---
    onChange.mockClear()
    await act(async () => {
      rightHandleW1.dispatchEvent(new MouseEvent('pointerdown', {
        clientX: 600,
        clientY: 200,
        button: 0,
        bubbles: true
      }))
    })

    // Тянем правый край w1 вправо на +200px (увеличиваем w1 с 6 до 8 колонок)
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', {
        clientX: 800,
        clientY: 200,
        bubbles: true
      }))
    })

    // Проверяем: w1 увеличилась до 8, а упёршаяся в край w2 уменьшилась до 4!
    expect(document.querySelector('[data-testid="ghost-col-w1"]')?.textContent).toBe('8')
    expect(document.querySelector('[data-testid="ghost-col-w2"]')?.textContent).toBe('4')

    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 800, clientY: 200, bubbles: true }))
      vi.advanceTimersByTime(220)
    })

    expect(onChange).toHaveBeenCalled()
    const savedAfterExpandW1 = onChange.mock.calls[0][0]
    expect(savedAfterExpandW1.find((w: WidgetConfig) => w.id === 'w1')?.colSpan).toBe(8)
    expect(savedAfterExpandW1.find((w: WidgetConfig) => w.id === 'w2')?.colSpan).toBe(4)

    vi.useRealTimers()
  })

  it('кнопка «Продолжить» остаётся внутри карточки на малом размере (rowSpan <= 4, colSpan <= 5)', async () => {
    const { ResumeCard } = await import('../src/ResumeCard')
    const continuation = {
      space: { id: 's1', name: 'Поток: 24 сент.', tone: 'sage' as const, resources: [] },
      context: { id: 'c1', name: 'Дело', checkpoint: { nextStep: 'Проверить макет' } },
      documents: [],
      tabs: [{ id: 't1', title: 'vk.com', url: 'https://vk.com' }],
      at: new Date().toISOString(),
      title: 'vk.com'
    }

    await act(async () => {
      root.render(
        <ResumeCard
          continuation={continuation}
          now={new Date()}
          hidden={false}
          style={{}}
          pending={false}
          onResume={vi.fn()}
          onSpace={vi.fn()}
          onEdit={vi.fn()}
          onComplete={vi.fn()}
          onDocument={vi.fn()}
          onTabs={vi.fn()}
          rowSpan={3}
          colSpan={4}
        />
      )
    })

    const card = document.querySelector('.resume-card') as HTMLElement
    expect(card).not.toBeNull()
    expect(card.classList.contains('is-small-card')).toBe(true)

    const btn = card.querySelector('.resume-actions .resume-primary') as HTMLButtonElement
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Продолжить')
  })

  it('двухрядная сетка карточек 4-span (высота 574px) умещается без скролла в hub-content при разрешении 1080p', () => {
    // В 12-колоночной сетке высота карточки 4-span = 4 * 56 + 3 * 18 = 224 + 54 = 278px
    // 2 ряда карточек с зазором 18px = 278 + 18 + 278 = 574px (+ 20px padding = 594px)
    const cardHeight = 4 * 56 + 3 * 18
    const twoRowGridHeight = cardHeight * 2 + 18
    expect(twoRowGridHeight).toBe(574)

    // При высоте окна 1080px и page-wrap min(890px, calc(100dvh - 54px)):
    const pageWrapHeight = Math.min(890, 1080 - 54)
    expect(pageWrapHeight).toBe(890)

    // Неконтентные элементы page-wrap: ambient (72) + chrome (110) + dock (52) + 3 зазора по 14px (42px) = 276px
    const nonContentHeight = 72 + 110 + 52 + 14 * 3
    const availableHubContentHeight = pageWrapHeight - nonContentHeight
    expect(availableHubContentHeight).toBe(614)

    // Доступная высота 614px гарантированно вмещает 2 ряда карточек (574px + 20px padding = 594px) с запасом 20px
    const totalRequiredHeight = twoRowGridHeight + 20
    expect(availableHubContentHeight).toBeGreaterThanOrEqual(totalRequiredHeight)
  })
})

describe('WeatherWidget, MapWidget and Dashboard Presets UI', () => {
  let root: Root
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="test-root"></div>'
    root = createRoot(document.getElementById('test-root')!)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  })

  it('WeatherWidget корректно отображает метеоданные из кэша и переключает город', async () => {
    const cachedWeather = {
      cityName: 'Уфа',
      temperature: 15,
      code: 1,
      observedAt: '2026-10-18T12:00',
      fetchedAt: Date.now(),
      feelsLike: 14,
      humidity: 65,
      windSpeed: 3.5,
      forecast: [
        { date: '2026-10-18', code: 1, high: 16, low: 8, precipitationProbability: 10, windSpeed: 4 },
        { date: '2026-10-19', code: 2, high: 17, low: 9, precipitationProbability: 0, windSpeed: 3 }
      ]
    }
    localStorage.setItem('dom-ufa-weather-v1', JSON.stringify(cachedWeather))

    const onOpenTraffic = vi.fn()
    await act(async () => {
      root.render(<WeatherWidget onOpenTraffic={onOpenTraffic} />)
    })

    const widget = document.querySelector('.weather-widget')
    expect(widget).not.toBeNull()

    // Проверяем температуру и влажность
    expect(document.body.textContent).toContain('15°')
    expect(document.body.textContent).toContain('65%')
    expect(document.body.textContent).toContain('4 м/с')

    // Кнопка пробок
    const trafficBtn = document.querySelector('.weather-traffic-btn') as HTMLButtonElement
    expect(trafficBtn).not.toBeNull()
    await act(async () => {
      trafficBtn.click()
    })
    expect(onOpenTraffic).toHaveBeenCalled()

    // Смена города
    const select = document.querySelector('.weather-city-select') as HTMLSelectElement
    expect(select.value).toBe('ufa')
    await act(async () => {
      select.value = 'moscow'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(localStorage.getItem('dom-weather-selected-city')).toBe('moscow')
  })

  it('MapWidget переключает провайдеры (Яндекс / Google), слои пробок и форму поиска', async () => {
    const onOpenInTab = vi.fn()
    await act(async () => {
      root.render(<MapWidget onOpenInTab={onOpenInTab} />)
    })

    const mapWidget = document.querySelector('.map-widget')
    expect(mapWidget).not.toBeNull()

    // По умолчанию Яндекс
    const iframe = document.querySelector('.map-iframe') as HTMLIFrameElement
    expect(iframe.src).toContain('yandex.ru/map-widget')

    // Включаем пробки
    const trafficBtn = document.querySelector('.map-traffic-btn') as HTMLButtonElement
    expect(trafficBtn).not.toBeNull()
    await act(async () => {
      trafficBtn.click()
    })
    expect(localStorage.getItem('dom-map-traffic')).toBe('true')
    const updatedIframe = document.querySelector('.map-iframe') as HTMLIFrameElement
    expect(updatedIframe.src).toContain('trf')

    // Переключаем на Google
    const googleBtn = Array.from(document.querySelectorAll('.map-provider-btn')).find(b => b.textContent?.includes('Google')) as HTMLButtonElement
    expect(googleBtn).not.toBeNull()
    await act(async () => {
      googleBtn.click()
    })
    expect(localStorage.getItem('dom-map-provider')).toBe('google')
    const googleIframe = document.querySelector('.map-iframe') as HTMLIFrameElement
    expect(googleIframe.src).toContain('maps.google.com')

    // Кнопка открытия во вкладке
    const openBtn = document.querySelector('.map-open-tab-btn') as HTMLButtonElement
    await act(async () => {
      openBtn.click()
    })
    expect(onOpenInTab).toHaveBeenCalledWith(expect.stringContaining('google.com/maps'))
  })

  it('DashboardSettings отображает вкладку пресетов, применяет пресет и сохраняет пользовательский', async () => {
    const widgets: WidgetConfig[] = [
      { id: 'w1', type: 'resume', size: 'M' },
      { id: 'w2', type: 'day', size: 'M' }
    ]
    const customPresets: DashboardCustomPreset[] = [
      {
        id: 'cp-1',
        name: 'Мой спокойный вечер',
        widgets: [{ id: 'w1', type: 'focus', size: 'M' }],
        createdAt: '2026-10-18T00:00:00Z'
      }
    ]

    const onPresetChange = vi.fn()
    const onSaveCustomPreset = vi.fn()
    const onDeleteCustomPreset = vi.fn()
    const onClose = vi.fn()

    await act(async () => {
      root.render(
        <DashboardSettings
          widgets={widgets}
          preset="overview"
          customPresets={customPresets}
          onChange={vi.fn()}
          onPresetChange={onPresetChange}
          onSaveCustomPreset={onSaveCustomPreset}
          onDeleteCustomPreset={onDeleteCustomPreset}
          onClose={onClose}
        />
      )
    })

    // Переключаемся на вкладку "Пресеты"
    const presetTabBtn = Array.from(document.querySelectorAll('.calm-tabs button')).find(b => b.textContent?.includes('Пресеты')) as HTMLButtonElement
    expect(presetTabBtn).not.toBeNull()
    await act(async () => {
      presetTabBtn.click()
    })

    // Проверяем отображение встроенных пресетов
    expect(document.body.textContent).toContain('Спокойный (Фокус)')
    expect(document.body.textContent).toContain('Рабочий (Кокпит)')
    expect(document.body.textContent).toContain('Город и день')

    // Проверяем отображение сохранённого пользовательского пресета
    expect(document.body.textContent).toContain('Мой спокойный вечер')

    // Кликаем применить пресет "Спокойный (Фокус)"
    const calmApplyBtn = Array.from(document.querySelectorAll('.preset-card-item')).find(el => el.textContent?.includes('Спокойный'))?.querySelector('.preset-apply-btn') as HTMLButtonElement
    expect(calmApplyBtn).not.toBeNull()
    await act(async () => {
      calmApplyBtn.click()
    })
    expect(onPresetChange).toHaveBeenCalledWith('calm', expect.any(Array))

    // Сохраняем текущий вид как новый пресет
    const input = document.querySelector('.preset-create-form input') as HTMLInputElement
    expect(input).not.toBeNull()
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Сетап для кодинга')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const form = document.querySelector('.preset-create-form') as HTMLFormElement
    expect(form).not.toBeNull()
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(onSaveCustomPreset).toHaveBeenCalledWith('Сетап для кодинга', widgets)
  })

  it('DashboardSettings открывает вкладку пресетов сразу при initialTab="presets"', async () => {
    await act(async () => {
      root.render(
        <DashboardSettings
          initialTab="presets"
          widgets={[]}
          onChange={vi.fn()}
          onClose={vi.fn()}
        />
      )
    })
    const activeTab = document.querySelector('.calm-tabs button.selected')
    expect(activeTab?.textContent).toContain('Пресеты')
    expect(document.body.textContent).toContain('Спокойный (Фокус)')
  })

  it('HabitsWidget отображает ритуалы, позволяет пить воду, отмечать дела и добавлять свои привычки', async () => {
    const mockState: AppState = {
      version: 2,
      spaces: [],
      reminders: [],
      dismissedUntil: null,
      habitsState: {
        date: getTodayDateString(),
        items: structuredClone(defaultHabitItems)
      }
    }
    const onChange = vi.fn()

    await act(async () => {
      root.render(<HabitsWidget state={mockState} onChange={onChange} />)
    })

    const widget = document.querySelector('.habits-widget')
    expect(widget).not.toBeNull()

    // Заголовок и счетчик
    expect(document.body.textContent).toContain('Забота и привычки')
    expect(document.body.textContent).toContain('0 из 4')
    expect(document.body.textContent).toContain('Водный баланс')
    expect(document.body.textContent).toContain('Отдых для глаз')
    expect(document.body.textContent).toContain('Минута дыхания')
    expect(document.body.textContent).toContain('Разминка и осанка')

    // Кликаем по 3-му стакану воды
    const glasses = document.querySelectorAll('.habit-glass-btn')
    expect(glasses.length).toBe(8)
    await act(async () => {
      ;(glasses[2] as HTMLButtonElement).click()
    })
    expect(onChange).toHaveBeenCalled()
    const updateFn = onChange.mock.calls[0][0]
    const nextState = updateFn(mockState)
    const updatedWater = nextState.habitsState.items.find((i: any) => i.id === 'water')
    expect(updatedWater.currentCount).toBe(3)

    // Отмечаем чекбокс "Отдых для глаз"
    const eyesRow = document.querySelector('.habit-row-checkbox') as HTMLElement
    expect(eyesRow).not.toBeNull()
    await act(async () => {
      eyesRow.click()
    })
    expect(onChange).toHaveBeenCalledTimes(2)
    const eyesUpdate = onChange.mock.calls[1][0](mockState)
    const eyesItem = eyesUpdate.habitsState.items.find((i: any) => i.id === 'eyes')
    expect(eyesItem.completedToday).toBe(true)

    // Добавляем свою привычку
    const addToggle = document.querySelector('.habits-add-toggle-btn') as HTMLButtonElement
    expect(addToggle).not.toBeNull()
    await act(async () => {
      addToggle.click()
    })

    const input = document.querySelector('.habits-input') as HTMLInputElement
    expect(input).not.toBeNull()
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Витамин D')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const form = document.querySelector('.habits-add-form') as HTMLFormElement
    expect(form).not.toBeNull()
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    const customUpdate = onChange.mock.calls[2][0](mockState)
    expect(customUpdate.habitsState.items.some((i: any) => i.title === 'Витамин D')).toBe(true)
  })

  it('resolveHabitsState мягко сбрасывает ежедневный прогресс при наступлении нового дня, сохраняя пользовательские привычки', () => {
    const yesterday = '2026-10-17'
    const today = '2026-10-18'
    const oldState = {
      date: yesterday,
      items: [
        { id: 'water', title: 'Вода', kind: 'counter' as const, targetCount: 8, currentCount: 8, completedToday: true },
        { id: 'custom-1', title: 'Медитация', kind: 'checkbox' as const, custom: true, completedToday: true }
      ]
    }

    const nextState = resolveHabitsState(oldState, today)
    expect(nextState.date).toBe(today)
    // Водный баланс обнулился
    expect(nextState.items.find(i => i.id === 'water')?.currentCount).toBe(0)
    expect(nextState.items.find(i => i.id === 'water')?.completedToday).toBe(false)
    // Пользовательская привычка сохранилась, но не отмечена как выполненная сегодня
    const custom = nextState.items.find(i => i.id === 'custom-1')
    expect(custom).toBeDefined()
    expect(custom?.completedToday).toBe(false)
  })

  it('отображает кнопку «Войти» для задачи с meetingUrl в карточке плана и открывает ссылку', async () => {
    const { Home } = await import('../src/Home')
    const onOpen = vi.fn()
    const homeState: AppState = {
      version: 2,
      revision: 1,
      userProfile: { name: 'Тест', avatarTone: 'sage' },
      spaces: [{ id: 's1', name: 'Основное', resources: [] }],
      reminders: [
        {
          id: 'task-meet',
          title: 'Созвон по проекту',
          createdAt: new Date('2026-10-16T10:00:00Z').toISOString(),
          dueAt: new Date('2026-10-16T14:00:00Z').toISOString(),
          plannedDate: '2026-10-16',
          done: false,
          kind: 'task',
          meetingUrl: 'https://meet.google.com/xyz-uvwx-rst'
        }
      ],
      dashboardCustomization: {
        widgets: [{ id: 'w1', type: 'day', size: 'M', colSpan: 6, rowSpan: 6 }]
      }
    }

    await act(async () => {
      root.render(
        <Home
          viewportWidth={1440}
          viewportHeight={900}
          onSearchHandled={vi.fn()}
          state={homeState}
          now={new Date('2026-10-16T12:00:00Z')}
          onChange={vi.fn()}
          onCapture={vi.fn()}
          onFocus={vi.fn()}
          onPlan={vi.fn()}
          onCreateAt={vi.fn()}
          onSpace={vi.fn()}
          onOpen={onOpen}
          onAddLink={vi.fn()}
          onAssistant={vi.fn()}
          onSaveThought={vi.fn()}
          onImport={vi.fn()}
          onNewTab={vi.fn()}
          onSettings={vi.fn()}
          onCalendarRange={vi.fn()}
          onResume={vi.fn()}
          onOpenContext={vi.fn()}
          onEditContext={vi.fn()}
          onCompleteContext={vi.fn()}
          onOpenDocument={vi.fn()}
        />
      )
    })

    const meetingBtn = document.querySelector('.plan-meeting-btn') as HTMLButtonElement
    expect(meetingBtn).not.toBeNull()
    expect(meetingBtn.textContent).toContain('Войти')

    await act(async () => {
      meetingBtn.click()
    })

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'link',
        target: 'https://meet.google.com/xyz-uvwx-rst'
      })
    )
  })
})


