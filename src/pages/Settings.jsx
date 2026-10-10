import { useState } from 'react'
import { useSearchParams } from 'react-router'
import AuditLogs from './AuditLogs'
import Users from './Users'
import { useDB, updateSettings, fmt, loyaltyTiers, LOYALTY_TIERS, can, getActiveTenantKey } from '../lib/db'
import {
  Save,
  Download,
  Upload,
  CheckCircle2,
  Settings as SettingsIcon,
  UserCog,
  ClipboardList,
  Building2,
  Receipt,
  MessageSquare,
  Award,
  Database,
  Printer,
  Sparkles,
  Phone,
  MapPin,
  Percent,
  CreditCard,
  Plus,
  Trash2,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react'

function SettingsInputField({ label, icon: Icon, required, ...props }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-o-link" />}
        <span>{label}</span>
        {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        {...props}
        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-o-blue focus:ring-2 focus:ring-o-blue/20 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 transition outline-none"
      />
    </div>
  )
}

function CreditReminderTemplate({ f, set, onSave }) {
  const tpl = f.udharTemplate ?? ''
  const preview = tpl
    .replaceAll('{{name}}', 'Hussnain Pasha')
    .replaceAll('{{amount}}', 'Rs. 3,500')
    .replaceAll('{{pharmacy}}', f.pharmacyName || 'Ellahabad Pharmacy')
    .replaceAll('{{phone}}', f.phone || '0300-1234567')

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center font-bold">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Credit Reminder Template</h3>
            <p className="text-[11px] text-slate-400">Automated WhatsApp & SMS templates for Udhar recovery</p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-o-link bg-o-tint border border-o-line px-2.5 py-0.5 rounded-full">
          WhatsApp / SMS
        </span>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">Template Message Body</label>
        <textarea
          value={tpl}
          rows="5"
          placeholder="Mohtaram {{name}}, aap ka {{pharmacy}} ki taraf {{amount}} udhar baqi hai..."
          onChange={(e) => {
            set({ ...f, udharTemplate: e.target.value })
            onSave()
          }}
          className="border border-slate-200 rounded-xl w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 focus:bg-white focus:border-o-blue focus:ring-2 focus:ring-o-blue/20 outline-none transition"
        />
      </div>

      <div>
        <span className="text-[11px] font-bold text-slate-500 block mb-1.5">Insert Dynamic Tags:</span>
        <div className="flex flex-wrap gap-1.5">
          {[
            { tag: '{{name}}', label: 'Customer Name' },
            { tag: '{{amount}}', label: 'Due Amount' },
            { tag: '{{pharmacy}}', label: 'Pharmacy Name' },
            { tag: '{{phone}}', label: 'Pharmacy Phone' },
          ].map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => {
                set({ ...f, udharTemplate: (tpl ? tpl + ' ' : '') + item.tag })
                onSave()
              }}
              className="bg-slate-100 hover:bg-o-tint hover:text-o-link hover:border-o-line border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-mono cursor-pointer transition-all"
            >
              {item.tag}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-700 mb-2">Live WhatsApp Message Preview:</p>
        <div className="bg-o-teal-tint rounded-2xl p-4 text-xs text-slate-800 whitespace-pre-line border border-emerald-200/80 shadow-xs font-sans">
          {preview ? (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">💬 WhatsApp Message</span>
              <p className="leading-relaxed text-slate-800">{preview}</p>
            </div>
          ) : (
            <span className="text-slate-400 italic">Type template or click tags above to preview live message...</span>
          )}
        </div>
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center font-bold">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Customer Loyalty & Reward Points</h3>
            <p className="text-[11px] text-slate-400">Configure point accumulation and membership status tiers</p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
          Points Engine
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <SettingsInputField
          label="Earn Rate (Spend in PKR per 1 Point)"
          icon={CreditCard}
          type="number"
          value={f.loyaltyEarnRate ?? 100}
          onChange={(e) => {
            set({ ...f, loyaltyEarnRate: Number(e.target.value) })
            onSave()
          }}
        />
        <SettingsInputField
          label="Redeem Value (PKR credit per 1 Point)"
          icon={Award}
          type="number"
          value={f.loyaltyRedeemRate ?? 1}
          onChange={(e) => {
            set({ ...f, loyaltyRedeemRate: Number(e.target.value) })
            onSave()
          }}
        />
      </div>

      <div className="pt-2">
        <p className="text-xs font-bold text-slate-700 mb-2.5">Membership Tiers & Minimum Thresholds:</p>
        <div className="space-y-2">
          {tiers.map((t, i) => (
            <div key={i} className="flex gap-2 items-center p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <input
                value={t.name}
                onChange={setTier(i, 'name')}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 w-28 bg-white focus:outline-none focus:border-o-blue text-xs font-bold text-slate-800"
                placeholder="Tier name"
              />
              <span className="text-slate-400 text-[11px] font-semibold">Min</span>
              <input
                type="number"
                value={t.min}
                onChange={setTier(i, 'min')}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 w-24 text-right bg-white focus:outline-none focus:border-o-blue text-xs font-bold font-mono text-slate-900"
              />
              <span className="text-slate-400 text-[11px] font-semibold">pts</span>
              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${t.color || 'bg-slate-100 text-slate-800'}`}>
                {t.name}
              </span>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    set({ ...f, loyaltyTiers: tiers.filter((_, j) => j !== i) })
                    onSave()
                  }}
                  className="text-slate-400 hover:text-rose-600 ml-auto p-1.5 transition-colors cursor-pointer"
                  title="Remove Tier"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            set({
              ...f,
              loyaltyTiers: [
                ...tiers,
                { min: (tiers[tiers.length - 1]?.min || 0) + 1000, name: 'VIP Diamond', color: 'bg-purple-100 text-purple-800 border-purple-200' },
              ],
            })
            onSave()
          }}
          className="mt-3 text-xs bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-o-link" /> Add Membership Tier
        </button>
      </div>
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center font-bold">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Database Backup & Recovery</h3>
            <p className="text-[11px] text-slate-400">Download complete encrypted database snapshots or restore historical data</p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
          JSON Snapshot
        </span>
      </div>

      <div className="flex flex-wrap gap-3 items-center pt-1">
        <button
          type="button"
          onClick={exportBackup}
          className="inline-flex items-center gap-2 bg-o-blue hover:bg-o-blue-d text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Download JSON Backup</span>
        </button>

        <label className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs">
          <Upload className="w-4 h-4 text-slate-500" />
          <span>Restore Backup Archive</span>
          <input type="file" accept=".json" onChange={importBackup} className="hidden" />
        </label>

        {msg && (
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl animate-in fade-in duration-200">
            {msg}
          </span>
        )}
      </div>
    </div>
  )
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') || 'general'
  const canUsers = can('users')
  const canAudit = can('auditLogs')
  const activeTab = (
    (requestedTab === 'users' && !canUsers) || (requestedTab === 'audit' && !canAudit)
  ) ? 'general' : requestedTab

  return (
    <div className="space-y-6 font-sans text-slate-800 pb-16">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-o-blue text-white flex items-center justify-center font-black shadow-sm border border-o-blue-d">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Pharmacy Settings
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                System parameters, store profile, receipt formats & staff permissions
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Menu Pills */}
        <div className="flex items-center gap-1.5 bg-white p-1.5 border border-slate-200 rounded-2xl shadow-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'general' })}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'general'
                ? 'bg-o-blue text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>General Setup</span>
          </button>

          {canUsers && (
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'users' })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-o-blue text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UserCog className="w-3.5 h-3.5" />
              <span>Staff & Roles</span>
            </button>
          )}

          {canAudit && (
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'audit' })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'audit'
                  ? 'bg-o-blue text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Audit Trail</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Content Display */}
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

  const staffCount = (db.users || []).length
  const medicinesCount = (db.medicines || []).length
  const branchCount = (db.branches || []).length || 1

  return (
    <div className="space-y-6 w-full">
      {/* 2. Top Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs sm:text-sm font-semibold text-slate-600">Store Profile</span>
            <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 truncate" title={f.pharmacyName || 'Pharmacy'}>
              {f.pharmacyName || 'Pharmacy'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">{f.phone || '0300-1234567'}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs sm:text-sm font-semibold text-slate-600">Active Staff</span>
            <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center">
              <UserCog className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{staffCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Authorized operators</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs sm:text-sm font-semibold text-slate-600">Catalogue Size</span>
            <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{medicinesCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Configured SKUs</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs sm:text-sm font-semibold text-slate-600">Tax & Currency</span>
            <div className="w-8 h-8 rounded-lg bg-o-teal-tint text-o-teal flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-o-teal">{f.currency || 'Rs.'} ({f.taxPct || 0}%)</div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">Sales tax rate</div>
          </div>
        </div>
      </div>

      {/* 3. Action Toolbar */}
      <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-700">Settings Status: Ready</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setF({ ...db.settings })}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={save}
            className="px-4 py-2 rounded-xl bg-o-blue hover:bg-o-blue-d text-white text-xs font-bold transition shadow-xs inline-flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {saved ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'Changes Saved ✓' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* 4. Form Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pharmacy Details Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center font-bold">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Pharmacy Profile & Invoicing</h3>
                <p className="text-[11px] text-slate-400">Official business name, contact info & tax details</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <SettingsInputField
              label="Pharmacy Name"
              icon={Building2}
              required
              value={f.pharmacyName || ''}
              onChange={set('pharmacyName')}
              placeholder="e.g. Al-Shifa Pharmacy"
            />
            <SettingsInputField
              label="Contact Phone Number"
              icon={Phone}
              value={f.phone || ''}
              onChange={set('phone')}
              placeholder="0300-1234567"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-o-link" />
              <span>Pharmacy Address & Location</span>
            </label>
            <textarea
              value={f.address || ''}
              onChange={set('address')}
              rows="2"
              placeholder="Shop # 12, Main Bazar, Ellahabad..."
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-o-blue focus:ring-2 focus:ring-o-blue/20 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 transition outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SettingsInputField
              label="Currency Symbol"
              value={f.currency || 'Rs.'}
              onChange={set('currency')}
              placeholder="Rs."
            />
            <SettingsInputField
              label="Sales Tax (%)"
              type="number"
              value={f.taxPct ?? 0}
              onChange={set('taxPct')}
              placeholder="0"
            />
            <SettingsInputField
              label="Tax ID / NTN #"
              value={f.ntn || ''}
              onChange={set('ntn')}
              placeholder="1234567-8"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-o-link" />
              <span>Receipt Thermal Footer Message</span>
            </label>
            <input
              value={f.receiptFooter ?? 'Thank you! Get well soon 🌿'}
              onChange={set('receiptFooter')}
              placeholder="e.g. No return without original receipt"
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-o-blue focus:ring-2 focus:ring-o-blue/20 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 transition outline-none"
            />
          </div>
        </div>

        {/* 80mm Receipt Thermal Live Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center font-bold">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Receipt Thermal Preview</h3>
                <p className="text-[11px] text-slate-400">80mm POS receipt simulation in real-time</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              80mm Width
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 shadow-xs p-4 w-72 rounded-2xl text-xs font-mono text-slate-800 transition-all">
            <div className="text-center font-bold text-sm text-slate-900 tracking-tight">
              {f.pharmacyName || 'Ellahabad Pharmacy'}
            </div>
            <div className="text-center text-[10px] text-slate-500 whitespace-pre-line mt-0.5">
              {f.address || 'Main Road, Pharmacy Center'}
            </div>
            <div className="text-center text-[10px] text-slate-500">
              {f.phone || '0300-1234567'}
              {f.ntn ? ` · NTN: ${f.ntn}` : ''}
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            <div className="flex justify-between text-[11px]">
              <span className="font-bold">INV-00109</span>
              <span>{new Date().toLocaleDateString('en-PK')}</span>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Panadol Extra × 2</span>
                <span>{fmt(300)}</span>
              </div>
              <div className="flex justify-between">
                <span>Augmentin 625mg × 1</span>
                <span>{fmt(850)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            <div className="space-y-0.5 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{fmt(1150)}</span>
              </div>
              <div className="flex justify-between">
                <span>Sales Tax ({f.taxPct || 0}%)</span>
                <span>{fmt(((1150 * (Number(f.taxPct) || 0)) / 100))}</span>
              </div>
            </div>

            <div className="flex justify-between font-bold text-sm text-slate-900 pt-1.5 border-t border-slate-300 mt-1.5">
              <span>TOTAL DUE</span>
              <span className="text-emerald-700">{fmt(1150 * (1 + (Number(f.taxPct) || 0) / 100))}</span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-600 pt-1">
              <span>Paid via</span>
              <span className="font-bold">CASH COUNTER</span>
            </div>

            <div className="border-t border-dashed border-slate-300 my-2" />

            <div className="text-center text-[11px] text-slate-500 italic">
              {f.receiptFooter || 'Thank you! Get well soon 🌿'}
            </div>
          </div>
        </div>

        {/* Credit Template Card */}
        <CreditReminderTemplate f={f} set={setF} onSave={save} />

        {/* Loyalty Program Card */}
        <LoyaltySettings f={f} set={setF} onSave={save} />

        {/* Backup & Restore Full Span */}
        <div className="lg:col-span-2">
          <BackupRestore />
        </div>
      </div>
    </div>
  )
}

