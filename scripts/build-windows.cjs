process.noAsar = true
const { build, Platform, Arch } = require('electron-builder')

async function run() {
  console.log('Starting electron-builder for Windows x64 (dir + nsis)...')
  try {
    const result = await build({
      targets: Platform.WINDOWS.createTarget(['dir', 'nsis'], Arch.x64),
    })
    console.log('Build completed successfully!')
    console.log('Artifacts:', result)
  } catch (err) {
    console.error('Build error:', err)
    process.exit(1)
  }
}

run()
