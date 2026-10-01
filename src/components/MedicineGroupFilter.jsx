import { MEDICINE_GROUPS } from '../lib/medicineGroups'

export default function MedicineGroupFilter({ value, onChange, counts, unit = 'products', context = 'current search' }) {
  return (
    <section className="border-b border-slate-200 pb-3" aria-label="Dosage form filters">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-slate-900" title={`Counts show ${unit} matching ${context}`}>Dosage form</h3>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Medicine dosage form">
        {MEDICINE_GROUPS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              value === id
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {label}
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${value === id ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
              {counts[id] || 0}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
