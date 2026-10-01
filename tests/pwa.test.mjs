import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import config from '../vite.config.js'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')
const workerSource = await read('public/sw.js')
const origin = 'https://inventory.example.test'
const cacheName = 'system-optix-inventory-static-v1'

function response(body = 'public file', options = {}) {
  const value = new Response(body, options)
  Object.defineProperty(value, 'type', { value: 'basic' })
  return value
}

function worker(fetcher = async () => response()) {
  const listeners = new Map()
  const stores = new Map()
  const fetches = []
  let claimed = false
  let skipped = false
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map())
      return {
        put: async (path, value) => stores.get(name).set(path, value),
        match: async (path) => stores.get(name).get(path)?.clone(),
      }
    },
  }
  vm.runInNewContext(workerSource, {
    URL, Request, Response, caches,
    fetch: async (request) => { fetches.push(request); return fetcher(request) },
    self: {
      location: { origin },
      addEventListener: (name, listener) => listeners.set(name, listener),
      skipWaiting: async () => { skipped = true },
      clients: { claim: async () => { claimed = true } },
    },
  })
  return {
    stores, fetches,
    get claimed() { return claimed },
    get skipped() { return skipped },
    lifecycle: (name) => {
      let promise
      listeners.get(name)({ waitUntil(value) { promise = value } })
      return promise
    },
    request: (path, options = {}) => {
      let result
      const request = new Request(new URL(path, origin), options)
      if (options.navigation) Object.defineProperty(request, 'mode', { value: 'navigate' })
      listeners.get('fetch')({ request, respondWith(value) { result = value } })
      return result
    },
  }
}

test('manifest installs the mobile route and points at real correctly-sized PNGs', async () => {
  const manifest = JSON.parse(await read('public/manifest.webmanifest'))
  assert.equal(manifest.name, 'System Optix Inventory')
  assert.equal(manifest.start_url, '/mobile')
  assert.equal(manifest.display, 'standalone')
  for (const size of [192, 512]) {
    const icon = manifest.icons.find((entry) => entry.sizes === `${size}x${size}`)
    assert.equal(icon.type, 'image/png')
    const bytes = await readFile(new URL(`public${icon.src}`, root))
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(bytes.readUInt32BE(16), size)
    assert.equal(bytes.readUInt32BE(20), size)
  }
  const apple = await readFile(new URL('public/apple-touch-icon.png', root))
  assert.equal(apple.readUInt32BE(16), 180)
  assert.equal(apple.readUInt32BE(20), 180)
  const html = await read('index.html')
  assert.match(html, /apple-touch-icon\.png/)
  assert.match(html, /width=device-width, initial-scale=1\.0/)
  assert.doesNotMatch(html, /maximum-scale|user-scalable=no|zoom: 80%/)
})

test('local proxy retains the exact browser origin and forwards peer addresses', () => {
  assert.equal(config.server.host, '127.0.0.1')
  assert.equal(config.server.port, 5173)
  assert.equal(config.server.strictPort, true)
  const proxy = config.server.proxy['/api/mobile']
  assert.equal(proxy.target, 'http://127.0.0.1:8787')
  assert.equal(proxy.changeOrigin, false)
  assert.equal(proxy.xfwd, true)
  assert.equal(proxy.headers?.Origin, undefined)
  assert.equal(proxy.rewrite, undefined)
})

test('worker bypasses APIs, writes, auth, non-public assets and cross-origin requests', () => {
  const sw = worker()
  for (const [path, options] of [
    ['/api/mobile/inventory', {}], ['/api', { navigation: true }],
    ['/api/mobile/session', { navigation: true }],
    ['/icon.svg', { method: 'POST', body: 'mutation' }],
    ['/icon.svg', { headers: { Authorization: 'Bearer test' } }],
    ['/assets/index-hashed.js', {}], ['/src/main.jsx', {}],
    ['/index.html', {}], ['/icon.svg?version=untrusted', {}],
    ['https://other.example/icon.svg', {}],
  ]) assert.equal(sw.request(path, options), undefined, path)
  assert.equal(sw.fetches.length, 0)
  assert.equal(sw.stores.size, 0)
})

test('install fetches only public static files without cookies and without browser cache', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  assert.equal(sw.skipped, true)
  assert.equal(sw.fetches.length, 6)
  for (const request of sw.fetches) {
    assert.equal(request.credentials, 'omit')
    assert.equal(request.cache, 'no-store')
    assert.equal(request.redirect, 'error')
    assert.ok(!request.url.includes('/api'))
  }
  const paths = [...sw.stores.get(cacheName).keys()]
  assert.ok(paths.includes('/offline.html'))
  assert.ok(!paths.includes('/index.html'))
  assert.ok(!paths.includes('/mobile'))
})

test('install refuses private, no-store, failed, redirected and cookie-vary responses', async () => {
  for (const options of [
    { headers: { 'Cache-Control': 'private' } },
    { headers: { 'Cache-Control': 'no-store' } },
    { headers: { Vary: 'Cookie' } },
    { headers: { Vary: 'Authorization' } },
    { headers: { Vary: '*' } },
    { status: 403 },
  ]) {
    const sw = worker(async () => response('sensitive', options))
    await assert.rejects(sw.lifecycle('install'), /not cacheable/)
    assert.equal(sw.stores.get(cacheName).size, 0)
  }
  const sw = worker(async () => {
    const value = response()
    Object.defineProperty(value, 'redirected', { value: true })
    return value
  })
  await assert.rejects(sw.lifecycle('install'), /not cacheable/)
})

test('navigation returns network content without caching and offline has no signed-in fallback', async () => {
  let online = true
  const sw = worker(async (request) => {
    if (!online) throw new Error('offline')
    return response(request.mode === 'navigate' ? 'private screen' : 'offline explanation')
  })
  await sw.lifecycle('install')
  const page = await sw.request('/mobile', { navigation: true })
  assert.equal(await page.text(), 'private screen')
  assert.equal(sw.stores.get(cacheName).has('/mobile'), false)
  online = false
  const offline = await sw.request('/mobile', { navigation: true })
  assert.equal(await offline.text(), 'offline explanation')
  assert.equal(sw.request('/api/mobile/inventory'), undefined)
  const empty = worker(async () => { throw new Error('offline') })
  const fallback = await empty.request('/mobile', { navigation: true })
  assert.equal(fallback.status, 503)
  assert.match(await fallback.text(), /No changes have been queued/)
})

test('static requests omit credentials and use only their public fallback on failure', async () => {
  let online = true
  const sw = worker(async () => {
    if (!online) throw new Error('offline')
    return response('public static')
  })
  await sw.lifecycle('install')
  await sw.request('/icon.svg', { credentials: 'include' })
  assert.equal(sw.fetches.at(-1).credentials, 'omit')
  online = false
  assert.equal(await (await sw.request('/icon.svg')).text(), 'public static')
})

test('activation deletes only this app’s obsolete caches', async () => {
  const sw = worker()
  for (const name of ['pharmacy-pos-v1', 'system-optix-inventory-static-v0', cacheName, 'other-app-v1']) {
    sw.stores.set(name, new Map())
  }
  await sw.lifecycle('activate')
  assert.deepEqual([...sw.stores.keys()], [cacheName, 'other-app-v1'])
  assert.equal(sw.claimed, true)
})

test('development unregisters only this root worker and removes only its caches', async () => {
  const main = (await read('src/main.jsx')).split('ReactDOM.createRoot')[0]
    .replace(/^import .*$/gm, '').replace('import.meta.env.DEV', 'true')
  const removed = []
  const unregistered = []
  let reloads = 0
  const registrations = [
    { scope: `${origin}/`, active: { scriptURL: `${origin}/sw.js` } },
    { scope: `${origin}/other/`, active: { scriptURL: `${origin}/sw.js` } },
    { scope: `${origin}/`, active: { scriptURL: `${origin}/unrelated.js` } },
  ].map((item, index) => ({ ...item, unregister: async () => { unregistered.push(index); return true } }))
  const caches = {
    keys: async () => ['pharmacy-pos-v1', cacheName, 'unrelated'],
    delete: async (name) => { removed.push(name) },
  }
  vm.runInNewContext(main, {
    navigator: { serviceWorker: {
      getRegistrations: async () => registrations,
      controller: { scriptURL: `${origin}/sw.js` },
    } },
    window: { location: { origin, reload: () => { reloads++ } }, caches }, caches, console,
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(unregistered, [0])
  assert.deepEqual(removed, ['pharmacy-pos-v1', cacheName])
  assert.equal(reloads, 1)
})
