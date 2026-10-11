import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { needsFirstRun, validateOwnerForm, buildOwnerUser, MIN_PASSWORD_LENGTH } from '../src/lib/firstRun.js'

test('first run is needed only when no user exists', () => {
  assert.equal(needsFirstRun(undefined), true)
  assert.equal(needsFirstRun([]), true)
  assert.equal(needsFirstRun([null, {}]), true)
  assert.equal(needsFirstRun([{ username: 'owner' }]), false)
  assert.equal(needsFirstRun([{ email: 'a@b.c' }]), false)
})

test('owner form validation', () => {
  const good = { name: 'Sara Khan', username: 'sara', business: 'City Care', password: 'longenough1', confirm: 'longenough1' }
  assert.equal(validateOwnerForm(good).ok, true)
  assert.equal(validateOwnerForm({ ...good, password: 'short', confirm: 'short' }).errors.password.includes(String(MIN_PASSWORD_LENGTH)), true)
  assert.ok(validateOwnerForm({ ...good, confirm: 'different12' }).errors.confirm)
  assert.ok(validateOwnerForm({ ...good, name: '  ' }).errors.name)
  assert.ok(validateOwnerForm({ ...good, business: '' }).errors.business)
  assert.ok(validateOwnerForm({ ...good, username: 'has space' }).errors.username)
  assert.ok(validateOwnerForm({ ...good, username: 'ab' }).errors.username)
  assert.ok(validateOwnerForm({ ...good, username: 'samepassword', password: 'samepassword', confirm: 'samepassword' }).errors.password)
  assert.equal(validateOwnerForm({}).ok, false)
})

test('the owner is an ADMIN with the chosen password only', () => {
  const user = buildOwnerUser({ name: 'Sara', username: 'Sara', password: 'longenough1' }, (v) => `H(${v})`, () => 'id1')
  assert.equal(user.role, 'ADMIN')
  assert.equal(user.active, true)
  assert.equal(user.passHash, 'H(longenough1)')
  assert.equal(user.email, 'sara@pharmacy.com')
  assert.deepEqual(user.perms, { grants: [], revokes: [] })
})

test('no known default credentials are written in the app source', async () => {
  const banned = [/Password@786123/, /pasha@pharmacy\.com/, /admin123/, /manager123/, /cashier123/, /pharmacist123/, /reception123/]
  const files = []
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) await walk(path)
      else if (/\.(jsx?|mjs|cjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(path)
    }
  }
  await walk(new URL('../src', import.meta.url).pathname)
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    for (const rx of banned) assert.doesNotMatch(text, rx, `${file} contains ${rx}`)
  }
  const login = await readFile(new URL('../src/pages/Login.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(login, /\|\| 'admin'/)
})
