import { useState } from 'react'
import { useDB, login, clearLock, ROLES } from '../lib/db'

export default function Login() {
  const db = useDB()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  function submit(e) {
    if (e) e.preventDefault()
    setErr('')
    if (!username.trim()) {
      setErr('Please enter your username or email')
      return
    }
    if (!password) {
      setErr('Please enter your password')
      return
    }
    try {
      clearLock()
      login(username.trim(), password)
    } catch (ex) {
      setErr(ex.message || 'Login failed')
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-slate-900 py-10 px-4 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl p-7 sm:p-9 w-full max-w-lg border border-slate-700/20">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center text-2xl mx-auto shadow-lg shadow-emerald-900/30 mb-3">
            🌿
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{db.settings.pharmacyName}</h1>
          <p className="text-slate-500 text-xs mt-1">Multi-Role Enterprise Pharmacy ERP & POS (Offline & Cloud Synced)</p>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email or Username</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-slate-300 rounded-xl w-full px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium"
              placeholder="owner@pharmacy.com or admin"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-slate-300 rounded-xl w-full px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium"
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
            className="w-full bg-[#714B67] hover:bg-[#5c3c54] text-white py-3 rounded-xl font-bold text-sm cursor-pointer shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98] mt-2"
          >
            Sign In to Station →
          </button>
        </form>
      </div>
    </div>
  )
}
