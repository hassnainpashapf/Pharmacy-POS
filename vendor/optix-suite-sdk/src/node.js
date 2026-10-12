// For a product's own backend: trust a hub token by asking the hub who it belongs to.
//
//   import { createVerifier, requireHubAuth } from '@optix/suite-sdk/node'
//   const verifier = createVerifier({ api: process.env.HUB_API, appId: 'crm' })
//   app.use('/api', requireHubAuth(verifier))      // sets req.hub = { user, lab, apps, catalog, token }

export function createVerifier({ api, appId, cacheMs = 60000, fetch: fetchImpl, now = Date.now }) {
  if (!api || !appId) throw new Error('createVerifier needs the hub address (api) and this product\'s id (appId)')
  const base = String(api).replace(/\/+$/, '')
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a))
  const cache = new Map()

  async function verify(token) {
    if (!token) return { ok: false, status: 401, error: 'Sign in first.' }
    const hit = cache.get(token)
    if (hit && hit.until > now()) return hit.value
    let response
    try {
      response = await doFetch(`${base}/api/auth/whoami`, { headers: { Authorization: `Bearer ${token}` } })
    } catch (e) {
      return { ok: false, status: 503, error: 'The sign-in service cannot be reached.' }
    }
    if (response.status === 401 || response.status === 403) return { ok: false, status: 401, error: 'Your session has ended. Sign in again.' }
    if (!response.ok) return { ok: false, status: 503, error: 'The sign-in service answered with an error.' }
    const who = await response.json()
    let value
    if (!(who.apps || []).includes(appId)) value = { ok: false, status: 403, error: 'Your account does not have access to this app.' }
    else if (who.lab && ['suspended', 'expired'].includes(who.lab.status)) value = { ok: false, status: 403, error: 'This business account is not active.' }
    else value = { ok: true, user: who.user, lab: who.lab, apps: who.apps, catalog: who.catalog, token }
    cache.set(token, { value, until: now() + cacheMs })
    if (cache.size > 5000) cache.clear()
    return value
  }
  return { verify, clear: () => cache.clear() }
}

// Express / Connect style middleware
export function requireHubAuth(verifier) {
  return async (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.headers?.authorization || '')
    const result = await verifier.verify(m && m[1])
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    req.hub = result
    return next()
  }
}
