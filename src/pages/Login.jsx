import { useState } from 'react'
import { useDB, login, clearLock, syncCloudSession, ROLES } from '../lib/db'
import { mobileApi } from '../lib/mobileApi'
import { syncNow } from '../lib/syncEngine'

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

    // 1. Automatic Cloud Login (App ID: PH-A1A4534D5D1B is passed automatically)
    try {
      const cloudData = await mobileApi('/login', {
        method: 'POST',
        body: {
          username: trimmed,
          email: trimmed,
          password,
          appId: 'PH-A1A4534D5D1B',
        },
      })
      if (cloudData?.user) {
        syncCloudSession(cloudData.user, password)
        syncNow().catch((err) => console.warn('Post-login sync info:', err))
        setLoading(false)
        return
      }
    } catch (cloudErr) {
      console.warn('Cloud login bypassed/offline, checking local station:', cloudErr?.message || cloudErr)
    }

    // 2. Local Station Fallback
    try {
      login(trimmed, password)
      setLoading(false)
    } catch (ex) {
      setLoading(false)
      setErr('Invalid email or password')
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-slate-900 py-10 px-4 font-sans">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-slate-100">
        <div className="text-center mb-6">
          <img
            src="/icon.svg"
            alt="Pharmacy Logo"
            className="w-12 h-12 rounded-2xl mx-auto shadow-md shadow-emerald-500/20 mb-3"
          />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{db.settings.pharmacyName}</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username or Email</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-slate-200 rounded-xl w-full px-4 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              placeholder="pasha@pharmacy.com or admin"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-slate-200 rounded-xl w-full px-4 py-2.5 text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              placeholder="••••••••"
            />
          </div>

          {err && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 font-medium">
              ⚠️ {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-semibold text-sm cursor-pointer shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
