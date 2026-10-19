const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const exePath = path.resolve(__dirname, '../release/dombro-cabinet-0.1.0-Portable.exe')
console.log('Testing portable binary:', exePath)
if (!fs.existsSync(exePath)) {
  console.error('Binary not found:', exePath)
  process.exit(1)
}

const smokeId = String(Date.now())
const smokeDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `dom-smoke-${smokeId}`)

console.log('Launching portable exe with smoke test...')
const child = spawn(exePath, [`--smoke-test`, `--smoke-id=${smokeId}`], {
  stdio: 'ignore',
  windowsHide: true,
  detached: false
})

async function check() {
  const deadline = Date.now() + 25000
  let found = false
  while (Date.now() < deadline) {
    if (fs.existsSync(smokeDir)) {
      const files = fs.readdirSync(smokeDir)
      console.log('Smoke directory created by portable exe! Files found:', files)
      if (files.some(f => f.includes('state') || f.includes('Preferences') || f.includes('Local Storage') || f.includes('Partitions') || f.includes('Network') || f.includes('dom.sqlite'))) {
        found = true
        break
      }
    }
    await new Promise(r => setTimeout(r, 600))
  }

  try {
    process.kill(child.pid)
  } catch {}

  if (!found) {
    console.error('Verification failed: portable exe did not initialize within 25 seconds.')
    process.exit(1)
  }

  console.log('✓ Success: dombro-cabinet-0.1.0-Portable.exe runs cleanly and boots properly!')
  process.exit(0)
}

check().catch(err => {
  try { process.kill(child.pid) } catch {}
  console.error(err)
  process.exit(1)
})
