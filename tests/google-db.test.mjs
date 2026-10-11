import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { hash } from '../src/lib/passwordHash.js'

// The Google flows against the real local database module (db.jsx), in a fresh device and in an OLD-style one.
let server
let db
const store = new Map()
function fakeStorage() {
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
  globalThis.sessionStorage = globalThis.localStorage
}
before(async () => {
  fakeStorage()
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
  db = await server.ssrLoadModule('/src/lib/db.jsx')
})
after(async () => { await server?.close() })

test('first run: Google sign-up creates the owner, signs in, and the password is unusable', () => {
  assert.equal(db.isFirstRun(), true)
  assert.throws(() => db.createOwnerAccountWithGoogle({ identity: { email: 'sara@gmail.com', name: 'Sara Khan' }, business: '  ' }), /business name/i)
  assert.equal(db.getDB().users.length, 0, 'a refused sign-up creates nothing')
  const session = db.createOwnerAccountWithGoogle({ identity: { email: 'Sara@Gmail.com', name: 'Sara Khan' }, business: 'City Care' })
  assert.equal(session.role, 'ADMIN')
  assert.equal(session.username, 'sara@gmail.com')
  const [u] = db.getDB().users
  assert.equal(u.googleEmail, 'sara@gmail.com')
  assert.equal(u.googlePasswordUnset, true)
  assert.equal(db.getDB().settings.pharmacyName, 'City Care')
  assert.ok(db.getDB().auditLogs.some((l) => l.action === 'LOGIN_GOOGLE'))
  // nobody can sign in with a password
  assert.throws(() => db.login('sara@gmail.com', ''), /Invalid/)
  assert.throws(() => db.login('sara@gmail.com', u.passHash), /Invalid/)
  // first-run guard
  assert.equal(db.isFirstRun(), false)
  assert.throws(() => db.createOwnerAccountWithGoogle({ identity: { email: 'evil@gmail.com', name: 'E' }, business: 'X' }), /already has accounts/)
  assert.throws(() => db.createOwnerAccount({ name: 'N', username: 'someone', business: 'B', password: 'longenough1', confirm: 'longenough1' }), /already has accounts/)
})

test('later Google sign-in matches the local user (and refuses unknown / disabled)', () => {
  db.logout()
  assert.equal(db.currentUser(), null)
  const s = db.loginWithVerifiedGoogle(' SARA@gmail.com ')
  assert.equal(s.username, 'sara@gmail.com')
  assert.equal(db.currentUser().userId, s.userId)
  db.logout()
  assert.throws(() => db.loginWithVerifiedGoogle('nobody@gmail.com'), { message: 'No account on this station uses this Google email.' })
  assert.equal(db.currentUser(), null)
})

test('admin links a Gmail to another user through the email field; disabled users are refused', () => {
  db.loginWithVerifiedGoogle('sara@gmail.com')
  const staff = db.addUser({ username: 'ali', password: 'Str0ngPass!', name: 'Ali', role: 'CASHIER', email: ' Ali@Gmail.com ' })
  assert.equal(staff.email, 'ali@gmail.com')
  assert.throws(() => db.addUser({ username: 'ali2', password: 'Str0ngPass!', name: 'Ali2', email: 'ali@gmail.com' }), /already used/)
  assert.throws(() => db.addUser({ username: 'ali3', password: 'Str0ngPass!', name: 'Ali3', email: 'nope' }), /valid email/)
  db.logout()
  assert.equal(db.loginWithVerifiedGoogle('ali@gmail.com').role, 'CASHIER')
  db.logout()
  db.loginWithVerifiedGoogle('sara@gmail.com')
  db.updateUser(staff.id, { active: false })
  db.logout()
  assert.throws(() => db.loginWithVerifiedGoogle('ali@gmail.com'), /turned off/)
  assert.equal(db.currentUser(), null)
  // the normal password login of that user is unchanged
  assert.throws(() => db.login('ali', 'Str0ngPass!'), /Invalid/)
  db.loginWithVerifiedGoogle('sara@gmail.com')
  db.updateUser(staff.id, { active: true })
  db.logout()
  assert.equal(db.login('ali', 'Str0ngPass!').username, 'ali')
  db.logout()
})

test('a Google owner sets a password once, without the current password', () => {
  db.loginWithVerifiedGoogle('sara@gmail.com')
  const me = db.currentUser()
  assert.throws(() => db.setPasswordForGoogleUser(me.userId, { password: 'short', confirm: 'short' }), /at least/)
  assert.throws(() => db.setPasswordForGoogleUser(me.userId, { password: 'longenough1', confirm: 'different12' }), /do not match/)
  db.setPasswordForGoogleUser(me.userId, { password: 'longenough1', confirm: 'longenough1' })
  const u = db.getDB().users.find((x) => x.id === me.userId)
  assert.equal(u.passHash, hash('longenough1'))
  assert.equal(u.googlePasswordUnset, undefined)
  assert.throws(() => db.setPasswordForGoogleUser(me.userId, { password: 'another-one1', confirm: 'another-one1' }), /already has a password/)
  db.logout()
  assert.equal(db.login('sara@gmail.com', 'longenough1').role, 'ADMIN')
  db.logout()
  // other people cannot use it for someone else
  assert.throws(() => db.setPasswordForGoogleUser(me.userId, { password: 'longenough2', confirm: 'longenough2' }), /Sign in first/)
})
