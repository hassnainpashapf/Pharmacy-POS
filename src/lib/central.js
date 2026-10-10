// One Optix account for the Pharmacy POS and the other products of the suite.
//
// The hub (today: the Lab cloud) is the single place where people sign in and where the superadmin works. Sign-in, the one-time
// SSO ticket and the product switching come from the shared SDK (@optix/suite-sdk); what stays here is what is specific to the
// pharmacy: turning a hub sign-in into the local pharmacy session (db.jsx -> syncCloudSession). The pharmacy data itself stays on
// this device exactly as before.
import { createHub } from '@optix/suite-sdk'

const DEFAULT_API = 'https://labpos-api.150.230.52.29.sslip.io'
const DEFAULT_LAB = 'https://optix-lab-medsync.pages.dev'

export const CENTRAL_API = String(import.meta.env?.VITE_CENTRAL_API || DEFAULT_API).replace(/\/+$/, '')
export const LAB_URL = String(import.meta.env?.VITE_LAB_URL || DEFAULT_LAB).replace(/\/+$/, '')
// the main Optix website: every product of the suite, one sign-in, downloads
export const SUITE_URL = String(import.meta.env?.VITE_SUITE_URL || 'https://optix-suite.ellahabad.workers.dev').replace(/\/+$/, '')
export const SUPERADMIN_URL = `${LAB_URL}/superadmin/`

// This site is the 'pharmacy' product of the suite (the product list lives in the hub's registry).
export const THIS_APP = 'pharmacy'

const BUSINESS_KEY = 'optix_business_id'

// the same session key as before, so people who are already signed in stay signed in
export const hub = createHub({ api: CENTRAL_API, appId: THIS_APP, sessionKey: 'optix_central_session' })

export const centralCall = hub.call
export const getCentral = hub.getSession
export const clearCentral = hub.clearSession
export const rememberCentral = hub.rememberSession
export const centralLogin = hub.login
export const exchangeTicket = hub.exchangeTicket
export const openApp = hub.openApp
export const otherApps = hub.otherApps

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

// Pharmacy roles in this app: ADMIN, MANAGER, PHARMACIST, CASHIER. The admin picks one per person in the hub (Users & Roles);
// otherwise it follows the lab role.
export function pharmacyRoleOf(user) {
  return hub.roleOf(user, user?.role === 'admin' ? 'ADMIN' : 'CASHIER')
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
