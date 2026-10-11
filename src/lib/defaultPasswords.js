// Older versions of the app shipped staff accounts with well-known passwords (and stations that installed then
// still hold those accounts). This file recognises them so the person can be asked to choose a new one.
// The list itself (hashes only, see passwordHash.js) covers the old owner/admin, manager, pharmacist, cashier and
// receptionist defaults and the old "admin" fallback password.
import { hash, isDefaultHash, isKnownDefaultPassword } from './passwordHash.js'
import { MIN_PASSWORD_LENGTH } from './firstRun.js'

export { isDefaultHash, isKnownDefaultPassword }

// An account that signs in through the Optix hub has no local password that anyone chose here.
export function isHubAccount(user) {
  return !!user && String(user.id || '').startsWith('central_')
}

// True when the user's stored password is still a known default. Hub users and users without a hash are never flagged.
export function usesDefaultPassword(user) {
  if (!user || isHubAccount(user)) return false
  return isDefaultHash(user.passHash)
}

// The active users (of a list) that still have a default password.
export function usersWithDefaultPassword(users) {
  return (Array.isArray(users) ? users : []).filter((u) => u && u.active !== false && usesDefaultPassword(u))
}

// Validates the "choose a new password" form. Returns { ok, errors }.
export function validateNewPassword(user, form = {}) {
  const password = String(form.password || '')
  const confirm = String(form.confirm || '')
  const errors = {}
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = `The password needs at least ${MIN_PASSWORD_LENGTH} characters`
  else if (isKnownDefaultPassword(password)) errors.password = 'That is a known default password. Choose a different one'
  else if (user && user.passHash === hash(password)) errors.password = 'The new password must be different from the current one'
  else if (user && String(user.username || '').trim() && password.trim().toLowerCase() === String(user.username).trim().toLowerCase()) errors.password = 'The password cannot be the same as the username'
  if (!errors.password && confirm !== password) errors.confirm = 'The two passwords do not match'
  return { ok: Object.keys(errors).length === 0, errors }
}
