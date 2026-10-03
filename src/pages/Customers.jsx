import { useState, useMemo } from 'react'
import { useLocation } from 'react-router'
import {
  useDB,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  payCustomer,
  addCustomerPoints,
  fmt,
  loyaltyTier,
  loyaltyTiers,
} from '../lib/db'
import CustomerProfile from './CustomerProfile'
import {
  Users,
  CreditCard,
  Award,
  Sparkles,
  Search,
  Printer,
  Plus,
  DollarSign,
  CheckCircle2,
  Edit3,
  Trash2,
  X,
  MessageCircle,
  Star,
  Receipt,
  User,
  Crown,
  Coins,
  Shield,
  Layers,
} from 'lucide-react'

function getInitials(name = '') {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
}

function getTierBadge(tierName = 'Silver') {
  const t = (tierName || '').toLowerCase()
  if (t === 'platinum') {
    return {
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      dot: 'bg-purple-500',
      icon: '👑',
    }
  }
  if (t === 'gold') {
    return {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
      icon: '⭐',
    }
  }
  return {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    icon: '🛡️',
  }
}

export function Customers() {
  const db = useDB()
  const location = useLocation()
  const isLoyaltyTab = new URLSearchParams(location.search).get('tab') === 'loyalty'

  const customers = db.customers || []
  const sales = db.sales || []

  // Filter & Search states (Customers directory)
  const [search, setSearch] = useState('')
  const [balanceFilter, setBalanceFilter] = useState('ALL') // 'ALL' | 'DUE' | 'CLEARED'
  const [tierFilter, setTierFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('DUE_DESC') // 'DUE_DESC' | 'POINTS_DESC' | 'NAME_ASC' | 'SPEND_DESC'

  // Filter & Search states (Loyalty view)
  const [loyaltySearch, setLoyaltySearch] = useState('')
  const [loyaltyTierFilter, setLoyaltyTierFilter] = useState('ALL')
  const [loyaltyPointsFilter, setLoyaltyPointsFilter] = useState('ALL') // 'ALL' | 'HAS_POINTS' | 'ZERO_POINTS'
  const [loyaltySortBy, setLoyaltySortBy] = useState('POINTS_DESC') // 'POINTS_DESC' | 'SPEND_DESC' | 'NAME_ASC'

  // Modal states
  const [modalCustomer, setModalCustomer] = useState(null) // null | {} (new) | customerObj (edit)
  const [payFor, setPayFor] = useState(null)
  const [profileFor, setProfileFor] = useState(null)
  const [pointsCustomer, setPointsCustomer] = useState(null)

  // Customer sales aggregation
  const customerStatsMap = useMemo(() => {
    const map = new Map()
    for (const s of sales) {
      if (!s.customerId) continue
      const prev = map.get(s.customerId) || { spend: 0, count: 0, lastDate: '' }
      prev.spend += s.total || 0
      prev.count += 1
      if (!prev.lastDate || s.date > prev.lastDate) {
        prev.lastDate = s.date
      }
      map.set(s.customerId, prev)
    }
    return map
  }, [sales])

  // Overall KPI statistics
  const stats = useMemo(() => {
    let totalAccounts = customers.length
    let totalUdhar = 0
    let udharAccountsCount = 0
    let totalCreditLimit = 0
    let loyaltyMembersCount = 0
    let totalPoints = 0
    let vipMembersCount = 0

    for (const c of customers) {
      const bal = c.balance || 0
      if (bal > 0) {
        totalUdhar += bal
        udharAccountsCount++
      }
      totalCreditLimit += c.creditLimit || 0
      const pts = c.points || 0
      totalPoints += pts
      if (pts > 0) {
        loyaltyMembersCount++
      }
      const tName = loyaltyTier(pts).name.toLowerCase()
      if (tName === 'gold' || tName === 'platinum') {
        vipMembersCount++
      }
    }

    return {
      totalAccounts,
      totalUdhar,
      udharAccountsCount,
      totalCreditLimit,
      loyaltyMembersCount,
      totalPoints,
      vipMembersCount,
    }
  }, [customers])

  // Filtered & Sorted Customer List (Main Directory)
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        if (search.trim()) {
          const q = search.toLowerCase().trim()
          const nameMatch = (c.name || '').toLowerCase().includes(q)
          const phoneMatch = (c.phone || '').includes(q)
          const idMatch = (c.id || '').toLowerCase().includes(q)
          if (!nameMatch && !phoneMatch && !idMatch) return false
        }

        const bal = c.balance || 0
        if (balanceFilter === 'DUE' && bal <= 0) return false
        if (balanceFilter === 'CLEARED' && bal > 0) return false

        if (tierFilter !== 'ALL') {
          const cTier = loyaltyTier(c.points || 0).name.toUpperCase()
          if (cTier !== tierFilter) return false
        }

        return true
      })
      .sort((a, b) => {
        const balA = a.balance || 0
        const balB = b.balance || 0
        const ptsA = a.points || 0
        const ptsB = b.points || 0
        const spendA = customerStatsMap.get(a.id)?.spend || 0
        const spendB = customerStatsMap.get(b.id)?.spend || 0

        if (sortBy === 'DUE_DESC') return balB - balA
        if (sortBy === 'POINTS_DESC') return ptsB - ptsA
        if (sortBy === 'SPEND_DESC') return spendB - spendA
        if (sortBy === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '')
        return 0
      })
  }, [customers, search, balanceFilter, tierFilter, sortBy, customerStatsMap])

  // Filtered & Sorted Loyalty Members
  const filteredLoyaltyMembers = useMemo(() => {
    return customers
      .filter((c) => {
        if (loyaltySearch.trim()) {
          const q = loyaltySearch.toLowerCase().trim()
          const nameMatch = (c.name || '').toLowerCase().includes(q)
          const phoneMatch = (c.phone || '').includes(q)
          const idMatch = (c.id || '').toLowerCase().includes(q)
          if (!nameMatch && !phoneMatch && !idMatch) return false
        }

        if (loyaltyTierFilter !== 'ALL') {
          const cTier = loyaltyTier(c.points || 0).name.toUpperCase()
          if (cTier !== loyaltyTierFilter) return false
        }

        const pts = c.points || 0
        if (loyaltyPointsFilter === 'HAS_POINTS' && pts <= 0) return false
        if (loyaltyPointsFilter === 'ZERO_POINTS' && pts > 0) return false

        return true
      })
      .sort((a, b) => {
        const ptsA = a.points || 0
        const ptsB = b.points || 0
        const spendA = customerStatsMap.get(a.id)?.spend || 0
        const spendB = customerStatsMap.get(b.id)?.spend || 0

        if (loyaltySortBy === 'POINTS_DESC') return ptsB - ptsA
        if (loyaltySortBy === 'SPEND_DESC') return spendB - spendA
        if (loyaltySortBy === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '')
        return 0
      })
  }, [customers, loyaltySearch, loyaltyTierFilter, loyaltyPointsFilter, loyaltySortBy, customerStatsMap])

  // Clear directory filters
  const resetFilters = () => {
    setSearch('')
    setBalanceFilter('ALL')
    setTierFilter('ALL')
    setSortBy('DUE_DESC')
  }

  // Clear loyalty filters
  const resetLoyaltyFilters = () => {
    setLoyaltySearch('')
    setLoyaltyTierFilter('ALL')
    setLoyaltyPointsFilter('ALL')
    setLoyaltySortBy('POINTS_DESC')
  }

  const isFiltered = search || balanceFilter !== 'ALL' || tierFilter !== 'ALL' || sortBy !== 'DUE_DESC'
  const isLoyaltyFiltered =
    loyaltySearch || loyaltyTierFilter !== 'ALL' || loyaltyPointsFilter !== 'ALL' || loyaltySortBy !== 'POINTS_DESC'

  return (
    <div className="space-y-5 pb-12">
      {/* =========================================================================
          VIEW A: DEDICATED LOYALTY PROGRAM & CUSTOMER CREDITS (?tab=loyalty)
          ========================================================================= */}
      {isLoyaltyTab ? (
        <>
          {/* 1. Standard Loyalty Header Banner */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#3b1734] flex items-center justify-center text-white shadow-sm shrink-0">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    Loyalty Program & Customer Credits
                  </h1>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    {loyaltyTiers().length} Tiers Active
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Customer reward points, redemption rates, tier privileges, and member credits.
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Earn 1 pt / Rs. 100 • 1 pt = Rs. 1 off</span>
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
                title="Print Loyalty Ledger"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print</span>
              </button>
              <button
                onClick={() => setModalCustomer({})}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Member</span>
              </button>
            </div>
          </div>

          {/* 2. 5 Loyalty KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Loyalty Members */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Active Members</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{stats.loyaltyMembersCount}</div>
              <div className="text-[11px] font-medium text-amber-700 mt-0.5">Holding reward points</div>
            </div>

            {/* Points Pool Liability */}
            <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-4 hover:border-purple-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-700">Points Pool</span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-700 mt-2">
                ⭐ {stats.totalPoints.toLocaleString()}
              </div>
              <div className="text-[11px] font-medium text-purple-600 mt-0.5">
                Liability: {fmt(stats.totalPoints)}
              </div>
            </div>

            {/* Redemption Value */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Redeem Rate</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">Rs. 1 / pt</div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5">Max 50% cart discount</div>
            </div>

            {/* VIP Tiers (Gold & Platinum) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">VIP Members</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Crown className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{stats.vipMembersCount}</div>
              <div className="text-[11px] font-medium text-blue-600 mt-0.5">Gold & Platinum patrons</div>
            </div>

            {/* Total Credit Ceiling */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Credit Ceiling</span>
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{fmt(stats.totalCreditLimit)}</div>
              <div className="text-[11px] font-medium text-rose-600 mt-0.5">
                Current Due: {fmt(stats.totalUdhar)}
              </div>
            </div>
          </div>

          {/* 3. Reward Tiers Breakdown Cards */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#714B67]" />
                  <span>Loyalty Tier Status & Privileges</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Automatic tier elevation based on lifetime accumulated points.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {loyaltyTiers().map((tier) => {
                const count = customers.filter(
                  (c) => loyaltyTier(c.points || 0).name === tier.name
                ).length
                const totalTierPts = customers
                  .filter((c) => loyaltyTier(c.points || 0).name === tier.name)
                  .reduce((acc, c) => acc + (c.points || 0), 0)
                const badge = getTierBadge(tier.name)

                return (
                  <div
                    key={tier.name}
                    className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-[#714B67] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{badge.icon}</span>
                        <div>
                          <span className="text-sm font-bold text-slate-900">{tier.name} Member</span>
                          <div className="text-[10px] text-slate-500 font-medium">
                            Min {tier.min} points requirement
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.bg}`}>
                        {tier.name}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-end">
                      <div>
                        <div className="text-2xl font-black text-slate-900">{count}</div>
                        <div className="text-[11px] font-semibold text-slate-500">Enrolled Customers</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-amber-600">
                          ⭐ {totalTierPts.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">Total tier points</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4. Search & Filter Toolbar (Loyalty) */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search member by name, phone, or ID..."
                value={loyaltySearch}
                onChange={(e) => setLoyaltySearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714B67] transition-all"
              />
              {loyaltySearch && (
                <button
                  onClick={() => setLoyaltySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tier Filter */}
            <select
              value={loyaltyTierFilter}
              onChange={(e) => setLoyaltyTierFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none"
            >
              <option value="ALL">⭐ All Reward Tiers</option>
              <option value="SILVER">🛡️ Silver Tier</option>
              <option value="GOLD">⭐ Gold Tier</option>
              <option value="PLATINUM">👑 Platinum Tier</option>
            </select>

            {/* Points Filter */}
            <select
              value={loyaltyPointsFilter}
              onChange={(e) => setLoyaltyPointsFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none"
            >
              <option value="ALL">✨ All Members</option>
              <option value="HAS_POINTS">⭐ Available Points &gt; 0</option>
              <option value="ZERO_POINTS">⚪ Zero Points</option>
            </select>

            {/* Sort Order */}
            <select
              value={loyaltySortBy}
              onChange={(e) => setLoyaltySortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none"
            >
              <option value="POINTS_DESC">Sort: Most Points ⭐</option>
              <option value="SPEND_DESC">Sort: Highest Lifetime Spend</option>
              <option value="NAME_ASC">Sort: Customer Name (A-Z)</option>
            </select>

            {/* Reset Filters */}
            {isLoyaltyFiltered && (
              <button
                onClick={resetLoyaltyFilters}
                className="px-3 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* 5. Member Points Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4 text-center">Reward Tier</th>
                    <th className="py-3 px-4 text-center">Available Points</th>
                    <th className="py-3 px-4 text-right">Lifetime Spend</th>
                    <th className="py-3 px-4 text-right">Credit Due (Udhar)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLoyaltyMembers.map((c) => {
                    const badge = getTierBadge(loyaltyTier(c.points || 0).name)
                    const bal = c.balance || 0
                    const hasDue = bal > 0
                    const stats = customerStatsMap.get(c.id) || { spend: 0, count: 0 }

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Member Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 font-black text-xs flex items-center justify-center shrink-0">
                              {getInitials(c.name)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                                {c.id === 'walkin' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                    Walk-in
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                ID: {c.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4 font-mono text-slate-700 font-medium">
                          {c.phone || <span className="text-slate-400 italic">No phone</span>}
                        </td>

                        {/* Reward Tier */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                          >
                            <span>{badge.icon}</span>
                            <span>{loyaltyTier(c.points || 0).name}</span>
                          </span>
                        </td>

                        {/* Available Points */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-black text-amber-600 font-mono text-sm">
                              ⭐ {c.points || 0}
                            </span>
                            <button
                              onClick={() => setPointsCustomer(c)}
                              className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold transition cursor-pointer"
                              title="Award or Deduct Points"
                            >
                              ± Points
                            </button>
                          </div>
                        </td>

                        {/* Lifetime Spend */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono font-bold text-emerald-700">{fmt(stats.spend)}</div>
                          <div className="text-[10px] text-slate-400">
                            {stats.count} bill{stats.count === 1 ? '' : 's'}
                          </div>
                        </td>

                        {/* Credit Due */}
                        <td className="py-3.5 px-4 text-right">
                          {hasDue ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-black font-mono text-xs">
                              {fmt(bal)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Cleared</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setProfileFor(c.id)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                              title="View Customer Profile & Ledger"
                            >
                              Profile
                            </button>
                            {c.id !== 'walkin' && hasDue && (
                              <button
                                onClick={() => setPayFor(c)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
                                title="Receive Outstanding Balance"
                              >
                                Receive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {!filteredLoyaltyMembers.length && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <div className="text-sm font-bold text-slate-600">No Members Found</div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Try searching with a different term or clear your active filters.
                        </p>
                        {isLoyaltyFiltered && (
                          <button
                            onClick={resetLoyaltyFilters}
                            className="mt-3 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 transition cursor-pointer"
                          >
                            Clear Filters
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between text-xs text-slate-500">
              <div>
                Showing <span className="font-bold text-slate-700">{filteredLoyaltyMembers.length}</span> of{' '}
                <span className="font-bold text-slate-700">{customers.length}</span> registered members
              </div>
              <div className="flex items-center gap-4">
                <span>
                  Points pool in view:{' '}
                  <strong className="text-purple-700 font-mono">
                    ⭐{' '}
                    {filteredLoyaltyMembers
                      .reduce((acc, c) => acc + (c.points || 0), 0)
                      .toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* =========================================================================
           VIEW B: STANDARD CUSTOMERS & CREDIT ACCOUNTS DIRECTORY (/customers)
           ========================================================================= */
        <>
          {/* 1. Standard Header Banner */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#3b1734] flex items-center justify-center text-white shadow-sm shrink-0">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    Customers & Credit Accounts
                  </h1>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f5eef4] text-[#714B67] border border-[#decddd]">
                    {customers.length} accounts
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Customer ledger accounts, credit ceilings, outstanding dues (Udhar), and loyalty points.
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
                title="Print Customer List"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print Ledger</span>
              </button>
              <button
                onClick={() => setModalCustomer({})}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Customer</span>
              </button>
            </div>
          </div>

          {/* 2. 5 KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Total Customers */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Total Accounts</span>
                <div className="w-8 h-8 rounded-lg bg-[#f5eef4] flex items-center justify-center text-[#714B67]">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{stats.totalAccounts}</div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5">Registered accounts</div>
            </div>

            {/* Receivables Due (Udhar) */}
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4 hover:border-rose-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700">Receivable (Udhar)</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-600 mt-2">{fmt(stats.totalUdhar)}</div>
              <div className="text-[11px] font-medium text-rose-600 mt-0.5">
                {stats.udharAccountsCount} account{stats.udharAccountsCount === 1 ? '' : 's'} with dues
              </div>
            </div>

            {/* Total Credit Limit */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Total Credit Limit</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{fmt(stats.totalCreditLimit)}</div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5">Approved credit ceiling</div>
            </div>

            {/* Loyalty Members */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Loyalty Members</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{stats.loyaltyMembersCount}</div>
              <div className="text-[11px] font-medium text-amber-700 mt-0.5">Active reward points</div>
            </div>

            {/* Total Points Balance */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Points Pool</span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-700 mt-2">
                ⭐ {stats.totalPoints.toLocaleString()}
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5">Redeemable customer points</div>
            </div>
          </div>

          {/* 3. Search & Filter Toolbar and Directory */}
          <div className="space-y-3.5">
            {/* Search & Filter Toolbar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-2.5">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search customers by name, phone number, or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714B67] transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Balance Filter */}
              <select
                value={balanceFilter}
                onChange={(e) => setBalanceFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none"
              >
                <option value="ALL">💰 All Balances</option>
                <option value="DUE">🔴 Udhar Due Only</option>
                <option value="CLEARED">🟢 Cleared Accounts</option>
              </select>

              {/* Tier Filter */}
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none"
              >
                <option value="ALL">⭐ All Reward Tiers</option>
                <option value="SILVER">🛡️ Silver Tier</option>
                <option value="GOLD">⭐ Gold Tier</option>
                <option value="PLATINUM">👑 Platinum Tier</option>
              </select>

              {/* Sort Order */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none"
              >
                <option value="DUE_DESC">Sort: Highest Udhar First</option>
                <option value="POINTS_DESC">Sort: Most Points ⭐</option>
                <option value="SPEND_DESC">Sort: Highest Lifetime Spend</option>
                <option value="NAME_ASC">Sort: Customer Name (A-Z)</option>
              </select>

              {/* Reset Filters */}
              {isFiltered && (
                <button
                  onClick={resetFilters}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Main Customers Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Customer Details</th>
                      <th className="py-3 px-4">Phone / Contact</th>
                      <th className="py-3 px-4 text-center">Reward Tier</th>
                      <th className="py-3 px-4 text-center">Points ⭐</th>
                      <th className="py-3 px-4 text-right">Credit Limit</th>
                      <th className="py-3 px-4 text-right">Balance (Udhar)</th>
                      <th className="py-3 px-4 text-right">Total Purchases</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.map((c) => {
                      const bal = c.balance || 0
                      const hasDue = bal > 0
                      const badge = getTierBadge(loyaltyTier(c.points || 0).name)
                      const stats = customerStatsMap.get(c.id) || { spend: 0, count: 0 }

                      const waMsg = encodeURIComponent(
                        `Assalam-o-Alaikum ${c.name},\nThis is a polite reminder that your pending balance at our pharmacy is ${fmt(
                          bal
                        )}.\nPlease clear your dues at your convenience.\nThank you!`
                      )
                      const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '')
                      const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMsg}` : null

                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            hasDue ? 'bg-rose-50/15' : ''
                          }`}
                        >
                          {/* Customer Details */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-[#f5eef4] text-[#714B67] border border-[#decddd] font-black text-xs flex items-center justify-center shrink-0">
                                {getInitials(c.name)}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                                  {c.id === 'walkin' && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                      Walk-in
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  ID: {c.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Phone / Contact */}
                          <td className="py-3.5 px-4">
                            {c.phone ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-700 font-medium">{c.phone}</span>
                                {hasDue && waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Send WhatsApp Payment Reminder"
                                    className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition cursor-pointer"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No phone</span>
                            )}
                          </td>

                          {/* Reward Tier */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                            >
                              <span>{badge.icon}</span>
                              <span>{loyaltyTier(c.points || 0).name}</span>
                            </span>
                          </td>

                          {/* Points ⭐ */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="font-bold text-amber-600 font-mono">
                                ⭐ {c.points || 0}
                              </span>
                              <button
                                onClick={() => setPointsCustomer(c)}
                                className="w-5 h-5 rounded flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold transition cursor-pointer"
                                title="Adjust Points (+ / -)"
                              >
                                ±
                              </button>
                            </div>
                          </td>

                          {/* Credit Limit */}
                          <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                            {c.creditLimit ? fmt(c.creditLimit) : '—'}
                          </td>

                          {/* Balance (Udhar) */}
                          <td className="py-3.5 px-4 text-right">
                            {hasDue ? (
                              <div className="inline-flex flex-col items-end">
                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-black font-mono text-xs">
                                  Due: {fmt(bal)}
                                </span>
                                {c.creditLimit && bal > c.creditLimit && (
                                  <span className="text-[9px] text-rose-500 font-bold mt-0.5">
                                    ⚠️ Over Limit
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Cleared</span>
                              </span>
                            )}
                          </td>

                          {/* Total Purchases */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="font-mono font-bold text-slate-800">{fmt(stats.spend)}</div>
                            <div className="text-[10px] text-slate-400">
                              {stats.count} bill{stats.count === 1 ? '' : 's'}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {c.id !== 'walkin' && hasDue && (
                                <button
                                  onClick={() => setPayFor(c)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
                                  title="Receive Outstanding Balance"
                                >
                                  Receive
                                </button>
                              )}

                              <button
                                onClick={() => setProfileFor(c.id)}
                                className="px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                                title="View Customer Profile & Ledger"
                              >
                                Ledger
                              </button>

                              {c.id !== 'walkin' && (
                                <button
                                  onClick={() => setModalCustomer(c)}
                                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                                  title="Edit Customer Details"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {c.id !== 'walkin' && (
                                <button
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Are you sure you want to delete customer "${c.name}"?`
                                      )
                                    ) {
                                      deleteCustomer(c.id)
                                    }
                                  }}
                                  className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                  title="Delete Customer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {!filteredCustomers.length && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <div className="text-sm font-bold text-slate-600">No Customers Found</div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Try searching with a different term or clear your active filters.
                          </p>
                          {isFiltered && (
                            <button
                              onClick={resetFilters}
                              className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
                            >
                              Clear Filters
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between text-xs text-slate-500">
                <div>
                  Showing <span className="font-bold text-slate-700">{filteredCustomers.length}</span> of{' '}
                  <span className="font-bold text-slate-700">{customers.length}</span> total accounts
                </div>
                <div className="flex items-center gap-4">
                  <span>
                    Total Udhar in view:{' '}
                    <strong className="text-rose-600 font-mono">
                      {fmt(filteredCustomers.reduce((acc, c) => acc + (c.balance || 0), 0))}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          SHARED MODALS
          ========================================================================= */}

      {/* MODAL: Add / Edit Customer */}
      {modalCustomer && (
        <CustomerFormModal
          initialData={modalCustomer}
          onSave={(data) => {
            if (modalCustomer.id) {
              updateCustomer(modalCustomer.id, data)
            } else {
              addCustomer(data)
            }
            setModalCustomer(null)
          }}
          onClose={() => setModalCustomer(null)}
        />
      )}

      {/* MODAL: Receive Payment (Udhar Clearance) */}
      {payFor && (
        <CustomerPayModal
          customer={payFor}
          onConfirm={(amount) => {
            payCustomer(payFor.id, amount)
            setPayFor(null)
          }}
          onClose={() => setPayFor(null)}
        />
      )}

      {/* MODAL: Customer Profile & Full Ledger History */}
      {profileFor && (
        <CustomerProfile customerId={profileFor} onClose={() => setProfileFor(null)} />
      )}

      {/* MODAL: Adjust Points */}
      {pointsCustomer && (
        <AdjPointsModal
          customer={pointsCustomer}
          onClose={() => setPointsCustomer(null)}
          onApply={(pts, reason) => {
            addCustomerPoints(pointsCustomer.id, pts, reason || 'manual adjust')
            setPointsCustomer(null)
          }}
        />
      )}
    </div>
  )
}

/* ==========================================================================
   SUBCOMPONENTS & MODALS
   ========================================================================== */

function CustomerFormModal({ initialData = {}, onSave, onClose }) {
  const isEdit = Boolean(initialData.id)
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    phone: initialData.phone || '',
    creditLimit: initialData.creditLimit || '',
    openingBalance: initialData.balance || 0,
    address: initialData.address || '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('Please enter a valid customer name.')
      return
    }

    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      creditLimit: Number(formData.creditLimit) || 0,
      address: formData.address.trim(),
    }

    if (!isEdit && formData.openingBalance) {
      payload.balance = Number(formData.openingBalance) || 0
    }

    onSave(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
        <div className="p-4 bg-gradient-to-r from-[#3b1734] to-[#714B67] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <h3 className="font-bold text-sm">
              {isEdit ? `Edit Customer: ${initialData.name}` : 'Create New Customer Account'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Customer Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Haji Muhammad Aslam"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-[#714B67] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Phone / Mobile (for SMS/WhatsApp Reminders)
            </label>
            <input
              type="text"
              placeholder="e.g. 03001234567"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-[#714B67] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Credit Limit (Rs.)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                placeholder="e.g. 10000"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-[#714B67] focus:outline-none"
              />
            </div>

            {!isEdit && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Opening Balance (Udhar)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Address / Area / Note
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Ellahabad Main Bazaar, Shop # 4"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#714B67] focus:outline-none resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white font-bold shadow-sm transition-all cursor-pointer"
            >
              {isEdit ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerPayModal({ customer, onConfirm, onClose }) {
  const max = customer.balance || 0
  const [amount, setAmount] = useState(max || '')
  const [payMethod, setPayMethod] = useState('CASH')
  const [note, setNote] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const num = Number(amount)
    if (!num || num <= 0) {
      alert('Please enter a valid positive payment amount.')
      return
    }
    if (num > max) {
      if (
        !window.confirm(
          `Payment of ${fmt(num)} exceeds current due balance ${fmt(
            max
          )}. Do you wish to proceed?`
        )
      ) {
        return
      }
    }
    onConfirm(num)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100">
        <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            <h3 className="font-bold text-sm">Receive Customer Payment</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 flex items-center justify-between">
            <div>
              <div className="font-bold text-emerald-950 text-sm">{customer.name}</div>
              <div className="text-[10px] text-emerald-700">{customer.phone || 'No phone'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                Current Due
              </div>
              <div className="text-base font-black text-rose-600 font-mono">{fmt(max)}</div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Amount Received (Rs.)</label>
              <button
                type="button"
                onClick={() => setAmount(max)}
                className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Pay Full ({fmt(max)})
              </button>
            </div>
            <input
              type="number"
              min="1"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="CASH">💵 Cash at Counter</option>
              <option value="BANK">🏛️ Bank Transfer / JazzCash / EasyPaisa</option>
              <option value="CHEQUE">📜 Bank Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Paid in full by brother"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold shadow-sm transition-all cursor-pointer"
            >
              Confirm Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdjPointsModal({ customer, onApply, onClose }) {
  const [points, setPoints] = useState(0)
  const [reason, setReason] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const num = Number(points)
    if (!num) {
      alert('Please enter non-zero points adjustment.')
      return
    }
    onApply(num, reason)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100">
        <div className="p-4 bg-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 fill-white" />
            <h3 className="font-bold text-sm">Adjust Loyalty Points</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex items-center justify-between">
            <div>
              <div className="font-bold text-amber-950 text-sm">{customer.name}</div>
              <div className="text-[10px] text-amber-700">{customer.phone || 'No phone'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                Current Points
              </div>
              <div className="text-base font-black text-amber-600 font-mono">
                ⭐ {customer.points || 0}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Points Adjustment (+ to add, − to deduct)
            </label>
            <input
              type="number"
              step="1"
              required
              placeholder="e.g. 50 or -20"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-black text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reason / Reference
            </label>
            <input
              type="text"
              placeholder="e.g. Promotional bonus, manual correction"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold shadow-sm transition-all cursor-pointer"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Customers
