import { useState } from 'react'
import { useDB, fmt } from '../lib/db'
import { Bell, X, AlertTriangle, Clock, DollarSign, ShieldCheck, Check, Send } from 'lucide-react'

export default function AlertEngine({ isOpen, onClose }) {
  const db = useDB()
  const [filter, setFilter] = useState('ALL')
  const [channelModal, setChannelModal] = useState(null) // alert object to dispatch
  const [channelSentMsg, setChannelSentMsg] = useState('')

  if (!isOpen) return null

  const now = new Date()
  const batches = db.batches || []
  const medicines = db.medicines || []
  const suppliers = db.suppliers || []
  const sales = db.sales || []

  // Compile real-time alerts
  const alerts = []

  // 1. Stock Alerts
  for (const m of medicines) {
    const totalQty = batches.filter((b) => b.medicineId === m.id).reduce((s, b) => s + b.qty, 0)
    if (totalQty <= (m.minStock || 10)) {
      alerts.push({
        id: `stock_${m.id}`,
        type: 'STOCK',
        title: `Low Stock: ${m.name} ${m.strength}`,
        desc: `Current inventory is ${totalQty} units (safety reorder threshold: ${m.minStock || 10} units).`,
        priority: totalQty === 0 ? 'CRITICAL' : 'HIGH',
        time: 'Active now',
      })
    }
  }

  // 2. Expiry Alerts
  for (const b of batches) {
    const diff = (new Date(b.expiry) - now) / 86400000
    if (b.qty > 0 && diff <= 30 && diff > 0) {
      const m = medicines.find((x) => x.id === b.medicineId)
      alerts.push({
        id: `exp_${b.id}`,
        type: 'EXPIRY',
        title: `Near Expiry: ${m?.name || 'Medicine'} (Batch ${b.batchNo})`,
        desc: `${b.qty} units will expire on ${b.expiry} (${Math.ceil(diff)} days remaining).`,
        priority: 'CRITICAL',
        time: 'Immediate clearance',
      })
    }
  }

  // 3. Payment Alerts
  for (const s of suppliers) {
    if (s.balance > 0) {
      alerts.push({
        id: `sup_${s.id}`,
        type: 'PAYMENT',
        title: `Supplier Payable: ${s.name}`,
        desc: `Outstanding balance of ${fmt(s.balance)} to ${s.company || 'vendor'}.`,
        priority: 'MEDIUM',
        time: 'Due on invoice',
      })
    }
  }

  // 4. Security Alerts
  const securityLogs = (db.auditLogs || []).filter((l) => l.action?.includes('LOCKED') || l.action?.includes('BLOCKED')).slice(-3)
  for (const sec of securityLogs) {
    alerts.push({
      id: `sec_${sec.id}`,
      type: 'SECURITY',
      title: `Security Notice: ${sec.action}`,
      desc: sec.detail || 'User authentication rate limit triggered.',
      priority: 'HIGH',
      time: new Date(sec.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    })
  }

  const filtered = alerts.filter((a) => (filter === 'ALL' ? true : a.type === filter))

  const dispatchAlert = (channel) => {
    setChannelSentMsg(`✓ Alert dispatched via ${channel} successfully`)
    setTimeout(() => {
      setChannelSentMsg('')
      setChannelModal(null)
    }, 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 z-50 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Smart Alert Center</h3>
              <p className="text-[11px] text-slate-400">{alerts.length} active enterprise notifications</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 p-3 border-b border-slate-100 bg-slate-50 overflow-x-auto text-[11px]">
          {['ALL', 'STOCK', 'EXPIRY', 'PAYMENT', 'SECURITY'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                filter === t ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Alert Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll">
          {filtered.map((a) => {
            const isCritical = a.priority === 'CRITICAL'
            return (
              <div
                key={a.id}
                className={`p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all shadow-sm ${
                  isCritical ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${
                      a.type === 'STOCK'
                        ? 'bg-amber-100 text-amber-800'
                        : a.type === 'EXPIRY'
                        ? 'bg-rose-100 text-rose-800'
                        : a.type === 'PAYMENT'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {a.type} · {a.priority}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{a.time}</span>
                </div>
                <h4 className="font-bold text-slate-900 text-xs">{a.title}</h4>
                <p className="text-slate-600 text-[11px] leading-relaxed">{a.desc}</p>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setChannelModal(a)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Send className="w-3 h-3" /> Dispatch Alert
                  </button>
                </div>
              </div>
            )
          })}
          {!filtered.length && (
            <div className="py-16 text-center text-slate-400 text-xs">
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
              <span>All systems optimal. No alerts in this category.</span>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Channel Dispatch Dialog */}
      {channelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setChannelModal(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm border shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Broadcast Alert to Omni-Channels</h3>
              <p className="text-xs text-slate-500 mt-1">{channelModal.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {['WhatsApp Cloud', 'Direct SMS', 'Mobile Push', 'Email Notification'].map((ch) => (
                <button
                  key={ch}
                  onClick={() => dispatchAlert(ch)}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded-xl font-bold text-left transition-colors"
                >
                  📡 {ch}
                </button>
              ))}
            </div>
            {channelSentMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold text-center">
                {channelSentMsg}
              </div>
            )}
            <button onClick={() => setChannelModal(null)} className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
