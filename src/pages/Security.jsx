import { useState } from 'react'
import { useDB } from '../lib/db'
import { ShieldCheck, Lock, Key, UserCheck, AlertTriangle, Check, X } from 'lucide-react'

export default function Security() {
  const db = useDB()
  const auditLogs = db.auditLogs || []

  // Enterprise Role Permissions Matrix
  const permissions = [
    { permission: 'Create & Complete Sales POS', admin: true, manager: true, cashier: true, pharmacist: true },
    { permission: 'Apply Discretionary Discounts', admin: true, manager: true, cashier: false, pharmacist: false },
    { permission: 'Process Customer Sales Return / Refund', admin: true, manager: true, cashier: false, pharmacist: false },
    { permission: 'Modify Medicine Master Purchase Price', admin: true, manager: false, cashier: false, pharmacist: false },
    { permission: 'Approve Inter-Branch Stock Transfers', admin: true, manager: true, cashier: false, pharmacist: false },
    { permission: 'Create Purchase Orders (PO)', admin: true, manager: true, cashier: false, pharmacist: false },
    { permission: 'Access Profit & Loss Financial Ledgers', admin: true, manager: false, cashier: false, pharmacist: false },
    { permission: 'Export & Restore Database Snapshots', admin: true, manager: false, cashier: false, pharmacist: false },
    { permission: 'Delete / Purge Historical Records', admin: false, manager: false, cashier: false, pharmacist: false }, // Zero-trust immutable
  ]

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 mb-1">
            <Lock className="w-3.5 h-3.5 text-slate-700" /> Zero-Trust Access Control
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Security & Role-Based Access Control (RBAC)</h2>
          <p className="text-xs text-slate-500">Fine-grained action authorization, immutable audit trail, and zero-trust safeguards</p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
          <ShieldCheck className="w-4 h-4" /> Zero-Trust Policy Active
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-sm">Role Authorization Matrix</h3>
          <span className="text-xs text-slate-500">Granular security bounds</span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
            <tr>
              <th className="p-3 text-left">Action / Capability</th>
              <th className="p-3 text-center">ADMIN</th>
              <th className="p-3 text-center">MANAGER</th>
              <th className="p-3 text-center">CASHIER</th>
              <th className="p-3 text-center">PHARMACIST</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {permissions.map((p, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="p-3 text-left font-medium text-slate-800">{p.permission}</td>
                <td className="p-3 text-center">
                  {p.admin ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                </td>
                <td className="p-3 text-center">
                  {p.manager ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                </td>
                <td className="p-3 text-center">
                  {p.cashier ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-rose-500 mx-auto" />}
                </td>
                <td className="p-3 text-center">
                  {p.pharmacist ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Security Policies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1.5">
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-emerald-600" /> Account Lockout Rules
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Automatic account lockout after 5 consecutive failed login attempts with a mandatory 15-minute cool-off period.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1.5">
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Key className="w-4 h-4 text-blue-600" /> Immutable Audit Ledger
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            All user actions, discounts, stock adjustments, and logins are recorded to an append-only audit trail that cannot be modified.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-1.5">
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-purple-600" /> Branch Scoping
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Cashiers and Dispensary staff are strictly locked to their assigned physical branch location. Only HQ Admins possess cross-branch visibility.
          </p>
        </div>
      </div>
    </div>
  )
}
