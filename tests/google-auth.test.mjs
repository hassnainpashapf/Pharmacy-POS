import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeEmail, cleanIdentity, verifyGoogleCredential, validateGoogleSignup, buildGoogleOwner, findGoogleUser,
  canSetPasswordWithoutCurrent, resolveGoogleSignIn, OFFLINE_SIGNUP_MESSAGE, OFFLINE_SIGNIN_MESSAGE, NO_MATCH_MESSAGE, INACTIVE_MESSAGE,
} from '../src/lib/googleAuth.js'
import { mountGoogleCredentialButton, CLAIM_EVENTS } from '../src/lib/googleIdentity.js'
import { hash } from '../src/lib/passwordHash.js'

const identity = { email: 'Sara@Gmail.com', name: 'Sara Khan' }

test('only a hub-verified identity is accepted', () => {
  assert.deepEqual(cleanIdentity({ ok: true, email: ' Sara@Gmail.com ', name: 'Sara Khan' }), { email: 'sara@gmail.com', name: 'Sara Khan' })
  assert.equal(cleanIdentity({ ok: false, email: 'a@b.co' }), null)
  assert.equal(cleanIdentity({ ok: true, email: 'not-an-email' }), null)
  assert.equal(cleanIdentity(null), null)
  assert.equal(cleanIdentity({ ok: true, email: 'x@y.zz' }).name, 'x')
})

test('verifyGoogleCredential: calls the hub, handles offline and refusals', async () => {
  const calls = []
  const hub = { call: async (path, opts) => { calls.push([path, opts]); return { ok: true, email: 'sara@gmail.com', name: 'Sara' } } }
  assert.deepEqual(await verifyGoogleCredential(hub, 'CRED'), { email: 'sara@gmail.com', name: 'Sara' })
  assert.equal(calls[0][0], '/api/auth/google-verify')
  assert.equal(calls[0][1].method, 'POST')
  assert.deepEqual(calls[0][1].body, { credential: 'CRED' })
  const netErr = Object.assign(new Error('x'), { network: true })
  await assert.rejects(verifyGoogleCredential({ call: async () => { throw netErr } }, 'c'), { message: OFFLINE_SIGNUP_MESSAGE })
  await assert.rejects(verifyGoogleCredential({ call: async () => { throw Object.assign(new Error('Google sign-in is not valid'), { status: 400 }) } }, 'c'), /not valid/)
  await assert.rejects(verifyGoogleCredential({ call: async () => ({ ok: true }) }, 'c'), /could not be verified/)
})

test('offline: nothing is sent to the hub', async () => {
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true })
  try {
    let called = 0
    const hub = { call: async () => { called++ }, loginWithGoogle: async () => { called++ } }
    await assert.rejects(verifyGoogleCredential(hub, 'c'), { message: OFFLINE_SIGNUP_MESSAGE })
    await assert.rejects(resolveGoogleSignIn(hub, 'c'), { message: OFFLINE_SIGNIN_MESSAGE })
    assert.equal(called, 0)
  } finally {
    if (prev) Object.defineProperty(globalThis, 'navigator', prev); else delete globalThis.navigator
  }
})

test('the business name is required for Google sign-up', () => {
  assert.equal(validateGoogleSignup({ business: '  ', identity }).errors.business, 'Enter the business name')
  assert.ok(validateGoogleSignup({ business: 'City Care', identity: null }).errors.identity)
  const ok = validateGoogleSignup({ business: ' City Care ', identity })
  assert.equal(ok.ok, true)
  assert.equal(ok.value.business, 'City Care')
})

test('the Google owner: ADMIN, Gmail as username, linked googleEmail, a password nobody knows', () => {
  const owner = buildGoogleOwner(identity, () => 'id1', () => 'xUNUSABLE')
  assert.equal(owner.role, 'ADMIN')
  assert.equal(owner.active, true)
  assert.equal(owner.username, 'sara@gmail.com')
  assert.equal(owner.email, 'sara@gmail.com')
  assert.equal(owner.googleEmail, 'sara@gmail.com')
  assert.equal(owner.name, 'Sara Khan')
  assert.equal(owner.googlePasswordUnset, true)
  assert.deepEqual(owner.perms, { grants: [], revokes: [] })
  // the local hash function always starts with "h", so no typed password can ever equal this
  assert.ok(owner.passHash.startsWith('x'))
  for (const guess of ['', 'password', 'xUNUSABLE', owner.username]) assert.notEqual(hash(guess), owner.passHash)
})

test('matching a verified email to a local user', () => {
  const users = [
    { id: 'a', username: 'owner', email: 'owner@pharmacy.com', active: true },
    { id: 'b', username: 'sara', email: 'x@y.com', googleEmail: 'sara@gmail.com', active: true },
    { id: 'c', username: 'ali', email: 'ali@gmail.com', active: true },
    { id: 'd', username: 'off', googleEmail: 'off@gmail.com', active: false },
    { id: 'central_1_u', username: 'hubby', email: 'hub@gmail.com', active: true },
  ]
  assert.equal(findGoogleUser(users, ' SARA@gmail.com ').user.id, 'b')
  assert.equal(findGoogleUser(users, 'ali@gmail.com').user.id, 'c', 'the profile email also links')
  assert.equal(findGoogleUser(users, 'nobody@gmail.com').error, 'NO_MATCH')
  assert.equal(findGoogleUser(users, 'nobody@gmail.com').message, NO_MATCH_MESSAGE)
  assert.equal(findGoogleUser(users, '').error, 'NO_MATCH')
  assert.equal(findGoogleUser(users, 'off@gmail.com').error, 'INACTIVE')
  assert.equal(findGoogleUser(users, 'off@gmail.com').message, INACTIVE_MESSAGE)
  assert.equal(findGoogleUser(users, 'hub@gmail.com').error, 'NO_MATCH', 'Optix hub accounts are not matched locally')
  // an active user wins over a disabled one with the same email
  assert.equal(findGoogleUser([{ id: 'x', username: 'x', email: 'p@q.rs', active: false }, { id: 'y', username: 'y', googleEmail: 'p@q.rs', active: true }], 'p@q.rs').user.id, 'y')
  assert.equal(findGoogleUser(undefined, 'a@b.cc').error, 'NO_MATCH')
})

test('only a Google user who never set a password may set one without the current password', () => {
  assert.equal(canSetPasswordWithoutCurrent(buildGoogleOwner(identity, () => 'i', () => 'x1')), true)
  assert.equal(canSetPasswordWithoutCurrent({ googleEmail: 'a@b.cc', googlePasswordUnset: false }), false)
  assert.equal(canSetPasswordWithoutCurrent({ email: 'a@b.cc', passHash: hash('whatever1') }), false)
  assert.equal(canSetPasswordWithoutCurrent({ id: 'central_x', googleEmail: 'a@b.cc', googlePasswordUnset: true }), false)
  assert.equal(canSetPasswordWithoutCurrent(null), false)
})

test('sign-in: hub login first; on 401 NO_LAB the SAME credential is verified; other errors are not swallowed', async () => {
  const seen = []
  const noLab = Object.assign(new Error('No lab'), { status: 401, code: 'NO_LAB' })
  const hubOk = { loginWithGoogle: async (c, b) => { seen.push(['login', c, b]); return { token: 't' } }, call: async () => { throw new Error('must not verify') } }
  assert.deepEqual(await resolveGoogleSignIn(hubOk, 'CRED', 'biz'), { kind: 'hub', result: { token: 't' } })
  assert.deepEqual(seen, [['login', 'CRED', 'biz']])

  const order = []
  const hubNoLab = {
    loginWithGoogle: async (c) => { order.push('login:' + c); throw noLab },
    call: async (path, o) => { order.push('verify:' + o.body.credential); return { ok: true, email: 'sara@gmail.com', name: 'Sara' } },
  }
  const out = await resolveGoogleSignIn(hubNoLab, 'ONE', '')
  assert.deepEqual(out, { kind: 'local', identity: { email: 'sara@gmail.com', name: 'Sara' } })
  assert.deepEqual(order, ['login:ONE', 'verify:ONE'])

  const suspended = Object.assign(new Error('suspended'), { status: 403, code: 'SUSPENDED' })
  await assert.rejects(resolveGoogleSignIn({ loginWithGoogle: async () => { throw suspended }, call: async () => ({}) }, 'c'), /suspended/)
  const net = Object.assign(new Error('net'), { network: true })
  await assert.rejects(resolveGoogleSignIn({ loginWithGoogle: async () => { throw net }, call: async () => ({}) }, 'c'), { message: OFFLINE_SIGNIN_MESSAGE })
  await assert.rejects(resolveGoogleSignIn({ loginWithGoogle: async () => { throw noLab }, call: async () => { throw Object.assign(new Error('bad'), { status: 400 }) } }, 'c'), /bad/)
})

// A fake page with Google Identity Services: ONE callback per page, the last initialize() wins (like the real one).
function fakePage() {
  const listeners = new Map()
  const makeEl = () => {
    const el = {
      hidden: true, innerHTML: '', clientWidth: 320, handlers: {},
      addEventListener(ev, fn) { (this.handlers[ev] ||= new Set()).add(fn) },
      removeEventListener(ev, fn) { this.handlers[ev]?.delete(fn) },
      fire(ev) { [...(this.handlers[ev] || [])].forEach((fn) => fn()) },
    }
    return el
  }
  const gis = { callback: null, initCount: 0, rendered: 0 }
  globalThis.window = { google: { accounts: { id: {
    initialize(cfg) { gis.callback = cfg.callback; gis.initCount++ },
    renderButton() { gis.rendered++ },
  } } } }
  globalThis.document = {}
  return { makeEl, gis, listeners }
}

test('each Google button re-claims the one GIS callback, so the right handler fires per button', async () => {
  const { makeEl, gis } = fakePage()
  try {
    const hub = { googleClientId: async () => '123.apps.googleusercontent.com' }
    const got = []
    const a = makeEl(), b = makeEl()
    const ga = mountGoogleCredentialButton(a, { hub, text: 'signin_with', onCredential: (c) => got.push('signIn:' + c) })
    const gb = mountGoogleCredentialButton(b, { hub, text: 'signup_with', onCredential: (c) => got.push('signUp:' + c) })
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(a.hidden, false); assert.equal(b.hidden, false)
    // b was initialised last, so without re-claiming a click on a would run the sign-up handler
    for (const ev of CLAIM_EVENTS) assert.ok(a.handlers[ev]?.size === 1, 'claim listener on ' + ev)
    a.fire('pointerenter')
    await gis.callback({ credential: 'X1' })
    b.fire('mouseover')
    await gis.callback({ credential: 'X2' })
    a.fire('focusin')
    await gis.callback({ credential: 'X3' })
    assert.deepEqual(got, ['signIn:X1', 'signUp:X2', 'signIn:X3'])
    ga.destroy(); gb.destroy()
    for (const ev of CLAIM_EVENTS) assert.equal(a.handlers[ev].size, 0)
    const before = gis.initCount
    a.fire('pointerenter')
    assert.equal(gis.initCount, before, 'a destroyed button no longer claims')
  } finally { delete globalThis.window; delete globalThis.document }
})

test('no Client ID: the button never appears', async () => {
  const { makeEl } = fakePage()
  try {
    const el = makeEl()
    mountGoogleCredentialButton(el, { hub: { googleClientId: async () => '' }, onCredential() {} })
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(el.hidden, true)
  } finally { delete globalThis.window; delete globalThis.document }
})
