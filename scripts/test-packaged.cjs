const { spawnSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const executable = path.resolve(process.argv[2] || 'release/win-unpacked/dombro.exe')
if (!fs.existsSync(executable)) throw new Error('Сначала упакуйте приложение')
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
const id = String(Date.now())
for (let index = 0; index < 2; index++) {
  const result = spawnSync(executable, ['--smoke-test', `--smoke-id=${id}`], { windowsHide: true, env, stdio: 'inherit', timeout: 60000 })
  if (result.error || result.status !== 0) { if (result.error) console.error(result.error.message); process.exit(result.status || 1) }
}
