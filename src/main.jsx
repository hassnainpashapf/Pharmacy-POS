import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Only retire this root application's worker, never other registrations.
    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      const ownRegistrations = registrations.filter((registration) => {
        const workers = [registration.active, registration.waiting, registration.installing].filter(Boolean)
        return registration.scope === `${window.location.origin}/` && workers.length > 0 &&
          workers.every((worker) => worker.scriptURL === `${window.location.origin}/sw.js`)
      })
      if (!ownRegistrations.length) return
      await Promise.all(ownRegistrations.map((registration) => registration.unregister()))
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.filter((name) => name === 'pharmacy-pos-v1' ||
          name.startsWith('system-optix-inventory-static-')).map((name) => caches.delete(name)))
      }
      // Unregistering does not release an already-controlled page until reload.
      if (navigator.serviceWorker.controller?.scriptURL === `${window.location.origin}/sw.js`) {
        window.location.reload()
      }
    }).catch((error) => console.warn('Could not retire the development service worker:', error))
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch((error) => console.warn('Service worker registration failed:', error))
    })
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
