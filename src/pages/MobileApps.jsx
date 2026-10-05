import { useState } from 'react'
import { useDB, fmt, updateDeliveryStatus } from '../lib/db'
import { Smartphone, Shield, Pill, Truck, CheckCircle2, Clock, MapPin, Phone, AlertCircle } from 'lucide-react'

export default function MobileApps() {
  const db = useDB()
  const [activeApp, setActiveApp] = useState('ADMIN') // 'ADMIN' | 'PHARMACIST' | 'RIDER'

  const sales = db.sales || []
  const batches = db.batches || []
  const medicines = db.medicines || []
  const deliveries = db.deliveries || []

  const todayStr = new Date().toISOString().slice(0, 10)
  const todaySales = sales.filter((s) => s.date?.startsWith(todayStr))
  const todayRev = todaySales.reduce((sum, s) => sum + s.total, 0)
  const todayProfit = todaySales.reduce((sum, s) => sum + (s.profit || s.total * 0.22), 0)

  const nearExpiryCount = batches.filter((b) => {
    const diff = (new Date(b.expiry) - new Date()) / 86400000
    return diff > 0 && diff <= 45 && b.qty > 0
  }).length

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200 mb-1">
            <Smartphone className="w-3.5 h-3.5" /> Mobile Role Architecture
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Dedicated Mobile Applications Simulator</h2>
          <p className="text-xs text-slate-500">Role-optimized mobile interfaces for Executives, Dispensary Pharmacists, and Delivery Riders</p>
        </div>

        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveApp('ADMIN')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeApp === 'ADMIN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-blue-600" /> Admin App
          </button>
          <button
            onClick={() => setActiveApp('PHARMACIST')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeApp === 'PHARMACIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Pill className="w-3.5 h-3.5 text-emerald-600" /> Pharmacist App
          </button>
          <button
            onClick={() => setActiveApp('RIDER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeApp === 'RIDER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-amber-600" /> Delivery App
          </button>
        </div>
      </div>

      {/* Simulator Device Frame */}
      <div className="flex justify-center">
        <div className="w-full max-w-md bg-slate-900 p-3 rounded-[36px] shadow-2xl border-4 border-slate-800">
          <div className="w-full bg-white rounded-[28px] overflow-hidden min-h-[580px] flex flex-col text-xs text-slate-800">
            {/* Mobile Top Bar */}
            <div className="px-5 py-3 bg-slate-900 text-white flex justify-between items-center text-[11px] font-bold">
              <span>9:41 AM</span>
              <div className="flex items-center gap-1.5">
                <span>5G</span>
                <span>100% 🔋</span>
              </div>
            </div>

            {/* App Content */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3.5">
              {/* ADMIN APP VIEW */}
              {activeApp === 'ADMIN' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Executive Dashboard</div>
                      <h3 className="font-extrabold text-sm text-slate-900">{db.settings?.pharmacyName || 'Optix MedSync'} HQ</h3>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-0.5">
                      <div className="text-[10px] text-emerald-700 font-bold">Today Revenue</div>
                      <div className="text-base font-black text-emerald-950">{fmt(todayRev)}</div>
                      <div className="text-[9px] text-emerald-600 font-semibold">{todaySales.length} bills completed</div>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-0.5">
                      <div className="text-[10px] text-blue-700 font-bold">Net Profit</div>
                      <div className="text-base font-black text-blue-950">{fmt(todayProfit)}</div>
                      <div className="text-[9px] text-blue-600 font-semibold">Live margin tracking</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="font-bold text-slate-900 text-xs">Pending Branch Approvals (2)</div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200 flex justify-between items-center text-[11px]">
                      <div>
                        <b>TR-0004: Stock Transfer</b>
                        <div className="text-slate-500">Lahore HQ ➔ Karachi South</div>
                      </div>
                      <button className="px-2.5 py-1 bg-emerald-600 text-white rounded-md font-bold text-[10px]">
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PHARMACIST APP VIEW */}
              {activeApp === 'PHARMACIST' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Dispensary Station</div>
                      <h3 className="font-extrabold text-sm text-slate-900">Pharmacist Dispensing</h3>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">FEFO Active</span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                    <div className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-700" /> Expiry Checklist ({nearExpiryCount} items)
                    </div>
                    <p className="text-[10px] text-amber-800">Batches expiring within 45 days. Prioritize dispensing under FEFO rules.</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-bold text-slate-900 text-xs">Active Prescriptions (Rx Queue)</div>
                    {[
                      { rx: 'RX-901', patient: 'Kashif Mehmood', meds: 'Augmentin 625 (10x), Panadol (20x)', status: 'Verified' },
                      { rx: 'RX-902', patient: 'Sara Bibi', meds: 'Brufen 400 (15x)', status: 'Pending Dispense' },
                    ].map((item, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-white space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-900">{item.rx} — {item.patient}</span>
                          <span className="text-emerald-700 text-[10px]">{item.status}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{item.meds}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RIDER DELIVERY APP VIEW */}
              {activeApp === 'RIDER' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Rider Fleet Logistics</div>
                      <h3 className="font-extrabold text-sm text-slate-900">Active Delivery Orders</h3>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Rider Usman</span>
                  </div>

                  <div className="space-y-2">
                    {deliveries.map((del) => (
                      <div key={del.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-slate-900">{del.trackingNo}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            del.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {del.status}
                          </span>
                        </div>
                        <div className="text-[11px] space-y-0.5 text-slate-600">
                          <div className="font-bold text-slate-900">{del.customerName} · {del.phone}</div>
                          <div className="flex items-start gap-1 text-[10px]">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span>{del.address}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                          <span className="font-bold text-slate-900">COD: {fmt(del.codAmount)}</span>
                          {del.status !== 'DELIVERED' && (
                            <button
                              onClick={() => updateDeliveryStatus(del.id, 'DELIVERED')}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[10px]"
                            >
                              Collect Cash & Mark Delivered
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
