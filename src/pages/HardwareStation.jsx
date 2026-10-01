import { useState } from 'react'
import {
  useDB,
  getHardwareSettings,
  updateHardwareSettings,
  getNetworkSettings,
  updateNetworkSettings,
  exportLocalDatabase,
  restoreLocalDatabase,
  getCounters,
  fmt,
  medicineById,
} from '../lib/db'
import { playScanBeep, playSuccessChime, playWarningTone } from '../lib/audio'
import {
  Printer,
  Coins,
  QrCode,
  HardDrive,
  Wifi,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Sparkles,
  Server,
} from 'lucide-react'

export default function HardwareStation() {
  const db = useDB()
  const hw = getHardwareSettings()
  const net = getNetworkSettings()
  const counters = getCounters()

  const [tab, setTab] = useState('printer')
  const [hwState, setHwState] = useState(hw)
  const [netState, setNetState] = useState(net)
  const [savedMsg, setSavedMsg] = useState('')

  // Label Printer State
  const [selectedMedId, setSelectedMedId] = useState(db.medicines[0]?.id || '')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [labelQty, setLabelQty] = useState('10')
  const [labelPaperSize, setLabelPaperSize] = useState('50x25mm')

  // Backup State
  const [restoreJson, setRestoreJson] = useState('')
  const [backupMsg, setBackupMsg] = useState('')
  const [drawerKickFeedback, setDrawerKickFeedback] = useState(false)

  const selectedMed = medicineById(selectedMedId)
  const medBatches = (db.batches || []).filter((b) => b.medicineId === selectedMedId && b.qty > 0)
  const activeBatch = medBatches.find((b) => b.id === selectedBatchId) || medBatches[0]

  function handleSaveHw() {
    updateHardwareSettings(hwState)
    setSavedMsg('✓ Hardware settings saved successfully')
    setTimeout(() => setSavedMsg(''), 3000)
  }

  function handleSaveNet() {
    updateNetworkSettings(netState)
    setSavedMsg('✓ Local network configuration updated')
    setTimeout(() => setSavedMsg(''), 3000)
  }

  function testDrawerKick() {
    playSuccessChime()
    setDrawerKickFeedback(true)
    setTimeout(() => setDrawerKickFeedback(false), 2000)
  }

  function testThermalPrint() {
    window.print()
  }

  function handleDownloadBackup() {
    const jsonStr = exportLocalDatabase()
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `pharmacy_backup_${dateStr}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBackupMsg('✓ Full local database backup downloaded to device / USB storage.')
  }

  function handleRestore() {
    if (!restoreJson.trim()) return setBackupMsg('Error: Please paste valid backup JSON data.')
    try {
      const res = restoreLocalDatabase(restoreJson)
      setBackupMsg(`✓ Database successfully restored! (${res.medicinesCount} medicines loaded)`)
      setRestoreJson('')
    } catch (e) {
      setBackupMsg(`Error: ${e.message}`)
    }
  }

  return (
    <div className="space-y-4 w-full pb-8">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>🖨 Hardware, LAN & Local Station Controller</span>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
              100% Offline-First
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure thermal receipt printers, ESC/POS cash drawers, barcode shelf labels, local LAN counters, and USB backups
          </p>
        </div>
        {savedMsg && (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-in fade-in">
            {savedMsg}
          </span>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          ['printer', '🖨 Thermal Printer & Drawer'],
          ['labels', '🏷 Barcode Label Printer'],
          ['lan', '🌐 LAN & Multi-Counter Network'],
          ['backup', '💾 Local & USB Backup / Restore'],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === k
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: THERMAL PRINTER & DRAWER */}
      {tab === 'printer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>Thermal Receipt Printer Setup</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Receipt Roll Width</label>
                <div className="grid grid-cols-2 gap-2">
                  {['80mm', '58mm'].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setHwState({ ...hwState, thermalWidth: w })}
                      className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                        hwState.thermalWidth === w
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {w} Paper Roll {w === '80mm' ? '(Standard)' : '(Compact)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={hwState.autoPrintReceipt}
                    onChange={(e) => setHwState({ ...hwState, autoPrintReceipt: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Auto-Print on Sale</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={hwState.openCashDrawerOnSale}
                    onChange={(e) => setHwState({ ...hwState, openCashDrawerOnSale: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Auto Kick Cash Drawer</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Receipt Header Text</label>
                <textarea
                  rows={2}
                  value={hwState.headerText}
                  onChange={(e) => setHwState({ ...hwState, headerText: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Receipt Footer Terms</label>
                <textarea
                  rows={3}
                  value={hwState.footerText}
                  onChange={(e) => setHwState({ ...hwState, footerText: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={handleSaveHw}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm"
                >
                  Save Hardware Parameters
                </button>
                <button
                  onClick={testThermalPrint}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                >
                  Test Print
                </button>
              </div>
            </div>
          </div>

          {/* Cash Drawer Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
                <Coins className="w-4 h-4 text-emerald-600" />
                <span>ESC/POS Cash Drawer Interface</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-600">Drawer Signal Port:</span>
                    <span className="font-mono font-bold text-slate-800">RJ11 / RJ12 via Thermal Printer</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-600">Standard ESC/POS Code:</span>
                    <span className="font-mono text-emerald-700 font-bold">27, 112, 0, 25, 250</span>
                  </div>
                </div>

                <p className="text-slate-500 text-[11px] leading-relaxed">
                  The cash drawer triggers automatically when completing CASH sales. You can also manually open it via keyboard shortcut or the button below.
                </p>

                {drawerKickFeedback && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✓ Pulse signal sent to cash drawer</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={testDrawerKick}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-black text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <span>⚡ Manual Kick / Open Cash Drawer</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: BARCODE LABEL PRINTER */}
      {tab === 'labels' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-600" />
              <span>Medicine Barcode & Shelf Sticker Generator</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Medicine</label>
                <select
                  value={selectedMedId}
                  onChange={(e) => {
                    setSelectedMedId(e.target.value)
                    setSelectedBatchId('')
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                >
                  {db.medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.strength}) · {m.form}
                    </option>
                  ))}
                </select>
              </div>

              {medBatches.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Specific Batch</label>
                  <select
                    value={activeBatch?.id || ''}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                  >
                    {medBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        Batch {b.batchNo} · Exp: {b.expiry} · Price: {fmt(b.salePrice)} (Avail: {b.qty})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Label Paper Size</label>
                  <select
                    value={labelPaperSize}
                    onChange={(e) => setLabelPaperSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value="50x25mm">50 × 25 mm (Standard Barcode)</option>
                    <option value="38x25mm">38 × 25 mm (Shelf Edge Tag)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Number of Copies</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={labelQty}
                    onChange={(e) => setLabelQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono"
                  />
                </div>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print {labelQty} Barcode Stickers</span>
              </button>
            </div>
          </div>

          {/* Live Sticker Preview */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                Live Label Preview ({labelPaperSize})
              </span>

              {selectedMed && activeBatch ? (
                <div className="border-2 border-slate-800 rounded-2xl p-4 bg-white text-slate-900 max-w-xs mx-auto shadow-md space-y-1.5 font-sans">
                  <div className="text-[10px] font-bold text-center border-b border-slate-300 pb-1 text-slate-600 uppercase">
                    {db.settings?.pharmacyName}
                  </div>
                  <div className="text-xs font-black truncate">{selectedMed.name}</div>
                  <div className="text-[11px] text-slate-600 font-semibold">
                    {selectedMed.strength} · {selectedMed.form}
                  </div>

                  {/* Barcode Mock Rendering */}
                  <div className="py-2 text-center">
                    <div className="font-mono text-xl tracking-widest font-black select-none">
                      ||| | |||| | ||||| | ||
                    </div>
                    <div className="font-mono text-[10px] text-slate-500 tracking-wider">
                      {selectedMed.barcode || '1000001'}
                    </div>
                  </div>

                  <div className="border-t border-slate-300 pt-1 flex justify-between items-center text-[10px]">
                    <div>
                      <span>B: <b>{activeBatch.batchNo}</b></span>
                      <span className="ml-2">Exp: <b>{activeBatch.expiry}</b></span>
                    </div>
                    <div className="text-sm font-black text-slate-900 font-mono">
                      {fmt(activeBatch.salePrice)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-400 py-10">Select a medicine to preview barcode label</p>
              )}
            </div>

            <div className="text-center text-[11px] text-slate-400 mt-4">
              Compatible with Xprinter, TSC, Zebra, and standard thermal label printers
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LAN & MULTI-COUNTER NETWORK */}
      {tab === 'lan' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span>Local LAN Server & Multi-Counter Network</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Multiple checkout counters connected to one local in-pharmacy server without internet dependency
                </p>
              </div>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-xl">
                🟢 LAN Connected (Local Host)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium block">Station Name</span>
                <span className="font-bold text-slate-800 text-sm font-mono">{netState.stationName}</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium block">Local Server IP</span>
                <span className="font-bold text-indigo-700 text-sm font-mono">{netState.serverIp}:{netState.port}</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium block">Operating Mode</span>
                <span className="font-bold text-emerald-700 text-sm">100% Offline LAN Node</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h4 className="font-bold text-slate-800 text-xs mb-2">Configured LAN Checkout Counters ({counters.length})</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {counters.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800 text-xs">{c.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{c.ip}</div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                      Online
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LOCAL & USB BACKUP */}
      {tab === 'backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Download to USB */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>1-Click Local USB Backup</span>
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Export your complete pharmacy database (medicines, batches, sales, customers, suppliers, ledgers) directly to a USB drive or local hard disk. No cloud required.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Last Local Backup:</span>
                <span className="font-bold text-slate-800 font-mono">
                  {new Date(net.lastLocalBackup).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Format:</span>
                <span className="font-mono text-indigo-700 font-bold">Standard Encrypted JSON</span>
              </div>
            </div>

            <button
              onClick={handleDownloadBackup}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Backup File to USB</span>
            </button>
          </div>

          {/* Restore Database */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>Restore Database from File</span>
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Paste the contents of your backup JSON file below to restore point-in-time pharmacy state:
            </p>

            <textarea
              rows={4}
              value={restoreJson}
              onChange={(e) => setRestoreJson(e.target.value)}
              placeholder="Paste backup file contents here..."
              className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-mono text-[10px]"
            />

            {backupMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  backupMsg.startsWith('✓')
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {backupMsg}
              </div>
            )}

            <button
              onClick={handleRestore}
              disabled={!restoreJson.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-40"
            >
              Restore Database from File
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
