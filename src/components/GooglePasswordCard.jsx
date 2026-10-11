import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useDB, currentUser, setPasswordForGoogleUser } from '../lib/db'
import { canSetPasswordWithoutCurrent } from '../lib/googleAuth'
import { validateNewPassword } from '../lib/defaultPasswords'

// Shown in Settings only to a person whose account was created with Google and who never chose a password:
// they may set one once, without a current password, so the station also opens offline.
export default function GooglePasswordCard() {
  const db = useDB()
  const me = currentUser()
  const user = me ? (db.users || []).find((u) => u.id === me.userId) : null
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [err, setErr] = useState('')
  if (!canSetPasswordWithoutCurrent(user)) return null

  function submit(e) {
    e.preventDefault()
    setErr('')
    const { ok, errors: found } = validateNewPassword(user, form)
    setErrors(found)
    if (!ok) return
    try {
      setPasswordForGoogleUser(user.id, form)
      setForm({ password: '', confirm: '' })
    } catch (ex) {
      setErr(ex.message || 'Could not set the password.')
    }
  }

  const input = 'w-full bg-white border border-slate-300 rounded-sm px-3 py-1.5 text-xs font-medium'
  return (
    <form onSubmit={submit} data-testid="google-password-card" className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center"><KeyRound className="w-4 h-4" /></div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Set a password for this station</h3>
          <p className="text-[11px] text-slate-400">You signed up with Google. A password lets you also sign in without the internet.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="gp-new" className="block text-xs font-bold text-slate-700 mb-1">New password</label>
          <input id="gp-new" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={input} placeholder="At least 8 characters" />
          {errors.password && <p className="text-[11px] font-semibold text-rose-600 mt-1">{errors.password}</p>}
        </div>
        <div>
          <label htmlFor="gp-confirm" className="block text-xs font-bold text-slate-700 mb-1">Confirm password</label>
          <input id="gp-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className={input} />
          {errors.confirm && <p className="text-[11px] font-semibold text-rose-600 mt-1">{errors.confirm}</p>}
        </div>
      </div>
      {err && <p className="text-xs font-semibold text-rose-600">{err}</p>}
      <button type="submit" className="px-4 py-2 rounded-xl bg-[#3b1734] hover:bg-[#280c23] text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95">Set password</button>
    </form>
  )
}
