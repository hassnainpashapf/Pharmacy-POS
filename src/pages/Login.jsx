import { useState } from 'react'
import { useDB, login, clearLock, syncCloudSession, ROLES } from '../lib/db'
import { mobileApi } from '../lib/mobileApi'
import { syncNow } from '../lib/syncEngine'
import BrandLogo from '../components/BrandLogo'

export default function Login() {
  const db = useDB()
  const [username, setUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pharmacy_pos_last_username') || 'admin'
    }
    return 'admin'
  })
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
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
      login(trimmed, password, { remember })
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

          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none font-medium">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded accent-[#008f8b] cursor-pointer"
              />
              <span>Remember login locally on this station</span>
            </label>
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
      </div>
    </div>
  )
}
