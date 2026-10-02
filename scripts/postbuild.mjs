import { copyFileSync } from 'node:fs'

try {
  copyFileSync('dist/index.html', 'dist/200.html')
  console.log('Generated dist/200.html for Cloudflare Pages SPA routing.')
} catch (e) {
  console.warn('Could not copy 200.html:', e.message)
}
