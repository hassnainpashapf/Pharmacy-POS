// "Sign up / Sign in with Google" for the Pharmacy: pure helpers (no storage, no React) so they can be unit-tested.
//
// What is trusted: only an identity (verified Gmail + name) that the Optix account service (the hub) returned from
// POST /api/auth/google-verify. A credential that has not been verified by the hub is never turned into a session.
// The Pharmacy has no server accounts, so what follows a verified identity stays on this device (see db.jsx).

export const OFFLINE_SIGNUP_MESSAGE = 'Connect to the internet to sign up with Google, or use a password.'
export const OFFLINE_SIGNIN_MESSAGE = 'Connect to the internet to sign in with Google, or use your password.'
export const NO_MATCH_MESSAGE = 'No account on this station uses this Google email.'
export const INACTIVE_MESSAGE = 'This account is turned off. Ask your administrator.'

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

// A verified identity from the hub: { ok: true, email, name }. Anything else is refused.
export function cleanIdentity(raw) {
  if (!raw || raw.ok !== true) return null
  const email = normalizeEmail(raw.email)
  if (!EMAIL_RE.test(email)) return null
  const name = String(raw.name || '').trim() || email.split('@')[0]
  return { email, name }
}

// Asks the hub to verify a Google credential. Returns { email, name } or throws an Error with a message for people.
export async function verifyGoogleCredential(hub, credential) {
  if (isOffline()) throw new Error(OFFLINE_SIGNUP_MESSAGE)
  let answer
  try {
    answer = await hub.call('/api/auth/google-verify', { method: 'POST', timeout: 10000, body: { credential } })
  } catch (e) {
    if (e && e.network) throw new Error(OFFLINE_SIGNUP_MESSAGE)
    throw new Error((e && e.message) || 'Google sign-in could not be verified.')
  }
  const identity = cleanIdentity(answer)
  if (!identity) throw new Error('Google sign-in could not be verified.')
  return identity
}

// Validates what the first-run Google sign-up needs besides the Google identity: the business name.
export function validateGoogleSignup({ business, identity } = {}) {
  const errors = {}
  const name = String(business || '').trim()
  if (!name) errors.business = 'Enter the business name'
  if (!cleanIdentity(identity ? { ok: true, ...identity } : null)) errors.identity = 'Google sign-in could not be verified.'
  return { ok: Object.keys(errors).length === 0, errors, value: { business: name } }
}

// The first ADMIN built from a verified Google identity. Nobody knows its password: passHash is an "unusable" hash
// (never equal to hash(x), which always starts with "h"), so only Google (or a password set later) can open it.
export function buildGoogleOwner(identity, idFn, unusableHashFn) {
  const email = normalizeEmail(identity.email)
  return {
    id: idFn(),
    username: email,
    email,
    googleEmail: email,
    googlePasswordUnset: true,
    passHash: unusableHashFn(),
    name: String(identity.name || '').trim() || email.split('@')[0],
    role: 'ADMIN',
    active: true,
    perms: { grants: [], revokes: [] },
  }
}

// A user that signs in through the Optix hub keeps no local password and is not matched locally.
function isHubUser(user) {
  return String(user?.id || '').startsWith('central_')
}

// Which local user does this verified Gmail belong to? { user } or { error: 'NO_MATCH' | 'INACTIVE', message }.
// googleEmail is the explicit link; the profile email (set in Users) is accepted too. An active match wins over a disabled one.
export function findGoogleUser(users, email) {
  const target = normalizeEmail(email)
  if (!target) return { error: 'NO_MATCH', message: NO_MATCH_MESSAGE }
  const matches = (Array.isArray(users) ? users : []).filter((u) =>
    u && !isHubUser(u) && (normalizeEmail(u.googleEmail) === target || normalizeEmail(u.email) === target))
  if (!matches.length) return { error: 'NO_MATCH', message: NO_MATCH_MESSAGE }
  matches.sort((a, b) => Number(normalizeEmail(b.googleEmail) === target) - Number(normalizeEmail(a.googleEmail) === target))
  const active = matches.find((u) => u.active !== false && u.active)
  if (!active) return { error: 'INACTIVE', message: INACTIVE_MESSAGE }
  return { user: active }
}

// A Google-created owner who has never chosen a password may set one once without the current password.
export function canSetPasswordWithoutCurrent(user) {
  return !!user && !!user.googleEmail && user.googlePasswordUnset === true && !isHubUser(user)
}

// "Sign in with Google" in one credential callback: the hub's own sign-in first (Optix-account users), and only when the hub says
// there is no Optix account for this Gmail (401 NO_LAB) the SAME credential is verified so a local user can be matched.
// Returns { kind: 'hub', result } or { kind: 'local', identity }. Throws Error for anything else.
export async function resolveGoogleSignIn(hub, credential, business = '') {
  if (isOffline()) throw new Error(OFFLINE_SIGNIN_MESSAGE)
  try {
    const result = await hub.loginWithGoogle(credential, business)
    return { kind: 'hub', result }
  } catch (e) {
    if (e && e.network) throw new Error(OFFLINE_SIGNIN_MESSAGE)
    if (!(e && e.status === 401 && e.code === 'NO_LAB')) throw e
  }
  let identity
  try {
    identity = await verifyGoogleCredential(hub, credential)
  } catch (e) {
    throw new Error(e.message === OFFLINE_SIGNUP_MESSAGE ? OFFLINE_SIGNIN_MESSAGE : e.message)
  }
  return { kind: 'local', identity }
}
