const DEFAULT_API_BASE = 'https://pharmacy-api.150.230.52.29.sslip.io'

function getBase() {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('pharmacy_cloud_api_url')
    if (custom && !custom.includes('150.230.52.29:8787') && !custom.includes('127.0.0.1:8787')) {
      return `${custom.replace(/\/+$/, '')}/api/mobile`
    }
    return `${DEFAULT_API_BASE}/api/mobile`
  }
  return `${DEFAULT_API_BASE}/api/mobile`
}

function getCredentialsMode() {
  return 'include'
}

export class MobileApiError extends Error {
  constructor(message, { status = 0, uncertain = false } = {}) {
    super(message)
    this.name = 'MobileApiError'
    this.status = status
    this.uncertain = uncertain
  }
}

export function getCloudToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('pharmacy_cloud_token') || ''
  }
  return ''
}

export function setCloudToken(token) {
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('pharmacy_cloud_token', token)
    else localStorage.removeItem('pharmacy_cloud_token')
  }
}

// Cookies belong to the shared server. Never read legacy login/localStorage.
export async function mobileApi(path, { method = 'GET', body, signal } = {}) {
  if (globalThis.navigator?.onLine === false) {
    throw new MobileApiError('You are offline. Connect to the shared server to continue.')
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timer = setTimeout(abort, 20000)
  const writing = method !== 'GET'
  const base = getBase()
  const token = getCloudToken()
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      credentials: getCredentialsMode(),
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(writing ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(writing ? { body: JSON.stringify(body ?? {}) } : {}),
      signal: controller.signal,
    })
    let data
    try { data = await response.json() } catch {
      throw new MobileApiError(response.status >= 500
        ? 'Inventory server unavailable. Start the app with npm run dev, then press Retry connection.'
        : 'The shared API returned an unreadable response. Check that the server is running.', {
        status: response.status, uncertain: writing && (response.ok || response.status >= 500),
      })
    }
    if (!response.ok) {
      throw new MobileApiError(typeof data?.error === 'string' ? data.error : 'The shared server could not complete the request.', {
        status: response.status, uncertain: writing && response.status >= 500,
      })
    }
    if (data?.token) {
      setCloudToken(data.token)
    }
    if (path === '/logout') {
      setCloudToken(null)
    }
    return data
  } catch (error) {
    if (error instanceof MobileApiError) throw error
    throw new MobileApiError('Shared API unavailable or connection interrupted. Check your connection and server.', { uncertain: writing })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export function exactBarcode(medicines, barcode) {
  // Never parse a barcode as a number: leading zeroes and case are significant.
  return typeof barcode === 'string' && barcode !== ''
    ? medicines.find(medicine => medicine.barcode === barcode)
    : undefined
}

export function requestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function priceValue(value) {
  if (String(value).trim() === '' || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('Enter a non-negative price with at most two decimal places.')
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount > 10000000) throw new Error('Prices must be between Rs 0 and Rs 10,000,000.')
  return amount
}

export function stockPayload(medicineId, draft, id = requestId()) {
  const qty = Number(draft.qty)
  if (!Number.isInteger(qty) || qty < 1 || qty > 1000000) throw new Error('Quantity must be a whole number from 1 to 1,000,000.')
  if (!draft.batchNo.trim() || draft.batchNo.trim().length > 100) throw new Error('Enter a batch number (up to 100 characters).')
  const date = new Date(`${draft.expiry}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.expiry) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== draft.expiry) throw new Error('Enter a valid expiry date.')
  return Object.freeze({ medicineId, batchNo: draft.batchNo.trim(), expiry: draft.expiry, qty,
    purchasePrice: priceValue(draft.purchasePrice), salePrice: priceValue(draft.salePrice), requestId: id })
}

export function verifyStockReceipt(data, payload) {
  const { receipt, batch } = data ?? {}
  if (!receipt || !batch || receipt.requestId !== payload.requestId || receipt.id !== payload.requestId ||
      receipt.medicineId !== payload.medicineId || receipt.qty !== payload.qty || !receipt.batchId ||
      receipt.batchId !== batch.id || batch.medicineId !== payload.medicineId || batch.batchNo !== payload.batchNo ||
      batch.expiry !== payload.expiry || batch.purchasePrice !== payload.purchasePrice || batch.salePrice !== payload.salePrice ||
      !Number.isInteger(batch.qty) || batch.qty < payload.qty) {
    throw new MobileApiError('Stock response could not be verified. Retry this same request to obtain its receipt.', { uncertain: true })
  }
  return receipt
}
