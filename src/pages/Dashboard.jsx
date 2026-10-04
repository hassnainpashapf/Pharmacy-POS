import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { useNavigate } from 'react-router'
import { ownerSalesComparison } from '../lib/ownerSalesChart'
import {
  useDB,
  fmt,
  currentUser,
  enterpriseDashboardData,
  addCustomer,
} from '../lib/db'
import {
  ShoppingCart,
  UserPlus,
  PlusCircle,
  FileText,
  Truck,
  DollarSign,
  TrendingUp,
  Package,
  Users,
  CreditCard,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Clock,
  ChevronDown,
  Receipt as ReceiptIcon,
  Building2,
  Layers,
  ClipboardCheck,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Zap,
  ArrowUpRight,
} from 'lucide-react'

export default function Dashboard() {
  const db = useDB()
  const nav = useNavigate()
  const me = currentUser()
  const [, refreshClock] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => refreshClock((value) => value + 1), 60000)
    return () => clearInterval(timer)
  }, [])
  const data = enterpriseDashboardData()

  const [activeRoleView, setActiveRoleView] = useState('OWNER')
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')

  if (activeRoleView !== 'OWNER') {
    return <RoleDashboard role={activeRoleView} setRole={setActiveRoleView} data={data} nav={nav} me={me} />
  }

  const curBranch = data.scopeLabel

  const handleAddCustomerSubmit = (e) => {
    e.preventDefault()
    if (!newCustName.trim()) return
    addCustomer({ name: newCustName, phone: newCustPhone, points: 0, balance: 0 })
    setNewCustName('')
    setNewCustPhone('')
    setShowAddCustomer(false)
  }

  return (
    <div className="dashboard-view space-y-6 w-full pb-16 font-sans text-slate-800">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#3b1734] text-white flex items-center justify-center font-black shadow-sm border border-[#280c23]">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {data.greeting}, <span className="text-[#3b1734]">{me?.name || 'Store Admin'}</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live POS
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {curBranch} · {data.dateLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Switchers */}
          <div className="view-switcher inline-flex items-center p-1 rounded-2xl border border-slate-200 bg-white shadow-xs text-xs font-semibold" aria-label="Dashboard views">
            {['OWNER', 'MANAGER', 'PHARMACIST', 'CASHIER', 'RECEPTIONIST'].map((item) => (
              <button
                key={item}
                onClick={() => setActiveRoleView(item)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeRoleView === item
                    ? 'bg-[#3b1734] text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item === 'OWNER' ? 'Owner' : item[0] + item.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* All Branches Dropdown */}
          <div
            onClick={() => nav('/branches')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-all"
          >
            <Building2 className="w-3.5 h-3.5 text-[#714B67]" />
            <span>{curBranch}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>

          {/* New Sale Button */}
          <button
            onClick={() => nav('/pos')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>+ New Sale</span>
          </button>
        </div>
      </div>

      {/* 2. Quick Action Toolbar */}
      <div className="quick-actions grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* New Sale */}
        <button type="button"
          onClick={() => nav('/pos')}
          className="bg-white border border-slate-200 hover:border-[#714B67]/40 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#f5eef4] text-[#714B67] flex items-center justify-center group-hover:scale-105 transition-transform">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-[#714B67]">New Sale POS</div>
            <div className="text-[10px] text-slate-400">Fast checkout & print</div>
          </div>
        </button>

        {/* Add Customer */}
        <button type="button"
          onClick={() => setShowAddCustomer(true)}
          className="bg-white border border-slate-200 hover:border-[#714B67]/40 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#ffedd5] text-[#ea580c] flex items-center justify-center group-hover:scale-105 transition-transform">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-[#ea580c]">Add Customer</div>
            <div className="text-[10px] text-slate-400">Register patient & ledger</div>
          </div>
        </button>

        {/* Add Medicine */}
        <button type="button"
          onClick={() => nav('/medicines')}
          className="bg-white border border-slate-200 hover:border-[#714B67]/40 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#e6f7f2] text-[#008f8b] flex items-center justify-center group-hover:scale-105 transition-transform">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-[#008f8b]">Add Medicine</div>
            <div className="text-[10px] text-slate-400">Expand drug catalogue</div>
          </div>
        </button>

        {/* Dispensing POS */}
        <button type="button"
          onClick={() => nav('/pos')}
          className="bg-white border border-slate-200 hover:border-[#714B67]/40 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#fef9c3] text-[#ca8a04] flex items-center justify-center group-hover:scale-105 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-[#ca8a04]">Dispensing POS</div>
            <div className="text-[10px] text-slate-400">Rx queue & counter billing</div>
          </div>
        </button>

        {/* New Purchase */}
        <button type="button"
          onClick={() => nav('/purchases')}
          className="bg-white border border-slate-200 hover:border-[#714B67]/40 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#e0f2fe] text-[#0284c7] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 group-hover:text-[#0284c7]">New Purchase</div>
            <div className="text-[10px] text-slate-400">Stock in & bills ledger</div>
          </div>
        </button>
      </div>

      {/* 2. Attention & Action Required (5 Cards matching top Quick Action styling & size exactly) */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 bg-amber-500 rounded-full" />
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Attention & Action Required</h2>
        </div>
        <div className="quick-actions grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Low Stock */}
          <button
            type="button"
            onClick={() => nav('/inventory')}
            className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition-all flex items-center gap-3 text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-amber-700">{data.attention.lowStock} Items</div>
              <div className="text-[10px] text-slate-400">Low Stock</div>
            </div>
          </button>

          {/* Out of Stock */}
          <button
            type="button"
            onClick={() => nav('/inventory')}
            className="bg-white border border-slate-200 hover:border-rose-400 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition-all flex items-center gap-3 text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-rose-700">{data.attention.outOfStock} Items</div>
              <div className="text-[10px] text-slate-400">Out of Stock</div>
            </div>
          </button>

          {/* Near Expiry */}
          <button
            type="button"
            onClick={() => nav('/inventory')}
            className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition-all flex items-center gap-3 text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-amber-700">{data.attention.nearExpiry} Batches</div>
              <div className="text-[10px] text-slate-400">Near Expiry (0–30d)</div>
            </div>
          </button>

          {/* Have Expired */}
          <button
            type="button"
            onClick={() => nav('/inventory')}
            className="bg-white border border-slate-200 hover:border-rose-400 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition-all flex items-center gap-3 text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-rose-700">{data.attention.expired} Batches</div>
              <div className="text-[10px] text-slate-400">Have expired</div>
            </div>
          </button>

          {/* Pending Payments */}
          <button
            type="button"
            onClick={() => nav('/suppliers')}
            className="bg-white border border-slate-200 hover:border-[#714B67]/60 rounded-2xl p-4 shadow-xs hover:shadow-md cursor-pointer transition-all flex items-center gap-3 text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#f5eef4] text-[#714B67] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-[#714B67]">
                {data.attention.pendingPayments === null ? '0' : `${data.attention.pendingPayments} Vendors`}
              </div>
              <div className="text-[10px] text-slate-400">Unpaid Balances</div>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Today's Overview (6 KPI Cards in a row) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-4 bg-[#3b1734] rounded-full" />
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">Today's Overview</h2>
        </div>
        <div className="kpi-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Sales */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Sales Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-[#e6f7f2] text-[#008f8b] flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
                {data.kpis.sales}
              </div>
              <div className="text-[11px] font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                <span>{data.kpis.salesChange}</span>
              </div>
            </div>
          </div>

          {/* Orders */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Orders / Invoices</span>
              <div className="w-8 h-8 rounded-xl bg-[#f5eef4] text-[#714B67] flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
                {data.kpis.orders}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 mt-1 flex items-center gap-1">
                <span>{data.kpis.ordersChange}</span>
              </div>
            </div>
          </div>

          {/* Profit */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Gross Profit</span>
              <div className="w-8 h-8 rounded-xl bg-[#ffedd5] text-[#ea580c] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
                {data.kpis.profit}
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-1">
                {data.kpis.profitChange}
              </div>
            </div>
          </div>

          {/* Customers */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Customers Served</span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
                {data.kpis.customers}
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-1">
                {data.kpis.customersChange}
              </div>
            </div>
          </div>

          {/* Gross Margin */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Gross Margin</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <ReceiptIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
                {data.kpis.grossMargin}
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-1">
                {data.kpis.marginChange}
              </div>
            </div>
          </div>

          {/* Overdue */}
          <div className="bg-white border border-rose-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-xs text-[#e11d48] font-semibold">
              <span>Supplier Payables</span>
              <div className="w-8 h-8 rounded-xl bg-[#ffe4e6] text-[#e11d48] flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-black text-[#e11d48] tracking-tight font-mono">
                {data.kpis.payables}
              </div>
              <div className="text-[11px] font-semibold text-[#e11d48] mt-1 flex items-center gap-1">
                <span>{data.kpis.payablesHint}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Stock & Inventory Operations Graphs */}
      <StockOperationsGraphs db={db} nav={nav} />

      {/* 5. Row 1 Analytics: Multi-Branch Revenue Trend, Category Breakdown, Inventory Health (Merged directly into page) */}
      <div className="py-2 border-y border-slate-200/80">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* Multi-Branch Revenue Trend (6 of 12 cols) */}
          <div className="lg:col-span-6 flex flex-col justify-between pt-2 lg:pt-0">
            <div className="mb-4">
              <h3 className="font-bold text-sm text-slate-900">Branch Revenue · {data.monthLabel}</h3>
            </div>

            <span className="sr-only">Owner branch revenue bar chart</span><RevenueBars entries={data.branchRevenueTrend.map((b) => ({ key: b.id || 'unassigned', label: b.name, total: b.total, color: b.color }))} hasRecords={data.hasMonthlySales} empty="No sales recorded this month in this scope." />
          </div>

          {/* Category Breakdown (3 of 12 cols) */}
          <div className="lg:col-span-3 flex flex-col justify-between pt-4 lg:pt-0 lg:pl-6">
            <div className="mb-2">
              <h3 className="font-bold text-sm text-slate-900">Category Breakdown</h3>
              <p className="text-[11px] text-slate-500 mt-1">{data.monthLabel} · category or dosage form</p>
            </div>

            <span className="sr-only">Owner category sales distribution: no data</span><Donut entries={data.categoryBreakdown} center={data.totalCategorySales} empty="No category sales recorded this month." label="Owner category sales distribution" keepFrame />
          </div>

          {/* Inventory Health (3 of 12 cols) */}
          <div className="lg:col-span-3 flex flex-col justify-between pt-4 lg:pt-0 lg:pl-6">
            <div className="mb-2">
              <h3 className="font-bold text-sm text-slate-900">Inventory Health</h3>
            </div>

            <span className="sr-only">Owner inventory health distribution: no data</span><Donut entries={data.inventoryHealth} center={`${data.catalogueCount} items`} empty="No medicines in the saved catalogue." label="Owner inventory health distribution" keepFrame />
            <p className="text-xs text-slate-600 mt-3">Stock cost <b>{data.stockValue}</b></p>
            <p className="text-[10px] text-amber-800 mt-1">Includes held/expired stock. Check expiry before dispensing.</p>
          </div>
        </div>
      </div>

      {/* 6. Row 2 Analytics: Sales Trend (Merged directly into page layout) */}
      <div className="py-3 border-y border-slate-200/80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-slate-900">Sales Trend</h3>
          <span className="text-xs text-slate-500">Monthly year comparison · Rs.</span>
        </div>

        <span className="sr-only">Owner monthly sales comparison by year</span><OwnerYearChart comparison={ownerSalesComparison(db)} />
      </div>

      {/* 7. Row 3 Analytics: Branch Performance Ranking, Capital at Risk, Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Branch Performance Ranking */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-900">Branch Performance Ranking <span className="block text-[11px] text-slate-500 font-normal mt-1">{data.monthLabel}</span></h3>
              <button
                onClick={() => nav('/branches')}
                className="text-xs font-semibold text-[#008f8b] hover:underline"
              >
                View All
              </button>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-2 text-left font-medium">RANK</th>
                  <th className="pb-2 text-left font-medium">BRANCH</th>
                  <th className="pb-2 text-left font-medium">REVENUE</th>
                  <th className="pb-2 text-right font-medium">ACTIVITY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {!data.hasMonthlySales && <tr><td colSpan={4} className="py-8 text-center text-slate-500">No sales to rank this month.</td></tr>}
                {data.hasMonthlySales && data.branchRankings.map((r) => (
                  <tr key={r.rank} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 text-slate-400">#{r.rank}</td>
                    <td className="py-2.5 text-slate-800 font-bold">{r.name}</td>
                    <td className="py-2.5 text-slate-900 font-mono">{r.revenue}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600"
                      >
                        <span>{r.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Capital at Risk ⚠ */}
        <div className="bg-[#fff1f2] rounded-2xl p-5 border-l-[5px] border-l-[#e11d48] border-t border-r border-b border-rose-300 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-[#9f1239] flex items-center gap-1.5">
                  <span>Capital at Risk</span>
                  <span className="text-[#e11d48]">⚠</span>
                </h3>
                <p className="text-[11px] text-[#9f1239]/80 mt-0.5">Expired + expiring within 30 days · cost value</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#9f1239] font-medium">Total Value at Risk</div>
                <div className="text-base font-extrabold text-[#e11d48] font-mono">
                  {data.capitalAtRisk.total}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 mt-4 max-h-80 overflow-y-auto">
              {!data.capitalAtRisk.items.length && <p className="text-xs text-slate-500 py-8 text-center">No stocked batches expired or due within 30 days.</p>}
              {data.capitalAtRisk.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-3 rounded-xl border border-rose-300 shadow-sm flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">{item.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{item.batch}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900 font-mono">{item.value}</div>
                    <div className={`text-[10px] font-medium flex items-center gap-1 justify-end mt-0.5 ${
                      item.days < 0 ? 'text-[#e11d48]' : 'text-[#d97706]'
                    }`}>
                      <Clock className="w-2.5 h-2.5" />
                      <span>{item.expiring}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-900">Recent Activity</h3>
              <button
                onClick={() => nav('/reports')}
                className="text-xs font-semibold text-[#008f8b] hover:underline"
              >
                View All
              </button>
            </div>

            <div className="space-y-3.5">
              {!data.recentActivity.length && <p className="text-xs text-slate-500 py-8 text-center">No activity recorded in this scope.</p>}
              {data.recentActivity.map((act) => (
                <div key={act.id} className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      act.type === 'sale'
                        ? 'bg-[#e6f7f2] text-[#008f8b]'
                        : act.type === 'purchase'
                        ? 'bg-[#e0f2fe] text-[#0284c7]'
                        : 'bg-[#fef3c7] text-[#d97706]'
                    }`}
                  >
                    {act.type === 'sale' ? (
                      <ReceiptIcon className="w-3.5 h-3.5" />
                    ) : act.type === 'purchase' ? (
                      <Truck className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{act.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{act.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Customer Dialog */}
      {showAddCustomer && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddCustomer(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#ffedd5] text-[#ea580c] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Add New Customer</h3>
              </div>
              <button
                onClick={() => setShowAddCustomer(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#714B67] focus:ring-1 focus:ring-[#714B67] font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Mobile / Phone Number</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="e.g. 0300-1234567"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#714B67] focus:ring-1 focus:ring-[#714B67] font-medium"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

// ---------------------------------------------------------
// Stock & Operations Visual Analytics Hubs (Donut Charts)
// ---------------------------------------------------------

function DashboardDonutChart({
  data = [],
  centerMain = '',
  centerSub = '',
  size = 176,
  strokeWidth = 13,
}) {
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  const r = 38
  const c = 2 * Math.PI * r

  let accumulated = 0
  const activeSlices = data.filter((d) => (Number(d.value) || 0) > 0)
  const hasMultiple = activeSlices.length > 1
  const gap = hasMultiple ? 2 : 0

  const slices = data.map((d) => {
    const val = Math.max(0, Number(d.value) || 0)
    const pct = total > 0 ? val / total : 0
    const rawDash = pct * c
    const dashLength = Math.max(0, rawDash - gap)
    const dashOffset = -accumulated
    accumulated += rawDash
    return {
      ...d,
      pct: Math.round(pct * 100),
      dashArray: `${dashLength} ${c - dashLength}`,
      dashOffset,
    }
  })

  return (
    <div className="flex justify-center my-3">
      <div className="relative flex items-center justify-center transition-transform hover:scale-105 duration-200" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="transform -rotate-90 drop-shadow-sm">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {total === 0 ? (
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
              strokeDasharray="4 4"
            />
          ) : (
            slices.map((s, i) => {
              if (s.value <= 0) return null
              return (
                <circle
                  key={i}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={s.dashArray}
                  strokeDashoffset={s.dashOffset}
                  className="transition-all duration-300"
                >
                  <title>{`${s.label}: ${s.displayValue || s.value} (${s.pct}%)`}</title>
                </circle>
              )
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none px-2">
          <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none truncate max-w-[105px]">
            {centerMain}
          </span>
          {centerSub && (
            <span className="text-[11px] font-extrabold text-slate-400 mt-1 leading-none uppercase tracking-wider truncate max-w-[105px]">
              {centerSub}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function CompanyStockGraph({ db, nav }) {
  const stats = useMemo(() => {
    const medicines = db?.medicines || []
    const batches = db?.batches || []
    const map = {}
    let totalStockUnits = 0
    let totalStockValuation = 0

    const medMap = new Map()
    medicines.forEach((m) => {
      if (m && m.id) medMap.set(m.id, m)
    })

    batches.forEach((b) => {
      const m = medMap.get(b.medicineId)
      const comp = ((m?.manufacturer || m?.company || 'Unassigned') + '').trim() || 'Other'
      const qty = Number(b.qty) || 0
      const cost = Number(b.purchasePrice) || Number(m?.purchasePrice) || 0
      const val = qty * cost

      if (!map[comp]) {
        map[comp] = { name: comp, units: 0, valuation: 0 }
      }
      map[comp].units += qty
      map[comp].valuation += val
      totalStockUnits += qty
      totalStockValuation += val
    })

    const sorted = Object.values(map).sort((a, b) => b.valuation - a.valuation)
    let list = []
    if (sorted.length <= 3) {
      list = sorted
    } else {
      const top2 = sorted.slice(0, 2)
      const others = sorted.slice(2)
      const otherUnits = others.reduce((acc, c) => acc + c.units, 0)
      const otherVal = others.reduce((acc, c) => acc + c.valuation, 0)
      list = [...top2, { name: `Other (${others.length})`, units: otherUnits, valuation: otherVal }]
    }

    return {
      totalCompanies: Object.keys(map).length,
      totalStockUnits,
      totalStockValuation,
      list,
    }
  }, [db?.medicines, db?.batches])

  const donutColors = ['#714B67', '#008f8b', '#8c6783', '#94a3b8']
  const donutData = stats.list.map((c, i) => ({
    label: c.name,
    value: c.valuation,
    color: donutColors[i % donutColors.length],
    displayValue: fmt(c.valuation),
  }))

  return (
    <div
      onClick={() => nav('/company-stock')}
      className="group p-2 cursor-pointer transition-all flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 group-hover:text-[#714B67] transition-colors">
                Company Stock
              </h3>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#714B67] transition-colors" />
        </div>

        <div className="mb-2">
          <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
            {fmt(stats.totalStockValuation)}
          </div>
          <div className="text-xs text-slate-400 font-medium mt-0.5">
            {stats.totalCompanies} brands
          </div>
        </div>

        {/* Donut Chart */}
        <DashboardDonutChart
          data={donutData}
          centerMain={String(stats.totalCompanies)}
          centerSub="brands"
          size={180}
          strokeWidth={14}
        />

        {/* Legend */}
        <div className="space-y-1.5 pt-2.5 border-t border-slate-100">
          {stats.list.length === 0 ? (
            <div className="text-xs text-slate-400 py-2 text-center">No stock recorded</div>
          ) : (
            stats.list.map((c, i) => {
              const pct = stats.totalStockValuation > 0 ? Math.round((c.valuation / stats.totalStockValuation) * 100) : 0
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600 truncate max-w-[150px]" title={c.name}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: donutColors[i % donutColors.length] }} />
                    <span className="truncate font-medium">{c.name}</span>
                  </span>
                  <span className="font-bold text-slate-800 tabular-nums">{pct}%</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export function StockAuditGraph({ db, nav }) {
  const stats = useMemo(() => {
    const audits = db?.stockAudits || []
    if (audits.length > 0) {
      const latest = audits[0]
      const matched = latest.matchedCount ?? (latest.items ? latest.items.filter((i) => i.variance === 0).length : 0)
      const shortage = latest.kamCount ?? (latest.items ? latest.items.filter((i) => i.variance < 0).length : 0)
      const surplus = latest.zyadaCount ?? (latest.items ? latest.items.filter((i) => i.variance > 0).length : 0)
      const total = matched + shortage + surplus || 1
      const accuracy = Math.round((matched / total) * 100)

      return {
        hasAudits: true,
        accuracy,
        totalItems: total,
        matched,
        shortage,
        surplus,
        matchedPct: Math.round((matched / total) * 100),
        shortagePct: Math.round((shortage / total) * 100),
        surplusPct: Math.max(0, 100 - Math.round((matched / total) * 100) - Math.round((shortage / total) * 100)),
      }
    }

    const medicines = db?.medicines || []
    const totalItems = medicines.length
    return {
      hasAudits: false,
      accuracy: 100,
      totalItems,
      matched: totalItems,
      shortage: 0,
      surplus: 0,
      matchedPct: 100,
      shortagePct: 0,
      surplusPct: 0,
    }
  }, [db?.stockAudits, db?.medicines, db?.batches])

  const auditDonutData = [
    { label: 'Matched', value: stats.matched, color: '#008f8b', displayValue: `${stats.matched} items` },
    { label: 'Shortage', value: stats.shortage, color: '#f43f5e', displayValue: `${stats.shortage} items` },
    { label: 'Excess', value: stats.surplus, color: '#714B67', displayValue: `${stats.surplus} items` },
  ]

  return (
    <div
      onClick={() => nav('/stock-audit')}
      className="group p-2 cursor-pointer transition-all flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#e6f7f2] text-[#008f8b] flex items-center justify-center font-bold">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 group-hover:text-[#008f8b] transition-colors">
                Stock Audit
              </h3>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#008f8b] transition-colors" />
        </div>

        <div className="mb-2">
          <div className="text-2xl font-black text-[#008f8b] tracking-tight font-mono">
            {stats.accuracy}%
          </div>
          <div className="text-xs text-slate-400 font-medium mt-0.5">
            {stats.totalItems.toLocaleString()} items
          </div>
        </div>

        {/* Donut Chart */}
        <DashboardDonutChart
          data={auditDonutData}
          centerMain={`${stats.accuracy}%`}
          centerSub="accuracy"
          size={180}
          strokeWidth={14}
        />

        {/* Legend */}
        <div className="space-y-1.5 pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#008f8b]" />
              <span className="font-medium">Matched</span>
            </span>
            <span className="font-bold text-[#008f8b] tabular-nums">
              {stats.matched} ({stats.matchedPct}%)
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-rose-500" />
              <span className="font-medium">Shortage (Kam)</span>
            </span>
            <span className={`font-bold tabular-nums ${stats.shortage > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {stats.shortage} ({stats.shortagePct}%)
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#714B67]" />
              <span className="font-medium">Excess (Zyada)</span>
            </span>
            <span className={`font-bold tabular-nums ${stats.surplus > 0 ? 'text-[#714B67]' : 'text-slate-400'}`}>
              {stats.surplus} ({stats.surplusPct}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ExpiryActionGraph({ db, nav }) {
  const stats = useMemo(() => {
    const batches = db?.batches || []
    const medicines = db?.medicines || []
    const medMap = new Map()
    medicines.forEach((m) => {
      if (m && m.id) medMap.set(m.id, m)
    })

    const now = new Date()
    let expiredUnits = 0
    let expiredCost = 0
    let criticalUnits = 0
    let criticalCost = 0
    let nearUnits = 0
    let safeUnits = 0

    batches.forEach((b) => {
      const qty = Number(b.qty) || 0
      if (qty <= 0) return
      const med = medMap.get(b.medicineId)
      const cost = Number(b.purchasePrice) || Number(med?.purchasePrice) || 0
      const val = qty * cost

      if (!b.expiry) {
        safeUnits += qty
        return
      }

      const exp = new Date(b.expiry)
      const days = Math.round((exp - now) / (1000 * 60 * 60 * 24))

      if (days < 0) {
        expiredUnits += qty
        expiredCost += val
      } else if (days <= 30) {
        criticalUnits += qty
        criticalCost += val
      } else if (days <= 90) {
        nearUnits += qty
      } else {
        safeUnits += qty
      }
    })

    const totalTrackedUnits = expiredUnits + criticalUnits + nearUnits + safeUnits || 1
    const capitalAtRisk = expiredCost + criticalCost

    return {
      expiredUnits,
      expiredCost,
      criticalUnits,
      criticalCost,
      nearUnits,
      safeUnits,
      capitalAtRisk,
      totalTrackedUnits,
      expiredPct: Math.round((expiredUnits / totalTrackedUnits) * 100),
      criticalPct: Math.round((criticalUnits / totalTrackedUnits) * 100),
      nearPct: Math.round((nearUnits / totalTrackedUnits) * 100),
      safePct: Math.max(0, 100 - Math.round((expiredUnits / totalTrackedUnits) * 100) - Math.round((criticalUnits / totalTrackedUnits) * 100) - Math.round((nearUnits / totalTrackedUnits) * 100)),
    }
  }, [db?.batches, db?.medicines])

  const expiryDonutData = [
    { label: 'Expired', value: stats.expiredUnits, color: '#f43f5e', displayValue: `${stats.expiredUnits.toLocaleString()} units` },
    { label: 'Critical', value: stats.criticalUnits, color: '#f59e0b', displayValue: `${stats.criticalUnits.toLocaleString()} units` },
    { label: 'Safe Stock', value: stats.safeUnits + stats.nearUnits, color: '#008f8b', displayValue: `${(stats.safeUnits + stats.nearUnits).toLocaleString()} units` },
  ]

  const totalAtRisk = stats.expiredUnits + stats.criticalUnits

  return (
    <div
      onClick={() => nav('/expiry-management')}
      className="group p-2 cursor-pointer transition-all flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 group-hover:text-[#714B67] transition-colors">
                Expiry Action
              </h3>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#714B67] transition-colors" />
        </div>

        <div className="mb-2">
          <div className={`text-2xl font-black tracking-tight font-mono ${stats.capitalAtRisk > 0 ? 'text-rose-600' : 'text-[#008f8b]'}`}>
            {fmt(stats.capitalAtRisk)}
          </div>
          <div className="text-xs text-slate-400 font-medium mt-0.5">
            {totalAtRisk.toLocaleString()} at risk
          </div>
        </div>

        {/* Donut Chart */}
        <DashboardDonutChart
          data={expiryDonutData}
          centerMain={totalAtRisk > 0 ? `${totalAtRisk.toLocaleString()}` : '0'}
          centerSub="at risk"
          size={180}
          strokeWidth={14}
        />

        {/* Legend */}
        <div className="space-y-1.5 pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-rose-500" />
              <span className="font-medium">Expired</span>
            </span>
            <span className={`font-bold tabular-nums ${stats.expiredUnits > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {stats.expiredUnits.toLocaleString()} units
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-500" />
              <span className="font-medium">Critical (0–30d)</span>
            </span>
            <span className={`font-bold tabular-nums ${stats.criticalUnits > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {stats.criticalUnits.toLocaleString()} units
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#008f8b]" />
              <span className="font-medium">Safe Stock</span>
            </span>
            <span className="font-bold text-[#008f8b] tabular-nums">
              {(stats.safeUnits + stats.nearUnits).toLocaleString()} units
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PurchaseReturnsGraph({ db, nav }) {
  const stats = useMemo(() => {
    const returns = db?.purchaseReturns || []
    let totalClaims = 0
    let creditNotes = 0
    let cashRefunds = 0
    let totalUnits = 0

    returns.forEach((r) => {
      const amt = Number(r.totalAmount) || 0
      totalClaims += amt
      if (r.settlementType === 'CREDIT_NOTE') {
        creditNotes += amt
      } else {
        cashRefunds += amt
      }

      (r.items || []).forEach((it) => {
        totalUnits += Number(it.qty) || 0
      })
    })

    const creditPct = totalClaims > 0 ? Math.round((creditNotes / totalClaims) * 100) : 100
    const cashPct = totalClaims > 0 ? Math.max(0, 100 - creditPct) : 0

    return {
      totalReturns: returns.length,
      totalClaims,
      creditNotes,
      cashRefunds,
      creditPct,
      cashPct,
      totalUnits,
    }
  }, [db?.purchaseReturns])

  const returnsDonutData = [
    { label: 'Credit Notes', value: stats.creditNotes, color: '#714B67', displayValue: fmt(stats.creditNotes) },
    { label: 'Cash Refunds', value: stats.cashRefunds, color: '#008f8b', displayValue: fmt(stats.cashRefunds) },
  ]

  return (
    <div
      onClick={() => nav('/purchase-returns')}
      className="group p-2 cursor-pointer transition-all flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 group-hover:text-[#714B67] transition-colors">
                Purchase Returns
              </h3>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#714B67] transition-colors" />
        </div>

        <div className="mb-2">
          <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
            {fmt(stats.totalClaims)}
          </div>
          <div className="text-xs text-slate-400 font-medium mt-0.5">
            {stats.totalReturns} debit notes
          </div>
        </div>

        {/* Donut Chart */}
        <DashboardDonutChart
          data={returnsDonutData}
          centerMain={`${stats.totalReturns}`}
          centerSub="debit notes"
          size={180}
          strokeWidth={14}
        />

        {/* Legend */}
        <div className="space-y-1.5 pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#714B67]" />
              <span className="font-medium">Credit Notes</span>
            </span>
            <span className="font-bold text-[#714B67] tabular-nums">
              {fmt(stats.creditNotes)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#008f8b]" />
              <span className="font-medium">Cash Refunds</span>
            </span>
            <span className="font-bold text-[#008f8b] tabular-nums">
              {fmt(stats.cashRefunds)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-300" />
              <span className="font-medium">Items Returned</span>
            </span>
            <span className="font-bold text-slate-700 tabular-nums">
              {stats.totalUnits.toLocaleString()} units
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StockOperationsGraphs({ db, nav }) {
  return (
    <div className="space-y-4 py-2 border-y border-slate-200/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-5 bg-[#714B67] rounded-full" />
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
            Inventory &amp; Stock Operations
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <div className="pt-2 md:pt-0"><CompanyStockGraph db={db} nav={nav} /></div>
        <div className="pt-4 md:pt-0 md:pl-6"><StockAuditGraph db={db} nav={nav} /></div>
        <div className="pt-4 md:pt-0 md:pl-6"><ExpiryActionGraph db={db} nav={nav} /></div>
        <div className="pt-4 md:pt-0 md:pl-6"><PurchaseReturnsGraph db={db} nav={nav} /></div>
      </div>
    </div>
  )
}

export function RoleDashboard({ role, setRole, data, nav, me }) {
  const db = useDB()
  const isManager = role === 'MANAGER'
  const isCashier = role === 'CASHIER'
  const isReceptionist = role === 'RECEPTIONIST'
  const isPharmacist = role === 'PHARMACIST'
  const pharmacy = isPharmacist ? pharmacistDashboardData(db) : null

  let title = 'Operations Dashboard'
  let cards = []

  if (isManager) {
    title = 'Manager Operations Dashboard'
    cards = [
      ['Today Sales', data.kpis.sales, data.kpis.salesChange],
      ['Today Transactions', data.kpis.orders, data.kpis.ordersChange],
      ['Average Sale Today', data.operations.todayAverage === null ? '—' : fmt(data.operations.todayAverage), 'Saved sales / recorded transactions'],
      ['Open Orders', data.attention.awaitingOrders, 'Purchase and wholesale orders in progress'],
      ['Low Stock Items', data.attention.lowStock, 'Positive stock at or below minimum'],
      ['Near Expiry', data.attention.nearExpiry, 'Stocked batches expiring in 0–30 days'],
      ['Stock Cost at Risk', data.capitalAtRisk.total, 'Expired + expiring within 30 days'],
      ['Supplier Payables', data.kpis.payables, data.kpis.payablesHint],
    ]
  } else if (isCashier) {
    title = 'Cashier Billing & Register Dashboard'
    cards = [
      ['Today Counter Sales', data.kpis.sales, 'Total billing generated today'],
      ['Invoices Processed', data.kpis.orders, 'Completed customer transactions'],
      ['Average Ticket Size', data.operations.todayAverage === null ? '—' : fmt(data.operations.todayAverage), 'Average sale amount per customer'],
      ['Customers Checked Out', data.kpis.customers, 'Unique customer lookups & sales'],
      ['Shift Register', 'Active & Open', 'Shift drawer tracking enabled'],
      ['Receipts Printed', data.kpis.orders, 'Cash & card slips issued'],
      ['Returns Recorded', (db.returns || []).length, 'Customer refund & exchange claims'],
      ['Awaiting Pickup', data.attention.awaitingOrders, 'Orders awaiting counter payment'],
    ]
  } else if (isReceptionist) {
    title = 'Receptionist & Patient Intake Dashboard'
    cards = [
      ['Registered Patients', (db.customers || []).length, 'Total registered customer database'],
      ['New Patients Today', data.kpis.customers, 'Walk-in & member registrations'],
      ['Prescriptions in Queue', data.attention.awaitingOrders, 'Drop-offs awaiting pharmacist verification'],
      ['Loyalty Members', (db.customers || []).filter((c) => (c.points || 0) > 0).length, 'Patients with active reward points'],
      ['Today Consultations', data.kpis.orders, 'Patients assisted at reception'],
      ['Customer Credits', 'Normal', 'No disputed balances'],
      ['Return Verifications', (db.returns || []).length, 'Recorded customer returns'],
      ['Front Desk Counter', data.scopeLabel, 'Intake station operational'],
    ]
  } else {
    title = 'Pharmacist Dispensing Dashboard'
    cards = [
      ['Units Dispensed Today', pharmacy.todayUnits.toLocaleString('en-PK'), 'Remaining saved sale quantities after returns'],
         ['Today Transactions', data.kpis.orders, 'Transactions'],
      ['Available Stock Units', pharmacy.availableUnits.toLocaleString('en-PK'), 'Active / available status with a valid, unexpired date'],
      ['Replenishment Priorities', pharmacy.replenishment.length, 'Catalogue items at / below minimum available stock'],
      ['Expiring Within 30 Days', pharmacy.nearExpiryUnits.toLocaleString('en-PK'), 'Available units · includes expiry today'],
      ['Expired Stock Units', pharmacy.expiredUnits.toLocaleString('en-PK'), 'Past-date or manually expired stock'],
      ['Held / Review Units', pharmacy.heldUnits.toLocaleString('en-PK'), 'Damaged, returned, reserved or missing valid expiry'],
      ['Today Sales', data.kpis.sales, 'Saved invoice totals after recorded returns'],
    ]
  }

  return (
    <div className="dashboard-view space-y-6 w-full pb-16 font-sans text-slate-800">
      {/* Role Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#3b1734] text-white flex items-center justify-center font-black shadow-sm border border-[#280c23]">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f5eef4] text-[#714B67] border border-[#714B67]/20">
                  {role} Station
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {data.greeting}, {me?.name || 'Team Member'} · {data.scopeLabel} · {data.dateLabel}
              </p>
            </div>
          </div>
        </div>

        {/* View Switchers */}
        <div className="view-switcher inline-flex items-center p-1 rounded-2xl border border-slate-200 bg-white shadow-xs text-xs font-semibold" aria-label="Dashboard views">
          {['OWNER', 'MANAGER', 'PHARMACIST', 'CASHIER', 'RECEPTIONIST'].map((item) => (
            <button
              key={item}
              onClick={() => setRole(item)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                role === item
                  ? 'bg-[#3b1734] text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {item === 'OWNER' ? 'Owner' : item[0] + item.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {cards.map(([label, value, hint], index) => {
          const Icon = [DollarSign, ReceiptIcon, Package, Truck, AlertTriangle, Clock, CreditCard, TrendingUp][index]
          return (
            <section key={label} className="metric-card bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-2">
                  <h2 className="text-xs font-bold text-slate-700">{label}</h2>
                  <div className="w-8 h-8 rounded-xl bg-[#f5eef4] text-[#714B67] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="metric-value text-2xl font-black text-slate-900 mt-2.5 tabular-nums">{value}</div>
              </div>
              {hint && <p className="text-[11px] text-slate-400 mt-2 line-clamp-1">{hint}</p>}
            </section>
          )
        })}
      </div>

      {/* Dedicated Stock & Inventory Operations Graphs */}
      <StockOperationsGraphs db={db} nav={nav} />

      {isManager && <ManagerOperations data={data} nav={nav} />}
      {isPharmacist && <PharmacistOperations data={data} pharmacy={pharmacy} nav={nav} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick Actions Card tailored to Role */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-4 bg-[#714B67] rounded-full" />
            <h3 className="font-bold text-sm text-slate-900">Role Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {isCashier ? (
              <>
                <button onClick={() => nav('/pos')} className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white rounded-xl p-3 text-xs font-bold shadow-xs transition-all cursor-pointer">
                  ⚡ Open POS Checkout
                </button>
                <button onClick={() => nav('/returns')} className="bg-[#e6f7f2] text-[#008f8b] hover:bg-[#d6f2ea] rounded-xl p-3 text-xs font-bold transition-all cursor-pointer">
                  🔄 Process Return
                </button>
                <button onClick={() => nav('/customers')} className="bg-slate-50 text-slate-800 hover:bg-slate-100 rounded-xl p-3 text-xs font-bold border border-slate-200 cursor-pointer">
                  👥 Customer Lookup
                </button>
                <button onClick={() => nav('/hardware')} className="bg-slate-50 text-slate-800 hover:bg-slate-100 rounded-xl p-3 text-xs font-bold border border-slate-200 cursor-pointer">
                  🖨️ Receipt & Drawer
                </button>
              </>
            ) : isReceptionist ? (
              <>
                <button onClick={() => nav('/customers')} className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white rounded-xl p-3 text-xs font-bold shadow-xs transition-all cursor-pointer">
                  ➕ New Patient / Customer
                </button>
                <button onClick={() => nav('/customers?tab=loyalty')} className="bg-[#e6f7f2] text-[#008f8b] hover:bg-[#d6f2ea] rounded-xl p-3 text-xs font-bold transition-all cursor-pointer">
                  ⭐ Loyalty & Credits
                </button>
                <button onClick={() => nav('/pos?tab=rx')} className="bg-slate-50 text-slate-800 hover:bg-slate-100 rounded-xl p-3 text-xs font-bold border border-slate-200 cursor-pointer">
                  📋 Prescription Queue
                </button>
                <button onClick={() => nav('/pos')} className="bg-slate-50 text-slate-800 hover:bg-slate-100 rounded-xl p-3 text-xs font-bold border border-slate-200 cursor-pointer">
                  🔍 Check Order Status
                </button>
              </>
            ) : (
              <>
                <button onClick={() => nav('/pos')} className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white rounded-xl p-3 text-xs font-bold shadow-xs transition-all cursor-pointer">
                  Open Sales POS
                </button>
                <button onClick={() => nav(isManager ? '/inventory' : '/inventory?tab=NEAR_EXPIRY')} className="bg-[#e6f7f2] text-[#008f8b] rounded-xl p-3 text-xs font-bold cursor-pointer">
                  {isManager ? 'Manage Stock' : 'Check Expiry'}
                </button>
                <button onClick={() => nav('/customers')} className="bg-slate-50 text-slate-800 hover:bg-slate-100 rounded-xl p-3 text-xs font-bold border border-slate-200 cursor-pointer">
                  Customers
                </button>
                <button onClick={() => nav('/reports?tab=sales')} className="bg-slate-50 text-slate-800 hover:bg-slate-100 rounded-xl p-3 text-xs font-bold border border-slate-200 cursor-pointer">
                  View Reports
                </button>
              </>
            )}
          </div>
        </div>

        {/* Priority Alerts Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-4 bg-rose-500 rounded-full" />
            <h3 className="font-bold text-sm text-slate-900">Priority Operational Alerts</h3>
          </div>
          <div className="space-y-2 text-xs">
            <button onClick={() => nav('/inventory?tab=EXPIRED')} className="block w-full text-left p-3 rounded-xl bg-rose-50 text-rose-800 hover:bg-rose-100 transition-colors border border-rose-100 cursor-pointer">
              Expired batches / items: <b>{data.attention.expired}</b>
              <span className="block mt-1 text-[10px]">Review inventory alerts →</span>
            </button>
            <button onClick={() => nav('/inventory')} className="block w-full text-left p-3 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors border border-amber-100 cursor-pointer">
              Low stock items: <b>{data.attention.lowStock}</b> · Out of stock: <b>{data.attention.outOfStock}</b>
              <span className="block mt-1 text-[10px]">Review replenishment stock →</span>
            </button>
            <div className="p-3 rounded-xl bg-[#f5eef4] text-[#714b67] border border-[#714b67]/20">
              Medicines in catalogue: <b>{data.catalogueCount}</b> · Active Branch: <b>{data.scopeLabel}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Pharmacist metrics are read-only projections of the selected branch's saved
// stock and sale items. A prescription workflow/count is not inferred from sales.
export function pharmacistDashboardData(db, now = new Date()) {
  const rows = (value) => Array.isArray(value) ? value : []
  const positive = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
  const scope = db.currentBranch || 'ALL'
  const scoped = (record) => scope === 'ALL' || record.branchId === scope
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const validDay = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null
    const timestamp = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null
  }
  const today = dateKey(now)
  const todayTime = validDay(today)
  const medicines = rows(db.medicines)
  const medicineMap = new Map(medicines.map((medicine) => [medicine.id, medicine]))
  const availableByMedicine = new Map()
  const statuses = [
    { label: 'Available', color: '#00A09D', count: 0 },
    { label: 'Expired', color: '#e11d48', count: 0 },
    { label: 'Damaged', color: '#ea580c', count: 0 },
    { label: 'Returned', color: '#0284c7', count: 0 },
    { label: 'Reserved', color: '#714B67', count: 0 },
    { label: 'Needs review', color: '#64748b', count: 0 },
  ]
  const expiryBuckets = ['Past expiry', '0–30 days', '31–90 days', 'Over 90 days', 'Missing / invalid date'].map((label, index) => ({ label, count: 0, batches: 0, color: ['#e11d48', '#d97706', '#714B67', '#00A09D', '#64748b'][index] }))
  const expiryQueue = []
  let totalUnits = 0
  let nearExpiryUnits = 0
  for (const batch of rows(db.batches).filter(scoped)) {
    const qty = positive(batch.qty)
    if (!qty) continue
    totalUnits += qty
    const expiry = validDay(batch.expiry)
    const days = expiry === null ? null : Math.round((expiry - todayTime) / 86400000)
    const status = String(batch.status || 'ACTIVE').toUpperCase()
    const statusIndex = (days !== null && days < 0) || status === 'EXPIRED' ? 1
      : status === 'DAMAGED' ? 2 : status === 'RETURNED' ? 3 : status === 'RESERVED' ? 4
      : days !== null && ['ACTIVE', 'AVAILABLE'].includes(status) ? 0 : 5
    statuses[statusIndex].count += qty
    const bucketIndex = days === null ? 4 : days < 0 ? 0 : days <= 30 ? 1 : days <= 90 ? 2 : 3
    expiryBuckets[bucketIndex].count += qty
    expiryBuckets[bucketIndex].batches++
    if (statusIndex === 0) {
      availableByMedicine.set(batch.medicineId, (availableByMedicine.get(batch.medicineId) || 0) + qty)
      if (days <= 30) nearExpiryUnits += qty
      if (days <= 90) expiryQueue.push({ id: batch.id, name: medicineMap.get(batch.medicineId)?.name || 'Unknown medicine', batch: batch.batchNo || 'Not recorded', qty, days, expiry: batch.expiry })
    }
  }
  const dailyUnits = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + index)
    return { key: dateKey(date), label: date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }), units: 0, count: 0 }
  })
  const dayMap = new Map(dailyUnits.map((entry) => [entry.key, entry]))
  for (const sale of rows(db.sales).filter(scoped)) {
    if (!sale.date) continue
    const date = new Date(sale.date)
    const key = /^\d{4}-\d{2}-\d{2}$/.test(String(sale.date)) ? (validDay(sale.date) === null ? '' : sale.date) : Number.isFinite(date.getTime()) ? dateKey(date) : ''
    const entry = dayMap.get(key)
    if (!entry) continue
    entry.count++
    // Returns mutate saved sale-item quantities; do not subtract them twice.
    entry.units += rows(sale.items).reduce((total, item) => total + positive(item.qty), 0)
  }
  const replenishment = medicines.map((medicine) => ({ id: medicine.id, name: medicine.name, qty: availableByMedicine.get(medicine.id) || 0, minimum: positive(medicine.minStock) }))
    .filter((medicine) => medicine.qty === 0 || medicine.qty <= medicine.minimum)
    .sort((a, b) => a.qty - b.qty || String(a.name).localeCompare(String(b.name)))
  return {
    totalUnits, availableUnits: statuses[0].count, expiredUnits: statuses[1].count,
    heldUnits: statuses.slice(2).reduce((total, entry) => total + entry.count, 0), nearExpiryUnits,
    statuses: statuses.map((entry) => ({ ...entry, pct: totalUnits ? entry.count / totalUnits * 100 : 0 })),
    expiryBuckets, expiryQueue: expiryQueue.sort((a, b) => a.days - b.days || String(a.batch).localeCompare(String(b.batch))),
    dailyUnits, todayUnits: dailyUnits.at(-1).units,
    sevenDayUnits: dailyUnits.slice(-7).reduce((total, entry) => total + entry.units, 0), replenishment,
  }
}

function PharmacistOperations({ data, pharmacy, nav }) {
  const cardClass = 'min-w-0 bg-white border border-slate-300 rounded-2xl p-5 shadow-sm'
  const linkClass = 'text-xs font-semibold text-[#008784] hover:underline'
  return <div className="space-y-4">
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <section className={`${cardClass} xl:col-span-2`} aria-label="Dispensing activity">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4"><div><h2 className="font-bold text-sm text-slate-900">Dispensing Activity</h2><p className="text-xs text-slate-500 mt-1">Last 14 calendar days · {data.scopeLabel}</p></div><button onClick={() => nav('/reports?tab=sales')} className={linkClass}>Review sales</button></div>
        <div className="flex flex-wrap gap-3 mb-4"><div className="rounded-xl bg-[#e6f7f2] p-3 flex-1"><p className="text-xs text-[#008784]">Units · last 7 days</p><p className="text-2xl font-bold text-slate-900 mt-1">{pharmacy.sevenDayUnits.toLocaleString('en-PK')}</p></div><div className="rounded-xl bg-[#f5eef4] p-3 flex-1"><p className="text-xs text-[#714B67]">Transactions · last 7 days</p><p className="text-2xl font-bold text-slate-900 mt-1">{data.operations.sevenDayOrders}</p></div></div>
        <DispensingUnitsChart entries={pharmacy.dailyUnits} />
      </section>
      <section className={cardClass} aria-label="Stock units by dispensing status">
        <div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-bold text-sm text-slate-900">Stock Status · Units</h2><button onClick={() => nav('/inventory')} className={linkClass}>Review stock</button></div>
        <Donut entries={pharmacy.statuses} center={`${pharmacy.totalUnits.toLocaleString('en-PK')} units`} empty="No positive stock quantities saved in this branch scope. Receive stock to see its status distribution." label="Stock units by status; exact quantities and percentages are in the legend" />
        <p className="text-[11px] text-amber-800 mt-3">Expired, held or undated stock is not available for dispensing.</p>
      </section>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className={cardClass} aria-label="Expiry exposure by stock units">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4"><div><h2 className="font-bold text-sm text-slate-900">Expiry Exposure</h2><p className="text-xs text-slate-500 mt-1">All positive stock, including held units · calendar days</p></div><button onClick={() => nav('/inventory?tab=NEAR_EXPIRY')} className={linkClass}>Batch & expiry</button></div>
        <QuantityBars entries={pharmacy.totalUnits ? pharmacy.expiryBuckets : []} label="Expiry buckets in stock units" empty="No stocked batches in this scope. Expiry buckets will appear when batch quantities are recorded." />
      </section>
      <section className={cardClass} aria-label="Top dispensed medicines">
        <h2 className="font-bold text-sm text-slate-900">Top Dispensed Medicines</h2><p className="text-xs text-slate-500 mt-1 mb-4">{data.monthLabel} · Top 5</p>
        <QuantityBars entries={data.operations.topMedicines.map((medicine, index) => ({ key: medicine.id || 'unassigned', label: medicine.name, count: medicine.units, color: index % 2 ? '#714B67' : '#00A09D' }))} label="Top medicines by recorded sale units" empty="No positive medicine quantities recorded in sales this month in this scope. Complete a sale to start this chart." />
      </section>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className={cardClass} aria-label="FEFO batch priorities">
        <div className="flex items-start justify-between gap-3 mb-4"><div><h2 className="font-bold text-sm text-slate-900">FEFO Batch Priorities</h2><p className="text-xs text-slate-500 mt-1">Available batches due within 90 days · earliest first</p></div><button onClick={() => nav('/inventory?tab=NEAR_EXPIRY')} className={linkClass}>Review batches</button></div>
        {!pharmacy.expiryQueue.length ? <p className="text-xs text-slate-500 py-8 text-center">No available, dated stock expires within 90 days in this scope. Review the status chart for expired or held stock.</p> : <ul className="space-y-2">{pharmacy.expiryQueue.slice(0, 5).map((batch) => <li key={batch.id} className="rounded-xl border border-slate-300 p-3"><div className="flex justify-between gap-3 text-xs"><b className="text-slate-900 break-words">{batch.name}</b><b className="text-[#714B67] shrink-0">{batch.qty} units</b></div><div className="flex flex-wrap justify-between gap-2 mt-1 text-[11px]"><span className="text-slate-500">Batch {batch.batch} · {batch.expiry}</span><span className={batch.days <= 30 ? 'text-amber-700 font-semibold' : 'text-slate-600'}>{batch.days === 0 ? 'Expires today' : `${batch.days} days left`}</span></div></li>)}</ul>}
        {pharmacy.expiryQueue.length > 5 && <p className="text-[11px] text-slate-500 mt-3">Showing 5 of {pharmacy.expiryQueue.length} batches. Open Batch & expiry for all batches.</p>}
      </section>
      <section className={cardClass} aria-label="Available stock replenishment priorities">
        <div className="flex items-start justify-between gap-3 mb-4"><div><h2 className="font-bold text-sm text-slate-900">Available Stock Gaps</h2><p className="text-xs text-slate-500 mt-1">Uses active, unexpired, dated units · shared catalogue</p></div><button onClick={() => nav('/inventory')} className={linkClass}>Review inventory</button></div>
        {!pharmacy.replenishment.length ? <p className="text-xs text-slate-500 py-8 text-center">{data.catalogueCount ? 'Every catalogue item has available stock above its saved minimum in this scope.' : 'Add medicines and saved minimum quantities to see replenishment priorities.'}</p> : <div className="overflow-x-auto"><table className="w-full text-xs text-left"><caption className="sr-only">First 6 medicines at or below minimum available stock, lowest quantity first</caption><thead className="text-slate-500 border-b border-slate-100"><tr><th className="py-2 font-medium">Medicine</th><th className="py-2 text-right font-medium">Available</th><th className="py-2 pl-3 text-right font-medium">Minimum</th></tr></thead><tbody className="divide-y divide-slate-100">{pharmacy.replenishment.slice(0, 6).map((medicine) => <tr key={medicine.id}><th scope="row" className="py-3 pr-3 font-semibold text-slate-800">{medicine.name}{medicine.qty === 0 && <span className="block text-[10px] text-rose-700 font-normal mt-1">No available units</span>}</th><td className="py-3 text-right text-[#714B67] font-bold">{medicine.qty}</td><td className="py-3 text-right text-slate-500">{medicine.minimum}</td></tr>)}</tbody></table></div>}
        {pharmacy.replenishment.length > 6 && <p className="text-[11px] text-slate-500 mt-3">Showing 6 of {pharmacy.replenishment.length} priorities.</p>}
      </section>
    </div>
  </div>
}

function QuantityBars({ entries, label, empty }) {
  if (!entries.length) return <p className="text-xs text-slate-500 py-8 text-center">{empty}</p>
  const max = Math.max(1, ...entries.map((entry) => entry.count))
  return <ul aria-label={label} className="space-y-4">{entries.map((entry) => <li key={entry.key || entry.label}>
    <div className="flex items-start justify-between gap-3 text-xs mb-2"><span className="font-semibold text-slate-800 break-words">{entry.label}</span><span className="shrink-0 text-right text-[#714B67] font-bold">{entry.count.toLocaleString('en-PK')} units{entry.batches !== undefined && <span className="block text-[10px] font-normal text-slate-500">{entry.batches} batches</span>}</span></div>
    <div aria-hidden="true" className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${entry.count / max * 100}%`, backgroundColor: entry.color }} /></div>
  </li>)}</ul>
}

function DispensingUnitsChart({ entries }) {
  const hasData = entries.some(e => e.count > 0)
  const data = entries.map((e, i) => ({ label: e.label, units: e.units, count: e.count, isToday: i === entries.length - 1 }))

  if (!hasData) {
    return (
      <div role="img" aria-label="Owner branch revenue bar chart" className="flex flex-col items-center justify-center h-44 text-slate-400 text-xs gap-2">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-xl">💊</div>
        <p>No dispensing units recorded in the last 14 days.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={1} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
        <Tooltip
          formatter={(v, _, props) => [`${v} units`, `${props.payload.count} transactions`]}
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          cursor={{ fill: 'rgba(0,160,157,0.06)' }}
        />
        <Bar dataKey="units" radius={[5, 5, 0, 0]} maxBarSize={26}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.isToday ? '#714B67' : '#00A09D'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}


function ManagerOperations({ data, nav }) {
  const operations = data.operations
  const topUnits = Math.max(1, ...operations.topMedicines.map((medicine) => medicine.units))
  const cardClass = 'min-w-0 bg-white border border-slate-300 rounded-2xl p-5 shadow-sm'
  const linkClass = 'shrink-0 text-xs font-semibold text-[#008f8b] hover:underline'
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className={`${cardClass} xl:col-span-2`} aria-label="Daily sales overview">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div><h2 className="font-bold text-sm text-slate-900">Daily Sales Trend</h2><p className="text-[11px] text-slate-500 mt-1">Last 14 calendar days, including today · {data.scopeLabel}</p></div>
            <button onClick={() => nav('/reports?tab=sales')} className={linkClass}>Sales reports</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-[#e6f7f2] p-3"><p className="text-[11px] text-[#008f8b]">Last 7 days sales</p><p className="text-lg font-bold text-slate-900 mt-1">{fmt(operations.sevenDayRevenue)}</p><p className="text-[10px] text-slate-600 mt-1">{operations.sevenDayChange}</p></div>
            <div className="rounded-xl bg-[#f5eef4] p-3"><p className="text-[11px] text-[#714B67]">Last 7 days transactions</p><p className="text-lg font-bold text-slate-900 mt-1">{operations.sevenDayOrders}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Last 7 days average sale</p><p className="text-lg font-bold text-slate-900 mt-1">{operations.sevenDayAverage === null ? '—' : fmt(operations.sevenDayAverage)}</p></div>
          </div>
          <DailySalesChart entries={operations.salesTrendDaily} /><span className="sr-only">View daily sales data</span>
          {!operations.salesTrendDaily.some((entry) => entry.count > 0) && <span className="sr-only">No sales recorded in the last 14 days</span>}
        </section>
        <section className={cardClass} aria-label="Stock status overview">
          <div className="flex items-center justify-between gap-2 mb-4"><h2 className="font-bold text-sm text-slate-900">Stock Status</h2><button onClick={() => nav('/inventory')} className={linkClass}>Manage stock</button></div>
          <Donut entries={data.inventoryHealth} center={`${data.catalogueCount} items`} empty="No medicines in the saved catalogue." />
          <div className="mt-4 border-t border-slate-100 pt-3 flex justify-between gap-2 text-xs"><span className="text-slate-500">Scoped stock cost</span><b className="text-[#714B67]">{data.stockValue}</b></div>
          <p className="text-[10px] text-amber-800 mt-3">Includes expired and held batches—not all stock is dispensable.</p>
        </section>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className={cardClass} aria-label="Top medicines by recorded units">
          <h2 className="font-bold text-sm text-slate-900">Top Medicines by Units</h2>
          <p className="text-[11px] text-slate-500 mt-1 mb-5">{data.monthLabel} · Top 5</p>
          {!operations.topMedicines.length ? <p className="text-xs text-slate-500 py-8 text-center">No positive medicine quantities recorded in sales this month.</p> : <ol className="space-y-4">
            {operations.topMedicines.map((medicine, index) => <li key={medicine.id || 'unassigned'}>
              <div className="flex items-start justify-between gap-3 text-xs mb-2"><span className="font-semibold text-slate-800 break-words">{index + 1}. {medicine.name}</span><span className="shrink-0 text-[#714B67] font-bold">{medicine.units.toLocaleString('en-PK')} units</span></div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true"><div className={`h-full rounded-full ${index % 2 ? 'bg-[#714B67]' : 'bg-[#00A09D]'}`} style={{ width: `${medicine.units / topUnits * 100}%` }} /></div>
            </li>)}
          </ol>}
        </section>
        <section className={cardClass} aria-label="Replenishment priorities">
          <div className="flex items-start justify-between gap-2 mb-3"><div><h2 className="font-bold text-sm text-slate-900">Replenishment Priorities</h2><p className="text-[11px] text-slate-500 mt-1">{operations.replenishment.length} catalogue items at / below minimum or out of stock</p></div><button onClick={() => nav('/purchases')} className={linkClass}>Purchases</button></div>
          {!operations.replenishment.length ? <p className="text-xs text-slate-500 py-8 text-center">{data.catalogueCount ? 'No items currently at or below their saved minimum.' : 'Add medicines to see replenishment priorities.'}</p> : <div className="overflow-x-auto"><table className="w-full text-xs text-left">
            <caption className="sr-only">First 6 replenishment priorities, lowest scoped quantity first</caption>
            <thead className="text-[10px] text-slate-500 border-b border-slate-100"><tr><th className="py-2 font-medium">Medicine</th><th className="py-2 text-right font-medium">Stock</th><th className="py-2 text-right font-medium">Minimum</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{operations.replenishment.slice(0, 6).map((medicine) => <tr key={medicine.id}><th scope="row" className="py-3 pr-3 font-semibold text-slate-800">{medicine.name}{medicine.qty === 0 && <span className="block text-[10px] font-normal text-rose-600 mt-0.5">Out of stock</span>}</th><td className="py-3 text-right font-bold text-[#714B67]">{medicine.qty}</td><td className="py-3 text-right text-slate-500">{medicine.minimum}</td></tr>)}</tbody>
          </table></div>}
          <button onClick={() => nav('/inventory')} className={`${linkClass} mt-3`}>Review inventory{operations.replenishment.length > 6 ? ` · ${operations.replenishment.length - 6} more priorities` : ''}</button>
        </section>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className={cardClass} aria-label="Expiry actions">
          <div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-bold text-sm text-slate-900">Expiry Actions</h2><button onClick={() => nav('/inventory?tab=NEAR_EXPIRY')} className={linkClass}>Batch & expiry</button></div>
          <p className="text-[11px] text-slate-500 mb-3">{data.attention.expired} expired · {data.attention.nearExpiry} due within 30 days · highest cost at risk first</p>
          {!data.capitalAtRisk.items.length ? <p className="text-xs text-slate-500 py-8 text-center">No stocked batches expired or due within 30 days.</p> : <ul className="divide-y divide-slate-100">{data.capitalAtRisk.items.slice(0, 4).map((item) => <li key={item.id} className="py-3">
            <div className="flex justify-between gap-2 text-xs"><b className="text-slate-800">{item.name}</b><b className="shrink-0 text-[#714B67]">{item.value}</b></div><p className="text-[10px] text-slate-500 mt-1">{item.batch}</p><p className={`text-[11px] font-medium mt-1 ${item.days < 0 ? 'text-rose-600' : 'text-amber-700'}`}>{item.expiring}</p>
          </li>)}</ul>}
          {data.capitalAtRisk.items.length > 4 && <p className="text-[10px] text-slate-500 mt-2">Showing 4 of {data.capitalAtRisk.items.length} affected batches.</p>}
        </section>
        <section className={cardClass} aria-label="Recent operations activity">
          <h2 className="font-bold text-sm text-slate-900 mb-3">Recent Operations Activity</h2>
          {!data.recentActivity.length ? <p className="text-xs text-slate-500 py-8 text-center">No activity recorded in this scope.</p> : <ul className="space-y-3">{data.recentActivity.map((activity) => <li key={activity.id}><button onClick={() => nav(activity.type === 'purchase' ? '/purchases' : activity.type === 'return' ? '/returns' : '/reports?tab=sales')} className="w-full text-left rounded-xl p-2 hover:bg-slate-50 focus-visible:outline-[#00A09D] flex items-start gap-2">
            <span className="mt-0.5 rounded-full bg-[#e6f7f2] text-[#008f8b] p-1.5 shrink-0">{activity.type === 'purchase' ? <Truck className="w-3.5 h-3.5" /> : <ReceiptIcon className="w-3.5 h-3.5" />}</span><span className="min-w-0"><span className="block text-xs font-semibold text-slate-800 break-words">{activity.title}</span><span className="block text-[10px] text-slate-500 mt-1">{activity.subtitle}</span></span>
          </button></li>)}</ul>}
        </section>
        <section className={cardClass} aria-label="Branch sales snapshot">
          <div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-bold text-sm text-slate-900">Branch Snapshot</h2><button onClick={() => nav('/branches')} className={linkClass}>Branches</button></div>
          <p className="text-[11px] text-slate-500 mb-3">{data.monthLabel} · {data.scopeLabel}</p>
          {!data.branchRevenueTrend.length ? <p className="text-xs text-slate-500 py-8 text-center">No branches or branch sales recorded in this scope.</p> : <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">{data.branchRevenueTrend.map((branch) => <li key={branch.id || 'unassigned'} className="py-3 flex items-start justify-between gap-3 text-xs"><div><p className="font-semibold text-slate-800">{branch.name}</p><p className="text-[10px] text-slate-500 mt-1">{branch.count} recorded {branch.count === 1 ? 'sale' : 'sales'}</p></div><b className="shrink-0 text-[#714B67]">{branch.revenue}</b></li>)}</ul>}
        </section>
      </div>
    </div>
  )
}

function DailySalesChart({ entries }) {
  const hasData = entries.some(e => e.count > 0)
  const fmtK = v => new Intl.NumberFormat('en-PK', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
  const data = entries.map(e => ({ label: e.label, total: e.total, count: e.count }))

  if (!hasData) {
    return (
      <div role="img" aria-label="Daily saved sales over the last 14 days" className="flex flex-col items-center justify-center h-44 text-slate-400 text-xs gap-2">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-xl">📈</div>
        <p>No sales in the last 14 days.</p>
      </div>
    )
  }

  return (
    <div role="img" aria-label="Daily saved sales over the last 14 days"><ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="35%">
        <defs>
          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00A09D" stopOpacity={1} />
            <stop offset="100%" stopColor="#00A09D" stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={1} />
        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={42} />
        <Tooltip
          formatter={(v, _, props) => [fmt(v), `Sales · ${props.payload.count} transactions`]}
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          cursor={{ fill: 'rgba(0,160,157,0.06)' }}
        />
         <Bar dataKey="total" fill="url(#salesGrad)" radius={[5, 5, 0, 0]} maxBarSize={28}>{data.map((entry) => <Cell key={entry.label} fill={entry.total < 0 ? '#e11d48' : '#00A09D'} />)}</Bar>
      </BarChart>
    </ResponsiveContainer><div className="sr-only">{data.map(entry => `${entry.label}: Rs. ${entry.total}`).join(' · ')}<span> fill="#e11d48"</span></div></div>
  )
}


export function OwnerYearChart({ comparison }) {
  const { years, colors, months } = comparison
  const values = months.flatMap(m => m.values)
  const hasRecords = values.some(v => v.count > 0)
  const fmtK = v => new Intl.NumberFormat('en-PK', { notation: 'compact', maximumFractionDigits: 1 }).format(v)

  // Build recharts data: [{month, 2024, 2025, 2026, ...}]
  const data = months.map(m => {
    const row = { month: m.label }
    m.values.forEach(v => { row[v.year] = v.future ? null : v.total })
    return row
  })

  return (
    <div>
      {!hasRecords && (
        <p className="text-xs text-slate-400 text-center mb-3">
          No sales recorded in the last 14 days. Chart values will appear when sales are saved.
        </p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="20%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={45} />
          <Tooltip
            formatter={(v, name) => [v != null ? fmt(v) : '—', name]}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
            cursor={{ fill: 'rgba(0,160,157,0.06)' }}
          />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          {years.map((year, i) => (
            <Bar key={year} dataKey={year} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={32} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold text-[#008f8b]">View monthly comparison data</summary><div className="overflow-x-auto mt-2"><table className="w-full text-left"><caption className="sr-only">Owner monthly sales comparison</caption><thead><tr><th className="p-2">Month</th>{years.map(year => <th key={year} className="p-2 text-right">{year}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{months.map(month => <tr key={month.label}><th className="p-2">{month.label}</th>{month.values.map(value => <td key={value.year} className="p-2 text-right">{value.future ? '—' : fmt(value.total)}</td>)}</tr>)}</tbody></table></div></details>
    </div>
  )
}


function RevenueBars({ entries, hasRecords, empty }) {
  const data = entries.map(e => ({ name: e.label, value: Math.max(0, e.total), color: e.color }))
  const fmtK = v => new Intl.NumberFormat('en-PK', { notation: 'compact', maximumFractionDigits: 1 }).format(v)

  if (!hasRecords || !data.length) {
    return (
      <div className="flex flex-col items-center justify-center h-44 text-slate-400 text-xs gap-2">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-xl">📊</div>
        <p>{empty || 'No branch sales recorded this month.'}</p>
      </div>
    )
  }

  return (
    <div role="img" aria-label="Owner branch revenue bar chart">
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={45} />
        <Tooltip
          formatter={(v) => [fmt(v), 'Revenue']}
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          cursor={{ fill: 'rgba(0,160,157,0.06)' }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={52}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer></div>
  )
}


function Donut({ entries, center, empty, label = 'Distribution', keepFrame = false }) {
  const [activeIdx, setActiveIdx] = useState(null)
  const visible = entries.filter(e => (e.pct ?? 0) > 0 || (e.count ?? 0) > 0)

  if (!visible.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        {/* Screen-reader description: the visible legend carries the numbers. */}
        <p className="sr-only">{label}</p>
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="16" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-400 px-4 text-center">{center}</span>
        </div>
        <p className="text-xs text-slate-400 text-center">{empty}</p>
      </div>
    )
  }

  const pieData = visible.map(e => ({
    name: e.label,
    value: e.count != null ? e.count : Math.round(e.pct),
    color: e.color,
    display: e.count != null ? `${e.count} items` : (e.amount ? fmt(e.amount) : `${e.pct?.toFixed(1)}%`),
  }))

  const renderLabel = ({ cx, cy }) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-slate-800 font-bold" fontSize={11}>
      {center}
    </text>
  )

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Screen-reader description: the visible legend carries the numbers. */}
      <p className="sr-only">{label}</p>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={68}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderLabel}
            onMouseEnter={(_, idx) => setActiveIdx(idx)}
            onMouseLeave={() => setActiveIdx(null)}
            stroke="none"
          >
            {pieData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color}
                opacity={activeIdx === null || activeIdx === i ? 1 : 0.55}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name, props) => [props.payload.display, name]}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 text-[11px] text-slate-600 w-full">
        {visible.map((e, i) => (
          <div
            key={e.label}
            className="flex items-center gap-1.5 cursor-default"
            onMouseEnter={() => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(null)}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: e.color }} />
            <span className="flex-1 truncate">{e.label}</span>
            <span className="font-semibold tabular-nums text-slate-800">
              {e.count != null ? e.count : e.amount ? fmt(e.amount) : ''} ({e.pct?.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
