const { app, BrowserWindow, ipcMain, session } = require('electron')
const http = require('node:http')
const path = require('node:path')
const assert = require('node:assert/strict')
const { BrowserManager } = require('../electron/browser.cjs')

app.commandLine.appendSwitch('enable-features', 'WinSystemLocationProvider')

async function run() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<!DOCTYPE html>
<html>
<head><title>Geo Test</title></head>
<body>
  <h1>Test Page</h1>
  <button id="ask-geo" onclick="askLocation()">Get Location</button>
  <div id="status">idle</div>
  <script>
    function askLocation() {
      document.getElementById('status').textContent = 'requesting';
      navigator.geolocation.getCurrentPosition(
        pos => {
          document.getElementById('status').textContent = 'granted:' + pos.coords.latitude;
        },
        err => {
          document.getElementById('status').textContent = 'error:' + err.code;
        },
        { timeout: 10000 }
      );
    }
  </script>
</body>
</html>`)
  })

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  const window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      contextIsolation: true,
      sandbox: true
    }
  })

  const manager = new BrowserManager(window, 'persist:test-perm-browser')

  ipcMain.handle('browser:show', (_e, v) => manager.show(v))
  ipcMain.handle('browser:respondPermission', (_e, id, allowed) => manager.respondPermission(id, allowed))

  let capturedEvent = null
  window.webContents.on('ipc-message', (_e, channel, ...args) => {
    if (channel === 'browser:event' && args[0]?.type === 'permission-request') {
      capturedEvent = args[0]
    }
  })

  // We can also spy on manager.send:
  const originalSend = manager.send.bind(manager)
  let permissionEventReceived = null
  manager.send = (msg) => {
    if (msg.type === 'permission-request') {
      permissionEventReceived = msg
    }
    return originalSend(msg)
  }

  // Load the web page into WebContentsView
  const tab = { id: 'test-geo-tab', url: `http://127.0.0.1:${port}/` }
  await manager.show({ tab, spaceId: 'test-space', bounds: { x: 0, y: 0, width: 800, height: 600 } })

  const liveTab = manager.tabs.get('test-geo-tab')
  assert.ok(liveTab, 'WebContentsView created')

  // Trigger geolocation request in the page
  await liveTab.view.webContents.executeJavaScript('document.getElementById("ask-geo").click()')

  // Wait for permission-request event
  const start = Date.now()
  while (!permissionEventReceived && Date.now() - start < 10000) {
    await new Promise(r => setTimeout(r, 100))
  }

  assert.ok(permissionEventReceived, 'Permission request event was received')
  assert.equal(permissionEventReceived.permission, 'geolocation', 'Permission is geolocation')
  assert.equal(permissionEventReceived.hostname, '127.0.0.1', 'Hostname matches')
  console.log('✓ Captured Chrome-style permission event:', permissionEventReceived)

  // Respond "Allow" to the permission request
  manager.respondPermission(permissionEventReceived.id, true)

  // Wait for page to receive coordinates
  const waitGeo = Date.now()
  let statusText = ''
  while (!statusText.startsWith('granted:') && Date.now() - waitGeo < 10000) {
    statusText = await liveTab.view.webContents.executeJavaScript('document.getElementById("status").textContent')
    await new Promise(r => setTimeout(r, 200))
  }

  console.log('✓ Page status after permission response:', statusText)
  assert.ok(statusText.startsWith('granted:'), 'Geolocation was successfully granted and coordinates received')

  manager.dispose()
  window.destroy()
  server.close()
  console.log('✓ Full end-to-end Chrome-style geolocation permission prompt verification PASSED!')
  app.exit(0)
}

app.whenReady().then(run).catch(err => {
  console.error('Test error:', err)
  app.exit(1)
})
