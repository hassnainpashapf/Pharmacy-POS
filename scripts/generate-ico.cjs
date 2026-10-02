const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')

const sizes = [256, 128, 64, 48, 32, 16]
const tmpDir = '/tmp/ico_gen'
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

const sourcePng = path.resolve(__dirname, '../public/icon-512.png')

const images = []
for (const size of sizes) {
  const outPng = path.join(tmpDir, `icon_${size}.png`)
  execSync(`sips -z ${size} ${size} "${sourcePng}" --out "${outPng}" 2>/dev/null`)
  const buf = fs.readFileSync(outPng)
  images.push({ size, buf })
}

// Build ICO file buffer
const count = images.length
const headerSize = 6
const entrySize = 16
const totalDirSize = headerSize + entrySize * count

let currentOffset = totalDirSize
const entries = []

for (const img of images) {
  const w = img.size === 256 ? 0 : img.size
  const h = img.size === 256 ? 0 : img.size
  const size = img.buf.length
  entries.push({
    w,
    h,
    size,
    offset: currentOffset,
    buf: img.buf,
  })
  currentOffset += size
}

const icoBuffer = Buffer.alloc(currentOffset)

// Write header
icoBuffer.writeUInt16LE(0, 0) // Reserved
icoBuffer.writeUInt16LE(1, 2) // Type 1 = ICO
icoBuffer.writeUInt16LE(count, 4) // Image count

// Write directory entries
let entryOffset = headerSize
for (const entry of entries) {
  icoBuffer.writeUInt8(entry.w, entryOffset)
  icoBuffer.writeUInt8(entry.h, entryOffset + 1)
  icoBuffer.writeUInt8(0, entryOffset + 2) // Color count
  icoBuffer.writeUInt8(0, entryOffset + 3) // Reserved
  icoBuffer.writeUInt16LE(1, entryOffset + 4) // Color planes
  icoBuffer.writeUInt16LE(32, entryOffset + 6) // Bits per pixel
  icoBuffer.writeUInt32LE(entry.size, entryOffset + 8) // Image size in bytes
  icoBuffer.writeUInt32LE(entry.offset, entryOffset + 12) // Image offset
  entryOffset += entrySize
}

// Write image data
for (const entry of entries) {
  entry.buf.copy(icoBuffer, entry.offset)
}

const targetPath = path.resolve(__dirname, '../public/icon.ico')
fs.writeFileSync(targetPath, icoBuffer)
console.log(`Generated multi-resolution Windows ICO at: ${targetPath} (${icoBuffer.length} bytes)`)

// Also copy to root/build as fallback
fs.writeFileSync(path.resolve(__dirname, '../public/favicon.ico'), icoBuffer)
