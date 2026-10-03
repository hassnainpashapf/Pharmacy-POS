import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Copy, LogOut, Plus, RefreshCw, ShieldCheck, WifiOff, Activity, Download, Search, Users, Package, CheckCircle2, Ban } from 'lucide-react'
import { mobileApi, MobileApiError } from '../lib/mobileApi'
import { pharmacyLinks, tenantTotals } from '../lib/tenantUi'

const primary = 'min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-all'
const secondary = 'min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
const emptyPharmacy = () => ({ name: '', adminName: '', email: '', password: '' })

function Field({ label, ...props }) {
  return <label className="block space-y-1.5 text-sm font-semibold"><span>{label}</span><input {...props} className="min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base outline-none focus:border-[#714b67] focus:ring-2 focus:ring-[#714b67]/20 disabled:opacity-60" /></label>
}

function Notice({ children, error = false }) {
  return <div role={error ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-teal-200 bg-teal-50 text-teal-900'}`}>{children}</div>
}

export function PlatformAuthForm({ setup, online, onAuthenticated, onError }) {
  const [draft, setDraft] = useState({ username: '', name: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const guard = useRef(false)
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(globalThis.location?.hostname)
  const field = key => ({ value: draft[key], onChange: event => setDraft(current => ({ ...current, [key]: event.target.value })) })
  async function submit(event) {
    event.preventDefault()
    if (guard.current || uncertain) return
    guard.current = true
    setBusy(true)
    try {
      const data = await mobileApi(setup ? '/setup' : '/login', { method: 'POST', body: setup ? draft : { appId: '', username: draft.username, password: draft.password } })
      if (!data?.user?.id) throw new MobileApiError('Session response could not be verified. Refresh server status before retrying.', { uncertain: true })
      onAuthenticated(data.user)
    } catch (error) {
      if (error.uncertain) setUncertain(true)
      onError(error)
    } finally {
      setDraft(current => ({ ...current, password: '' }))
      guard.current = false
      setBusy(false)
    }
  }
  return <section className={`${card} mx-auto max-w-md`}>
    <h2 className="text-xl font-bold">{setup ? 'Set up superadmin' : 'Superadmin sign in'}</h2>
    <p className="mt-2 text-sm text-slate-600">{setup ? 'Create the first platform account on the server computer using localhost. Choose your own username and password.' : 'Use your platform account to create pharmacies and manage their access.'}</p>
    {setup && !local ? <div className="mt-4"><Notice>Open /superadmin through localhost on the server computer to complete first-time setup.</Notice></div> : <form className="mt-5 space-y-4" onSubmit={submit}>
      <fieldset disabled={busy || uncertain || !online} className="space-y-4">
        {setup && <Field label="Full name" {...field('name')} required maxLength={120} autoComplete="name" />}
        <Field label="Username" {...field('username')} required minLength={3} maxLength={80} autoComplete="username" autoCapitalize="none" spellCheck={false} />
        <Field label={setup ? 'Password (12–256 characters)' : 'Password'} {...field('password')} required type="password" minLength={setup ? 12 : undefined} maxLength={256} autoComplete={setup ? 'new-password' : 'current-password'} />
      </fieldset>
      <button className={`${primary} w-full`} disabled={busy || uncertain || !online}>{busy ? 'Connecting…' : setup ? 'Create superadmin' : 'Sign in'}</button>
      {uncertain && <Notice error>The request may have completed. Refresh server status below before trying again.</Notice>}
    </form>}
    <a className="mt-4 inline-block text-sm font-semibold text-[#714b67] underline" href="/admin">Pharmacy sign in</a>
  </section>
}

export function TenantCard({ tenant, disabled, onUpdate, onReset, onCopy }) {
  const [name, setName] = useState(tenant.name)
  const [password, setPassword] = useState('')
  const links = pharmacyLinks(tenant.appId)
  useEffect(() => setName(tenant.name), [tenant.name])
  async function toggle() {
    const action = tenant.disabled ? 'Enable' : 'Disable'
    if (!window.confirm(`${action} ${tenant.name} (${tenant.appId})?${tenant.disabled ? '' : ' Its pharmacy staff will lose access.'}`)) return
    await onUpdate(tenant, { disabled: !tenant.disabled })
  }
  async function reset(event) {
    event.preventDefault()
    if (!window.confirm(`Reset the administrator password for ${tenant.name} (${tenant.adminUsername})? The old password will stop working.`)) return
    const nextPassword = password
    setPassword('')
    await onReset(tenant, nextPassword)
  }
  return <article className={`${card} min-w-0`}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-lg font-bold">{tenant.name}</h3><p className="mt-1 break-all text-sm">App ID: <strong>{tenant.appId}</strong></p><p className="mt-1 break-all text-xs text-slate-600">Admin: {tenant.adminUsername || 'Not assigned'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${tenant.disabled ? 'bg-rose-50 text-rose-800' : 'bg-teal-50 text-teal-800'}`}>{tenant.disabled ? 'Disabled' : 'Active'}</span></div>
    <dl className="my-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">{[['Medicines', tenant.medicineCount], ['Stock units', tenant.stockUnits], ['Users', tenant.userCount]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 font-bold">{Number(value ?? 0).toLocaleString()}</dd></div>)}</dl>
    {links && <div className="space-y-3">{[['Desktop admin', links.admin], ['Mobile inventory', links.mobile]].map(([label, link]) => <div key={label} className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-bold">{label}</p><a href={link} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-[#714b67] underline">{link}</a><button type="button" className={`${secondary} mt-2 w-full`} onClick={() => onCopy(link)}><Copy size={15} />Copy {label.toLowerCase()} link</button></div>)}</div>}
    <div className="mt-4"><button type="button" className={secondary} disabled={disabled} onClick={toggle}>{tenant.disabled ? 'Enable pharmacy' : 'Disable pharmacy'}</button></div>
    <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Edit name or reset admin password</summary>
      <form className="mt-2 space-y-3" onSubmit={async event => { event.preventDefault(); await onUpdate(tenant, { name: name.trim() }) }}><Field label="Pharmacy name" value={name} onChange={event => setName(event.target.value)} required maxLength={120} disabled={disabled} /><button className={secondary} disabled={disabled || !name.trim() || name.trim() === tenant.name}>Save name</button></form>
      <form className="mt-5 space-y-3 border-t border-slate-100 pt-4" onSubmit={reset}><Field label="New admin password (12–256 characters)" type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={12} maxLength={256} autoComplete="new-password" disabled={disabled} /><p className="text-xs text-slate-600">Choose a password and share it with the pharmacy administrator securely.</p><button className={secondary} disabled={disabled || !tenant.adminUsername}>Reset admin password</button></form>
    </details>
  </article>
}

export default function Superadmin() {
  const [phase, setPhase] = useState('loading')
  const [setup, setSetup] = useState(false)
  const [user, setUser] = useState(null)
  const [online, setOnline] = useState(() => globalThis.navigator?.onLine !== false)
  const [tenants, setTenants] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState(emptyPharmacy)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const bootstrapGuard = useRef(false)
  const writeGuard = useRef(false)
  const readSequence = useRef(0)

  const handleError = useCallback(error => {
    setError(error.message || 'Unable to complete the request.')
    if (error.status === 401) {
      readSequence.current++
      setUser(null); setTenants([]); setLoaded(false); setPhase('auth')
      setDraft(current => ({ ...current, password: '' }))
    }
  }, [])

  const load = useCallback(async () => {
    const sequence = ++readSequence.current
    setLoading(true)
    try {
      const data = await mobileApi('/platform/tenants')
      if (!Array.isArray(data?.tenants) || data.tenants.some(tenant => !tenant.id || !tenant.appId)) throw new Error('Pharmacy list response is invalid. Check the platform server.')
      if (sequence !== readSequence.current) return null
      setTenants(data.tenants)
      setLoaded(true)
      setLastRefreshed(new Date())
      return data.tenants
    } catch (error) { if (sequence === readSequence.current) handleError(error); return null } finally { if (sequence === readSequence.current) setLoading(false) }
  }, [handleError])

  const bootstrap = useCallback(async () => {
    if (bootstrapGuard.current) return
    bootstrapGuard.current = true
    setPhase('loading')
    setError('')
    try {
      const status = await mobileApi('/status')
      if (typeof status.setupRequired !== 'boolean') throw new Error('Platform API unavailable. Check the server and /api/mobile proxy.')
      setSetup(status.setupRequired)
      if (status.setupRequired) { setPhase('auth'); return }
      try {
        const session = await mobileApi('/session')
        if (!session?.user?.id) throw new Error('Session response is invalid.')
        setUser(session.user)
        setPhase(session.user.role === 'SUPERADMIN' ? 'ready' : 'pharmacy')
        if (session.user.role === 'SUPERADMIN') await load()
      } catch (error) { if (error.status === 401) { setUser(null); setPhase('auth') } else throw error }
    } catch (error) { setPhase('unavailable'); handleError(error) } finally { bootstrapGuard.current = false }
  }, [load, handleError])

  useEffect(() => { bootstrap() }, [bootstrap])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  async function authenticated(nextUser) {
    setUser(nextUser); setSetup(false); setError(''); setMessage('')
    setPhase(nextUser.role === 'SUPERADMIN' ? 'ready' : 'pharmacy')
    if (nextUser.role === 'SUPERADMIN') await load()
  }

  async function mutate(action) {
    if (writeGuard.current || uncertain || !online) return false
    writeGuard.current = true
    setBusy(true); setError(''); setMessage('')
    try { await action(); return true } catch (error) {
      if (error.uncertain) setUncertain(true)
      handleError(error)
      return false
    } finally { writeGuard.current = false; setBusy(false) }
  }

  async function create(event) {
    event.preventDefault()
    const adminEmail = (draft.email || draft.username || '').trim().toLowerCase()
    const body = {
      name: draft.name.trim(),
      adminName: draft.adminName.trim(),
      email: adminEmail,
      username: adminEmail,
      password: draft.password,
    }
    const saved = await mutate(async () => {
      const data = await mobileApi('/platform/tenants', { method: 'POST', body })
      if (!data?.tenant?.id || !data.tenant.appId || !data?.admin?.id) throw new MobileApiError('Creation response could not be verified. Check the pharmacy list before creating another account.', { uncertain: true })
      setMessage(`Created ${data.tenant.name}. Login Email: ${adminEmail}. Ready for Windows EXE, Web, and Mobile sign in.`)
      await load()
    })
    setDraft(current => saved ? emptyPharmacy() : { ...current, password: '' })
  }

  async function update(tenant, body) {
    await mutate(async () => {
      await mobileApi(`/platform/tenants/${encodeURIComponent(tenant.id)}`, { method: 'PATCH', body })
      const current = (await load())?.find(item => item.id === tenant.id)
      if (!current || Object.entries(body).some(([key, value]) => current[key] !== value)) throw new MobileApiError('The pharmacy update could not be verified. Refresh and check its current details.', { uncertain: true })
      setMessage(`Updated ${current.name}.`)
    })
  }

  async function reset(tenant, password) {
    await mutate(async () => {
      await mobileApi(`/platform/tenants/${encodeURIComponent(tenant.id)}/reset-admin`, { method: 'POST', body: { password } })
      setMessage(`The server accepted the admin password reset for ${tenant.name}.`)
    })
  }

  async function copy(link) {
    setError(''); setMessage('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable here. Select and copy the displayed link manually.')
      await navigator.clipboard.writeText(link)
      setMessage('Link copied.')
    } catch (error) { setError(error.message || 'Unable to copy. Select and copy the displayed link manually.') }
  }

  async function logout() {
    if (writeGuard.current) return
    writeGuard.current = true
    setBusy(true); setError('')
    try {
      const data = await mobileApi('/logout', { method: 'POST' })
      if (data?.ok !== true) throw new Error('Sign out could not be verified. Refresh server status.')
      readSequence.current++
      setUser(null); setTenants([]); setLoaded(false); setLoading(false); setPhase('auth'); setDraft(emptyPharmacy()); setMessage(''); setUncertain(false)
    } catch (error) { handleError(error) } finally { writeGuard.current = false; setBusy(false) }
  }

  const totals = tenantTotals(tenants)
  const search = query.trim().toLocaleLowerCase()
  const visible = tenants.filter(tenant => [tenant.name, tenant.appId, tenant.adminUsername].some(value => String(value ?? '').toLocaleLowerCase().includes(search)))
    .filter(tenant => statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? !tenant.disabled : tenant.disabled))
  const locked = busy || loading || uncertain || !online || !loaded
  const field = key => ({ value: draft[key], onChange: event => setDraft(current => ({ ...current, [key]: event.target.value })) })
  function exportTenants() {
    const rows = [['Pharmacy', 'App ID', 'Status', 'Admin', 'Medicines', 'Stock Units', 'Users'], ...tenants.map(t => [t.name, t.appId, t.disabled ? 'Disabled' : 'Active', t.adminUsername || '', t.medicineCount || 0, t.stockUnits || 0, t.userCount || 0])]
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `system-optix-pharmacies-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }
  return <main className="min-h-screen bg-[#f8f6fa] pb-10 text-slate-900" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
    <header className="border-b border-purple-100 bg-white px-4 py-5"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-2xl bg-[#714b67] p-3 text-white"><ShieldCheck size={25} /></div><div><h1 className="text-xl font-bold sm:text-2xl">Superadmin</h1><p className="text-xs text-slate-600">Pharmacy platform</p></div></div>{user && <div className="flex items-center gap-3"><p className="text-right text-sm"><strong>{user.name}</strong><br /><span className="text-xs">{user.role}</span></p><button className={secondary} onClick={logout} disabled={busy || !online}><LogOut size={16} />Sign out</button></div>}</div></header>
    <div className="mx-auto max-w-7xl space-y-5 px-4 pt-5 sm:px-6">
      {!online && <Notice error><span className="inline-flex items-center gap-2"><WifiOff size={16} />Offline. Reconnect to manage pharmacies. Displayed data may be out of date.</span></Notice>}
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {phase === 'loading' && <div className={card} role="status">Connecting to the platform…</div>}
      {phase === 'unavailable' && <section className={card}><h2 className="text-lg font-bold">Platform API unavailable</h2><p className="mt-2 text-sm">Check your connection and that the shared server is running.</p><button className={`${primary} mt-4`} onClick={bootstrap} disabled={!online}>Retry connection</button></section>}
      {phase === 'auth' && <><PlatformAuthForm key={setup ? 'setup' : 'login'} setup={setup} online={online} onAuthenticated={authenticated} onError={handleError} /><div className="text-center"><button className={secondary} onClick={bootstrap} disabled={!online}>Refresh server status</button></div></>}
      {phase === 'pharmacy' && <section className={card}><h2 className="text-xl font-bold">Pharmacy account signed in</h2><p className="mt-2 text-sm">{user?.pharmacyName} · App ID: {user?.appId}. Sign out to use a superadmin account.</p><a className={`${primary} mt-4`} href={pharmacyLinks(user?.appId)?.admin || '/admin'}>Open pharmacy admin</a></section>}
      {phase === 'ready' && <>
         <section className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Platform Dashboard</h2><p className="mt-1 text-sm text-slate-600">{lastRefreshed ? `Last updated ${lastRefreshed.toLocaleTimeString()}` : 'Platform overview'}</p></div><div className="flex gap-2"><button className={secondary} disabled={busy || loading || !online} onClick={() => { setError(''); load() }}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{loading ? 'Loading…' : 'Refresh'}</button><button className={secondary} disabled={!loaded || !tenants.length} onClick={exportTenants}><Download size={16} />Export CSV</button></div></section>
        {uncertain && <Notice error><p>A request may have completed. Refresh the pharmacy list and check it before making another change. For a password reset, confirm the outcome with the administrator before submitting again.</p><button className={`${secondary} mt-3`} disabled={loading || busy || !online} onClick={async () => { if (await load()) { setUncertain(false); setError(''); setMessage('Pharmacy list refreshed. Check the details before making another change.') } }}>Refresh and review current state</button></Notice>}
         <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[['Pharmacies', totals.pharmacies, Building2], ['Active', totals.active, CheckCircle2], ['Medicines', totals.medicines, Package], ['Stock units', totals.stock, Activity], ['Users', totals.users, Users]].map(([label, value, Icon]) => <div key={label} className={`${card} border-t-2 border-t-[#714b67]`}><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-600">{label}</p><Icon size={17} className="text-[#714b67]" /></div><p className="mt-2 text-2xl font-bold">{loaded ? value.toLocaleString() : '—'}</p></div>)}</div>
         <div className="grid gap-4 lg:grid-cols-3"><section className={`${card} lg:col-span-2`}><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Pharmacy health</h3><div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs"><button onClick={() => setStatusFilter('ALL')} className={`rounded-md px-2 py-1 ${statusFilter === 'ALL' ? 'bg-white font-bold shadow-sm' : ''}`}>All</button><button onClick={() => setStatusFilter('ACTIVE')} className={`rounded-md px-2 py-1 ${statusFilter === 'ACTIVE' ? 'bg-white font-bold shadow-sm' : ''}`}>Active</button><button onClick={() => setStatusFilter('DISABLED')} className={`rounded-md px-2 py-1 ${statusFilter === 'DISABLED' ? 'bg-white font-bold shadow-sm' : ''}`}>Disabled</button></div></div><div className="mt-4 space-y-3">{tenants.length ? tenants.slice(0, 6).map(t => <div key={t.id} className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${t.disabled ? 'bg-rose-500' : 'bg-teal-500'}`} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-xs"><b className="truncate">{t.name}</b><span className="text-slate-600">{t.stockUnits || 0} stock units</span></div><div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className={`h-full rounded-full ${t.disabled ? 'bg-rose-400' : 'bg-teal-500'}`} style={{ width: `${Math.min(100, Math.max(5, Number(t.medicineCount || 0) * 5))}%` }} /></div></div></div>) : <p className="py-5 text-center text-sm text-slate-600">No pharmacies provisioned yet.</p>}</div></section><section className={card}><h3 className="font-bold">Quick actions</h3><div className="mt-3 grid gap-2"><button onClick={() => document.querySelector('input[placeholder="e.g. Al-Madina Pharmacy"]')?.focus()} className="flex items-center gap-2 rounded-xl bg-[#f5eef4] p-3 text-left text-xs font-bold text-[#714b67]"><Plus size={16} />Create pharmacy</button><button onClick={() => setStatusFilter('DISABLED')} className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-left text-xs font-bold text-rose-800"><Ban size={16} />Review disabled</button><button onClick={() => setStatusFilter('ACTIVE')} className="flex items-center gap-2 rounded-xl bg-teal-50 p-3 text-left text-xs font-bold text-teal-800"><CheckCircle2 size={16} />Review active</button></div></section></div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
           <section className="min-w-0 space-y-4"><div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-500" /><Field label="Find pharmacy" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or admin email" type="search" /></div>
            {loading && <p className="text-sm" role="status">Loading pharmacies…</p>}
            {loaded && !visible.length && <div className={`${card} text-center`}><Building2 className="mx-auto mb-3 text-[#714b67]" /><h3 className="font-bold">{tenants.length ? 'No matching pharmacies' : 'No pharmacies yet'}</h3><p className="mt-2 text-sm">{tenants.length ? 'Try another name or App ID.' : 'Create a pharmacy with its administrator account to get started.'}</p></div>}
            <div className="grid gap-4 md:grid-cols-2">{visible.map(tenant => <TenantCard key={tenant.id} tenant={tenant} disabled={locked} onUpdate={update} onReset={reset} onCopy={copy} />)}</div>
          </section>
          <section className={card}><h2 className="text-xl font-bold">Create pharmacy</h2><p className="mt-2 text-sm text-slate-600">Provide the pharmacy details. The administrator logs in using Email and Password on Windows Desktop (.exe), Web, or Mobile without any App ID.</p><form className="mt-5 space-y-4" onSubmit={create}><fieldset disabled={locked} className="space-y-4">
            <Field label="Pharmacy name" {...field('name')} required maxLength={120} autoComplete="organization" placeholder="e.g. Al-Madina Pharmacy" />
            <Field label="Admin full name" {...field('adminName')} required maxLength={120} autoComplete="off" placeholder="e.g. Dr. Ahmed" />
            <Field label="Admin Email" {...field('email')} type="email" required maxLength={120} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="owner@pharmacy.com" />
            <Field label="Admin password (12–256 characters)" {...field('password')} type="password" required minLength={12} maxLength={256} autoComplete="new-password" placeholder="••••••••••••" />
          </fieldset><button className={`${primary} w-full`} disabled={locked}><Plus size={17} />{busy ? 'Saving…' : 'Create pharmacy'}</button></form><p className="mt-4 text-xs text-slate-600">Superadmin gives this Email & Password to the pharmacy owner for Windows EXE installer or station login.</p></section>
        </div>
      </>}
    </div>
  </main>
}
