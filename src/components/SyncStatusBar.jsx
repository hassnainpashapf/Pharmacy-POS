import { useState } from 'react'
import { RefreshCw, Wifi, WifiOff, Cloud, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { useSync } from '../lib/syncEngine'

export default function SyncStatusBar() {
  const { status, lastSyncTime, nextSyncSeconds, pendingCount, syncNow, isOnline } = useSync()
  const [showModal, setShowModal] = useState(false)

  function formatTimeAgo(ts) {
    if (!ts) return 'Not yet synced'
    const diff = Math.floor((Date.now() - ts) / 1000)
    if (diff < 60) return `${diff}s ago`
    const mins = Math.floor(diff / 60)
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  function formatCountdown(sec) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const isSyncing = status === 'syncing'
  const isOffline = !isOnline || status === 'offline'

  return (
    <>
      <div className="flex items-center gap-2 text-xs font-medium">
        {/* Status Pill */}
        <button
          type="button"
          onClick={() => setShowModal(true)}
          title="Click to view Cloud Sync details"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer shadow-sm ${
            isOffline
              ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
              : isSyncing
              ? 'bg-indigo-50 border-indigo-300 text-indigo-900 animate-pulse'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
          }`}
        >
          <span className="relative flex h-2 w-2">
            {isSyncing ? (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            ) : isOffline ? (
              <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            ) : (
              <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isOffline ? 'bg-amber-500' : isSyncing ? 'bg-indigo-600' : 'bg-emerald-500'
              }`}
            ></span>
          </span>

          <span className="font-semibold hidden sm:inline">
            {isOffline ? 'Offline Mode' : isSyncing ? 'Syncing...' : 'Cloud Synced'}
          </span>

          {pendingCount > 0 && (
            <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full" title={`${pendingCount} pending offline items`}>
              {pendingCount} queued
            </span>
          )}

          {!isOffline && !isSyncing && (
            <span className="text-[11px] text-slate-500 hidden md:inline font-mono">
              ⏱ {formatCountdown(nextSyncSeconds)}
            </span>
          )}
        </button>

        {/* Sync Now Action Button */}
        <button
          type="button"
          onClick={() => syncNow()}
          disabled={isSyncing}
          title="Sync Now with Cloud (Auto-cycle every 10 min)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={isSyncing ? 'animate-spin text-indigo-600' : 'text-slate-500'} />
          <span className="hidden lg:inline">{isSyncing ? 'Syncing' : 'Sync Now'}</span>
        </button>
      </div>

      {/* Sync Status Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-2xl ${isOffline ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isOffline ? <WifiOff size={22} /> : <Cloud size={22} />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Cloud Sync & Offline Status</h3>
                  <p className="text-xs text-slate-500">10-Minute Automatic Cloud Sync Cycle</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs text-slate-600">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Network State:</span>
                  <span className={`font-bold flex items-center gap-1 ${isOffline ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {isOffline ? <WifiOff size={14} /> : <Wifi size={14} />}
                    {isOffline ? 'Offline (Local Only)' : 'Connected to Internet'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Auto-Sync Cycle:</span>
                  <span className="font-medium text-slate-800">Every 10 minutes</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Next Auto-Sync:</span>
                  <span className="font-mono font-bold text-indigo-600">
                    in {formatCountdown(nextSyncSeconds)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Last Synced:</span>
                  <span className="font-medium text-slate-800">{formatTimeAgo(lastSyncTime)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Pending Offline Items:</span>
                  <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                    {pendingCount} transactions
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <CheckCircle2 size={14} /> 100% Offline-First Architecture
                </p>
                Sales, billing, inventory lookup, and receipts run completely locally on this station without requiring internet. When online, changes automatically sync every 10 minutes.
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await syncNow()
                }}
                disabled={isSyncing}
                className="flex-1 bg-o-blue hover:bg-o-blue-d active:bg-o-blue-d border border-o-blue-d text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Syncing with Cloud…' : 'Sync Now (Force Push & Pull)'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold text-xs text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
