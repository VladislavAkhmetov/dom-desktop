// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpacesOverview } from '../src/SpacesOverview'
import type { Space } from '../src/types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function sampleSpaces(): Space[] {
  return [
    {
      id: 'space-1',
      name: 'Поток: 24 сент.',
      tone: 'sage',
      resources: [],
      pinned: false,
      activeSession: {
        activeTabId: 'tab-1',
        tabs: [
          { id: 'tab-1', title: 'Вкладка 1', url: 'https://example.com' },
          { id: 'tab-2', title: 'Вкладка 2', url: 'https://example.com/2' },
          { id: 'tab-3', title: 'Вкладка 3', url: 'https://example.com/3' }
        ]
      }
    },
    {
      id: 'space-2',
      name: 'Моя мастерская',
      tone: 'sand',
      resources: [],
      pinned: true,
      activeSession: {
        activeTabId: 'tab-4',
        tabs: []
      }
    }
  ]
}

describe('SpacesOverview - карточки пространств и меню три точки', () => {
  it('отображает меню три точки (ActionMenu) сверху справа на каждой карточке пространства', async () => {
    const spaces = sampleSpaces()
    const onOpen = vi.fn()
    const onCreate = vi.fn()
    const onArchive = vi.fn()
    const onPin = vi.fn()
    const onRename = vi.fn()
    const onArchiveSpace = vi.fn()
    const onDelete = vi.fn()

    await act(async () => {
      root.render(
        <SpacesOverview
          spaces={spaces}
          hasArchive={false}
          onOpen={onOpen}
          onCreate={onCreate}
          onArchive={onArchive}
          onPin={onPin}
          onRename={onRename}
          onArchiveSpace={onArchiveSpace}
          onDelete={onDelete}
        />
      )
    })

    const cards = container.querySelectorAll('.overview-space')
    expect(cards).toHaveLength(2)

    // Проверяем наличие меню три точки на первой карточке
    const menuBtn1 = cards[0].querySelector<HTMLButtonElement>('.overview-space-menu button.task-more')
    expect(menuBtn1).toBeTruthy()
    expect(menuBtn1?.getAttribute('aria-label')).toBe('Действия с пространством «Поток: 24 сент.»')

    // Проверяем наличие меню три точки на второй карточке
    const menuBtn2 = cards[1].querySelector<HTMLButtonElement>('.overview-space-menu button.task-more')
    expect(menuBtn2).toBeTruthy()
    expect(menuBtn2?.getAttribute('aria-label')).toBe('Действия с пространством «Моя мастерская»')

    // Проверяем наличие стрелки на карточке
    expect(cards[0].querySelector('.overview-arrow')).toBeTruthy()
  })

  it('клик по телу карточки открывает пространство, а клик по меню три точки не триггерит onOpen', async () => {
    const spaces = sampleSpaces()
    const onOpen = vi.fn()
    const onRename = vi.fn()

    await act(async () => {
      root.render(
        <SpacesOverview
          spaces={spaces}
          hasArchive={false}
          onOpen={onOpen}
          onCreate={vi.fn()}
          onArchive={vi.fn()}
          onRename={onRename}
        />
      )
    })

    const cards = container.querySelectorAll('.overview-space')
    const menuBtn = cards[0].querySelector<HTMLButtonElement>('.overview-space-menu button.task-more')!

    // Кликаем по меню три точки
    await act(async () => {
      menuBtn.click()
    })

    // onOpen НЕ должен быть вызван
    expect(onOpen).not.toHaveBeenCalled()

    // Меню раскрылось
    const menuItems = document.querySelectorAll('[role="menuitem"]')
    expect(menuItems.length).toBeGreaterThan(0)

    // Кликаем по пункту «Переименовать»
    const renameItem = [...menuItems].find(item => item.textContent?.includes('Переименовать')) as HTMLButtonElement
    expect(renameItem).toBeTruthy()
    await act(async () => {
      renameItem.click()
    })

    expect(onRename).toHaveBeenCalledWith(spaces[0])
    expect(onOpen).not.toHaveBeenCalled()

    // Теперь кликаем по самой карточке (кнопке открытия)
    const openBtn = cards[0].querySelector<HTMLButtonElement>('.overview-space-open')!
    await act(async () => {
      openBtn.click()
    })

    expect(onOpen).toHaveBeenCalledWith('space-1')
  })

  it('отображает правильный лейбл закрепления в зависимости от space.pinned', async () => {
    const spaces = sampleSpaces()
    const onPin = vi.fn()

    await act(async () => {
      root.render(
        <SpacesOverview
          spaces={spaces}
          hasArchive={false}
          onOpen={vi.fn()}
          onCreate={vi.fn()}
          onArchive={vi.fn()}
          onPin={onPin}
        />
      )
    })

    const cards = container.querySelectorAll('.overview-space')

    // Карточка 1 (pinned = false)
    const menuBtn1 = cards[0].querySelector<HTMLButtonElement>('.overview-space-menu button.task-more')!
    await act(async () => {
      menuBtn1.click()
    })

    let menu = document.querySelector('[role="menu"]')
    expect(menu?.textContent).toContain('Закрепить в меню')

    // Закрываем первое меню
    await act(async () => {
      menuBtn1.click()
    })

    // Карточка 2 (pinned = true)
    const menuBtn2 = cards[1].querySelector<HTMLButtonElement>('.overview-space-menu button.task-more')!
    await act(async () => {
      menuBtn2.click()
    })

    menu = document.querySelector('[role="menu"]')
    expect(menu?.textContent).toContain('Открепить из меню')
  })
})
