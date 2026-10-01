import test from 'node:test'
import assert from 'node:assert/strict'
import { cameraErrorMessage, createBarcodeDecoder, createCameraScanner, isBarcodeText } from './barcodeScannerCamera.js'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
const flush = () => new Promise((resolve) => setImmediate(resolve))
const namedError = (name) => Object.assign(new Error(name), { name })
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function harness(options = {}) {
  const timers = new Map()
  let timerId = 0
  const tracks = [new EventTarget(), new EventTarget()]
  tracks.forEach((track) => { track.stops = 0; track.stop = () => { track.stops += 1 } })
  const stream = { getTracks: () => tracks }
  const video = Object.assign(new EventTarget(), {
    srcObject: null,
    readyState: 4,
    videoWidth: 1280,
    videoHeight: 720,
    play: async () => {},
    pauseCount: 0,
    pause() { this.pauseCount += 1 },
  })
  let requested = []
  const document = Object.assign(new EventTarget(), { hidden: false })
  const environment = Object.assign(new EventTarget(), {
    isSecureContext: true,
    document,
    navigator: { mediaDevices: { getUserMedia: async (constraints) => { requested.push(constraints); return stream } } },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id },
    clearTimeout(id) { timers.delete(id) },
  })
  const detections = []
  const errors = []
  let ready = 0
  const scanner = createCameraScanner({
    video,
    environment,
    onDetected: (text) => detections.push(text),
    onError: (message) => errors.push(message),
    onReady: () => { ready += 1 },
    createDecoder: async () => ({ decode: async () => null }),
    ...options,
  })
  return {
    scanner, tracks, stream, video, environment, document, detections, errors, timers, requested,
    get ready() { return ready },
    tick(delay = 160) {
      const match = [...timers.entries()].find(([, item]) => item.delay === delay)
      assert.ok(match, `Expected a ${delay}ms timer`)
      timers.delete(match[0])
      return match[1].callback()
    },
  }
}

test('barcode values remain strings, including zeros and Code 128 letters', () => {
  assert.equal(isBarcodeText('000012345678'), true)
  assert.equal(isBarcodeText('00AB-123'), true)
  assert.equal(isBarcodeText(123), false)
  assert.equal(isBarcodeText(' \n '), false)
})

test('native detection is used only when all core medicine formats are supported', async () => {
  let readerLoads = 0
  let configuredFormats
  class Detector {
    static async getSupportedFormats() { return [...FORMATS, 'qr_code'] }
    constructor({ formats }) { configuredFormats = formats }
    async detect() { return [{ rawValue: '' }, { rawValue: '0000123456789' }] }
  }
  const decoder = await createBarcodeDecoder({ Detector, loadReader: async () => { readerLoads += 1 } })
  assert.equal(await decoder.decode({}), '0000123456789')
  assert.deepEqual(configuredFormats, [...FORMATS, 'qr_code'])
  assert.equal(readerLoads, 0)
})

test('missing or partial native support loads ZXing and preserves text', async () => {
  for (const Detector of [undefined, class { static async getSupportedFormats() { return ['qr_code'] } }]) {
    let loads = 0
    const decoder = await createBarcodeDecoder({
      Detector,
      loadReader: async () => { loads += 1; return { decode: () => ({ getText: () => '0000ABC-123' }) } },
    })
    assert.equal(await decoder.decode({}), '0000ABC-123')
    assert.equal(loads, 1)
  }
})

test('native runtime failure switches to ZXing once and ignores ordinary unreadable frames', async () => {
  let nativeCalls = 0
  let loads = 0
  let fallbackCalls = 0
  class Detector {
    static async getSupportedFormats() { return FORMATS }
    async detect() { nativeCalls += 1; throw namedError('NotSupportedError') }
  }
  const decoder = await createBarcodeDecoder({
    Detector,
    loadReader: async () => {
      loads += 1
      return { decode: () => {
        fallbackCalls += 1
        if (fallbackCalls < 4) throw namedError(['NotFoundException', 'ChecksumException', 'FormatException'][fallbackCalls - 1])
        return { getText: () => '000123' }
      } }
    },
  })
  assert.equal(await decoder.decode({}), null)
  assert.equal(await decoder.decode({}), null)
  assert.equal(await decoder.decode({}), null)
  assert.equal(await decoder.decode({}), '000123')
  assert.equal(nativeCalls, 1)
  assert.equal(loads, 1)
})

test('unreadable-frame errors remain nonfatal when production builds minify exception class names', async () => {
  const decoder = await createBarcodeDecoder({
    loadReader: async () => ({ decode: () => {
      const error = namedError('a')
      error.getKind = () => 'NotFoundException'
      throw error
    } }),
  })
  assert.equal(await decoder.decode({}), null)
})

test('rear camera is preferred, audio is off, and detection stops every track exactly once', async () => {
  const h = harness({ createDecoder: async () => ({ decode: async () => '000123ABC' }) })
  await h.scanner.start()
  await flush()
  assert.equal(h.requested[0].audio, false)
  assert.deepEqual(h.requested[0].video.facingMode, { ideal: 'environment' })
  assert.equal(h.video.muted, true)
  assert.equal(h.video.playsInline, true)
  assert.deepEqual(h.detections, ['000123ABC'])
  assert.deepEqual(h.tracks.map((track) => track.stops), [1, 1])
  assert.equal(h.video.srcObject, null)
  assert.equal(h.timers.size, 0)
  h.scanner.stop()
  await h.scanner.start()
  assert.deepEqual(h.detections, ['000123ABC'])
  assert.deepEqual(h.tracks.map((track) => track.stops), [1, 1])
})

test('closing during the permission prompt immediately stops a late stream', async () => {
  const permission = deferred()
  const h = harness()
  h.environment.navigator.mediaDevices.getUserMedia = () => permission.promise
  const started = h.scanner.start()
  h.scanner.stop()
  permission.resolve(h.stream)
  await started
  assert.deepEqual(h.tracks.map((track) => track.stops), [1, 1])
  assert.equal(h.video.srcObject, null)
  assert.equal(h.ready, 0)
  assert.deepEqual(h.detections, [])
  assert.deepEqual(h.errors, [])
})

test('closing during decoder loading stops tracks and cannot begin a late decode', async () => {
  const loading = deferred()
  let decoded = false
  const h = harness({ createDecoder: () => loading.promise })
  const started = h.scanner.start()
  await flush()
  h.scanner.stop()
  loading.resolve({ decode: async () => { decoded = true; return '123' } })
  await started
  assert.equal(decoded, false)
  assert.deepEqual(h.tracks.map((track) => track.stops), [1, 1])
  assert.equal(h.video.srcObject, null)
})

test('an in-flight native result is ignored after closing, with no scan timer restarted', async () => {
  const frame = deferred()
  const h = harness({ createDecoder: async () => ({ decode: () => frame.promise }) })
  await h.scanner.start()
  h.scanner.stop()
  frame.resolve('000123')
  await flush()
  assert.deepEqual(h.detections, [])
  assert.equal(h.timers.size, 0)
  assert.deepEqual(h.tracks.map((track) => track.stops), [1, 1])
})

test('decodes never overlap and stop cancels queued work', async () => {
  const frame = deferred()
  let calls = 0
  const h = harness({ createDecoder: async () => ({ decode: () => { calls += 1; return frame.promise } }) })
  await h.scanner.start()
  assert.equal(calls, 1)
  assert.equal(h.timers.size, 0)
  frame.resolve(null)
  await flush()
  assert.equal(h.timers.size, 1)
  await h.tick()
  assert.equal(calls, 2)
  h.scanner.stop()
  assert.equal(h.timers.size, 0)
})

test('HTTP and missing media APIs fail before requesting camera access', async () => {
  for (const kind of ['http', 'missing-api']) {
    const h = harness()
    if (kind === 'http') h.environment.isSecureContext = false
    else h.environment.navigator = {}
    await h.scanner.start()
    assert.equal(h.requested.length, 0)
    assert.match(h.errors[0], kind === 'http' ? /HTTPS/ : /cannot access a camera/)
  }
})

test('permission-denied and no-camera messages keep manual entry available', async () => {
  for (const [name, expected] of [['NotAllowedError', /permission was denied/], ['NotFoundError', /No camera was found/]]) {
    const h = harness()
    h.environment.navigator.mediaDevices.getUserMedia = async () => { throw namedError(name) }
    await h.scanner.start()
    assert.match(h.errors[0], expected)
    assert.match(h.errors[0], /barcode below/)
    assert.equal(h.timers.size, 0)
  }
})

test('play failure, decoder-load failure, and unexpected decoder failure release camera', async () => {
  for (const kind of ['play', 'load', 'decode']) {
    const h = harness({
      createDecoder: async () => {
        if (kind === 'load') throw new Error('Chunk unavailable')
        return { decode: async () => { throw new Error('Unexpected decode failure') } }
      },
    })
    if (kind === 'play') h.video.play = async () => { throw namedError('NotReadableError') }
    await h.scanner.start()
    await flush()
    assert.equal(h.errors.length, 1)
    assert.deepEqual(h.tracks.map((track) => track.stops), [1, 1])
    assert.equal(h.video.srcObject, null)
    assert.equal(h.timers.size, 0)
  }
})

test('closing cancels a hanging play promise; camera start timeout also releases tracks', async () => {
  for (const kind of ['close', 'timeout']) {
    const h = harness()
    h.video.play = () => new Promise(() => {})
    const started = h.scanner.start()
    await flush()
    if (kind === 'close') h.scanner.stop()
    else h.tick(12000)
    await started
    assert.deepEqual(h.tracks.map((track) => track.stops), [1, 1])
    assert.equal(h.video.srcObject, null)
    assert.equal(h.timers.size, 0)
    assert.equal(h.errors.length, kind === 'close' ? 0 : 1)
  }
})

test('hidden pages, page exits, video errors, and ended tracks stop camera and detach listeners', async () => {
  for (const kind of ['hidden', 'pagehide', 'video', 'track']) {
    const h = harness()
    await h.scanner.start()
    await flush()
    if (kind === 'hidden') {
      h.document.hidden = true
      h.document.dispatchEvent(new Event('visibilitychange'))
    } else if (kind === 'pagehide') h.environment.dispatchEvent(new Event('pagehide'))
    else if (kind === 'video') h.video.dispatchEvent(new Event('error'))
    else h.tracks[0].dispatchEvent(new Event('ended'))
    assert.equal(h.errors.length, 1)
    assert.deepEqual(h.tracks.map((track) => track.stops), [1, 1])
    assert.equal(h.timers.size, 0)
    h.tracks[0].dispatchEvent(new Event('ended'))
    h.video.dispatchEvent(new Event('error'))
    assert.equal(h.errors.length, 1)
  }
})

test('an old scanner cleanup does not clear a newer stream on the same video', async () => {
  const h = harness()
  await h.scanner.start()
  const newerStream = {}
  h.video.srcObject = newerStream
  h.scanner.stop()
  assert.equal(h.video.srcObject, newerStream)
  assert.equal(h.video.pauseCount, 0)
  assert.deepEqual(h.tracks.map((track) => track.stops), [1, 1])
})

test('error text is controlled copy, not arbitrary device or dependency details', () => {
  assert.equal(cameraErrorMessage(new Error('private device details')), cameraErrorMessage())
})

test('installed ZXing fallback reads real EAN-13, leading-zero UPC-A, and alphanumeric Code 128 fixtures', async () => {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const coreModule = await import('@zxing/library')
  const { BinaryBitmap, HybridBinarizer, RGBLuminanceSource } = coreModule.default ?? coreModule
  const left = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
  const even = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
  const parity = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
  function ean13(text) {
    let bars = '101'
    for (let i = 1; i <= 6; i += 1) bars += (parity[text[0]][i - 1] === 'L' ? left : even)[text[i]]
    bars += '01010'
    for (let i = 7; i <= 12; i += 1) bars += [...left[text[i]]].map((bit) => bit === '1' ? '0' : '1').join('')
    return bars + '101'
  }
  // Code set B: start, "00AB-123", checksum 8, stop. These fixed module
  // widths encode a real barcode rather than mocking a decoded result.
  const code128 = ['211214', '123122', '123122', '111323', '131123', '122132', '123221', '223211', '221132', '132212', '2331112']
    .map((widths) => [...widths].map((width, index) => (index % 2 === 0 ? '1' : '0').repeat(Number(width))).join('')).join('')
  const fixtures = [
    [ean13('5901234123457'), '5901234123457'],
    [ean13('0012345678905'), '012345678905'], // UPC-A has 12 digits, including its leading zero.
    [code128, '00AB-123'],
  ]
  for (const [bars, expected] of fixtures) {
    const modules = '0'.repeat(12) + bars + '0'.repeat(12)
    const width = modules.length * 3
    const height = 100
    const pixels = new Uint8ClampedArray(width * height).fill(255)
    for (let y = 8; y < height - 8; y += 1) {
      for (let x = 0; x < width; x += 1) pixels[y * width + x] = modules[Math.floor(x / 3)] === '1' ? 0 : 255
    }
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height)))
    const reader = new BrowserMultiFormatReader()
    const decoder = await createBarcodeDecoder({ loadReader: async () => ({ decode: () => reader.decodeBitmap(bitmap) }) })
    assert.equal(await decoder.decode({}), expected)
  }
})
