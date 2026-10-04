import { useState } from 'react'
import { useDB, login, clearLock, syncCloudSession, ROLES } from '../lib/db'
import { mobileApi } from '../lib/mobileApi'
import { syncNow } from '../lib/syncEngine'
import BrandLogo from '../components/BrandLogo'

export default function Login() {
  const db = useDB()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    if (e) e.preventDefault()
    setErr('')
    const trimmed = username.trim()
    if (!trimmed) {
      setErr('Please enter your username or email')
      return
    }
    if (!password) {
      setErr('Please enter your password')
      return
    }

    setLoading(true)
    clearLock()

    // 1. Local Station First (0ms instant response, 100% offline)
    try {
      login(trimmed, password)
      setLoading(false)
      return
    } catch (localErr) {
      // 2. Cloud Station Fallback (for remote franchise users not in local cache)
      try {
        const cloudData = await mobileApi('/login', {
          method: 'POST',
          body: {
            username: trimmed,
            email: trimmed,
            password,
          },
        })
        if (cloudData?.user) {
          syncCloudSession(cloudData.user, password)
          syncNow().catch((syncErr) => console.warn('Post-login sync info:', syncErr))
          setLoading(false)
          return
        }
      } catch (cloudErr) {
        // Both local and cloud checks failed
      }
      setLoading(false)
      setErr(localErr.message || 'Invalid email or password')
    }
  }

  function handleQuickLogin(userIdentifier, userPass) {
    setUsername(userIdentifier)
    setPassword(userPass)
    setErr('')
    try {
      login(userIdentifier, userPass)
    } catch (e) {
      setErr(e.message || 'Quick login failed')
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-slate-900 py-10 px-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-100">
        <div className="text-center mb-6">
          <BrandLogo className="w-14 h-14 rounded-2xl mx-auto shadow-md shadow-[#008f8b]/20 mb-3" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{db.settings.pharmacyName}</h1>
          <p className="text-slate-400 text-xs mt-1">Sign in to your Pharmacy POS Station</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username or Email</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-slate-200 rounded-xl w-full px-4 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008f8b]/20 focus:border-[#008f8b] transition-all"
              placeholder="admin or cashier"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-slate-200 rounded-xl w-full px-4 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008f8b]/20 focus:border-[#008f8b] transition-all"
              placeholder="••••••••"
            />
          </div>

          {err && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 font-medium flex items-center gap-2">
              <span>⚠️</span>
              <span>{err}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#008f8b] hover:bg-[#007b77] disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-sm cursor-pointer shadow-md shadow-[#008f8b]/20 transition-all active:scale-[0.98] mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Quick Staff Sign-In for Fast Counter Access */}
        <div className="pt-5 mt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Quick Counter Sign-In
            </span>
            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
              1-Click
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'Password@786123')}
              className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-[#e6f7f6] hover:border-[#008f8b]/40 transition-all text-left group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm shrink-0 font-bold">
                👑
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-800 group-hover:text-[#008f8b] truncate">Admin (Owner)</div>
                <div className="text-[10px] text-slate-400 truncate">admin</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('cashier', 'cashier123')}
              className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-[#e6f7f6] hover:border-[#008f8b]/40 transition-all text-left group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm shrink-0 font-bold">
                🧾
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-800 group-hover:text-[#008f8b] truncate">Cashier</div>
                <div className="text-[10px] text-slate-400 truncate">cashier</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('pharmacist', 'pharmacist123')}
              className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-[#e6f7f6] hover:border-[#008f8b]/40 transition-all text-left group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-sm shrink-0 font-bold">
                💊
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-800 group-hover:text-[#008f8b] truncate">Pharmacist</div>
                <div className="text-[10px] text-slate-400 truncate">pharmacist</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('manager', 'manager123')}
              className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-[#e6f7f6] hover:border-[#008f8b]/40 transition-all text-left group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-sm shrink-0 font-bold">
                👔
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-800 group-hover:text-[#008f8b] truncate">Manager</div>
                <div className="text-[10px] text-slate-400 truncate">manager</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
