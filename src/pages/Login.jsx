import { useState } from 'react'
import { useDB, login, clearLock, syncCloudSession } from '../lib/db'
import { mobileApi } from '../lib/mobileApi'
import { syncNow } from '../lib/syncEngine'
import { ArrowLeft, ArrowRight, Download, ShieldCheck } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'
import AppChooser from '../components/AppChooser'
import {
  centralLogin,
  clearCentral,
  lastBusinessId,
  localPasswordFor,
  openApp,
  THIS_APP,
  rememberBusinessId,
  rememberCentral,
  SUITE_URL,
  toLocalUser,
} from '../lib/central'

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
  const [business, setBusiness] = useState(() => lastBusinessId())
  const [choice, setChoice] = useState(null) // { result, password } while the person picks Pharmacy or Lab

  // Turn the cloud sign-in into the local pharmacy session (the pharmacy data itself stays on this device)
  function enterPharmacy(result, password) {
    syncCloudSession(toLocalUser(result), localPasswordFor(password))
    syncNow().catch((syncErr) => console.warn('Post-login sync info:', syncErr))
  }

  async function choose(app) {
    setErr('')
    setLoading(true)
    try {
      if (app === THIS_APP) enterPharmacy(choice.result, choice.password)
      else await openApp(app)
    } catch (e) {
      setErr(e.message || 'Could not open the app.')
      setLoading(false)
    }
  }

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

    // 0. The Optix account: one login for the Pharmacy POS and the Lab app (and one superadmin).
    //    "Not an Optix account" (401) or "no connection" falls through to this station's own accounts below, so offline stations keep working.
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      try {
        const result = await centralLogin(business, trimmed, password)
        rememberBusinessId(business.trim().toLowerCase())
        rememberCentral(result)
        const apps = result.apps || []
        if (apps.length > 1) {
          setChoice({ result, password })
        } else if (apps.includes(THIS_APP)) {
          enterPharmacy(result, password)
        } else if (apps.length === 1) {
          await openApp(apps[0]) // the only app this person has lives on another site
          return
        } else {
          setErr('This account has no app yet. Ask your administrator to give you access.')
        }
        setLoading(false)
        return
      } catch (centralErr) {
        if (!centralErr.network && centralErr.status && centralErr.status !== 401) {
          setErr(centralErr.message)
          setLoading(false)
          return
        }
      }
    }

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
    <div className="w-full min-h-screen flex items-center justify-center bg-o-bg py-12 px-4 font-sans relative overflow-hidden selection:bg-o-blue selection:text-white">
      {/* Same hero mesh as the Optix websites */}
      <div className="absolute inset-x-0 top-0 h-[320px] z-0 overflow-hidden rounded-b-[44px]" style={{ background: 'var(--grad-hero)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(40% 60% at 20% 30%, #3d6fff33, transparent 70%), radial-gradient(35% 50% at 80% 70%, #7be0d433, transparent 70%)' }} />
      </div>
      <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-6 flex items-center justify-between z-20">
        <a href="#/website" className="inline-flex items-center gap-2 text-white font-extrabold tracking-tight" aria-label="Optix MedSync website">
          <BrandLogo className="w-8 h-8 rounded-lg shrink-0" />
          <span>Optix <span className="font-medium text-white/70">MedSync</span></span>
        </a>
      </div>
      {/* MedSync Ambient Background Radial Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-o-blue/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[450px] h-[450px] bg-gradient-to-tl from-o-teal/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Login Card - Styled exactly to MedSync Theme */}
      <div className="bg-white rounded-[28px] shadow-[0_30px_80px_-25px_rgba(8,14,40,0.45)] p-8 sm:p-10 w-full max-w-md border border-o-line relative z-10 transition-all mt-10">
        {choice ? (
          <AppChooser
            apps={(choice.result.catalog || []).filter((app) => (choice.result.apps || []).includes(app.id))}
            name={choice.result.user?.name}
            business={choice.result.lab?.name}
            busy={loading}
            error={err}
            onChoose={choose}
            onCancel={() => {
              clearCentral()
              setChoice(null)
              setLoading(false)
            }}
          />
        ) : (
          <>
        {/* Header */}
        <div className="text-center mb-7">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-o-ink tracking-tight">
            Sign In
          </h1>
          <p className="text-o-muted text-xs font-medium mt-1.5">
            Enter your credentials to continue
          </p>
        </div>

        {/* Credentials Form */}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-o-text2 mb-1.5">
              Username or Email
            </label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-o-line bg-o-bg text-sm text-o-ink placeholder-o-muted focus:bg-white focus:outline-none focus:border-o-blue focus:ring-4 focus:ring-o-blue/15 transition-all shadow-sm"
              placeholder="e.g. admin or cashier"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-o-text2 mb-1.5">
              Business ID <span className="font-medium text-o-muted">(only if your administrator gave you one)</span>
            </label>
            <input
              value={business}
              onChange={(e) => setBusiness(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="w-full px-4 py-3 rounded-2xl border border-o-line bg-o-bg text-sm text-o-ink placeholder-o-muted focus:bg-white focus:outline-none focus:border-o-blue focus:ring-4 focus:ring-o-blue/10 transition-all font-medium"
              placeholder="e.g. city-care"
              autoCapitalize="none"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-o-text2 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-o-line bg-o-bg text-sm text-o-ink placeholder-o-muted focus:bg-white focus:outline-none focus:border-o-blue focus:ring-4 focus:ring-o-blue/15 transition-all shadow-sm"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-o-text2 select-none font-semibold">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded accent-o-blue cursor-pointer"
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
            className="w-full bg-o-blue hover:bg-o-blue-d disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl font-extrabold text-sm shadow-[0_14px_30px_-10px_rgba(47,109,246,0.5)] hover:shadow-[0_18px_36px_-10px_rgba(47,109,246,0.6)] transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mt-3"
          >
            {loading ? (
              <span>Authenticating…</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation Back to MedSync Website */}
        <div className="pt-5 mt-6 border-t border-o-line flex items-center justify-between text-xs">
          <a
            href="#/website"
            className="inline-flex items-center gap-1.5 font-bold text-o-text2 hover:text-o-link transition-colors py-1 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Optix MedSync Website</span>
          </a>

          <a
            href={SUITE_URL}
            className="inline-flex items-center gap-1 font-bold text-o-text2 hover:text-o-link transition-colors py-1"
          >
            <span>All Optix apps</span>
          </a>

          <a
            href="https://github.com/hassnainpashapf/Pharmacy-POS/releases/download/v2.0.0/Optix-MedSync-Setup-2.0.0.exe"
            download
            className="inline-flex items-center gap-1 font-bold text-o-muted hover:text-o-link transition-colors py-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Setup .exe</span>
          </a>
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-[11px] font-semibold text-o-muted">
          <a href="/privacy" className="hover:text-o-link">Privacy Policy</a>
          <span aria-hidden="true">&middot;</span>
          <a href="/terms" className="hover:text-o-link">Terms of Use</a>
        </div>
          </>
        )}
      </div>
    </div>
  )
}
