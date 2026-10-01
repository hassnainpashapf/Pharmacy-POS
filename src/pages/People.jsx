import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useDB, addSupplier, addCustomer, paySupplier, payCustomer, fmt, loyaltyTier, loyaltyTiers, topCustomers } from '../lib/db'
import { Modal, Input } from './Medicines'
import { addCustomerPoints } from '../lib/db'
import CustomerProfile from './CustomerProfile'

export function Suppliers() {
  const db = useDB()
  const [adding, setAdding] = useState(false)
  const [payFor, setPayFor] = useState(null)
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-xl font-bold">Suppliers</h2>
        <button onClick={() => setAdding(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold">+ New Supplier</button>
      </div>
      <div className="bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600"><tr><th className="p-2 text-left">Name</th><th>Company</th><th>Phone</th><th>Balance (Payable)</th><th>Actions</th></tr></thead>
          <tbody>
            {db.suppliers.map((s) => (
              <tr key={s.id} className="border-t text-center">
                <td className="p-2 text-left"><b>{s.name}</b></td>
                <td>{s.company}</td><td>{s.phone}</td>
                <td className={s.balance > 0 ? 'text-red-600 font-semibold' : ''}>{fmt(s.balance)}</td>
                <td><button onClick={() => setPayFor(s)} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Pay</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <PersonForm title="New Supplier" fields={{ company: '', phone: '' }} onSave={(d) => addSupplier(d)} onClose={() => setAdding(false)} />}
      {payFor && <PayModal title={`Payment — ${payFor.name}`} max={payFor.balance} onPay={(a) => paySupplier(payFor.id, a)} onClose={() => setPayFor(null)} />}
    </div>
  )
}

export function Customers() {
  const db = useDB()
  const location = useLocation()
  const [adding, setAdding] = useState(false)
  const [payFor, setPayFor] = useState(null)
  const [profileFor, setProfileFor] = useState(null)
  const [view, setView] = useState('list') // 'list' | 'top'
  const [period, setPeriod] = useState(null) // null = all time
  const top = topCustomers(10, period)

  useEffect(() => {
    setView(new URLSearchParams(location.search).get('tab') === 'loyalty' ? 'loyalty' : 'list')
  }, [location.search])

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div className="flex gap-2">
          <h2 className="text-xl font-bold">Customers & Credit Accounts</h2>
          <button onClick={() => setView(view === 'list' ? 'top' : 'list')}
            className={`px-4 py-1 rounded-lg text-sm font-semibold ${view === 'top' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
            🏆 Top Customers
          </button>
          {view === 'top' && (
            <select value={period || ''} onChange={(e) => setPeriod(Number(e.target.value) || null)} className="border rounded px-2 text-sm">
              <option value="">All time</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          )}
        </div>
        <button onClick={() => setAdding(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold">+ New Customer</button>
      </div>

      {view === 'top' && (
        <div className="bg-white rounded-xl shadow overflow-auto">
          <h3 className="font-bold p-3 border-b">🏆 Top Customers {period ? `(last ${period} days)` : '(all time)'}</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-gray-600"><tr><th className="p-2">#</th><th className="p-2 text-left">Customer</th><th>Phone</th><th>Invoices</th><th>Items</th><th>Lifetime Spend</th><th>Points</th><th>Tier</th><th></th></tr></thead>
            <tbody>
              {top.map((c, i) => (
                <tr key={c.customerId} className={`border-t text-center ${i === 0 ? 'bg-amber-50' : ''}`}>
                  <td className="p-2 font-bold text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                  <td className="text-left"><b>{c.name}</b></td>
                  <td className="text-xs">{c.phone || '—'}</td>
                  <td>{c.invoices}</td>
                  <td>{c.items}</td>
                  <td className="font-bold text-emerald-700">{fmt(c.spend)}</td>
                  <td className="text-amber-600 font-semibold">⭐ {c.points}</td>
                  <td><span className={`px-2 py-0.5 rounded text-xs font-bold ${c.tier.color}`}>{c.tier.name}</span></td>
                  <td><button onClick={() => setProfileFor(c.customerId)} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">History</button></td>
                </tr>
              ))}
              {!top.length && <tr><td colSpan="9" className="p-4 text-center text-gray-400">No customer transactions in this period</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {view === 'loyalty' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-lg font-bold text-[#714b67]">⭐ Loyalty & Credits</h3>
            <p className="text-xs text-slate-600 mt-1">Review customer points, loyalty tiers and outstanding credit balances.</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              {loyaltyTiers().map((tier) => {
                const count = db.customers.filter((c) => loyaltyTier(c.points || 0).name === tier.name).length
                return <div key={tier.name} className="bg-[#f5eef4] border border-[#decddd] rounded-xl p-3"><div className="text-xs font-bold text-[#714b67]">{tier.name}</div><div className="text-xl font-black text-slate-900 mt-1">{count}</div><div className="text-[11px] text-slate-600">customers</div></div>
              })}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-auto">
            <table className="w-full text-sm"><thead className="bg-slate-50 text-slate-700"><tr><th className="p-3 text-left">Customer</th><th>Points</th><th>Tier</th><th>Credit Balance</th><th>Actions</th></tr></thead><tbody>
              {db.customers.map((c) => <tr key={c.id} className="border-t border-slate-100 text-center"><td className="p-3 text-left font-bold">{c.name}</td><td>⭐ {c.points || 0}</td><td><span className="px-2 py-1 rounded-lg bg-[#e6f7f2] text-[#008f8b] text-xs font-bold">{loyaltyTier(c.points || 0).name}</span></td><td>{fmt(c.balance || 0)}</td><td><button onClick={() => setProfileFor(c.id)} className="text-[#714b67] font-bold text-xs">View profile</button></td></tr>)}
            </tbody></table>
          </div>
        </div>
      )}

      {view === 'list' && (
      <div className="bg-white rounded-xl shadow">
      <div className="bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600"><tr><th className="p-2 text-left">Name</th><th>Phone</th><th>Points ⭐</th><th>Tier</th><th>Credit Limit</th><th>Balance (Due)</th><th>Actions</th></tr></thead>
          <tbody>
            {db.customers.map((c) => (
              <tr key={c.id} className="border-t text-center">
                <td className="p-2 text-left"><b>{c.name}</b> <button onClick={() => c.id && setProfileFor(c.id)} className="text-blue-500 text-xs underline">view</button></td>
                <td>{c.phone}</td>
                <td className="font-bold text-amber-600">⭐ {c.points || 0}</td>
                <td><span className={`px-2 py-0.5 rounded text-xs font-bold ${loyaltyTier(c.points).color}`}>{loyaltyTier(c.points).name}</span></td>
                <td>{fmt(c.creditLimit)}</td>
                <td className={c.balance > 0 ? 'text-red-600 font-semibold' : ''}>{fmt(c.balance)}</td>
                <td className="space-x-1">
                  {c.id && <button onClick={() => setProfileFor(c.id)} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">History</button>}
                  {c.id && <button onClick={() => setPayFor(c)} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Receive</button>}
                  {c.id && <AdjPointsBtn customer={c} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <PersonForm title="New Customer" fields={{ phone: '', creditLimit: 0 }} onSave={(d) => addCustomer(d)} onClose={() => setAdding(false)} />}
      {payFor && <PayModal title={`Receive — ${payFor.name}`} max={payFor.balance} onPay={(a) => payCustomer(payFor.id, a)} onClose={() => setPayFor(null)} />}
      {profileFor && <CustomerProfile customerId={profileFor} onClose={() => setProfileFor(null)} />}
      </div>
      )}
    </div>
  )
}

function AdjPointsBtn({ customer }) {
  const [open, setOpen] = useState(false)
  const [pts, setPts] = useState(0)
  return (
    <>
      <button onClick={() => setOpen(true)} className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs">⭐±</button>
      {open && (
        <Modal title={`Points — ${customer.name} (abhi ${customer.points || 0})`} onClose={() => setOpen(false)}>
          <Input label="Points (+ ya −)" type="number" value={pts} onChange={(e) => setPts(Number(e.target.value))} />
          <button onClick={() => { if (pts) addCustomerPoints(customer.id, pts, 'manual adjust'); setOpen(false) }}
            className="mt-4 w-full bg-amber-500 text-white py-2 rounded-lg font-semibold">Apply</button>
        </Modal>
      )}
    </>
  )
}

function PersonForm({ title, fields, onSave, onClose }) {
  const [f, setF] = useState({ name: '', ...fields })
  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Input label="Name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        {fields.creditLimit !== undefined && <Input label="Credit Limit" type="number" value={f.creditLimit} onChange={(e) => setF({ ...f, creditLimit: e.target.value })} />}
      </div>
      <button onClick={() => { if (!f.name) return alert('Name required'); onSave(f); onClose() }}
        className="mt-4 w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold">Save</button>
    </Modal>
  )
}

function PayModal({ title, max, onPay, onClose }) {
  const [amt, setAmt] = useState(max)
  return (
    <Modal title={title} onClose={onClose}>
      <Input label={`Amount (max ${fmt(max)})`} type="number" value={amt} onChange={(e) => setAmt(e.target.value)} />
      <button onClick={() => { onPay(Math.min(Number(amt), max)); onClose() }}
        className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg font-semibold">Confirm</button>
    </Modal>
  )
}
