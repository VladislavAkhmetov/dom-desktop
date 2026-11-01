// Right-click menu of a web page (WebContentsView has none by default).
// Pure: it only returns an Electron menu template. The caller builds and pops up the Menu,
// so the behaviour can be checked without Electron (tests/page-menu.test.ts).

function isWeb(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}

function pageMenuTemplate(params, actions) {
  const items = []
  const separator = () => { if (items.length && items[items.length - 1].type !== 'separator') items.push({ type: 'separator' }) }
  const link = isWeb(params.linkURL) ? params.linkURL : ''
  const flags = params.editFlags || {}
  const selection = typeof params.selectionText === 'string' && params.selectionText.trim().length > 0

  if (link) {
    const title = typeof params.linkText === 'string' ? params.linkText.trim().slice(0, 200) : ''
    items.push(
      { label: 'Заглянуть рядом', click: () => actions.glance(link, title) },
      { label: 'Открыть в новой вкладке', click: () => actions.newTab(link, false) },
      { label: 'Открыть в фоне', click: () => actions.newTab(link, true) },
      { label: 'Отложить на потом', click: () => actions.later(link, title) },
      { label: 'Копировать ссылку', click: () => actions.copyText(link) }
    )
  }

  if (params.mediaType === 'image' && isWeb(params.srcURL)) {
    separator()
    items.push(
      { label: 'Копировать изображение', click: () => actions.copyImage() },
      { label: 'Сохранить изображение', click: () => actions.saveImage(params.srcURL) }
    )
  }

  if (params.isEditable) {
    separator()
    items.push(
      { label: 'Вырезать', role: 'cut', enabled: flags.canCut !== false },
      { label: 'Копировать', role: 'copy', enabled: flags.canCopy !== false },
      { label: 'Вставить', role: 'paste', enabled: flags.canPaste !== false },
      { label: 'Выделить всё', role: 'selectAll', enabled: flags.canSelectAll !== false }
    )
  } else if (selection) {
    separator()
    items.push({ label: 'Копировать', role: 'copy' })
  }

  // A plain spot on the page: navigation and saving.
  if (!items.length) {
    items.push(
      { label: 'Назад', enabled: Boolean(actions.canGoBack), click: () => actions.back() },
      { label: 'Вперёд', enabled: Boolean(actions.canGoForward), click: () => actions.forward() },
      { label: 'Обновить', click: () => actions.reload() },
      { type: 'separator' },
      { label: 'Сохранить страницу', click: () => actions.savePage() }
    )
  }

  while (items.length && items[items.length - 1].type === 'separator') items.pop()
  return items
}

module.exports = { pageMenuTemplate, isWeb }
