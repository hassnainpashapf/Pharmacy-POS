import { useState } from 'react'
import { useDB, customerProfile, fmt, payCustomer, medicineById, customerById } from '../lib/db'
import { Modal } from './Medicines'

function ReminderModal({ customer, udhar, onClose }) {
  const db = useDB()
  const s = db.settings
  const [channel, setChannel] = useState('whatsapp')
  const msg = (s.udharTemplate || 'Dear {{name}},\n\nYour outstanding balance at {{pharmacy}} is Rs. {{amount}}.\n\nPlease clear the pending dues at your earliest convenience.\n\nThank you,\n{{pharmacy}}\n{{phone}}')
    .replaceAll('{{name}}', customer.name)
    .replaceAll('{{amount}}', udhar.toLocaleString())
    .replaceAll('{{pharmacy}}', s.pharmacyName || '')
    .replaceAll('{{phone}}', s.phone || '')
  const waLink = customer.phone
    ? `https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`
    : null
  return (
    <Modal title={`📱 Payment Reminder — ${customer.name}`} onClose={onClose}>
      <div className="flex gap-2 mb-3">
        {['whatsapp', 'sms'].map((c) => (
          <button key={c} onClick={() => setChannel(c)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${channel === c ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>
            {c === 'whatsapp' ? 'WhatsApp' : 'SMS'}
          </button>
        ))}
      </div>
      {/* phone-style preview */}
      <div className={`${channel === 'whatsapp' ? 'bg-[#dcf8c6]' : 'bg-gray-100'} rounded-2xl p-3 text-sm shadow-inner mb-3`}>
        <div className="text-[10px] text-gray-500 mb-1">To: {customer.phone || '— no phone number —'}</div>
        {msg.split('\n').map((line, i) => <div key={i}>{line || <br />}</div>)}
        <div className="text-right text-[10px] text-gray-400 mt-1">now ✓✓</div>
      </div>
      {customer.phone && (
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard?.writeText(msg); alert('Message copied to clipboard') }}
            className="flex-1 bg-gray-200 py-2 rounded-lg text-sm font-semibold">📋 Copy</button>
          {channel === 'whatsapp' && waLink && (
            <a href={waLink} target="_blank" rel="noreferrer"
              className="flex-1 bg-[#25D366] text-white py-2 rounded-lg text-sm font-semibold text-center">📤 Open WhatsApp</a>
          )}
        </div>
      )}
      {!customer.phone && <p className="text-xs text-red-500">Customer phone number missing — please update in customer profile.</p>}
    </Modal>
  )
}

export default function CustomerProfile({ customerId, onClose }) {
  const db = useDB()
  const [payOpen, setPayOpen] = useState(false)
  const [payAmt, setPayAmt] = useState(0)
  const [remindOpen, setRemindOpen] = useState(false)
  const p = customerProfile(customerId)
  if (!p) return null

  return (
    <Modal title={`👤 ${p.customer.name} — ${p.tier.name} member`} onClose={onClose}>
      <div className="space-y-4 max-h-[75vh] overflow-auto">
        {/* stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Lifetime Spend" value={fmt(p.lifetimeSpend)} color="text-emerald-700" />
          <Stat label="Invoices" value={p.invoicesCount} />
          <Stat label="Avg Basket" value={fmt(p.avgBasket)} />
          <Stat label="⭐ Points" value={p.points} color="text-amber-600" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <Stat label="Gross Profit" value={fmt(p.lifetimeProfit)} color="text-blue-700" small />
          <Stat label="Total Discounts" value={fmt(p.totalDiscounts)} color="text-amber-700" small />
          <Stat label="Returns" value={fmt(p.returnsRefunded)} color="text-red-600" small />
        </div>

        {/* tier progress */}
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="flex justify-between items-center">
            <span>⭐ {p.points} points — <b>{p.tier.name}</b></span>
            {p.nextTier && <span className="text-xs text-gray-500">{p.nextTier.min - p.points} more points → {p.nextTier.name}</span>}
          </div>
          {p.nextTier && (
            <div className="bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-amber-400 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round((p.points / p.nextTier.min) * 100))}%` }} />
            </div>
          )}
        </div>

        {/* credit balance */}
        <div className={`rounded-lg p-3 text-sm ${p.udhar > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="flex justify-between items-center">
            <span>Receivables (Credit Due): <b className={p.udhar > 0 ? 'text-red-600' : 'text-green-600'}>{fmt(p.udhar)}</b></span>
            {p.udhar > 0 && (
              <div className="flex gap-1">
                <button onClick={() => setRemindOpen(true)}
                  className="bg-[#25D366] text-white px-3 py-1 rounded text-xs font-semibold">📱 Remind</button>
                <button onClick={() => { setPayAmt(p.udhar); setPayOpen(true) }}
                  className="bg-green-600 text-white px-3 py-1 rounded text-xs font-semibold">Receive Payment</button>
              </div>
            )}
          </div>
          {payOpen && (
            <div className="flex gap-2 mt-2">
              <input type="number" value={payAmt} onChange={(e) => setPayAmt(Number(e.target.value))} className="border rounded px-2 py-1 w-32" />
              <button onClick={() => { payCustomer(customerId, payAmt); setPayOpen(false) }}
                className="bg-emerald-600 text-white px-3 py-1 rounded text-xs font-semibold">Confirm</button>
            </div>
          )}
        </div>

        {/* timeline */}
        <div>
          <h4 className="font-bold text-sm mb-2">Timeline (Sales, Returns & Loyalty)</h4>
          <div className="space-y-1 max-h-56 overflow-auto">
            {p.timeline.map((t, i) => (
              <div key={i} className="flex justify-between items-center text-xs border-b last:border-0 pb-1">
                <span className="text-gray-400 w-28">{new Date(t.at).toLocaleDateString()}</span>
                <span className="flex-1">
                  <span className={`inline-block px-1.5 rounded text-[10px] font-bold mr-1 ${t.type === 'return' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {t.type === 'return' ? 'RETURN' : 'SALE'}
                  </span>
                  {t.label}
                </span>
                {t.points > 0 && <span className="text-amber-600 font-semibold mr-2">+{t.points}⭐</span>}
                {t.credit > 0 && <span className="text-red-500 font-semibold mr-2">credit {fmt(t.credit)}</span>}
              </div>
            ))}
            {!p.timeline.length && <p className="text-gray-400 text-xs">No account history recorded</p>}
          </div>
        </div>

        {/* invoice list */}
        <div>
          <h4 className="font-bold text-sm mb-2">Invoices ({p.invoices.length})</h4>
          <table className="w-full text-xs">
            <thead className="bg-gray-100"><tr><th className="p-1 text-left">Invoice</th><th>Date</th><th>Total</th><th>Discount</th><th>Payment</th></tr></thead>
            <tbody>
              {p.invoices.slice(0, 15).map((s) => (
                <tr key={s.id} className="border-t text-center">
                  <td className="p-1 text-left font-mono">{s.invoiceNo}</td>
                  <td>{new Date(s.date).toLocaleDateString()}</td>
                  <td className="font-semibold">{fmt(s.total)}</td>
                  <td>{s.discount > 0 ? fmt(s.discount) : '—'}</td>
                  <td>{s.payMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {remindOpen && <ReminderModal customer={p.customer} udhar={p.udhar} onClose={() => setRemindOpen(false)} />}
    </Modal>
  )
}

function Stat({ label, value, color, small }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`${small ? 'text-sm' : 'text-lg'} font-bold ${color || ''}`}>{value}</div>
    </div>
  )
}
