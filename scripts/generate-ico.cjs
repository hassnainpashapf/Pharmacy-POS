const { execSync } = require('child_process')
const path = require('path')

try {
  execSync(`python3 "${path.resolve(__dirname, 'generate-icons.py')}"`, { stdio: 'inherit' })
} catch (err) {
  console.error('Icon generation failed:', err)
  process.exit(1)
}
