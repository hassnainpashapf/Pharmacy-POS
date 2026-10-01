import { useState, useEffect } from 'react'
import { getOfflineSyncQueue, clearSyncedItems, mergeCloudSyncData } from './db'
import { mobileApi } from './mobileApi'

const SYNC_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes
const COUNTDOWN_INTERVAL_MS = 1000

let syncTimer = null
let countdownTimer = null
let listeners = new Set()

let syncState = {
  status: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  lastSyncTime: null,
  nextSyncSeconds: Math.floor(SYNC_INTERVAL_MS / 1000),
  pendingCount: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastError: null,
}

function updateState(partial) {
  syncState = { ...syncState, ...partial }
  listeners.forEach((fn) => {
    try {
      fn(syncState)
    } catch (e) {
      console.warn('Listener error in sync engine', e)
    }
  })
}

export function getSyncState() {
  const queue = getOfflineSyncQueue()
  return { ...syncState, pendingCount: queue.length }
}

export async function syncNow({ manual = false } = {}) {
  const queue = getOfflineSyncQueue()
  updateState({ pendingCount: queue.length })

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    updateState({ status: 'offline', isOnline: false })
    return { ok: false, error: 'Network is offline' }
  }

  updateState({ status: 'syncing', lastError: null })

  try {
    const payload = {
      offlineSales: queue.filter((q) => q.type === 'SALE').map((q) => q.payload),
      lastSync: syncState.lastSyncTime || 0,
    }

    // Call server sync endpoint
    const response = await mobileApi('/sync', {
      method: 'POST',
      body: payload,
    })

    if (response && response.ok) {
      if (queue.length > 0) {
        clearSyncedItems(queue.map((q) => q.id))
      }
      if (typeof mergeCloudSyncData === 'function') {
        mergeCloudSyncData(response)
      }
      const now = Date.now()
      updateState({
        status: 'online',
        isOnline: true,
        lastSyncTime: now,
        nextSyncSeconds: Math.floor(SYNC_INTERVAL_MS / 1000),
        pendingCount: 0,
        lastError: null,
      })
      return { ok: true, data: response }
    } else {
      throw new Error(response?.message || 'Sync failed')
    }
  } catch (err) {
    // If not authenticated (e.g. not logged in to cloud session yet), check status
    try {
      const statusRes = await mobileApi('/status')
      if (statusRes) {
        // Cloud server is reachable, but session might be pending or purely local
        updateState({
          status: 'online',
          isOnline: true,
          nextSyncSeconds: Math.floor(SYNC_INTERVAL_MS / 1000),
          pendingCount: getOfflineSyncQueue().length,
          lastError: err.message,
        })
        return { ok: false, error: err.message }
      }
    } catch {
      // Endpoint is completely unreachable
    }

    updateState({
      status: 'offline',
      isOnline: false,
      lastError: err.message || 'Cloud server unreachable',
      pendingCount: getOfflineSyncQueue().length,
    })
    return { ok: false, error: err.message }
  }
}

export function initSyncEngine() {
  if (typeof window === 'undefined') return

  // Initial count
  updateState({ pendingCount: getOfflineSyncQueue().length })

  // Online / Offline window events
  const handleOnline = () => {
    updateState({ isOnline: true, status: 'online' })
    syncNow({ manual: false })
  }
  const handleOffline = () => {
    updateState({ isOnline: false, status: 'offline' })
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Start 10-minute automated sync timer
  if (syncTimer) clearInterval(syncTimer)
  syncTimer = setInterval(() => {
    syncNow({ manual: false })
  }, SYNC_INTERVAL_MS)

  // Start countdown ticker for next 10-min cycle
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    const queue = getOfflineSyncQueue()
    const next = syncState.nextSyncSeconds > 0 ? syncState.nextSyncSeconds - 1 : Math.floor(SYNC_INTERVAL_MS / 1000)
    updateState({
      nextSyncSeconds: next,
      pendingCount: queue.length,
    })
  }, COUNTDOWN_INTERVAL_MS)

  // Initial trigger after 3 seconds on startup
  setTimeout(() => {
    syncNow({ manual: false })
  }, 3000)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    if (syncTimer) clearInterval(syncTimer)
    if (countdownTimer) clearInterval(countdownTimer)
  }
}

export function useSync() {
  const [state, setState] = useState(() => getSyncState())

  useEffect(() => {
    const listener = (next) => setState(next)
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, [])

  return {
    ...state,
    syncNow: () => syncNow({ manual: true }),
  }
}
