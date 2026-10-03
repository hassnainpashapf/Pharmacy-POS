import { useState } from 'react'
import { useSearchParams } from 'react-router'
import AuditLogs from './AuditLogs'
import Users from './Users'
import { useDB, updateSettings, fmt, loyaltyTiers, LOYALTY_TIERS, can, getActiveTenantKey } from '../lib/db'
import { Input } from './Medicines'
import { Save, Download, Upload, CheckCircle2, Settings as SettingsIcon, UserCog, ClipboardList } from 'lucide-react'

function CreditReminderTemplate({ f, set, onSave }) {
  const tpl = f.udharTemplate ?? ''
  const preview = tpl
    .replaceAll('{{name}}', 'John Doe')
    .replaceAll('{{amount}}', '3,500')
    .replaceAll('{{pharmacy}}', f.pharmacyName || 'Pharmacy')
    .replaceAll('{{phone}}', f.phone || '0300-1234567')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base">📱 Credit Reminder Template</h3>
        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">WhatsApp / SMS</span>
      </div>
      <textarea
        value={tpl}
        rows="7"
        onChange={(e) => {
          set({ ...f, udharTemplate: e.target.value })
          onSave()
        }}
        className="border border-slate-200 rounded-xl w-full px-3 py-2 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {['{{name}}', '{{amount}}', '{{pharmacy}}', '{{phone}}'].map((ph) => (
          <button
            key={ph}
            onClick={() => {
              set({ ...f, udharTemplate: tpl + ' ' + ph })
              onSave()
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-mono cursor-pointer transition-colors"
          >
            {ph}
          </button>
        ))}
      </div>
      <p className="text-xs font-semibold text-slate-600 mt-4 mb-1.5">Live Message Preview:</p>
      <div className="bg-[#dcf8c6] rounded-2xl p-3.5 text-xs text-slate-800 whitespace-pre-line shadow-inner border border-emerald-200">
        {preview || <span className="text-slate-400 italic">Template is currently empty...</span>}
      </div>
    </div>
  )
}

function LoyaltySettings({ f, set, onSave }) {
  const tiers = f.loyaltyTiers || LOYALTY_TIERS
  const setTier = (i, k) => (e) => {
    const nt = tiers.map((t, j) => (j === i ? { ...t, [k]: k === 'min' ? Number(e.target.value) : e.target.value } : t))
    set({ ...f, loyaltyTiers: nt })
    onSave()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-900 text-sm sm:text-base">⭐ Loyalty & Reward System</h3>
        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Points Engine</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs mb-4">
        <Input
          label="Earn Rate (Rs. spent per 1 point)"
          type="number"
          value={f.loyaltyEarnRate ?? 100}
          onChange={(e) => {
            set({ ...f, loyaltyEarnRate: Number(e.target.value) })
            onSave()
          }}
        />
        <Input
          label="Redeem Rate (Rs. credit per 1 point)"
          type="number"
          value={f.loyaltyRedeemRate ?? 1}
          onChange={(e) => {
            set({ ...f, loyaltyRedeemRate: Number(e.target.value) })
            onSave()
          }}
        />
      </div>

      <p className="text-xs font-semibold text-slate-600 mb-2">Tier Thresholds & Status Badges:</p>
      <div className="space-y-2">
        {tiers.map((t, i) => (
          <div key={i} className="flex gap-2 items-center text-xs">
            <input
              value={t.name}
              onChange={setTier(i, 'name')}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 w-28 bg-slate-50 focus:bg-white text-xs font-medium"
              placeholder="Tier name"
            />
            <span className="text-slate-400 text-[11px]">min</span>
            <input
              type="number"
              value={t.min}
              onChange={setTier(i, 'min')}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 w-24 text-right bg-slate-50 focus:bg-white text-xs font-bold font-mono"
            />
            <span className="text-slate-400 text-[11px]">pts</span>
            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${t.color}`}>{t.name}</span>
            {i > 0 && (
              <button
                onClick={() => {
                  set({ ...f, loyaltyTiers: tiers.filter((_, j) => j !== i) })
                  onSave()
                }}
                className="text-rose-500 hover:text-rose-700 ml-auto p-1"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          set({
            ...f,
            loyaltyTiers: [
              ...tiers,
              { min: (tiers[tiers.length - 1]?.min || 0) + 1000, name: 'Platinum', color: 'bg-indigo-100 text-indigo-800' },
            ],
          })
          onSave()
        }}
        className="mt-3 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-bold transition-colors"
      >
        + Add Membership Tier
      </button>
    </div>
  )
}

function BackupRestore() {
  const db = useDB()
  const [msg, setMsg] = useState('')

  function exportBackup() {
    const data = { ...db, exportedAt: new Date().toISOString(), version: 'v2-pharmacy-pos' }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pharmacy-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('✓ Backup archive downloaded successfully')
    setTimeout(() => setMsg(''), 3000)
  }

  function importBackup(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!data.medicines || !data.users) throw new Error('Invalid pharmacy backup file structure')
        if (!confirm('Restoring will replace all current inventory, sales, and accounts data. Proceed?')) return
        localStorage.setItem(getActiveTenantKey(), JSON.stringify(data))
        location.reload()
      } catch (ex) {
        setMsg('✕ ' + ex.message)
        setTimeout(() => setMsg(''), 4000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
      <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-1">💾 Backup & Data Portability</h3>
      <p className="text-xs text-slate-500 mb-4">Export database records or restore existing pharmacy snapshots.</p>
      <div className="flex flex-wrap gap-2.5 items-center">
        <button
          onClick={exportBackup}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" /> Export JSON
        </button>
        <label className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm">
          <Upload className="w-4 h-4" /> Import Backup
          <input type="file" accept=".json" onChange={importBackup} className="hidden" />
        </label>
        {msg && <span className="text-xs font-semibold text-emerald-700">{msg}</span>}
      </div>
    </div>
  )
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') || 'general'
  // Tabs are gated by the same permissions as the rest of the app: a revoked
  // staff/audit tab is neither offered nor reachable by editing the URL.
  const canUsers = can('users')
  const canAudit = can('auditLogs')
  const activeTab = (
    (requestedTab === 'users' && !canUsers) || (requestedTab === 'audit' && !canAudit)
  ) ? 'general' : requestedTab

  return (
    <div className="space-y-5 font-sans">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-300 rounded-2xl shadow-sm text-xs font-bold overflow-x-auto">
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'general' })}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'bg-[#3b1734] text-white border border-[#280c23] shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>General Configuration</span>
        </button>

        {canUsers && (
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'users' })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#3b1734] text-white border border-[#280c23] shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCog className="w-4 h-4" />
            <span>Staff & User Roles</span>
          </button>
        )}

        {canAudit && (
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'audit' })}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#3b1734] text-white border border-[#280c23] shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Security Audit Logs</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' ? (
        <Users />
      ) : activeTab === 'audit' ? (
        <AuditLogs />
      ) : (
        <Configuration />
      )}
    </div>
  )
}

function Configuration() {
  const db = useDB()
  const [f, setF] = useState({ ...db.settings })
  const [saved, setSaved] = useState(false)

  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.value })
    setSaved(false)
  }

  function save() {
    updateSettings({
      ...f,
      taxPct: Number(f.taxPct) || 0,
      currency: f.currency || 'Rs.',
      receiptFooter: f.receiptFooter ?? '',
      loyaltyEarnRate: Number(f.loyaltyEarnRate) || 100,
      loyaltyRedeemRate: Number(f.loyaltyRedeemRate) || 1,
      loyaltyTiers: f.loyaltyTiers || undefined,
      udharTemplate: f.udharTemplate || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-4 w-full pb-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">⚙️ Pharmacy Configuration</h2>
        </div>
        <button
          onClick={save}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-700/20 active:scale-95"
        >
          {saved ? <CheckCircle2 className="w-4 h-4 text-emerald-200" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Saved ✓' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pharmacy Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-3.5">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">Business & Receipt Details</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Input label="Pharmacy Name" value={f.pharmacyName || ''} onChange={set('pharmacyName')} />
            <Input label="Phone Number" value={f.phone || ''} onChange={set('phone')} />
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Store Address
            <textarea
              value={f.address || ''}
              onChange={set('address')}
              rows="2"
              className="border border-slate-200 rounded-xl w-full px-3 py-2 text-xs mt-1 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <Input label="Currency" value={f.currency || 'Rs.'} onChange={set('currency')} />
            <Input label="Sales Tax %" type="number" value={f.taxPct ?? 0} onChange={set('taxPct')} />
            <Input label="Tax ID / NTN" value={f.ntn || ''} onChange={set('ntn')} />
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Receipt Footer Message
            <input
              value={f.receiptFooter ?? 'Thank you! Get well soon 🌿'}
              onChange={set('receiptFooter')}
              className="border border-slate-200 rounded-xl w-full px-3 py-2 text-xs mt-1 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
        </div>

        {/* Live Thermal Receipt Preview */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col items-center">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-3 self-start">Receipt Preview (80mm)</h3>
          <div className="bg-white border border-slate-200 shadow-sm p-4 w-72 rounded-xl text-xs font-mono text-slate-800">
            <div className="text-center font-bold text-sm text-slate-900">{f.pharmacyName || 'Pharmacy'}</div>
            <div className="text-center text-[10px] text-slate-500 whitespace-pre-line mt-0.5">{f.address}</div>
            <div className="text-center text-[10px] text-slate-500">
              {f.phone}
              {f.ntn ? ` · NTN: ${f.ntn}` : ''}
            </div>
            <div className="border-t border-dashed border-slate-300 my-2" />
            <div className="flex justify-between text-[11px]">
              <span className="font-bold">INV-00001</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <div className="border-t border-dashed border-slate-300 my-2" />
            <div className="flex justify-between text-[11px]">
              <span>Panadol 500mg × 2</span>
              <span>{fmt(300)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>Augmentin 625mg × 1</span>
              <span>{fmt(850)}</span>
            </div>
            <div className="border-t border-dashed border-slate-300 my-2" />
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Subtotal</span>
              <span>{fmt(1150)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Tax ({f.taxPct || 0}%)</span>
              <span>{fmt(((1150 * (f.taxPct || 0)) / 100))}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
              <span>TOTAL</span>
              <span>{fmt(1150 * (1 + (f.taxPct || 0) / 100))}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-600 pt-0.5">
              <span>Payment</span>
              <span className="font-bold">CASH</span>
            </div>
            <div className="border-t border-dashed border-slate-300 my-2" />
            <div className="text-center text-[11px] text-slate-500">{f.receiptFooter || 'Thank you! Get well soon 🌿'}</div>
          </div>
        </div>

        {/* Credit Template */}
        <CreditReminderTemplate f={f} set={setF} onSave={save} />

        {/* Loyalty Program */}
        <LoyaltySettings f={f} set={setF} onSave={save} />

        {/* Backup & Restore span */}
        <div className="lg:col-span-2">
          <BackupRestore />
        </div>
      </div>
    </div>
  )
}
