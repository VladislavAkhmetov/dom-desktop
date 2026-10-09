const { spawnSync } = require('node:child_process')
const path = require('node:path')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const result = spawnSync(require('electron'), [path.join(__dirname, 'visual-qa-test.cjs'), '--cabinet-pilot'], {
  stdio: 'inherit',
  windowsHide: true,
  env,
  timeout: 90000
})

if (result.error) console.error(result.error.message)
process.exitCode = result.status ?? 1
