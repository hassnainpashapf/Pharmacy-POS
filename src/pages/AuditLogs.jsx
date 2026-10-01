import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useDB } from '../lib/db'
import { filterAuditLogs } from '../lib/auditFilters'

const emptyFilters = { query: '', user: '', action: '', from: '', to: '' }
const fieldStyle = 'mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-xs'

export default function AuditLogs() {
  const db = useDB()
  const [filters, setFilters] = useState(emptyFilters)
  const logs = db.auditLogs || []
  const users = [...new Set(logs.map((log) => log.user).filter(Boolean))].sort()
  const actions = [...new Set(logs.map((log) => log.action).filter(Boolean))].sort()
  const rows = filterAuditLogs(logs, filters)
  const update = (key) => (event) => setFilters((previous) => ({ ...previous, [key]: event.target.value }))
  const invalidRange = filters.from && filters.to && filters.from > filters.to

  return (
    <div className="space-y-4 w-full pb-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2"><ClipboardList className="w-5 h-5" />Audit Logs</h2>
        <p className="text-xs text-slate-600 mt-1">Read-only activity recorded by this installation: sign-ins, sales, stock changes and other logged actions.</p>
        <p className="text-xs text-slate-600 mt-2">Showing {rows.length} of {logs.length} saved events. The local log retains up to 500 events; it is not an immutable compliance archive.</p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="text-xs font-semibold">Search activity<input value={filters.query} onChange={update('query')} placeholder="User, action or details" className={fieldStyle} /></label>
          <label className="text-xs font-semibold">User<select value={filters.user} onChange={update('user')} className={fieldStyle}><option value="">All users</option>{users.map((user) => <option key={user}>{user}</option>)}</select></label>
          <label className="text-xs font-semibold">Action<select value={filters.action} onChange={update('action')} className={fieldStyle}><option value="">All actions</option>{actions.map((action) => <option key={action}>{action}</option>)}</select></label>
          <label className="text-xs font-semibold">From<input type="date" value={filters.from} onChange={update('from')} className={fieldStyle} /></label>
          <label className="text-xs font-semibold">To<input type="date" value={filters.to} onChange={update('to')} className={fieldStyle} /></label>
        </div>
        <button type="button" onClick={() => setFilters(emptyFilters)} className="px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold">Clear filters</button>
        {invalidRange && <p role="alert" className="text-xs text-rose-700">From date must be on or before To date.</p>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50"><tr>{['Date & Time (Local)', 'User', 'Action', 'Details'].map((label) => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((log) => <tr key={log.id} className="hover:bg-slate-50">
              <td className="p-3 whitespace-nowrap">{Number.isNaN(Date.parse(log.at)) ? 'Unknown date' : new Date(log.at).toLocaleString('en-GB')}</td>
              <td className="p-3 font-semibold">{log.user || 'system'}</td>
              <td className="p-3">{log.action || '—'}</td>
              <td className="p-3 whitespace-pre-wrap break-words">{log.detail || '—'}</td>
            </tr>)}
            {!rows.length && <tr><td colSpan={4} className="p-8 text-center text-slate-600">{logs.length ? 'No events match these filters.' : 'No audit events recorded yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
