import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

// Packaged installers (Windows .exe, macOS .dmg, Android .apk) live OUTSIDE
// public/ so they never become part of the web bundle. That is what keeps the
// Capacitor APK small: when they sat in public/, `webDir: "dist"` copied ~900 MB
// of installers into the APK - including a copy of the APK itself.
// They are still served from the same /downloads URLs during dev and preview;
// in production the web host serves that directory directly.
const downloadsDir = fileURLToPath(new URL('./downloads', import.meta.url))

const MIME = {
  '.apk': 'application/vnd.android.package-archive',
  '.dmg': 'application/x-apple-diskimage',
  '.exe': 'application/octet-stream',
  '.zip': 'application/zip',
}

// Returns [start, end] for a satisfiable range, or [null, null] when the client
// asked for a byte range past the end of the file.
function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec((header || '').trim())
  if (!match) return [0, size - 1]

  const [, rawStart, rawEnd] = match
  let start = rawStart ? Number(rawStart) : null
  let end = rawEnd ? Number(rawEnd) : null
  if (start === null) {
    // Suffix range: the last N bytes.
    const suffix = end ?? 0
    if (suffix <= 0) return [null, null]
    start = Math.max(0, size - suffix)
    end = size - 1
  } else if (end === null || end >= size) {
    end = size - 1
  }

  if (start >= size || start > end) return [null, null]
  return [start, end]
}

function serveDownload(req, res, next) {
  const requestPath = (req.url || '').split('?')[0]
  if (!requestPath.startsWith('/downloads/')) return next()

  const relative = decodeURIComponent(requestPath.slice('/downloads/'.length))
  const file = normalize(join(downloadsDir, relative))
  // Reject anything that escapes the downloads directory.
  if (!file.startsWith(`${downloadsDir}/`)) {
    res.statusCode = 403
    return res.end('Forbidden')
  }

  let stat
  try {
    stat = statSync(file)
  } catch {
    res.statusCode = 404
    return res.end('Not found')
  }
  if (!stat.isFile()) {
    res.statusCode = 404
    return res.end('Not found')
  }

  res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream')
  // Installers are hundreds of megabytes, so honour Range requests to keep
  // downloads resumable.
  res.setHeader('Accept-Ranges', 'bytes')

  const [start, end] = parseRange(req.headers.range, stat.size)
  if (start === null) {
    res.statusCode = 416
    res.setHeader('Content-Range', `bytes */${stat.size}`)
    return res.end()
  }

  if (start > 0 || end < stat.size - 1) {
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
  }
  res.setHeader('Content-Length', end - start + 1)
  if (req.method === 'HEAD') return res.end()
  createReadStream(file, { start, end }).pipe(res)
}

// Serves /downloads from `vite dev` and `vite preview` alike.
function downloadsPlugin() {
  return {
    name: 'serve-downloads',
    configureServer(server) {
      server.middlewares.use(serveDownload)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveDownload)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), downloadsPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/release/**', '**/dist/**', '**/ios/**', '**/android/**', '**/downloads/**'],
    },
    proxy: {
      '/api/mobile': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        // Retain the browser Origin for the backend's exact-origin CSRF check.
        // Forward peer addresses so remote clients cannot bootstrap via this proxy.
        xfwd: true,
      },
    },
  },
})
