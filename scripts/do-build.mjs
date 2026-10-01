import { build } from 'vite'

console.log('Starting build...')
try {
  await build()
  console.log('Build completed successfully.')
} catch (err) {
  console.error('Build failed:', err)
  process.exit(1)
}
