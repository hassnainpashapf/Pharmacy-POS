import { Pill, FlaskConical } from 'lucide-react'

// "Where do you want to go?" — shown when one login can open both the Pharmacy POS and the Blood Test Lab.
const CARDS = {
  pharmacy: {
    title: 'Pharmacy POS',
    text: 'Medicines, stock and billing counter',
    Icon: Pill,
    accent: 'from-[#2f6df6]/12 to-white border-[#2f6df6]/30 hover:border-[#2f6df6]',
    badge: 'bg-[#2f6df6] shadow-[#2f6df6]/40',
  },
  lab: {
    title: 'Blood Test Lab',
    text: 'Patients, tests, reports and invoices',
    Icon: FlaskConical,
    accent: 'from-[#0ea5a4]/12 to-white border-[#0ea5a4]/30 hover:border-[#0ea5a4]',
    badge: 'bg-[#0ea5a4] shadow-[#0ea5a4]/40',
  },
}

export default function AppChooser({ apps, name, business, onChoose, busy, error, onCancel }) {
  const list = ['pharmacy', 'lab'].filter((key) => apps.includes(key))
  return (
    <div className="text-center">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1b2a4a] tracking-tight">Where do you want to go?</h1>
      <p className="text-[#8b94a7] text-xs font-medium mt-1.5">
        Signed in as <b className="text-[#3c4761]">{name}</b>
        {business ? ` · ${business}` : ''}
      </p>
      <div className="grid sm:grid-cols-2 gap-4 mt-7">
        {list.map((key) => {
          const { title, text, Icon, accent, badge } = CARDS[key]
          return (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => onChoose(key)}
              className={`group flex flex-col items-center gap-2 rounded-3xl border bg-gradient-to-br ${accent} px-4 py-7 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:pointer-events-none`}
            >
              <span className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-lg ${badge}`}>
                <Icon className="w-7 h-7" />
              </span>
              <b className="text-base text-[#1b2a4a]">{title}</b>
              <small className="text-xs text-[#8b94a7] leading-snug">{text}</small>
            </button>
          )
        })}
      </div>
      {error && <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl p-3 font-medium">{error}</div>}
      {onCancel && (
        <button type="button" onClick={onCancel} className="mt-5 text-xs font-bold text-[#8b94a7] hover:text-rose-600">
          Sign out
        </button>
      )}
    </div>
  )
}
