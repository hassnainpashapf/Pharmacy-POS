import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useDB, fmt, stockOf } from '../lib/db'
import { Search, Pill, Navigation, X } from 'lucide-react'

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const db = useDB()
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onClose(!isOpen)
      } else if (e.key === 'Escape' && isOpen) {
        onClose(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const q = query.toLowerCase().trim()

  const pages = [
    { label: 'POS Terminal', path: '/pos', category: 'Pages' },
    { label: 'Dashboard', path: '/', category: 'Pages' },
    { label: 'Medicines Catalog', path: '/medicines', category: 'Pages' },
    { label: 'Stock Inventory', path: '/inventory', category: 'Pages' },
    { label: 'Smart AI Inventory', path: '/smart', category: 'Pages' },
    { label: 'Accounting & Ledgers', path: '/accounting', category: 'Pages' },
    { label: 'Purchases & Invoices', path: '/purchases', category: 'Pages' },
    { label: 'Suppliers', path: '/suppliers', category: 'Pages' },
    { label: 'Sales Returns', path: '/returns', category: 'Pages' },
    { label: 'Reports', path: '/reports', category: 'Pages' },
    { label: 'Settings', path: '/settings', category: 'Pages' },
  ].filter((p) => !q || p.label.toLowerCase().includes(q))

  const matchedMedicines = q
    ? db.medicines
        .filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.generic.toLowerCase().includes(q) ||
            (m.barcode || '').includes(q)
        )
        .slice(0, 5)
    : []

  const handleSelect = (path) => {
    navigate(path)
    onClose(false)
    setQuery('')
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
      onClick={() => onClose(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-xl overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3.5 border-b border-gray-100 bg-gray-50/50">
          <Search className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Type a medicine or page to jump..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none text-base"
          />
          <button
            onClick={() => onClose(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-4">
          {/* Medicines */}
          {matchedMedicines.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 py-1">
                Medicines
              </div>
              {matchedMedicines.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleSelect('/pos')}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Pill className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800 group-hover:text-emerald-800">
                        {m.name} {m.strength}
                      </div>
                      <div className="text-xs text-gray-500">
                        {m.generic} · Stock: {stockOf(m.id)}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-700">{fmt(m.salePrice)}</span>
                </div>
              ))}
            </div>
          )}



          {/* Navigation Pages */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 py-1">
              Quick Navigation
            </div>
            <div className="grid grid-cols-2 gap-1">
              {pages.slice(0, 8).map((p) => (
                <div
                  key={p.path}
                  onClick={() => handleSelect(p.path)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 cursor-pointer text-sm font-medium text-gray-700 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-gray-400" />
                  <span>{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>
            Press <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px]">ESC</kbd> to close
          </span>
          <span>Shortcut: Ctrl + K</span>
        </div>
      </div>
    </div>
  )
}
