import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const children = new Set()
let stopping = false

function stop(code = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  // Stop only processes launched here; never kill an existing shared server.
  for (const child of children) child.kill('SIGTERM')
  const timer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL')
  }, 3000)
  timer.unref()
}

function launch(command, args, label) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', env: process.env })
  children.add(child)
  child.on('error', error => {
    console.error(`${label} could not start: ${error.message}`)
    children.delete(child)
    stop(1)
  })
  child.on('exit', code => {
    children.delete(child)
    if (!stopping) {
      if (code) console.error(`${label} exited (${code}).`)
      stop(code ?? 1)
    }
  })
  return child
}

async function backendReady() {
  let response
  try {
    response = await fetch('http://127.0.0.1:8787/api/mobile/status', { signal: AbortSignal.timeout(1000) })
  } catch { return false }
  let data
  try { data = await response.json() } catch { /* Handle unexpected listener below. */ }
  if (!response.ok || typeof data?.setupRequired !== 'boolean') {
    throw new Error('Port 8787 is responding but is not a usable shared inventory API. Check MOBILE_ORIGINS and the process using that port.')
  }
  return true
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0))

try {
  if (await backendReady()) {
    console.log('Using the running inventory API at http://127.0.0.1:8787')
  } else {
    console.log('Starting inventory API…')
    launch(process.env.PYTHON || 'python3', ['server/mobile_server.py', '--host', '127.0.0.1', '--port', '8787'], 'Inventory API')
    let ready = false
    for (let attempt = 0; attempt < 40 && !stopping; attempt++) {
      if (await backendReady()) { ready = true; break }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    if (!ready && !stopping) throw new Error('Inventory API did not become ready. Check Python 3.10+ and the error above.')
  }
  if (!stopping) launch(process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], 'Frontend')
} catch (error) {
  console.error(error.message)
  stop(1)
}
