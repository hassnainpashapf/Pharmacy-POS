import { useState, useMemo } from 'react'
import { Calendar, ChevronLeft, ChevronRight, RotateCcw, CalendarDays, Filter } from 'lucide-react'

// Utility: get today in YYYY-MM-DD local format
export function getTodayStr() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Utility: shift date by N days
export function shiftDateStr(dateStr, days) {
  const [y, m, d] = (dateStr || getTodayStr()).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const year = dt.getFullYear()
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Utility: extract YYYY-MM-DD from any date, timestamp, or ISO string
export function toDateKey(val) {
  if (!val) return ''
  if (typeof val === 'number') {
    const d = new Date(val)
    if (isNaN(d.getTime())) return ''
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10)
  }
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return ''
}

// Filter check helper
export function matchesDateFilter(recordDate, filterState) {
  if (!filterState || filterState.type === 'all') return true
  const d = toDateKey(recordDate)
  if (!d) return false

  const t = getTodayStr()

  switch (filterState.type) {
    case 'today':
      return d === t

    case 'yesterday': {
      const yest = shiftDateStr(t, -1)
      return d === yest
    }

    case 'week': {
      const weekStart = shiftDateStr(t, -6)
      return d >= weekStart && d <= t
    }

    case 'month': {
      const monthStart = shiftDateStr(t, -29)
      return d >= monthStart && d <= t
    }

    case 'single':
      if (!filterState.singleDate) return true
      return d === filterState.singleDate

    case 'range': {
      const { fromDate, toDate } = filterState
      if (fromDate && d < fromDate) return false
      if (toDate && d > toDate) return false
      return true
    }

    default:
      return true
  }
}

// Hook helper to initialise state
export function useDateFilterState(initialType = 'all', initialSingleDate = null) {
  const [filterState, setFilterState] = useState({
    type: initialType, // 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'single' | 'range'
    singleDate: initialSingleDate || getTodayStr(),
    fromDate: shiftDateStr(getTodayStr(), -7),
    toDate: getTodayStr(),
  })
  return [filterState, setFilterState]
}

/**
 * Reusable DateFilterBar Component
 *
 * Props:
 * - filterState: { type, singleDate, fromDate, toDate }
 * - onChange: (newState) => void
 * - showAll: boolean (default true)
 * - compact: boolean (default false)
 * - label: optional string
 */
export default function DateFilterBar({
  filterState,
  onChange,
  showAll = true,
  compact = false,
  noBorder = false,
  asDropdown = false,
  className = '',
  dropdownClassName = '',
}) {
  const today = getTodayStr()
  const { type, singleDate, fromDate, toDate } = filterState

  const handleTypeChange = (newType) => {
    onChange({
      ...filterState,
      type: newType,
      singleDate: filterState.singleDate || today,
      fromDate: filterState.fromDate || shiftDateStr(today, -7),
      toDate: filterState.toDate || today,
    })
  }

  const handleSingleDateChange = (val) => {
    onChange({
      ...filterState,
      type: 'single',
      singleDate: val,
    })
  }

  const stepSingleDate = (days) => {
    const cur = singleDate || today
    const next = shiftDateStr(cur, days)
    handleSingleDateChange(next)
  }

  const handleRangeFromChange = (val) => {
    onChange({
      ...filterState,
      type: 'range',
      fromDate: val,
    })
  }

  const handleRangeToChange = (val) => {
    onChange({
      ...filterState,
      type: 'range',
      toDate: val,
    })
  }

  // Format single date for human readability
  const formattedSingleDate = useMemo(() => {
    if (!singleDate) return ''
    try {
      const [y, m, d] = singleDate.split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      return dt.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return singleDate
    }
  }, [singleDate])

  if (asDropdown) {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {/* Dropdown Menu */}
        <div className={`flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0 ${dropdownClassName}`}>
          <Calendar className="w-3.5 h-3.5 text-o-link shrink-0" />
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[145px] truncate"
            aria-label="Filter by date range"
          >
            {showAll && <option value="all">📅 All Dates</option>}
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">7 Days</option>
            <option value="month">30 Days</option>
            <option value="single">Single Day...</option>
            <option value="range">Date Range...</option>
          </select>
        </div>

        {/* Sub-bar: Single Day Picker inline */}
        {type === 'single' && (
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-1 shadow-2xs text-xs">
            <button
              type="button"
              onClick={() => stepSingleDate(-1)}
              title="Previous Day"
              className="p-0.5 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <input
              type="date"
              value={singleDate || today}
              onChange={(e) => handleSingleDateChange(e.target.value)}
              className="px-1 text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            />
            <button
              type="button"
              onClick={() => stepSingleDate(1)}
              title="Next Day"
              className="p-0.5 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {formattedSingleDate && (
              <span className="text-[11px] font-semibold text-o-link pl-1 border-l border-slate-200 hidden md:inline">
                {formattedSingleDate}
              </span>
            )}
          </div>
        )}

        {/* Sub-bar: Date Range Picker inline */}
        {type === 'range' && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs text-xs">
            <input
              type="date"
              value={fromDate || shiftDateStr(today, -7)}
              onChange={(e) => handleRangeFromChange(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            />
            <span className="text-slate-400 font-bold text-[11px]">to</span>
            <input
              type="date"
              value={toDate || today}
              onChange={(e) => handleRangeToChange(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>
        )}
      </div>
    )
  }

  const pills = [
    ...(showAll ? [{ id: 'all', label: 'All' }] : []),
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: '7 Days' },
    { id: 'month', label: '30 Days' },
    { id: 'single', label: 'Single Day', icon: Calendar },
    { id: 'range', label: 'Date Range', icon: CalendarDays },
  ]

  return (
    <div className={`space-y-2 ${className}`}>
      {/* ── Preset & Mode Selector Bar ── */}
      <div className={`flex flex-wrap items-center gap-1.5 ${noBorder ? 'p-0.5' : 'bg-white p-1 rounded-xl border border-slate-200 shadow-xs'}`}>
        {pills.map(({ id, label, icon: Icon }) => {
          const active = type === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTypeChange(id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                active
                  ? 'bg-o-teal-tint text-o-teal font-bold border border-o-line shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{label}</span>
            </button>
          )
        })}

        {type !== 'all' && showAll && (
          <button
            type="button"
            onClick={() => handleTypeChange('all')}
            title="Reset to All"
            className="ml-auto px-2 py-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>

      {/* ── Sub-bar: Single Day Picker ── */}
      {type === 'single' && (
        <div className="flex flex-wrap items-center gap-2 bg-o-tint/60 border border-o-blue/20 p-2 rounded-xl text-xs">
          <span className="font-bold text-o-link flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-o-link" />
            <span>Select Day:</span>
          </span>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => stepSingleDate(-1)}
              title="Previous Day"
              className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <input
              type="date"
              value={singleDate || today}
              onChange={(e) => handleSingleDateChange(e.target.value)}
              className="px-2 py-1 text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            />

            <button
              type="button"
              onClick={() => stepSingleDate(1)}
              title="Next Day"
              className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {singleDate !== today && (
            <button
              type="button"
              onClick={() => handleSingleDateChange(today)}
              className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              Jump to Today
            </button>
          )}

          {formattedSingleDate && (
            <span className="ml-auto font-medium text-o-link bg-white px-2.5 py-1 rounded-lg border border-o-blue/15">
              📅 {formattedSingleDate}
            </span>
          )}
        </div>
      )}

      {/* ── Sub-bar: Date Range Picker ── */}
      {type === 'range' && (
        <div className="flex flex-wrap items-center gap-2 bg-o-tint/60 border border-o-blue/20 p-2 rounded-xl text-xs">
          <span className="font-bold text-o-link flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-o-link" />
            <span>Custom Date Range:</span>
          </span>

          <div className="flex items-center gap-1.5">
            <label className="text-slate-500 font-medium">From:</label>
            <input
              type="date"
              value={fromDate || ''}
              onChange={(e) => handleRangeFromChange(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-o-blue cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-slate-500 font-medium">To:</label>
            <input
              type="date"
              value={toDate || ''}
              onChange={(e) => handleRangeToChange(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-o-blue cursor-pointer"
            />
          </div>

          {fromDate && toDate && (
            <span className="ml-auto text-[11px] font-semibold text-o-link bg-white px-2 py-1 rounded-lg border border-o-blue/15">
              Range: {fromDate} → {toDate}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
