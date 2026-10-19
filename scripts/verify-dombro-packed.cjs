const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const exePath = path.resolve(__dirname, '../release/win-unpacked/dombro.exe')
console.log('Testing unpacked binary:', exePath)
if (!fs.existsSync(exePath)) {
  console.error('Binary not found:', exePath)
  process.exit(1)
}

const smokeId = String(Date.now())
const smokeDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `dom-smoke-${smokeId}`)

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(exePath, [`--smoke-test`, `--smoke-id=${smokeId}`], {
  stdio: 'inherit',
  windowsHide: true,
  env,
  detached: false
})

async function check() {
  const deadline = Date.now() + 15000
  let found = false
  while (Date.now() < deadline) {
    if (fs.existsSync(smokeDir)) {
      const files = fs.readdirSync(smokeDir)
      console.log('Smoke directory created! Files found:', files)
      if (files.some(f => f.includes('state') || f.includes('Preferences') || f.includes('Local Storage') || f.includes('Partitions') || f.includes('Network'))) {
        found = true
        break
      }
    }
    await new Promise(r => setTimeout(r, 500))
  }

  try {
    process.kill(child.pid)
  } catch {}

  if (!found) {
    console.error('Verification failed: smoke directory was not created or initialized within 15 seconds.')
    process.exit(1)
  }

  console.log('Verified: dombro.exe successfully launches and boots with the latest prototype!')
  process.exit(0)
}

check().catch(err => {
  try { process.kill(child.pid) } catch {}
  console.error(err)
  process.exit(1)
})
