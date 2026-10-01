// AI Pharmacy Operational Copilot Query Engine for Pharmacy POS V4
import { fmt } from './db'

export function processCopilotQuery(prompt, db) {
  const query = (prompt || '').trim().toLowerCase()

  // Guardrail: Non-clinical boundary
  const medicalClinicalTerms = ['diagnose', 'diagnosis', 'disease', 'illness', 'treatment', 'dose', 'dosage', 'prescribe', 'symptom', 'cure', 'infection', 'headache', 'fever', 'bimar', 'ilaj']
  if (medicalClinicalTerms.some((t) => query.includes(t))) {
    return {
      type: 'GUARDRAIL_NOTICE',
      text: "Notice: AI Pharmacy Copilot operates strictly as an operations and inventory intelligence assistant. It does not provide medical diagnosis, dosage advice, or prescription decisions. Please consult a licensed medical practitioner.",
      chips: ['Stock health overview', "Today's financial summary", 'Expiring batches audit'],
    }
  }

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const batches = db.batches || []
  const sales = db.sales || []
  const medicines = db.medicines || []
  const suppliers = db.suppliers || []
  const customers = db.customers || []
  const branches = db.branches || []

  // Metrics
  const nearExpiryBatches = batches.filter((b) => {
    const diff = (new Date(b.expiry) - now) / 86400000
    return diff > 0 && diff <= 45 && b.qty > 0
  })

  const expiredBatches = batches.filter((b) => new Date(b.expiry) < now && b.qty > 0)

  const lowStockMeds = medicines.filter((m) => {
    const totalQty = batches.filter((b) => b.medicineId === m.id).reduce((sum, b) => sum + b.qty, 0)
    return totalQty <= (m.minStock || 10)
  })

  const todaySales = sales.filter((s) => s.date?.startsWith(todayStr))
  const todayRev = todaySales.reduce((sum, s) => sum + s.total, 0)
  const todayProfit = todaySales.reduce((sum, s) => sum + (s.profit || s.total * 0.22), 0)

  const supplierDues = suppliers.filter((s) => s.balance > 0)
  const totalPayable = supplierDues.reduce((sum, s) => sum + s.balance, 0)

  const customerDues = customers.filter((c) => c.balance > 0)
  const totalReceivable = customerDues.reduce((sum, c) => sum + c.balance, 0)

  // Query Intent Matching
  if (query.includes('stock') || query.includes('inventory') || query.includes('issue') || query.includes('shortage')) {
    return {
      type: 'STOCK_SUMMARY',
      title: 'Current Inventory & Safety Audit',
      highlights: [
        `⚠️ ${lowStockMeds.length} medicine(s) are below safety reorder threshold`,
        `🟠 ${nearExpiryBatches.length} batch(es) expire within 45 days`,
        `🔴 ${expiredBatches.length} expired batch(es) require immediate disposal`,
        `📦 Total active medicines catalogued: ${medicines.length}`,
      ],
      details: lowStockMeds.slice(0, 4).map((m) => `${m.name} ${m.strength} (Min: ${m.minStock})`),
      chips: ['Generate reorder PO', 'View expiring batches', 'Check branch inventory'],
    }
  }

  if (query.includes('expire') || query.includes('expiry') || query.includes('date')) {
    return {
      type: 'EXPIRY_AUDIT',
      title: 'Expirations & Batch Health Analysis',
      highlights: [
        `Expired batches in inventory: ${expiredBatches.length}`,
        `Batches expiring soon (within 45 days): ${nearExpiryBatches.length}`,
      ],
      details: nearExpiryBatches.map((b) => {
        const m = medicines.find((x) => x.id === b.medicineId)
        return `${m?.name || 'Item'} (Batch ${b.batchNo}) — ${b.qty} units expire ${b.expiry}`
      }),
      chips: ['Put near-expiry on sale', 'Stock adjustment'],
    }
  }

  if (query.includes('sale') || query.includes('revenue') || query.includes('profit') || query.includes('financial') || query.includes('aaj')) {
    return {
      type: 'FINANCIAL_SUMMARY',
      title: "Today's Operational & Financial Performance",
      highlights: [
        `Gross Sales Revenue today: ${fmt(todayRev)} (${todaySales.length} completed transactions)`,
        `Gross Estimated Profit: ${fmt(todayProfit)} (~${todayRev > 0 ? Math.round((todayProfit / todayRev) * 100) : 0}% net margin)`,
        `Outstanding Customer Credit Receivables: ${fmt(totalReceivable)} across ${customerDues.length} account(s)`,
        `Pending Supplier Payables: ${fmt(totalPayable)} across ${supplierDues.length} vendor(s)`,
      ],
      chips: ['View P&L Statement', 'Open POS Terminal', 'Send credit reminders'],
    }
  }

  if (query.includes('supplier') || query.includes('payable') || query.includes('vendor') || query.includes('dena')) {
    return {
      type: 'SUPPLIER_AUDIT',
      title: 'Supplier Accounts & Vendor Payables',
      highlights: [
        `Total Outstanding to Suppliers: ${fmt(totalPayable)}`,
        `Vendors requiring payment: ${supplierDues.length}`,
      ],
      details: supplierDues.map((s) => `${s.name} (${s.company || 'Distributor'}): ${fmt(s.balance)} due`),
      chips: ['Create purchase order', 'Record purchase bill'],
    }
  }

  if (query.includes('branch') || query.includes('hq') || query.includes('transfer')) {
    return {
      type: 'BRANCH_SUMMARY',
      title: 'Enterprise Multi-Branch Operations',
      highlights: [
        `Total Registered Branches: ${branches.length}`,
        `HQ Consolidated Stock Value: ${fmt(batches.reduce((sum, b) => sum + b.qty * b.purchasePrice, 0))}`,
        `Branch Network: ${branches.map((b) => b.name).join(', ')}`,
      ],
      chips: ['Smart stock transfer', 'Switch active branch'],
    }
  }

  // Default comprehensive response
  return {
    type: 'GENERAL_ASSIST',
    title: 'Pharmacy Operations Health Snapshot',
    highlights: [
      `Sales Today: ${fmt(todayRev)} across ${todaySales.length} bill(s)`,
      `Inventory Radar: ${lowStockMeds.length} low stock medicines, ${nearExpiryBatches.length} expiring batches`,
      `Credit Position: Receivables ${fmt(totalReceivable)} | Supplier Payables ${fmt(totalPayable)}`,
      `Multi-Branch Scope: Operating across ${branches.length} enterprise hubs`,
    ],
    chips: [
      'What stock issues do we have today?',
      'Show near expiry batches',
      'Analyze supplier dues',
      '30-day demand forecast',
    ],
  }
}
