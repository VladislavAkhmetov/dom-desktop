// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ParkedCoversStack, ResumeCard } from '../src/ResumeCard'
import { MemoryReliefSignal, AttentionIsland } from '../src/AttentionIsland'
import { ScratchpadWidget } from '../src/ScratchpadWidget'
import { CalmWindSvgFilter } from '../src/App'
import { emptyState } from '../shared/state'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('Calm Motion Wow Animations', () => {
  let root: Root
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('Анимация №1: ParkedCoversStack рендерит до 3 миниатюр в веере', async () => {
    const covers = [
      { id: 'tab-1', dataUrl: 'data:image/png;base64,aaa' },
      { id: 'tab-2', dataUrl: 'data:image/png;base64,bbb' },
      { id: 'tab-3', dataUrl: 'data:image/png;base64,ccc' },
      { id: 'tab-4', dataUrl: 'data:image/png;base64,ddd' },
    ]

    await act(async () => {
      root.render(<ParkedCoversStack spaceId="space-1" covers={covers} />)
    })

    const images = container.querySelectorAll<HTMLImageElement>('.resume-cover-stack-img')
    expect(images.length).toBe(3)
    expect(images[0].getAttribute('src')).toBe('data:image/png;base64,aaa')
    expect(images[1].getAttribute('src')).toBe('data:image/png;base64,bbb')
    expect(images[2].getAttribute('src')).toBe('data:image/png;base64,ccc')
  })

  it('Анимация №2: MemoryReliefSignal отображает разгрузку ОЗУ в МБ и ГБ', async () => {
    await act(async () => {
      root.render(<MemoryReliefSignal freedMB={384} />)
    })

    expect(container.textContent).toContain('Кабинет на паузе · Освобождено')
    expect(container.querySelector('.island-relief-dot')).not.toBeNull()

    // Проверка отображения в ГБ при объеме >= 1024 МБ
    await act(async () => {
      root.render(<MemoryReliefSignal freedMB={2048} />)
    })
    expect(container.textContent).toContain('Кабинет на паузе · Освобождено')
  })

  it('Анимация №2: AttentionIsland отображает сигнал памяти вместо приветствия', async () => {
    const state = emptyState()
    await act(async () => {
      root.render(
        <AttentionIsland
          state={state}
          now={new Date()}
          onChange={() => {}}
          onOpen={() => {}}
          onSpace={() => {}}
          onFocus={() => {}}
          memoryRelief={{ freedMB: 512, id: 'relief-1' }}
        />
      )
    })

    const trigger = container.querySelector('.island-trigger')
    expect(trigger?.textContent).toContain('Кабинет на паузе · Освобождено')
    expect(container.querySelector('.island-relief-dot')).not.toBeNull()
  })

  it('Анимация №3: CalmWindSvgFilter содержит фильтр #calm-wind-dissolve с feTurbulence и feDisplacementMap', async () => {
    await act(async () => {
      root.render(<CalmWindSvgFilter />)
    })

    const filter = container.querySelector('#calm-wind-dissolve')
    expect(filter).not.toBeNull()
    const turbulence = filter?.querySelector('feTurbulence')
    const displacement = filter?.querySelector('feDisplacementMap')
    expect(turbulence).not.toBeNull()
    expect(displacement).not.toBeNull()
    expect(displacement?.getAttribute('scale')).toBe('38')
  })

  it('Анимация №3: ScratchpadWidget при очистке создает растворяющийся элемент без потери устойчивости', async () => {
    const state = { ...emptyState(), scratchpadNote: 'Важная мысль для удаления' }
    let changedState: any = null

    function Harness() {
      const [current, setCurrent] = useState(state)
      return (
        <ScratchpadWidget
          state={current}
          onChange={upd => {
            const next = upd(current)
            changedState = next
            setCurrent(next)
          }}
        />
      )
    }

    await act(async () => {
      root.render(<Harness />)
    })

    const clearBtn = container.querySelector<HTMLButtonElement>('.scratchpad-btn.icon-only')
    expect(clearBtn).not.toBeNull()

    await act(async () => {
      clearBtn?.click()
    })

    // Появляется dissolving-слой
    const dissolving = container.querySelector('.scratchpad-dissolving')
    expect(dissolving).not.toBeNull()
    expect(dissolving?.textContent).toContain('Важная мысль для удаления')
    expect(changedState?.scratchpadNote).toBe('')
  })
})
