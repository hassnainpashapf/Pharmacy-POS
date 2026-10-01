const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 5173
const DIST_DIR = path.resolve(__dirname, '../dist')

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
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0]
  let safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '')
  let filePath = path.join(DIST_DIR, safePath)

  fs.stat(filePath, (err, stats) => {
    if (err || stats.isDirectory()) {
      // Check if directory index exists
      const indexPath = path.join(filePath, 'index.html')
      if (!err && stats.isDirectory() && fs.existsSync(indexPath)) {
        filePath = indexPath
      } else {
        // SPA Fallback for client-side routing
        filePath = path.join(DIST_DIR, 'index.html')
      }
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
        return
      }

      const ext = path.extname(filePath).toLowerCase()
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(content)
    })
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pharmacy POS browser server running at:`)
  console.log(`  Local:   http://localhost:${PORT}/`)
  console.log(`  Network: http://127.0.0.1:${PORT}/`)
})
