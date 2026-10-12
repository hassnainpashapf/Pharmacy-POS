// Hub client: sign in with the Optix account, swap a one-time ticket for a session, jump to another product.
// Works in a browser (localStorage + window.location) and in Node (in-memory session, `navigate:false`).

export function memoryStorage() {
  const data = new Map()
  return { get: (k) => (data.has(k) ? data.get(k) : null), set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) }
}

function browserStorage() {
  if (typeof localStorage === 'undefined') return memoryStorage()
  return {
    get(k) { try { return localStorage.getItem(k) } catch { return null } },
    set(k, v) { try { localStorage.setItem(k, v) } catch { /* private mode: the session just does not persist */ } },
    remove(k) { try { localStorage.removeItem(k) } catch { /* ignore */ } },
  }
}

/**
 * @param {object} o
 * @param {string} o.api        address of the hub, e.g. https://labpos-api.example
 * @param {string} o.appId      this product's id in the registry (e.g. "pharmacy")
 * @param {string} [o.sessionKey]
 * @param {object} [o.storage]  { get, set, remove }
 * @param {Function} [o.fetch]
 * @param {number} [o.timeout]  ms
 */
export function createHub({ api, appId, sessionKey = 'optix_hub_session', storage, fetch: fetchImpl, timeout = 9000 }) {
  if (!api) throw new Error('createHub needs the hub address (api)')
  if (!appId) throw new Error('createHub needs this product\'s id (appId)')
  const base = String(api).replace(/\/+$/, '')
  const store = storage || browserStorage()
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a))

  // Error: message for people, `status` (HTTP), `code` (server code), `network: true` when the hub could not be reached at all
  async function call(path, { method = 'GET', body, token, timeout: ms = timeout } = {}) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = ctl ? setTimeout(() => ctl.abort(), ms) : null
    let response
    try {
      response = await doFetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctl ? ctl.signal : undefined,
      })
    } catch (cause) {
      const error = new Error('Cannot reach the Optix cloud. Check your internet connection.')
      error.network = true
      error.cause = cause
      throw error
    } finally {
      if (timer) clearTimeout(timer)
    }
    let json = {}
    try { json = await response.json() } catch { json = {} }
    if (!response.ok) {
      const error = new Error(json.error || `Request failed (${response.status})`)
      error.status = response.status
      error.code = json.code
      throw error
    }
    return json
  }

  const getSession = () => {
    try { return JSON.parse(store.get(sessionKey) || 'null') } catch { return null }
  }
  const clearSession = () => store.remove(sessionKey)
  // keep only what the product needs later: the token, the apps, the registry cards, who and which business
  function rememberSession(result) {
    const session = {
      token: result.token,
      apps: result.apps || [],
      catalog: result.catalog || [],
      user: { id: result.user.id, name: result.user.name, role: result.user.role },
      lab: { id: result.lab?.id, slug: result.lab?.slug, name: result.lab?.name },
      at: Date.now(),
    }
    store.set(sessionKey, JSON.stringify(session))
    return session
  }

  return {
    appId,
    api: base,
    call,
    getSession,
    clearSession,
    rememberSession,
    // username + password (+ the business id; empty = the default business) -> { user, token, lab, apps, catalog }
    login: (business, username, password, opts = {}) =>
      call('/api/auth/login', { method: 'POST', timeout: opts.timeout ?? 6000, body: { username, password, lab: String(business || '').trim().toLowerCase() } }),
    // "Sign in with Google": the hub checks the Google credential itself and matches the verified Gmail to a person's saved email
    // (business empty = the default business, or the business this Gmail owns). Same answer as login().
    googleClientId: async () => { try { return String((await call('/api/auth/google-config', { timeout: 5000 })).clientId || '') } catch { return '' } },
    loginWithGoogle: (credential, business = '', opts = {}) =>
      call('/api/saas/google-login', { method: 'POST', timeout: opts.timeout ?? 10000, body: { credential, lab: String(business || '').trim().toLowerCase() } }),
    // "Sign up with Google": the hub starts a new business (15-day trial) owned by this verified Gmail, with the apps the form chose
    // (empty = the lab only). Same answer as login(), plus lab/apps of the new business.
    signupWithGoogle: (credential, { labName = '', products = [] } = {}, opts = {}) =>
      call('/api/saas/google-signup', { method: 'POST', timeout: opts.timeout ?? 20000, body: { credential, labName, products } }),
    // the one-time ticket from #/sso?ticket=... -> { user, token, lab, apps, catalog, app }
    exchangeTicket: (ticket) => call('/api/sso/exchange', { method: 'POST', body: { ticket } }),
    // who does this token belong to (also what a product backend asks)
    whoami: (token) => call('/api/auth/whoami', { token }),
    // the other products this person may open (cards drawn from the registry)
    otherApps(session = getSession()) {
      return (session?.catalog || []).filter((app) => app.id !== appId && (session?.apps || []).includes(app.id))
    },
    // role of this person inside THIS product: the hub's per-product role, else the fallback
    roleOf(user, fallback) {
      return user?.appRoles?.[appId] || (appId === 'pharmacy' ? user?.pharmacyRole : undefined) || fallback
    },
    // go to another product already signed in. In a browser this navigates; with navigate:false (or in Node) it returns the address.
    async openApp(targetId, { session = getSession(), navigate = true } = {}) {
      if (!session?.token) throw new Error('Sign in again to open the other app.')
      const { url } = await call('/api/sso/ticket', { method: 'POST', body: { app: targetId }, token: session.token })
      if (navigate && typeof window !== 'undefined') window.location.href = url
      return url
    },
  }
}
