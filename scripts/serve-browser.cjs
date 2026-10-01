const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 5173
const DIST_DIR = path.resolve(__dirname, '../dist')
const DOWNLOADS_DIR = path.resolve(__dirname, '../downloads')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.exe': 'application/octet-stream',
  '.dmg': 'application/x-apple-diskimage',
  '.apk': 'application/vnd.android.package-archive',
  '.zip': 'application/zip',
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0]

  // Handle downloads directly from downloads directory with streaming & Range support
  if (urlPath.startsWith('/downloads/')) {
    const fileName = path.basename(decodeURIComponent(urlPath))
    const filePath = path.join(DOWNLOADS_DIR, fileName)

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Download Not Found')
        return
      }

      const ext = path.extname(filePath).toLowerCase()
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'

      const range = req.headers.range
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1
        const chunksize = end - start + 1
        const stream = fs.createReadStream(filePath, { start, end })

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Access-Control-Allow-Origin': '*',
        })
        stream.pipe(res)
      } else {
        res.writeHead(200, {
          'Content-Length': stats.size,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Access-Control-Allow-Origin': '*',
        })
        fs.createReadStream(filePath).pipe(res)
      }
    })
    return
  }

  // Handle SPA web assets from dist
  let safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '')
  let filePath = path.join(DIST_DIR, safePath)

  fs.stat(filePath, (err, stats) => {
    if (err || stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html')
      if (!err && stats.isDirectory() && fs.existsSync(indexPath)) {
        filePath = indexPath
      } else {
        filePath = path.join(DIST_DIR, 'index.html')
      }
    }

    fs.stat(filePath, (e, st) => {
      if (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
        return
      }
      const ext = path.extname(filePath).toLowerCase()
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': st.size,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      })
      fs.createReadStream(filePath).pipe(res)
    })
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pharmacy POS browser server running at:`)
  console.log(`  Local:   http://localhost:${PORT}/`)
  console.log(`  Network: http://127.0.0.1:${PORT}/`)
})
