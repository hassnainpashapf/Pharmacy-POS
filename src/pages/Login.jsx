import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDB, login, clearLock, syncCloudSession, isFirstRun, createOwnerAccount, createOwnerAccountWithGoogle, loginWithVerifiedGoogle } from '../lib/db'
import { validateOwnerForm, MIN_PASSWORD_LENGTH } from '../lib/firstRun'
import { mobileApi } from '../lib/mobileApi'
import { syncNow } from '../lib/syncEngine'
import { ArrowLeft, ArrowRight, Download, ShieldCheck } from 'lucide-react'
import { mountGoogleCredentialButton } from '../lib/googleIdentity'
import { resolveGoogleSignIn, verifyGoogleCredential } from '../lib/googleAuth'
import AppChooser from '../components/AppChooser'
import {
  centralLogin,
  hub,
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

export default function Login({ mode }) {
  const db = useDB()
  const loc = useLocation()
  const navigate = useNavigate()
  const [username, setUsername] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pharmacy_pos_last_username') || ''
    }
    return ''
  })
  // A device with no users at all starts with "Create the owner account" (nothing is pre-installed)
  const setupMode = mode ? mode === 'signup' : loc.pathname === '/signup'
  const setSetupMode = (v) => navigate(v ? '/signup' : '/login')
  const [setup, setSetup] = useState({ name: '', username: '', business: '', password: '', confirm: '' })
  const [setupErrors, setSetupErrors] = useState({})
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

  // what happens after the Optix account (hub) accepted the person: pick an app, or go straight in. Used by the password form and by Google.
  async function afterCentral(result, password) {
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
  }

  // "Sign in with Google" / "Sign up with Google". ONE credential callback per button:
  //  - sign in: the Optix account (hub) first; when the hub has no Optix account for that Gmail, the SAME credential is verified and
  //    matched to a local user of this station (db.jsx -> loginWithVerifiedGoogle)
  //  - sign up (first run only): the hub verifies the credential, then the owner is created from the Google name and Gmail.
  // The button only appears when the hub has a Google Client ID. Only the button of the visible view is mounted.
  const googleRef = useRef(null)
  const businessRef = useRef(business)
  businessRef.current = business
  const setupRef = useRef(setup)
  setupRef.current = setup
  const rememberRef = useRef(remember)
  rememberRef.current = remember

  async function googleSignIn(credential) {
    setErr('')
    setLoading(true)
    try {
      const outcome = await resolveGoogleSignIn(hub, credential, businessRef.current || '')
      if (outcome.kind === 'hub') {
        rememberBusinessId((businessRef.current || '').trim().toLowerCase())
        rememberCentral(outcome.result)
        await afterCentral(outcome.result, '')
        return
      }
      loginWithVerifiedGoogle(outcome.identity.email, { remember: rememberRef.current })
      setLoading(false)
    } catch (e) {
      setErr(e.message || 'Google sign-in failed.')
      setLoading(false)
    }
  }

  async function googleSignUp(credential) {
    setErr('')
    setLoading(true)
    try {
      const typedBiz = String(setupRef.current.business || '').trim()
      const identity = await verifyGoogleCredential(hub, credential)
      const business = typedBiz || `${identity.name || 'My'}'s Pharmacy`
      createOwnerAccountWithGoogle({ identity, business })
    } catch (e) {
      setErr(e.message || 'Google sign-up failed.')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!googleRef.current) return undefined
    const g = mountGoogleCredentialButton(googleRef.current, {
      hub,
      text: setupMode ? 'signup_with' : 'signin_with',
      onCredential: setupMode ? googleSignUp : googleSignIn,
      onError: (e) => { setErr(e.message || 'Google sign-in failed.'); setLoading(false) },
    })
    // test builds only: lets the browser tests hand over a fake credential instead of clicking Google's real button
    if (import.meta.env.VITE_TEST_HOOKS === '1') window.__googleTest = { signIn: googleSignIn, signUp: googleSignUp }
    return () => g.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, setupMode])

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

  function submitSetup(e) {
    e.preventDefault()
    setErr('')
    const { ok, errors } = validateOwnerForm(setup)
    setSetupErrors(errors)
    if (!ok) return
    setLoading(true)
    try {
      createOwnerAccount(setup)
    } catch (ex) {
      setErr(ex.message || 'Could not create the account.')
    }
    setLoading(false)
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
        await afterCentral(result, password)
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
    <div
      className="w-full min-h-screen flex items-center justify-center py-7 px-4 font-sans relative overflow-hidden"
      style={{ background: '#f2f5f9' }}
    >
      <a
        href="#/website"
        className="fixed top-5 left-6 z-20 inline-flex items-center gap-1.5 text-xs font-bold text-[#2f6df6] bg-white/90 backdrop-blur px-3.5 py-1.5 rounded-full border border-[#2f6df6]/15 shadow-sm hover:bg-white transition-all"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Optix MedSync</span>
      </a>

      <div className="w-full max-w-[860px] min-h-[510px] bg-[#ffffff] rounded-[26px] shadow-[0_32px_72px_-18px_rgba(8,28,26,0.34),0_8px_24px_-8px_rgba(8,28,26,0.14)] grid grid-cols-1 md:grid-cols-2 overflow-hidden relative z-10">
        {/* Left Form Panel */}
        <div className="p-8 sm:p-10 flex flex-col items-center justify-center text-center bg-[#ffffff]">
          {choice ? (
            <div className="w-full max-w-[320px]">
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
            </div>
          ) : setupMode ? (
            <div className="w-full max-w-[310px] flex flex-col items-center">
              <h1 className="text-[27px] font-extrabold text-[#1b2a4a] tracking-tight mb-3.5">Sign Up</h1>
              <p className="text-[#7a88a3] text-xs font-medium mb-3.5">Or create your pharmacy account</p>

              <form key="setup-form" onSubmit={submitSetup} className="w-full space-y-2.5" noValidate>
                {[
                  ['business', 'Business / Pharmacy Name', 'text', 'organization'],
                  ['name', 'Your Full Name', 'text', 'name'],
                  ['username', 'Username or Email', 'text', 'username'],
                  ['password', `Password (min ${MIN_PASSWORD_LENGTH} chars)`, 'password', 'new-password'],
                  ['confirm', 'Confirm Password', 'password', 'new-password'],
                ].map(([key, ph, type, ac], i) => (
                  <div key={key}>
                    <input
                      autoFocus={i === 0}
                      type={type}
                      autoComplete={ac}
                      autoCapitalize="none"
                      value={setup[key]}
                      onChange={(e) => setSetup((v) => ({ ...v, [key]: e.target.value }))}
                      className="w-full h-[40px] px-5 rounded-full border border-[#dde4ee] bg-[#eef2f8] text-xs font-medium text-[#1f2937] placeholder-[#7a88a3] focus:bg-white focus:outline-none focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/15 transition-all"
                      placeholder={ph}
                    />
                    {setupErrors[key] && <p className="text-[11px] font-semibold text-rose-600 mt-0.5">{setupErrors[key]}</p>}
                  </div>
                ))}

                {err && <div className="text-rose-600 text-xs font-semibold py-1">{err}</div>}

                <div className="pt-1.5">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-[155px] h-[41px] mx-auto bg-[#2f6df6] hover:bg-[#1f57d6] disabled:opacity-60 text-white rounded-full font-semibold text-xs shadow-[0_10px_22px_-6px_rgba(47,109,246,0.48)] transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center"
                  >
                    {loading ? 'Creating…' : 'Sign Up'}
                  </button>
                </div>
                <div key="google-setup" ref={googleRef} className="justify-center min-h-[38px] [&:not([hidden])]:flex hidden mt-2" hidden />
              </form>
            </div>
          ) : (
            <div className="w-full max-w-[300px] flex flex-col items-center">
              <h1 className="text-[27px] font-extrabold text-[#1b2a4a] tracking-tight mb-4">Sign In</h1>
              <p className="text-[#7a88a3] text-xs font-medium mb-3.5">Or use your account</p>

              <form key="signin-form" onSubmit={submit} className="w-full space-y-3">
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-[43px] px-5 rounded-full border border-[#dde4ee] bg-[#eef2f8] text-xs font-medium text-[#1f2937] placeholder-[#7a88a3] focus:bg-white focus:outline-none focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/15 transition-all"
                  placeholder="Email Address or Username"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[43px] px-5 rounded-full border border-[#dde4ee] bg-[#eef2f8] text-xs font-medium text-[#1f2937] placeholder-[#7a88a3] focus:bg-white focus:outline-none focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/15 transition-all"
                  placeholder="Password"
                />
                <input
                  value={business}
                  onChange={(e) => setBusiness(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full h-[38px] px-5 rounded-full border border-[#dde4ee] bg-[#eef2f8]/80 text-[11.5px] font-medium text-[#1f2937] placeholder-[#7a88a3] focus:bg-white focus:outline-none focus:border-[#2f6df6] focus:ring-3 focus:ring-[#2f6df6]/15 transition-all"
                  placeholder="Business ID (optional)"
                  autoCapitalize="none"
                  autoComplete="off"
                />

                {err && <div className="text-rose-600 text-xs font-semibold py-1">{err}</div>}

                <div className="pt-1 pb-1">
                  <a href={SUITE_URL + '/contact'} className="text-xs font-medium text-[#5b6b85] hover:text-[#2f6df6] hover:underline">
                    Forget your password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-[150px] h-[41px] mx-auto bg-[#2f6df6] hover:bg-[#1f57d6] disabled:opacity-60 text-white rounded-full font-semibold text-xs shadow-[0_10px_22px_-6px_rgba(47,109,246,0.48)] transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center"
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
                <div key="google-signin" ref={googleRef} className="justify-center min-h-[40px] [&:not([hidden])]:flex hidden mt-2" hidden />
              </form>
            </div>
          )}
        </div>

        {/* Right Blurred Artwork Panel */}
        <aside className="relative isolate bg-[#0d1b3d] text-white p-9 flex flex-col items-center justify-center text-center overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute -inset-[20%] -z-10 scale-110"
            style={{
              background:
                'radial-gradient(circle at 70% 70%, #2f6df6 0%, transparent 55%), radial-gradient(circle at 30% 30%, #38bdf8 0%, transparent 46%), radial-gradient(circle at 25% 78%, #38a89d 0%, transparent 44%), radial-gradient(circle at 82% 22%, #7c5cff 0%, transparent 40%)',
              filter: 'blur(26px) saturate(1.25)',
            }}
          />
          <div className="relative z-10 max-w-[250px] flex flex-col items-center">
            <h2 className="text-[30px] font-bold leading-tight mb-3 drop-shadow">
              {setupMode ? 'Welcome Back!' : 'Hey There!'}
            </h2>
            <p className="text-[12.5px] leading-relaxed text-white/90 mb-6 drop-shadow-sm">
              {setupMode
                ? 'Already have an Optix account? Sign in to open your pharmacy counter.'
                : 'Create your account now and step into an amazing new journey.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setErr('')
                setSetupMode(!setupMode)
              }}
              className="w-[150px] h-[41px] rounded-full border-[1.5px] border-white/85 bg-white/10 backdrop-blur text-white text-xs font-semibold hover:bg-white/20 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
            >
              {setupMode ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
