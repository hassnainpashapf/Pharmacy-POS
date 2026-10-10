import { useState, useMemo } from 'react'
import {
  useDB,
  getCurrentShift,
  startShift,
  closeShift,
  getShiftHistory,
  generateZReport,
  getCounters,
  activeCounter,
  setActiveCounter,
  fmt,
} from '../lib/db'
import DateFilterBar, { matchesDateFilter, useDateFilterState } from './DateFilterBar'
import {
  Clock,
  Coins,
  Receipt,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  History,
  X,
  PlusCircle,
  Building,
  DollarSign,
  Search,
} from 'lucide-react'

export default function ShiftModal({ isOpen, onClose }) {
  if (!isOpen) return null
  const db = useDB()
  const currentShift = getCurrentShift()
  const counters = getCounters()
  const history = getShiftHistory()
  const [shiftDateFilter, setShiftDateFilter] = useDateFilterState('all')
  const [shiftSearch, setShiftSearch] = useState('')
  const filteredHistory = useMemo(() => {
    let list = history.filter((s) => matchesDateFilter(s.openedAt || s.date, shiftDateFilter))
    if (shiftSearch.trim()) {
      const q = shiftSearch.toLowerCase()
      list = list.filter((s) =>
        (s.shiftNo && s.shiftNo.toLowerCase().includes(q)) ||
        (s.counterName && s.counterName.toLowerCase().includes(q)) ||
        (s.cashierName && s.cashierName.toLowerCase().includes(q))
      )
    }
    return list
  }, [history, shiftDateFilter, shiftSearch])

  const [activeTab, setActiveTab] = useState(currentShift ? 'active' : 'start')
  const [selectedCounter, setSelectedCounter] = useState(activeCounter())
  const [openingFloat, setOpeningFloat] = useState('5000')
  const [shiftNotes, setShiftNotes] = useState('')
  const [declaredCash, setDeclaredCash] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [zReportData, setZReportData] = useState(null)
  const [err, setErr] = useState('')

  function handleStartShift() {
    setErr('')
    try {
      startShift({
        counterId: selectedCounter,
        openingCash: Number(openingFloat || 0),
        notes: shiftNotes,
      })
      setActiveCounter(selectedCounter)
      setActiveTab('active')
    } catch (e) {
      setErr(e.message)
    }
  }

  function handleCloseShift() {
    setErr('')
    if (declaredCash === '') {
      return setErr('Please count and declare the actual physical cash counted in drawer.')
    }
    try {
      const z = generateZReport(currentShift.id)
      const closed = closeShift({
        shiftId: currentShift.id,
        closingCashDeclared: Number(declaredCash),
        notes: closingNotes,
      })
      // Attach declared values to zReport
      z.cashReconciliation.declaredCash = closed.closingCashDeclared
      z.cashReconciliation.variance = closed.difference
      z.cashReconciliation.isBalanced = Math.abs(closed.difference) < 0.01
      setZReportData(z)
      setActiveTab('zreport')
    } catch (e) {
      setErr(e.message)
    }
  }

  function printZReport() {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Cashier Shift & Drawer Control</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full">
                  LAN Multi-Counter
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Opening float, live transaction reconciliation formula, and Day-End Z-Report
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-bold shrink-0">
          {currentShift ? (
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-2.5 px-3 border-b-2 transition-all ${
                activeTab === 'active'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🟢 Active Shift ({currentShift.shiftNo})
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('start')}
              className={`pb-2.5 px-3 border-b-2 transition-all ${
                activeTab === 'start'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              ⚡ Start New Shift
            </button>
          )}

          {currentShift && (
            <button
              onClick={() => setActiveTab('close')}
              className={`pb-2.5 px-3 border-b-2 transition-all ${
                activeTab === 'close'
                  ? 'border-rose-600 text-rose-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🔒 Close Shift
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📋 Shift History ({history.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scroll text-xs space-y-4">
          {err && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* TAB: ACTIVE SHIFT */}
          {activeTab === 'active' && currentShift && (
            <div className="space-y-4">
              {/* Shift Overview Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold block">Shift Number</span>
                  <span className="text-sm font-extrabold text-slate-800 font-mono">{currentShift.shiftNo}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold block">POS Counter</span>
                  <span className="text-sm font-extrabold text-indigo-700">{currentShift.counterName}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold block">Active Cashier</span>
                  <span className="text-sm font-extrabold text-slate-800">{currentShift.cashierName}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-semibold block">Opened At</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    {new Date(currentShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Exact Formula Card */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="font-extrabold text-sm flex items-center gap-2 text-indigo-200">
                    <Coins className="w-4 h-4 text-emerald-400" />
                    <span>Real-Time Cash Drawer Reconciliation</span>
                  </h3>
                  <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                    LIVE RECONCILED
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>1. Opening Cash Float</span>
                    <span className="font-mono font-bold text-white">{fmt(currentShift.openingCash)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>2. + Cash Sales Revenue</span>
                    <span className="font-mono font-bold">+{fmt(currentShift.cashSales)}</span>
                  </div>
                  <div className="flex justify-between items-center text-teal-300">
                    <span>3. + Customer Debt Collections</span>
                    <span className="font-mono font-bold">+{fmt(currentShift.customerPayments)}</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-300">
                    <span>4. - Daily Operating Expenses</span>
                    <span className="font-mono font-bold">-{fmt(currentShift.expenses)}</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-300">
                    <span>5. - Supplier Cash Paid</span>
                    <span className="font-mono font-bold">-{fmt(currentShift.supplierPayments)}</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-300">
                    <span>6. - Customer Cash Refunds</span>
                    <span className="font-mono font-bold">-{fmt(currentShift.refunds)}</span>
                  </div>
                </div>

                <div className="border-t border-white/20 pt-3 flex justify-between items-center">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-200 block">EXPECTED CASH IN DRAWER</span>
                    <span className="text-[10px] text-slate-400">Formula: Float + Sales + Debt - Exp - Sup - Refunds</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight">
                    {fmt(currentShift.closingCashCalculated)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    const z = generateZReport(currentShift.id)
                    setZReportData(z)
                    setActiveTab('zreport')
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors inline-flex items-center gap-1.5"
                >
                  <Receipt className="w-4 h-4" /> Preview Z-Report
                </button>
                <button
                  onClick={() => setActiveTab('close')}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors shadow-sm inline-flex items-center gap-1.5"
                >
                  🔒 Close Current Shift
                </button>
              </div>
            </div>
          )}

          {/* TAB: START NEW SHIFT */}
          {activeTab === 'start' && (
            <div className="space-y-4 max-w-lg mx-auto py-2">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 font-bold text-xl">
                  ⚡
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Start Cashier Shift</h3>
                <p className="text-xs text-slate-500">
                  Select your physical POS counter and count your initial cash float before billing
                </p>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select POS Counter</label>
                  <select
                    value={selectedCounter}
                    onChange={(e) => setSelectedCounter(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                  >
                    {counters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.ip})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Opening Cash Float (Physical Cash in Drawer)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-1.5 mt-1.5">
                    {[2000, 5000, 10000, 15000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setOpeningFloat(String(v))}
                        className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold hover:bg-slate-300"
                      >
                        +{v.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shift Notes (Optional)</label>
                  <input
                    type="text"
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    placeholder="e.g. Morning counter opening, verified with manager"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                onClick={handleStartShift}
                className="w-full bg-o-blue hover:bg-o-blue-d active:bg-o-blue-d border border-o-blue-d text-white py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>⚡ Open Shift & Unlock POS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB: CLOSE SHIFT */}
          {activeTab === 'close' && currentShift && (
            <div className="space-y-4 max-w-lg mx-auto py-2">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2 font-bold text-xl">
                  🔒
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Close Shift #{currentShift.shiftNo}</h3>
                <p className="text-xs text-slate-500">
                  Count and enter the actual physical cash notes in your cash drawer
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                  <span className="font-semibold text-slate-600">Calculated Expected Cash:</span>
                  <span className="font-mono font-black text-indigo-700 text-sm">
                    {fmt(currentShift.closingCashCalculated)}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Counted Physical Cash in Drawer *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      value={declaredCash}
                      onChange={(e) => setDeclaredCash(e.target.value)}
                      placeholder="Enter counted amount..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {declaredCash !== '' && (() => {
                  const diff = Number(declaredCash) - currentShift.closingCashCalculated
                  const isBalanced = Math.abs(diff) < 0.01
                  return (
                    <div
                      className={`p-3 rounded-xl font-bold flex items-center justify-between ${
                        isBalanced
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : diff > 0
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      <span>{isBalanced ? '✓ Drawer Exactly Balanced' : diff > 0 ? '⚠️ Cash Surplus (Over)' : '⚠️ Cash Shortage (Under)'}</span>
                      <span className="font-mono text-sm">{fmt(Math.abs(diff))}</span>
                    </div>
                  )
                })()}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Closing Remarks</label>
                  <input
                    type="text"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="e.g. End of evening shift, handed over to night cashier"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <button
                onClick={handleCloseShift}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <span>🔒 Declare Cash & Generate Z-Report</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB: Z-REPORT PREVIEW */}
          {activeTab === 'zreport' && zReportData && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Day-End Z-Report</h3>
                  <p className="text-[11px] text-slate-500">Official fiscal & cash audit slip</p>
                </div>
                <button
                  onClick={printZReport}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Z-Slip (80mm)
                </button>
              </div>

              {/* Thermal 80mm Z-Slip Preview */}
              <div className="max-w-sm mx-auto bg-white p-5 rounded-2xl border-2 border-dashed border-slate-300 shadow-sm font-mono text-[11px] space-y-2 text-slate-800">
                <div className="text-center pb-2 border-b border-slate-200">
                  <div className="font-black text-sm uppercase">{zReportData.pharmacyName}</div>
                  <div className="text-[10px] text-slate-500">{zReportData.pharmacyAddress}</div>
                  <div className="text-[10px] text-slate-500">Tel: {zReportData.pharmacyPhone}</div>
                  <div className="mt-1 font-bold text-xs bg-slate-100 py-0.5 rounded">
                    *** DAY-END Z-REPORT ***
                  </div>
                </div>

                <div className="space-y-0.5 text-[10px] border-b border-slate-100 pb-2">
                  <div className="flex justify-between">
                    <span>Shift ID:</span>
                    <b>{zReportData.shift.shiftNo}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Counter:</span>
                    <span>{zReportData.shift.counterName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>{zReportData.shift.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Opened:</span>
                    <span>{new Date(zReportData.shift.openedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Closed:</span>
                    <span>{zReportData.shift.closedAt ? new Date(zReportData.shift.closedAt).toLocaleString() : 'ACTIVE'}</span>
                  </div>
                </div>

                <div className="space-y-1 py-1 border-b border-slate-200">
                  <div className="flex justify-between">
                    <span>Invoices Processed:</span>
                    <b>{zReportData.invoicesCount}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Gross Sales:</span>
                    <b>{fmt(zReportData.totalSales)}</b>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Cash Sales:</span>
                    <span>{fmt(zReportData.cashSales)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Card Sales:</span>
                    <span>{fmt(zReportData.cardSales)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Credit Sales:</span>
                    <span>{fmt(zReportData.creditSales)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Discounts:</span>
                    <span>{fmt(zReportData.totalDiscounts)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Estimated Profit:</span>
                    <span>{fmt(zReportData.totalProfit)}</span>
                  </div>
                </div>

                {/* Cash Reconciliation Formula Block */}
                <div className="space-y-1 py-1 border-b border-slate-200">
                  <div className="font-bold text-[10px] text-slate-600">CASH RECONCILIATION:</div>
                  <div className="flex justify-between">
                    <span>Opening Float:</span>
                    <span>{fmt(zReportData.cashReconciliation.openingCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Cash Sales:</span>
                    <span>+{fmt(zReportData.cashReconciliation.cashSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>+ Debt Collected:</span>
                    <span>+{fmt(zReportData.cashReconciliation.customerPayments)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Expenses:</span>
                    <span>-{fmt(zReportData.cashReconciliation.expenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Supplier Cash:</span>
                    <span>-{fmt(zReportData.cashReconciliation.supplierPayments)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Cash Refunds:</span>
                    <span>-{fmt(zReportData.cashReconciliation.refunds)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-bold">
                    <span>Expected Cash:</span>
                    <span>{fmt(zReportData.cashReconciliation.expectedCash)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Declared Cash:</span>
                    <span>{zReportData.cashReconciliation.declaredCash !== null ? fmt(zReportData.cashReconciliation.declaredCash) : '—'}</span>
                  </div>
                  {zReportData.cashReconciliation.declaredCash !== null && (
                    <div
                      className={`flex justify-between font-bold pt-1 ${
                        zReportData.cashReconciliation.isBalanced
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      <span>Variance (Diff):</span>
                      <span>
                        {zReportData.cashReconciliation.variance > 0 ? '+' : ''}
                        {fmt(zReportData.cashReconciliation.variance)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-center pt-2 text-[9px] text-slate-400">
                  Audit Timestamp: {new Date().toLocaleString()}
                  <br />
                  Signature: _______________________
                </div>
              </div>
            </div>
          )}

          {/* TAB: SHIFT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {/* ── Search & Filter Toolbar ── */}
              <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <DateFilterBar filterState={shiftDateFilter} onChange={setShiftDateFilter} />
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search shift #, counter, or cashier name..."
                    value={shiftSearch}
                    onChange={(e) => setShiftSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-o-blue"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 text-left">Shift #</th>
                      <th className="p-2.5 text-left">Counter</th>
                      <th className="p-2.5 text-left">Cashier</th>
                      <th className="p-2.5 text-right">Opening</th>
                      <th className="p-2.5 text-right">Cash Sales</th>
                      <th className="p-2.5 text-right">Expected</th>
                      <th className="p-2.5 text-right">Declared</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold font-mono text-slate-900">{s.shiftNo}</td>
                        <td className="p-2.5 text-slate-700">{s.counterName}</td>
                        <td className="p-2.5 text-slate-600">{s.cashierName}</td>
                        <td className="p-2.5 text-right font-mono">{fmt(s.openingCash)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{fmt(s.cashSales)}</td>
                        <td className="p-2.5 text-right font-mono font-semibold">{fmt(s.closingCashCalculated)}</td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          {s.closingCashDeclared !== null ? fmt(s.closingCashDeclared) : '—'}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.status === 'OPEN'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => {
                              const z = generateZReport(s.id)
                              setZReportData(z)
                              setActiveTab('zreport')
                            }}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] cursor-pointer"
                          >
                            Z-Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filteredHistory.length && (
                      <tr>
                        <td colSpan="9" className="p-6 text-center text-slate-400">
                          No shift records found for the selected date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
