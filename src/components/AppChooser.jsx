import { Box, FileText, FlaskConical, Pill, ShoppingCart, Truck, Users, BarChart3 } from 'lucide-react'

// "Where do you want to go?" — one card per product of the suite this person may open (name, colour and icon come from the hub's registry).
const ICONS = { flask: FlaskConical, pill: Pill, cart: ShoppingCart, truck: Truck, users: Users, chart: BarChart3, box: Box, file: FileText }

export default function AppChooser({ apps, name, business, onChoose, busy, error, onCancel }) {
  return (
    <div className="text-center">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1b2a4a] tracking-tight">Where do you want to go?</h1>
      <p className="text-[#8b94a7] text-xs font-medium mt-1.5">
        Signed in as <b className="text-[#3c4761]">{name}</b>
        {business ? ` · ${business}` : ''}
      </p>
      <div className={`grid gap-4 mt-7 ${apps.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {apps.map((app) => {
          const Icon = ICONS[app.icon] || Box
          const color = app.color || '#475569'
          return (
            <button
              key={app.id}
              type="button"
              disabled={busy}
              onClick={() => onChoose(app.id)}
              style={{ '--ap': color, borderColor: `${color}55`, background: `linear-gradient(160deg, ${color}1f, #fff 70%)` }}
              className="group flex flex-col items-center gap-2 rounded-3xl border px-4 py-7 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:pointer-events-none"
            >
              <span className="w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-lg" style={{ background: color }}>
                <Icon className="w-7 h-7" />
              </span>
              <b className="text-base text-[#1b2a4a]">{app.name}</b>
              <small className="text-xs text-[#8b94a7] leading-snug">{app.sub}</small>
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
