import { useState } from 'react'
import { useDB, togglePlugin } from '../lib/db'
import { Puzzle, Check, Power, ExternalLink, Settings } from 'lucide-react'

export default function Plugins() {
  const db = useDB()
  const plugins = db.plugins || []
  const [filter, setFilter] = useState('ALL')

  const categories = ['ALL', 'Communication', 'Sales Channels', 'Logistics', 'Finance', 'AI & Automation']
  const filtered = plugins.filter((p) => (filter === 'ALL' ? true : p.category === filter))

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-1">
            <Puzzle className="w-3.5 h-3.5" /> Modular Enterprise Ecosystem
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Plugin Hub & Integration Modules</h2>
          <p className="text-xs text-slate-500">Enable or disable optional pharmacy services on-demand to maintain peak operational velocity</p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
          <span>Active Plugins:</span>
          <span className="font-extrabold text-emerald-700">{plugins.filter((p) => p.enabled).length} / {plugins.length}</span>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
              filter === c ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <div
            key={p.id}
            className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow-sm ${
              p.enabled ? 'bg-white border-slate-200/90' : 'bg-slate-50/70 border-slate-200/60 opacity-80'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{p.category}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    p.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {p.enabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">{p.name}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{p.desc}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => alert(`Configuring ${p.name} settings...`)}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                <Settings className="w-3.5 h-3.5" /> Configure
              </button>

              <button
                onClick={() => togglePlugin(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  p.enabled
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{p.enabled ? 'Disable' : 'Enable'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
