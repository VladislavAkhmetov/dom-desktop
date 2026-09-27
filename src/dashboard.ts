import type { WidgetConfig, WidgetType } from './types'
export const defaultWidgets: WidgetConfig[] = [{ id: 'resume', type: 'resume', size: 'M' }, { id: 'day', type: 'day', size: 'M' }, { id: 'capture', type: 'capture', size: 'L' }]
export const widgetNames: Record<WidgetType, string> = { resume: 'Продолжение', day: 'Дела и календарь', capture: 'Быстрая запись', spaces: 'Пространства', mail: 'Почта', news: 'Дайджест', focus: 'Фокус' }
