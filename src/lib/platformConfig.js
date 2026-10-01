// Universal Platform Configuration & Detection
// Distinguishes between Desktop (Mac / Windows - Local-First + Sync)
// and Mobile (Android / iPhone - Pure Cloud-Based)

export const PLATFORMS = {
  DESKTOP_MAC: 'DESKTOP_MAC',
  DESKTOP_WIN: 'DESKTOP_WIN',
  MOBILE_ANDROID: 'MOBILE_ANDROID',
  MOBILE_IOS: 'MOBILE_IOS',
  BROWSER: 'BROWSER',
}

export function detectPlatform() {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''
  const platform = (typeof navigator !== 'undefined' ? navigator.platform : '') || ''
  const isElectron = Boolean(typeof window !== 'undefined' && (window.electronAPI || ua.includes('Electron')))
  const isCapacitor = Boolean(typeof window !== 'undefined' && window.Capacitor)

  if (isElectron) {
    if (/mac/i.test(platform) || /darwin/i.test(ua)) {
      return PLATFORMS.DESKTOP_MAC
    }
    return PLATFORMS.DESKTOP_WIN
  }

  if (isCapacitor) {
    const capPlatform = window.Capacitor.getPlatform?.()
    if (capPlatform === 'android' || /android/i.test(ua)) {
      return PLATFORMS.MOBILE_ANDROID
    }
    if (capPlatform === 'ios' || /iphone|ipad|ipod/i.test(ua)) {
      return PLATFORMS.MOBILE_IOS
    }
  }

  // Mobile Web fallback
  if (/android/i.test(ua)) return PLATFORMS.MOBILE_ANDROID
  if (/iphone|ipad|ipod/i.test(ua)) return PLATFORMS.MOBILE_IOS

  return PLATFORMS.BROWSER
}

// True only inside the packaged Android/iOS shell. Used to hide the
// "Download App" menu, whose desktop installers live on the web host and are
// deliberately excluded from the native bundle.
export function isNativeApp() {
  if (typeof window === 'undefined') return false
  const cap = window.Capacitor
  if (!cap) return false
  if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform()
  if (typeof cap.getPlatform === 'function') return cap.getPlatform() !== 'web'
  return true
}

// True only inside OUR Electron shell: electron/preload.cjs exposes this marker.
// Deliberately not a user-agent check - "Electron" also appears in the UA of
// Electron-based third-party browsers, where installer downloads do work.
export function isElectronShell() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isDesktop)
}

export function isDesktopApp() {
  const p = detectPlatform()
  return p === PLATFORMS.DESKTOP_MAC || p === PLATFORMS.DESKTOP_WIN
}

export function isMobileApp() {
  const p = detectPlatform()
  return (
    p === PLATFORMS.MOBILE_ANDROID ||
    p === PLATFORMS.MOBILE_IOS ||
    (typeof window !== 'undefined' && window.innerWidth < 768)
  )
}

export function isPureCloudClient() {
  // Mobile Android and iPhone run exclusively in pure cloud mode
  return isMobileApp()
}

export const CLOUD_STORAGE_KEY = 'pharmacy_cloud_api_url'
export const DEFAULT_CLOUD_API_URL = 'http://127.0.0.1:8787'

export function getCloudApiUrl() {
  if (typeof window === 'undefined') return DEFAULT_CLOUD_API_URL
  const customUrl = localStorage.getItem(CLOUD_STORAGE_KEY)
  if (customUrl) return customUrl.replace(/\/+$/, '')

  // If in browser development or production web
  if (window.location && window.location.origin) {
    if (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')) {
      return DEFAULT_CLOUD_API_URL
    }
    if (window.location.protocol.startsWith('http')) {
      return window.location.origin
    }
  }
  return DEFAULT_CLOUD_API_URL
}

export function setCloudApiUrl(url) {
  if (typeof window === 'undefined') return
  if (!url) {
    localStorage.removeItem(CLOUD_STORAGE_KEY)
  } else {
    localStorage.setItem(CLOUD_STORAGE_KEY, url.trim().replace(/\/+$/, ''))
  }
}
