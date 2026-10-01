import { useState } from 'react'
import { useDB, fmt, createWholesaleOrder, updateWholesaleOrderStatus } from '../lib/db'
import { Building2, ShoppingBag, Plus, CheckCircle, Truck, FileText, Search } from 'lucide-react'

export default function Wholesale() {
  const db = useDB()
  const [tab, setTab] = useState('orders') // 'orders' | 'new_order' | 'catalog'
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState({ name: '', company: '', phone: '', creditLimit: 0, balance: 0 })
  const [cart, setCart] = useState([])
  const [orderNotice, setOrderNotice] = useState('')

  const medicines = db.medicines || []
  const wholesaleOrders = db.wholesaleOrders || []

  // Add carton to B2B cart
  const addBulk = (med, cartonQty = 1) => {
    // Wholesale price is approx 15% lower than retail MRP
    const wholesalePricePerCarton = Math.round(med.salePrice * 45) // Carton of 50 with discount
    setCart((prev) => {
      const ex = prev.find((item) => item.medicineId === med.id)
      if (ex) {
        return prev.map((item) => (item.medicineId === med.id ? { ...item, cartons: item.cartons + cartonQty } : item))
      }
      return [...prev, { medicineId: med.id, name: med.name, strength: med.strength, cartons: cartonQty, pricePerCarton: wholesalePricePerCarton }]
    })
  }

  const subtotal = cart.reduce((sum, item) => sum + item.cartons * item.pricePerCarton, 0)

  const handlePlaceOrder = () => {
    if (!cart.length || !customer.name.trim() || !customer.phone.trim()) {
      setOrderNotice('Enter the client name and phone number before placing the order.')
      return
    }
    const orderItems = cart.map((i) => ({ name: `${i.name} ${i.strength} (Carton of 50)`, qty: i.cartons, price: i.pricePerCarton }))
    createWholesaleOrder({
      customerName: customer.name,
      company: customer.company,
      phone: customer.phone,
      items: orderItems,
      total: subtotal,
      creditUsed: subtotal,
    })
    setCart([])
    setOrderNotice('✓ Wholesale Bulk Order placed & commercial invoice generated!')
    setTimeout(() => {
      setOrderNotice('')
      setTab('orders')
    }, 2000)
  }

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 mb-1">
            <Building2 className="w-3.5 h-3.5" /> B2B Trade & Institutional Hub
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Wholesale & Hospital Supplies Portal</h2>
          <p className="text-xs text-slate-500">Tiered institutional pricing, bulk carton ordering, and commercial credit limits</p>
        </div>

        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setTab('orders')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${tab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            📋 Dispatched Invoices ({wholesaleOrders.length})
          </button>
          <button
            onClick={() => setTab('new_order')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${tab === 'new_order' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ⚡ Create Bulk Order
          </button>
          <button
            onClick={() => setTab('catalog')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${tab === 'catalog' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            📦 Institutional Catalog
          </button>
        </div>
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-sm">Commercial Wholesale Invoices</h3>
            <span className="text-xs text-slate-500">Authorized B2B dispatches</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3 text-left">Invoice No</th>
                <th className="p-3 text-left">Institution / Client</th>
                <th className="p-3 text-left">Ordered Cartons</th>
                <th className="p-3 text-right">Invoice Value</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wholesaleOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-mono font-bold text-slate-800 text-left">{o.orderNo}</td>
                  <td className="p-3 text-left">
                    <b className="text-slate-900">{o.customerName}</b>
                    <div className="text-[11px] text-slate-500">{o.company} · {o.phone}</div>
                  </td>
                  <td className="p-3 text-left text-slate-700">
                    {o.items?.map((i) => `${i.name} × ${i.qty}`).join(', ')}
                  </td>
                  <td className="p-3 text-right font-black text-slate-900">{fmt(o.total)}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.status === 'DISPATCHED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : o.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="p-3 text-center space-x-1.5">
                    {o.status === 'PENDING' && (
                      <button
                        onClick={() => updateWholesaleOrderStatus(o.id, 'DISPATCHED')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold"
                      >
                        Approve Dispatch
                      </button>
                    )}
                    <button
                      onClick={() => alert(`Printing Commercial Wholesale Invoice: ${o.orderNo}`)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold"
                    >
                      Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Order Builder */}
      {tab === 'new_order' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left catalog selector (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Select Bulk Carton Stock</h3>
                <p className="text-xs text-slate-500">Discounted trade rates for 50-unit master cartons</p>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bulk products..."
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {medicines
                .filter((m) => (m.name + m.generic).toLowerCase().includes(search.toLowerCase()))
                .map((m) => {
                  const cartonPrice = Math.round(m.salePrice * 45) // discounted
                  return (
                    <div key={m.id} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{m.name} {m.strength}</div>
                        <div className="text-[11px] text-slate-500">{m.manufacturer} · {m.form}</div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-slate-600">Retail Unit: {fmt(m.salePrice)}</span>
                          <span className="font-extrabold text-blue-700">Carton (50x): {fmt(cartonPrice)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => addBulk(m, 1)}
                        className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Master Carton
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Right Invoice & Credit check drawer (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Institutional Account</h3>
              <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
                <div className="font-bold text-slate-800">{customer.company}</div>
                <div className="text-slate-600">Contact: {customer.name} ({customer.phone})</div>
                <div className="pt-1.5 border-t border-slate-200 flex justify-between">
                  <span className="text-slate-500">Trade Credit Limit:</span>
                  <span className="font-bold text-slate-900">{fmt(customer.creditLimit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Available Credit:</span>
                  <span className="font-bold text-emerald-700">{fmt(customer.creditLimit - customer.balance)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 text-xs mb-2">Carton Basket ({cart.length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.medicineId} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <div className="font-bold text-slate-800">{item.name}</div>
                      <div className="text-[11px] text-slate-500">{item.cartons} carton(s) × {fmt(item.pricePerCarton)}</div>
                    </div>
                    <div className="font-bold text-slate-900">{fmt(item.cartons * item.pricePerCarton)}</div>
                  </div>
                ))}
                {!cart.length && <div className="text-center py-6 text-slate-400 text-xs">No cartons added yet</div>}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Wholesale Subtotal:</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-100">
                <span>ORDER TOTAL:</span>
                <span>{fmt(subtotal)}</span>
              </div>
            </div>

            {orderNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold text-center">
                {orderNotice}
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={!cart.length}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-40 transition-colors shadow-md shadow-emerald-700/20"
            >
              Confirm & Dispatch Wholesale Order
            </button>
          </div>
        </div>
      )}

      {/* Catalog Tab */}
      {tab === 'catalog' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Tiered Price Schedule</h3>
            <p className="text-xs text-slate-500">Comparison of Standard Retail, Member, Corporate, and Wholesale rates</p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3 text-left">Medicine</th>
                <th className="p-3 text-center">Retail MRP</th>
                <th className="p-3 text-center">Member Rate (-5%)</th>
                <th className="p-3 text-center">Corporate Rate (-8%)</th>
                <th className="p-3 text-center font-bold text-blue-700">Wholesale (-15%)</th>
                <th className="p-3 text-center">Master Carton (50 units)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {medicines.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 text-center">
                  <td className="p-3 text-left">
                    <b className="text-slate-900">{m.name}</b> <span className="text-slate-500">{m.strength}</span>
                  </td>
                  <td className="p-3 font-semibold text-slate-700">{fmt(m.salePrice)}</td>
                  <td className="p-3 text-emerald-700 font-medium">{fmt(Math.round(m.salePrice * 0.95))}</td>
                  <td className="p-3 text-purple-700 font-medium">{fmt(Math.round(m.salePrice * 0.92))}</td>
                  <td className="p-3 text-blue-700 font-bold">{fmt(Math.round(m.salePrice * 0.85))}</td>
                  <td className="p-3 font-mono font-bold text-slate-800">{fmt(Math.round(m.salePrice * 45))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
