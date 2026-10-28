import { act } from 'react'

// The header has no direct «Все пространства» / «Создать пространство» buttons any more:
// both live in the SpaceSwitcher panel (trigger «Пространства» → footer «Все» / «Новое»).
async function switcherAction(label: 'Все' | 'Новое') {
  const trigger = document.querySelector<HTMLButtonElement>('.chrome-spaces-actions .space-switcher-trigger')
  if (!trigger) throw new Error('Переключатель пространств не найден')
  await act(async () => trigger.click())
  const action = [...document.querySelectorAll<HTMLButtonElement>('.space-switcher-footer button')].find(item => item.textContent?.trim() === label)
  if (!action) throw new Error(`Нет действия «${label}» в переключателе`)
  await act(async () => action.click())
}

export const showAllSpaces = () => switcherAction('Все')
export const createSpaceFromSwitcher = () => switcherAction('Новое')

export async function openSwitcher() {
  const trigger = document.querySelector<HTMLButtonElement>('.chrome-spaces-actions .space-switcher-trigger')
  if (!trigger) throw new Error('Переключатель пространств не найден')
  await act(async () => trigger.click())
}

export function switcherNames() {
  return [...document.querySelectorAll('.space-switcher-list .space-switcher-name')].map(item => item.textContent?.trim())
}

// Opens a space that is not pinned to the header (unpinned spaces are reachable only from the switcher).
export async function openSpaceFromSwitcher(name: string) {
  await openSwitcher()
  const option = [...document.querySelectorAll<HTMLButtonElement>('.space-switcher-list [role="option"]')].find(item => item.querySelector('.space-switcher-name')?.textContent?.trim() === name)
  if (!option) throw new Error(`Пространство «${name}» не найдено в переключателе`)
  await act(async () => option.click())
}
