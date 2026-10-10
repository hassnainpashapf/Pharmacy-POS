import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, PackagePlus, RefreshCw, Search, LogOut, Users, Package, ArrowLeft, WifiOff, CheckCircle2 } from 'lucide-react'
import BarcodeScanner from '../components/BarcodeScanner'
import MedicineLabelScanner from '../components/MedicineLabelScanner'
import { mobileApi, exactBarcode, priceValue, stockPayload, verifyStockReceipt } from '../lib/mobileApi'
import { appIdFromSearch, inventorySessionMode, DEFAULT_APP_ID, getEffectiveAppId } from '../lib/tenantUi'

const primary = 'min-h-11 rounded-xl bg-o-blue hover:bg-o-blue-d active:bg-o-blue-d border border-o-blue-d px-4 py-3 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer transition-all'
const secondary = 'min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2'
const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'
const money = value => `Rs ${Number(value).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const blankMedicine = barcode => ({ name: '', generic: '', barcode, form: '', strength: '', manufacturer: '', packSize: '1', purchasePrice: '', salePrice: '' })

function Field({ label, ...props }) {
  return <label className="block space-y-1.5 text-sm font-semibold"><span>{label}</span><input {...props} className="min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base outline-none focus:border-o-blue focus:ring-2 focus:ring-o-blue/20 disabled:opacity-60" /></label>
}

function Notice({ children, error = false }) {
  return <div role={error ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-teal-200 bg-teal-50 text-teal-900'}`}>{children}</div>
}

export function PharmacyAuthForm({ setup, online, onAuthenticated, onError }) {
  const [appId, setAppId] = useState(getEffectiveAppId)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const guard = useRef(false)
  async function submit(event) {
    event.preventDefault()
    if (guard.current) return
    guard.current = true
    setBusy(true)
    try {
      const activeAppId = (appId || getEffectiveAppId()).trim()
      const body = {
        username: username.trim(),
        email: username.trim(),
        password,
        appId: activeAppId,
      }
      const data = await mobileApi('/login', { method: 'POST', body })
      if (!data?.user?.id) throw new Error('The server did not return a valid session. Try signing in again.')
      setPassword('')
      await onAuthenticated(data.user, data.user.appId || activeAppId)
    } catch (error) { onError(error) } finally { setPassword(''); guard.current = false; setBusy(false) }
  }
  return <section className={`${card} mx-auto max-w-md`}>
    <h2 className="text-xl font-bold">Pharmacy sign in</h2>
      <p className="mt-2 text-sm text-slate-600">Sign in with your Email and Password provided by Superadmin.</p>
    {setup ? <div className="mt-4"><Notice>Platform setup is required. Open the <a className="font-bold underline" href="/superadmin">superadmin console</a> on the server computer first.</Notice></div> :
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Email or Username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={120} autoCapitalize="none" spellCheck={false} autoComplete="username" placeholder="owner@pharmacy.com" />
        <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={256} autoComplete="current-password" placeholder="••••••••" />
        <button className={`${primary} w-full`} disabled={busy || !online}>{busy ? 'Connecting…' : 'Sign in'}</button>
      </form>}
    <a className="mt-4 inline-block text-sm font-semibold text-o-link underline" href="/superadmin">Superadmin console</a>
  </section>
}

function MedicineForm({ barcode, initialDraft, online, onCreated, onError, onCancel, onRefresh }) {
  const [draft, setDraft] = useState(() => ({ ...blankMedicine(barcode), ...initialDraft }))
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const guard = useRef(false)
  const field = key => ({ value: draft[key], onChange: e => setDraft(current => ({ ...current, [key]: e.target.value })) })
  async function submit(event) {
    event.preventDefault()
    if (guard.current || uncertain) return
    guard.current = true
    setBusy(true)
    try {
      const data = await mobileApi('/medicines', { method: 'POST', body: { ...draft, packSize: Number(draft.packSize), purchasePrice: priceValue(draft.purchasePrice), salePrice: priceValue(draft.salePrice) } })
      if (!data?.medicine?.id) { setUncertain(true); throw new Error('The medicine response could not be verified. Refresh inventory before trying again.') }
      await onCreated(data.medicine)
    } catch (error) {
      if (error.uncertain) setUncertain(true)
      onError(error)
    } finally { guard.current = false; setBusy(false) }
  }
  return <section className={`${card} mx-auto max-w-2xl`}>
    <h2 className="text-xl font-bold">{initialDraft ? 'Review scanned medicine details' : 'Create medicine manually'}</h2>
    {initialDraft && <p className="mt-2 text-sm rounded-xl bg-amber-50 p-3">Photo text is a draft, not verified medicine identification. Check name, strength, form and per-unit retail price. Enter the actual pharmacy buying price yourself.</p>}
    <p className="mt-2 text-sm">{barcode ? <>Barcode <strong className="break-all">{barcode}</strong> was not found in shared inventory. </> : null}Enter the details from the actual product. No external barcode metadata service is connected.</p>
    {uncertain && <div className="mt-4"><Notice error>The medicine may already have been created. Do not resubmit blindly. Refresh and check the inventory before creating another record.</Notice><button className={`${secondary} mt-3`} onClick={onRefresh}>Refresh and check inventory</button></div>}
    <form onSubmit={submit} className="mt-5 space-y-4">
      <fieldset disabled={busy || uncertain} className="grid gap-4 sm:grid-cols-2">
        <Field label="Medicine name" {...field('name')} required maxLength={200} />
        <Field label="Barcode (optional; leading zeros preserved)" {...field('barcode')} maxLength={128} autoCapitalize="none" spellCheck={false} />
        <Field label="Generic name" {...field('generic')} maxLength={200} />
        <Field label="Form" {...field('form')} maxLength={80} />
        <Field label="Strength" {...field('strength')} maxLength={80} />
        <Field label="Manufacturer" {...field('manufacturer')} maxLength={200} />
        <Field label="Pack size (units per pack)" {...field('packSize')} type="number" min="1" max="1000000" step="1" required />
        <div className="self-end text-sm">Stock quantity is entered in units and is not multiplied by pack size.</div>
        <Field label="Saved pharmacy purchase price / unit (Rs)" {...field('purchasePrice')} type="number" min="0" max="10000000" step="0.01" required />
        <Field label="Saved retail price / unit (Rs)" {...field('salePrice')} type="number" min="0" max="10000000" step="0.01" required />
      </fieldset>
      <p className="text-sm text-slate-600">These are saved defaults. Verify actual pharmacy buying and retail prices again when adding stock.</p>
      <div className="flex flex-wrap gap-3"><button className={primary} disabled={busy || uncertain || !online}>{busy ? 'Creating…' : 'Create medicine & enter stock'}</button><button type="button" className={secondary} disabled={busy} onClick={onCancel}>Cancel</button></div>
    </form>
  </section>
}

export function StockForm({ stock, setStock, online, canWrite, busy, onSubmit, onCancel, userId }) {
  const { medicine, draft, pending, ownerId } = stock
  const locked = !!pending
  const sameUser = !ownerId || ownerId === userId
  const field = key => ({ value: draft[key], onChange: e => setStock(current => ({ ...current, confirmed: false, draft: { ...current.draft, [key]: e.target.value } })) })
  return <section className={`${card} mx-auto max-w-2xl`}>
    <h2 className="text-xl font-bold">Stock in · {medicine.name}</h2>
    <p className="mt-2 break-words text-sm">{[medicine.generic, medicine.form, medicine.strength, medicine.manufacturer].filter(Boolean).join(' · ') || 'No additional medicine details saved.'}</p>
    <p className="mt-1 break-all text-sm">Barcode: {medicine.barcode || 'Not set'} · Pack size: {medicine.packSize}</p>
    <div className="my-4 rounded-xl bg-o-tint p-3 text-sm"><strong>Saved defaults — verify before use</strong><p className="mt-1">Pharmacy purchase: {money(medicine.purchasePrice)} / unit · Retail: {money(medicine.salePrice)} / unit</p><p className="mt-1">Enter the actual price your pharmacy pays and your intended retail price below. Stock prices do not change catalog defaults.</p></div>
    {locked && <Notice error>Awaiting a verified receipt. The exact request is retained in this tab. Reconnect and retry it; its request ID prevents duplicate stock. Keep this tab open until resolved. Request: <span className="break-all">{pending.requestId}</span></Notice>}
    {!sameUser && <div className="mt-3"><Notice error>Sign in with the account that started this request to reconcile its receipt.</Notice></div>}
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <fieldset disabled={busy || locked} className="grid gap-4 sm:grid-cols-2">
        <Field label="Batch number" {...field('batchNo')} required maxLength={100} />
        <Field label="Expiry date" {...field('expiry')} type="date" required />
        <Field label="Quantity to add (whole stock units)" {...field('qty')} type="number" min="1" max="1000000" step="1" required />
        <p className="self-center text-sm">Enter individual stock units consistently. Quantity is not multiplied by the pack size.</p>
        <Field label="Actual pharmacy buying price / unit (Rs)" {...field('purchasePrice')} type="number" min="0" max="10000000" step="0.01" required />
        <Field label="Retail price / unit for this batch (Rs)" {...field('salePrice')} type="number" min="0" max="10000000" step="0.01" required />
      </fieldset>
      {draft.expiry && draft.expiry < new Date().toLocaleDateString('en-CA') && <Notice error>This expiry date is in the past. Verify the product before confirming.</Notice>}
      <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-o-blue" checked={stock.confirmed} disabled={busy || locked} onChange={e => setStock(current => ({ ...current, confirmed: e.target.checked }))} required /><span>I verified this medicine, batch, expiry, quantity, actual pharmacy buying price and retail price. Add these units to shared inventory.</span></label>
      <div className="flex flex-wrap gap-3"><button className={primary} disabled={busy || !online || !canWrite || !sameUser || !stock.confirmed}>{busy ? 'Verifying stock receipt…' : locked ? 'Retry same stock request' : 'Confirm & add stock'}</button><button type="button" className={secondary} disabled={busy || locked} onClick={onCancel}>Cancel</button></div>
      {!canWrite && <Notice error>Inventory write permission is required. Ask an administrator.</Notice>}
      <p className="text-xs text-slate-600">Online submission only. There is no offline queue or automatic retry.</p>
    </form>
  </section>
}

function StaffPanel({ online, onError }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [draft, setDraft] = useState({ name: '', username: '', password: '', role: 'CASHIER', canManageInventory: false })
  const guard = useRef(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { const data = await mobileApi('/users'); setUsers(data.users) } catch (error) { onError(error) } finally { setLoading(false) }
  }, [onError])
  useEffect(() => { load() }, [load])
  async function write(path, method, body) {
    if (guard.current) return false
    guard.current = true
    setBusy(true)
    setMessage('')
    try {
      const data = await mobileApi(path, { method, body })
      if (!data?.user?.id) throw new Error('User response could not be verified. Refresh staff before retrying.')
      setMessage('Staff account updated on the server.')
      await load()
      return true
    } catch (error) { onError(error); return false } finally { guard.current = false; setBusy(false) }
  }
  async function create(event) {
    event.preventDefault()
    if (await write('/users', 'POST', draft)) setDraft({ name: '', username: '', password: '', role: 'CASHIER', canManageInventory: false })
    else setDraft(current => ({ ...current, password: '' }))
  }
  return <div className="grid items-start gap-5 lg:grid-cols-2">
    <section className={card}><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Staff access</h2><button className={secondary} onClick={load} disabled={loading || busy || !online}><RefreshCw size={16} />Refresh</button></div>
      <p className="mt-3 text-sm">Admins manage staff and inventory. Managers and cashiers need an explicit inventory grant. All signed-in staff can read purchase prices.</p>
      {message && <div className="mt-3"><Notice>{message}</Notice></div>}
      {loading ? <p className="mt-4" role="status">Loading staff…</p> : <div className="mt-4 space-y-3">{users.map(person => <div key={person.id} className="rounded-xl border border-slate-200 p-3"><p className="break-words font-bold">{person.name} <span className="text-xs font-normal">@{person.username}</span></p><p className="mt-1 text-xs">{person.role} · {person.disabled ? 'Disabled' : 'Enabled'}</p><div className="mt-3 flex flex-col gap-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-o-blue" checked={person.canManageInventory} disabled={busy || loading || !online || person.role === 'ADMIN'} onChange={e => write(`/users/${encodeURIComponent(person.id)}`, 'PATCH', { canManageInventory: e.target.checked })} />Can add medicines and stock{person.role === 'ADMIN' ? ' (admin)' : ''}</label><label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-o-blue" checked={person.disabled} disabled={busy || loading || !online} onChange={e => write(`/users/${encodeURIComponent(person.id)}`, 'PATCH', { disabled: e.target.checked })} />Account disabled</label></div></div>)}</div>}
    </section>
    <section className={card}><h2 className="text-xl font-bold">Create staff account</h2><form onSubmit={create} className="mt-4 space-y-4"><fieldset disabled={busy || !online} className="space-y-4">
      <Field label="Full name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} required maxLength={120} autoComplete="off" />
      <Field label="Username" value={draft.username} onChange={e => setDraft({ ...draft, username: e.target.value })} required minLength={3} maxLength={80} autoCapitalize="none" autoComplete="off" spellCheck={false} />
      <Field label="Password (12–256 characters)" value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} type="password" required minLength={12} maxLength={256} autoComplete="new-password" />
      <label className="block space-y-2 text-sm font-semibold"><span>Role</span><select className="min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 p-3" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })}><option value="CASHIER">Cashier</option><option value="RECEPTIONIST">Receptionist</option><option value="PHARMACIST">Pharmacist</option><option value="MANAGER">Manager</option><option value="ADMIN">Administrator</option></select></label>
      <label className="flex items-center gap-2 text-sm"><input className="h-5 w-5 accent-o-blue" type="checkbox" checked={draft.role === 'ADMIN' || draft.canManageInventory} disabled={draft.role === 'ADMIN'} onChange={e => setDraft({ ...draft, canManageInventory: e.target.checked })} />Grant medicine and stock-in access</label>
    </fieldset><button className={primary} disabled={busy || !online}>{busy ? 'Saving…' : 'Create staff account'}</button></form></section>
  </div>
}

export default function MobileInventory({ desktop = false }) {
  const [phase, setPhase] = useState('loading')
  const [setup, setSetup] = useState(false)
  const [user, setUser] = useState(null)
  const [inventory, setInventory] = useState(null)
  const [online, setOnline] = useState(() => globalThis.navigator?.onLine !== false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [lastRead, setLastRead] = useState(null)
  const [pane, setPane] = useState('inventory')
  const [query, setQuery] = useState('')
  const [barcode, setBarcode] = useState('')
  const [unknown, setUnknown] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [photoDraft, setPhotoDraft] = useState(null)
  const [stock, setStock] = useState(null)
  const [busy, setBusy] = useState(false)
  const writeGuard = useRef(false)
  const bootstrapGuard = useRef(false)
  const inventorySequence = useRef(0)
  const canWrite = !!inventory?.permissions?.canManageInventory
  const canManageUsers = !!inventory?.permissions?.canManageUsers

  const handleError = useCallback(error => {
    setError(error.message || 'Unable to complete the request.')
    if (error.status === 401) {
      inventorySequence.current++
      setUser(null)
      setInventory(null)
      setLastRead(null)
      setScanning(false)
      setPhase('auth')
      setError('Your shared-server session expired. Sign in again. Any unverified stock request is retained in this tab.')
    }
  }, [])

  const refresh = useCallback(async () => {
    const sequence = ++inventorySequence.current
    setRefreshing(true)
    try {
      const data = await mobileApi('/inventory')
      if (!Array.isArray(data.medicines) || !Array.isArray(data.batches) || !data.permissions) throw new Error('Shared inventory response is invalid. Please check the API server.')
      if (sequence !== inventorySequence.current) return null
      setInventory(data)
      setLastRead(new Date())
      return data
    } catch (error) { if (sequence === inventorySequence.current) handleError(error); return null } finally { if (sequence === inventorySequence.current) setRefreshing(false) }
  }, [handleError])

  const bootstrap = useCallback(async () => {
    if (bootstrapGuard.current) return
    bootstrapGuard.current = true
    setPhase('loading')
    setError('')
    try {
      const status = await mobileApi('/status')
      if (typeof status.setupRequired !== 'boolean') throw new Error('Shared API is unavailable. Start the mobile server and check its proxy configuration.')
       setSetup(status.setupRequired)
       if (status.setupRequired) { setPhase('auth'); return }
      try {
        const session = await mobileApi('/session')
        if (!session?.user?.id) throw new Error('Shared-server session response is invalid.')
        setUser(session.user)
        const mode = inventorySessionMode(session.user, getEffectiveAppId())
        setPhase(mode)
        if (mode === 'ready') await refresh()
      } catch (error) { if (error.status === 401) setPhase('auth'); else throw error }
    } catch (error) { setPhase('unavailable'); handleError(error) } finally { bootstrapGuard.current = false }
  }, [handleError, refresh])

  useEffect(() => { bootstrap() }, [bootstrap])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    if (!stock?.pending) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [stock?.pending])

  async function authenticated(nextUser, requestedAppId) {
    setUser(nextUser)
    setSetup(false)
    const mode = inventorySessionMode(nextUser, requestedAppId || DEFAULT_APP_ID)
    setPhase(mode)
    setError('')
    setPane(stock?.pending ? 'stock' : 'inventory')
    if (mode === 'ready') await refresh()
  }
  function startStock(medicine) {
    setStock({ medicine, draft: { batchNo: '', expiry: '', qty: '', purchasePrice: String(medicine.purchasePrice), salePrice: String(medicine.salePrice) }, confirmed: false, pending: null, ownerId: user.id })
    setPane('stock')
    setUnknown(null)
    setError('')
    setMessage('')
  }
  function useLabel({ draft, medicineId }) {
    setScanning(false)
    const medicine = inventory?.medicines.find(item => item.id === medicineId)
    if (medicine) {
      startStock(medicine)
      // OCR only suggests retail price. Buying price must be entered from the
      // pharmacy's purchase; it is never inferred from the label or a markup.
      setStock(current => ({ ...current, draft: { ...current.draft, purchasePrice: '', salePrice: draft.salePrice || current.draft.salePrice } }))
    } else {
      setPhotoDraft(draft); setUnknown(''); setPane('create'); setError('')
    }
  }
  async function findBarcode(code) {
    setScanning(false)
    setBarcode(code)
    setUnknown(null)
    setMessage('')
    setError('')
    if (!code) return
    // A scan is an exact string match against authenticated shared inventory.
    const current = online ? await refresh() : inventory
    if (!current) return
    const match = exactBarcode(current.medicines, code)
    if (match) {
      setQuery(match.name)
      if (current.permissions.canManageInventory && online) startStock(match)
      else setMessage(`Found ${match.name}. ${online ? 'You have read-only inventory access.' : 'Reconnect to add stock; showing last loaded inventory.'}`)
    } else { setUnknown(code); setQuery('') }
  }
  async function submitStock(event) {
    event.preventDefault()
    if (writeGuard.current || !online || !canWrite || !stock.confirmed || stock.ownerId !== user.id) return
    let payload
    try { payload = stock.pending || stockPayload(stock.medicine.id, stock.draft) } catch (error) { handleError(error); return }
    writeGuard.current = true
    setBusy(true)
    setError('')
    setMessage('')
    setStock(current => ({ ...current, pending: payload }))
    try {
      const data = await mobileApi('/stock', { method: 'POST', body: payload })
      const receipt = verifyStockReceipt(data, payload)
      setStock(null)
      setPane('inventory')
      setMessage(`Stock confirmed: ${receipt.qty} units added. Receipt ${receipt.requestId}.`)
      // Only a verified receipt permits success or an inventory refresh for this write.
      await refresh()
    } catch (error) {
      // A rejected retry does not resolve an earlier uncertain commit. Preserve its ID.
      if (!error.uncertain && !stock.pending) setStock(current => ({ ...current, pending: null }))
      handleError(error)
    } finally { writeGuard.current = false; setBusy(false) }
  }
  async function logout() {
    if (writeGuard.current) return
    writeGuard.current = true
    setBusy(true)
    setError('')
    try {
      const data = await mobileApi('/logout', { method: 'POST' })
      if (data?.ok !== true) throw new Error('Logout could not be verified. Reconnect and try again.')
      inventorySequence.current++
      setUser(null); setInventory(null); setLastRead(null); setStock(current => current?.pending ? current : null)
      setPane('inventory'); setQuery(''); setBarcode(''); setUnknown(null); setPhotoDraft(null); setMessage(''); setScanning(false); setPhase('auth')
    } catch (error) { handleError(error) } finally { writeGuard.current = false; setBusy(false) }
  }

  const medicines = inventory?.medicines ?? []
  const batches = inventory?.batches ?? []
  const search = query.trim().toLocaleLowerCase()
  const visible = medicines.filter(medicine => !search || [medicine.name, medicine.generic, medicine.barcode, medicine.strength, medicine.manufacturer].some(value => String(value ?? '').toLocaleLowerCase().includes(search)))
  const navigationLocked = busy || !!stock?.pending
  return <main className="min-h-screen bg-o-tint pb-10 text-slate-900" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
    <header className="border-b border-purple-100 bg-white px-4 py-5"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="rounded-2xl bg-o-blue p-3 text-white"><Package size={25} /></div><div className="min-w-0"><h1 className="break-words text-xl font-bold sm:text-2xl">{user?.pharmacyName || (desktop ? 'Pharmacy admin' : 'Pharmacy inventory')}</h1><p className="break-all text-xs text-slate-600">{desktop ? 'Desktop inventory' : 'Mobile inventory'}</p></div></div>{user && <div className="flex items-center gap-3"><p className="text-right text-sm"><strong>{user.name}</strong><br /><span className="text-xs">{user.role}</span></p><button className={secondary} disabled={busy || !online} onClick={logout}><LogOut size={16} />Sign out</button></div>}</div></header>
    <div className="mx-auto max-w-6xl space-y-5 px-4 pt-5 sm:px-6">
      <aside className="rounded-2xl border border-purple-100 bg-o-tint p-4 text-sm"><strong>Cloud inventory; legacy POS sales/reports not connected</strong><p className="mt-1">Legacy records are not automatically imported or synced. <strong>/admin</strong> and <strong>/mobile</strong> share the same pharmacy inventory on this server.</p></aside>
      {!online && <Notice error><span className="inline-flex items-center gap-2 font-bold"><WifiOff size={16} />Offline</span><p>Only the last inventory loaded in this tab can be shown. Stock submission is unavailable; nothing is queued.</p></Notice>}
      {error && <Notice error>{error}</Notice>}
      {message && <Notice><span className="inline-flex items-start gap-2"><CheckCircle2 className="shrink-0" size={18} />{message}</span></Notice>}
      {phase === 'loading' && <div className={card} role="status">Connecting to the shared inventory server…</div>}
      {phase === 'unavailable' && <section className={card}><h2 className="font-bold">Shared API unavailable</h2><p className="mt-2 text-sm">The shared server must be running and reachable. Check your connection and the /api/mobile proxy.</p><button className={`${primary} mt-4`} onClick={bootstrap} disabled={!online}>Retry connection</button></section>}
      {phase === 'auth' && <><PharmacyAuthForm key={setup ? 'setup' : 'login'} setup={setup} online={online} onAuthenticated={authenticated} onError={handleError} /><div className="text-center"><button className={secondary} disabled={!online} onClick={bootstrap}>Refresh server status</button></div></>}
      {phase === 'platform' && <section className={card}><h2 className="text-xl font-bold">Superadmin session</h2><p className="mt-2 text-sm">Manage pharmacies in the console. Sign out and use a pharmacy staff account to open its inventory.</p><a className={`${primary} mt-4`} href="/superadmin">Open superadmin console</a></section>}
      {phase === 'different-pharmacy' && <Notice error>This link is for App ID {appIdFromSearch()}, but your session belongs to {user?.appId}. Sign out above and sign in to the requested pharmacy.</Notice>}
      {phase === 'invalid' && <Notice error>This session has no pharmacy assigned. Sign out and use a pharmacy account with an App ID.</Notice>}
      {phase === 'ready' && user && <>
        <nav className="flex flex-wrap gap-2" aria-label="Shared inventory navigation"><button className={pane === 'inventory' ? primary : secondary} disabled={navigationLocked} onClick={() => { setPane('inventory'); setError('') }}><Package size={17} />Inventory</button>{canManageUsers && <button className={pane === 'staff' ? primary : secondary} disabled={navigationLocked} onClick={() => { setPane('staff'); setError('') }}><Users size={17} />Staff access</button>}{pane !== 'inventory' && <button className={secondary} disabled={navigationLocked} onClick={() => { setPane('inventory'); setStock(null) }}><ArrowLeft size={17} />Back</button>}</nav>
        {pane === 'inventory' && <>
          <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Medicine inventory</h2><p className="mt-1 text-xs">{lastRead ? `Last loaded ${lastRead.toLocaleTimeString()}. Refresh to see other devices’ changes.` : 'Inventory has not loaded yet.'}</p></div><button className={secondary} disabled={!online || refreshing} onClick={() => { setError(''); refresh() }}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Loading…' : 'Refresh'}</button></div>
            <div className="relative mt-4"><Search className="absolute left-3 top-3.5" size={20} /><input aria-label="Search shared inventory" className="min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-3 text-base" placeholder="Search medicine, generic or barcode" value={query} onChange={e => setQuery(e.target.value)} /></div>
            {canWrite && <button type="button" className={`${primary} mt-4 w-full`} disabled={!online || !inventory || refreshing} onClick={() => setScanning('label')}><Camera size={18} />Scan medicine name & printed price</button>}
            <p className="mt-3 text-xs">Take a clear photo of the box/strip. Review OCR text and printed retail price, then enter the pharmacy buying price before saving. English/Latin text supported.</p>
            <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Optional barcode lookup</summary>
            <form onSubmit={event => { event.preventDefault(); setPhotoDraft(null); findBarcode(barcode) }} className="mt-3 flex flex-wrap gap-2"><input aria-label="Exact barcode" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-base" placeholder="Enter exact barcode" value={barcode} onChange={e => setBarcode(e.target.value)} autoCapitalize="none" spellCheck={false} maxLength={128} /><button className={secondary} disabled={!barcode || refreshing || !inventory}>Find barcode</button><button type="button" className={secondary} disabled={!inventory || refreshing} onClick={() => { setPhotoDraft(null); setScanning('barcode') }}><Camera size={18} />Barcode camera</button></form>
            </details>
            {inventory && !canWrite && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">Read-only access. An administrator must grant permission to create medicines or add stock.</p>}
            {canWrite && <button className={`${secondary} mt-4`} disabled={!online || refreshing} onClick={() => { setPhotoDraft(null); setUnknown(''); setPane('create'); setError('') }}><PackagePlus size={18} />New medicine</button>}
          </section>
          {unknown !== null && <section className={card}><h3 className="font-bold">Barcode not found</h3><p className="mt-2 break-all text-sm">{unknown}</p><p className="mt-2 text-sm">No match in {online ? 'the shared inventory' : 'this tab’s last loaded inventory'}. No external product details are available.</p>{canWrite && online && <button className={`${primary} mt-3`} onClick={() => setPane('create')}>Enter medicine details manually</button>}</section>}
          <p className="text-sm font-semibold">{visible.length} medicine{visible.length === 1 ? '' : 's'}{!online ? ' · last loaded in this tab' : ''}</p>
          {inventory && !visible.length && <div className={`${card} text-center`}><Package className="mx-auto mb-3 text-o-link" /><h3 className="font-bold">{medicines.length ? 'No matching medicines' : 'Your shared inventory is empty'}</h3><p className="mt-2 text-sm">{medicines.length ? 'Try another name or exact barcode.' : 'Create a medicine, then add its first stock batch.'}</p></div>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(medicine => {
            const stockBatches = batches.filter(batch => batch.medicineId === medicine.id)
            const total = stockBatches.reduce((sum, batch) => sum + batch.qty, 0)
            return <article key={medicine.id} className={`${card} min-w-0`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-lg font-bold">{medicine.name}</h3><p className="mt-1 break-words text-sm">{[medicine.generic, medicine.form, medicine.strength].filter(Boolean).join(' · ') || 'No additional details'}</p></div><span className="shrink-0 rounded-xl bg-teal-50 px-3 py-2 text-right text-teal-800"><strong>{total.toLocaleString()}</strong><span className="block text-xs">units</span></span></div><p className="mt-3 break-all text-xs">Barcode: {medicine.barcode || 'Not set'}</p><p className="mt-1 break-words text-xs">Pack: {medicine.packSize} units{medicine.manufacturer ? ` · ${medicine.manufacturer}` : ''}</p><div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><p className="mb-1 text-xs font-bold">Saved per-unit defaults</p><p>Pharmacy purchase: <strong>{money(medicine.purchasePrice)}</strong></p><p>Retail: <strong>{money(medicine.salePrice)}</strong></p></div>{stockBatches.length > 0 && <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-semibold">{stockBatches.length} batch{stockBatches.length === 1 ? '' : 'es'}</summary><ul className="space-y-3">{stockBatches.map(batch => <li key={batch.id} className="rounded-xl border border-slate-100 p-3"><p className="break-words font-semibold">{batch.batchNo} · {batch.qty} units</p><p>Expiry: {batch.expiry}</p><p className="text-xs">Buy {money(batch.purchasePrice)} / unit · Retail {money(batch.salePrice)} / unit</p></li>)}</ul></details>}{canWrite && <button className={`${primary} mt-4 w-full`} disabled={!online || refreshing} onClick={() => startStock(medicine)}><PackagePlus size={17} />Add stock</button>}</article>
          })}</div>
        </>}
        {pane === 'create' && canWrite && <MedicineForm key={unknown ?? ''} barcode={unknown ?? ''} initialDraft={photoDraft} online={online} onError={handleError} onCreated={async medicine => { setPhotoDraft(null); startStock(medicine); await refresh() }} onCancel={() => { setPane('inventory'); setUnknown(null); setPhotoDraft(null) }} onRefresh={async () => { const data = await refresh(); if (data) { setPane('inventory'); setQuery(unknown ?? ''); setUnknown(null); setPhotoDraft(null) } }} />}
        {pane === 'stock' && stock && <><StockForm stock={stock} setStock={setStock} online={online} canWrite={canWrite} busy={busy} onSubmit={submitStock} onCancel={() => { setStock(null); setPane('inventory') }} userId={user.id} /><div className="text-center"><button className={secondary} disabled={!online || busy || refreshing} onClick={() => { setError(''); refresh() }}>Refresh server access</button></div></>}
        {pane === 'staff' && canManageUsers && <StaffPanel online={online} onError={handleError} />}
      </>}
    </div>
    {scanning === 'barcode' && <BarcodeScanner onDetected={findBarcode} onClose={() => setScanning(false)} />}
    {scanning === 'label' && canWrite && <MedicineLabelScanner medicines={medicines} onReviewed={useLabel} onClose={() => setScanning(false)} />}
  </main>
}
