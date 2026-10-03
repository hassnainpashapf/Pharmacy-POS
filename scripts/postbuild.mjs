import { copyFileSync, writeFileSync } from 'node:fs'

try {
  copyFileSync('dist/index.html', 'dist/200.html')
  copyFileSync('dist/index.html', 'dist/404.html')
  writeFileSync('dist/_redirects', '/*    /index.html   200\n')
  console.log('Generated dist/200.html, dist/404.html, and dist/_redirects for universal SPA routing.')
} catch (e) {
  console.warn('Could not complete postbuild SPA fallback setup:', e.message)
}
