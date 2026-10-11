// First-run owner setup: pure helpers (no storage, no React) so they can be unit-tested.
// The app never ships a user with a known password. A device with no users shows
// "Create the owner account"; the person chooses the password.

import { isKnownDefaultPassword } from './passwordHash.js'

export const MIN_PASSWORD_LENGTH = 8

// True when there is nobody who could sign in on this device yet.
export function needsFirstRun(users) {
  if (!Array.isArray(users)) return true
  return !users.some((u) => u && (u.username || u.email))
}

// Validates the first-run form. Returns { ok, errors, value } where value is the cleaned input.
export function validateOwnerForm(form = {}) {
  const name = String(form.name || '').trim()
  const username = String(form.username || '').trim()
  const business = String(form.business || '').trim()
  const password = String(form.password || '')
  const confirm = String(form.confirm || '')
  const errors = {}
  if (!name) errors.name = 'Enter your name'
  if (!username) errors.username = 'Choose a username'
  else if (/\s/.test(username)) errors.username = 'The username cannot contain spaces'
  else if (username.length < 3) errors.username = 'The username needs at least 3 characters'
  if (!business) errors.business = 'Enter the business name'
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = `The password needs at least ${MIN_PASSWORD_LENGTH} characters`
  else if (password.trim().toLowerCase() === username.toLowerCase()) errors.password = 'The password cannot be the same as the username'
  else if (isKnownDefaultPassword(password)) errors.password = 'That is a known default password. Choose a different one'
  if (!errors.password && confirm !== password) errors.confirm = 'The two passwords do not match'
  return { ok: Object.keys(errors).length === 0, errors, value: { name, username, business, password } }
}

// Builds the first ADMIN user. hashFn and idFn come from db.jsx (kept as parameters so this file stays pure).
export function buildOwnerUser(value, hashFn, idFn) {
  return {
    id: idFn(),
    username: value.username,
    email: value.username.includes('@') ? value.username : `${value.username.toLowerCase()}@pharmacy.com`,
    passHash: hashFn(value.password),
    name: value.name,
    role: 'ADMIN',
    active: true,
    perms: { grants: [], revokes: [] },
  }
}
