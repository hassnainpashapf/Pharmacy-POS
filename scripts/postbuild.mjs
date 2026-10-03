import { copyFileSync } from 'node:fs'

try {
  copyFileSync('dist/index.html', 'dist/200.html')
  copyFileSync('dist/index.html', 'dist/404.html')
  console.log('Generated dist/200.html and dist/404.html for SPA fallback.')
} catch (e) {
  console.warn('Could not complete postbuild SPA fallback setup:', e.message)
}
