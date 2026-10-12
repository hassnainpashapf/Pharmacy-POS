// Draws Google's own button (Google Identity Services) and hands back the RAW Google credential.
// The same loader idea as @optix/suite-sdk's mountGoogleButton, but that one turns the credential into an Optix hub login;
// the Pharmacy also needs the plain credential (first-run sign-up, and the local fallback of Sign in). Nothing is loaded from
// Google until a form that asks for the button is opened. If the hub has no Client ID, or Google cannot be reached, the button
// simply does not appear and the password form keeps working.
//
//   const g = mountGoogleCredentialButton(el, { hub, text: 'signup_with', onCredential: (credential) => ..., onError })
//   g.destroy()
let gsiPromise = null
function loadGsi() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.reject(new Error('no browser'))
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('Google did not load')))
    s.onerror = () => { gsiPromise = null; reject(new Error('Could not reach Google')) }
    document.head.appendChild(s)
  })
  return gsiPromise
}

// Google Identity Services keeps ONE callback per page (the last initialize() wins). Every button therefore re-claims the callback
// when the person reaches for it (pointer, touch, keyboard focus), so a button always runs its own handler even if another
// button was mounted after it. Only the button of the visible view is mounted by Login.jsx; this is the second line of defence.
export const CLAIM_EVENTS = ['pointerenter', 'mouseover', 'touchstart', 'focusin']

export function mountGoogleCredentialButton(el, { hub, text = 'continue_with', width, onCredential, onError } = {}) {
  let dead = false
  let claim = null
  const reclaim = () => { if (!dead && claim) claim() }
  el.hidden = true
  ;(async () => {
    const clientId = await hub.googleClientId()
    if (!clientId || dead) return
    const google = await loadGsi()
    if (dead) return
    claim = () => google.accounts.id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      auto_select: false,
      callback: async (response) => {
        if (dead) return
        try { onCredential && (await onCredential(response.credential)) }
        catch (error) { onError && onError(error) }
      },
    })
    claim()
    CLAIM_EVENTS.forEach((ev) => el.addEventListener(ev, reclaim, { passive: true }))
    el.innerHTML = ''
    google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text, logo_alignment: 'center', width: width || Math.max(240, Math.min(360, el.parentElement?.clientWidth || 320)) })
    el.hidden = false
    const scope = el.closest('form')?.parentElement || document
    scope.querySelectorAll('.soc-g-hit').forEach((hit) => {
      hit.innerHTML = ''
      CLAIM_EVENTS.forEach((ev) => hit.addEventListener(ev, reclaim, { passive: true }))
      google.accounts.id.renderButton(hit, { type: 'icon', theme: 'outline', size: 'large', shape: 'circle' })
    })
  })().catch(() => { el.hidden = true })
  return { destroy() { dead = true; CLAIM_EVENTS.forEach((ev) => el.removeEventListener(ev, reclaim)) } }
}
