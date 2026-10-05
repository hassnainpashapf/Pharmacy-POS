import { useState } from 'react'
import { useDB, login, clearLock, syncCloudSession } from '../lib/db'
import { mobileApi } from '../lib/mobileApi'
import { syncNow } from '../lib/syncEngine'
import { ArrowLeft, ArrowRight, Download, ShieldCheck } from 'lucide-react'

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
    <div className="w-full min-h-screen flex items-center justify-center bg-[#f2f5f9] py-12 px-4 font-sans relative overflow-hidden selection:bg-[#2f6df6] selection:text-white">
      {/* MedSync Ambient Background Radial Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-[#2f6df6]/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[450px] h-[450px] bg-gradient-to-tl from-[#38a89d]/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Login Card - Styled exactly to MedSync Theme */}
      <div className="bg-white rounded-[28px] shadow-[0_30px_80px_-25px_rgba(27,42,74,0.18)] p-8 sm:p-10 w-full max-w-md border border-[#e2e8f1] relative z-10 transition-all">
        {/* Header */}
        <div className="text-center mb-7">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1b2a4a] tracking-tight">
            {db.settings?.pharmacyName || 'Sign In to Station'}
          </h1>
          <p className="text-[#8b94a7] text-xs font-medium mt-1.5">
            Sign in to your Pharmacy POS Station
          </p>
        </div>

        {/* Credentials Form */}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#3c4761] mb-1.5">
              Username or Email
            </label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-[#e2e8f1] bg-[#f8fafc] text-sm text-[#1b2a4a] placeholder-[#8b94a7] focus:bg-white focus:outline-none focus:border-[#2f6df6] focus:ring-4 focus:ring-[#2f6df6]/15 transition-all shadow-sm"
              placeholder="e.g. admin or cashier"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#3c4761] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-[#e2e8f1] bg-[#f8fafc] text-sm text-[#1b2a4a] placeholder-[#8b94a7] focus:bg-white focus:outline-none focus:border-[#2f6df6] focus:ring-4 focus:ring-[#2f6df6]/15 transition-all shadow-sm"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-[#3c4761] select-none font-semibold">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded accent-[#2f6df6] cursor-pointer"
              />
              <span>Remember login locally on this station</span>
            </label>
          </div>

          {err && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl p-3.5 font-medium flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>{err}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2f6df6] hover:bg-[#1f4fd1] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl font-extrabold text-sm shadow-[0_14px_30px_-10px_rgba(47,109,246,0.5)] hover:shadow-[0_18px_36px_-10px_rgba(47,109,246,0.6)] transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mt-3"
          >
            {loading ? (
              <span>Authenticating…</span>
            ) : (
              <>
                <span>Sign In to POS</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation Back to MedSync Website */}
        <div className="pt-5 mt-6 border-t border-[#e2e8f1] flex items-center justify-between text-xs">
          <a
            href="#/website"
            className="inline-flex items-center gap-1.5 font-bold text-[#3c4761] hover:text-[#2f6df6] transition-colors py-1 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>MedSync Website</span>
          </a>

          <a
            href="https://github.com/hassnainpashapf/Pharmacy-POS/releases/download/v1.0.0/Pharmacy-POS-Station-Setup.exe"
            download
            className="inline-flex items-center gap-1 font-bold text-[#8b94a7] hover:text-[#2f6df6] transition-colors py-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Setup .exe</span>
          </a>
        </div>
      </div>
    </div>
  )
}
