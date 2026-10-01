import { useState, useEffect } from 'react'
import { useDB, fmt, medicineById } from '../lib/db'
import { Monitor, X, CheckCircle2, ShoppingBag } from 'lucide-react'

export default function CustomerDisplay({ isOpen, onClose, cart = [], subtotal = 0, discount = 0, total = 0, changeDue = 0, paid = 0, lastAdded = null }) {
  if (!isOpen) return null
  const db = useDB()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-slate-950 rounded-3xl shadow-2xl border-2 border-emerald-500/40 w-full max-w-3xl overflow-hidden flex flex-col text-white">
        {/* Top Title Bar */}
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white tracking-wide">
                {db.settings?.pharmacyName || 'Al-Shifa Pharmacy'}
              </h3>
              <p className="text-[10px] text-emerald-400 font-mono">
                CUSTOMER FACING DISPLAY (DUAL-SCREEN STATION)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Last Item Scanned */}
          <div className="space-y-4">
            <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Item Scanned
              </span>
              {lastAdded ? (
                <div className="space-y-2">
                  <div className="text-xl font-black text-white">{lastAdded.name}</div>
                  <div className="text-xs text-slate-300 font-medium">
                    {lastAdded.strength} · {lastAdded.form}
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono pt-1">
                    {fmt(lastAdded.salePrice)}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500">
                  <ShoppingBag className="w-10 h-10 mx-auto opacity-30 mb-2" />
                  <span className="text-xs font-semibold">Ready for next medicine scan...</span>
                </div>
              )}
            </div>

            {/* Cart item count */}
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Total Items in Cart:</span>
              <span className="font-bold text-white font-mono bg-slate-800 px-3 py-1 rounded-xl">
                {cart.reduce((a, b) => a + b.qty, 0)} Units
              </span>
            </div>
          </div>

          {/* Right: Large Total Screen */}
          <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 rounded-2xl p-6 border border-emerald-500/30 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
                Total Amount Due
              </span>
              <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight mt-1">
                {fmt(total)}
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono text-white">{fmt(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Savings / Discount:</span>
                  <span className="font-mono">-{fmt(discount)}</span>
                </div>
              )}
              {paid > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Cash Tendered:</span>
                  <span className="font-mono text-white">{fmt(paid)}</span>
                </div>
              )}
              {changeDue > 0 && (
                <div className="flex justify-between text-amber-300 font-bold border-t border-slate-800 pt-2 text-sm">
                  <span>Change Return:</span>
                  <span className="font-mono">{fmt(changeDue)}</span>
                </div>
              )}
            </div>

            <div className="text-center pt-2 text-[11px] text-emerald-300/80 font-medium">
              Thank you for trusting {db.settings?.pharmacyName || 'our pharmacy'}!
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
