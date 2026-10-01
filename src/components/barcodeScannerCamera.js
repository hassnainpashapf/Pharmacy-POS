// Camera ownership stays here rather than in the decoder, so late permission
// responses and async detections cannot keep a closed scanner's camera alive.
const REQUIRED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
const EXTRA_FORMATS = ['code_39', 'code_93', 'codabar', 'itf', 'data_matrix', 'qr_code', 'pdf417', 'aztec']
const EXPECTED_DECODE_ERRORS = new Set(['NotFoundException', 'ChecksumException', 'FormatException'])

export function isBarcodeText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function cameraErrorMessage(error) {
  switch (error?.name) {
    case 'InsecureContextError':
      return 'Camera scanning requires HTTPS. Open this page using its secure HTTPS address, or enter the barcode below.'
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Camera permission was denied. Allow camera access in your browser settings, then try again, or enter the barcode below.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device. Enter the barcode below.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is busy or unavailable. Close other apps using it and try again, or enter the barcode below.'
    case 'CameraUnsupportedError':
      return 'This browser cannot access a camera. Try Safari or Chrome, or enter the barcode below.'
    case 'CameraPausedError':
      return 'The camera was paused because this page was hidden. Tap Try camera again to resume, or enter the barcode below.'
    case 'CameraEndedError':
      return 'The camera disconnected or was interrupted. Try again, or enter the barcode below.'
    case 'CameraTimeoutError':
      return 'The camera did not start. Try camera again, or enter the barcode below.'
    case 'OverconstrainedError':
      return 'The camera could not use the requested settings. Try another browser, or enter the barcode below.'
    default:
      return 'Camera scanning could not start or was interrupted. Try again, or enter the barcode below.'
  }
}

function scannerError(name) {
  const error = new Error(name)
  error.name = name
  return error
}

function stopTracks(stream) {
  stream?.getTracks().forEach((track) => {
    try { track.stop() } catch { /* Continue releasing the remaining tracks. */ }
  })
}

async function loadZXingReader() {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  return new BrowserMultiFormatReader()
}

// Exported separately for focused tests without needing real camera hardware.
export async function createBarcodeDecoder({ Detector, loadReader = loadZXingReader } = {}) {
  let nativeDetector
  let reader

  if (Detector) {
    try {
      const supported = await Detector.getSupportedFormats()
      if (REQUIRED_FORMATS.every((format) => supported.includes(format))) {
        nativeDetector = new Detector({
          formats: [...REQUIRED_FORMATS, ...EXTRA_FORMATS].filter((format) => supported.includes(format)),
        })
      }
    } catch { /* Some browsers expose BarcodeDetector without a usable implementation. */ }
  }

  if (!nativeDetector) reader = await loadReader()

  return {
    async decode(video) {
      if (nativeDetector) {
        try {
          const results = await nativeDetector.detect(video)
          return results.find((result) => isBarcodeText(result.rawValue))?.rawValue ?? null
        } catch {
          // A native implementation can fail at runtime; switch just once.
          nativeDetector = null
          reader = await loadReader()
        }
      }

      try {
        return reader.decode(video)?.getText() ?? null
      } catch (error) {
        // Unreadable frames are normal while aiming, not camera failures.
        // ZXing's stable kind also survives production class-name minification.
        if (EXPECTED_DECODE_ERRORS.has(error?.getKind?.()) || EXPECTED_DECODE_ERRORS.has(error?.name) || EXPECTED_DECODE_ERRORS.has(error?.constructor?.name)) return null
        throw error
      }
    },
  }
}

export function createCameraScanner({
  video,
  onDetected,
  onError,
  onReady = () => {},
  environment = globalThis,
  createDecoder = createBarcodeDecoder,
}) {
  let started = false
  let stopped = false
  let stream
  let timer
  let playTimer
  let cancelPlay
  let decoder
  let firstFrameDeadline
  const unsubscribers = []

  function stop() {
    if (stopped) return
    stopped = true
    environment.clearTimeout(timer)
    environment.clearTimeout(playTimer)
    cancelPlay?.()
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe())
    stopTracks(stream)
    // Never detach a newer scanner's stream (including React StrictMode remounts).
    if (stream && video.srcObject === stream) {
      try { video.pause() } catch { /* Track cleanup must still complete. */ }
      video.srcObject = null
    }
  }

  function fail(error) {
    if (stopped) return
    stop()
    onError(cameraErrorMessage(error))
  }

  function listen(target, type, listener) {
    target?.addEventListener(type, listener)
    if (target) unsubscribers.push(() => target.removeEventListener(type, listener))
  }

  async function scanFrame() {
    if (stopped) return
    let text
    try {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        firstFrameDeadline = null
        text = await decoder.decode(video)
      } else if (firstFrameDeadline && Date.now() > firstFrameDeadline) {
        throw scannerError('CameraTimeoutError')
      }
    } catch (error) {
      fail(error)
      return
    }
    if (stopped) return
    if (isBarcodeText(text)) {
      stop()
      onDetected(text)
      return
    }
    // Serial decoding avoids overlapping native promises and limits CPU use.
    timer = environment.setTimeout(scanFrame, 160)
  }

  async function start() {
    if (started || stopped) return
    started = true
    try {
      if (!environment.isSecureContext) throw scannerError('InsecureContextError')
      if (!environment.navigator?.mediaDevices?.getUserMedia) throw scannerError('CameraUnsupportedError')

      const acquired = await environment.navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      if (stopped) {
        stopTracks(acquired)
        return
      }
      stream = acquired
      stream.getTracks().forEach((track) => listen(track, 'ended', () => fail(scannerError('CameraEndedError'))))
      listen(video, 'error', () => fail(scannerError('NotReadableError')))
      listen(environment.document, 'visibilitychange', () => {
        if (environment.document.hidden) fail(scannerError('CameraPausedError'))
      })
      listen(environment, 'pagehide', () => fail(scannerError('CameraPausedError')))
      if (environment.document?.hidden) throw scannerError('CameraPausedError')

      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      await new Promise((resolve, reject) => {
        cancelPlay = () => reject(scannerError('AbortError'))
        playTimer = environment.setTimeout(() => reject(scannerError('CameraTimeoutError')), 12000)
        Promise.resolve(video.play()).then(resolve, reject)
      })
      environment.clearTimeout(playTimer)
      cancelPlay = null
      if (stopped) return
      decoder = await createDecoder({ Detector: environment.BarcodeDetector })
      if (stopped) return
      firstFrameDeadline = Date.now() + 12000
      onReady()
      void scanFrame()
    } catch (error) {
      fail(error)
    }
  }

  return { start, stop }
}
