// Native check in a real WebContentsView (run: npm run test:glance-native): page menu, «Заглянуть», Esc,
// picture-in-picture, and the Memory Saver timeout setting.
// Needs Electron; on Linux without a display add --ozone-platform=headless --no-sandbox.
const { app, BrowserWindow, Menu, clipboard, ipcMain } = require('electron')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const { BrowserManager } = require('../electron/browser.cjs')

const testDir = path.resolve(__dirname, '../.cache/glance-tests', String(Date.now()))
fs.mkdirSync(testDir, { recursive: true })
app.setPath('userData', testDir)
app.disableHardwareAcceleration()
app.on('window-all-closed', () => undefined)

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(test, label, timeout = 15000) {
  const end = Date.now() + timeout
  while (Date.now() < end) { try { if (await test()) return } catch { /* retry */ } await wait(100) }
  throw new Error(`Ожидание: ${label}`)
}

async function run() {
  const server = http.createServer((req, res) => {
    if (req.url === '/video') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('<!doctype html><title>Тест видео</title><video id="v" muted autoplay width="320" height="180"></video><canvas id="c" width="320" height="180"></canvas>')
      return
    }
    if (req.url === '/pic.png') { res.setHeader('Content-Type', 'image/png'); res.end(PNG); return }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><html lang="ru"><head><title>Тест ${req.url}</title></head><body style="margin:0">
      <p><a id="link" href="/next" style="display:block;width:300px;height:40px">Следующая статья</a></p>
      <p><a id="bad" href="javascript:void(0)" style="display:block;width:300px;height:40px">Скрипт</a></p>
      <img id="pic" src="/pic.png" width="100" height="100" style="display:block">
      <input id="field" style="display:block;width:300px;height:30px" value="текст">
      <div id="plain" style="height:200px"></div></body></html>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  const window = new BrowserWindow({ show: false, width: 1440, height: 900, titleBarStyle: 'hidden', webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } })
  await window.loadURL('data:text/html,<title>shell</title>')
  window.showInactive() // a hidden window makes pages «hidden» and drops input events
  const manager = new BrowserManager(window, 'persist:dom-glance-test')
  const events = []
  manager.send = message => events.push(message)
  // The same wiring as electron/main.cjs.
  ipcMain.on('page:signal', (event, value) => manager.pageSignal(event.sender, value))
  ipcMain.on('page:glance', (event, value) => manager.pageGlance(event.sender, value))
  const savedDir = path.join(testDir, 'downloads'); fs.mkdirSync(savedDir)
  require('electron').session.fromPartition('persist:dom-glance-test').on('will-download', (_event, item) => item.setSavePath(path.join(savedDir, item.getFilename())))
  const menus = []
  const buildFromTemplate = Menu.buildFromTemplate
  Menu.buildFromTemplate = template => { menus.push(template); return { popup() {} } }

  await manager.show({ tab: { id: 'main', url: `${base}/` }, spaceId: 'space', bounds: { x: 0, y: 0, width: 800, height: 600 } })
  const contents = manager.tabs.get('main').view.webContents
  await waitFor(() => !contents.isLoading() && contents.getTitle().startsWith('Тест'), 'страница загружена')
  const center = id => contents.executeJavaScript(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return { x: Math.round(r.left + 20), y: Math.round(r.top + 10) } })()`)
  const click = async (id, modifiers = [], button = 'left') => {
    const { x, y } = await center(id)
    contents.sendInputEvent({ type: 'mouseMove', x, y })
    contents.sendInputEvent({ type: 'mouseDown', x, y, button, clickCount: 1, modifiers })
    contents.sendInputEvent({ type: 'mouseUp', x, y, button, clickCount: 1, modifiers })
  }
  const labels = template => template.map(item => item.label).filter(Boolean)

  // 1. Shift+click on a link asks the shell to «заглянуть»; a plain click and a javascript: link do not.
  await click('link', ['shift'])
  await waitFor(() => events.some(event => event.type === 'glance'), 'Shift+клик дал событие glance')
  const glance = events.find(event => event.type === 'glance')
  assert.equal(glance.url, `${base}/next`)
  assert.equal(glance.parentTabId, 'main')
  assert.equal(glance.spaceId, 'space')
  assert.equal(glance.title, 'Следующая статья')
  assert.ok(manager.glanceIds.has(glance.id), 'id временной страницы запомнен')
  assert.equal(contents.getURL(), `${base}/`, 'страница под курсором не ушла по ссылке')
  events.length = 0
  await click('bad', ['shift'])
  await wait(500)
  assert.equal(events.filter(event => event.type === 'glance').length, 0, 'javascript: не открывается')

  // 2. The glance page is an ordinary page; Esc inside it asks the shell to close it, Esc elsewhere does nothing.
  await manager.show({ tab: { id: glance.id, url: glance.url }, spaceId: 'space', bounds: { x: 0, y: 0, width: 400, height: 600 } })
  const glanceContents = manager.tabs.get(glance.id).view.webContents
  await waitFor(() => !glanceContents.isLoading() && glanceContents.getTitle().startsWith('Тест'), 'страница «Заглянуть» загружена')
  events.length = 0
  for (const type of ['keyDown', 'keyUp']) contents.sendInputEvent({ type, keyCode: 'Escape' })
  await wait(300)
  assert.equal(events.filter(event => event.type === 'glance-close').length, 0, 'Esc в обычной странице не закрывает')
  for (const type of ['keyDown', 'keyUp']) glanceContents.sendInputEvent({ type, keyCode: 'Escape' })
  await waitFor(() => events.some(event => event.type === 'glance-close' && event.tabId === glance.id), 'Esc в окне «Заглянуть» даёт glance-close')

  // 3. Keeping it (move) makes it an ordinary tab: Esc no longer closes.
  manager.move(glance.id, 'space')
  assert.ok(!manager.glanceIds.has(glance.id))
  events.length = 0
  for (const type of ['keyDown', 'keyUp']) glanceContents.sendInputEvent({ type, keyCode: 'Escape' })
  await wait(300)
  assert.equal(events.filter(event => event.type === 'glance-close').length, 0, 'после «Оставить» Esc не закрывает')
  assert.equal(await manager.close(glance.id, false), true)
  assert.ok(!manager.tabs.has(glance.id))

  // 4. Right click: real context-menu events produce the template for a link, an image, an input and a plain spot.
  await click('link', [], 'right')
  await waitFor(() => menus.length >= 1, 'меню у ссылки')
  assert.deepEqual(labels(menus.at(-1)), ['Заглянуть рядом', 'Открыть в новой вкладке', 'Открыть в фоне', 'Отложить на потом', 'Копировать ссылку'])
  const linkMenu = menus.at(-1)
  events.length = 0
  for (const label of ['Заглянуть рядом', 'Открыть в новой вкладке', 'Открыть в фоне', 'Отложить на потом']) linkMenu.find(item => item.label === label).click()
  assert.deepEqual(events.map(event => event.type), ['glance', 'new-tab', 'new-tab', 'save-later'])
  assert.deepEqual(events.filter(event => event.type === 'new-tab').map(event => event.background), [false, true])
  assert.equal(events.find(event => event.type === 'save-later').url, `${base}/next`)
  linkMenu.find(item => item.label === 'Копировать ссылку').click()
  assert.equal(clipboard.readText(), `${base}/next`)

  const before = menus.length
  await click('pic', [], 'right')
  await waitFor(() => menus.length > before, 'меню у картинки')
  const imageMenu = menus.at(-1)
  assert.deepEqual(labels(imageMenu), ['Копировать изображение', 'Сохранить изображение'])
  clipboard.clear()
  imageMenu.find(item => item.label === 'Копировать изображение').click()
  await waitFor(() => !clipboard.readImage().isEmpty(), 'изображение в буфере')
  imageMenu.find(item => item.label === 'Сохранить изображение').click()
  await waitFor(() => fs.existsSync(path.join(savedDir, 'pic.png')) && fs.statSync(path.join(savedDir, 'pic.png')).size > 0, 'изображение сохранено')

  const beforeInput = menus.length
  await click('field', [], 'right')
  await waitFor(() => menus.length > beforeInput, 'меню у поля ввода')
  assert.deepEqual(menus.at(-1).map(item => item.role), ['cut', 'copy', 'paste', 'selectAll'])

  const beforePlain = menus.length
  await click('plain', [], 'right')
  await waitFor(() => menus.length > beforePlain, 'меню на пустом месте')
  assert.deepEqual(labels(menus.at(-1)), ['Назад', 'Вперёд', 'Обновить', 'Сохранить страницу'])
  events.length = 0
  menus.at(-1).find(item => item.label === 'Сохранить страницу').click()
  assert.deepEqual(events, [{ type: 'save-page', tabId: 'main' }])

  // 5. Picture-in-picture: the page reports a <video>; the call opens the window, the second call closes it.
  assert.deepEqual(await manager.pictureInPicture('main'), { ok: false, state: 'none' }, 'на странице без видео окна нет')
  assert.equal(manager.tabs.get('main').hasVideo, false)
  await manager.show({ tab: { id: 'movie', url: `${base}/video` }, spaceId: 'space', bounds: { x: 0, y: 0, width: 800, height: 600 } })
  const movie = manager.tabs.get('movie').view.webContents
  await waitFor(() => !movie.isLoading() && movie.getTitle().startsWith('Тест видео'), 'страница с видео загружена')
  await waitFor(() => manager.tabs.get('movie').hasVideo === true, 'страница сообщила о <video>')
  assert.ok(events.some(event => event.type === 'update' && event.tabId === 'movie' && event.updates.hasVideo === true))
  await movie.executeJavaScript(`(async () => { const c = document.getElementById('c'), v = document.getElementById('v'), g = c.getContext('2d'); setInterval(() => { g.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); g.fillRect(0, 0, 320, 180) }, 50); v.srcObject = c.captureStream(15); await v.play() })()`, true)
  assert.deepEqual(await manager.pictureInPicture('movie'), { ok: true, state: 'opened' })
  assert.equal(await movie.executeJavaScript('Boolean(document.pictureInPictureElement)'), true)
  assert.deepEqual(await manager.pictureInPicture('movie'), { ok: true, state: 'closed' })
  assert.equal(await movie.executeJavaScript('Boolean(document.pictureInPictureElement)'), false)
  assert.deepEqual(await manager.pictureInPicture('missing'), { ok: false })
  assert.equal(await manager.close('movie', false), false, 'играющее видео защищено от тихого закрытия')
  Object.assign(manager.tabs.get('movie'), { protected: false, playing: false, audible: false })
  assert.equal(await manager.close('movie', false), true)

  // 6. Memory Saver reads the user's setting: 15 min discards a tab hidden for 16 min, 60 min and «Никогда» keep it.
  const sleeper = { id: 'sleeper' }
  const hide = async () => {
    await manager.show({ tab: { id: sleeper.id, url: `${base}/sleeper` }, spaceId: 'space', bounds: { x: 0, y: 0, width: 400, height: 300 } })
    manager.hide(sleeper.id)
    manager.tabs.get(sleeper.id).hiddenAt = Date.now() - 16 * 60_000
  }
  await hide()
  for (const minutes of [60, 0]) {
    manager.getIdleMinutes = () => minutes
    assert.equal(await manager.discardIdle(), 0, `при ${minutes} мин вкладка остаётся`)
    assert.ok(manager.tabs.has(sleeper.id))
  }
  manager.getIdleMinutes = async () => 15
  assert.equal(await manager.discardIdle(), 1, 'при 15 мин вкладка выгружена')
  assert.ok(!manager.tabs.has(sleeper.id))
  await hide()
  manager.getIdleMinutes = () => undefined
  assert.equal(await manager.discardIdle(), 0, 'без настройки действует 30 мин: 16 мин мало')
  assert.equal(await manager.close(sleeper.id, false), true)

  Menu.buildFromTemplate = buildFromTemplate
  manager.dispose()
  server.close()
  console.log('Glance Native Test OK')
}

app.whenReady().then(run).then(() => app.exit(0)).catch(error => { console.error('Glance Native Test failure:', error); app.exit(1) })
