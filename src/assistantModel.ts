export type AssistantRole = 'chat' | 'helper' | 'agent'

export interface AssistantPreferences {
  role: AssistantRole
  provider: string
  model: string
  endpoint: string
  day: boolean
  page: boolean
  materials: boolean
}

export const defaultAssistantPreferences: AssistantPreferences = {
  role: 'chat', provider: 'OpenAI', model: '', endpoint: '', day: false, page: false, materials: false
}

export const assistantRoles = {
  chat: { label: 'Чат', title: 'Обсудить и разобраться', description: 'Отвечает на ваши сообщения. Контекст можно добавить к конкретному запросу.' },
  helper: { label: 'Разобрать материалы', title: 'Помочь с текущим делом', description: 'Использует выбранный контекст дашборда и браузера. Предлагает шаги; вы решаете, что применить.' },
  agent: { label: 'Предложить действия', title: 'Поручить результат', description: 'Выполняет согласованные задачи в дашборде и браузере. Показывает ход работы и результат.' }
} satisfies Record<AssistantRole, { label: string; title: string; description: string }>

/**
 * Временный переключатель видимости точек входа в ИИ (в верхнем и нижнем барах).
 * Функционал ИИ пока не подключён, поэтому кнопки временно скрыты до реализации рабочей модели.
 */
export const isAssistantEnabled = false

