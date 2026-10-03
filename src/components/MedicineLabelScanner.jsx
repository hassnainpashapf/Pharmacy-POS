import { useEffect, useRef, useState } from 'react'
import { parseMedicineLabel, labelRetailPrice } from '../lib/medicineLabel'

const inputStyle = 'block w-full border border-slate-300 rounded-xl p-3 mt-1 bg-white text-sm'

// Photos remain in browser memory; only reviewed fields are returned to the
// inventory form. Local OCR worker/model assets never receive an image upload.
export default function MedicineLabelScanner({ medicines = [], onReviewed, onClose }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [name, setName] = useState('')
  const [printed, setPrinted] = useState('')
  const [basis, setBasis] = useState('')
  const [units, setUnits] = useState('')
  const [existingId, setExistingId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const workerRef = useRef(null)
  const generation = useRef(0)
  const guard = useRef(false)
  useEffect(() => () => {
    generation.current++
    workerRef.current?.terminate().catch(() => {})
    workerRef.current = null
  }, [])
  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function choose(event) {
    const selected = event.target.files?.[0]
    if (!selected) return
    setError('')
    if (!selected.type.startsWith('image/') || selected.size > 15 * 1024 * 1024) {
      setError('Choose a clear image smaller than 15 MB. JPEG or PNG works best.'); return
    }
    setFile(selected); setCandidates(null); setText(''); setName(''); setPrinted(''); setBasis(''); setUnits(''); setExistingId(''); setConfirmed(false)
  }

  async function scan() {
    if (!file || guard.current) return
    guard.current = true
    const run = ++generation.current
    setBusy(true); setError(''); setCandidates(null); setConfirmed(false)
    let worker
    try {
      const { createWorker } = await import('tesseract.js')
      if (run !== generation.current) return
      worker = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js', corePath: '/ocr/tesseract-core-lstm.wasm.js',
        langPath: '/ocr', workerBlobURL: false,
        logger: event => { if (run === generation.current) setProgress(`${event.status || 'Reading label'} ${Math.round((event.progress || 0) * 100)}%`) },
      })
      if (run !== generation.current) return
      workerRef.current = worker
      const result = await worker.recognize(file)
      if (run !== generation.current) return
      const raw = result.data.text || ''
      const parsed = parseMedicineLabel(raw)
      setText(raw); setCandidates(parsed)
      setName(parsed.names[0] || ''); setPrinted(parsed.prices.length === 1 ? String(parsed.prices[0].value) : '')
      if (!raw.trim()) setError('No readable text found. Retake a closer, well-lit photo or type the medicine details.')
    } catch (failure) {
      if (run === generation.current) setError('Unable to read this photo. Try a clear JPEG/PNG, reconnect to load the OCR engine, or enter details manually.')
    } finally {
      if (worker) await worker.terminate().catch(() => {})
      if (workerRef.current === worker) workerRef.current = null
      if (run === generation.current) { setBusy(false); setProgress(''); guard.current = false }
    }
  }

  function review(event) {
    event.preventDefault()
    if (!confirmed || !name.trim() || busy) return
    try {
      const salePrice = labelRetailPrice(printed, basis, units)
      onReviewed({ medicineId: existingId, draft: { name: name.trim(), salePrice, purchasePrice: '', strength: candidates?.strength || '', form: candidates?.form || '' } })
    } catch (failure) { setError(failure.message) }
  }

  return <div className="fixed inset-0 z-[100] bg-black/50 p-3 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="label-scan-title" onKeyDown={event => { if (event.key === 'Escape') onClose() }}>
    <section className="mx-auto my-4 max-w-xl rounded-2xl bg-white p-5 space-y-4 shadow-xl">
      <div className="flex justify-between gap-3"><h2 id="label-scan-title" className="text-xl font-bold">Scan medicine name & price</h2><button type="button" onClick={onClose} className="p-2 border rounded-xl" aria-label="Close label scanner">✕</button></div>
      <p className="text-sm">Photograph the printed name and price on the box/strip, not its barcode. English/Latin text is supported. OCR can misread brand, strength and decimal points—verify against the actual pack.</p>
      <p className="text-xs text-slate-600">Processed on this device. Photos are not uploaded or saved. This is text reading, not medicine identification or clinical verification.</p>
      <label className="block font-semibold text-sm">Take a photo / choose label image<input className={inputStyle} type="file" accept="image/*" capture="environment" disabled={busy} onChange={choose} /></label>
      {preview && <img src={preview} alt="Medicine label to review" className="max-h-64 w-full object-contain rounded-xl border" />}
      <button type="button" disabled={!file || busy} onClick={scan} className="w-full p-3 bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white rounded-xl font-bold disabled:opacity-50 cursor-pointer transition-all">{busy ? 'Reading printed text…' : 'Read name & printed price'}</button>
      {busy && <p role="status" className="text-sm">{progress} — first load may take a moment.</p>}
      {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-800 text-sm">{error}</p>}
      {candidates && <form onSubmit={review} className="space-y-4">
        <details><summary className="cursor-pointer text-sm font-semibold">See all recognised text</summary><pre className="text-xs whitespace-pre-wrap max-h-48 overflow-auto bg-slate-50 p-3">{text || 'No readable text'}</pre></details>
        <label className="block text-sm font-semibold">Medicine name — verify / edit<input className={inputStyle} list="ocr-name-candidates" required maxLength={200} value={name} onChange={event => { setName(event.target.value); setConfirmed(false) }} /><datalist id="ocr-name-candidates">{candidates.names.map((item, index) => <option key={index} value={item} />)}</datalist></label>
        <label className="block text-sm font-semibold">Use existing medicine (choose only an exact verified match)<select className={inputStyle} value={existingId} onChange={event => { setExistingId(event.target.value); setConfirmed(false) }}><option value="">Create new medicine after review</option>{medicines.filter(medicine => name.trim() && `${medicine.name} ${medicine.strength}`.toLowerCase().includes(name.trim().toLowerCase())).map(medicine => <option key={medicine.id} value={medicine.id}>{medicine.name} · {medicine.strength} · {medicine.form}</option>)}</select></label>
        <label className="block text-sm font-semibold">Printed retail / MRP (Rs), optional<input className={inputStyle} type="number" min="0" max="10000000" step="0.01" list="ocr-prices" value={printed} onChange={event => { setPrinted(event.target.value); setConfirmed(false) }} /><datalist id="ocr-prices">{candidates.prices.map(item => <option key={item.value} value={item.value}>{item.line}</option>)}</datalist></label>
        <p className="text-sm">This is not the pharmacy buying price. Enter your actual purchase price in the next form. If the price is not readable, leave it blank and enter it yourself.</p>
        {printed !== '' && <><label className="block text-sm font-semibold">This printed price covers<select required className={inputStyle} value={basis} onChange={event => { setBasis(event.target.value); setConfirmed(false) }}><option value="">Choose price basis</option><option value="unit">One stock unit</option><option value="pack">A pack / strip containing several stock units</option></select></label>{basis === 'pack' && <label className="block text-sm font-semibold">How many stock units does this price cover?<input className={inputStyle} type="number" min="1" max="1000000" step="1" required value={units} onChange={event => { setUnits(event.target.value); setConfirmed(false) }} /></label>}</>}
        <label className="flex gap-3 text-sm"><input type="checkbox" checked={confirmed} required onChange={event => setConfirmed(event.target.checked)} /><span>I verified the medicine name and price against its packaging. I will check strength, form, batch and expiry before stock entry.</span></label>
        <button disabled={!confirmed} className="w-full p-3 bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white rounded-xl font-bold disabled:opacity-50 cursor-pointer transition-all">Use reviewed details — not saved yet</button>
      </form>}
    </section>
  </div>
}
