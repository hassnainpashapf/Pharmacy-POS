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
} from 'lucide-react'
import { getDistinctCompanies } from '../lib/medicineGroups'

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
  // Remount on category changes so a previous report/search cannot leak into
  // the next sidebar destination, including browser Back/Forward navigation.
  return <ReportSection key={section} section={section} />
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

function ReportSection({ section }) {
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
        for (const s of periodSales) {
          const day = s.date.slice(0, 10)
          if (!byDay[day]) byDay[day] = { date: day, count: 0, revenue: 0, discount: 0, profit: 0 }
          byDay[day].count += 1
          byDay[day].revenue += s.total
          byDay[day].discount += s.discount || 0
          byDay[day].profit += s.profit || 0
        }
        const rows = Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date))
        return {
          columns: ['Date', 'Invoices', 'Gross Revenue', 'Discounts', 'Net Profit'],
          rows: rows.map((r) => [r.date, r.count, fmt(r.revenue), fmt(r.discount), fmt(r.profit)]),
          summary: {
            'Total Days': rows.length,
            'Total Invoices': rows.reduce((a, b) => a + b.count, 0),
            'Total Revenue': fmt(rows.reduce((a, b) => a + b.revenue, 0)),
            'Total Profit': fmt(rows.reduce((a, b) => a + b.profit, 0)),
          },
        }
      }

      case 'SALES_MONTHLY': {
        const byMonth = {}
        for (const s of db.sales || []) {
          const month = s.date.slice(0, 7)
          if (!byMonth[month]) byMonth[month] = { month, count: 0, revenue: 0, profit: 0 }
          byMonth[month].count += 1
          byMonth[month].revenue += s.total
          byMonth[month].profit += s.profit || 0
        }
        const rows = Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month))
        return {
          columns: ['Month', 'Invoices Count', 'Gross Revenue', 'Estimated Net Profit'],
          rows: rows.map((r) => [r.month, r.count, fmt(r.revenue), fmt(r.profit)]),
          summary: {
            'Recorded Months': rows.length,
            'All-Time Revenue': fmt(rows.reduce((a, b) => a + b.revenue, 0)),
          },
        }
      }

      case 'SALES_DATE_RANGE': {
        const rows = periodSales.slice(0, 100).map((s) => [
          s.invoiceNo,
          new Date(s.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          s.customerId ? customerById(s.customerId)?.name || 'Member' : 'Walk-in',
          s.soldByName || s.soldBy || 'Cashier',
          s.items?.reduce((a, b) => a + b.qty, 0) || 0,
          s.payMethod,
          fmt(s.total),
          fmt(s.profit || 0),
        ])
        return {
          columns: ['Invoice #', 'Date & Time', 'Customer', 'Cashier', 'Units', 'Payment', 'Total', 'Profit'],
          rows,
          summary: {
            'Invoices in Range': periodSales.length,
            'Total Revenue': fmt(periodSales.reduce((a, b) => a + b.total, 0)),
            'Total Profit': fmt(periodSales.reduce((a, b) => a + (b.profit || 0), 0)),
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
        for (const s of periodSales) {
          const name = s.soldByName || s.soldBy || 'Cashier'
          if (!byCashier[name]) byCashier[name] = { name, count: 0, items: 0, revenue: 0, profit: 0 }
          byCashier[name].count += 1
          byCashier[name].items += s.items?.reduce((a, b) => a + b.qty, 0) || 0
          byCashier[name].revenue += s.total
          byCashier[name].profit += s.profit || 0
        }
        const rows = Object.values(byCashier).sort((a, b) => b.revenue - a.revenue)
        return {
          columns: ['Cashier Name', 'Invoices', 'Items Sold', 'Revenue', 'Profit Contribution'],
          rows: rows.map((r) => [r.name, r.count, r.items, fmt(r.revenue), fmt(r.profit)]),
          summary: {
            'Active Cashiers': rows.length,
            'Total Sales': fmt(rows.reduce((a, b) => a + b.revenue, 0)),
          },
        }
      }

      case 'SALES_MEDICINE': {
        const byMed = {}
        for (const s of periodSales) {
          for (const it of s.items || []) {
            const m = medicineById(it.medicineId)
            const name = m ? `${m.name} ${m.strength}` : 'Unknown'
            if (!byMed[name]) byMed[name] = { name, qty: 0, revenue: 0, profit: 0 }
            byMed[name].qty += it.qty
            byMed[name].revenue += it.qty * it.price
            byMed[name].profit += it.qty * (it.price - (it.cost || it.price * 0.75))
          }
        }
        const rows = Object.values(byMed).sort((a, b) => b.revenue - a.revenue)
        return {
          columns: ['Medicine Name', 'Units Sold', 'Total Revenue', 'Profit'],
          rows: rows.map((r) => [r.name, r.qty, fmt(r.revenue), fmt(r.profit)]),
          summary: {
            'Unique Medicines Sold': rows.length,
            'Total Units': rows.reduce((a, b) => a + b.qty, 0),
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

  return (
    <div className="space-y-4 w-full pb-8">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>📊 {config.title}</span>
              <span className="text-[10px] font-bold bg-[#f5eef4] text-[#714B67] px-2.5 py-0.5 rounded-full border border-[#714B67]/20">
                {config.categories.reduce((total, category) => total + category.reports.length, 0)} Reports
              </span>
            </h2>
          </div>

          {/* Controls: Company, Export, Print */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Company Filter Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Building2 className="w-3.5 h-3.5 text-[#714B67] flex-shrink-0" />
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[180px] truncate"
                title="Filter by Pharma Company"
              >
                <option value="ALL">🏢 All Companies ({distinctCompanies.length})</option>
                {distinctCompanies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportCSV}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => window.print()}
              className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>

        {/* Global Date Period & Day Selector */}
        <DateFilterBar filterState={reportDateFilter} onChange={setReportDateFilter} />
      </div>

      {/* Main Grid: Left Catalog Sidebar & Right Report Display */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: 32 Reports Catalog Navigation */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3 space-y-4 max-h-[82vh] overflow-y-auto custom-scroll">
          <div className="px-2 pt-1 font-extrabold text-xs text-slate-800 uppercase tracking-wider">
            Reports Directory
          </div>

          {config.categories.map((cat) => (
            <div key={cat.id} className="space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-bold text-indigo-900 bg-indigo-50/70 rounded-lg">
                {cat.name}
              </div>
              <div className="space-y-0.5 pt-0.5">
                {cat.reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedReportId(r.id)
                      setSearchTerm('')
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedReportId === r.id
                        ? 'bg-indigo-600 text-white shadow-sm font-bold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Active Report Table & Summaries */}
        <div className="lg:col-span-3 space-y-4">
          {/* Active Report Header Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                {currentReportMeta.category}
              </div>
              <h3 className="text-base font-extrabold text-slate-900">{currentReportMeta.title}</h3>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter results..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          {/* Quick Summary Cards */}
          {reportData.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {Object.entries(reportData.summary).map(([label, val]) => (
                <div key={label} className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{label}</span>
                  <span className="text-base font-black text-slate-900 font-mono tracking-tight mt-0.5 block">
                    {val}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Report Data Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    {reportData.columns.map((col, idx) => (
                      <th
                        key={idx}
                        className={`p-3 ${idx === 0 ? 'text-left' : 'text-center'}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`p-3 text-slate-700 ${
                            cIdx === 0
                              ? 'text-left font-bold text-slate-900'
                              : 'text-center font-medium'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!displayRows.length && (
                    <tr>
                      <td
                        colSpan={reportData.columns.length}
                        className="p-8 text-center text-slate-400 font-semibold"
                      >
                        No data available matching the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
