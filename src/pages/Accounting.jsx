import { useState, useMemo } from 'react'
import { useLocation } from 'react-router'
import { useDB, profitAndLoss, fmt, addExpense } from '../lib/db'
import {
  Search,
  X,
  Printer,
  Plus,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Wallet,
  Receipt,
  Users,
  Truck,
  Banknote,
  BarChart3,
  Scale,
} from 'lucide-react'
import DateFilterBar, { matchesDateFilter, useDateFilterState } from '../components/DateFilterBar'

const EXPENSE_CATEGORIES = ['Operations', 'Utilities', 'Rent', 'Transport', 'Payroll', 'Other']

function categoryBadge(cat = '') {
  switch (cat) {
    case 'Utilities': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'Rent': return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'Transport': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'Payroll': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'Operations': return 'bg-[#f5eef4] text-[#714B67] border-[#decddd]'
    default: return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

/* ---------- Shared UI pieces ---------- */

function PageHeader({ icon: Icon, title, badge, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-wrap justify-between items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#3b1734] flex items-center justify-center text-white shadow-sm shrink-0">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
            {badge && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f5eef4] text-[#714B67] border border-[#decddd]">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 font-medium mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

function KpiCard({ label, value, sub, icon: Icon, tone = 'default' }) {
  const tones = {
    default: { border: 'border-slate-100 hover:border-slate-300', label: 'text-slate-600', icon: 'bg-[#f5eef4] text-[#714B67]', value: 'text-slate-900', sub: 'text-slate-500' },
    green: { border: 'border-emerald-100 hover:border-emerald-300', label: 'text-emerald-700', icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700', sub: 'text-emerald-600' },
    red: { border: 'border-rose-100 hover:border-rose-300', label: 'text-rose-700', icon: 'bg-rose-50 text-rose-600', value: 'text-rose-600', sub: 'text-rose-600' },
    blue: { border: 'border-slate-100 hover:border-slate-300', label: 'text-slate-600', icon: 'bg-blue-50 text-blue-600', value: 'text-slate-900', sub: 'text-slate-500' },
    amber: { border: 'border-slate-100 hover:border-slate-300', label: 'text-slate-600', icon: 'bg-amber-50 text-amber-600', value: 'text-slate-900', sub: 'text-slate-500' },
  }
  const t = tones[tone] || tones.default
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 transition-colors ${t.border}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${t.label}`}>{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`text-2xl font-black mt-2 ${t.value}`}>{value}</div>
      <div className={`text-[11px] font-medium mt-0.5 ${t.sub}`}>{sub}</div>
    </div>
  )
}

function StatementRow({ label, value, negative, strong, tone, icon: Icon }) {
  const display = negative ? -Math.abs(value || 0) : value || 0
  const valueClass = tone
    ? tone
    : strong
      ? 'text-slate-900 font-black'
      : negative
        ? 'text-rose-600 font-semibold'
        : 'text-slate-800 font-semibold'
  return (
    <div className={`flex items-center justify-between py-3 px-4 text-xs ${strong ? 'bg-slate-50 border-y border-slate-200' : 'border-b border-slate-100'}`}>
      <span className={`flex items-center gap-2 ${strong ? 'font-bold text-slate-900' : 'text-slate-600 font-medium'}`}>
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        {label}
      </span>
      <span className={`font-mono text-sm ${valueClass}`}>{fmt(display)}</span>
    </div>
  )
}

/* ---------- Main page ---------- */

export default function Accounting() {
  const db = useDB()
  const location = useLocation()
  const expenseMode = new URLSearchParams(location.search).get('tab') === 'expenses'

  if (expenseMode) return <ExpensesPanel db={db} />
  return <FinancialStatements />
}

function FinancialStatements() {
  const [days, setDays] = useState(30)
  const pl = profitAndLoss(days)
  const todayPL = profitAndLoss(1)
  const periodLabel = days === 1 ? 'Today' : `Last ${days} days`
  const grossMargin = pct(pl.grossProfit, pl.revenue)
  const netMargin = pct(pl.netProfit, pl.revenue)
  const profitable = pl.netProfit >= 0

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        icon={CircleDollarSign}
        title="Financial Accounts & P&L"
        badge={periodLabel}
        subtitle="Income statement, gross & net margins, receivables, payables and inventory valuation."
      >
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none cursor-pointer"
        >
          <option value={1}>📅 Today</option>
          <option value={7}>📅 Last 7 days</option>
          <option value={30}>📅 Last 30 days</option>
          <option value={90}>📅 Last 90 days</option>
          <option value={365}>📅 Last 365 days</option>
        </select>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span>Print Statement</span>
        </button>
      </PageHeader>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <KpiCard label="Gross Revenue" value={fmt(pl.revenue)} sub={`Discounts: ${fmt(pl.discounts)}`} icon={BarChart3} />
        <KpiCard label="Cost of Goods" value={fmt(pl.cogs)} sub="COGS at purchase cost" icon={Package} tone="blue" />
        <KpiCard label="Gross Profit" value={fmt(pl.grossProfit)} sub={`${grossMargin}% gross margin`} icon={TrendingUp} tone="green" />
        <KpiCard label="Store Expenses" value={fmt(pl.expenses)} sub="Operating expenditure" icon={Wallet} tone="amber" />
        <div className="col-span-2 md:col-span-1">
          <KpiCard
            label="Net Profit"
            value={fmt(pl.netProfit)}
            sub={`${netMargin}% net margin`}
            icon={profitable ? TrendingUp : TrendingDown}
            tone={profitable ? 'green' : 'red'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income Statement */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">Income Statement</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{periodLabel} • Cash basis</p>
            </div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${profitable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {profitable ? 'Profitable' : 'Loss'}
            </span>
          </div>

          <StatementRow label="Gross Sales Revenue" value={pl.revenue} icon={BarChart3} />
          <StatementRow label="Customer Discounts Granted" value={pl.discounts} negative />
          <StatementRow label="Cost of Goods Sold (COGS)" value={pl.cogs} negative />
          <StatementRow label="Gross Profit" value={pl.grossProfit} strong tone="text-emerald-700 font-black" />
          <StatementRow label="Store Operating Expenses" value={pl.expenses} negative />
          <StatementRow
            label="Net Operating Profit"
            value={pl.netProfit}
            strong
            tone={profitable ? 'text-emerald-700 font-black text-base' : 'text-rose-600 font-black text-base'}
          />

          <div className="p-4 space-y-3">
            {[
              { label: 'Gross Margin', value: grossMargin, bar: 'bg-emerald-500' },
              { label: 'Net Profit Margin', value: netMargin, bar: profitable ? 'bg-[#714B67]' : 'bg-rose-500' },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>{m.label}</span>
                  <span className="text-slate-900">{m.value}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${Math.max(0, Math.min(100, m.value))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Balance Sheet */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">Balance Sheet Position</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Live snapshot of assets & liabilities</p>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
              Snapshot
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Customer Receivables', sub: 'Outstanding udhar', value: pl.receivables, icon: Users, cls: 'bg-amber-50 text-amber-600', val: 'text-amber-700' },
              { label: 'Supplier Payables', sub: 'Pending vendor dues', value: pl.payables, icon: Truck, cls: 'bg-rose-50 text-rose-600', val: 'text-rose-600' },
              { label: 'Inventory Valuation', sub: 'Stock at cost', value: pl.stockValue, icon: Package, cls: 'bg-purple-50 text-purple-600', val: 'text-purple-700' },
              { label: 'Cash Flow Today', sub: 'Revenue − expenses', value: todayPL.revenue - todayPL.expenses, icon: Banknote, cls: 'bg-emerald-50 text-emerald-600', val: 'text-emerald-700' },
            ].map((b) => (
              <div key={b.label} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${b.cls}`}>
                    <b.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{b.label}</div>
                    <div className="text-[10px] text-slate-500">{b.sub}</div>
                  </div>
                </div>
                <div className={`text-lg font-black font-mono mt-2.5 ${b.val}`}>{fmt(b.value)}</div>
              </div>
            ))}
          </div>

          <div className="mx-4 mb-4 p-3 rounded-xl bg-[#f5eef4] border border-[#decddd] flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-[#714B67]">
              <Scale className="w-4 h-4" /> Net Working Position
            </span>
            <span className="font-mono font-black text-sm text-slate-900">
              {fmt((pl.receivables || 0) + (pl.stockValue || 0) - (pl.payables || 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Expenses view ---------- */

function ExpensesPanel({ db }) {
  const [expenseDateFilter, setExpenseDateFilter] = useDateFilterState('all')
  const [expenseSearch, setExpenseSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [adding, setAdding] = useState(false)

  const allExpenses = db.expenses || []

  const filteredExpenses = useMemo(() => {
    let list = allExpenses.filter((e) => matchesDateFilter(e.date, expenseDateFilter))
    if (categoryFilter !== 'ALL') list = list.filter((e) => e.category === categoryFilter)
    if (expenseSearch.trim()) {
      const q = expenseSearch.toLowerCase()
      list = list.filter(
        (e) => (e.note && e.note.toLowerCase().includes(q)) || (e.category && e.category.toLowerCase().includes(q))
      )
    }
    return list
  }, [allExpenses, expenseDateFilter, categoryFilter, expenseSearch])

  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const now = new Date()
    let total = 0, todayTotal = 0, monthTotal = 0
    const byCat = {}
    for (const e of allExpenses) {
      const amt = Number(e.amount || 0)
      total += amt
      const d = new Date(e.date)
      if (d.toDateString() === today) todayTotal += amt
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) monthTotal += amt
      byCat[e.category] = (byCat[e.category] || 0) + amt
    }
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]
    return { total, todayTotal, monthTotal, count: allExpenses.length, topCat: top ? top[0] : '—', topAmt: top ? top[1] : 0 }
  }, [allExpenses])

  const viewTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const isFiltered = expenseSearch || categoryFilter !== 'ALL' || expenseDateFilter.type !== 'all'

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        icon={Wallet}
        title="Expense Management"
        badge={`${stats.count} entries`}
        subtitle="Record and track store operating expenses — rent, utilities, payroll, transport and more."
      >
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span>Print</span>
        </button>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white text-xs font-bold shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense</span>
        </button>
      </PageHeader>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <KpiCard label="Total Expenses" value={fmt(stats.total)} sub="All-time expenditure" icon={Wallet} tone="red" />
        <KpiCard label="Today" value={fmt(stats.todayTotal)} sub="Spent today" icon={Receipt} />
        <KpiCard label="This Month" value={fmt(stats.monthTotal)} sub="Month-to-date" icon={BarChart3} tone="blue" />
        <KpiCard label="Entries" value={stats.count} sub="Recorded transactions" icon={Receipt} tone="amber" />
        <div className="col-span-2 md:col-span-1">
          <KpiCard label="Top Category" value={stats.topCat} sub={fmt(stats.topAmt)} icon={TrendingUp} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search expense description or category..."
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714B67] transition-all"
            />
            {expenseSearch && (
              <button
                onClick={() => setExpenseSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <DateFilterBar filterState={expenseDateFilter} onChange={setExpenseDateFilter} asDropdown dropdownClassName="rounded-xl py-2 px-3" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none cursor-pointer"
          >
            <option value="ALL">🏷️ All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {isFiltered && (
            <button
              onClick={() => { setExpenseSearch(''); setCategoryFilter('ALL'); setExpenseDateFilter({ type: 'all' }) }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.slice().reverse().map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-600">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${categoryBadge(e.category)}`}>
                      {e.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">{e.note}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-rose-600">{fmt(e.amount)}</td>
                </tr>
              ))}
              {!filteredExpenses.length && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <div className="text-sm font-bold text-slate-600">No Expenses Found</div>
                    <p className="text-xs text-slate-400 mt-0.5">Record an expense or adjust your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-700">{filteredExpenses.length}</span> of{' '}
            <span className="font-bold text-slate-700">{allExpenses.length}</span> entries
          </div>
          <span>
            Total in view: <strong className="text-rose-600 font-mono">{fmt(viewTotal)}</strong>
          </span>
        </div>
      </div>

      {adding && <ExpenseModal onClose={() => setAdding(false)} />}
    </div>
  )
}

function ExpenseModal({ onClose }) {
  const [category, setCategory] = useState('Operations')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  function save(e) {
    e.preventDefault()
    if (!note.trim() || Number(amount) <= 0) return setError('Enter an expense description and a valid amount.')
    addExpense({ category, note: note.trim(), amount: Number(amount) })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100">
        <div className="p-4 bg-gradient-to-r from-[#3b1734] to-[#714B67] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <h3 className="font-bold text-sm">Record New Expense</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={save} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-[#714B67] focus:outline-none"
            >
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description <span className="text-rose-500">*</span></label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Electricity bill"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#714B67] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Amount (Rs.) <span className="text-rose-500">*</span></label>
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-black text-slate-900 focus:ring-2 focus:ring-[#714B67] focus:outline-none"
            />
          </div>
          {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white font-bold shadow-sm transition cursor-pointer">
              Save Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
