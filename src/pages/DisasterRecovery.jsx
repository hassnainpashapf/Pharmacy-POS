import { useState } from 'react'
import { useDB, createSnapshot, restoreSnapshot, deleteSnapshot } from '../lib/db'
import { Database, RotateCcw, Download, Trash2, CheckCircle2, ShieldCheck, HardDrive } from 'lucide-react'

export default function DisasterRecovery() {
  const db = useDB()
  const snapshots = db.snapshots || []
  const [newSnapName, setNewSnapName] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const handleCreate = () => {
    createSnapshot(newSnapName.trim() || `Manual Snapshot ${new Date().toLocaleDateString()}`, 'MANUAL')
    setNewSnapName('')
    setStatusMsg('✓ New system snapshot created successfully')
    setTimeout(() => setStatusMsg(''), 3000)
  }

  const handleRestore = (id, name) => {
    if (!confirm(`Warning: Restoring "${name}" will roll back all data to this exact point in time. Proceed?`)) return
    try {
      restoreSnapshot(id)
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 mb-1">
            <HardDrive className="w-3.5 h-3.5" /> High Availability Architecture
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Disaster Recovery & Automated Snapshots</h2>
          <p className="text-xs text-slate-500">Continuous automated checkpoints, point-in-time rollbacks, and failover data preservation</p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
          <ShieldCheck className="w-4 h-4" /> Failover Engine Ready
        </div>
      </div>

      {/* Snapshot Creator */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm">Create On-Demand Point-In-Time Snapshot</h3>
        <div className="flex flex-wrap gap-2 max-w-lg">
          <input
            value={newSnapName}
            onChange={(e) => setNewSnapName(e.target.value)}
            placeholder="e.g. Pre-Audit Snapshot / End of Month..."
            className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-xs bg-slate-50 focus:bg-white"
          />
          <button
            onClick={handleCreate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors shadow-sm"
          >
            📸 Capture Snapshot
          </button>
        </div>
        {statusMsg && <div className="text-xs font-bold text-emerald-700">{statusMsg}</div>}
      </div>

      {/* Snapshot History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-sm">Point-in-Time Recovery Archives ({snapshots.length})</h3>
          <span className="text-xs text-slate-500">Encrypted Local Payloads</span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
            <tr>
              <th className="p-3 text-left">Snapshot Name</th>
              <th className="p-3 text-left">Timestamp</th>
              <th className="p-3 text-center">Type</th>
              <th className="p-3 text-center">Size</th>
              <th className="p-3 text-center">Records</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {snapshots.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50">
                <td className="p-3 text-left font-bold text-slate-900">{s.name}</td>
                <td className="p-3 text-left text-slate-500">{new Date(s.date).toLocaleString()}</td>
                <td className="p-3 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.type === 'AUTO' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {s.type}
                  </span>
                </td>
                <td className="p-3 text-center font-mono text-slate-700">{s.sizeKb} KB</td>
                <td className="p-3 text-center font-bold text-slate-700">{s.recordsCount} entities</td>
                <td className="p-3 text-center space-x-2">
                  <button
                    onClick={() => handleRestore(s.id, s.name)}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-bold text-[11px] transition-colors"
                  >
                    ↺ Rollback Here
                  </button>
                  <button
                    onClick={() => deleteSnapshot(s.id)}
                    className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg text-[11px] transition-colors"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
