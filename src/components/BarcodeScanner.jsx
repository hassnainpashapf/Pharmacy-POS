import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Keyboard, ScanLine, X } from 'lucide-react'
import { createCameraScanner, isBarcodeText } from './barcodeScannerCamera.js'

export default function BarcodeScanner({ onDetected, onClose }) {
  const titleId = useId()
  const hintId = useId()
  const inputId = useId()
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const inputRef = useRef(null)
  const videoRef = useRef(null)
  const cameraRef = useRef(null)
  const settledRef = useRef(false)
  const callbacksRef = useRef({ onDetected, onClose })
  callbacksRef.current = { onDetected, onClose }
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState('starting')
  const [error, setError] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [manualError, setManualError] = useState('')

  function close() {
    settledRef.current = true
    cameraRef.current?.stop()
    callbacksRef.current.onClose?.()
  }

  function accept(text) {
    if (settledRef.current || !isBarcodeText(text)) return
    settledRef.current = true
    cameraRef.current?.stop()
    setStatus('detected')
    callbacksRef.current.onDetected(text)
  }

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? [])]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first) return
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus?.()
    }
  }, [])

  useEffect(() => {
    if (!cameraEnabled || settledRef.current) return
    setStatus('starting')
    setError('')
    const scanner = createCameraScanner({
      video: videoRef.current,
      onDetected: accept,
      onReady: () => setStatus('scanning'),
      onError: (message) => {
        setError(message)
        setStatus('error')
      },
    })
    cameraRef.current = scanner
    void scanner.start()
    return () => scanner.stop()
  }, [cameraEnabled, attempt])

  function useManualEntry() {
    cameraRef.current?.stop()
    setCameraEnabled(false)
    setStatus('manual')
    setError('')
    inputRef.current?.focus()
  }

  function retryCamera() {
    if (settledRef.current) return
    setCameraEnabled(true)
    setAttempt((value) => value + 1)
  }

  function submitManual(event) {
    event.preventDefault()
    // Keep text as text: leading zeros and Code 128 letters are significant.
    const text = manualCode.trim()
    if (!isBarcodeText(text)) {
      setManualError('Enter the barcode printed on the medicine packaging.')
      inputRef.current?.focus()
      return
    }
    setManualError('')
    accept(text)
  }

  const detected = status === 'detected'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-3xl border border-purple-100 bg-white text-slate-900 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-purple-100 p-5">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
              <ScanLine aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold">Scan medicine barcode</h2>
              <p id={hintId} className="mt-1 text-sm text-slate-600">Point the rear camera at the barcode on the pack.</p>
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={close} aria-label="Close barcode scanner" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-600">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-950">
            <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview for barcode scanning" className="h-full w-full object-contain" />
            {status === 'scanning' && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-7 inset-y-[30%] rounded-xl border-2 border-teal-300 shadow-[0_0_0_999px_rgba(15,23,42,0.15)]" />
            )}
            {status !== 'scanning' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-white">
                <Camera aria-hidden="true" className="h-9 w-9 text-teal-300" />
                <p className="text-sm">{status === 'starting' ? 'Starting camera… Allow camera access when prompted.' : detected ? 'Barcode captured' : 'Camera is off. You can enter the barcode below.'}</p>
              </div>
            )}
          </div>

          <p role="status" aria-live="polite" className="text-center text-sm text-slate-600">
            {status === 'scanning' ? 'Hold steady in good light. Keep the whole barcode visible.' : detected ? 'Barcode captured. Returning it to the form…' : 'EAN, UPC, Code 128 and other common medicine barcodes.'}
          </p>

          {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}

          {!detected && (
            <div className="flex flex-wrap gap-2">
              {cameraEnabled && status !== 'error' ? (
                <button type="button" onClick={useManualEntry} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-purple-200 px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-600">
                  <Keyboard aria-hidden="true" className="h-4 w-4" /> Use manual entry
                </button>
              ) : (
                <button type="button" onClick={retryCamera} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-purple-200 px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-600">
                  <Camera aria-hidden="true" className="h-4 w-4" /> Try camera again
                </button>
              )}
            </div>
          )}

          <form onSubmit={submitManual} className="space-y-3 border-t border-slate-100 pt-4">
            <label htmlFor={inputId} className="block text-sm font-semibold text-slate-800">Enter barcode manually</label>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={manualCode}
              onChange={(event) => { setManualCode(event.target.value); setManualError('') }}
              onFocus={() => { if (cameraEnabled && !settledRef.current) useManualEntry() }}
              disabled={detected}
              aria-invalid={Boolean(manualError)}
              aria-describedby={manualError ? `${inputId}-error` : `${inputId}-help`}
              placeholder="e.g. 0012345678905"
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-mono text-base text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:bg-slate-100"
            />
            <p id={`${inputId}-help`} className="text-xs text-slate-500">Include all digits, including leading zeros. Scanning only fills a barcode; review the medicine details before saving.</p>
            {manualError && <p id={`${inputId}-error`} role="alert" className="text-sm text-red-700">{manualError}</p>}
            <button type="submit" disabled={detected} className="min-h-12 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50">Use this barcode</button>
          </form>
        </div>
      </section>
    </div>,
    document.body,
  )
}
