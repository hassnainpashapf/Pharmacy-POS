// The "Continue with Google" button for any Optix website (browser only). Google's own button is drawn by Google Identity Services;
// nothing is loaded from Google until a sign-in form that asks for the button is opened. If the hub has no Google Client ID yet,
// or Google cannot be reached, the button simply does not appear and the password form keeps working.
//
//   const g = mountGoogleButton(el, { hub, business: () => input.value, onResult: (result) => ..., onError: (err) => ... })
//   sign-up: mountGoogleButton(el, { hub, mode: 'signup', signup: () => ({ labName, products: ['lab'] }), onResult, onError })
//   g.destroy()
let gsiPromise = null
function loadGsi() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.reject(new Error('no browser'))
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('Google did not load')))
    s.onerror = () => { gsiPromise = null; reject(new Error('Could not reach Google')) }
    document.head.appendChild(s)
  })
  return gsiPromise
}

export function mountGoogleButton(el, { hub, business = () => '', onResult, onError, text, mode = 'login', signup = () => ({}), width } = {}) {
  let dead = false
  el.hidden = true
  ;(async () => {
    const clientId = await hub.googleClientId()
    if (!clientId || dead) return
    const google = await loadGsi()
    if (dead) return
    // Google keeps ONE callback for the whole page (the last initialize wins). When a page has more than one Google button
    // (for example sign in and sign up), each button re-claims the callback the moment the pointer or a finger reaches it.
    const activate = () => {
      if (dead) return
      google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        auto_select: false,
        callback: async (response) => {
          try { onResult && onResult(mode === 'signup' ? await hub.signupWithGoogle(response.credential, signup()) : await hub.loginWithGoogle(response.credential, business())) }
          catch (error) { onError && onError(error) }
        },
      })
    }
    activate()
    for (const ev of ['pointerenter', 'mouseover', 'touchstart', 'focusin']) el.addEventListener(ev, activate, { passive: true })
    el.innerHTML = ''
    google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: text || (mode === 'signup' ? 'signup_with' : 'continue_with'), logo_alignment: 'center', width: width || Math.max(240, Math.min(360, el.clientWidth || 320)) })
    el.hidden = false
  })().catch(() => { el.hidden = true })
  return { destroy() { dead = true } }
}
