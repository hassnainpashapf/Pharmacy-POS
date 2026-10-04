import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { useDB, fmt, medicineById, returnsHistory } from '../lib/db'
import DateFilterBar, { matchesDateFilter, useDateFilterState } from './DateFilterBar'
import {
  BarChart3,
  TrendingUp,
  CircleDollarSign,
  Package,
  Receipt,
  Users,
  Printer,
  Download,
  Building2,
  Activity,
  FileSpreadsheet,
  Clock,
  Award,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  Wallet,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  Percent,
  CheckCircle2,
  Layers,
  ArrowDownRight,
  Calendar,
} from 'lucide-react'

// Distinct vibrant palette for charts
const CATEGORY_COLORS = [
  '#714B67', // Deep plum brand
  '#0284c7', // Sky blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Slate
]

const PAYMENT_COLORS = {
  CASH: '#10b981', // Emerald
  CARD: '#0284c7', // Sky blue
  DIGITAL: '#8b5cf6', // Violet
  CREDIT: '#f59e0b', // Amber
  SPLIT: '#714B67', // Plum
}

/* ---------- Custom Tooltip Components for Recharts ---------- */

function CustomAreaTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const rev = payload.find((p) => p.dataKey === 'revenue')?.value ?? payload[0]?.value ?? 0
    const prof = payload.find((p) => p.dataKey === 'profit')?.value ?? payload[1]?.value ?? 0
    return (
      <div className="bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[170px]">
        <div className="font-bold text-slate-300 pb-1.5 mb-1.5 border-b border-slate-800 flex items-center justify-between">
          <span>{label}</span>
          <Activity className="w-3.5 h-3.5 text-[#10b981]" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#714B67]" /> Gross Sales:
            </span>
            <span className="font-bold font-mono">{fmt(rev)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-emerald-400 font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Net Profit:
            </span>
            <span className="font-mono">{fmt(prof)}</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

function CustomBarTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-xs text-white p-2.5 rounded-xl shadow-xl border border-slate-700 text-xs">
        <div className="font-bold text-slate-300 pb-1 border-b border-slate-800 mb-1">{label}</div>
        <div className="font-mono font-bold text-amber-300">{fmt(payload[0]?.value || 0)}</div>
        {payload[1] && (
          <div className="text-[11px] text-slate-400">{payload[1].value} units dispensed</div>
        )}
      </div>
    )
  }
  return null
}

/* ---------- Simple KPI Card ---------- */

function MetricCard({ title, value, sub, icon: Icon }) {

  return (
    <div className="bg-white px-4 py-3.5 rounded-xl border border-slate-200">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-500">{title}</span>
      </div>
      <div className="mt-1.5 text-xl font-bold text-slate-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">{sub}</div>
    </div>
  )
}

/* ---------- Main Business Analytics GUI Dashboard ---------- */

export default function BusinessAnalyticsDashboard({ onSwitchToTabular }) {
  const db = useDB()
  const [reportDateFilter, setReportDateFilter] = useDateFilterState('month')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'pharma' | 'payments' | 'staff'

  // Filter sales matching date period and branch
  const periodSales = useMemo(() => {
    let list = (db.sales || []).filter((s) => matchesDateFilter(s.date, reportDateFilter))
    if (branchFilter !== 'ALL') {
      list = list.filter((s) => (s.branchId || 'main') === branchFilter)
    }
    return list
  }, [db.sales, reportDateFilter, branchFilter])

  // Returns matching period
  const periodReturns = useMemo(() => {
    const list = returnsHistory()
    return list.filter((r) => matchesDateFilter(r.date, reportDateFilter))
  }, [reportDateFilter])

  // Core Aggregations & KPIs
  const kpis = useMemo(() => {
    let revenue = 0
    let profit = 0
    let discount = 0
    let units = 0
    let customerCount = new Set()
    let loyaltyCount = 0

    for (const s of periodSales) {
      revenue += s.total || 0
      profit += s.profit || 0
      discount += s.discount || 0
      if (s.customerId && s.customerId !== 'walkin') {
        customerCount.add(s.customerId)
        loyaltyCount += 1
      }
      for (const item of s.items || []) {
        units += item.qty || 0
      }
    }

    const invoices = periodSales.length
    const avgBasket = invoices > 0 ? Math.round(revenue / invoices) : 0
    const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

    // Returns valuation
    const totalRefunds = periodReturns.reduce((acc, r) => acc + (r.refund || 0), 0)
    const refundRatio = revenue > 0 ? ((totalRefunds / revenue) * 100).toFixed(2) : '0.00'

    // Inventory Cost Valuation
    let stockCost = 0
    for (const b of db.batches || []) {
      if (branchFilter === 'ALL' || (b.branchId || 'main') === branchFilter) {
        stockCost += (b.qty || 0) * (b.purchasePrice || 0)
      }
    }

    // Digital Payment Ratio
    const digitalSales = periodSales
      .filter((s) => {
        const pm = (s.paymentMethod || s.paymentType || s.payMethod || 'CASH').toUpperCase()
        return pm === 'CARD' || pm === 'DIGITAL'
      })
      .reduce((a, b) => a + (b.total || 0), 0)

    const digitalRatio = revenue > 0 ? Math.round((digitalSales / revenue) * 100) : 0

    return {
      revenue,
      profit,
      discount,
      units,
      invoices,
      avgBasket,
      marginPct,
      stockCost,
      totalRefunds,
      refundRatio,
      digitalRatio,
      loyaltySalesRatio: invoices > 0 ? Math.round((loyaltyCount / invoices) * 100) : 0,
      uniqueCustomers: customerCount.size,
    }
  }, [periodSales, periodReturns, db.batches, branchFilter])

  // Trend Data for Area Chart (Grouped by Day or Hour)
  const trendData = useMemo(() => {
    const isSingleDay =
      reportDateFilter?.type === 'today' ||
      reportDateFilter?.type === 'yesterday' ||
      (reportDateFilter?.type === 'custom' && reportDateFilter.start === reportDateFilter.end)

    if (isSingleDay) {
      // Group by Hour (08:00 to 23:00)
      const hourMap = {}
      for (let h = 8; h <= 23; h++) {
        const label = `${h.toString().padStart(2, '0')}:00`
        hourMap[label] = { label, revenue: 0, profit: 0, count: 0 }
      }
      for (const s of periodSales) {
        const dateObj = new Date(s.date)
        const h = dateObj.getHours()
        const label = `${h.toString().padStart(2, '0')}:00`
        if (hourMap[label]) {
          hourMap[label].revenue += s.total || 0
          hourMap[label].profit += s.profit || 0
          hourMap[label].count += 1
        }
      }
      return Object.values(hourMap)
    }

    // Group by Date YYYY-MM-DD
    const dateMap = {}
    for (const s of periodSales) {
      const d = (s.date || '').slice(0, 10)
      if (!d) continue
      if (!dateMap[d]) {
        dateMap[d] = { rawDate: d, revenue: 0, profit: 0, count: 0 }
      }
      dateMap[d].revenue += s.total || 0
      dateMap[d].profit += s.profit || 0
      dateMap[d].count += 1
    }

    const sorted = Object.values(dateMap).sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    if (sorted.length === 1) {
      const prevDate = new Date(new Date(sorted[0].rawDate).getTime() - 24 * 3600 * 1000)
      const pParts = prevDate.toISOString().slice(0, 10).split('-')
      const pStr = pParts.length === 3 ? `${pParts[2]}/${pParts[1]}` : 'Prev'
      const cParts = sorted[0].rawDate.split('-')
      const cStr = cParts.length === 3 ? `${cParts[2]}/${cParts[1]}` : sorted[0].rawDate
      return [
        { label: pStr, revenue: 0, profit: 0, count: 0 },
        { label: cStr, revenue: sorted[0].revenue, profit: sorted[0].profit, count: sorted[0].count },
      ]
    }

    return sorted.map((item) => {
      const parts = item.rawDate.split('-')
      const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.rawDate
      return {
        label: formatted,
        revenue: item.revenue,
        profit: item.profit,
        count: item.count,
      }
    })
  }, [periodSales, reportDateFilter])

  // Dosage Form / Category Breakdown for Donut Chart
  const categoryData = useMemo(() => {
    const map = {}
    for (const s of periodSales) {
      for (const item of s.items || []) {
        const m = medicineById(item.medicineId)
        const form = m?.dosageForm || m?.form || 'Other Form'
        map[form] = (map[form] || 0) + (item.total || 0)
      }
    }
    const list = Object.entries(map).map(([name, value]) => ({ name, value }))
    list.sort((a, b) => b.value - a.value)
    const top = list.slice(0, 6)
    const otherVal = list.slice(6).reduce((acc, curr) => acc + curr.value, 0)
    if (otherVal > 0) {
      top.push({ name: 'Others', value: otherVal })
    }
    const totalVal = top.reduce((a, b) => a + b.value, 0)
    return top.map((x) => ({
      ...x,
      percentage: totalVal > 0 ? Math.round((x.value / totalVal) * 100) : 0,
    }))
  }, [periodSales])

  // Payment Channels Breakdown
  const paymentData = useMemo(() => {
    const map = { CASH: 0, CARD: 0, DIGITAL: 0, CREDIT: 0, SPLIT: 0 }
    for (const s of periodSales) {
      const pm = (s.paymentMethod || s.paymentType || s.payMethod || 'CASH').toUpperCase()
      const key = map[pm] !== undefined ? pm : 'CASH'
      map[key] += s.total || 0
    }
    const labels = {
      CASH: 'Cash Counter',
      CARD: 'Credit / Debit Cards',
      DIGITAL: 'EasyPaisa / JazzCash',
      CREDIT: 'Customer Udhar / Credit',
      SPLIT: 'Split Multi-Payment',
    }
    const total = Object.values(map).reduce((a, b) => a + b, 0)
    return Object.entries(map)
      .filter(([_, val]) => val > 0)
      .map(([key, value]) => ({
        key,
        name: labels[key] || key,
        value,
        color: PAYMENT_COLORS[key] || '#714B67',
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [periodSales])

  // Top 7 Pharmaceutical Companies Breakdown
  const topCompanies = useMemo(() => {
    const map = {}
    for (const s of periodSales) {
      for (const item of s.items || []) {
        const m = medicineById(item.medicineId)
        const comp = (m?.manufacturer || 'Unassigned').trim()
        if (!map[comp]) map[comp] = { name: comp, revenue: 0, units: 0 }
        map[comp].revenue += item.total || 0
        map[comp].units += item.qty || 0
      }
    }
    const list = Object.values(map)
    list.sort((a, b) => b.revenue - a.revenue)
    return list.slice(0, 7)
  }, [periodSales])

  // Peak Counter Rush Analysis (Hours 8am to 11pm)
  const hourlyRush = useMemo(() => {
    const hours = []
    for (let h = 8; h <= 23; h++) {
      const label = h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`
      hours.push({ hour: h, label, invoices: 0, revenue: 0 })
    }
    for (const s of periodSales) {
      const h = new Date(s.date).getHours()
      const found = hours.find((x) => x.hour === h)
      if (found) {
        found.invoices += 1
        found.revenue += s.total || 0
      }
    }
    return hours
  }, [periodSales])

  // Weekly Day of Week Velocity & Pattern
  const dayOfWeekData = useMemo(() => {
    const days = [
      { day: 'Mon', full: 'Monday', revenue: 0, invoices: 0 },
      { day: 'Tue', full: 'Tuesday', revenue: 0, invoices: 0 },
      { day: 'Wed', full: 'Wednesday', revenue: 0, invoices: 0 },
      { day: 'Thu', full: 'Thursday', revenue: 0, invoices: 0 },
      { day: 'Fri', full: 'Friday', revenue: 0, invoices: 0 },
      { day: 'Sat', full: 'Saturday', revenue: 0, invoices: 0 },
      { day: 'Sun', full: 'Sunday', revenue: 0, invoices: 0 },
    ]
    for (const s of periodSales) {
      if (!s.date) continue
      const dateObj = new Date(s.date)
      const jsDay = dateObj.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
      const index = jsDay === 0 ? 6 : jsDay - 1
      if (days[index]) {
        days[index].revenue += s.total || 0
        days[index].invoices += 1
      }
    }
    return days
  }, [periodSales])

  // Top 5 Profit-Yielding Medicines
  const topMedicines = useMemo(() => {
    const map = {}
    for (const s of periodSales) {
      for (const item of s.items || []) {
        const id = item.medicineId
        const m = medicineById(id)
        if (!map[id]) {
          map[id] = {
            name: m?.name || 'Unknown',
            strength: m?.strength || '',
            manufacturer: m?.manufacturer || 'General',
            units: 0,
            revenue: 0,
            profit: 0,
          }
        }
        map[id].units += item.qty || 0
        map[id].revenue += item.total || 0
        map[id].profit += (item.total || 0) - (item.qty || 0) * (item.purchasePrice || m?.purchasePrice || 0)
      }
    }
    const list = Object.values(map)
    list.sort((a, b) => b.profit - a.profit)
    return list.slice(0, 5)
  }, [periodSales])

  // Fast-Moving Top Volume Products
  const fastMovingMedicines = useMemo(() => {
    const map = {}
    for (const s of periodSales) {
      for (const item of s.items || []) {
        const id = item.medicineId
        const m = medicineById(id)
        if (!map[id]) {
          map[id] = {
            name: m?.name || 'Unknown',
            strength: m?.strength || '',
            manufacturer: m?.manufacturer || 'General',
            units: 0,
            revenue: 0,
          }
        }
        map[id].units += item.qty || 0
        map[id].revenue += item.total || 0
      }
    }
    const list = Object.values(map)
    list.sort((a, b) => b.units - a.units)
    return list.slice(0, 5)
  }, [periodSales])

  // Cashier / Staff Productivity Leaderboard
  const cashierLeaderboard = useMemo(() => {
    const map = {}
    for (const s of periodSales) {
      const name = (s.soldByName || 'Counter Staff').trim()
      if (!map[name]) {
        map[name] = { name, invoices: 0, revenue: 0, profit: 0, units: 0 }
      }
      map[name].invoices += 1
      map[name].revenue += s.total || 0
      map[name].profit += s.profit || 0
      for (const item of s.items || []) {
        map[name].units += item.qty || 0
      }
    }
    const list = Object.values(map)
    list.sort((a, b) => b.revenue - a.revenue)
    return list.map((c) => ({
      ...c,
      avgTicket: c.invoices > 0 ? Math.round(c.revenue / c.invoices) : 0,
      grade: c.invoices >= 15 ? 'A+' : c.invoices >= 5 ? 'A' : 'Standard',
    }))
  }, [periodSales])

  // Peak Hour Highlight
  const peakHour = useMemo(() => {
    if (!hourlyRush.length) return null
    return [...hourlyRush].sort((a, b) => b.revenue - a.revenue)[0]
  }, [hourlyRush])

  function handleExportOverviewCSV() {
    const header = 'Metric,Value\n'
    const rows = [
      `Gross Revenue,${kpis.revenue}`,
      `Net Profit,${kpis.profit}`,
      `Margin %,${kpis.marginPct}%`,
      `Invoices Processed,${kpis.invoices}`,
      `Units Sold,${kpis.units}`,
      `Discounts Given,${kpis.discount}`,
      `Refunds Total,${kpis.totalRefunds}`,
      `Digital Payment Ratio,${kpis.digitalRatio}%`,
      `Inventory Cost,${kpis.stockCost}`,
    ].join('\n')
    const encodedUri = encodeURI(`data:text/csv;charset=utf-8,${header}${rows}`)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Business_Analytics_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-5 w-full pb-16 font-sans text-slate-800">
      {/* ── Top Header (Merged into Page) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1 py-1">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#3b1734] text-white flex items-center justify-center shadow-sm shrink-0">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Business Analytics & Intelligence
              </h1>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Consolidated financial intelligence, margin dynamics, multi-channel payment channels & staff efficiency
            </p>
          </div>
        </div>

        {/* Global Action Buttons - Single clean row without line wrap */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSwitchToTabular}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
            title="Switch to detailed tabular reports"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Tabular Reports (8)</span>
          </button>

          <button
            onClick={handleExportOverviewCSV}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Download analytics summary CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="bg-[#3b1734] hover:bg-[#522249] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Total Sales" value={fmt(kpis.revenue)} sub={`${kpis.invoices} invoices`} icon={CircleDollarSign} />
        <MetricCard title="Profit" value={fmt(kpis.profit)} sub={`${kpis.marginPct}% margin`} icon={TrendingUp} />
        <MetricCard title="Avg. Bill" value={fmt(kpis.avgBasket)} sub="Per invoice" icon={Receipt} />
        <MetricCard title="Units Sold" value={kpis.units.toLocaleString()} sub="Packs / units" icon={Package} />
        <MetricCard
          title="Discounts"
          value={fmt(kpis.discount)}
          sub={`${kpis.revenue > 0 ? ((kpis.discount / (kpis.revenue + kpis.discount)) * 100).toFixed(1) : 0}% of sales`}
          icon={Percent}
        />
        <MetricCard
          title="Card / Digital"
          value={`${kpis.digitalRatio}%`}
          sub={fmt((kpis.revenue * kpis.digitalRatio) / 100)}
          icon={CreditCard}
        />
        <MetricCard title="Returns" value={fmt(kpis.totalRefunds)} sub={`${kpis.refundRatio}% of sales`} icon={RotateCcw} />
        <MetricCard
          title="Stock Value"
          value={fmt(kpis.stockCost)}
          sub={`${db.medicines?.length || 0} products (at cost)`}
          icon={Building2}
        />
      </div>

      {/* ── Toolbar Card (Branch Filter, Date Filter & Perspective Tabs - matching Image 2) ── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Branch Selector & Date Range Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-[#714B67] shrink-0" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">🌐 Network Consolidated (All Hubs)</option>
              {(db.branches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Bar */}
          <DateFilterBar
            filterState={reportDateFilter}
            onChange={setReportDateFilter}
            asDropdown
            dropdownClassName="rounded-xl py-2 px-3 text-xs bg-slate-50 border border-slate-200 font-bold text-slate-700"
          />
        </div>

        {/* Right Side: Analytical Perspective Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold custom-scroll">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer text-xs font-bold shrink-0 ${
              activeTab === 'overview'
                ? 'bg-[#3b1734] text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            📈 Revenue Dynamics
          </button>
          <button
            onClick={() => setActiveTab('pharma')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer text-xs font-bold shrink-0 ${
              activeTab === 'pharma'
                ? 'bg-[#3b1734] text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            🏢 Pharma Demand
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer text-xs font-bold shrink-0 ${
              activeTab === 'payments'
                ? 'bg-[#3b1734] text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            💳 Payment Channels
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer text-xs font-bold shrink-0 ${
              activeTab === 'staff'
                ? 'bg-[#3b1734] text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            👥 Counter & Staff
          </button>
        </div>
      </div>

      {/* ── TAB 1: REVENUE & TIMELINE DYNAMICS ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Row 1: Dual Trajectory Area Chart (2 Cols) + Dosage Form Donut (1 Col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Revenue & Profit Curve (2 Columns) */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#714B67]" />
                    <h3 className="font-semibold text-sm text-slate-800">
                      Sales & Profit
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Daily sales vs profit
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: '#714B67', height: 3 }} />
                    Sales
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: '#10b981', height: 3 }} />
                    Profit
                  </span>
                </div>
              </div>

              <div className="w-full" style={{ height: 280 }}>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={trendData} margin={{ top: 10, right: 24, left: 4, bottom: 4 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#714B67" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#714B67" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                        padding={{ left: 8, right: 8 }}
                        interval="preserveStartEnd"
                        minTickGap={16}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tickFormatter={(v) => (v >= 1000 ? `Rs ${Math.round(v / 1000)}k` : `Rs ${v}`)}
                      />
                      <Tooltip content={<CustomAreaTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#714B67"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        name="Revenue"
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorProfit)"
                        name="Profit"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-[#714B67] mb-2">
                      <Activity className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">No Sales in Selected Period</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      Switch date range or branch filter to view performance trajectory.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Sales by Dosage Form Donut (1 Column) */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#714B67]" />
                    <h3 className="font-semibold text-sm text-slate-800">
                      Sales by Form
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Tablet, syrup, injection etc.</p>
                </div>
              </div>

              <div className="h-44 w-full flex items-center justify-center relative">
                {categoryData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={176}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val) => [fmt(val), 'Sales']}
                          contentStyle={{
                            borderRadius: '12px',
                            background: '#0f172a',
                            color: '#fff',
                            border: 'none',
                            fontSize: '11px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                      <span className="text-sm font-black text-slate-900">{fmt(kpis.revenue)}</span>
                    </div>
                  </>
                ) : (
                  <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <Package className="w-8 h-8 text-slate-300 mb-1" />
                    <p className="text-xs font-bold text-slate-500">No Dosage Data</p>
                  </div>
                )}
              </div>

              {/* Mini Legend List */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-36 overflow-y-auto custom-scroll text-xs">
                {categoryData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                      />
                      <span className="font-semibold text-slate-700 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-slate-600">{fmt(item.value)}</span>
                      <span className="font-bold text-slate-400 text-[10px] w-7 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Top Pharma Manufacturers (1 Col) + 24-Hour Counter Rush Velocity (1 Col) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Companies */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#714B67]" />
                    <h3 className="font-semibold text-sm text-slate-800">
                      Top Companies
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    By sales amount
                  </p>
                </div>
              </div>

              <div className="h-60 w-full pt-1">
                {topCompanies.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={topCompanies}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                        width={110}
                      />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="revenue" fill="#714B67" radius={[0, 6, 6, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <Building2 className="w-8 h-8 text-slate-300 mb-1" />
                    <p className="text-xs font-bold text-slate-500">No Pharma Demand Data</p>
                  </div>
                )}
              </div>
            </div>

            {/* Operational Rush Hours Distribution */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#714B67]" />
                    <h3 className="font-semibold text-sm text-slate-800">
                      Busy Hours
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Invoices per hour
                  </p>
                </div>
              </div>

              <div className="h-60 w-full pt-1">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={hourlyRush} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(val, name) => [
                        name === 'invoices' ? `${val} checkouts` : fmt(val),
                        name === 'invoices' ? 'Invoices' : 'Sales',
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        background: '#0f172a',
                        color: '#fff',
                        border: 'none',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="invoices" fill="#0284c7" radius={[6, 6, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Day-of-Week Velocity (1 Col) + Multi-Channel Payment Channels (1 Col) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Day of Week Sales Performance */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#714B67]" />
                    <h3 className="font-semibold text-sm text-slate-800">
                      Sales by Day
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Monday to Sunday
                  </p>
                </div>
              </div>

              <div className="h-60 w-full pt-1">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                    />
                    <Tooltip
                      formatter={(val, name, item) => [
                        fmt(val),
                        `Sales (${item.payload.invoices} tickets)`,
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        background: '#0f172a',
                        color: '#fff',
                        border: 'none',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#714B67]" />
                    <h3 className="font-semibold text-sm text-slate-800">
                      Payment Methods
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Cash, card, digital, udhar
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 pt-1">
                <div className="h-44 w-full flex items-center justify-center relative">
                  {paymentData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={176}>
                        <PieChart>
                          <Pie
                            data={paymentData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={46}
                            outerRadius={68}
                            paddingAngle={3}
                          >
                            {paymentData.map((entry, index) => (
                              <Cell key={`pay-cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val) => [fmt(val), 'Volume']}
                            contentStyle={{
                              borderRadius: '12px',
                              background: '#0f172a',
                              color: '#fff',
                              border: 'none',
                              fontSize: '11px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[9px] uppercase font-bold text-slate-400">Paid In</span>
                        <span className="text-xs font-black text-slate-900">{fmt(kpis.revenue)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400 font-medium">No settlements recorded</div>
                  )}
                </div>

                {/* Breakdown List */}
                <div className="space-y-1.5 text-xs">
                  {paymentData.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between text-[11px] bg-slate-50/80 p-1.5 rounded-xl border border-slate-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-bold text-slate-700 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-slate-800">{fmt(item.value)}</span>
                        <span className="font-black text-slate-500 text-[10px] w-8 text-right bg-white px-1 py-0.5 rounded border border-slate-200">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PHARMA & INVENTORY DEMAND ── */}
      {activeTab === 'pharma' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Pharma Companies Bar Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#714B67]" />
                    <h3 className="font-semibold text-sm text-slate-800">
                      Top Pharma Manufacturers Market Share
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Ranked by gross customer demand revenue</p>
                </div>
              </div>

              <div className="w-full pt-1" style={{ height: 280, minHeight: 280 }}>
                {topCompanies.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={topCompanies}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 35, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#475569"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={95}
                      />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="revenue" fill="#714B67" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No company sales records found.
                  </div>
                )}
              </div>
            </div>

            {/* Fast Moving Replenishment Products */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <div>
                      <h3 className="font-semibold text-sm text-slate-800">
                        Fastest-Moving Dispensed Medicines
                      </h3>
                      <p className="text-[11px] text-slate-400">Products with highest counter velocity</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    High Turn Rate
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Medicine</th>
                        <th className="py-2.5 px-3 text-right">Units Dispensed</th>
                        <th className="py-2.5 px-3 text-right">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fastMovingMedicines.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-400 text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{m.name}</div>
                            <div className="text-[10px] text-slate-400">{m.manufacturer}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
                            {m.units} units
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900">{fmt(m.revenue)}</td>
                        </tr>
                      ))}
                      {!fastMovingMedicines.length && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                            No sales data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Highest Profit-Yielding Medicines Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <div>
                  <h3 className="font-semibold text-sm text-slate-800">
                    Top Profit-Generating Pharmaceutical Products
                  </h3>
                  <p className="text-[11px] text-slate-400">Products producing highest net profit margins</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                High Margin
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Medicine Name</th>
                    <th className="py-2.5 px-3">Manufacturer</th>
                    <th className="py-2.5 px-3 text-right">Units Sold</th>
                    <th className="py-2.5 px-3 text-right">Gross Sales</th>
                    <th className="py-2.5 px-3 text-right">Net Margin</th>
                    <th className="py-2.5 px-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topMedicines.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-bold text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{m.name}</td>
                      <td className="py-2.5 px-3 text-slate-500">{m.manufacturer}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{m.units}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{fmt(m.revenue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {fmt(m.profit)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {m.revenue > 0 ? `${Math.round((m.profit / m.revenue) * 100)}%` : '0%'}
                      </td>
                    </tr>
                  ))}
                  {!topMedicines.length && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                        No sales recorded in selected timeframe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: PAYMENT CHANNELS & CUSTOMERS ── */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Payment Method Pie Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-[#714B67]" />
                  <h3 className="font-semibold text-sm text-slate-800">
                    Multi-Channel Payment Split
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500">Distribution by settlement channel</p>
              </div>

              <div className="h-48 w-full flex items-center justify-center relative">
                {paymentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={192}>
                    <PieChart>
                      <Pie
                        data={paymentData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val) => [fmt(val), 'Volume']}
                        contentStyle={{
                          borderRadius: '12px',
                          background: '#0f172a',
                          color: '#fff',
                          border: 'none',
                          fontSize: '11px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-slate-400">No payment data recorded</div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                {paymentData.map((item) => (
                  <div key={item.key} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-700">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-800">{fmt(item.value)}</span>
                      <span className="font-bold text-slate-400 text-[10px] w-8 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Demographics & Loyalty Breakdown */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#714B67]" />
                    <h3 className="font-semibold text-sm text-slate-800">
                      Customer Retention & Profile Dynamics
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Registered loyalty customer accounts vs counter walk-in visitors
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {kpis.uniqueCustomers} Active Accounts
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Loyalty Invoices</span>
                  <strong className="text-xl font-black text-slate-900 mt-1 block">
                    {kpis.loyaltySalesRatio}%
                  </strong>
                  <span className="text-[10px] text-slate-500">Tracked with customer account</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Walk-in Counter</span>
                  <strong className="text-xl font-black text-slate-900 mt-1 block">
                    {100 - kpis.loyaltySalesRatio}%
                  </strong>
                  <span className="text-[10px] text-slate-500">General anonymous checkouts</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Customer Spend</span>
                  <strong className="text-xl font-black text-emerald-700 mt-1 block font-mono">
                    {fmt(kpis.avgBasket)}
                  </strong>
                  <span className="text-[10px] text-slate-500">Gross ticket size</span>
                </div>
              </div>

              {/* Cash vs Digital Ratio Visual Progress */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">Digital Payment Adoption</span>
                  <span className="text-indigo-700 font-mono">{kpis.digitalRatio}% Digital</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${100 - kpis.digitalRatio}%` }}
                    title={`Cash: ${100 - kpis.digitalRatio}%`}
                  />
                  <div
                    className="bg-indigo-600 h-full transition-all"
                    style={{ width: `${kpis.digitalRatio}%` }}
                    title={`Digital: ${kpis.digitalRatio}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Cash: {100 - kpis.digitalRatio}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600" /> Digital / Card: {kpis.digitalRatio}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: COUNTER & STAFF PRODUCTIVITY ── */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#714B67]" />
                <div>
                  <h3 className="font-semibold text-sm text-slate-800">
                    Counter Staff & Cashier Performance Velocity
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Productivity, transaction volume, and revenue handled per cashier operator
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                Staff Velocity
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4 text-center">Invoices</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Total Revenue</th>
                    <th className="py-3 px-4 text-right">Avg Ticket</th>
                    <th className="py-3 px-4 text-right">Generated Profit</th>
                    <th className="py-3 px-4 text-center">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashierLeaderboard.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-bold text-[12px]">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-[10px] text-slate-400">Counter Operator</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {c.invoices}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">{c.units}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {fmt(c.revenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                        {fmt(c.avgTicket)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                        {fmt(c.profit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${
                            c.grade === 'A+'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {c.grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!cashierLeaderboard.length && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        No cashier activity recorded for selected timeframe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
