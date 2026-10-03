import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import {
  useDB,
  completeSale,
  fmt,
  medicineById,
  stockOf,
  currentUser,
  maxDiscount,
  DISCOUNT_LIMITS,
  PRICING_TIERS,
  calculateTierPrice,
} from '../lib/db'
import { playScanBeep, playSuccessChime, playWarningTone } from '../lib/audio'
import SalesHistory from '../components/SalesHistory'
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  PauseCircle,
  PlayCircle,
  Share2,
  Printer,
  FileText,
  Zap,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  History,
} from 'lucide-react'

export default function POS() {
  const db = useDB()
  const location = useLocation()
  const prescriptionMode = new URLSearchParams(location.search).get('tab') === 'rx'
  const tabParam = new URLSearchParams(location.search).get('tab')
  const [activeTab, setActiveTab] = useState('counter')

  useEffect(() => {
    if (tabParam === 'history') setActiveTab('history')
    else if (tabParam === 'rx') {
      setActiveTab('counter')
      setShowRxModal(true)
    }
  }, [tabParam])

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // {medicineId, qty, price}
  const [discount, setDiscount] = useState(0)
  const [payMethod, setPayMethod] = useState('CASH')
  const [paidInput, setPaidInput] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [err, setErr] = useState('')
  const [held, setHeld] = useState([]) // parked carts
  const [showHeld, setShowHeld] = useState(false)
  const [pricingTier, setPricingTier] = useState('RETAIL')
  const [drawerKickNotif, setDrawerKickNotif] = useState(false)

  // Rx Prescription Note
  const [rxNotes, setRxNotes] = useState('')
  const [showRxModal, setShowRxModal] = useState(false)

  const searchRef = useRef(null)

  useEffect(() => {
    if (prescriptionMode) setShowRxModal(true)
  }, [prescriptionMode])

  function handleTierChange(newTier) {
    setPricingTier(newTier)
    setCart((c) =>
      c.map((item) => {
        const med = medicineById(item.medicineId)
        return {
          ...item,
          price: calculateTierPrice(med?.salePrice || item.price, newTier),
        }
      })
    )
  }

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2' || (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (e.key === 'F4') {
        e.preventDefault()
        if (cart.length > 0) {
          setPayMethod('CASH')
          complete()
        }
      } else if (e.key === 'F8') {
        e.preventDefault()
        holdCurrentCart()
      } else if (e.key === 'F9') {
        e.preventDefault()
        setShowHeld((prev) => !prev)
      } else if (e.key === 'Escape') {
        setSearch('')
        setShowHeld(false)
        setShowRxModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, discount, payMethod])

  // Barcode scanner listener
  useEffect(() => {
    if (!search) return
    const exact = db.medicines.find((m) => m.barcode && m.barcode === search.trim())
    if (exact) {
      addToCart(exact)
      searchRef.current?.focus()
    }
  }, [search])

  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0)
  const totalUnits = cart.reduce((s, i) => s + i.qty, 0)
  const total = Math.max(0, subtotal - discount)
  const me = currentUser()
  const cap = maxDiscount(subtotal)
  const capPct = DISCOUNT_LIMITS[me?.role] ?? 0
  const discountAllowed = capPct > 0

  // Change Due calculation
  const cashGiven = Number(paidInput || 0)
  const changeDue = payMethod === 'CASH' && cashGiven > total ? cashGiven - total : 0

  const results =
    search.length >= 1
      ? db.medicines
          .filter((m) => {
            const q = search.toLowerCase()
            return (
              m.name.toLowerCase().includes(q) ||
              (m.generic && m.generic.toLowerCase().includes(q)) ||
              (m.barcode || '').includes(q)
            )
          })
          .slice(0, 10)
      : []

  function addToCart(m) {
    setErr('')
    const currentStock = stockOf(m.id)
    if (currentStock <= 0) {
      playWarningTone()
      setErr(`⚠️ Notice: "${m.name}" is currently out of stock (0 units).`)
    }

    const tierPrice = calculateTierPrice(m.salePrice, pricingTier)

    setCart((c) => {
      const ex = c.find((i) => i.medicineId === m.id)
      if (ex) {
        return c.map((i) => (i.medicineId === m.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...c, { medicineId: m.id, qty: 1, price: tierPrice }]
    })

    playScanBeep()
    setSearch('')
  }

  function setQty(id, qty) {
    setCart((c) =>
      c.map((i) => (i.medicineId === id ? { ...i, qty: Math.max(0, qty) } : i)).filter((i) => i.qty > 0)
    )
  }

  function holdCurrentCart() {
    if (!cart.length) {
      playWarningTone()
      return setErr('Cart is empty — add items to park cart.')
    }
    setHeld((h) => [
      ...h,
      {
        id: Date.now(),
        cart,
        discount: Number(discount),
        pricingTier,
        payMethod,
        rxNotes,
        at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setCart([])
    setDiscount(0)
    setPricingTier('RETAIL')
    setPayMethod('CASH')
    setRxNotes('')
    setPaidInput('')
    setErr('')
    playScanBeep()
  }

  function complete() {
    setErr('')
    if (!cart.length) {
      playWarningTone()
      return setErr('Cart is empty — please add at least one medicine.')
    }
    if (prescriptionMode && !rxNotes.trim()) {
      playWarningTone()
      return setErr('Prescription mode requires a doctor prescription note before checkout.')
    }
    try {
      const sale = completeSale({
        items: cart,
        discount: Number(discount),
        customerId: null,
        payMethod,
        paid: Number(paidInput || (payMethod === 'CASH' ? total : 0)),
        rxNotes,
      })

      if (payMethod === 'CASH') {
        setDrawerKickNotif(true)
        setTimeout(() => setDrawerKickNotif(false), 2500)
      }

      playSuccessChime()
      setReceipt(sale)
      setCart([])
      setDiscount(0)
      setPaidInput('')
      setPayMethod('CASH')
      setRxNotes('')
    } catch (e) {
      playWarningTone()
      setErr(e.message)
    }
  }

  return (
    <div className="pos-page flex flex-col h-full w-full overflow-hidden">
      {/* Top Header / Switcher Bar */}
      <div className="flex items-center justify-between mb-2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl shadow-2xs shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('counter')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'counter'
                ? 'bg-[#3b1734] text-white border border-[#280c23] shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>New Sale (Billing Counter)</span>
            {cart.length > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {totalUnits}
              </span>
            )}
          </button>

        </div>

        {prescriptionMode && (
          <div className="px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Prescription (Rx) Mode</span>
          </div>
        )}
      </div>

      {activeTab === 'history' ? (
        <div className="flex-1 min-h-0 w-full overflow-hidden">
          <SalesHistory onReprint={(sale) => setReceipt(sale)} />
        </div>
      ) : (
        /* 1 Unified Layout Container: Left Workstation & Right Settlement */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 flex-1 min-h-0 w-full overflow-y-auto md:overflow-hidden">
        
        {/* Left Column: Workstation Card (7 cols on md, 8 cols on xl) with Sharp Edges */}
        <div className="md:col-span-7 xl:col-span-8 flex flex-col bg-white border border-slate-300 rounded-sm shadow-xs overflow-hidden h-full min-h-[340px]">
          {/* Header Strip with Search & Quick Action Buttons */}
          <div className="bg-slate-50 border-b border-slate-300 p-2.5 flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-emerald-700 absolute left-3 pointer-events-none" />
                <input
                  ref={searchRef}
                  className="w-full bg-white border border-slate-300 rounded-sm pl-9 pr-14 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all placeholder:text-slate-400"
                  autoComplete="off"
                  placeholder={prescriptionMode ? 'Search prescribed medicine or scan barcode...' : 'Scan barcode or type medicine name / generic (Panadol, Augmentin)...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (search && !db.medicines.some((m) => m.barcode === search.trim())) {
                        if (results.length) addToCart(results[0])
                      }
                    } else if (e.key === 'Escape') {
                      setSearch('')
                    }
                  }}
                />
                <div className="absolute right-2.5 flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm border border-slate-200 pointer-events-none">
                  <span>F2</span>
                </div>
              </div>

              {/* Instant Search Dropdown Results */}
              {results.length > 0 && (
                <div className="absolute z-30 w-full mt-1 bg-white rounded-sm shadow-xl border border-slate-300 overflow-hidden divide-y divide-slate-100 animate-in fade-in duration-100">
                  {results.map((m) => {
                    const st = stockOf(m.id)
                    return (
                      <button
                        key={m.id}
                        onClick={() => addToCart(m)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50 active:bg-emerald-100 flex items-center justify-between transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-sm bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs group-hover:bg-emerald-100 group-hover:text-emerald-800">
                            💊
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-950">
                              {m.name} <span className="font-normal text-slate-500 text-[11px]">({m.strength})</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {m.generic} · <span className="font-medium text-slate-600">{m.form}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-black text-emerald-700 font-mono">{fmt(m.salePrice)}</div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm inline-block ${
                              st <= 0
                                ? 'bg-rose-100 text-rose-700'
                                : st < (m.minStock || 10)
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            Stock: {st}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Parked Carts Trigger */}
            {held.length > 0 && (
              <button
                onClick={() => setShowHeld(!showHeld)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors shrink-0 shadow-xs"
                title="View Parked Orders (F9)"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>Held ({held.length})</span>
              </button>
            )}

            {/* Rx Note Trigger */}
            <button
              onClick={() => setShowRxModal(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-semibold border transition-colors shrink-0 ${
                rxNotes
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>{rxNotes ? 'Rx Attached' : prescriptionMode ? 'Add Prescription' : 'Rx Note'}</span>
            </button>
          </div>

          {/* Cart Table Header */}
          <div className="bg-slate-100/90 border-b border-slate-300 px-4 py-2 flex items-center justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-700" />
              <span>Current Order Items ({cart.length})</span>
            </div>
            <button
              onClick={() => {
                setCart([])
                setDiscount(0)
              }}
              disabled={!cart.length}
              className="text-slate-400 hover:text-rose-600 disabled:opacity-40 transition-colors flex items-center gap-1 text-[11px] font-semibold"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Cart</span>
            </button>
          </div>

          {/* Order Items Table Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 custom-scroll min-h-0 bg-white">
            {cart.map((i) => {
              const m = medicineById(i.medicineId)
              const itemTotal = i.qty * i.price
              return (
                <div
                  key={i.medicineId}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/90 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-sm bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                      💊
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {m?.name} <span className="text-[11px] font-normal text-slate-500">({m?.strength})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span className="font-mono text-slate-700">{fmt(i.price)}</span>
                        <span>·</span>
                        <span className="text-emerald-700 font-medium">FEFO Auto-Allocated</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Sharp Qty Stepper */}
                    <div className="flex items-center border border-slate-300 rounded-sm overflow-hidden bg-white">
                      <button
                        onClick={() => setQty(i.medicineId, i.qty - 1)}
                        className="w-6 h-6 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors border-r border-slate-300"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={i.qty}
                        onChange={(e) => setQty(i.medicineId, Number(e.target.value))}
                        className="w-10 text-center text-xs font-bold text-slate-900 focus:outline-none bg-transparent"
                      />
                      <button
                        onClick={() => setQty(i.medicineId, i.qty + 1)}
                        className="w-6 h-6 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors border-l border-slate-300"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="text-right w-24">
                      <div className="text-xs font-black font-mono text-slate-900">{fmt(itemTotal)}</div>
                    </div>

                    {/* Delete Item */}
                    <button
                      onClick={() => setQty(i.medicineId, 0)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}

            {!cart.length && (
              <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-sm bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center mb-2.5">
                  <ShoppingCart className="w-6 h-6 opacity-60" />
                </div>
                <p className="text-xs font-bold text-slate-700">Order Terminal Ready</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm">
                  Scan barcode with reader or press <kbd className="px-1 py-0.2 bg-slate-100 rounded-sm text-slate-700 font-mono text-[10px] border border-slate-200">F2</kbd> to search medicine.
                </p>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-500 font-mono">
                  <span>F2: Search</span>
                  <span>·</span>
                  <span>Enter: Add</span>
                  <span>·</span>
                  <span>F4: Quick Settle</span>
                  <span>·</span>
                  <span>F8: Hold</span>
                </div>
              </div>
            )}
          </div>

          {/* Table Footer Status Strip */}
          <div className="bg-slate-50 border-t border-slate-300 px-4 py-2 flex items-center justify-between text-xs text-slate-600 shrink-0">
            <div className="flex items-center gap-3 font-medium">
              <span>Lines: <b className="font-mono text-slate-900">{cart.length}</b></span>
              <span>·</span>
              <span>Total Units: <b className="font-mono text-slate-900">{totalUnits}</b></span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Ready for Billing
            </div>
          </div>
        </div>

        {/* Right Column: Settlement & Checkout Card (5 cols on md, 4 cols on xl) with Sharp Edges */}
        <div className="md:col-span-5 xl:col-span-4 flex flex-col bg-white border border-slate-300 rounded-sm shadow-xs p-3.5 justify-between h-full space-y-3 overflow-y-auto custom-scroll min-h-[340px]">
          
          <div className="space-y-3">
            {/* Pricing Tier Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Pricing Tier</span>
                </label>
                <span className="text-[10px] font-bold text-indigo-700 font-mono">
                  {PRICING_TIERS[pricingTier]?.discountPct > 0 ? `-${PRICING_TIERS[pricingTier].discountPct}% off base` : 'Retail MSRP'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(PRICING_TIERS).map(([k, t]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleTierChange(k)}
                    className={`px-2 py-1.5 text-left border rounded-sm transition-all ${
                      pricingTier === k
                        ? 'bg-slate-900 text-white border-slate-900 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-[11px] font-bold leading-tight">{t.name}</div>
                    <div className={`text-[9px] ${pricingTier === k ? 'text-slate-300' : 'text-slate-400'}`}>
                      {t.discountPct > 0 ? `-${t.discountPct}% Discount` : 'Retail (0%)'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="border border-slate-200 rounded-sm p-2.5 bg-slate-50/70 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({totalUnits} units)</span>
                <span className="font-mono font-bold text-slate-800">{fmt(subtotal)}</span>
              </div>

              {/* Discount Input */}
              <div className="flex justify-between items-center text-slate-600">
                <span className="text-[11px]">
                  Discount {discountAllowed && capPct !== Infinity ? `(Max ${capPct * 100}%)` : ''}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-400">Rs.</span>
                  <input
                    type="number"
                    min="0"
                    value={discountAllowed ? discount : 0}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (v > cap) {
                        setErr(`Discount limit: Max allowed is ${fmt(cap)}`)
                        setDiscount(Math.floor(cap))
                      } else {
                        setErr('')
                        setDiscount(v)
                      }
                    }}
                    disabled={!discountAllowed}
                    className="w-20 border border-slate-300 rounded-sm px-1.5 py-0.5 text-right text-xs font-mono font-bold bg-white focus:outline-none focus:border-emerald-600 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Sharp Grand Total Box */}
            <div className="bg-slate-950 text-white rounded-sm p-3 border border-slate-900 relative overflow-hidden">
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold uppercase tracking-wider">
                <span>Net Payable Amount</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {cart.length} SKUs
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="text-3xl font-black font-mono tracking-tight text-emerald-400">
                  {fmt(total)}
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">Payment Method</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'CASH', label: 'Cash', icon: Banknote },
                  { id: 'CARD', label: 'Card / POS', icon: CreditCard },
                  { id: 'BANK', label: 'Bank / QR', icon: QrCode },
                ].map((p) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPayMethod(p.id)}
                      className={`py-2 px-1 rounded-sm font-bold text-xs flex flex-col items-center gap-1 transition-all border ${
                        payMethod === p.id
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{p.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Cash Tender & Quick Denominations */}
            {payMethod === 'CASH' && (
              <div className="bg-slate-50 p-2.5 rounded-sm border border-slate-300 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Cash Received:</span>
                  <input
                    type="number"
                    placeholder="Enter cash given"
                    value={paidInput}
                    onChange={(e) => setPaidInput(e.target.value)}
                    className="w-28 bg-white border border-slate-300 rounded-sm px-2 py-1 text-right font-mono font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {/* Quick denomination chips with sharp edges */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPaidInput(String(total))}
                    className="flex-1 py-1 rounded-sm bg-white border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Exact
                  </button>
                  {[500, 1000, 5000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setPaidInput(String(amt))}
                      className="flex-1 py-1 rounded-sm bg-white border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors font-mono"
                    >
                      Rs.{amt}
                    </button>
                  ))}
                </div>

                {changeDue > 0 && (
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-1.5 rounded-sm border border-emerald-300">
                    <span>Change Due:</span>
                    <span className="text-sm font-mono font-black">{fmt(changeDue)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Error Notification */}
            {err && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-sm text-rose-700 text-xs font-medium flex items-center gap-2">
                <span>⚠️</span>
                <span>{err}</span>
              </div>
            )}
          </div>

          {/* Action Buttons with Sharp Edges */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
            <button
              onClick={holdCurrentCart}
              className="p-3 rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition-colors flex items-center justify-center gap-1.5 shrink-0"
              title="Hold / Park Current Cart (F8)"
            >
              <PauseCircle className="w-4 h-4 text-amber-600" />
              <span>Hold (F8)</span>
            </button>

            <button
              onClick={complete}
              disabled={!cart.length}
              className="flex-1 py-3 rounded-sm bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-extrabold text-sm border border-emerald-800 shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Complete Sale & Print (F4)</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Held Carts Modal with Sharp Edges */}
      {showHeld && held.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm p-5 w-full max-w-lg shadow-xl border border-slate-300 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-amber-500" /> Parked / Held Carts ({held.length})
              </h3>
              <button
                onClick={() => setShowHeld(false)}
                className="p-1 rounded-sm text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto custom-scroll">
              {held.map((h) => (
                <div
                  key={h.id}
                  className="p-3 rounded-sm border border-slate-200 bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Parked at {h.at} · {h.cart.length} medicines
                    </div>
                    <div className="text-xs text-emerald-700 font-bold font-mono mt-0.5">
                      Total: {fmt(h.cart.reduce((s, i) => s + i.qty * i.price, 0))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCart(h.cart)
                        setDiscount(h.discount)
                        setPricingTier(h.pricingTier || 'RETAIL')
                        setPayMethod(h.payMethod)
                        setRxNotes(h.rxNotes || '')
                        setHeld((x) => x.filter((y) => y.id !== h.id))
                        setShowHeld(false)
                        playScanBeep()
                      }}
                      className="px-3 py-1 rounded-sm bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800"
                    >
                      Recall
                    </button>
                    <button
                      onClick={() => setHeld((x) => x.filter((y) => y.id !== h.id))}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Prescription / Rx Note Modal with Sharp Edges */}
      {showRxModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm p-5 w-full max-w-md shadow-xl border border-slate-300 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" /> Doctor Prescription Note
              </h3>
              <button
                onClick={() => setShowRxModal(false)}
                className="p-1 rounded-sm text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                Doctor Name / Patient Diagnosis / Dosage Instructions
              </label>
              <textarea
                rows={4}
                value={rxNotes}
                onChange={(e) => setRxNotes(e.target.value)}
                placeholder="e.g. Dr. Asif (Cardiologist) - 1 tablet morning & night after meals..."
                className="w-full border border-slate-300 rounded-sm p-2.5 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setRxNotes('')
                  setShowRxModal(false)
                }}
                className="px-3.5 py-1.5 rounded-sm text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
              <button
                onClick={() => setShowRxModal(false)}
                className="px-4 py-1.5 rounded-sm text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Realistic Thermal Receipt Modal with Sharp Edges */}
      {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  )
}

export function Receipt({ sale, onClose }) {
  const db = useDB()
  const s = db.settings || {}

  // WhatsApp Message Generator
  const shareWhatsApp = () => {
    let msg = `🌿 *${s.pharmacyName || 'PHARMACY POS'}*\n`
    if (s.address) msg += `📍 ${s.address}\n`
    if (s.phone) msg += `📞 ${s.phone}\n`
    msg += `--------------------------------\n`
    msg += `🧾 *Invoice:* ${sale.invoiceNo}\n`
    msg += `📅 *Date:* ${new Date(sale.date).toLocaleString()}\n`
    msg += `--------------------------------\n`

    sale.items.forEach((it) => {
      const m = medicineById(it.medicineId)
      msg += `• ${m?.name || 'Medicine'} (${it.qty}x) = ${fmt(it.qty * it.price)}\n`
    })

    msg += `--------------------------------\n`
    if (sale.discount > 0) msg += `Discount: -${fmt(sale.discount)}\n`
    msg += `*TOTAL AMOUNT: ${fmt(sale.total)}*\n`
    msg += `Payment: ${sale.payMethod}\n`
    msg += `--------------------------------\n`
    msg += `Thank you! Get well soon 🌿`

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-sm p-6 w-full max-w-sm print-area shadow-2xl border border-slate-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="print-section" className="text-sm font-mono text-slate-800">
          <div className="text-center font-extrabold text-base text-slate-900 tracking-tight">
            {s.pharmacyName || 'PHARMACY'}
          </div>
          <div className="text-center text-[11px] text-slate-500 mt-0.5">
            {s.address || 'Retail Pharmacy Branch'}
            <br />
            {s.phone || 'Tel: +92 300 0000000'}
          </div>

          <div className="border-t border-dashed border-slate-300 my-2.5" />

          <div className="flex justify-between text-xs">
            <span className="font-bold">{sale.invoiceNo}</span>
            <span className="text-slate-500">{new Date(sale.date).toLocaleDateString()}</span>
          </div>
          <div className="text-xs text-slate-600 mt-0.5">Customer: Walk-in</div>
          <div className="text-xs text-slate-600">Cashier: {sale.soldByName || 'Counter Cashier'}</div>

          {sale.rxNotes && (
            <div className="mt-1 text-[11px] bg-slate-50 p-1.5 rounded-sm border border-slate-200">
              <b>Rx:</b> {sale.rxNotes}
            </div>
          )}

          <div className="border-t border-dashed border-slate-300 my-2.5" />

          <div className="space-y-1">
            {sale.items.map((it, i) => {
              const m = medicineById(it.medicineId)
              return (
                <div key={i} className="flex justify-between text-xs">
                  <span className="truncate pr-2">
                    {m?.name} × {it.qty}
                  </span>
                  <span className="font-semibold shrink-0">{fmt(it.qty * it.price)}</span>
                </div>
              )
            })}
          </div>

          <div className="border-t border-dashed border-slate-300 my-2.5" />

          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{fmt(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount</span>
                <span>-{fmt(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-slate-900 pt-1 border-t border-slate-200">
              <span>TOTAL</span>
              <span>{fmt(sale.total)}</span>
            </div>
            <div className="flex justify-between text-slate-600 pt-0.5">
              <span>Payment</span>
              <span className="font-bold">{sale.payMethod}</span>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-500 mt-4">
            {s.receiptFooter || 'Thank you! Get well soon 🌿'}
          </div>
        </div>

        {/* Modal Buttons (Hidden in print) */}
        <div className="flex flex-col gap-2 mt-5 no-print">
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-sm text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print Thermal Slip
            </button>
            <button
              onClick={shareWhatsApp}
              className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-sm text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> WhatsApp
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm text-xs font-semibold transition-colors border border-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
