import { useState } from 'react'
import { useLocation } from 'react-router'
import { useDB, profitAndLoss, fmt, addExpense } from '../lib/db'

export default function Accounting() {
  const db = useDB()
  const location = useLocation()
  const expenseMode = new URLSearchParams(location.search).get('tab') === 'expenses'
  const [days, setDays] = useState(30)
  const pl = profitAndLoss(days)
  const todayPL = profitAndLoss(1)

  if (expenseMode) return <ExpensesPanel db={db} />

  const Row = ({ label, value, bold, color, indent }) => (
    <div className={`flex justify-between py-2.5 text-xs sm:text-sm ${bold ? 'font-bold border-t border-slate-200 pt-3 mt-1' : 'border-b border-slate-100'} ${indent ? 'pl-5 text-slate-500' : 'text-slate-700'}`}>
      <span>{label}</span>
      <span className={color || (bold ? 'text-base font-extrabold text-slate-900' : 'font-semibold text-slate-800')}>{fmt(value)}</span>
    </div>
  )

  return (
    <div className="space-y-4 w-full pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">💰 Financial Accounts & P&L</h2>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value={1}>Today</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 365 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* P&L Statement */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">📊 Income Statement ({days === 1 ? 'Today' : `Last ${days} days`})</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">Cash Basis</span>
          </div>

          <Row label="Gross Sales Revenue" value={pl.revenue} />
          <Row label="Customer Discounts Granted" value={-pl.discounts} indent />
          <Row label="Cost of Goods Sold (COGS)" value={-pl.cogs} indent />
          <Row label="Gross Profit" value={pl.grossProfit} bold color="text-emerald-700 font-bold" />
          <Row label="Store Operating Expenses" value={-pl.expenses} indent />
          <Row
            label="NET OPERATING PROFIT"
            value={pl.netProfit}
            bold
            color={pl.netProfit >= 0 ? 'text-emerald-700 text-lg sm:text-xl font-black' : 'text-rose-600 text-lg sm:text-xl font-black'}
          />

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Gross Margin: <b className="text-slate-800">{pl.revenue > 0 ? Math.round((pl.grossProfit / pl.revenue) * 100) : 0}%</b></span>
            <span>Net Profit Margin: <b className="text-emerald-700">{pl.revenue > 0 ? Math.round((pl.netProfit / pl.revenue) * 100) : 0}%</b></span>
          </div>
        </div>

        {/* Balance Sheet / Financial Position */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">💳 Balance Sheet Position</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">Snapshot</span>
            </div>

            <Row label="Customer Receivables (Outstanding Credit)" value={pl.receivables} color="text-amber-600 font-bold" />
            <Row label="Supplier Payables (Pending Dues)" value={pl.payables} color="text-rose-600 font-bold" />
            <Row label="Inventory Valuation (at Cost)" value={pl.stockValue} color="text-purple-700 font-bold" />
            <Row label="Estimated Cash Flow Today" value={todayPL.revenue - todayPL.expenses} color="text-emerald-700 font-bold" />
          </div>

        </div>
      </div>
    </div>
  )
}

function ExpensesPanel({ db }) {
  const [category, setCategory] = useState('Operations')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')

  function saveExpense(e) {
    e.preventDefault()
    if (!note.trim() || Number(amount) <= 0) return setMessage('Enter an expense description and amount.')
    addExpense({ category, note: note.trim(), amount: Number(amount) })
    setNote('')
    setAmount('')
    setMessage('Expense saved successfully.')
  }

  return (
    <div className="space-y-4 w-full pb-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-xl font-extrabold text-slate-900">💳 Expense Management</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form onSubmit={saveExpense} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-slate-900">Add Expense</h3>
          <label className="block text-xs font-bold">Category<select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl p-2 bg-slate-50"><option>Operations</option><option>Utilities</option><option>Rent</option><option>Transport</option><option>Payroll</option><option>Other</option></select></label>
          <label className="block text-xs font-bold">Description<input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl p-2 bg-slate-50" placeholder="e.g. electricity bill" /></label>
          <label className="block text-xs font-bold">Amount<input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl p-2 bg-slate-50" placeholder="0" /></label>
          <button className="w-full bg-[#714b67] hover:bg-[#5c3c54] text-white rounded-xl py-2 font-bold">Save Expense</button>
          {message && <p className="text-xs font-semibold text-[#008f8b]">{message}</p>}
        </form>
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-auto">
          <div className="p-5 border-b border-slate-100"><h3 className="font-bold text-slate-900">Recent Expenses</h3></div>
          <table className="w-full text-xs"><thead className="bg-slate-50 text-slate-700"><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Category</th><th className="p-3 text-left">Description</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>
            {(db.expenses || []).slice().reverse().map((e) => <tr key={e.id} className="border-t border-slate-100"><td className="p-3">{new Date(e.date).toLocaleDateString()}</td><td className="p-3">{e.category}</td><td className="p-3">{e.note}</td><td className="p-3 text-right font-bold">{fmt(e.amount)}</td></tr>)}
            {!db.expenses?.length && <tr><td colSpan="4" className="p-8 text-center text-slate-500">No expenses recorded yet.</td></tr>}
          </tbody></table>
        </div>
      </div>
    </div>
  )
}
