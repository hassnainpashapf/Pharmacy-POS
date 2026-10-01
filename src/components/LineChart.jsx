import { useState } from 'react'

// Dependency-free SVG line chart with hover tooltip
export default function LineChart({ data, height = 160, color = '#059669', format = (n) => n }) {
  const [hover, setHover] = useState(null)
  const W = 600, H = height, P = { t: 12, r: 12, b: 22, l: 12 }
  const iw = W - P.l - P.r, ih = H - P.t - P.b
  const safeData = Array.isArray(data) && data.length > 0 ? data : [{ label: 'Today', value: 0 }]
  const max = Math.max(...safeData.map((d) => Number(d?.value) || 0), 1)
  const pts = safeData.map((d, i) => ({
    x: P.l + (i / Math.max(safeData.length - 1, 1)) * iw,
    y: P.t + ih - ((Number(d?.value) || 0) / max) * ih,
    ...d,
  }))
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${path} L${pts[pts.length - 1]?.x || P.l},${P.t + ih} L${P.l},${P.t + ih} Z`
  const last = pts[pts.length - 1]

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = ((e.clientX - rect.left) / rect.width) * W
          const idx = Math.round(((x - P.l) / iw) * (data.length - 1))
          setHover(Math.max(0, Math.min(data.length - 1, idx)))
        }}>
        {/* grid */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={P.l} x2={W - P.r} y1={P.t + ih - f * ih} y2={P.t + ih - f * ih}
            stroke="#e5e7eb" strokeDasharray="3 3" />
        ))}
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lg)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* hover targets */}
        {pts.map((p, i) => (
          <rect key={i} x={p.x - iw / data.length / 2} y={P.t} width={iw / data.length} height={ih}
            fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && (
          <>
            <line x1={pts[hover].x} x2={pts[hover].x} y1={P.t} y2={P.t + ih} stroke={color} strokeDasharray="2 2" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="4" fill="white" stroke={color} strokeWidth="2.5" />
          </>
        )}
        {last && <circle cx={last.x} cy={last.y} r="3.5" fill={color} />}
      </svg>
      {hover !== null && (
        <div className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-2 py-1 shadow-lg"
          style={{ left: `${(pts[hover].x / W) * 100}%`, top: 0, transform: `translate(${pts[hover].x > W * 0.75 ? '-110%' : '10%'}, -30%)` }}>
          <b>{format(data[hover].value)}</b>
          <div className="opacity-70">{data[hover].label}</div>
        </div>
      )}
      {/* x labels */}
      <div className="flex justify-between text-[9px] text-gray-400 px-1">
        {data.filter((_, i) => i % Math.ceil(data.length / 7) === 0).map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}
