// Cache only explicitly public, credential-free files. Never store API data,
// authenticated responses, navigation HTML, source modules, or mutation requests.
const CACHE_PREFIX = 'system-optix-inventory-static-'
const CACHE = `${CACHE_PREFIX}v1`
const PUBLIC_FILES = new Set([
  '/offline.html', '/manifest.webmanifest', '/icon.svg',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png',
])

function publicResponse(response) {
  return response.ok && !response.redirected && response.type === 'basic' &&
    !/no-store|private/i.test(response.headers.get('cache-control') || '') &&
    !/(?:\*|cookie|authorization)/i.test(response.headers.get('vary') || '')
}

async function fetchPublic(path) {
  const response = await fetch(new Request(new URL(path, self.location.origin), {
    credentials: 'omit', cache: 'no-store', redirect: 'error',
  }))
  if (!publicResponse(response)) throw new Error('Public static response is not cacheable')
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await Promise.all([...PUBLIC_FILES].map(async (path) => {
      await cache.put(path, await fetchPublic(path))
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name === 'pharmacy-pos-v1' ||
      (name.startsWith(CACHE_PREFIX) && name !== CACHE)).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      /^\/api(?:\/|$)/.test(url.pathname) || request.headers.has('authorization')) return

  if (request.mode === 'navigate') {
    // Network-only HTML prevents stale deployments and never stores session pages.
    // The static fallback explains why shared writes are unavailable offline.
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE)
      return await cache.match('/offline.html') || new Response(
        'Offline. Reconnect to use System Optix Inventory. No changes have been queued.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      )
    }))
    return
  }

  if (!PUBLIC_FILES.has(url.pathname) || url.search) return
  event.respondWith(fetchPublic(url.pathname).catch(async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(url.pathname)
    if (cached) return cached
    throw new Error('Public static file unavailable offline')
  }))
})
