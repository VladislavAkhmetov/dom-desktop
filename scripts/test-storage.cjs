const { spawnSync } = require('node:child_process')
const path = require('node:path')
const result = spawnSync(require('electron'), [path.join(__dirname, '../tests/storage.cjs')], { stdio: 'inherit', windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } })
if (result.error) console.error(result.error.message)
process.exitCode = result.status ?? 1
