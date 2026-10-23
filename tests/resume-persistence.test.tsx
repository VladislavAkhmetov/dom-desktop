// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from '../src/Home'
import type { AppState, Space, WidgetConfig } from '../src/types'
import { activeOrRecentContinuation } from '../src/workContexts'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

describe('Карточка «Продолжить» на дашборде', () => {
  let root: Root
  let container: HTMLDivElement

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
  })

  it('activeOrRecentContinuation возвращает продолжение для нового пространства без вкладок и документов', () => {
    const emptySpace: Space = {
      id: 'space-1',
      name: 'Новое пространство',
      tone: 'sage',
      kind: 'base',
      resources: [],
      workContexts: [
        { id: 'ctx-1', title: 'Новое пространство', documentIds: [] }
      ]
    }
    const state: AppState = {
      version: 2,
      reminders: [],
      activeSpaceId: 'space-1',
      spaces: [emptySpace]
    }

    const continuation = activeOrRecentContinuation(state)
    expect(continuation).toBeDefined()
    expect(continuation?.space.id).toBe('space-1')
    expect(continuation?.space.name).toBe('Новое пространство')
    expect(continuation?.tabs).toEqual([])
    expect(continuation?.documents).toEqual([])
  })

  it('отображает карточку «Продолжить» для нового пространства со статусом готовности', async () => {
    const emptySpace: Space = {
      id: 'space-1',
      name: 'Новое пространство',
      tone: 'sage',
      kind: 'base',
      resources: [],
      workContexts: [
        { id: 'ctx-1', title: 'Новое пространство', documentIds: [] }
      ]
    }
    const state: AppState = {
      version: 2,
      reminders: [],
      activeSpaceId: 'space-1',
      spaces: [emptySpace],
      dashboard: {
        preset: 'custom',
        widgets: [
          { id: 'resume', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
          { id: 'news', type: 'news', size: 'M', colSpan: 6, rowSpan: 4 }
        ]
      }
    }

    await act(async () => {
      root.render(
        <Home
          viewportWidth={1200}
          viewportHeight={800}
          onSearchHandled={() => {}}
          state={state}
          now={new Date()}
          onChange={() => {}}
          onCapture={() => {}}
          onFocus={() => {}}
          onPlan={() => {}}
          onCreateAt={() => {}}
          onSpace={() => {}}
          onOpen={() => {}}
          onAddLink={() => {}}
          onAssistant={() => {}}
          onSaveThought={() => {}}
          onResume={() => {}}
          onOpenContext={() => {}}
          onEditContext={() => {}}
          onCompleteContext={() => {}}
          onOpenDocument={() => {}}
          onImport={() => {}}
          onNewTab={() => {}}
          onSettings={() => {}}
          onCalendarRange={() => {}}
        />
      )
    })

    const resumeCard = document.querySelector('.resume-card')
    expect(resumeCard).not.toBeNull()
    expect(resumeCard?.textContent).toContain('Новое пространство')
    expect(resumeCard?.textContent).toContain('Пространство готово к работе')
    expect(resumeCard?.textContent).toContain('Продолжить')
  })

  it('сохраняет карточку «Продолжить» даже если удалены все пространства (пустое состояние с кнопкой создания)', async () => {
    const state: AppState = {
      version: 2,
      reminders: [],
      spaces: [], // все пространства удалены
      dashboard: {
        preset: 'custom',
        widgets: [
          { id: 'resume', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
          { id: 'news', type: 'news', size: 'M', colSpan: 6, rowSpan: 4 }
        ]
      }
    }

    const onNewSpace = vi.fn()

    await act(async () => {
      root.render(
        <Home
          viewportWidth={1200}
          viewportHeight={800}
          onSearchHandled={() => {}}
          state={state}
          now={new Date()}
          onChange={() => {}}
          onCapture={() => {}}
          onFocus={() => {}}
          onPlan={() => {}}
          onCreateAt={() => {}}
          onSpace={() => {}}
          onOpen={() => {}}
          onAddLink={() => {}}
          onAssistant={() => {}}
          onSaveThought={() => {}}
          onResume={() => {}}
          onOpenContext={() => {}}
          onEditContext={() => {}}
          onCompleteContext={() => {}}
          onOpenDocument={() => {}}
          onImport={() => {}}
          onNewTab={() => {}}
          onSettings={() => {}}
          onCalendarRange={() => {}}
          onNewSpace={onNewSpace}
        />
      )
    })

    const resumeCard = document.querySelector('.resume-card')
    expect(resumeCard).not.toBeNull()
    expect(resumeCard?.classList.contains('resume-card-empty')).toBe(true)
    expect(resumeCard?.textContent).toContain('Нет открытых пространств')
    expect(resumeCard?.textContent).toContain('Создать пространство')

    const createBtn = resumeCard?.querySelector('.resume-primary') as HTMLButtonElement
    expect(createBtn).not.toBeNull()
    await act(async () => {
      createBtn.click()
    })
    expect(onNewSpace).toHaveBeenCalled()
  })

  it('автоматически обеспечивает наличие карточки «Продолжить» над новостями при наличии таба пространства', async () => {
    const space: Space = {
      id: 'space-1',
      name: 'Рабочий проект',
      tone: 'sage',
      kind: 'base',
      resources: [],
      workContexts: [{ id: 'ctx-1', title: 'Проект', documentIds: [] }]
    }
    // В виджетах нет resume, только news
    const state: AppState = {
      version: 2,
      reminders: [],
      spaces: [space],
      dashboard: {
        preset: 'custom',
        widgets: [
          { id: 'news', type: 'news', size: 'M', colSpan: 6, rowSpan: 4 },
          { id: 'day', type: 'day', size: 'M', colSpan: 6, rowSpan: 4 }
        ]
      }
    }

    await act(async () => {
      root.render(
        <Home
          viewportWidth={1200}
          viewportHeight={800}
          onSearchHandled={() => {}}
          state={state}
          now={new Date()}
          onChange={() => {}}
          onCapture={() => {}}
          onFocus={() => {}}
          onPlan={() => {}}
          onCreateAt={() => {}}
          onSpace={() => {}}
          onOpen={() => {}}
          onAddLink={() => {}}
          onAssistant={() => {}}
          onSaveThought={() => {}}
          onResume={() => {}}
          onOpenContext={() => {}}
          onEditContext={() => {}}
          onCompleteContext={() => {}}
          onOpenDocument={() => {}}
          onImport={() => {}}
          onNewTab={() => {}}
          onSettings={() => {}}
          onCalendarRange={() => {}}
        />
      )
    })

    // Карточка Продолжить добавлена и отображается первой над новостями
    const cards = document.querySelectorAll('.dashboard-grid > [data-widget]')
    expect(cards[0].getAttribute('data-widget')).toBe('resume')
    expect(cards[1].getAttribute('data-widget')).toBe('news')
  })

  it('удаляется только тогда, когда пользователь сам удаляет карточку в режиме редактирования', async () => {
    let appState: AppState = {
      version: 2,
      reminders: [],
      spaces: [],
      dashboard: {
        preset: 'custom',
        widgets: [
          { id: 'resume', type: 'resume', size: 'M', colSpan: 6, rowSpan: 4 },
          { id: 'day', type: 'day', size: 'M', colSpan: 6, rowSpan: 4 }
        ]
      }
    }

    const onChange = vi.fn((update: (prev: AppState) => AppState) => {
      appState = update(appState)
    })

    const { rerender } = await act(async () => {
      root.render(
        <Home
          viewportWidth={1200}
          viewportHeight={800}
          onSearchHandled={() => {}}
          state={appState}
          now={new Date()}
          onChange={onChange}
          onCapture={() => {}}
          onFocus={() => {}}
          onPlan={() => {}}
          onCreateAt={() => {}}
          onSpace={() => {}}
          onOpen={() => {}}
          onAddLink={() => {}}
          onAssistant={() => {}}
          onSaveThought={() => {}}
          onResume={() => {}}
          onOpenContext={() => {}}
          onEditContext={() => {}}
          onCompleteContext={() => {}}
          onOpenDocument={() => {}}
          onImport={() => {}}
          onNewTab={() => {}}
          onSettings={() => {}}
          onCalendarRange={() => {}}
        />
      )
      return { rerender: root.render.bind(root) }
    })

    // Включаем режим редактирования дашборда
    const editToggle = document.querySelector('.dashboard-edit-toggle') as HTMLButtonElement
    expect(editToggle).not.toBeNull()
    await act(async () => {
      editToggle.click()
    })

    // Находим кнопку удаления карточки «Продолжить»
    const resumeCard = document.querySelector('[data-widget="resume"]') as HTMLElement
    const removeBtn = resumeCard?.querySelector('.widget-remove-btn') as HTMLButtonElement
    expect(removeBtn).not.toBeNull()

    await act(async () => {
      removeBtn.click()
    })

    expect(onChange).toHaveBeenCalled()
    expect(appState.dashboard?.widgets.some(w => w.type === 'resume')).toBe(false)
    expect(appState.dashboard?.resumeDismissed).toBe(true)
  })
})
