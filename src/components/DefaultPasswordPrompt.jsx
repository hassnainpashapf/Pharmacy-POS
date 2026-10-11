import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useDB, currentUser, updateUser } from '../lib/db'
import { usesDefaultPassword, validateNewPassword } from '../lib/defaultPasswords'

const SNOOZE_KEY = 'pharmacy_pw_snooze'

function snoozedFor(loginAt) {
  try { return sessionStorage.getItem(SNOOZE_KEY) === String(loginAt || '') } catch { return false }
}

// Shown right after sign-in when the signed-in account still has one of the well-known passwords older versions shipped.
// "Remind me later" hides it for this sign-in only; it comes back at the next sign-in until the password is changed.
export default function DefaultPasswordPrompt() {
  const db = useDB()
  const me = currentUser()
  const user = me ? (db.users || []).find((u) => u.id === me.userId) : null
  const [snoozed, setSnoozed] = useState(() => snoozedFor(me?.loginAt))
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [err, setErr] = useState('')

  // central (hub) accounts have no local password; they are never asked
  if (!me || !user || me.cloudConnected || String(me.tenantId || '').startsWith('central-')) return null
  if (!usesDefaultPassword(user) || snoozed || snoozedFor(me.loginAt)) return null

  function later() {
    try { sessionStorage.setItem(SNOOZE_KEY, String(me.loginAt || '')) } catch { /* ignore */ }
    setSnoozed(true)
  }

  function submit(e) {
    e.preventDefault()
    setErr('')
    const { ok, errors: found } = validateNewPassword(user, form)
    setErrors(found)
    if (!ok) return
    try {
      updateUser(user.id, { password: form.password })
      setForm({ password: '', confirm: '' })
    } catch (ex) {
      setErr(ex.message || 'Could not change the password.')
    }
  }

  const input = 'w-full px-4 py-3 rounded-2xl border border-[#e2e8f1] bg-[#f8fafc] text-sm text-[#1b2a4a] placeholder-[#8b94a7] focus:bg-white focus:outline-none focus:border-[#2f6df6] focus:ring-4 focus:ring-[#2f6df6]/15 transition-all shadow-sm'
  const label = 'block text-xs font-bold text-[#3c4761] mb-1.5'
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 font-sans" role="dialog" aria-modal="true" aria-labelledby="default-pw-title">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl border border-[#e2e8f1] shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><KeyRound className="w-5 h-5" /></div>
          <div>
            <h2 id="default-pw-title" className="text-lg font-extrabold text-[#1b2a4a] leading-tight">Change your password</h2>
            <p className="text-sm text-[#3c4761] mt-1">Your password is a known default. Choose a new one now.</p>
          </div>
        </div>
        <div className="space-y-3.5">
          <div>
            <label htmlFor="dp-new" className={label}>New password</label>
            <input id="dp-new" type="password" autoComplete="new-password" autoFocus value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={input} placeholder="At least 8 characters" />
            {errors.password && <p className="text-xs font-semibold text-rose-600 mt-1">{errors.password}</p>}
          </div>
          <div>
            <label htmlFor="dp-confirm" className={label}>Confirm new password</label>
            <input id="dp-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className={input} />
            {errors.confirm && <p className="text-xs font-semibold text-rose-600 mt-1">{errors.confirm}</p>}
          </div>
        </div>
        {err && <p className="text-xs font-semibold text-rose-600 mt-3">{err}</p>}
        <button type="submit" className="w-full bg-[#2f6df6] hover:bg-[#1f4fd1] text-white py-3.5 rounded-2xl font-extrabold text-sm shadow-[0_14px_30px_-10px_rgba(47,109,246,0.5)] transition-all active:scale-[0.98] cursor-pointer mt-5">
          Change password
        </button>
        <button type="button" onClick={later} className="w-full text-center text-xs font-bold text-[#3c4761] hover:text-[#2f6df6] transition-colors py-2.5 mt-1 cursor-pointer">
          Remind me later
        </button>
      </form>
    </div>
  )
}
