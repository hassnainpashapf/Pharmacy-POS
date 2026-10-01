import { useState } from 'react'
import { useDB, generateApiKey, revokeApiKey } from '../lib/db'
import { Code, Key, Send, Copy, Check, Play, ExternalLink } from 'lucide-react'

export default function ApiExplorer() {
  const db = useDB()
  const apiKeys = db.apiKeys || []
  const [selectedEndpoint, setSelectedEndpoint] = useState('/api/v1/products')
  const [apiResponse, setApiResponse] = useState(null)
  const [copiedKey, setCopiedKey] = useState('')

  const endpoints = [
    {
      path: '/api/v1/products',
      method: 'GET',
      desc: 'Retrieve full catalog of registered pharmaceuticals, dosage strengths, and barcodes.',
      sampleData: (db.medicines || []).slice(0, 3),
    },
    {
      path: '/api/v1/stock',
      method: 'GET',
      desc: 'Query active batches, branch stock allocations, and expiry dates.',
      sampleData: (db.batches || []).slice(0, 3),
    },
    {
      path: '/api/v1/sales',
      method: 'GET',
      desc: 'Fetch completed sales transactions, invoices, and cashier logs.',
      sampleData: (db.sales || []).slice(0, 2),
    },
    {
      path: '/api/v1/customers',
      method: 'GET',
      desc: 'Look up customer profiles, loyalty tiers, points balances, and credit limits.',
      sampleData: (db.customers || []).slice(0, 2),
    },
    {
      path: '/api/v1/orders',
      method: 'GET',
      desc: 'Query B2B wholesale orders and logistics delivery records.',
      sampleData: (db.wholesaleOrders || []).slice(0, 2),
    },
  ]

  const handleTestCall = (ep) => {
    setSelectedEndpoint(ep.path)
    setApiResponse({
      status: 200,
      timestamp: new Date().toISOString(),
      endpoint: ep.path,
      data: ep.sampleData,
    })
  }

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text)
    setCopiedKey(text)
    setTimeout(() => setCopiedKey(''), 2000)
  }

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 mb-1">
            <Code className="w-3.5 h-3.5 text-slate-700" /> Developer Platform
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Open REST API & Webhooks Console</h2>
          <p className="text-xs text-slate-500">Integrate third-party accounting, e-commerce, delivery logistics, and BI pipelines</p>
        </div>

        <button
          onClick={() => generateApiKey('Custom API Integration', ['READ', 'WRITE'])}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          + Generate New API Key
        </button>
      </div>

      {/* API Keys Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm">Active API Credentials</h3>
        <div className="space-y-2">
          {apiKeys.map((k) => (
            <div key={k.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
              <div>
                <b className="text-slate-900">{k.name}</b>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                    {k.key}
                  </span>
                  <button onClick={() => handleCopy(k.key)} className="text-slate-500 hover:text-slate-800">
                    {copiedKey === k.key ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400">Created: {k.createdDate}</span>
                <button
                  onClick={() => revokeApiKey(k.id)}
                  className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded font-bold text-[11px]"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive REST API Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Endpoints List (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-2.5">
          <h3 className="font-bold text-slate-900 text-sm mb-3">API v1 Endpoints</h3>
          {endpoints.map((ep) => (
            <div
              key={ep.path}
              onClick={() => handleTestCall(ep)}
              className={`p-3 rounded-xl border cursor-pointer transition-all text-xs space-y-1 ${
                selectedEndpoint === ep.path ? 'bg-emerald-50/70 border-emerald-300 shadow-sm' : 'bg-slate-50/50 border-slate-200 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-900">{ep.path}</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px] font-bold">
                  {ep.method}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{ep.desc}</p>
            </div>
          ))}
        </div>

        {/* Live Response Payload Console (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 rounded-2xl shadow-lg border border-slate-800 p-5 text-white flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-3 text-xs">
              <span className="font-mono text-emerald-400 font-bold">{selectedEndpoint}</span>
              <span className="font-mono text-slate-400">HTTP 200 OK</span>
            </div>

            <pre className="text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-96 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 leading-relaxed">
              {JSON.stringify(apiResponse || { status: 200, message: 'Click any endpoint on the left to execute live REST query', endpoint: selectedEndpoint }, null, 2)}
            </pre>
          </div>

          <div className="pt-3 border-t border-slate-800 mt-4 flex justify-between items-center text-[11px] text-slate-400">
            <span>Authentication: Bearer pk_live_***</span>
            <span className="text-emerald-400 font-semibold">Response: application/json</span>
          </div>
        </div>
      </div>
    </div>
  )
}
