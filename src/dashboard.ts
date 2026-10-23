import type { DashboardCustomPreset, WidgetConfig, WidgetType } from './types'

export interface DashboardPresetDef {
  id: string
  name: string
  description: string
  icon?: string
  widgets: WidgetConfig[]
}

export const builtinDashboardPresets: DashboardPresetDef[] = [
  {
    id: 'overview',
    name: 'Обзор (Стандартный)',
    description: 'Сбалансированный вид: продолжение работы, дела на день и материалы на потом.',
    widgets: [
      { id: 'resume', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'day', type: 'day', size: 'M', colSpan: 6, rowSpan: 5 },
      { id: 'reading', type: 'reading', size: 'M', colSpan: 6, rowSpan: 4 }
    ]
  },
  {
    id: 'calm',
    name: 'Спокойный (Фокус)',
    description: 'Без новостей и почты. Только текущие дела, глубокий фокус и заметки.',
    widgets: [
      { id: 'resume', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'focus', type: 'focus', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'day', type: 'day', size: 'M', colSpan: 6, rowSpan: 5 },
      { id: 'notes', type: 'notes', size: 'M', colSpan: 6, rowSpan: 5 }
    ]
  },
  {
    id: 'work',
    name: 'Рабочий (Кокпит)',
    description: 'Для продуктивного дня: дела, почта, пространства проектов, дайджест и погода.',
    widgets: [
      { id: 'resume', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'day', type: 'day', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'mail', type: 'mail', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'news', type: 'news', size: 'M', detail: 'titles', colSpan: 6, rowSpan: 4 },
      { id: 'spaces', type: 'spaces', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'weather', type: 'weather', size: 'M', colSpan: 6, rowSpan: 4 }
    ]
  },
  {
    id: 'city',
    name: 'Город и день',
    description: 'Погода, дорожная ситуация, дела и статьи на потом.',
    widgets: [
      { id: 'weather', type: 'weather', size: 'M', colSpan: 6, rowSpan: 5 },
      { id: 'map', type: 'map', size: 'M', colSpan: 6, rowSpan: 5 },
      { id: 'day', type: 'day', size: 'M', colSpan: 6, rowSpan: 4 },
      { id: 'reading', type: 'reading', size: 'M', colSpan: 6, rowSpan: 4 }
    ]
  },
  {
    id: 'balance',
    name: 'Баланс и ритуалы',
    description: 'Забота о себе: водный баланс, дыхание, разминка, фокус и задачи дня.',
    widgets: [
      { id: 'habits', type: 'habits', size: 'M', colSpan: 6, rowSpan: 5 },
      { id: 'focus', type: 'focus', size: 'M', colSpan: 6, rowSpan: 5 },
      { id: 'day', type: 'day', size: 'M', colSpan: 6, rowSpan: 5 },
      { id: 'notes', type: 'notes', size: 'M', colSpan: 6, rowSpan: 5 }
    ]
  }
]

export const defaultWidgets: WidgetConfig[] = builtinDashboardPresets.find(p => p.id === 'overview')?.widgets || [
  { id: 'resume', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
  { id: 'day', type: 'day', size: 'M', colSpan: 6, rowSpan: 5 },
  { id: 'reading', type: 'reading', size: 'M', colSpan: 6, rowSpan: 4 }
]

export function getPresetWidgets(
  presetId: string,
  customPresets?: DashboardCustomPreset[]
): WidgetConfig[] | null {
  const builtin = builtinDashboardPresets.find(p => p.id === presetId)
  if (builtin) return structuredClone(builtin.widgets)
  const custom = customPresets?.find(p => p.id === presetId)
  if (custom) return structuredClone(custom.widgets)
  return null
}

export function dashboardWidgets(widgets?: WidgetConfig[], gridVersion?: number): WidgetConfig[] {
  if (!widgets) return defaultWidgets
  if (widgets.length === 0) return []

  // Миграция устаревших дефолтных раскладок на новое строгое ядро из 3 карточек:
  // 1. Старый дефолт с быстрой записью: ['resume', 'day', 'capture']
  // 2. Старый дефолт с новостями: ['resume', 'day', 'news']
  // 3. Старый 6-карточный кокпит: ['resume', 'day', 'mail', 'news', 'spaces', 'weather']
  const oldCapture = widgets.length === 3 && widgets.every((widget, index) => widget.type === ['resume', 'day', 'capture'][index])
  const oldNews = widgets.length === 3 && widgets.every((widget, index) => widget.type === ['resume', 'day', 'news'][index])
  const oldWork = widgets.length === 6 && widgets.every((widget, index) => widget.type === ['resume', 'day', 'mail', 'news', 'spaces', 'weather'][index])
  if (oldCapture || oldNews || oldWork) return defaultWidgets

  if (gridVersion && gridVersion >= 2) return widgets

  // Migrate old 6-column / 4-row layout to 12-column / 8-row layout:
  // If any widgets have spans from the 6-col system (colSpan <= 6 and rowSpan <= 4), scale them by 2
  const needsMigration = widgets.some(w => w.colSpan !== undefined && w.colSpan <= 6 && (w.rowSpan === undefined || w.rowSpan <= 4))
  if (!needsMigration) return widgets

  return widgets.map(w => {
    if (w.colSpan !== undefined && w.colSpan <= 6 && (w.rowSpan === undefined || w.rowSpan <= 4)) {
      return {
        ...w,
        colSpan: Math.min(12, w.colSpan * 2),
        rowSpan: w.rowSpan ? Math.min(8, w.rowSpan * 2) : undefined
      }
    }
    return w
  })
}

export const widgetNames: Record<WidgetType, string> = {
  resume: 'Продолжить',
  day: 'Дела и календарь',
  capture: 'Быстрая запись',
  spaces: 'Пространства',
  mail: 'Почта',
  news: 'Дайджест',
  focus: 'Фокус',
  reading: 'Чтение на потом',
  notes: 'Заметки',
  weather: 'Подробная погода',
  map: 'Карты и пробки',
  habits: 'Забота и привычки'
}

/**
 * Виджеты, скрытые из активного выбора (припаркованы до следующих версий)
 * ради снижения когнитивной нагрузки и устранения рисков (Calm Tech).
 */
export const parkedWidgetTypes: readonly WidgetType[] = [
  'mail',
  'map',
  'habits',
  'weather'
] as const

/**
 * Виджеты, доступные пользователю в меню добавления на дашборд.
 * Включает обязательное ядро (Продолжить, Дела, Чтение), рабочие карточки (Запись, Пространства, Заметки, Фокус)
 * и опциональный Дайджест новостей.
 */
export const availableWidgetTypes: readonly WidgetType[] = [
  'resume',
  'day',
  'reading',
  'news',
  'capture',
  'spaces',
  'notes',
  'focus'
] as const

export const widgetConstraints: Record<WidgetType, { minCol: number; maxCol: number; minRow: number; maxRow: number }> = {
  resume: { minCol: 2, maxCol: 12, minRow: 1, maxRow: 8 },
  day: { minCol: 3, maxCol: 12, minRow: 2, maxRow: 8 },
  capture: { minCol: 2, maxCol: 12, minRow: 1, maxRow: 6 },
  spaces: { minCol: 2, maxCol: 12, minRow: 1, maxRow: 6 },
  mail: { minCol: 2, maxCol: 12, minRow: 2, maxRow: 8 },
  news: { minCol: 2, maxCol: 12, minRow: 2, maxRow: 8 },
  focus: { minCol: 2, maxCol: 12, minRow: 1, maxRow: 6 },
  reading: { minCol: 2, maxCol: 12, minRow: 2, maxRow: 8 },
  notes: { minCol: 2, maxCol: 12, minRow: 2, maxRow: 8 },
  weather: { minCol: 3, maxCol: 12, minRow: 3, maxRow: 8 },
  map: { minCol: 3, maxCol: 12, minRow: 3, maxRow: 8 },
  habits: { minCol: 3, maxCol: 12, minRow: 3, maxRow: 8 }
}

export function widgetDefaultSpan(type: WidgetType, size?: 'S' | 'M' | 'L'): { colSpan: number; rowSpan: number } {
  if (size === 'S') return { colSpan: 4, rowSpan: 4 }
  if (size === 'L') return { colSpan: 12, rowSpan: 4 }
  if (type === 'day') return { colSpan: 6, rowSpan: 6 }
  if (type === 'capture') return { colSpan: 6, rowSpan: 2 }
  if (type === 'notes') return { colSpan: 6, rowSpan: 4 }
  if (type === 'reading') return { colSpan: 6, rowSpan: 4 }
  if (type === 'weather') return { colSpan: 6, rowSpan: 5 }
  if (type === 'map') return { colSpan: 6, rowSpan: 5 }
  if (type === 'habits') return { colSpan: 6, rowSpan: 5 }
  return { colSpan: 6, rowSpan: 4 }
}

export function widgetSpan(widget: WidgetConfig): { colSpan: number; rowSpan: number } {
  const defaults = widgetDefaultSpan(widget.type, widget.size)
  const colSpan = widget.colSpan ?? defaults.colSpan
  const rowSpan = widget.rowSpan ?? defaults.rowSpan
  const bounds = widgetConstraints[widget.type] || { minCol: 2, maxCol: 12, minRow: 1, maxRow: 8 }
  return {
    colSpan: Math.max(bounds.minCol, Math.min(bounds.maxCol, colSpan)),
    rowSpan: Math.max(bounds.minRow, Math.min(bounds.maxRow, rowSpan))
  }
}

export interface WidgetPosition {
  colStart: number
  colSpan: number
  rowSpan: number
}

/**
 * Computes deterministic column start positions and spans for widgets
 * in a 12-column grid, grouping them into predictable rows and preventing
 * cards from unpredictably jumping across columns when heights change.
 */
export function computeWidgetPositions(
  widgets: WidgetConfig[],
  spansOverride?: Record<string, { colSpan: number; rowSpan: number }>
): Record<string, WidgetPosition> {
  const result: Record<string, WidgetPosition> = {}
  let currentCol = 1

  for (const w of widgets) {
    const span = spansOverride?.[w.id] || widgetSpan(w)
    const colSpan = Math.min(12, Math.max(1, span.colSpan))

    // If widget doesn't fit in remaining columns of the current 12-column row, wrap to column 1
    if (currentCol > 1 && currentCol + colSpan - 1 > 12) {
      currentCol = 1
    }

    result[w.id] = {
      colStart: currentCol,
      colSpan,
      rowSpan: span.rowSpan
    }

    currentCol += colSpan
    if (currentCol > 12) {
      currentCol = 1
    }
  }

  return result
}

/**
 * Groups widgets into rows where sum of colSpan does not exceed 12 columns.
 */
export function groupWidgetsIntoRows(widgets: WidgetConfig[]): WidgetConfig[][] {
  const rows: WidgetConfig[][] = []
  let currentRow: WidgetConfig[] = []
  let currentCols = 0

  for (const w of widgets) {
    const span = widgetSpan(w).colSpan
    if (currentCols + span > 12) {
      if (currentRow.length > 0) rows.push(currentRow)
      currentRow = [w]
      currentCols = span
    } else {
      currentRow.push(w)
      currentCols += span
      if (currentCols >= 12) {
        rows.push(currentRow)
        currentRow = []
        currentCols = 0
      }
    }
  }
  if (currentRow.length > 0) rows.push(currentRow)
  return rows
}

/**
 * Calculates adaptive column spans for widgets in a row:
 * 1. When shrinking a card (left or right): neighbors DO NOT expand and do not fill screen.
 * 2. When expanding a card to the right: if right neighbor has already hit the right wall
 *    (or row fills 12 cols), the right neighbor shrinks down to its minCol. Left neighbors never change.
 * 3. When expanding a card to the left (via left handle): left neighbor shrinks down to minCol.
 */
export function adaptRowSpans(
  widgets: WidgetConfig[],
  resizingId: string,
  targetColSpan: number,
  edge?: 'right' | 'bottom' | 'corner' | 'left'
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const w of widgets) {
    result[w.id] = widgetSpan(w).colSpan
  }

  const currentSpan = result[resizingId]
  if (currentSpan === undefined) return result

  const resizingWidget = widgets.find(w => w.id === resizingId)
  const bounds = widgetConstraints[resizingWidget?.type || 'resume'] || { minCol: 2, maxCol: 12, minRow: 1, maxRow: 8 }
  const clampedTarget = Math.max(bounds.minCol, Math.min(bounds.maxCol, targetColSpan))
  const delta = clampedTarget - currentSpan

  if (delta === 0) return result

  // 1. Shrinking: No neighbor expands when a card shrinks. All neighbors preserve their current colSpan.
  if (delta < 0) {
    result[resizingId] = clampedTarget
    return result
  }

  // 2. Expanding:
  const rows = groupWidgetsIntoRows(widgets)
  const row = rows.find(r => r.some(w => w.id === resizingId))
  if (!row || row.length <= 1) {
    result[resizingId] = clampedTarget
    return result
  }

  const idx = row.findIndex(w => w.id === resizingId)
  const rowTotalCols = row.reduce((sum, item) => sum + widgetSpan(item).colSpan, 0)
  const emptyCols = Math.max(0, 12 - rowTotalCols)

  if (edge === 'left') {
    // Expanding to the left into left neighbor(s)
    if (idx <= 0) {
      result[resizingId] = currentSpan
      return result
    }
    let remainingExcess = delta
    const leftNeighbors = row.slice(0, idx)
    for (let i = leftNeighbors.length - 1; i >= 0 && remainingExcess > 0; i--) {
      const neighbor = leftNeighbors[i]
      const nBounds = widgetConstraints[neighbor.type] || { minCol: 2, maxCol: 12, minRow: 1, maxRow: 8 }
      const nSpan = result[neighbor.id]
      const canShrink = Math.max(0, nSpan - nBounds.minCol)
      const shrinkBy = Math.min(canShrink, remainingExcess)
      result[neighbor.id] = nSpan - shrinkBy
      remainingExcess -= shrinkBy
    }
    result[resizingId] = clampedTarget - remainingExcess
    return result
  }

  // Expanding to the right (edge === 'right' || edge === 'corner' || undefined)
  if (idx >= row.length - 1) {
    // Rightmost card in row: can only expand into empty row space to the right, cannot push left neighbors
    result[resizingId] = Math.min(clampedTarget, currentSpan + emptyCols)
    return result
  }

  // Has neighbor(s) to the right. First consume empty row space.
  const excess = delta - emptyCols
  if (excess <= 0) {
    // Fits into empty columns without needing to shrink right neighbor(s)
    result[resizingId] = clampedTarget
    return result
  }

  // Row has hit the right edge: shrink right neighbor(s) starting from rightmost inward
  let remainingExcess = excess
  const rightNeighbors = row.slice(idx + 1)
  for (let i = rightNeighbors.length - 1; i >= 0 && remainingExcess > 0; i--) {
    const neighbor = rightNeighbors[i]
    const nBounds = widgetConstraints[neighbor.type] || { minCol: 2, maxCol: 12, minRow: 1, maxRow: 8 }
    const nSpan = result[neighbor.id]
    const canShrink = Math.max(0, nSpan - nBounds.minCol)
    const shrinkBy = Math.min(canShrink, remainingExcess)
    result[neighbor.id] = nSpan - shrinkBy
    remainingExcess -= shrinkBy
  }

  result[resizingId] = clampedTarget - remainingExcess
  return result
}

