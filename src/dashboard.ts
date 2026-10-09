import type { WidgetConfig, WidgetType } from './types'
export const defaultWidgets: WidgetConfig[] = [{ id: 'resume', type: 'resume', size: 'M' }, { id: 'day', type: 'day', size: 'M' }, { id: 'news', type: 'news', size: 'M', detail: 'titles' }]

export function dashboardWidgets(widgets?: WidgetConfig[]): WidgetConfig[] {
  if (!widgets) return defaultWidgets
  const oldDefault = widgets.length === 3 && widgets.every((widget, index) => widget.type === ['resume', 'day', 'capture'][index] && widget.size === ['M', 'M', 'L'][index])
  return oldDefault ? defaultWidgets : widgets
}
export const widgetNames: Record<WidgetType, string> = { resume: 'Продолжить', day: 'Дела и календарь', capture: 'Быстрая запись', spaces: 'Пространства', mail: 'Почта', news: 'Дайджест', focus: 'Фокус' }
