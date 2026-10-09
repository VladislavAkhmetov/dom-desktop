const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const exePath = path.resolve(__dirname, '../release/win-unpacked/dombro-cabinet.exe')
console.log('Testing unpacked binary:', exePath)
if (!fs.existsSync(exePath)) {
  console.error('Binary not found:', exePath)
  process.exit(1)
}

const pilotDir = path.join(process.env.APPDATA, 'dombro-cabinet-pilot')
console.log('Target pilot directory:', pilotDir)

const child = spawn(exePath, [], {
  stdio: 'ignore',
  windowsHide: true,
  detached: false
})

async function check() {
  const deadline = Date.now() + 15000
  let found = false
  while (Date.now() < deadline) {
    if (fs.existsSync(pilotDir)) {
      const files = fs.readdirSync(pilotDir)
      console.log('Pilot directory created! Files found:', files)
      if (files.some(f => f.includes('state') || f.includes('Preferences') || f.includes('Local Storage') || f.includes('Partitions') || f.includes('Network'))) {
        found = true
        break
      }
    }
    await new Promise(r => setTimeout(r, 500))
  }

  // Gracefully terminate child process
  try {
    process.kill(child.pid)
  } catch { /* already closed */ }

  if (!found) {
    console.error('Verification failed: pilot directory was not created or initialized within 15 seconds.')
    process.exit(1)
  }

  console.log('Verified: dombro-cabinet launches in isolated cabinet pilot mode without any flags!')
  process.exit(0)
}

check().catch(err => {
  try { process.kill(child.pid) } catch {}
  console.error(err)
  process.exit(1)
})
