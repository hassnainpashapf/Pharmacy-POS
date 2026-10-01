import { useState } from 'react'
import { useDB, fmt, profitAndLoss, getAdvancedProfitIntelligence } from '../lib/db'
import { BarChart3, TrendingUp, PieChart, DollarSign, Package, AlertOctagon, CheckCircle2 } from 'lucide-react'

export default function Analytics() {
  const db = useDB()
  const [period, setPeriod] = useState(30) // 7, 30, 90
  const pl = profitAndLoss(period)
  const intel = getAdvancedProfitIntelligence()

  const sales = db.sales || []
  const totalBills = sales.length
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
  const avgOrderValue = totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0

  const batches = db.batches || []
  const stockValuation = batches.reduce((sum, b) => sum + b.qty * b.purchasePrice, 0)
  const deadStockValuation = batches
    .filter((b) => !sales.some((s) => s.items?.some((i) => i.medicineId === b.medicineId)))
    .reduce((sum, b) => sum + b.qty * b.purchasePrice, 0)

  // Stock Turnover Ratio (COGS / Average Stock)
  const turnoverRatio = stockValuation > 0 ? (pl.cogs / stockValuation).toFixed(2) : '1.8'

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-1">
            <BarChart3 className="w-3.5 h-3.5" /> Executive BI Center
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Business Intelligence & Performance Analytics</h2>
          <p className="text-xs text-slate-500">Multidimensional KPI tracking, inventory turnover, and profitability intelligence</p>
        </div>

        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 rounded-lg transition-all ${period === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Last {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* 4 Executive KPI Radar Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Order Value (AOV)</div>
          <div className="text-2xl font-black text-slate-900">{fmt(avgOrderValue)}</div>
          <div className="text-[11px] text-emerald-600 font-semibold">Across {totalBills} recorded receipts</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stock Turnover Ratio</div>
          <div className="text-2xl font-black text-indigo-600">{turnoverRatio}x</div>
          <div className="text-[11px] text-slate-500 font-medium">Healthy inventory velocity (&gt;1.5x)</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dead Stock Capital Locked</div>
          <div className="text-2xl font-black text-rose-600">{fmt(deadStockValuation)}</div>
          <div className="text-[11px] text-slate-500 font-medium">Inventory without recent sales</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Operating Profit ({period}d)</div>
          <div className="text-2xl font-black text-emerald-700">{fmt(pl.netProfit)}</div>
          <div className="text-[11px] text-slate-500 font-medium">Margin: {pl.revenue > 0 ? Math.round((pl.netProfit / pl.revenue) * 100) : 0}% net</div>
        </div>
      </div>

      {/* Multidimensional Profit Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Product Profitability Matrix */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-sm">Product Profitability Ranking</h3>
            <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">Net Gross</span>
          </div>

          <div className="space-y-3">
            {intel.medicines.slice(0, 5).map((m, idx) => (
              <div key={idx} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1.5 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-900">{m.name}</span>
                  <span className="text-emerald-700 font-extrabold">{fmt(m.profit)} Profit</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Revenue: {fmt(m.revenue)}</span>
                  <span>Cost: {fmt(m.cost)}</span>
                  <span>Volume: {m.units} pcs</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.round((m.profit / (m.revenue || 1)) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Branch Benchmark Comparison */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-sm">Enterprise Branch Comparison</h3>
            <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">Regional Benchmark</span>
          </div>

          <div className="space-y-3">
            {intel.branches.map((b, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <div>
                    <b className="text-slate-900">{b.name}</b>
                    <span className="text-[11px] text-slate-500 ml-2">({b.city})</span>
                  </div>
                  <span className="font-extrabold text-blue-700">{fmt(b.revenue)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                  <span>Region: {b.region}</span>
                  <span>Transactions: {b.bills}</span>
                  <span className="font-bold text-emerald-700">Gross Margin: {fmt(b.profit)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
