import { useState, useMemo } from 'react'
import { useLocation } from 'react-router'
import {
  useDB,
  fmt,
  medicineById,
  supplierById,
  customerById,
  branchById,
  getCounters,
  getCurrentShift,
  getShiftHistory,
  todayStr,
  getStockAudits,
} from '../lib/db'
import DateFilterBar, { matchesDateFilter, useDateFilterState } from '../components/DateFilterBar'
import {
  BarChart3,
  Search,
  Printer,
  Download,
  Calendar,
  Filter,
  DollarSign,
  Package,
  TrendingUp,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
  Building2,
  Activity,
  Users,
  ChevronDown,
} from 'lucide-react'
import { getDistinctCompanies } from '../lib/medicineGroups'
import BusinessAnalyticsDashboard from '../components/BusinessAnalyticsDashboard'

const REPORT_ICONS = {
  SALES_DAILY: Calendar,
  SALES_MONTHLY: BarChart3,
  SALES_DATE_RANGE: Receipt,
  SALES_COMPANY: Building2,
  SALES_CASHIER: Users,
  SALES_MEDICINE: Package,
  SALES_CATEGORY: Filter,
  SALES_CUSTOMER: Users,
  SALES_COUNTER: Receipt,
  SALES_DAY_CLOSING: TrendingUp,
}

// All 35 Pharmacy-Specific Reports Grouped into 4 Core Categories
const REPORT_CATEGORIES = [
  {
    id: 'sales',
    name: '💵 Sales & Cashiers',
    reports: [
      { id: 'SALES_DAILY', title: 'Daily Sales Summary' },
      { id: 'SALES_MONTHLY', title: 'Monthly Sales Comparison' },
      { id: 'SALES_DATE_RANGE', title: 'Date-Wise Sales Journal' },
      { id: 'SALES_COMPANY', title: '🏢 Company-Wise Sales & Revenue' },
      { id: 'SALES_CASHIER', title: 'Cashier Performance & Sales' },
      { id: 'SALES_MEDICINE', title: 'Medicine-Wise Sales Volume' },
      { id: 'SALES_CATEGORY', title: 'Category / Form Sales' },
      { id: 'SALES_CUSTOMER', title: 'Customer Sales History' },
      { id: 'SALES_COUNTER', title: 'Counter-Wise Sales Breakdown' },
      { id: 'SALES_DAY_CLOSING', title: 'Day-End Closing & Shift Audits' },
    ],
  },
  {
    id: 'stock',
    name: '📦 Stock & Expiry',
    reports: [
      { id: 'STOCK_AUDIT_VARIANCE', title: '📋 Stock Audit Variance (Kam vs Zyada)' },
      { id: 'STOCK_COMPANY', title: '🏢 Company-Wise Stock Master' },
      { id: 'STOCK_CURRENT', title: 'Current Stock Master' },
      { id: 'STOCK_VALUATION', title: 'Stock Valuation (Cost vs Retail)' },
      { id: 'STOCK_LOW', title: 'Low Stock & Reorder Report' },
      { id: 'STOCK_EXPIRED', title: 'Expired Stock Inventory' },
      { id: 'STOCK_NEAR_EXPIRY', title: 'Near-Expiry FEFO Priority' },
      { id: 'STOCK_BATCH_MASTER', title: 'Comprehensive Batch Master' },
      { id: 'STOCK_MOVEMENT', title: 'Stock Movement Ledger' },
      { id: 'STOCK_DEAD', title: 'Dead Stock (Capital Trapped)' },
      { id: 'STOCK_FAST_MOVING', title: 'Fast-Moving Medicines (Top 20)' },
      { id: 'STOCK_SLOW_MOVING', title: 'Slow-Moving Medicines' },
      { id: 'STOCK_DAMAGED', title: 'Damaged & Returned Stock' },
    ],
  },
  {
    id: 'purchasing',
    name: '🚚 Purchases & Ledgers',
    reports: [
      { id: 'PURCHASE_ORDERS', title: '📋 Purchase Orders (Parches Orders) Ledger' },
      { id: 'PURCHASE_JOURNAL', title: 'Purchase Invoices Journal' },
      { id: 'PURCHASE_SUPPLIER', title: 'Supplier-Wise Purchases' },
      { id: 'PURCHASE_RETURNS', title: 'Purchase Returns Ledger' },
      { id: 'SALES_RETURNS', title: 'Sales Returns & Customer Refunds' },
      { id: 'SUPPLIER_DUES', title: 'Supplier Payables & Dues' },
      { id: 'CUSTOMER_DUES', title: 'Customer Receivables & Udhar' },
    ],
  },
  {
    id: 'accounting',
    name: '💰 Accounting & Profit',
    reports: [
      { id: 'PROFIT_COMPANY', title: '🏢 Company Profitability & Margins' },
      { id: 'PROFIT_MEDICINE', title: 'Profit by Medicine' },
      { id: 'PROFIT_CATEGORY', title: 'Profit by Dosage Form' },
      { id: 'PROFIT_BATCH', title: 'Batch Margin Variance' },
      { id: 'EXPIRY_LOSS', title: 'Expiry Financial Loss Report' },
      { id: 'EXPENSE_REPORT', title: 'Daily Operating Expenses' },
      { id: 'CASH_REPORT', title: 'Cash Book & Drawer Audit' },
      { id: 'BANK_REPORT', title: 'Bank / Card Receipts Ledger' },
    ],
  },
]

export default function Reports() {
  const { search } = useLocation()
  const requested = new URLSearchParams(search).get('tab')
  const section = ['analytics', 'sales', 'inventory', 'financial'].includes(requested) ? requested : 'sales'
  const [analyticsView, setAnalyticsView] = useState('gui') // 'gui' | 'tabular'

  if (section === 'analytics' && analyticsView === 'gui') {
    return (
      <BusinessAnalyticsDashboard
        onSwitchToTabular={() => setAnalyticsView('tabular')}
      />
    )
  }

  // Remount on category changes so a previous report/search cannot leak into
  // the next sidebar destination, including browser Back/Forward navigation.
  return (
    <ReportSection
      key={section}
      section={section}
      onSwitchToGui={section === 'analytics' ? () => setAnalyticsView('gui') : undefined}
    />
  )
}

const REPORT_SECTIONS = {
  analytics: {
    title: 'Business Analytics',
    description: 'Monthly trends, cashier performance, company demand and profit analysis.',
    categories: [{
      id: 'analytics', name: '📊 Business Performance',
      reports: ['SALES_MONTHLY', 'SALES_COMPANY', 'STOCK_COMPANY', 'SALES_CASHIER', 'SALES_MEDICINE', 'SALES_CATEGORY', 'PROFIT_MEDICINE', 'PROFIT_COMPANY']
        .map((id) => REPORT_CATEGORIES.flatMap((category) => category.reports).find((report) => report.id === id)),
    }],
  },
  sales: {
    title: 'Sales Reports',
    description: 'Company-wise sales, customer invoices, counter totals and day-end closing.',
    categories: REPORT_CATEGORIES.filter((category) => category.id === 'sales'),
  },
  inventory: {
    title: 'Inventory Reports',
    description: 'Company stock levels, batch expiry, valuation, movement and reorder reports.',
    categories: REPORT_CATEGORIES.filter((category) => category.id === 'stock'),
  },
  financial: {
    title: 'Financial Reports',
    description: 'Company profit margins, expenses, cash book, purchase ledgers, receivables and payables.',
    categories: ['accounting', 'purchasing'].map((id) => REPORT_CATEGORIES.find((category) => category.id === id)),
  },
}

function ReportSection({ section, onSwitchToGui }) {
  const db = useDB()
  const config = REPORT_SECTIONS[section]
  const [selectedReportId, setSelectedReportId] = useState(config.categories[0].reports[0].id)
  const [reportDateFilter, setReportDateFilter] = useDateFilterState('month')
  const [selectedCompany, setSelectedCompany] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const distinctCompanies = useMemo(() => getDistinctCompanies(db.medicines || []), [db.medicines])

  // Selected Report Metadata
  const currentReportMeta = useMemo(() => {
    for (const cat of REPORT_CATEGORIES) {
      const found = cat.reports.find((r) => r.id === selectedReportId)
      if (found) return { ...found, category: cat.name }
    }
    return { id: 'SALES_DAILY', title: 'Daily Sales Summary', category: 'Sales' }
  }, [selectedReportId])

  // Filtered Sales within period
  const periodSales = useMemo(() => {
    return (db.sales || []).filter((s) => matchesDateFilter(s.date, reportDateFilter))
  }, [db.sales, reportDateFilter])

  // Dynamic Report Calculation Engine
  const reportData = useMemo(() => {
    switch (selectedReportId) {
      case 'SALES_DAILY': {
        const byDay = {}
        let periodRev = 0
        let periodProfit = 0
        for (const s of periodSales) {
          const day = s.date.slice(0, 10)
          if (!byDay[day]) {
            byDay[day] = {
              date: day,
              invoices: 0,
              units: 0,
              revenue: 0,
              cost: 0,
              discount: 0,
              profit: 0,
            }
          }
          const units = s.items?.reduce((a, b) => a + (b.qty || 0), 0) || 0
          const cost = s.items?.reduce((a, b) => a + (b.qty * (b.cost || (b.price * 0.75))), 0) || (s.total - (s.profit || 0))
          byDay[day].invoices += 1
          byDay[day].units += units
          byDay[day].revenue += s.total
          byDay[day].cost += cost
          byDay[day].discount += s.discount || 0
          byDay[day].profit += (s.profit !== undefined ? s.profit : (s.total - cost))
          periodRev += s.total
          periodProfit += (s.profit !== undefined ? s.profit : (s.total - cost))
        }
        const rows = Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date))
        return {
          columns: [
            'Date',
            'Invoices',
            'Units Sold',
            'Sales Revenue',
            'Cost of Sales',
            'Discounts',
            'Net Profit',
            'Margin %',
            'Daily Share',
          ],
          rows: rows.map((r) => {
            const share = periodRev > 0 ? `${Math.round((r.revenue / periodRev) * 100)}%` : '0%'
            const marginPct = r.revenue > 0 ? `${Math.round((r.profit / r.revenue) * 100)}%` : '0%'
            return [
              r.date,
              r.invoices,
              r.units,
              fmt(r.revenue),
              fmt(r.cost),
              fmt(r.discount),
              fmt(r.profit),
              marginPct,
              share,
            ]
          }),
          summary: {
            'Days Recorded': rows.length,
            'Total Invoices': rows.reduce((a, b) => a + b.invoices, 0),
            'Units Sold': rows.reduce((a, b) => a + b.units, 0),
            'Total Sales Revenue': fmt(periodRev),
            'Total Net Profit': fmt(periodProfit),
          },
        }
      }

      case 'SALES_MONTHLY': {
        const byMonth = {}
        let allRev = 0
        let allProfit = 0
        for (const s of db.sales || []) {
          const month = s.date.slice(0, 7)
          if (!byMonth[month]) {
            byMonth[month] = {
              month,
              invoices: 0,
              units: 0,
              revenue: 0,
              cost: 0,
              profit: 0,
            }
          }
          const units = s.items?.reduce((a, b) => a + (b.qty || 0), 0) || 0
          const cost = s.items?.reduce((a, b) => a + (b.qty * (b.cost || (b.price * 0.75))), 0) || (s.total - (s.profit || 0))
          const profit = s.profit !== undefined ? s.profit : (s.total - cost)
          byMonth[month].invoices += 1
          byMonth[month].units += units
          byMonth[month].revenue += s.total
          byMonth[month].cost += cost
          byMonth[month].profit += profit
          allRev += s.total
          allProfit += profit
        }
        const rows = Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month))
        return {
          columns: [
            'Month',
            'Invoices',
            'Units Sold',
            'Gross Revenue',
            'Cost of Sales',
            'Net Profit',
            'Profit Margin %',
            'Revenue Share',
          ],
          rows: rows.map((r) => {
            const share = allRev > 0 ? `${Math.round((r.revenue / allRev) * 100)}%` : '0%'
            const marginPct = r.revenue > 0 ? `${Math.round((r.profit / r.revenue) * 100)}%` : '0%'
            return [
              r.month,
              r.invoices,
              r.units,
              fmt(r.revenue),
              fmt(r.cost),
              fmt(r.profit),
              marginPct,
              share,
            ]
          }),
          summary: {
            'Recorded Months': rows.length,
            'Total Invoices': rows.reduce((a, b) => a + b.invoices, 0),
            'Total Units Sold': rows.reduce((a, b) => a + b.units, 0),
            'All-Time Revenue': fmt(allRev),
            'All-Time Net Profit': fmt(allProfit),
          },
        }
      }

      case 'SALES_DATE_RANGE': {
        const rows = periodSales.slice(0, 100).map((s) => {
          const units = s.items?.reduce((a, b) => a + b.qty, 0) || 0
          const cost = s.items?.reduce((a, b) => a + (b.qty * (b.cost || (b.price * 0.75))), 0) || (s.total - (s.profit || 0))
          const profit = s.profit !== undefined ? s.profit : (s.total - cost)
          const marginPct = s.total > 0 ? `${Math.round((profit / s.total) * 100)}%` : '0%'
          return [
            s.invoiceNo,
            new Date(s.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
            s.customerId ? customerById(s.customerId)?.name || 'Member' : 'Walk-in Retail',
            s.soldByName || s.soldBy || 'Cashier',
            units,
            s.payMethod || 'CASH',
            fmt(s.total),
            fmt(cost),
            fmt(profit),
            marginPct,
          ]
        })
        const totalRev = periodSales.reduce((a, b) => a + b.total, 0)
        const totalProfit = periodSales.reduce((a, b) => a + (b.profit !== undefined ? b.profit : (b.total * 0.25)), 0)
        const totalUnits = periodSales.reduce((a, b) => a + (b.items?.reduce((x, y) => x + y.qty, 0) || 0), 0)
        return {
          columns: [
            'Invoice #',
            'Date & Time',
            'Customer',
            'Cashier',
            'Units Sold',
            'Payment Method',
            'Sales Revenue',
            'Cost of Sales',
            'Net Profit',
            'Margin %',
          ],
          rows,
          summary: {
            'Invoices in Range': periodSales.length,
            'Units Billed': totalUnits,
            'Total Revenue': fmt(totalRev),
            'Total Net Profit': fmt(totalProfit),
            'Avg Bill Size': periodSales.length > 0 ? fmt(totalRev / periodSales.length) : '0',
          },
        }
      }

      case 'SALES_COMPANY': {
        const byComp = {}
        let totalSalesRevenue = 0
        for (const s of periodSales) {
          for (const it of s.items || []) {
            const m = medicineById(it.medicineId)
            const comp = (m?.manufacturer || 'Unassigned').trim()
            if (!byComp[comp]) {
              byComp[comp] = {
                name: comp,
                invoices: new Set(),
                units: 0,
                revenue: 0,
                cost: 0,
                profit: 0,
              }
            }
            byComp[comp].invoices.add(s.id || s.invoiceNo)
            byComp[comp].units += it.qty
            const lineRev = it.qty * it.price
            const lineCost = it.qty * (it.cost || (it.price * 0.75))
            byComp[comp].revenue += lineRev
            byComp[comp].cost += lineCost
            byComp[comp].profit += (lineRev - lineCost)
            totalSalesRevenue += lineRev
          }
        }

        const rows = Object.values(byComp).sort((a, b) => b.revenue - a.revenue)
        return {
          columns: [
            'Pharma Company',
            'Invoices',
            'Units Sold',
            'Sales Revenue',
            'Cost of Sales',
            'Gross Profit',
            'Margin %',
            'Revenue Share',
          ],
          rows: rows.map((r) => {
            const share = totalSalesRevenue > 0 ? `${Math.round((r.revenue / totalSalesRevenue) * 100)}%` : '0%'
            const marginPct = r.revenue > 0 ? `${Math.round((r.profit / r.revenue) * 100)}%` : '0%'
            return [
              r.name,
              r.invoices.size,
              r.units,
              fmt(r.revenue),
              fmt(r.cost),
              fmt(r.profit),
              marginPct,
              share,
            ]
          }),
          summary: {
            'Companies with Sales': rows.length,
            'Total Company Revenue': fmt(totalSalesRevenue),
            'Total Gross Profit': fmt(rows.reduce((a, b) => a + b.profit, 0)),
            'Top Selling Company': rows[0]?.name || 'None',
          },
        }
      }

      case 'SALES_CASHIER': {
        const byCashier = {}
        let totalCashierRev = 0
        for (const s of periodSales) {
          const name = s.soldByName || s.soldBy || 'Cashier'
          if (!byCashier[name]) byCashier[name] = { name, count: 0, items: 0, revenue: 0, cost: 0, profit: 0 }
          const units = s.items?.reduce((a, b) => a + (b.qty || 0), 0) || 0
          const cost = s.items?.reduce((a, b) => a + (b.qty * (b.cost || (b.price * 0.75))), 0) || (s.total - (s.profit || 0))
          byCashier[name].count += 1
          byCashier[name].items += units
          byCashier[name].revenue += s.total
          byCashier[name].cost += cost
          byCashier[name].profit += (s.profit !== undefined ? s.profit : (s.total - cost))
          totalCashierRev += s.total
        }
        const rows = Object.values(byCashier).sort((a, b) => b.revenue - a.revenue)
        return {
          columns: [
            'Cashier Name',
            'Invoices',
            'Units Sold',
            'Sales Revenue',
            'Cost of Sales',
            'Profit Contribution',
            'Margin %',
            'Sales Share',
          ],
          rows: rows.map((r) => {
            const share = totalCashierRev > 0 ? `${Math.round((r.revenue / totalCashierRev) * 100)}%` : '0%'
            const marginPct = r.revenue > 0 ? `${Math.round((r.profit / r.revenue) * 100)}%` : '0%'
            return [
              r.name,
              r.count,
              r.items,
              fmt(r.revenue),
              fmt(r.cost),
              fmt(r.profit),
              marginPct,
              share,
            ]
          }),
          summary: {
            'Active Cashiers': rows.length,
            'Total Invoices Billed': rows.reduce((a, b) => a + b.count, 0),
            'Total Cashier Revenue': fmt(totalCashierRev),
            'Total Cashier Profit': fmt(rows.reduce((a, b) => a + b.profit, 0)),
            'Top Cashier': rows[0]?.name || 'None',
          },
        }
      }

      case 'SALES_MEDICINE': {
        const byMed = {}
        let totalMedRev = 0
        for (const s of periodSales) {
          for (const it of s.items || []) {
            const m = medicineById(it.medicineId)
            const name = m ? `${m.name} ${m.strength}` : 'Unknown Medicine'
            const comp = (m?.manufacturer || 'Unassigned').trim()
            if (!byMed[name]) {
              byMed[name] = {
                name,
                company: comp,
                invoices: new Set(),
                qty: 0,
                revenue: 0,
                cost: 0,
                profit: 0,
              }
            }
            byMed[name].invoices.add(s.id || s.invoiceNo)
            byMed[name].qty += it.qty
            const lineRev = it.qty * it.price
            const lineCost = it.qty * (it.cost || (it.price * 0.75))
            byMed[name].revenue += lineRev
            byMed[name].cost += lineCost
            byMed[name].profit += (lineRev - lineCost)
            totalMedRev += lineRev
          }
        }
        const rows = Object.values(byMed).sort((a, b) => b.qty - a.qty)
        return {
          columns: [
            'Medicine Name',
            'Company',
            'Invoices',
            'Units Sold',
            'Sales Revenue',
            'Cost of Sales',
            'Gross Profit',
            'Margin %',
            'Volume Share',
          ],
          rows: rows.map((r) => {
            const share = totalMedRev > 0 ? `${Math.round((r.revenue / totalMedRev) * 100)}%` : '0%'
            const marginPct = r.revenue > 0 ? `${Math.round((r.profit / r.revenue) * 100)}%` : '0%'
            return [
              r.name,
              r.company,
              r.invoices.size,
              r.qty,
              fmt(r.revenue),
              fmt(r.cost),
              fmt(r.profit),
              marginPct,
              share,
            ]
          }),
          summary: {
            'Unique Medicines Sold': rows.length,
            'Total Units Sold': rows.reduce((a, b) => a + b.qty, 0),
            'Total Medicine Revenue': fmt(totalMedRev),
            'Total Gross Profit': fmt(rows.reduce((a, b) => a + b.profit, 0)),
            'Top Selling Medicine': rows[0]?.name || 'None',
          },
        }
      }

      case 'SALES_CATEGORY': {
        const byForm = {}
        for (const s of periodSales) {
          for (const it of s.items || []) {
            const m = medicineById(it.medicineId)
            const form = m?.dosageForm || m?.form || 'Other'
            if (!byForm[form]) byForm[form] = { form, qty: 0, revenue: 0 }
            byForm[form].qty += it.qty
            byForm[form].revenue += it.qty * it.price
          }
        }
        const rows = Object.values(byForm).sort((a, b) => b.revenue - a.revenue)
        return {
          columns: ['Dosage Form / Category', 'Units Sold', 'Total Revenue', 'Market Share'],
          rows: rows.map((r) => {
            const totalRev = rows.reduce((a, b) => a + b.revenue, 0) || 1
            const share = Math.round((r.revenue / totalRev) * 100)
            return [r.form, r.qty, fmt(r.revenue), `${share}%`]
          }),
          summary: {
            'Categories Count': rows.length,
            'Total Category Revenue': fmt(rows.reduce((a, b) => a + b.revenue, 0)),
          },
        }
      }

      case 'SALES_CUSTOMER': {
        const byCust = {}
        for (const s of periodSales) {
          const custName = s.customerId ? customerById(s.customerId)?.name || 'Member' : 'Walk-in Retail'
          if (!byCust[custName]) byCust[custName] = { name: custName, count: 0, revenue: 0 }
          byCust[custName].count += 1
          byCust[custName].revenue += s.total
        }
        const rows = Object.values(byCust).sort((a, b) => b.revenue - a.revenue)
        return {
          columns: ['Customer', 'Invoices', 'Total Billed'],
          rows: rows.map((r) => [r.name, r.count, fmt(r.revenue)]),
          summary: {
            'Customer Groups': rows.length,
          },
        }
      }

      case 'SALES_COUNTER': {
        const counters = getCounters()
        const byCounter = {}
        for (const c of counters) byCounter[c.id] = { name: c.name, count: 0, revenue: 0 }
        for (const s of periodSales) {
          const cid = s.counterId || 'counter-1'
          if (!byCounter[cid]) byCounter[cid] = { name: `Counter (${cid})`, count: 0, revenue: 0 }
          byCounter[cid].count += 1
          byCounter[cid].revenue += s.total
        }
        const rows = Object.values(byCounter)
        return {
          columns: ['POS Counter Station', 'Invoices Billed', 'Total Revenue'],
          rows: rows.map((r) => [r.name, r.count, fmt(r.revenue)]),
          summary: {
            'Active Counters': rows.length,
            'Total Revenue': fmt(rows.reduce((a, b) => a + b.revenue, 0)),
          },
        }
      }

      case 'SALES_DAY_CLOSING': {
        const shifts = getShiftHistory()
        return {
          columns: ['Shift #', 'Counter', 'Cashier', 'Opened', 'Closed', 'Opening Float', 'Cash Sales', 'Expected', 'Declared', 'Variance'],
          rows: shifts.map((s) => [
            s.shiftNo,
            s.counterName,
            s.cashierName,
            new Date(s.openedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
            s.closedAt ? new Date(s.closedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'ACTIVE',
            fmt(s.openingCash),
            fmt(s.cashSales),
            fmt(s.closingCashCalculated),
            s.closingCashDeclared !== null ? fmt(s.closingCashDeclared) : '—',
            s.closingCashDeclared !== null ? `${s.difference > 0 ? '+' : ''}${fmt(s.difference)}` : '—',
          ]),
          summary: {
            'Recorded Shifts': shifts.length,
            'Currently Open': shifts.filter((s) => s.status === 'OPEN').length,
          },
        }
      }

      case 'STOCK_AUDIT_VARIANCE': {
        const audits = db.stockAudits || []
        if (audits.length > 0) {
          const latestAudit = audits[audits.length - 1]
          const rows = (latestAudit.items || []).map((it) => {
            const isKam = it.variance < 0
            const isZyada = it.variance > 0
            const status = isKam
              ? `🔻 -${Math.abs(it.variance)} KAM (Shortage)`
              : isZyada
              ? `🔺 +${it.variance} ZYADA (Surplus)`
              : '✓ MATCHED'
            const costImpact = Math.abs(it.variance) * (Number(it.costPrice) || 0)
            return [
              it.medicineName || medicineById(it.medicineId)?.name || 'Medicine',
              it.systemStock,
              it.physicalStock,
              status,
              fmt(it.costPrice || 0),
              `${isKam ? '-' : isZyada ? '+' : ''}${fmt(costImpact)}`,
              it.note || (isKam ? 'Deficit / Shortage' : isZyada ? 'Surplus Found' : 'Physical Matches System'),
            ]
          })
          return {
            columns: [
              'Medicine Name',
              'System Recorded Stock',
              'Physical Count',
              'Audit Variance (Shortage / Surplus)',
              'Unit Cost Price',
              'Discrepancy Valuation',
              'Remarks / Notes',
            ],
            rows,
            summary: {
              'Audit Report': `${latestAudit.auditNo} — ${latestAudit.title || 'Physical Stock Audit'}`,
              'Auditor Name': latestAudit.auditor || 'Pharmacist',
              'Shortage Medicines (Deficit)': `${latestAudit.kamCount || 0} items (-${latestAudit.totalKamUnits || 0} units)`,
              'Surplus Medicines (Excess)': `${latestAudit.zyadaCount || 0} items (+${latestAudit.totalZyadaUnits || 0} units)`,
              'Total Financial Shortage': fmt(latestAudit.totalKamCost || 0),
              'Stock Reconciled': latestAudit.reconciled ? 'YES (Adjusted in System)' : 'NO (Audit Log Only)',
              'Purchase Order': latestAudit.poNo ? `Auto-Generated (${latestAudit.poNo})` : 'None Generated',
            },
          }
        } else {
          // No formal audit logged yet: show system stock vs target minStock
          const rows = (db.medicines || []).map((m) => {
            const batches = (db.batches || []).filter((b) => b.medicineId === m.id)
            const currentStock = batches.reduce((a, b) => a + b.qty, 0)
            const minStock = m.minStock || 15
            const diff = currentStock - minStock
            return [
              `${m.name} ${m.strength || ''}`,
              currentStock,
              minStock,
              diff < 0 ? `🔻 ${Math.abs(diff)} Below Target` : `🔺 +${diff} Above Target`,
              fmt(m.purchasePrice || Math.round(m.salePrice * 0.75)),
              diff < 0 ? `-${fmt(Math.abs(diff) * (m.purchasePrice || Math.round(m.salePrice * 0.75)))}` : `+${fmt(diff * (m.purchasePrice || Math.round(m.salePrice * 0.75)))}`,
              'Physical Audit Pending (Target Safety Comparison Shown)',
            ]
          })
          return {
            columns: [
              'Medicine Name',
              'Current System Stock',
              'Safety Target Stock',
              'Target Variance (Shortage / Surplus)',
              'Unit Cost Price',
              'Target Valuation Difference',
              'Audit Status',
            ],
            rows,
            summary: {
              'Audit Status': 'No physical stock audit recorded yet',
              'Action Needed': 'Perform a physical stock count in Stock Audit & Count dashboard',
            },
          }
        }
      }

      case 'STOCK_COMPANY': {
        const byComp = {}
        const now = new Date()
        const nearExpiryCutoff = new Date(now.getTime() + 90 * 86400000)

        for (const m of (db.medicines || [])) {
          const comp = (m.manufacturer || 'Unassigned').trim()
          if (!byComp[comp]) {
            byComp[comp] = {
              name: comp,
              products: 0,
              batches: 0,
              stock: 0,
              costVal: 0,
              retailVal: 0,
              lowStockCount: 0,
              nearExpiryCount: 0,
            }
          }
          byComp[comp].products += 1

          const mBatches = (db.batches || []).filter((b) => b.medicineId === m.id)
          const mStock = mBatches.reduce((a, b) => a + b.qty, 0)
          byComp[comp].batches += mBatches.length
          byComp[comp].stock += mStock
          if (mStock <= (m.minStock || 10)) {
            byComp[comp].lowStockCount += 1
          }

          for (const b of mBatches) {
            byComp[comp].costVal += b.qty * (b.purchasePrice || m.purchasePrice || 0)
            byComp[comp].retailVal += b.qty * (b.salePrice || m.salePrice || 0)
            const exp = new Date(b.expiry)
            if (exp > now && exp <= nearExpiryCutoff && b.qty > 0) {
              byComp[comp].nearExpiryCount += 1
            }
          }
        }

        const rows = Object.values(byComp).sort((a, b) => b.retailVal - a.retailVal)
        const totalCostAll = rows.reduce((a, b) => a + b.costVal, 0)
        const totalRetailAll = rows.reduce((a, b) => a + b.retailVal, 0)
        const totalStockUnits = rows.reduce((a, b) => a + b.stock, 0)

        return {
          columns: [
            'Pharma Company',
            'Products',
            'Batches',
            'In-Stock Units',
            'Cost Valuation',
            'Retail Valuation',
            'Potential Margin',
            'Margin %',
            'Low Stock',
            'Near Expiry',
          ],
          rows: rows.map((r) => {
            const margin = r.retailVal - r.costVal
            const marginPct = r.retailVal > 0 ? `${Math.round((margin / r.retailVal) * 100)}%` : '0%'
            return [
              r.name,
              r.products,
              r.batches,
              r.stock,
              fmt(r.costVal),
              fmt(r.retailVal),
              fmt(margin),
              marginPct,
              r.lowStockCount > 0 ? `⚠️ ${r.lowStockCount} items` : '✓ OK',
              r.nearExpiryCount > 0 ? `⏰ ${r.nearExpiryCount} batches` : '—',
            ]
          }),
          summary: {
            'Companies Registered': rows.length,
            'Total Stock Units': totalStockUnits,
            'Total Cost Valuation': fmt(totalCostAll),
            'Total Retail Valuation': fmt(totalRetailAll),
            'Potential Gross Profit': fmt(totalRetailAll - totalCostAll),
          },
        }
      }

      case 'STOCK_CURRENT': {
        const rows = (db.medicines || []).map((m) => {
          const qty = (db.batches || []).filter((b) => b.medicineId === m.id).reduce((a, b) => a + b.qty, 0)
          return [
            `${m.name} ${m.strength}`,
            m.generic || '—',
            m.dosageForm || m.form,
            m.manufacturer || '—',
            qty,
            fmt(m.salePrice),
            fmt(qty * m.salePrice),
            qty <= (m.minStock || 10) ? '⚠️ LOW STOCK' : '✓ OK',
          ]
        })
        return {
          columns: ['Medicine', 'Generic Formula', 'Form', 'Manufacturer', 'Stock Qty', 'Unit Price', 'Stock Valuation', 'Status'],
          rows,
          summary: {
            'Total Medicines': (db.medicines || []).length,
            'Total Units in Stock': (db.batches || []).reduce((a, b) => a + b.qty, 0),
          },
        }
      }

      case 'STOCK_VALUATION': {
        let totalCost = 0, totalRetail = 0
        const rows = (db.medicines || []).map((m) => {
          const batches = (db.batches || []).filter((b) => b.medicineId === m.id)
          const qty = batches.reduce((a, b) => a + b.qty, 0)
          const costVal = batches.reduce((a, b) => a + b.qty * b.purchasePrice, 0)
          const retailVal = batches.reduce((a, b) => a + b.qty * (b.salePrice || m.salePrice), 0)
          totalCost += costVal
          totalRetail += retailVal
          return [
            `${m.name} ${m.strength}`,
            qty,
            fmt(costVal),
            fmt(retailVal),
            fmt(retailVal - costVal),
            retailVal > 0 ? `${Math.round(((retailVal - costVal) / retailVal) * 100)}%` : '0%',
          ]
        })
        return {
          columns: ['Medicine', 'Stock Qty', 'Valuation at Purchase Cost', 'Valuation at Retail Price', 'Potential Gross Margin', 'Margin %'],
          rows,
          summary: {
            'Total Purchase Cost': fmt(totalCost),
            'Total Retail Value': fmt(totalRetail),
            'Potential Profit': fmt(totalRetail - totalCost),
          },
        }
      }

      case 'STOCK_LOW': {
        const rows = (db.medicines || [])
          .map((m) => {
            const stock = (db.batches || []).filter((b) => b.medicineId === m.id).reduce((a, b) => a + b.qty, 0)
            const min = m.minStock || 15
            return { m, stock, min, deficit: Math.max(0, min * 2 - stock) }
          })
          .filter((x) => x.stock <= x.min)
          .map((x) => [
            `${x.m.name} ${x.m.strength}`,
            x.m.dosageForm || x.m.form,
            x.stock,
            x.min,
            `+${x.deficit} units`,
            'CRITICAL REORDER',
          ])
        return {
          columns: ['Medicine', 'Dosage Form', 'Current Stock', 'Safety Reorder Point', 'Recommended Order', 'Urgency'],
          rows,
          summary: {
            'Shortage Items': rows.length,
          },
        }
      }

      case 'STOCK_EXPIRED': {
        const now = new Date()
        const expiredBatches = (db.batches || []).filter((b) => new Date(b.expiry) < now && b.qty > 0)
        const rows = expiredBatches.map((b) => {
          const m = medicineById(b.medicineId)
          return [
            m ? `${m.name} ${m.strength}` : 'Unknown',
            b.batchNo,
            b.expiry,
            b.qty,
            fmt(b.purchasePrice),
            fmt(b.qty * b.purchasePrice),
            'EXPIRED (QUARANTINE)',
          ]
        })
        return {
          columns: ['Medicine', 'Batch #', 'Expiry Date', 'Expired Units', 'Purchase Cost / Unit', 'Total Financial Loss', 'Status'],
          rows,
          summary: {
            'Expired Batches': rows.length,
            'Total Financial Loss': fmt(expiredBatches.reduce((a, b) => a + b.qty * b.purchasePrice, 0)),
          },
        }
      }

      case 'STOCK_NEAR_EXPIRY': {
        const now = new Date()
        const in90Days = new Date(Date.now() + 90 * 86400000)
        const nearBatches = (db.batches || [])
          .filter((b) => new Date(b.expiry) >= now && new Date(b.expiry) <= in90Days && b.qty > 0)
          .sort((a, b) => a.expiry.localeCompare(b.expiry))
        const rows = nearBatches.map((b) => {
          const m = medicineById(b.medicineId)
          const daysLeft = Math.ceil((new Date(b.expiry) - now) / 86400000)
          return [
            m ? `${m.name} ${m.strength}` : 'Unknown',
            b.batchNo,
            b.expiry,
            `${daysLeft} days`,
            b.qty,
            fmt(b.qty * b.salePrice),
            daysLeft <= 30 ? '🔴 URGENT FEFO' : daysLeft <= 60 ? '🟠 MODERATE' : '🟡 WATCHLIST',
          ]
        })
        return {
          columns: ['Medicine', 'Batch #', 'Expiry Date', 'Days Remaining', 'Units in Stock', 'Retail Exposure', 'FEFO Priority'],
          rows,
          summary: {
            'Near-Expiry Batches': rows.length,
            'Stock at Risk': fmt(nearBatches.reduce((a, b) => a + b.qty * b.salePrice, 0)),
          },
        }
      }

      case 'STOCK_BATCH_MASTER': {
        const rows = (db.batches || []).map((b) => {
          const m = medicineById(b.medicineId)
          return [
            b.batchNo,
            m ? `${m.name} ${m.strength}` : 'Unknown',
            b.mfgDate || '2024-01-01',
            b.expiry,
            b.qty,
            fmt(b.purchasePrice),
            fmt(b.salePrice),
            b.status || (new Date(b.expiry) < new Date() ? 'EXPIRED' : 'ACTIVE'),
            supplierById(b.supplierId)?.name || 'Distributor',
          ]
        })
        return {
          columns: ['Batch #', 'Medicine', 'Mfg Date', 'Expiry Date', 'Qty', 'Cost Price', 'Retail Price', 'Status', 'Supplier'],
          rows,
          summary: {
            'Total Batches': (db.batches || []).length,
          },
        }
      }

      case 'PURCHASE_ORDERS': {
        const orders = db.purchaseOrders || []
        const rows = [...orders].reverse().map((po) => {
          const sup = supplierById(po.supplierId)
          const totalQty = (po.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0)
          const totalCost = po.totalEstimatedCost || (po.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0)
          return [
            po.poNo,
            po.date || todayStr(),
            sup ? `${sup.name} (${sup.company || 'Distributor'})` : 'General Supplier',
            po.source === 'AUDIT' ? '📋 Stock Audit Deficit' : 'Manual PO',
            `${po.items?.length || 0} items (${totalQty} units)`,
            fmt(totalCost),
            po.status || 'DRAFT',
            po.note || '—',
          ]
        })
        return {
          columns: [
            'PO Number',
            'Order Date',
            'Supplier / Distributor',
            'Source / Origin',
            'Items & Units',
            'Estimated Total Payable',
            'Order Status',
            'Remarks / Notes',
          ],
          rows,
          summary: {
            'Total POs Created': orders.length,
            'Draft POs': orders.filter((p) => p.status === 'DRAFT').length,
            'Sent to Suppliers': orders.filter((p) => p.status === 'SENT').length,
            'Received & Stocked': orders.filter((p) => p.status === 'RECEIVED').length,
            'Total Demand Valuation': fmt(orders.reduce((s, p) => s + (p.totalEstimatedCost || 0), 0)),
          },
        }
      }

      case 'PURCHASE_JOURNAL': {
        const rows = (db.purchases || []).map((p) => {
          const taxes = (Number(p.gstAmount) || 0) + (Number(p.advanceTaxAmount) || 0) + (Number(p.otherTax) || 0)
          const gross = p.subtotal || p.total
          return [
            p.grnNo || '—',
            p.invoiceNo,
            p.date,
            supplierById(p.supplierId)?.name || 'Supplier',
            p.items?.length || 0,
            fmt(gross),
            fmt(p.discountAmount || 0),
            fmt(taxes),
            fmt(p.total),
            fmt(p.paid || 0),
            fmt(p.due !== undefined ? p.due : (p.total - (p.paid || 0))),
          ]
        })
        return {
          columns: ['GRN #', 'Invoice #', 'Date', 'Supplier', 'Items', 'Gross Subtotal', 'Discount', 'GST & Taxes', 'Net Total', 'Paid / Adv.', 'Balance Due'],
          rows,
          summary: {
            'Total GRNs / Invoices': (db.purchases || []).length,
            'Total Net Purchases': fmt((db.purchases || []).reduce((a, b) => a + (b.total || 0), 0)),
            'Total GST & Taxes Paid': fmt((db.purchases || []).reduce((a, b) => a + (Number(b.gstAmount) || 0) + (Number(b.advanceTaxAmount) || 0) + (Number(b.otherTax) || 0), 0)),
            'Total Discounts Availed': fmt((db.purchases || []).reduce((a, b) => a + (Number(b.discountAmount) || 0), 0)),
          },
        }
      }

      case 'PURCHASE_RETURNS': {
        const returns = db.purchaseReturns || []
        const rows = []
        for (const pr of [...returns].reverse()) {
          const sup = supplierById(pr.supplierId)
          for (const it of pr.items || []) {
            rows.push([
              pr.returnNo,
              pr.date || todayStr(),
              sup ? `${sup.name} (${sup.company || 'Distributor'})` : pr.supplierName || 'Distributor',
              it.medicineName || medicineById(it.medicineId)?.name || 'Medicine',
              it.batchNo || '—',
              it.qty,
              fmt(it.purchasePrice || 0),
              fmt(it.total || (it.qty * (it.purchasePrice || 0))),
              it.reason === 'EXPIRED' ? '⏰ Expired Stock' :
              it.reason === 'NEAR_EXPIRY' ? '⌛ Near Expiry' :
              it.reason === 'DAMAGED' ? '💥 Damaged Goods' :
              it.reason === 'WRONG_ITEM' ? '❌ Wrong Delivery' :
              it.reason === 'OVER_STOCKED' ? '📦 Excess Stock' : 'Return Claim',
              pr.settlementType === 'CREDIT_NOTE' ? 'Debit Note (Balance Adjusted)' : 'Cash Refunded',
            ])
          }
        }
        const totalRefund = returns.reduce((a, b) => a + (b.totalAmount || 0), 0)
        const totalUnits = returns.reduce((a, b) => a + (b.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0), 0)
        return {
          columns: [
            'Return #',
            'Date',
            'Supplier / Distributor',
            'Medicine Name',
            'Batch #',
            'Qty Returned',
            'Purchase Rate',
            'Total Value',
            'Reason',
            'Settlement Mode',
          ],
          rows,
          summary: {
            'Return Vouchers': returns.length,
            'Total Units Returned': totalUnits,
            'Total Amount Claimed': fmt(totalRefund),
            'Debit Notes Issued': returns.filter((r) => r.settlementType === 'CREDIT_NOTE').length,
            'Cash Refunds Received': returns.filter((r) => r.settlementType === 'CASH_REFUND').length,
          },
        }
      }

      case 'SUPPLIER_DUES': {
        const rows = (db.suppliers || [])
          .filter((s) => (s.balance || 0) > 0)
          .map((s) => [s.name, s.company || '—', s.phone || '—', fmt(s.balance), 'PAYABLE DUE'])
        return {
          columns: ['Supplier Name', 'Company', 'Phone', 'Outstanding Payable', 'Status'],
          rows,
          summary: {
            'Suppliers with Dues': rows.length,
            'Total Payables': fmt((db.suppliers || []).reduce((a, b) => a + (b.balance || 0), 0)),
          },
        }
      }

      case 'CUSTOMER_DUES': {
        const rows = (db.customers || [])
          .filter((c) => (c.balance || 0) > 0)
          .map((c) => [c.name, c.phone || '—', fmt(c.creditLimit || 0), fmt(c.balance), 'OVERDUE CREDIT'])
        return {
          columns: ['Customer Name', 'Phone', 'Credit Limit', 'Outstanding Debt', 'Status'],
          rows,
          summary: {
            'Debtor Customers': rows.length,
            'Total Receivables': fmt((db.customers || []).reduce((a, b) => a + (b.balance || 0), 0)),
          },
        }
      }

      case 'PROFIT_COMPANY': {
        const byComp = {}
        const topMedByComp = {}

        for (const s of periodSales) {
          for (const it of s.items || []) {
            const m = medicineById(it.medicineId)
            const comp = (m?.manufacturer || 'Unassigned').trim()
            const medName = m ? `${m.name} ${m.strength}` : 'Unknown'
            if (!byComp[comp]) {
              byComp[comp] = { name: comp, units: 0, revenue: 0, cost: 0, profit: 0 }
              topMedByComp[comp] = {}
            }
            byComp[comp].units += it.qty
            const lineRev = it.qty * it.price
            const lineCost = it.qty * (it.cost || (it.price * 0.75))
            byComp[comp].revenue += lineRev
            byComp[comp].cost += lineCost
            byComp[comp].profit += (lineRev - lineCost)
            topMedByComp[comp][medName] = (topMedByComp[comp][medName] || 0) + lineRev
          }
        }

        const rows = Object.values(byComp).sort((a, b) => b.profit - a.profit)
        return {
          columns: [
            'Pharma Company',
            'Best Selling Product',
            'Units Sold',
            'Revenue',
            'Cost (COGS)',
            'Gross Profit',
            'Margin %',
            'ROI / Markup %',
          ],
          rows: rows.map((r) => {
            const marginPct = r.revenue > 0 ? `${Math.round((r.profit / r.revenue) * 100)}%` : '0%'
            const roiPct = r.cost > 0 ? `${Math.round((r.profit / r.cost) * 100)}%` : '0%'
            const topMeds = Object.entries(topMedByComp[r.name] || {}).sort((a, b) => b[1] - a[1])
            const topMedName = topMeds[0] ? topMeds[0][0] : '—'
            return [
              r.name,
              topMedName,
              r.units,
              fmt(r.revenue),
              fmt(r.cost),
              fmt(r.profit),
              marginPct,
              roiPct,
            ]
          }),
          summary: {
            'Top Performing Company': rows[0]?.name || 'None',
            'Total Gross Profit': fmt(rows.reduce((a, b) => a + b.profit, 0)),
            'Average Margin': rows.length > 0 ? `${Math.round(rows.reduce((a, b) => a + (b.revenue > 0 ? (b.profit / b.revenue) * 100 : 0), 0) / rows.length)}%` : '0%',
          },
        }
      }

      case 'PROFIT_MEDICINE': {
        const byMed = {}
        for (const s of periodSales) {
          for (const it of s.items || []) {
            const m = medicineById(it.medicineId)
            const name = m ? `${m.name} ${m.strength}` : 'Unknown'
            if (!byMed[name]) byMed[name] = { name, revenue: 0, cost: 0, profit: 0 }
            const rev = it.qty * it.price
            const cst = it.qty * (it.cost || it.price * 0.75)
            byMed[name].revenue += rev
            byMed[name].cost += cst
            byMed[name].profit += (rev - cst)
          }
        }
        const rows = Object.values(byMed).sort((a, b) => b.profit - a.profit)
        return {
          columns: ['Medicine', 'Gross Revenue', 'Cost of Goods', 'Net Profit Margin', 'Margin %'],
          rows: rows.map((r) => [
            r.name,
            fmt(r.revenue),
            fmt(r.cost),
            fmt(r.profit),
            r.revenue > 0 ? `${Math.round((r.profit / r.revenue) * 100)}%` : '0%',
          ]),
          summary: {
            'Total Profit from Medicines': fmt(rows.reduce((a, b) => a + b.profit, 0)),
          },
        }
      }

      case 'EXPENSE_REPORT': {
        const rows = (db.expenses || []).map((e) => [
          e.date,
          e.category,
          e.note || 'General expense',
          fmt(e.amount),
        ])
        return {
          columns: ['Date', 'Expense Category', 'Description / Note', 'Amount Paid'],
          rows,
          summary: {
            'Total Expenses Count': (db.expenses || []).length,
            'Total Operating Expenses': fmt((db.expenses || []).reduce((a, b) => a + b.amount, 0)),
          },
        }
      }

      case 'CASH_REPORT': {
        const shifts = getShiftHistory()
        return {
          columns: ['Shift ID', 'Counter', 'Opened At', 'Opening Cash', 'Cash Sales', 'Expenses Paid', 'Expected In Drawer', 'Declared Cash', 'Status'],
          rows: shifts.map((s) => [
            s.shiftNo,
            s.counterName,
            new Date(s.openedAt).toLocaleDateString(),
            fmt(s.openingCash),
            fmt(s.cashSales),
            fmt(s.expenses),
            fmt(s.closingCashCalculated),
            s.closingCashDeclared !== null ? fmt(s.closingCashDeclared) : '—',
            s.status,
          ]),
          summary: {
            'Shifts Recorded': shifts.length,
          },
        }
      }

      default: {
        // Fallback generic tabular representation
        const rows = periodSales.slice(0, 50).map((s) => [
          s.invoiceNo,
          s.date.slice(0, 10),
          s.soldByName || 'Cashier',
          fmt(s.total),
          fmt(s.profit || 0),
        ])
        return {
          columns: ['Invoice #', 'Date', 'Cashier', 'Revenue', 'Profit'],
          rows,
          summary: {
            'Records Count': rows.length,
          },
        }
      }
    }
  }, [selectedReportId, periodSales, db])

  // Filtered Rows by user search term & company
  const displayRows = useMemo(() => {
    let rows = reportData.rows
    if (selectedCompany && selectedCompany !== 'ALL') {
      const compLower = selectedCompany.toLowerCase()
      rows = rows.filter((row) =>
        row.some((cell) => String(cell).toLowerCase().includes(compLower))
      )
    }
    if (!searchTerm.trim()) return rows
    const q = searchTerm.toLowerCase()
    return rows.filter((row) =>
      row.some((cell) => String(cell).toLowerCase().includes(q))
    )
  }, [reportData.rows, searchTerm, selectedCompany])

  function handleExportCSV() {
    const header = reportData.columns.join(',')
    const rows = displayRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    const compTag = selectedCompany !== 'ALL' ? `_${selectedCompany.replace(/[^a-zA-Z0-9]/g, '_')}` : ''
    link.setAttribute('download', `${selectedReportId}${compTag}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const summaryEntries = Object.entries(reportData.summary || {})
  const summaryIcons = [Receipt, DollarSign, TrendingUp, Package]
  const allReports = useMemo(() => config.categories.flatMap((category) => category.reports), [config.categories])

  const { primaryReports, secondaryReports } = useMemo(() => {
    if (section === 'sales') {
      const primaryOrder = [
        'SALES_DAILY',
        'SALES_MONTHLY',
        'SALES_DATE_RANGE',
        'SALES_COMPANY',
        'SALES_CASHIER',
        'SALES_MEDICINE',
      ]
      const prim = []
      for (const id of primaryOrder) {
        const found = allReports.find((r) => r.id === id)
        if (found) prim.push(found)
      }
      const sec = allReports.filter((r) => !primaryOrder.includes(r.id))
      return { primaryReports: prim, secondaryReports: sec }
    }
    return {
      primaryReports: allReports.slice(0, 6),
      secondaryReports: allReports.slice(6),
    }
  }, [allReports, section])

  return (
    <div className="space-y-4 w-full pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1 py-1">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{config.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSwitchToGui && (
            <button
              type="button"
              onClick={onSwitchToGui}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-[#714B67]" /> Graphs
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => window.print()}
            className="bg-[#3b1734] hover:bg-[#280c23] text-white px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {/* KPI Cards (same simple style as Business Analytics) */}
      {summaryEntries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summaryEntries.slice(0, 4).map(([label, val], idx) => {
            const Icon = summaryIcons[idx] || Receipt
            return (
              <div key={label} className="bg-white px-4 py-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">{label}</span>
                </div>
                <div className="mt-1.5 text-xl font-bold text-slate-900 truncate">{val}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Reports Navigation Menu Bar ── */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-0.5">
          {primaryReports.map((r) => {
            const Icon = REPORT_ICONS[r.id] || FileSpreadsheet
            const active = selectedReportId === r.id
            return (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedReportId(r.id)
                  setSearchTerm('')
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#3b1734] text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#714B67]'}`} />
                <span>{r.title}</span>
              </button>
            )
          })}

          {secondaryReports.length > 0 && (
            <div className="relative shrink-0">
              <select
                value={secondaryReports.some((r) => r.id === selectedReportId) ? selectedReportId : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedReportId(e.target.value)
                    setSearchTerm('')
                  }
                }}
                className={`appearance-none bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-3.5 py-2 pr-7 text-xs font-bold outline-none cursor-pointer ${
                  secondaryReports.some((r) => r.id === selectedReportId)
                    ? 'bg-[#3b1734] text-white border-[#3b1734]'
                    : ''
                }`}
              >
                <option value="" disabled className="text-slate-500 bg-white">
                  More Reports ▾
                </option>
                {secondaryReports.map((r) => (
                  <option key={r.id} value={r.id} className="text-slate-800 bg-white">
                    {r.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
            </div>
          )}
        </div>
      </div>

      {/* Toolbar Card: filters & search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2.5">
        <DateFilterBar
          filterState={reportDateFilter}
          onChange={setReportDateFilter}
          asDropdown
          dropdownClassName="rounded-xl py-2 px-3 text-xs bg-slate-50 border border-slate-200 font-bold text-slate-700"
        />
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <Building2 className="w-3.5 h-3.5 text-[#714B67] flex-shrink-0" />
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[180px] truncate"
            title="Filter by Pharma Company"
          >
            <option value="ALL">All Companies ({distinctCompanies.length})</option>
            {distinctCompanies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs sm:ml-auto">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search in report table..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-[#714B67]"
          />
        </div>
      </div>

      {/* Report Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-sm text-slate-800">{currentReportMeta.title}</h3>
          <span className="text-[11px] text-slate-400">{displayRows.length} rows</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                {reportData.columns.map((col, idx) => (
                  <th key={idx} className={`px-4 py-2.5 ${idx === 0 ? 'text-left' : 'text-right'}`}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                  {row.map((cell, cIdx) => {
                    const isFirst = cIdx === 0
                    const colName = reportData.columns[cIdx] || ''
                    const isProfit = colName.toLowerCase().includes('profit')
                    const isMargin = colName.toLowerCase().includes('margin') || colName.toLowerCase().includes('share')
                    const isCompany = colName.toLowerCase().includes('company')
                    const isCost = colName.toLowerCase().includes('cost')

                    return (
                      <td
                        key={cIdx}
                        className={`px-4 py-2.5 ${
                          isFirst
                            ? 'text-left font-bold text-slate-900 text-xs'
                            : 'text-right text-slate-700'
                        }`}
                      >
                        {isCompany && !isFirst ? (
                          <span className="px-2 py-0.5 rounded bg-[#f5eef4] border border-[#decddd] text-[#714B67] font-semibold text-[11px] inline-block">
                            {cell}
                          </span>
                        ) : isProfit ? (
                          <span className="font-mono font-bold text-emerald-700">
                            {cell}
                          </span>
                        ) : isMargin ? (
                          <span className="font-semibold text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                            {cell}
                          </span>
                        ) : isCost ? (
                          <span className="font-mono text-slate-500">
                            {cell}
                          </span>
                        ) : (
                          <span className={isFirst ? '' : 'font-mono'}>{cell}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {!displayRows.length && (
                <tr>
                  <td colSpan={reportData.columns.length} className="p-8 text-center text-slate-400 font-medium">
                    No data for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
