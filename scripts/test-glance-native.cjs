const { spawnSync } = require('node:child_process')
const path = require('node:path')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
// Linux without a display (CI containers): run Chromium on the headless ozone platform.
const headless = process.platform === 'linux' && !env.DISPLAY ? ['--no-sandbox', '--disable-gpu', '--ozone-platform=headless'] : []
const result = spawnSync(require('electron'), [...headless, path.join(__dirname, '../tests/glance-native.cjs')], { stdio: 'inherit', windowsHide: true, env, timeout: 90000 })
if (result.error) console.error(result.error.message)
process.exitCode = result.status ?? 1
