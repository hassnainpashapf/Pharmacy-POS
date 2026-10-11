import test from 'node:test'
import assert from 'node:assert/strict'
import { hash } from '../src/lib/passwordHash.js'
import { KNOWN_DEFAULT_HASHES } from '../src/lib/passwordHash.js'
import { usesDefaultPassword, usersWithDefaultPassword, validateNewPassword, isKnownDefaultPassword, isHubAccount } from '../src/lib/defaultPasswords.js'
import { validateOwnerForm } from '../src/lib/firstRun.js'

// The passwords older versions shipped. They are written only here (a test file); the app source holds their hashes.
const OLD_DEFAULTS = { admin: 'Password@786123', manager: 'manager123', pharmacist: 'pharmacist123', cashier: 'cashier123', receptionist: 'reception123' }
const OLD_ADMIN_FALLBACK = 'admin123'

test('the stored default hashes are exactly the hashes of the old defaults', () => {
  const expected = [...Object.values(OLD_DEFAULTS), OLD_ADMIN_FALLBACK].map(hash).sort()
  assert.deepEqual([...KNOWN_DEFAULT_HASHES].sort(), expected)
})

test('the local hash scheme is unchanged (existing accounts keep working)', () => {
  assert.equal(hash('Password@786123'), 'hrcgzhv')
  assert.equal(hash(''), 'h' + (5381).toString(36))
})

test('old default users are detected', () => {
  for (const [name, pw] of Object.entries(OLD_DEFAULTS)) {
    assert.equal(usesDefaultPassword({ id: `usr_${name}`, username: name, passHash: hash(pw), active: true }), true, name)
  }
  assert.equal(usesDefaultPassword({ id: 'x', username: 'admin', passHash: hash(OLD_ADMIN_FALLBACK) }), true)
})

test('a user with a changed password is not flagged', () => {
  assert.equal(usesDefaultPassword({ id: 'u', username: 'manager', passHash: hash('a-brand-new-secret') }), false)
})

test('users without a usable password hash (hub / SSO users) are not flagged', () => {
  assert.equal(usesDefaultPassword({ id: 'u1', username: 'hub', passHash: undefined }), false)
  assert.equal(usesDefaultPassword({ id: 'u2', username: 'hub', passHash: '' }), false)
  assert.equal(usesDefaultPassword({ id: 'u3', username: 'hub', passHash: 'x1a2b3c' }), false)
  assert.equal(usesDefaultPassword(null), false)
  assert.equal(usesDefaultPassword(undefined), false)
  // a hub account is never asked even if the password they typed on the hub equals an old default
  const hub = { id: 'central_lab1_u7', username: 'hubuser', passHash: hash('manager123') }
  assert.equal(isHubAccount(hub), true)
  assert.equal(usesDefaultPassword(hub), false)
})

test('usersWithDefaultPassword lists only active users that still use a default', () => {
  const users = [
    { id: '1', username: 'admin', passHash: hash('Password@786123'), active: true },
    { id: '2', username: 'manager', passHash: hash('manager123'), active: true },
    { id: '3', username: 'cashier', passHash: hash('cashier123'), active: false },
    { id: '4', username: 'sara', passHash: hash('long-enough-1'), active: true },
  ]
  assert.deepEqual(usersWithDefaultPassword(users).map((u) => u.username), ['admin', 'manager'])
  assert.deepEqual(usersWithDefaultPassword(undefined), [])
})

test('the new-password form: min 8, differs from the old one and from every known default, must match', () => {
  const user = { id: '2', username: 'manager', passHash: hash('manager123') }
  assert.equal(validateNewPassword(user, { password: 'short', confirm: 'short' }).ok, false)
  assert.equal(validateNewPassword(user, { password: 'manager123', confirm: 'manager123' }).ok, false)
  for (const pw of [...Object.values(OLD_DEFAULTS), OLD_ADMIN_FALLBACK]) {
    assert.equal(validateNewPassword(user, { password: pw, confirm: pw }).ok, false, pw)
    assert.equal(isKnownDefaultPassword(pw), true)
  }
  assert.equal(validateNewPassword(user, { password: 'manager', confirm: 'manager' }).ok, false)
  assert.ok(validateNewPassword(user, { password: 'a-new-secret-1', confirm: 'different-one' }).errors.confirm)
  assert.equal(validateNewPassword(user, { password: 'a-new-secret-1', confirm: 'a-new-secret-1' }).ok, true)
  // not the same as the current (non default) password either
  const changed = { id: '9', username: 'x', passHash: hash('current-secret-1') }
  assert.equal(validateNewPassword(changed, { password: 'current-secret-1', confirm: 'current-secret-1' }).ok, false)
})

test('the first-run form refuses a known default password too', () => {
  const form = { name: 'Sara', username: 'sara', business: 'City', password: 'manager123', confirm: 'manager123' }
  assert.ok(validateOwnerForm(form).errors.password)
})
