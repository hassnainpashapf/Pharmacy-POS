import { useState, Fragment } from 'react'
import {
  useDB,
  addUser,
  updateUser,
  deleteUser,
  currentUser,
  ROLES,
  PERMISSION_CATALOG,
  defaultPermissions,
  permissionsFor,
  setUserPermissions,
} from '../lib/db'
import { Modal, Input } from './Medicines'
import { Plus, Pencil, Trash2, KeyRound, ShieldCheck, Users as UsersIcon, SlidersHorizontal } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'ADMIN',        label: '👑 Admin',        desc: 'Full system access' },
  { value: 'MANAGER',      label: '👔 Manager',      desc: 'Stock, Reports & Accounts' },
  { value: 'PHARMACIST',   label: '💊 Pharmacist',   desc: 'Rx Dispensing & Medicines' },
  { value: 'CASHIER',      label: '🧾 Cashier',      desc: 'POS Billing & Shift' },
  { value: 'RECEPTIONIST', label: '📋 Receptionist', desc: 'Patient Intake & Loyalty' },
]

// One cell of the "compare staff" column: shows how a person's effective
// permission differs from what their role gives them by default.
function matrixCell(key, roleDefaults, effective) {
  const inDefault = roleDefaults.has(key)
  const inEffective = effective.has(key)
  if (inEffective && inDefault) return <span className="text-slate-500 font-bold">✓</span>
  if (inEffective) return <span className="text-emerald-600 font-bold" title="Granted beyond the role default">＋</span>
  if (inDefault) return <span className="text-rose-600 font-bold" title="Denied to this person">✕</span>
  return <span className="text-slate-300">—</span>
}

export default function Users() {
  const db = useDB()
  const me = currentUser()
  const [adding, setAdding]   = useState(false)
  const [editing, setEditing] = useState(null)   // user object being edited
  const [deleting, setDeleting] = useState(null) // user object being deleted
  const [resetUser, setResetUser] = useState(null)
  const [permUser, setPermUser] = useState(null)  // user whose permissions are being edited
  const [matrixUser, setMatrixUser] = useState('') // user highlighted in the permission matrix
  const [err, setErr] = useState('')

  // ── Permission matrix data, derived from PERMISSION_CATALOG ──
  const defaultsByRole = Object.fromEntries(
    ROLE_OPTIONS.map((r) => [r.value, new Set(defaultPermissions(r.value))]),
  )
  const matrixSel = db.users.find((u) => u.id === matrixUser) || null
  const matrixEffective = matrixSel ? permissionsFor(matrixSel) : null
  const matrixRows = (() => {
    const rows = []
    const seen = new Set()
    let lastGroup = null
    for (const perm of PERMISSION_CATALOG) {
      if (seen.has(perm.key)) continue // several rows can share a key (tabs)
      seen.add(perm.key)
      rows.push({ ...perm, newGroup: perm.group !== lastGroup })
      lastGroup = perm.group
    }
    return rows
  })()

  function handleErr(fn) {
    setErr('')
    try { fn() } catch (ex) { setErr(ex.message) }
  }

  function doDelete(u) {
    handleErr(() => {
      deleteUser(u.id)
      setDeleting(null)
    })
  }

  return (
    <div className="space-y-6 font-sans pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#714B67]/10 flex items-center justify-center">
            <UsersIcon className="w-5 h-5 text-[#714B67]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">User Roles &amp; Staff</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Manage employees, roles, branch access &amp; passwords</p>
          </div>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Staff</span>
        </button>
      </div>

      {err && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 font-medium">
          ⚠️ {err}
        </div>
      )}

      {/* Role Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {ROLE_OPTIONS.map((r) => {
          const meta = ROLES[r.value] || {}
          const count = (db.users || []).filter(u => u.role === r.value).length
          return (
            <div key={r.value} className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white uppercase tracking-wider"
                  style={{ backgroundColor: meta.color || '#64748b' }}
                >
                  {meta.badge || r.value}
                </span>
                <span className="text-lg font-extrabold text-slate-800">{count}</span>
              </div>
              <div className="text-[11px] font-bold text-slate-800">{r.label.split(' ').slice(1).join(' ')}</div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{r.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            All Staff Accounts
            <span className="ml-2 text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {db.users.length}
            </span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3 text-left font-semibold">Name</th>
                <th className="p-3 text-left font-semibold">Username</th>
                <th className="p-3 text-left font-semibold">Role</th>
                <th className="p-3 text-left font-semibold">Branch</th>
                <th className="p-3 text-center font-semibold">Status</th>
                <th className="p-3 text-left font-semibold">Last Login</th>
                <th className="p-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.users.map((u) => {
                const roleMeta = ROLES[u.role] || ROLES.CASHIER
                const isMe = u.id === me?.userId
                const branch = db.branches?.find(b => b.id === u.branchId)
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Name */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        {u.name}
                        {isMe && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 font-semibold">You</span>
                        )}
                      </div>
                    </td>

                    {/* Username */}
                    <td className="p-3 font-mono text-slate-500 font-medium">@{u.username}</td>

                    {/* Role dropdown */}
                    <td className="p-3">
                      <select
                        value={u.role}
                        disabled={isMe}
                        onChange={(e) => handleErr(() => updateUser(u.id, { role: e.target.value }))}
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        style={{ color: roleMeta.color }}
                      >
                        {ROLE_OPTIONS.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Branch dropdown */}
                    <td className="p-3">
                      <select
                        value={u.branchId || ''}
                        disabled={isMe}
                        onChange={(e) => handleErr(() => updateUser(u.id, { branchId: e.target.value || null }))}
                        className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white disabled:opacity-50 focus:outline-none max-w-[140px]"
                      >
                        <option value="">All Branches</option>
                        {(db.branches || []).map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Status */}
                    <td className="p-3 text-center">
                      {u.active ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Disabled</span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="p-3 text-slate-400 text-[11px]">
                      {u.lastLogin ? (
                        <>
                          <div className="font-medium text-slate-600">{new Date(u.lastLogin).toLocaleDateString()}</div>
                          <div>{new Date(u.lastLogin).toLocaleTimeString()}</div>
                        </>
                      ) : 'Never'}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Enable/Disable */}
                        <button
                          disabled={isMe}
                          onClick={() => handleErr(() => updateUser(u.id, { active: !u.active }))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                            u.active
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {u.active ? 'Disable' : 'Enable'}
                        </button>

                        {/* Edit name/username */}
                        <button
                          onClick={() => setEditing(u)}
                          title="Edit Info"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => setResetUser(u)}
                          title="Reset Password"
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Permissions */}
                        <button
                          onClick={() => setPermUser(u)}
                          title="Edit Permissions"
                          className="p-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          disabled={isMe}
                          onClick={() => setDeleting(u)}
                          title="Delete User"
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!db.users.length && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400 text-sm">
                    No staff accounts yet. Click "Add New Staff" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions matrix — generated from the live permission catalog */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#714B67]" />
            <h3 className="text-sm font-bold text-slate-900">Permissions Matrix</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              live from the permission catalog
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-slate-500" htmlFor="matrix-user">Compare staff</label>
            <select
              id="matrix-user"
              value={matrixUser}
              onChange={(e) => setMatrixUser(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#714B67]/30"
            >
              <option value="">— Role defaults —</option>
              {db.users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left font-semibold text-slate-500 w-48">Permission</th>
                {matrixSel ? (
                  <>
                    <th className="pb-2 text-center font-bold text-slate-700">Role Default</th>
                    <th className="pb-2 text-center font-bold text-slate-700">{matrixSel.name}</th>
                  </>
                ) : (
                  ROLE_OPTIONS.map(r => (
                    <th key={r.value} className="pb-2 text-center font-bold text-slate-700" title={r.desc}>
                      {r.label.split(' ')[0]}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {matrixRows.map((row) => (
                <Fragment key={row.key}>
                  {row.newGroup && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={matrixSel ? 3 : 6} className="px-2 py-1.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        {row.group}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className={`py-2 ${row.to && row.to.includes('?') ? 'pl-6 text-slate-500' : 'text-slate-600 font-medium'}`}>
                      {row.to && row.to.includes('?') && <span className="text-slate-300 mr-1">└</span>}
                      {row.label}
                      {!row.to && (
                        <span className="ml-1.5 text-[9px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">action</span>
                      )}
                    </td>
                    {matrixSel ? (
                      <>
                        <td className="py-2 text-center">
                          {defaultsByRole[matrixSel.role].has(row.key) ? (
                            <span className="text-emerald-500 font-bold">✓</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {matrixCell(row.key, defaultsByRole[matrixSel.role], matrixEffective)}
                        </td>
                      </>
                    ) : (
                      ROLE_OPTIONS.map((r) => (
                        <td key={r.value} className="py-2 text-center">
                          {defaultsByRole[r.value].has(row.key) ? (
                            <span className="text-emerald-500 font-bold">✓</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))
                    )}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {matrixSel && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            <span><b className="text-emerald-600">＋</b> Extra permission (granted beyond role)</span>
            <span><b className="text-rose-600">✕</b> Denied to this person</span>
            <span><b className="text-slate-500">✓</b> Same as role default</span>
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Add User */}
      {adding && (
        <AddUserModal
          db={db}
          onClose={() => setAdding(false)}
          onAdd={(d) => {
            handleErr(() => {
              addUser(d)
              setAdding(false)
            })
          }}
        />
      )}

      {/* Edit User */}
      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSave={(d) => {
            handleErr(() => {
              updateUser(editing.id, d)
              setEditing(null)
            })
          }}
        />
      )}

      {/* Reset Password */}
      {resetUser && (
        <ResetPassModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSave={(pw) => {
            handleErr(() => {
              updateUser(resetUser.id, { password: pw })
              setResetUser(null)
            })
          }}
        />
      )}

      {/* Per-user permissions */}
      {permUser && (
        <PermissionModal
          user={permUser}
          onClose={() => setPermUser(null)}
          onSave={(next) => setUserPermissions(permUser.id, next)}
        />
      )}

      {/* Delete Confirm */}
      {deleting && (
        <Modal title="⚠️ Delete Staff Account" onClose={() => setDeleting(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to <span className="font-bold text-rose-600">permanently delete</span> the account for:
            </p>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-sm">
              <div className="font-bold text-slate-900">{deleting.name}</div>
              <div className="text-slate-500 text-xs mt-0.5">@{deleting.username} · {deleting.role}</div>
            </div>
            <p className="text-xs text-slate-500">This action cannot be undone. All login access will be revoked immediately.</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => doDelete(deleting)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-bold text-xs transition-colors"
              >
                Yes, Delete Account
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ─── Add User Modal ─── */
function AddUserModal({ db, onClose, onAdd }) {
  const [f, setF] = useState({ username: '', name: '', role: 'CASHIER', pw: '', branchId: null })
  return (
    <Modal title="➕ Create New Staff Member" onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <Input label="Full Name *"  value={f.name}     onChange={e => setF({ ...f, name: e.target.value })} />
        <Input label="Username *"   value={f.username} onChange={e => setF({ ...f, username: e.target.value })} />
        <Input label="Password *" type="password" value={f.pw || ''} onChange={e => setF({ ...f, pw: e.target.value })} />

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Role</label>
          <select
            value={f.role}
            onChange={e => setF({ ...f, role: e.target.value })}
            className="border border-slate-200 rounded-xl w-full px-3 py-2 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#714B67]/30"
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
            ))}
          </select>
        </div>

        <div className="col-span-1 sm:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">Branch Assignment</label>
          <select
            value={f.branchId || ''}
            onChange={e => setF({ ...f, branchId: e.target.value || null })}
            className="border border-slate-200 rounded-xl w-full px-3 py-2 text-xs bg-white focus:outline-none"
          >
            <option value="">Head Office — All Branches Access</option>
            {(db.branches || []).map(b => (
              <option key={b.id} value={b.id}>{b.name} — {b.city}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={() => onAdd({ ...f, password: f.pw })}
        className="mt-5 w-full bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
      >
        Create Staff Account
      </button>
    </Modal>
  )
}

/* ─── Edit User Modal ─── */
function EditUserModal({ user, onClose, onSave }) {
  const [f, setF] = useState({ name: user.name, username: user.username })
  return (
    <Modal title={`✏️ Edit — ${user.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Input label="Full Name"  value={f.name}     onChange={e => setF({ ...f, name: e.target.value })} />
        <Input label="Username"   value={f.username} onChange={e => setF({ ...f, username: e.target.value })} />
      </div>
      <button
        onClick={() => onSave(f)}
        className="mt-5 w-full bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
      >
        Save Changes
      </button>
    </Modal>
  )
}

/* ─── Per-user Permission Editor ─── */
function PermissionModal({ user, onClose, onSave }) {
  const defaults = new Set(defaultPermissions(user.role))
  const [grants, setGrants] = useState(() => new Set(user.perms?.grants || []))
  const [revokes, setRevokes] = useState(() => new Set(user.perms?.revokes || []))
  const [error, setError] = useState('')

  // Administrators keep user management: one missed checkbox would otherwise
  // lock every account out of this screen for good.
  const lockUserManagement = user.role === 'ADMIN' && user.active !== false

  const stateOf = (key) => (revokes.has(key) ? 'deny' : grants.has(key) ? 'allow' : 'inherit')

  function setState(key, state) {
    const g = new Set(grants)
    const r = new Set(revokes)
    g.delete(key)
    r.delete(key)
    if (state === 'allow') g.add(key)
    if (state === 'deny') r.add(key)
    setGrants(g)
    setRevokes(r)
  }

  // Catalog order, de-duplicated (tabs share a key with their page).
  const permissionRows = PERMISSION_CATALOG.filter((perm, i, all) => (
    all.findIndex((p) => p.key === perm.key) === i
  ))
  const grouped = []
  for (const perm of permissionRows) {
    let bucket = grouped.find((g) => g.title === perm.group)
    if (!bucket) grouped.push((bucket = { title: perm.group, items: [] }))
    bucket.items.push(perm)
  }

  const overrideCount = grants.size + revokes.size

  function save() {
    setError('')
    try {
      onSave({ grants: [...grants], revokes: [...revokes] })
      onClose()
    } catch (ex) {
      setError(ex.message || 'Could not save permissions')
    }
  }

  function TriButton({ active, tone, children, disabled, title, onClick }) {
    const tones = {
      inherit: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      allow: 'bg-emerald-600 text-white hover:bg-emerald-700',
      deny: 'bg-rose-600 text-white hover:bg-rose-700',
    }
    const inactive = 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-200'
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={onClick}
        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active ? tones[tone] : inactive}`}
      >
        {children}
      </button>
    )
  }

  return (
    <Modal title={`🔐 Permissions — ${user.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600">
          <b>{user.name}</b> keeps the <b>{ROLES[user.role]?.badge || user.role}</b> role defaults.
          Each permission below can be forced <b className="text-emerald-700">on</b> or{' '}
          <b className="text-rose-700">off</b> for this person only — everything else follows the role.
        </div>

        <div className="max-h-[46vh] overflow-y-auto pr-1 space-y-3">
          {grouped.map((bucket) => (
            <div key={bucket.title}>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                {bucket.title}
              </div>
              <div className="divide-y divide-slate-50">
                {bucket.items.map((perm) => {
                  const state = stateOf(perm.key)
                  const isLocked = lockUserManagement && perm.key === 'users'
                  return (
                    <div key={perm.key} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="truncate">{perm.to && perm.to.includes('?') && <span className="text-slate-300 mr-1">└</span>}{perm.label}</span>
                          {!perm.to && (
                            <span className="text-[9px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">action</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {defaults.has(perm.key) ? 'Role default: allowed' : 'Role default: not allowed'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" role="group" aria-label={perm.label}>
                        <TriButton
                          active={state === 'inherit'} tone="inherit"
                          title="Follow the role default"
                          onClick={() => setState(perm.key, 'inherit')}
                        >Role</TriButton>
                        <TriButton
                          active={state === 'allow'} tone="allow"
                          title="Always allow this person"
                          onClick={() => setState(perm.key, 'allow')}
                        >Allow</TriButton>
                        <TriButton
                          active={state === 'deny'} tone="deny"
                          disabled={isLocked}
                          title={isLocked ? 'Administrators always keep User Management' : 'Never allow this person'}
                          onClick={() => setState(perm.key, 'deny')}
                        >Deny</TriButton>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 font-medium">
            ⚠️ {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="text-[11px] text-slate-500">
            {overrideCount ? (
              <><b className="text-violet-700">{overrideCount}</b> override{overrideCount === 1 ? '' : 's'} active</>
            ) : 'Inheriting every permission from the role'}
          </div>
          <div className="flex items-center gap-2">
            {overrideCount > 0 && (
              <button
                type="button"
                onClick={() => { setGrants(new Set()); setRevokes(new Set()) }}
                className="px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Reset to role
              </button>
            )}
            <button
              type="button"
              onClick={save}
              className="px-4 py-2.5 rounded-xl bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              Save Permissions
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ─── Reset Password Modal ─── */
function ResetPassModal({ user, onClose, onSave }) {
  const [pw, setPw]   = useState('')
  const [pw2, setPw2] = useState('')
  const mismatch = pw && pw2 && pw !== pw2
  return (
    <Modal title={`🔑 Reset Password — ${user.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Input label="New Password"     type="password" value={pw}  onChange={e => setPw(e.target.value)} />
        <Input label="Confirm Password" type="password" value={pw2} onChange={e => setPw2(e.target.value)} />
        {mismatch && <p className="text-xs text-rose-600 font-semibold">⚠️ Passwords do not match</p>}
      </div>
      <button
        disabled={!pw || mismatch}
        onClick={() => onSave(pw)}
        className="mt-5 w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95"
      >
        Update Password
      </button>
    </Modal>
  )
}
