import { useState } from 'react'
import { useDB, smartInventory, purchaseOrders, savePurchaseOrder, fmt } from '../lib/db'
import { getDemandForecast30Days } from '../lib/forecasting'

export default function SmartInventory() {
  const db = useDB()
  const [tab, setTab] = useState('forecast')
  const items = smartInventory()
  const reorders = items.filter((x) => x.reorderNeeded)
  const dead = items.filter((x) => x.deadStock)
  const pos = purchaseOrders()
  const forecast30 = getDemandForecast30Days()
  const [selected, setSelected] = useState(new Set())
  const [poMsg, setPoMsg] = useState('')

  function toggle(name) {
    setSelected((s) => {
      const n = new Set(s)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }

  function generatePO() {
    if (!selected.size) return setPoMsg('Please select at least one medicine')
    const poItems = [...selected].map((name) => {
      const it = items_ByName(name)
      return { medicineId: it.medicine.id, name, qty: it.suggestedQty, avgDaily: it.avgDaily, stock: it.stock }
    })
    const po = savePurchaseOrder({
      supplierId: db.suppliers[0]?.id || '',
      items: poItems,
      note: 'Auto-generated from predictive stock demand',
    })
    setPoMsg(`✓ Purchase Order ${po.poNo} created with ${poItems.length} items`)
    setSelected(new Set())
  }

  const items_ByName = (name) => reorders.find((r) => `${r.medicine.name} ${r.medicine.strength}` === name)

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">🧠 AI Stock Intelligence</h2>
          <p className="text-xs text-slate-500 mt-0.5">Automated demand forecasting, dead stock analysis, and margin optimization</p>
        </div>
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            ['forecast', '📈 Forecast & Reorder'],
            ['demand30', '🧠 30-Day Demand Engine'],
            ['dead', '💀 Dead Stock'],
            ['margin', '💰 Batch Margins'],
            ['po', '📋 Purchase Orders'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'forecast' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3 text-left">Medicine</th>
                <th className="p-3 text-center">Current Stock</th>
                <th className="p-3 text-center">Avg Daily Sales</th>
                <th className="p-3 text-center">Runout Forecast</th>
                <th className="p-3 text-center">Safety Point</th>
                <th className="p-3 text-center">Suggested Qty</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((x) => (
                <tr key={x.medicine.id} className={`hover:bg-slate-50/50 ${x.reorderNeeded ? 'bg-amber-50/40' : ''}`}>
                  <td className="p-3 text-left">
                    <b className="text-slate-900">{x.medicine.name}</b> <span className="text-slate-500">{x.medicine.strength}</span>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-700">{x.stock}</td>
                  <td className="p-3 text-center text-slate-600">{x.avgDaily || '—'}</td>
                  <td className="p-3 text-center font-medium text-slate-600">
                    {x.estDays === Infinity ? 'Safe' : `${x.estDays} days`}
                  </td>
                  <td className="p-3 text-center text-slate-600">{x.reorderPoint}</td>
                  <td className="p-3 text-center">
                    {x.suggestedQty > 0 ? <b className="text-emerald-700 font-extrabold">{x.suggestedQty} pcs</b> : '—'}
                  </td>
                  <td className="p-3 text-center">
                    {x.reorderNeeded ? (
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ Reorder</span>
                    ) : x.deadStock ? (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">💀 Stagnant</span>
                    ) : (
                      <span className="text-emerald-600 font-bold text-[11px]">✓ In Stock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'demand30' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">🧠 30-Day Predictive Demand Engine</h3>
              <p className="text-xs text-slate-500">Forecasting with weekday/weekend seasonality multipliers and 7-day safety buffer</p>
            </div>
            <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
              Model: Seasonality-Adjusted Moving Average
            </span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3 text-left">Medicine</th>
                <th className="p-3 text-center">Current Stock</th>
                <th className="p-3 text-center">Avg Daily</th>
                <th className="p-3 text-center">30-Day Demand</th>
                <th className="p-3 text-center">Runout Days</th>
                <th className="p-3 text-center">Suggested Reorder</th>
                <th className="p-3 text-center">Replenishment Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {forecast30.map((f) => (
                <tr key={f.medicineId} className="hover:bg-slate-50/50">
                  <td className="p-3 text-left">
                    <b className="text-slate-900">{f.name}</b> <span className="text-slate-500">{f.strength}</span>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-700">{f.currentStock}</td>
                  <td className="p-3 text-center text-slate-600">{f.avgDaily} / day</td>
                  <td className="p-3 text-center font-bold text-indigo-700">{f.projected30Days} units</td>
                  <td className="p-3 text-center font-semibold">
                    <span className={f.stockRunoutDays <= 7 ? 'text-rose-600 font-bold' : f.stockRunoutDays <= 14 ? 'text-amber-600 font-semibold' : 'text-slate-600'}>
                      {f.stockRunoutDays === 99 ? '90+ days' : `${f.stockRunoutDays} days`}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {f.suggestedOrderQty > 0 ? (
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-extrabold">
                        +{f.suggestedOrderQty} units
                      </span>
                    ) : (
                      <span className="text-slate-400">Adequate</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        f.reorderPriority === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : f.reorderPriority === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {f.reorderPriority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'dead' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-sm">💀 Stagnant Inventory (Zero movement) ({dead.length})</h3>
            <span className="text-xs text-slate-500">Capital tied up in dormant inventory</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3 text-left">Medicine</th>
                <th className="p-3 text-center">Units Trapped</th>
                <th className="p-3 text-right">Tied-Up Valuation</th>
                <th className="p-3 text-center">Batch Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dead.map((x) => {
                const value = db.batches
                  .filter((b) => b.medicineId === x.medicine.id)
                  .reduce((a, b) => a + b.qty * b.purchasePrice, 0)
                const batches = db.batches
                  .filter((b) => b.medicineId === x.medicine.id && b.qty > 0)
                  .map((b) => b.batchNo)
                  .join(', ')
                return (
                  <tr key={x.medicine.id} className="hover:bg-slate-50/50">
                    <td className="p-3 text-left">
                      <b className="text-slate-900">{x.medicine.name}</b> <span className="text-slate-500">{x.medicine.strength}</span>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-700">{x.stock}</td>
                    <td className="p-3 text-right font-bold text-rose-600">{fmt(value)}</td>
                    <td className="p-3 text-center font-mono text-slate-500">{batches}</td>
                  </tr>
                )
              })}
              {!dead.length && (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-slate-400">
                    No dead stock — all medicine lines active ✓
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'margin' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">💰 Batch Profit Margins</h3>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3 text-left">Medicine</th>
                <th className="p-3 text-center">Batch</th>
                <th className="p-3 text-right">Margin / Unit</th>
                <th className="p-3 text-center">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.flatMap((x) =>
                x.batchProfits.map((b) => (
                  <tr key={x.medicine.id + b.batchNo} className="hover:bg-slate-50/50">
                    <td className="p-3 text-left">
                      <b className="text-slate-900">{x.medicine.name}</b> <span className="text-slate-500">{x.medicine.strength}</span>
                    </td>
                    <td className="p-3 text-center font-mono text-slate-500">{b.batchNo}</td>
                    <td className="p-3 text-right font-semibold text-slate-800">{fmt(b.margin)}</td>
                    <td className="p-3 text-center font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          b.pct >= 25
                            ? 'bg-emerald-50 text-emerald-700'
                            : b.pct >= 15
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {b.pct}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'po' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-1">📋 Auto Reorder Dispatcher</h3>
            <p className="text-xs text-slate-500 mb-4">Select replenishments to automatically generate a supplier PO:</p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {reorders.map((x) => {
                const name = `${x.medicine.name} ${x.medicine.strength}`
                return (
                  <label
                    key={x.medicine.id}
                    className="flex items-center gap-3 text-xs p-2.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(name)}
                      onChange={() => toggle(name)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span className="flex-1 font-semibold text-slate-800">
                      {name} — <span className="text-slate-500 font-normal">In Stock: {x.stock} ({x.estDays} days left)</span>
                    </span>
                    <b className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Order {x.suggestedQty} pcs</b>
                  </label>
                )
              })}
              {!reorders.length && (
                <p className="text-slate-400 text-xs py-4 text-center">No reorder recommendations (adequate stock levels) ✓</p>
              )}
            </div>

            {reorders.length > 0 && (
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={generatePO}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm"
                >
                  ⚡ Generate Purchase Order
                </button>
                {poMsg && <span className="text-xs font-bold text-emerald-700">{poMsg}</span>}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Generated Purchase Orders ({pos.length})</h3>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3 text-left">PO Number</th>
                  <th className="p-3 text-center">Creation Date</th>
                  <th className="p-3 text-left">Ordered Items</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pos.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-slate-800 text-left">{po.poNo}</td>
                    <td className="p-3 text-center text-slate-600">{po.date}</td>
                    <td className="p-3 text-left text-slate-700">{po.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}</td>
                    <td className="p-3 text-center">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">{po.status}</span>
                    </td>
                  </tr>
                ))}
                {!pos.length && (
                  <tr>
                    <td colSpan="4" className="p-6 text-center text-slate-400">
                      No purchase orders recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
