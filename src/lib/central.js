// One Optix account for the Pharmacy POS and the Blood Test Lab app.
//
// The Lab cloud (labpos-api) is the single place where people sign in and where the superadmin works.
// A business can have the Lab, the Pharmacy, or both; each person is allowed into some of those (`apps`).
// Signing in here asks the cloud; the result is turned into the local pharmacy session the rest of the app already uses
// (db.jsx -> syncCloudSession), so the pharmacy data itself stays on this device exactly as before.
//
// Moving between the two sites uses a one-time ticket (see /api/sso/*), never a password.

const DEFAULT_API = 'https://labpos-api.150.230.52.29.sslip.io'
const DEFAULT_LAB = 'https://optix-lab-medsync.pages.dev'

export const CENTRAL_API = String(import.meta.env?.VITE_CENTRAL_API || DEFAULT_API).replace(/\/+$/, '')
export const LAB_URL = String(import.meta.env?.VITE_LAB_URL || DEFAULT_LAB).replace(/\/+$/, '')
export const SUPERADMIN_URL = `${LAB_URL}/superadmin/`

const KEY = 'optix_central_session'
const BUSINESS_KEY = 'optix_business_id'

export function getCentral() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}
export function setCentral(value) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: the session just does not persist */
  }
}
export function clearCentral() {
  setCentral(null)
}
export function lastBusinessId() {
  try {
    return localStorage.getItem(BUSINESS_KEY) || ''
  } catch {
    return ''
  }
}
export function rememberBusinessId(value) {
  try {
    if (value) localStorage.setItem(BUSINESS_KEY, value)
    else localStorage.removeItem(BUSINESS_KEY)
  } catch {
    /* ignore */
  }
}

// Error shape: message for people, `status` (HTTP), `code` (server code), `network: true` when the cloud could not be reached at all
export async function centralCall(path, { method = 'GET', body, token, timeout = 9000 } = {}) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctl ? setTimeout(() => ctl.abort(), timeout) : null
  let response
  try {
    response = await fetch(`${CENTRAL_API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl ? ctl.signal : undefined,
    })
  } catch (cause) {
    const error = new Error('Cannot reach the Optix cloud. Check your internet connection.')
    error.network = true
    error.cause = cause
    throw error
  } finally {
    if (timer) clearTimeout(timer)
  }
  let json = {}
  try {
    json = await response.json()
  } catch {
    json = {}
  }
  if (!response.ok) {
    const error = new Error(json.error || `Request failed (${response.status})`)
    error.status = response.status
    error.code = json.code
    throw error
  }
  return json
}

// username + password (+ the business id, empty = the default business) -> { user, token, lab, apps }
export function centralLogin(businessId, username, password) {
  return centralCall('/api/auth/login', { method: 'POST', timeout: 6000, body: { username, password, lab: String(businessId || '').trim().toLowerCase() } })
}

export function exchangeTicket(ticket) {
  return centralCall('/api/sso/exchange', { method: 'POST', body: { ticket } })
}

// Open the other app (the Lab site) already signed in
export async function openLabApp(central = getCentral()) {
  if (!central?.token) throw new Error('Sign in again to open the lab app.')
  const { url } = await centralCall('/api/sso/ticket', { method: 'POST', body: { app: 'lab' }, token: central.token })
  window.location.href = url
}

// Pharmacy roles in this app: ADMIN, MANAGER, PHARMACIST, CASHIER. The admin can pick one per person in the lab's Users & Roles;
// otherwise it follows the lab role.
export function pharmacyRoleOf(user) {
  if (user?.pharmacyRole) return user.pharmacyRole
  if (user?.role === 'admin') return 'ADMIN'
  return 'CASHIER'
}

function randomSecret() {
  const bytes = new Uint8Array(18)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// The shape db.jsx -> syncCloudSession() expects. Each business gets its own partition of local data.
export function toLocalUser(result) {
  const { user, lab } = result
  const slug = lab?.slug || 'default'
  return {
    id: `central_${lab?.id || slug}_${user.id}`,
    username: user.username || user.id,
    email: user.email || `${user.username || user.id}@${slug}.optix`,
    name: user.name,
    role: pharmacyRoleOf(user),
    tenantId: `central-${lab?.id || slug}`,
    pharmacyName: lab?.name || undefined,
  }
}

// `password` is only passed after a real password sign-in (it lets the same person sign in offline later).
// A ticket sign-in has no password, so the local account gets a random one nobody knows.
export function localPasswordFor(password) {
  return password || randomSecret()
}

export function rememberCentral(result) {
  setCentral({
    token: result.token,
    apps: result.apps || [],
    user: { id: result.user.id, name: result.user.name, role: result.user.role },
    lab: { id: result.lab?.id, slug: result.lab?.slug, name: result.lab?.name },
    at: Date.now(),
  })
}
