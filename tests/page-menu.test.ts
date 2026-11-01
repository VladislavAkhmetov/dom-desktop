import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { pageMenuTemplate } = require('../electron/page-menu.cjs')

function actions() {
  return { glance: vi.fn(), newTab: vi.fn(), later: vi.fn(), copyText: vi.fn(), copyImage: vi.fn(), saveImage: vi.fn(), savePage: vi.fn(),
    canGoBack: true, canGoForward: false, back: vi.fn(), forward: vi.fn(), reload: vi.fn() }
}
const labels = (items: { label?: string }[]) => items.map(item => item.label).filter(Boolean)
const click = (items: { label?: string; click?: () => void }[], label: string) => items.find(item => item.label === label)!.click!()

describe('меню страницы', () => {
  it('у ссылки предлагает заглянуть, открыть, отложить и скопировать, и передаёт адрес и подпись', () => {
    const run = actions()
    const items = pageMenuTemplate({ linkURL: 'https://example.com/a', linkText: '  Статья  ' }, run)
    expect(labels(items)).toEqual(['Заглянуть рядом', 'Открыть в новой вкладке', 'Открыть в фоне', 'Отложить на потом', 'Копировать ссылку'])
    click(items, 'Заглянуть рядом'); click(items, 'Открыть в фоне'); click(items, 'Отложить на потом'); click(items, 'Копировать ссылку')
    expect(run.glance).toHaveBeenCalledWith('https://example.com/a', 'Статья')
    expect(run.newTab).toHaveBeenCalledWith('https://example.com/a', true)
    expect(run.later).toHaveBeenCalledWith('https://example.com/a', 'Статья')
    expect(run.copyText).toHaveBeenCalledWith('https://example.com/a')
  })

  it('не предлагает открыть ссылки не по HTTP и HTTPS', () => {
    for (const linkURL of ['javascript:alert(1)', 'file:///C:/secret.txt', 'mailto:a@b.c', '']) {
      expect(labels(pageMenuTemplate({ linkURL }, actions()))).not.toContain('Заглянуть рядом')
    }
  })

  it('в поле ввода даёт правку по ролям с учётом доступности, на выделении — только «Копировать»', () => {
    const edit = pageMenuTemplate({ isEditable: true, editFlags: { canCut: false, canPaste: true } }, actions())
    expect(edit.map((item: { role: string }) => item.role)).toEqual(['cut', 'copy', 'paste', 'selectAll'])
    expect(edit[0].enabled).toBe(false)
    expect(edit[2].enabled).toBe(true)
    const selected = pageMenuTemplate({ selectionText: ' слово ' }, actions())
    expect(selected.map((item: { role: string }) => item.role)).toEqual(['copy'])
  })

  it('на картинке добавляет копирование и сохранение, на пустом месте — навигацию и сохранение страницы', () => {
    const run = actions()
    const image = pageMenuTemplate({ mediaType: 'image', srcURL: 'https://example.com/i.png' }, run)
    expect(labels(image)).toEqual(['Копировать изображение', 'Сохранить изображение'])
    click(image, 'Сохранить изображение')
    expect(run.saveImage).toHaveBeenCalledWith('https://example.com/i.png')
    const page = pageMenuTemplate({}, run)
    expect(labels(page)).toEqual(['Назад', 'Вперёд', 'Обновить', 'Сохранить страницу'])
    expect(page.find((item: { label?: string }) => item.label === 'Назад').enabled).toBe(true)
    expect(page.find((item: { label?: string }) => item.label === 'Вперёд').enabled).toBe(false)
    click(page, 'Сохранить страницу')
    expect(run.savePage).toHaveBeenCalled()
  })

  it('не оставляет разделителей по краям', () => {
    const items = pageMenuTemplate({ linkURL: 'https://example.com/', mediaType: 'image', srcURL: 'https://example.com/i.png' }, actions())
    expect(items[0].type).not.toBe('separator')
    expect(items.at(-1).type).not.toBe('separator')
    expect(items.some((item: { type?: string }, index: number) => item.type === 'separator' && items[index - 1]?.type === 'separator')).toBe(false)
  })
})
