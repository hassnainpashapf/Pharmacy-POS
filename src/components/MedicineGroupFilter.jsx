import { Layers } from 'lucide-react'
import { MEDICINE_GROUPS } from '../lib/medicineGroups'

export default function MedicineGroupFilter({
  value,
  onChange,
  counts = {},
  unit = 'products',
  context = 'current search',
  noBorder = false,
  asDropdown = false,
  className = '',
}) {
  if (asDropdown) {
    return (
      <div className={`flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0 ${className}`}>
        <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[170px] truncate"
          aria-label="Filter by dosage form"
        >
          {MEDICINE_GROUPS.map(({ id, label }) => {
            const count = counts[id] ?? 0
            return (
              <option key={id} value={id}>
                {id === 'all' ? `💊 All Forms (${count})` : `${label} (${count})`}
              </option>
            )
          })}
        </select>
      </div>
    )
  }

  return (
    <section className={noBorder ? '' : 'border-b border-slate-200 pb-3'} aria-label="Dosage form filters">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold text-slate-800" title={`Counts show ${unit} matching ${context}`}>Dosage form</h3>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Medicine dosage form">
        {MEDICINE_GROUPS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer ${
              value === id
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {label}
            <span className={`rounded px-1.5 py-0.5 text-[10px] tabular-nums ${value === id ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-slate-100 text-slate-500'}`}>
              {counts[id] || 0}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
