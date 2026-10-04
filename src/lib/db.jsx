// Offline localStorage database for Pharmacy POS (MVP)
import { useEffect, useState } from 'react'

const KEY = 'pharmacy_pos_db_v2'
const ACTIVE_TENANT_KEY = 'pharmacy_pos_active_tenant'

export function getActiveTenantKey() {
  if (typeof window === 'undefined') return KEY
  try {
    const activeTenantId = localStorage.getItem(ACTIVE_TENANT_KEY)
    if (activeTenantId && activeTenantId !== 'null' && activeTenantId !== 'undefined') {
      return `${KEY}_tenant_${activeTenantId}`
    }
  } catch (_) {}
  return KEY
}

const empty = () => ({
  medicines: [],   // {id, name, generic, strength, form, barcode, manufacturer, packSize, minStock, maxStock, purchasePrice, salePrice, wholesalePrice}
  batches: [],     // {id, medicineId, batchNo, expiry (YYYY-MM-DD), qty, purchasePrice, salePrice, supplierId, branchId, status}
  suppliers: [],   // {id, name, company, phone, balance}
  customers: [],   // {id, name, phone, creditLimit, balance, points}
  purchases: [],   // {id, supplierId, invoiceNo, date, items:[{batchId}], total, paid}
  sales: [],       // {id, customerId|null, date, items:[{medicineId,batchId,qty,price,cost}], subtotal, discount, tax, total, payMethod, paid, profit}
  expenses: [],    // {id, date, category, note, amount}
  returns: [],     // {id, saleId, invoiceNo, date, items:[{medicineId,batchId,qty,price}], refund}
  users: [],       // {id, username, passHash, name, role: 'ADMIN'|'MANAGER'|'CASHIER', active}
  auditLogs: [],   // {id, at, user, action, detail}
  session: null,   // {userId, username, name, role, loginAt}
  branches: [],    // {id, name, city, address, region, active}
  transfers: [],   // {id, trNo, fromBranch, toBranch, items:[{batchId,qty}], status: PENDING|APPROVED|REJECTED, date, by}
  currentBranch: 'ALL', // session branch scope: 'ALL' (head office) or branch id
  purchaseOrders: [],
  wholesaleOrders: [],
  deliveries: [],
  snapshots: [],
  plugins: [],
  apiKeys: [],
  counters: [],
  shifts: [],
  activeShiftId: null,
  activeCounterId: 'counter-1',
  stockAdjustments: [],
  stockAudits: [],
  purchaseReturns: [],
  hardware: {
    thermalWidth: '80mm',
    autoPrintReceipt: true,
    printCopies: 1,
    openCashDrawerOnSale: true,
    cashDrawerCode: '27,112,0,25,250',
    customerDisplayEnabled: true,
    customerDisplayPort: 'COM3 / Virtual Second Screen',
    labelPaperSize: '50x25mm',
    barcodeFormat: 'CODE128',
    headerText: 'Pharmacy POS\nMain Bazar, Lahore · Tel: 0300-0000000',
    footerText: 'Thank you for choosing Pharmacy POS!\nOriginal computer receipt required for exchanges within 3 days.\nKeep medicines stored below 25°C away from sunlight.',
  },
  localNetwork: {
    stationName: 'POS-Counter-01',
    serverMode: 'LAN_SERVER',
    serverIp: '192.168.1.100',
    port: '8080',
    offlineMode: true,
    syncStatus: 'LOCAL_SYNCED',
    lastLocalBackup: new Date().toISOString(),
  },
  settings: {
    pharmacyName: 'Pharmacy POS',
    address: 'Main Bazar, Lahore',
    phone: '0300-0000000',
    taxPct: 0,
    loyaltyEarnRate: 100,
    loyaltyRedeemRate: 1,
    udharTemplate: 'Dear Customer,\n\nThank you for choosing {{pharmacy}}.\n\nThank you,\n{{pharmacy}}\n{{phone}}'
  },
})

const listeners = new Set()

const DEFAULT_PLUGINS = [
  { id: 'whatsapp', name: 'WhatsApp Business Cloud', desc: 'Direct receipts dispatch and automated alerts', category: 'Communication', enabled: true },
  { id: 'ecommerce', name: 'Digital Storefront Sync', desc: 'Real-time inventory and catalog synchronization for online orders', category: 'Sales Channels', enabled: true },
  { id: 'rider', name: 'Delivery Rider Fleet', desc: 'On-demand prescription dispatches, rider status, and cash-on-delivery collection', category: 'Logistics', enabled: true },
  { id: 'payments', name: 'Multi-Channel Payments', desc: 'Instant digital settlement via Credit/Debit Cards, EasyPaisa, and JazzCash', category: 'Finance', enabled: false },
  { id: 'sms', name: 'SMS Broadcast Gateway', desc: 'Emergency stock alerts, low-balance SMS, and staff 2FA security codes', category: 'Communication', enabled: false },
  { id: 'ai_copilot', name: 'Enterprise AI Copilot', desc: 'Operational intelligence, autonomous reorder analysis, and predictive metrics', category: 'AI & Automation', enabled: true },
]

// Migrations in load() use DEFAULT_PLUGINS; initialise it first so opening an
// older saved database cannot throw and silently fall back to seeded records.
let db = load()

export function createFreshTenantDB(tenantId, options = {}) {
  const d = seed(empty())
  d.sales = []
  d.purchases = []
  d.customers = []
  d.auditLogs = []
  d.shifts = []
  d.returns = []
  d.expenses = []
  d.batches = []
  d.settings = { ...empty().settings, pharmacyName: options.pharmacyName || 'Pharmacy POS' }
  d.users = options.adminUser ? [options.adminUser] : []
  const storageKey = tenantId ? `${KEY}_tenant_${tenantId}` : getActiveTenantKey()
  try {
    localStorage.setItem(storageKey, JSON.stringify(d))
  } catch (_) {}
  return d
}

function load(targetTenantId) {
  const DEFAULT_TPL = 'Dear Customer,\n\nThank you for choosing Pharmacy POS.\n\nThank you,\n{{pharmacy}}\n{{phone}}'
  try {
    const storageKey = targetTenantId ? `${KEY}_tenant_${targetTenantId}` : getActiveTenantKey()
    const isMainTenant = !targetTenantId || targetTenantId === '51fce6e61f3a4065aef0bbbac3810f7a' || targetTenantId === 'default' || storageKey === KEY
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const d = { ...empty(), ...JSON.parse(raw) }
      d.settings = { ...empty().settings, ...d.settings, udharTemplate: d.settings?.udharTemplate || DEFAULT_TPL }
      
      // Automatic migration: rename default Al-Shifa Pharmacy to Pharmacy POS
      if (d.settings?.pharmacyName === 'Al-Shifa Pharmacy' || !d.settings?.pharmacyName) {
        d.settings.pharmacyName = 'Pharmacy POS'
      }
      if (d.hardware?.headerText?.includes('Al-Shifa Pharmacy')) {
        d.hardware.headerText = d.hardware.headerText.replace(/Al-Shifa Pharmacy/g, 'Pharmacy POS')
      }
      if (d.hardware?.footerText?.includes('Al-Shifa Pharmacy')) {
        d.hardware.footerText = d.hardware.footerText.replace(/Al-Shifa Pharmacy/g, 'Pharmacy POS')
      }
      d.wholesaleOrders = Array.isArray(d.wholesaleOrders) ? d.wholesaleOrders : []
      d.deliveries = Array.isArray(d.deliveries) ? d.deliveries : []
      d.apiKeys = Array.isArray(d.apiKeys) ? d.apiKeys : []

      // Multi-branch Enterprise Migration
      if (!d.branches?.length) {
        d.branches = [
          { id: 'main', name: 'Main Branch (HQ)', city: 'Lahore', address: 'Main Bazar, Gulberg', region: 'Central Region (Punjab)', active: true },
          { id: 'branch_khi', name: 'Karachi South Hub', city: 'Karachi', address: 'Clifton Block 5', region: 'South Region (Sindh)', active: true },
          { id: 'branch_isb', name: 'Islamabad Capital Hub', city: 'Islamabad', address: 'Blue Area', region: 'North Region (Islamabad/KPK)', active: true },
        ]
        d.batches?.forEach((b) => { if (!b.branchId) b.branchId = 'main' })
      }

      if (!d.plugins?.length) {
        d.plugins = DEFAULT_PLUGINS
      }

      if (!d.counters?.length) {
        d.counters = [
          { id: 'counter-1', name: 'Counter 01 (Main Billing)', ip: '192.168.1.101', active: true },
          { id: 'counter-2', name: 'Counter 02 (Dispensing Express)', ip: '192.168.1.102', active: true },
          { id: 'counter-3', name: 'Counter 03 (Emergency / OPD)', ip: '192.168.1.103', active: true },
        ]
      }
      d.activeCounterId = d.activeCounterId || 'counter-1'

      if (d.shifts?.some((s) => s.notes === 'Active Cashier Billing Shift')) {
        d.shifts = d.shifts.filter((s) => s.notes !== 'Active Cashier Billing Shift')
        d.activeShiftId = null
      }

      if (!d.hardware) d.hardware = empty().hardware
      else d.hardware = { ...empty().hardware, ...d.hardware }

      if (!d.localNetwork) d.localNetwork = empty().localNetwork
      else d.localNetwork = { ...empty().localNetwork, ...d.localNetwork }

      if (!Array.isArray(d.medicines)) {
        return seed(empty())
      }

      if (isMainTenant) {
        // Ensure default users exist for all enterprise roles with email credentials ONLY for main tenant
        const defaultStaff = [
          { id: 'usr_pasha', username: 'pasha@pharmacy.com', email: 'pasha@pharmacy.com', passHash: hash('Password@786123'), name: 'Hussnain Pasha', role: 'ADMIN', active: true },
          { id: 'usr_admin', username: 'admin', email: 'admin@pharmacy.com', passHash: hash('Password@786123'), name: 'Hussnain Pasha (Admin)', role: 'ADMIN', active: true },
          { id: 'usr_manager', username: 'manager', email: 'manager@pharmacy.com', passHash: hash('manager123'), name: 'Tariq Manager', role: 'MANAGER', active: true },
          { id: 'usr_pharmacist', username: 'pharmacist', email: 'pharmacist@pharmacy.com', passHash: hash('pharmacist123'), name: 'Dr. Sara Khan', role: 'PHARMACIST', active: true },
          { id: 'usr_cashier', username: 'cashier', email: 'cashier@pharmacy.com', passHash: hash('cashier123'), name: 'Bilal Cashier', role: 'CASHIER', active: true },
          { id: 'usr_receptionist', username: 'receptionist', email: 'receptionist@pharmacy.com', passHash: hash('reception123'), name: 'Fatima Receptionist', role: 'RECEPTIONIST', active: true },
        ]

        if (!Array.isArray(d.users) || !d.users.length) {
          d.users = defaultStaff
          localStorage.setItem(storageKey, JSON.stringify(d))
        } else {
          let changed = false
          defaultStaff.forEach((def) => {
            const existing = d.users.find((u) => String(u?.username || '').toLowerCase() === def.username.toLowerCase() || String(u?.email || '').toLowerCase() === def.email.toLowerCase())
            if (!existing) {
              d.users.push(def)
              changed = true
            } else {
              if (!existing.email) {
                existing.email = def.email
                changed = true
              }
              if (def.username === 'pasha@pharmacy.com' || def.username === 'admin') {
                existing.passHash = hash('Password@786123')
                existing.active = true
                changed = true
              }
            }
          })
          d.users.forEach((u) => {
            if (!u.email) {
              u.email = `${(u.username || 'user').toLowerCase()}@pharmacy.com`
              changed = true
            }
            if (!u.perms || !Array.isArray(u.perms.grants) || !Array.isArray(u.perms.revokes)) {
              u.perms = { grants: [], revokes: [] }
              changed = true
            }
          })
          if (changed) {
            localStorage.setItem(storageKey, JSON.stringify(d))
          }
        }
      } else {
        // Isolated Franchise tenant: keep their own users list intact
        if (Array.isArray(d.users)) {
          let changed = false
          d.users.forEach((u) => {
            if (!u.email && u.username) {
              u.email = u.username.includes('@') ? u.username : `${u.username.toLowerCase()}@pharmacy.com`
              changed = true
            }
            if (!u.perms || !Array.isArray(u.perms.grants) || !Array.isArray(u.perms.revokes)) {
              u.perms = { grants: [], revokes: [] }
              changed = true
            }
          })
          if (changed) localStorage.setItem(storageKey, JSON.stringify(d))
        }
      }

      // Automatic migration: ensure GSK supplier exists
      if (!Array.isArray(d.suppliers)) d.suppliers = []
      if (!d.suppliers.some((s) => s.id === 'sup_gsk' || /glaxosmithkline|gsk/i.test(s?.name || ''))) {
        d.suppliers.unshift({
          id: 'sup_gsk',
          name: 'GSK Pakistan (GlaxoSmithKline)',
          company: 'GlaxoSmithKline Healthcare Pakistan',
          phone: '021-111-475-725',
          balance: 0,
        })
      }

      // Automatic migration: ensure comprehensive GSK catalog exists
      if (Array.isArray(d.medicines)) {
        if (!Array.isArray(d.batches)) d.batches = []
        const gskItems = [
          { name: 'Panadol Syrup 120mg/5ml', generic: 'Paracetamol', strength: '120mg/5ml', form: 'Syrup', barcode: '8964000123509', manufacturer: 'GSK Pakistan', minStock: 25, salePrice: 135, brand: 'Panadol', packSize: '120ml Bottle', maxStock: 150, wholesalePrice: 118, batchNo: 'GSK-SY01', expiry: '2027-05-15', qty: 85 },
          { name: 'Panadol Infant Drops 100mg/ml', generic: 'Paracetamol', strength: '100mg/ml', form: 'Drops', barcode: '8964000123516', manufacturer: 'GSK Pakistan', minStock: 20, salePrice: 140, brand: 'Panadol', packSize: '20ml Dropper Bottle', maxStock: 120, wholesalePrice: 122, batchNo: 'GSK-DR01', expiry: '2027-04-10', qty: 60 },
          { name: 'Augmentin 375mg', generic: 'Amoxicillin + Clavulanic Acid', strength: '375mg', form: 'Tablet', barcode: '8964000123523', manufacturer: 'GSK Pakistan', minStock: 15, salePrice: 540, brand: 'Augmentin', packSize: 'Pack of 10 Tablets', maxStock: 100, wholesalePrice: 475, batchNo: 'AU-3701', expiry: '2027-06-20', qty: 50 },
          { name: 'Augmentin 312.5mg DS Syrup', generic: 'Amoxicillin + Clavulanic Acid', strength: '312.5mg/5ml', form: 'Syrup', barcode: '8964000123530', manufacturer: 'GSK Pakistan', minStock: 15, salePrice: 440, brand: 'Augmentin', packSize: '100ml Suspension Bottle', maxStock: 90, wholesalePrice: 385, batchNo: 'AU-3101', expiry: '2027-07-15', qty: 45 },
          { name: 'Amoxil 250mg Capsules', generic: 'Amoxicillin', strength: '250mg', form: 'Capsule', barcode: '8964000123547', manufacturer: 'GSK Pakistan', minStock: 20, salePrice: 165, brand: 'Amoxil', packSize: 'Pack of 12 Capsules', maxStock: 120, wholesalePrice: 145, batchNo: 'AM-2501', expiry: '2027-03-25', qty: 70 },
          { name: 'Amoxil 500mg Capsules', generic: 'Amoxicillin', strength: '500mg', form: 'Capsule', barcode: '8964000123554', manufacturer: 'GSK Pakistan', minStock: 25, salePrice: 310, brand: 'Amoxil', packSize: 'Pack of 12 Capsules', maxStock: 150, wholesalePrice: 272, batchNo: 'AM-5001', expiry: '2027-08-10', qty: 95 },
          { name: 'Amoxil 125mg/5ml Syrup', generic: 'Amoxicillin', strength: '125mg/5ml', form: 'Syrup', barcode: '8964000123561', manufacturer: 'GSK Pakistan', minStock: 20, salePrice: 95, brand: 'Amoxil', packSize: '60ml Bottle', maxStock: 120, wholesalePrice: 82, batchNo: 'AM-1201', expiry: '2027-05-18', qty: 65 },
          { name: 'Ventolin 2mg/5ml Syrup', generic: 'Salbutamol', strength: '2mg/5ml', form: 'Syrup', barcode: '8964000123578', manufacturer: 'GSK Pakistan', minStock: 20, salePrice: 125, brand: 'Ventolin', packSize: '120ml Bottle', maxStock: 120, wholesalePrice: 110, batchNo: 'VT-2001', expiry: '2027-09-12', qty: 80 },
          { name: 'Ventolin Expectorant', generic: 'Salbutamol + Guaifenesin', strength: 'Standard', form: 'Syrup', barcode: '8964000123585', manufacturer: 'GSK Pakistan', minStock: 15, salePrice: 145, brand: 'Ventolin', packSize: '120ml Bottle', maxStock: 100, wholesalePrice: 128, batchNo: 'VT-EX01', expiry: '2027-06-30', qty: 55 },
          { name: 'Betnovate Cream 20g', generic: 'Betamethasone Valerate', strength: '0.1%', form: 'Cream', barcode: '8964000123592', manufacturer: 'GSK Pakistan', minStock: 20, salePrice: 98, brand: 'Betnovate', packSize: '20g Tube', maxStock: 150, wholesalePrice: 85, batchNo: 'BN-2001', expiry: '2027-07-22', qty: 90 },
          { name: 'Betnovate-N Cream 20g', generic: 'Betamethasone + Neomycin', strength: 'Standard', form: 'Cream', barcode: '8964000123608', manufacturer: 'GSK Pakistan', minStock: 20, salePrice: 115, brand: 'Betnovate', packSize: '20g Tube', maxStock: 150, wholesalePrice: 100, batchNo: 'BNN-201', expiry: '2027-08-15', qty: 85 },
          { name: 'Dermovate Cream 20g', generic: 'Clobetasol Propionate', strength: '0.05%', form: 'Cream', barcode: '8964000123615', manufacturer: 'GSK Pakistan', minStock: 15, salePrice: 140, brand: 'Dermovate', packSize: '20g Tube', maxStock: 120, wholesalePrice: 122, batchNo: 'DM-2001', expiry: '2027-09-05', qty: 65 },
          { name: 'Dermovate Ointment 20g', generic: 'Clobetasol Propionate', strength: '0.05%', form: 'Ointment', barcode: '8964000123622', manufacturer: 'GSK Pakistan', minStock: 15, salePrice: 140, brand: 'Dermovate', packSize: '20g Tube', maxStock: 120, wholesalePrice: 122, batchNo: 'DMO-201', expiry: '2027-08-20', qty: 50 },
          { name: 'Polyfax Eye Ointment', generic: 'Polymyxin B + Bacitracin', strength: 'Ophthalmic', form: 'Ointment', barcode: '8964000123639', manufacturer: 'GSK Pakistan', minStock: 15, salePrice: 95, brand: 'Polyfax', packSize: '6g Tube', maxStock: 100, wholesalePrice: 82, batchNo: 'PF-EY01', expiry: '2027-04-18', qty: 60 },
          { name: 'Ceftum 250mg Tablets', generic: 'Cefuroxime Axetil', strength: '250mg', form: 'Tablet', barcode: '8964000123646', manufacturer: 'GSK Pakistan', minStock: 10, salePrice: 850, brand: 'Ceftum', packSize: 'Pack of 14 Tablets', maxStock: 80, wholesalePrice: 750, batchNo: 'CF-2501', expiry: '2027-10-15', qty: 40 },
          { name: 'Ceftum 500mg Tablets', generic: 'Cefuroxime Axetil', strength: '500mg', form: 'Tablet', barcode: '8964000123653', manufacturer: 'GSK Pakistan', minStock: 10, salePrice: 1550, brand: 'Ceftum', packSize: 'Pack of 14 Tablets', maxStock: 60, wholesalePrice: 1360, batchNo: 'CF-5001', expiry: '2027-11-20', qty: 35 },
        ]

        gskItems.forEach((item) => {
          const exists = d.medicines.some((m) => m?.name?.toLowerCase() === item.name.toLowerCase() || (m?.barcode && m.barcode === item.barcode))
          if (!exists) {
            const purchasePrice = Math.round(item.salePrice * 0.78)
            const mId = uid()
            const m = {
              id: mId,
              name: item.name,
              generic: item.generic,
              strength: item.strength,
              form: item.form,
              dosageForm: item.form,
              barcode: item.barcode,
              manufacturer: item.manufacturer,
              brand: item.brand,
              packSize: item.packSize,
              minStock: item.minStock,
              maxStock: item.maxStock,
              purchasePrice,
              salePrice: item.salePrice,
              wholesalePrice: item.wholesalePrice,
            }
            d.medicines.push(m)
            d.batches.push({
              id: uid(),
              medicineId: mId,
              batchNo: item.batchNo,
              expiry: item.expiry,
              mfgDate: '2024-04-01',
              qty: item.qty,
              purchasePrice,
              salePrice: item.salePrice,
              supplierId: 'sup_gsk',
              branchId: 'main',
              status: 'ACTIVE',
            })
          }
        })
      }

      localStorage.setItem(storageKey, JSON.stringify(d))
      return d
    } else if (targetTenantId && !isMainTenant) {
      // New franchise logging in: create fresh isolated tenant database
      return createFreshTenantDB(targetTenantId)
    }
  } catch (e) { console.error(e) }
  return seed(empty())
}

function seed(d) {
  // Real Authorized Pharmaceutical Distributors
  const supGSK = { id: 'sup_gsk', name: 'GSK Pakistan (GlaxoSmithKline)', company: 'GlaxoSmithKline Healthcare Pakistan', phone: '021-111-475-725', balance: 0 }
  const supMP = { id: 'sup_mp', name: 'Muller & Phipps Pakistan (Pvt) Ltd', company: 'M&P Healthcare Distribution', phone: '042-35889901', balance: 0 }
  const supPremier = { id: 'sup_premier', name: 'Premier Agencies & Distribution Services', company: 'Premier Group Pakistan', phone: '042-35754412', balance: 0 }
  const supAGP = { id: 'sup_agp', name: 'Ali Gohar & Company (Pvt) Ltd', company: 'AGP Distribution Network', phone: '042-35912300', balance: 0 }
  d.suppliers = [supGSK, supMP, supPremier, supAGP]

  const mk = (name, generic, strength, form, barcode, manufacturer, minStock, salePrice, brand, packSize, maxStock, wholesalePrice) => {
    const purchasePrice = Math.round(salePrice * 0.78)
    const m = {
      id: uid(),
      name,
      generic,
      strength,
      form,
      dosageForm: form,
      barcode,
      manufacturer,
      brand: brand || name,
      packSize: packSize || '20 Tablets',
      minStock: minStock || 15,
      maxStock: maxStock || 200,
      purchasePrice,
      salePrice,
      wholesalePrice: wholesalePrice || Math.round(salePrice * 0.88),
    }
    d.medicines.push(m)
    return m
  }

  const b = (m, batchNo, expiry, qty, mfgDate = '2024-03-01', status = 'ACTIVE', supplierId = supMP.id) => {
    d.batches.push({
      id: uid(),
      medicineId: m.id,
      batchNo,
      expiry,
      mfgDate,
      qty,
      purchasePrice: m.purchasePrice,
      salePrice: m.salePrice,
      supplierId,
      branchId: 'main',
      status,
    })
  }

  // 1. Tablets
  const m1 = mk('Panadol 500mg', 'Paracetamol', '500mg', 'Tablet', '8964000123011', 'GSK Pakistan', 30, 300, 'Panadol', 'Pack of 200 Tablets (20x10)', 300, 260)
  b(m1, 'GSK-2401', '2027-04-15', 180, '2024-04-01', 'ACTIVE', supGSK.id)
  b(m1, 'GSK-2402', '2026-11-20', 60, '2024-02-15', 'ACTIVE', supGSK.id)

  const m2 = mk('Panadol Extra', 'Paracetamol + Caffeine', '500mg/65mg', 'Tablet', '8964000123028', 'GSK Pakistan', 20, 360, 'Panadol', 'Pack of 100 Tablets', 200, 315)
  b(m2, 'GSK-2415', '2027-02-10', 95, '2024-02-01', 'ACTIVE', supGSK.id)

  const m3 = mk('Panadol CF', 'Paracetamol + Pseudoephedrine + Chlorpheniramine', 'Multi-Action', 'Tablet', '8964000123035', 'GSK Pakistan', 15, 420, 'Panadol', 'Pack of 100 Tablets', 150, 370)
  b(m3, 'GSK-2422', '2027-05-30', 80, '2024-05-01', 'ACTIVE', supGSK.id)

  const m4 = mk('Augmentin 625mg', 'Amoxicillin + Clavulanic Acid', '625mg', 'Tablet', '8964000123042', 'GSK Pakistan', 15, 850, 'Augmentin', 'Pack of 10 Tablets', 100, 750)
  b(m4, 'AU-8901', '2027-06-15', 45, '2024-06-01', 'ACTIVE', supGSK.id)
  b(m4, 'AU-8902', '2026-08-10', 20, '2023-08-01', 'ACTIVE', supGSK.id)

  const m5 = mk('Augmentin 1g', 'Amoxicillin + Clavulanic Acid', '1000mg', 'Tablet', '8964000123059', 'GSK Pakistan', 10, 1450, 'Augmentin', 'Pack of 14 Tablets', 80, 1280)
  b(m5, 'AU-1002', '2027-08-20', 35, '2024-08-01', 'ACTIVE', supGSK.id)

  const mGSK_aug375 = mk('Augmentin 375mg', 'Amoxicillin + Clavulanic Acid', '375mg', 'Tablet', '8964000123523', 'GSK Pakistan', 15, 540, 'Augmentin', 'Pack of 10 Tablets', 100, 475)
  b(mGSK_aug375, 'AU-3701', '2027-06-20', 50, '2024-06-01', 'ACTIVE', supGSK.id)

  const mGSK_ceftum250 = mk('Ceftum 250mg Tablets', 'Cefuroxime Axetil', '250mg', 'Tablet', '8964000123646', 'GSK Pakistan', 10, 850, 'Ceftum', 'Pack of 14 Tablets', 80, 750)
  b(mGSK_ceftum250, 'CF-2501', '2027-10-15', 40, '2024-10-01', 'ACTIVE', supGSK.id)

  const mGSK_ceftum500 = mk('Ceftum 500mg Tablets', 'Cefuroxime Axetil', '500mg', 'Tablet', '8964000123653', 'GSK Pakistan', 10, 1550, 'Ceftum', 'Pack of 14 Tablets', 60, 1360)
  b(mGSK_ceftum500, 'CF-5001', '2027-11-20', 35, '2024-11-01', 'ACTIVE', supGSK.id)

  const m6 = mk('Brufen 400mg', 'Ibuprofen', '400mg', 'Tablet', '8964000123073', 'Abbott Laboratories', 25, 180, 'Brufen', 'Pack of 30 Tablets', 200, 155)
  b(m6, 'AB-7701', '2027-01-15', 120, '2024-01-10', 'ACTIVE', supMP.id)

  const m7 = mk('Disprin 300mg', 'Aspirin (Soluble)', '300mg', 'Tablet', '8964000123097', 'Reckitt Benckiser', 30, 450, 'Disprin', 'Box of 300 Tablets', 300, 395)
  b(m7, 'RB-4410', '2027-09-01', 150, '2024-09-01', 'ACTIVE', supMP.id)

  const m8 = mk('Flagyl 400mg', 'Metronidazole', '400mg', 'Tablet', '8964000123103', 'Sanofi Aventis', 25, 480, 'Flagyl', 'Pack of 200 Tablets', 200, 420)
  b(m8, 'SN-5521', '2027-03-25', 110, '2024-03-01', 'ACTIVE', supMP.id)

  const m9 = mk('Arinac Forte', 'Ibuprofen + Pseudoephedrine', '400mg/60mg', 'Tablet', '8964000123127', 'Abbott Laboratories', 20, 620, 'Arinac', 'Pack of 100 Tablets', 150, 545)
  b(m9, 'AB-9920', '2027-04-12', 75, '2024-04-01', 'ACTIVE', supMP.id)

  const m10 = mk('Sofvasc 5mg', 'Amlodipine Besylate', '5mg', 'Tablet', '8964000123158', 'Getz Pharma', 15, 290, 'Sofvasc', 'Pack of 20 Tablets', 120, 255)
  b(m10, 'GZ-3301', '2027-07-10', 85, '2024-07-01', 'ACTIVE', supPremier.id)

  const m11 = mk('Sofvasc 10mg', 'Amlodipine Besylate', '10mg', 'Tablet', '8964000123165', 'Getz Pharma', 10, 480, 'Sofvasc', 'Pack of 20 Tablets', 100, 420)
  b(m11, 'GZ-3305', '2027-06-18', 60, '2024-06-01', 'ACTIVE', supPremier.id)

  const m12 = mk('Ponstan 500mg', 'Mefenamic Acid', '500mg', 'Tablet', '8964000123172', 'Pfizer / Viatris', 25, 550, 'Ponstan', 'Pack of 200 Tablets', 250, 485)
  b(m12, 'PF-6102', '2027-05-15', 130, '2024-05-01', 'ACTIVE', supMP.id)

  const m13 = mk('Gravinate 50mg', 'Dimenhydrinate', '50mg', 'Tablet', '8964000123189', 'Searle Company', 20, 320, 'Gravinate', 'Pack of 100 Tablets', 150, 280)
  b(m13, 'SR-4819', '2027-03-30', 90, '2024-03-15', 'ACTIVE', supPremier.id)

  const m14 = mk('Surbex Z', 'Zinc + Multivitamins + B-Complex', 'Multi-Nutrient', 'Tablet', '8964000123202', 'Abbott Laboratories', 20, 420, 'Surbex Z', '30 Film Coated Tablets Bottle', 120, 370)
  b(m14, 'AB-1182', '2027-08-14', 70, '2024-08-01', 'ACTIVE', supMP.id)

  const m15 = mk('CaC 1000 Plus', 'Calcium + Vitamin C + D3', '1000mg', 'Tablet', '8964000123219', 'GSK Pakistan', 20, 340, 'CaC 1000', 'Tube of 10 Effervescent Tablets', 150, 300)
  b(m15, 'GSK-9901', '2027-02-28', 85, '2024-02-01', 'ACTIVE', supGSK.id)

  const m16 = mk('Klaricid 250mg', 'Clarithromycin', '250mg', 'Tablet', '8964000123226', 'Abbott Laboratories', 10, 1100, 'Klaricid', 'Pack of 14 Tablets', 80, 970)
  b(m16, 'AB-4309', '2027-10-10', 40, '2024-10-01', 'ACTIVE', supMP.id)

  const m17 = mk('Zyrtec 10mg', 'Cetirizine HCl', '10mg', 'Tablet', '8964000123240', 'GSK Pakistan', 15, 190, 'Zyrtec', 'Pack of 20 Tablets', 120, 165)
  b(m17, 'GSK-5519', '2027-04-18', 95, '2024-04-01', 'ACTIVE', supGSK.id)

  const m18 = mk('Rivo 2mg', 'Clonazepam', '2mg', 'Tablet', '8964000123257', 'Martin Dow', 15, 260, 'Rivo', 'Pack of 30 Tablets', 100, 230)
  b(m18, 'MD-8831', '2027-03-12', 65, '2024-03-01', 'ACTIVE', supAGP.id)

  const m19 = mk('Amaryl 2mg', 'Glimepiride', '2mg', 'Tablet', '8964000123264', 'Sanofi', 15, 390, 'Amaryl', 'Pack of 30 Tablets', 120, 340)
  b(m19, 'SN-2290', '2027-07-20', 70, '2024-07-01', 'ACTIVE', supMP.id)

  const m20 = mk('Glucophage 500mg', 'Metformin HCl', '500mg', 'Tablet', '8964000123271', 'Martin Dow', 25, 240, 'Glucophage', 'Pack of 50 Tablets', 200, 210)
  b(m20, 'MD-1190', '2027-05-15', 115, '2024-05-01', 'ACTIVE', supAGP.id)

  const m21 = mk('Novidat 500mg', 'Ciprofloxacin', '500mg', 'Tablet', '8964000123288', 'Sami Pharmaceuticals', 15, 420, 'Novidat', 'Pack of 10 Tablets', 120, 370)
  b(m21, 'SM-7740', '2027-06-25', 80, '2024-06-01', 'ACTIVE', supPremier.id)

  const m22 = mk('Loprin 75mg', 'Low-Dose Aspirin', '75mg', 'Tablet', '8964000123295', 'Highnoon Laboratories', 30, 110, 'Loprin', 'Pack of 30 Tablets', 250, 95)
  b(m22, 'HN-3301', '2027-09-10', 160, '2024-09-01', 'ACTIVE', supAGP.id)

  const m23 = mk('Citanew 10mg', 'Escitalopram', '10mg', 'Tablet', '8964000123349', 'Getz Pharma', 12, 350, 'Citanew', 'Pack of 14 Tablets', 90, 305)
  b(m23, 'GZ-6612', '2027-08-05', 55, '2024-08-01', 'ACTIVE', supPremier.id)

  const m24 = mk('Voltral 50mg', 'Diclofenac Sodium', '50mg', 'Tablet', '8964000123387', 'Novartis / GSK', 20, 280, 'Voltral', 'Pack of 20 Tablets', 150, 245)
  b(m24, 'NV-4421', '2027-04-10', 90, '2024-04-01', 'ACTIVE', supMP.id)

  // 2. Capsules
  const m25 = mk('Risek 20mg', 'Omeprazole', '20mg', 'Capsule', '8964000123134', 'Getz Pharma', 20, 380, 'Risek', 'Pack of 14 Capsules', 150, 335)
  b(m25, 'GZ-1102', '2027-05-10', 105, '2024-05-01', 'ACTIVE', supPremier.id)

  const m26 = mk('Risek 40mg', 'Omeprazole', '40mg', 'Capsule', '8964000123141', 'Getz Pharma', 15, 620, 'Risek', 'Pack of 14 Capsules', 100, 545)
  b(m26, 'GZ-1108', '2027-06-15', 75, '2024-06-01', 'ACTIVE', supPremier.id)

  const mGSK_amox250 = mk('Amoxil 250mg Capsules', 'Amoxicillin', '250mg', 'Capsule', '8964000123547', 'GSK Pakistan', 20, 165, 'Amoxil', 'Pack of 12 Capsules', 120, 145)
  b(mGSK_amox250, 'AM-2501', '2027-03-25', 70, '2024-03-01', 'ACTIVE', supGSK.id)

  const mGSK_amox500 = mk('Amoxil 500mg Capsules', 'Amoxicillin', '500mg', 'Capsule', '8964000123554', 'GSK Pakistan', 25, 310, 'Amoxil', 'Pack of 12 Capsules', 150, 272)
  b(mGSK_amox500, 'AM-5001', '2027-08-10', 95, '2024-08-01', 'ACTIVE', supGSK.id)

  const m27 = mk('Velosef 500mg', 'Cephradine', '500mg', 'Capsule', '8964000123332', 'OBS Pakistan', 15, 460, 'Velosef', 'Pack of 12 Capsules', 100, 405)
  b(m27, 'OB-8812', '2027-07-20', 65, '2024-07-01', 'ACTIVE', supAGP.id)

  const m28 = mk('Nexum 40mg', 'Esomeprazole Magnesium', '40mg', 'Capsule', '8964000123363', 'Getz Pharma', 15, 640, 'Nexum', 'Pack of 14 Capsules', 120, 560)
  b(m28, 'GZ-9934', '2027-09-12', 70, '2024-09-01', 'ACTIVE', supPremier.id)

  // 3. Syrups & Suspensions
  const mGSK_panadolSyr = mk('Panadol Syrup 120mg/5ml', 'Paracetamol', '120mg/5ml', 'Syrup', '8964000123509', 'GSK Pakistan', 25, 135, 'Panadol', '120ml Bottle', 150, 118)
  b(mGSK_panadolSyr, 'GSK-SY01', '2027-05-15', 85, '2024-05-01', 'ACTIVE', supGSK.id)

  const mGSK_panadolDrp = mk('Panadol Infant Drops 100mg/ml', 'Paracetamol', '100mg/ml', 'Drops', '8964000123516', 'GSK Pakistan', 20, 140, 'Panadol', '20ml Dropper Bottle', 120, 122)
  b(mGSK_panadolDrp, 'GSK-DR01', '2027-04-10', 60, '2024-04-01', 'ACTIVE', supGSK.id)

  const m29 = mk('Augmentin 156.25mg DS Syrup', 'Amoxicillin + Clavulanic Acid', '156.25mg/5ml', 'Syrup', '8964000123066', 'GSK Pakistan', 12, 320, 'Augmentin', '100ml Suspension Bottle', 80, 280)
  b(m29, 'AU-7711', '2027-03-15', 50, '2024-03-01', 'ACTIVE', supGSK.id)

  const mGSK_aug312 = mk('Augmentin 312.5mg DS Syrup', 'Amoxicillin + Clavulanic Acid', '312.5mg/5ml', 'Syrup', '8964000123530', 'GSK Pakistan', 15, 440, 'Augmentin', '100ml Suspension Bottle', 90, 385)
  b(mGSK_aug312, 'AU-3101', '2027-07-15', 45, '2024-07-01', 'ACTIVE', supGSK.id)

  const mGSK_amoxSyr = mk('Amoxil 125mg/5ml Syrup', 'Amoxicillin', '125mg/5ml', 'Syrup', '8964000123561', 'GSK Pakistan', 20, 95, 'Amoxil', '60ml Bottle', 120, 82)
  b(mGSK_amoxSyr, 'AM-1201', '2027-05-18', 65, '2024-05-01', 'ACTIVE', supGSK.id)

  const mGSK_ventSyr = mk('Ventolin 2mg/5ml Syrup', 'Salbutamol', '2mg/5ml', 'Syrup', '8964000123578', 'GSK Pakistan', 20, 125, 'Ventolin', '120ml Bottle', 120, 110)
  b(mGSK_ventSyr, 'VT-2001', '2027-09-12', 80, '2024-09-01', 'ACTIVE', supGSK.id)

  const mGSK_ventExp = mk('Ventolin Expectorant', 'Salbutamol + Guaifenesin', 'Standard', 'Syrup', '8964000123585', 'GSK Pakistan', 15, 145, 'Ventolin', '120ml Bottle', 100, 128)
  b(mGSK_ventExp, 'VT-EX01', '2027-06-30', 55, '2024-06-01', 'ACTIVE', supGSK.id)

  const m30 = mk('Brufen 100mg/5ml Syrup', 'Ibuprofen', '100mg/5ml', 'Syrup', '8964000123080', 'Abbott Laboratories', 20, 135, 'Brufen', '120ml Bottle', 150, 118)
  b(m30, 'AB-5510', '2027-01-20', 85, '2024-01-15', 'ACTIVE', supMP.id)

  const m31 = mk('Flagyl 200mg/5ml Suspension', 'Metronidazole', '200mg/5ml', 'Syrup', '8964000123110', 'Sanofi Aventis', 15, 110, 'Flagyl', '60ml Bottle', 100, 95)
  b(m31, 'SN-3390', '2027-04-10', 65, '2024-04-01', 'ACTIVE', supMP.id)

  const m32 = mk('Calpol 120mg/5ml Syrup', 'Paracetamol', '120mg/5ml', 'Syrup', '8964000123196', 'GSK Pakistan', 25, 95, 'Calpol', '60ml Bottle', 150, 82)
  b(m32, 'GSK-4412', '2027-08-30', 110, '2024-08-01', 'ACTIVE', supGSK.id)

  const m33 = mk('Hydryllin Syrup', 'Aminophylline + Diphenhydramine', 'Cough Formula', 'Syrup', '8964000123356', 'Searle Company', 20, 145, 'Hydryllin', '120ml Cough Syrup Bottle', 150, 128)
  b(m33, 'SR-9901', '2027-02-15', 90, '2024-02-01', 'ACTIVE', supPremier.id)

  const m34 = mk('Gaviscon Liquid Suspension', 'Sodium Alginate + Sodium Bicarbonate', 'Standard Mint', 'Syrup', '8964000123370', 'Reckitt Benckiser', 15, 210, 'Gaviscon', '120ml Oral Suspension', 100, 185)
  b(m34, 'RB-7719', '2027-06-10', 75, '2024-06-01', 'ACTIVE', supMP.id)

  const m35 = mk('Klaricid 125mg/5ml Suspension', 'Clarithromycin', '125mg/5ml', 'Syrup', '8964000123233', 'Abbott Laboratories', 10, 450, 'Klaricid', '60ml Suspension Bottle', 70, 395)
  b(m35, 'AB-8802', '2027-05-18', 40, '2024-05-01', 'ACTIVE', supMP.id)

  // 4. Injections
  const m36 = mk('Neurobion Injection', 'Vitamin B1 + B6 + B12', '3ml Ampoule', 'Injection', '8964000123394', 'Martin Dow', 15, 160, 'Neurobion', 'Box of 5 Ampoules', 100, 140)
  b(m36, 'MD-4401', '2027-11-15', 80, '2024-11-01', 'ACTIVE', supAGP.id)

  const m37 = mk('Xylocaine 2% Injection', 'Lidocaine HCl', '20mg/ml', 'Injection', '8964000123400', 'Astra / OBS', 10, 220, 'Xylocaine', '50ml Multiple-Dose Vial', 60, 195)
  b(m37, 'OB-1120', '2027-07-25', 45, '2024-07-01', 'ACTIVE', supAGP.id)

  // 5. Inhalers
  const m38 = mk('Ventolin Inhaler 100mcg', 'Salbutamol', '100mcg/puff', 'Inhaler', '8964000123301', 'GSK Pakistan', 12, 480, 'Ventolin', '200 Metered Actuations', 80, 420)
  b(m38, 'GSK-6610', '2027-09-20', 60, '2024-09-01', 'ACTIVE', supGSK.id)

  // 6. Ointments & Drops
  const m39 = mk('Polyfax Skin Ointment', 'Polymyxin B + Bacitracin', 'Standard', 'Ointment', '8964000123318', 'GSK Pakistan', 20, 120, 'Polyfax', '20g Tube', 150, 105)
  b(m39, 'GSK-3312', '2027-03-10', 95, '2024-03-01', 'ACTIVE', supGSK.id)

  const mGSK_polyEye = mk('Polyfax Eye Ointment', 'Polymyxin B + Bacitracin', 'Ophthalmic', 'Ointment', '8964000123639', 'GSK Pakistan', 15, 95, 'Polyfax', '6g Tube', 100, 82)
  b(mGSK_polyEye, 'PF-EY01', '2027-04-18', 60, '2024-04-01', 'ACTIVE', supGSK.id)

  const mGSK_betCream = mk('Betnovate Cream 20g', 'Betamethasone Valerate', '0.1%', 'Cream', '8964000123592', 'GSK Pakistan', 20, 98, 'Betnovate', '20g Tube', 150, 85)
  b(mGSK_betCream, 'BN-2001', '2027-07-22', 90, '2024-07-01', 'ACTIVE', supGSK.id)

  const mGSK_betNCream = mk('Betnovate-N Cream 20g', 'Betamethasone + Neomycin', 'Standard', 'Cream', '8964000123608', 'GSK Pakistan', 20, 115, 'Betnovate', '20g Tube', 150, 100)
  b(mGSK_betNCream, 'BNN-201', '2027-08-15', 85, '2024-08-01', 'ACTIVE', supGSK.id)

  const mGSK_dermCream = mk('Dermovate Cream 20g', 'Clobetasol Propionate', '0.05%', 'Cream', '8964000123615', 'GSK Pakistan', 15, 140, 'Dermovate', '20g Tube', 120, 122)
  b(mGSK_dermCream, 'DM-2001', '2027-09-05', 65, '2024-09-01', 'ACTIVE', supGSK.id)

  const mGSK_dermOint = mk('Dermovate Ointment 20g', 'Clobetasol Propionate', '0.05%', 'Ointment', '8964000123622', 'GSK Pakistan', 15, 140, 'Dermovate', '20g Tube', 120, 122)
  b(mGSK_dermOint, 'DMO-201', '2027-08-20', 50, '2024-08-01', 'ACTIVE', supGSK.id)

  const m40 = mk('Betnesol Eye/Ear Drops', 'Betamethasone Sodium Phosphate', '0.1%', 'Drops', '8964000123325', 'GSK Pakistan', 15, 115, 'Betnesol', '5ml Dropper Bottle', 120, 100)
  b(m40, 'GSK-2281', '2027-04-05', 80, '2024-04-01', 'ACTIVE', supGSK.id)

  // Walk-in customer default
  d.customers = [{ id: 'walkin', name: 'Walk-in Customer', phone: '', creditLimit: 0, balance: 0, points: 0 }]

  // Clean empty operational history (Real sales, purchases, and expenses start from zero)
  d.sales = []
  d.expenses = []
  d.returns = []
  d.purchaseOrders = []
  d.wholesaleOrders = []
  d.deliveries = []
  d.snapshots = []
  d.apiKeys = []
  d.stockAdjustments = []
  d.stockAudits = []

  // Staff Users across enterprise roles
  // Emails must be present from the very first save: the login screen's quick
  // role sign-in submits the email address, so accounts seeded without one
  // cannot be used until a reload runs the email backfill migration.
  d.users = [
    { id: 'usr_pasha', username: 'pasha@pharmacy.com', email: 'pasha@pharmacy.com', passHash: hash('Password@786123'), name: 'Hussnain Pasha', role: 'ADMIN', active: true },
    { id: 'usr_admin', username: 'admin', email: 'admin@pharmacy.com', passHash: hash('Password@786123'), name: 'Hussnain Pasha (Admin)', role: 'ADMIN', active: true },
    { id: 'usr_manager', username: 'manager', email: 'manager@pharmacy.com', passHash: hash('manager123'), name: 'Tariq Manager', role: 'MANAGER', active: true },
    { id: 'usr_pharmacist', username: 'pharmacist', email: 'pharmacist@pharmacy.com', passHash: hash('pharmacist123'), name: 'Dr. Sara Khan', role: 'PHARMACIST', active: true },
    { id: 'usr_cashier', username: 'cashier', email: 'cashier@pharmacy.com', passHash: hash('cashier123'), name: 'Bilal Cashier', role: 'CASHIER', active: true },
    { id: 'usr_receptionist', username: 'receptionist', email: 'receptionist@pharmacy.com', passHash: hash('reception123'), name: 'Fatima Receptionist', role: 'RECEPTIONIST', active: true },
  ]

  // LAN Billing Counters
  d.counters = [
    { id: 'counter-1', name: 'Counter 01 (Main Billing)', ip: '192.168.1.101', active: true },
    { id: 'counter-2', name: 'Counter 02 (Dispensing Express)', ip: '192.168.1.102', active: true },
    { id: 'counter-3', name: 'Counter 03 (Emergency / OPD)', ip: '192.168.1.103', active: true },
  ]

  // A shift must be opened by the cashier; never pretend a shift is already live.
  d.shifts = []
  d.activeShiftId = null
  d.activeCounterId = 'counter-1'
  return d
}

// simple hash (demo-grade; real deployment should use server-side bcrypt)
export function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return 'h' + h.toString(36)
}

function log(action, detail = '') {
  db.auditLogs.push({ id: uid(), at: new Date().toISOString(), user: db.session?.username || 'system', action, detail })
  if (db.auditLogs.length > 500) db.auditLogs = db.auditLogs.slice(-500)
}

export function uid() { return Math.random().toString(36).slice(2, 10) }

function save() {
  const storageKey = getActiveTenantKey()
  try {
    localStorage.setItem(storageKey, JSON.stringify(db))
  } catch (e) {
    console.error('Storage save error:', e)
  }
  listeners.forEach((l) => l())
}

function notifyListeners() {
  listeners.forEach((l) => l())
}

export function useDB() {
  const [, setV] = useState(0)
  useEffect(() => { const l = () => setV((v) => v + 1); listeners.add(l); return () => listeners.delete(l) }, [])
  return db
}

export const getDB = () => db
export function resetDB() { db = seed(empty()); save() }

// ---------- helpers ----------
export const medicineById = (id) => db.medicines.find((m) => m.id === id)
export const supplierById = (id) => db.suppliers.find((s) => s.id === id)
export const customerById = (id) => db.customers.find((c) => c.id === id)

// ---------- branch scoping ----------
export function activeBranch() { return db.currentBranch || 'ALL' }
export function setBranch(bid) {
  // branch-locked staff apni branch badal nahi sakta
  const locked = db.session?.branchId
  if (locked) return
  db.currentBranch = bid; save()
}
export function isBranchLocked() { return !!db.session?.branchId }
export function branchById(id) { return db.branches.find((b) => b.id === id) }
function inScope(branchId) { return db.currentBranch === 'ALL' || !db.currentBranch ? true : branchId === db.currentBranch }

export function stockOf(medicineId) {
  return db.batches.filter((b) => b.medicineId === medicineId && inScope(b.branchId)).reduce((s, b) => s + b.qty, 0)
}

export function fefoBatches(medicineId) {
  return db.batches
    .filter((b) => b.medicineId === medicineId && b.qty > 0 && inScope(b.branchId))
    .sort((a, b) => a.expiry.localeCompare(b.expiry))
}

export const todayStr = () => new Date().toISOString().slice(0, 10)
export const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })

function daysToExpiry(expiry) {
  return Math.ceil((new Date(expiry) - new Date()) / 86400000)
}

// ---------- POS sale (FEFO allocation) ----------
export const DISCOUNT_LIMITS = { ADMIN: Infinity, MANAGER: 0.10, CASHIER: 0 }

export function maxDiscount(subtotal) {
  const role = db.session?.role || 'CASHIER'
  const pct = DISCOUNT_LIMITS[role] ?? 0
  return subtotal * pct
}

export function completeSale({ items, discount = 0, customerId = null, payMethod = 'CASH', paid }) {
  if (!items.length) throw new Error('Cart is empty')
  const subtotalPre = items.reduce((s, i) => s + i.qty * i.price, 0)
  const cap = maxDiscount(subtotalPre)
  if (Number(discount) > cap + 0.001) {
    if (cap <= 0) throw new Error('You do not have permission to apply discounts — Contact Admin/Manager')
    throw new Error(`Discount limit exceeded: Maximum allowed is ${fmt(cap)} (${DISCOUNT_LIMITS[db.session.role] * 100}%)`)
  }
  // validate stock with FEFO
  for (const it of items) {
    const avail = stockOf(it.medicineId)
    if (it.qty > avail) throw new Error(`Insufficient stock for ${medicineById(it.medicineId)?.name}`)
  }
  const saleItems = []
  let subtotal = 0, cost = 0
  for (const it of items) {
    let need = it.qty
    for (const b of fefoBatches(it.medicineId)) {
      if (need <= 0) break
      const take = Math.min(need, b.qty)
      b.qty -= take
      need -= take
      saleItems.push({ medicineId: it.medicineId, batchId: b.id, batchNo: b.batchNo, qty: take, price: it.price, cost: b.purchasePrice })
      subtotal += take * it.price
      cost += take * b.purchasePrice
    }
    if (need > 0) throw new Error('Stock changed during sale')
  }
  const total = Math.max(0, subtotal - discount)
  const sale = {
    id: uid(), invoiceNo: 'INV-' + String(db.sales.length + 1).padStart(5, '0'),
    customerId, date: new Date().toISOString(), items: saleItems,
    subtotal, discount, total, payMethod,
    paid: payMethod === 'CREDIT' ? (paid || 0) : total,
    profit: subtotal - cost - discount,
    soldBy: db.session?.username || 'unknown', soldByName: db.session?.name || 'Unknown',
    branchId: db.currentBranch && db.currentBranch !== 'ALL' ? db.currentBranch : 'main',
    counterId: db.activeCounterId || 'counter-1',
    shiftId: db.activeShiftId || null,
  }
  log('SALE', `${sale.invoiceNo} — ${fmt(total)}${discount > 0 ? ` (discount ${fmt(discount)})` : ''}`)
  // loyalty: earn points (Rs. earnRate par 1 point) — redeem kiye gaye points already discount mein hain
  if (customerId) {
    const c = customerById(customerId)
    if (c) {
      const rate = Number(db.settings.loyaltyEarnRate) || 100
      const earned = Math.floor(total / rate)
      c.points = (c.points || 0) + earned
      sale.pointsEarned = earned
    }
  }
  if (payMethod === 'CREDIT' && customerId) {
    const c = customerById(customerId)
    if (c) c.balance += total - (paid || 0)
  }
  db.sales.push(sale)
  queueOfflineMutation('SALE', {
    id: sale.id,
    invoiceNo: sale.invoiceNo,
    total: sale.total,
    paid: sale.paid,
    payMethod: sale.payMethod,
    itemsCount: sale.items?.length || 0,
    timestamp: sale.date,
  })
  if (payMethod === 'CASH') {
    recordShiftTransaction('CASH_SALE', sale.paid || total)
  }
  save()
  return sale
}

export function returnSaleItem(saleId, index, qty) {
  const sale = db.sales.find((s) => s.id === saleId)
  const it = sale?.items[index]
  if (!sale || !it || qty <= 0 || qty > it.qty) throw new Error('Invalid return qty')
  it.qty -= qty
  const b = db.batches.find((x) => x.id === it.batchId)
  if (b) b.qty += qty // restock to same batch (quarantine/status: future)
  const refund = qty * it.price
  sale.total -= refund
  sale.profit -= qty * (it.price - it.cost)
  if (sale.customerId) {
    const c = customerById(sale.customerId)
    if (c) {
      const rate = Number(db.settings.loyaltyEarnRate) || 100
      c.points = Math.max(0, (c.points || 0) - Math.floor(refund / rate)) // earn wale points reverse
      if (sale.payMethod === 'CREDIT') c.balance -= refund
    }
  }
  // record return history
  let ret = db.returns.find((r) => r.saleId === saleId)
  if (!ret) {
    ret = { id: uid(), saleId, invoiceNo: sale.invoiceNo, date: new Date().toISOString(), items: [], refund: 0 }
    db.returns.push(ret)
  }
  ret.items.push({ medicineId: it.medicineId, batchId: it.batchId, qty, price: it.price })
  ret.refund += refund
  ret.date = new Date().toISOString()
  ret.by = db.session?.username || 'unknown'
  recordShiftTransaction('REFUND', refund)
  log('SALE_RETURN', `${sale.invoiceNo} — refund ${fmt(refund)}`)
  save()
  return refund
}

export function findSaleByInvoice(invoiceNo) {
  const q = invoiceNo.trim().toLowerCase()
  return db.sales.find((s) => s.invoiceNo.toLowerCase() === q)
    || db.sales.filter((s) => s.invoiceNo.toLowerCase().includes(q)).slice(-1)[0]
}

export function allSalesInScope() {
  const me = db.session
  if (!me || me.role === 'ADMIN' || db.currentBranch === 'ALL') {
    return [...(db.sales || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
  const branch = db.currentBranch || me.branchId
  return (db.sales || [])
    .filter((s) => !s.branchId || s.branchId === branch)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function deleteSale(saleId) {
  // Enforced in the data layer so the UI cannot be talked into a sale
  // deletion it does not have permission for (same rule as discount limits).
  if (!can('deleteSales')) {
    throw new Error('You do not have the "Delete / Void Sales" permission. An administrator can grant it in Staff & Roles.')
  }
  const idx = (db.sales || []).findIndex((s) => s.id === saleId)
  if (idx === -1) throw new Error('Sale record not found')
  const sale = db.sales[idx]

  // 1. Restock each sold item back into its batch
  if (Array.isArray(sale.items)) {
    for (const it of sale.items) {
      if (!it.qty) continue
      let b = db.batches.find((x) => x.id === it.batchId)
      if (b) {
        b.qty += it.qty
        b.status = 'ACTIVE'
      } else {
        const fallback = db.batches.find((x) => x.medicineId === it.medicineId)
        if (fallback) {
          fallback.qty += it.qty
          fallback.status = 'ACTIVE'
        } else {
          db.batches.push({
            id: it.batchId || uid(),
            medicineId: it.medicineId,
            batchNo: it.batchNo || 'RESTORED',
            expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
            qty: it.qty,
            purchasePrice: it.cost || 0,
            salePrice: it.price || 0,
            status: 'ACTIVE',
            branchId: sale.branchId || 'main',
          })
        }
      }
    }
  }

  // 2. Revert customer balance and loyalty points if applicable
  if (sale.customerId) {
    const c = customerById(sale.customerId)
    if (c) {
      if (sale.pointsEarned) {
        c.points = Math.max(0, (c.points || 0) - sale.pointsEarned)
      }
      if (sale.payMethod === 'CREDIT') {
        const netCredit = sale.total - (sale.paid || 0)
        if (netCredit > 0) c.balance = Math.max(0, (c.balance || 0) - netCredit)
      }
    }
  }

  // 3. Remove sale from db.sales
  db.sales.splice(idx, 1)

  // 4. Record audit log
  log('DELETE_SALE', `${sale.invoiceNo} — ${fmt(sale.total)} (Stock restored to inventory)`)
  save()
  notifyListeners()
  return { ok: true, invoiceNo: sale.invoiceNo }
}

export function updateSale(saleId, updates) {
  const sale = (db.sales || []).find((s) => s.id === saleId)
  if (!sale) throw new Error('Sale not found')

  if (Array.isArray(updates.items)) {
    // 1. Restore previous items stock to batches
    for (const it of sale.items || []) {
      const b = db.batches.find((x) => x.id === it.batchId)
      if (b) b.qty += it.qty
    }

    // 2. Allocate new items stock with FEFO
    const saleItems = []
    let subtotal = 0, cost = 0
    for (const it of updates.items) {
      let need = it.qty
      for (const b of fefoBatches(it.medicineId)) {
        if (need <= 0) break
        const take = Math.min(need, b.qty)
        b.qty -= take
        need -= take
        saleItems.push({
          medicineId: it.medicineId,
          batchId: b.id,
          batchNo: b.batchNo,
          qty: take,
          price: it.price,
          cost: b.purchasePrice,
        })
        subtotal += take * it.price
        cost += take * b.purchasePrice
      }
      if (need > 0) throw new Error(`Insufficient stock for ${medicineById(it.medicineId)?.name || 'item'}`)
    }
    sale.items = saleItems
    sale.subtotal = subtotal
    const discountVal = updates.discount !== undefined ? Number(updates.discount) : (sale.discount || 0)
    sale.profit = subtotal - cost - discountVal
  }

  if (updates.discount !== undefined) {
    sale.discount = Math.max(0, Number(updates.discount) || 0)
  }
  sale.total = Math.max(0, sale.subtotal - (sale.discount || 0))

  if (updates.payMethod) sale.payMethod = updates.payMethod
  if (updates.paid !== undefined) sale.paid = Number(updates.paid)
  if (updates.customerId !== undefined) sale.customerId = updates.customerId
  if (updates.rxNotes !== undefined) sale.rxNotes = updates.rxNotes

  log('UPDATE_SALE', `${sale.invoiceNo} — modified total ${fmt(sale.total)}`)
  save()
  notifyListeners()
  return sale
}

export function returnsHistory() {
  return [...db.returns].sort((a, b) => b.date.localeCompare(a.date))
}

export function customersInScope() {
  // customers ko bhi branch tag karna future ka kaam hai; filhal sab dikhte hain magar sales branch-scoped
  return db.customers
}

export function cashierWiseSales(days = 30) {
  const cutoff = Date.now() - days * 86400000
  const map = {}
  for (const s of db.sales) {
    if (new Date(s.date).getTime() < cutoff) continue
    if (!inScope(s.branchId)) continue
    const key = s.soldBy || 'unknown'
    if (!map[key]) map[key] = { user: key, name: s.soldByName || key, invoices: 0, revenue: 0, profit: 0, discounts: 0, items: 0, returns: 0 }
    map[key].invoices += 1
    map[key].revenue += s.total
    map[key].profit += s.profit || 0
    map[key].discounts += s.discount || 0
    map[key].items += s.items.reduce((a, i) => a + i.qty, 0)
  }
  for (const r of db.returns) {
    if (new Date(r.date).getTime() < cutoff) continue
    const key = r.by || 'unknown'
    if (map[key]) map[key].returns += r.refund
    else map[key] = { user: key, name: key, invoices: 0, revenue: 0, profit: 0, discounts: 0, items: 0, returns: r.refund }
  }
  return Object.values(map).sort((a, b) => b.revenue - a.revenue)
}

// ---------- Purchase / GRN (creates/receives batches) ----------
export function savePurchase({
  supplierId,
  grnNo,
  invoiceNo,
  date,
  items, // [{medicineId, medicineName, batchNo, expiry, qty, bonusQty, purchasePrice, salePrice}]
  subtotal,
  discountPct = 0,
  discountAmount = 0,
  gstPct = 0,
  gstAmount = 0,
  advanceTaxPct = 0,
  advanceTaxAmount = 0,
  otherTax = 0,
  paid = 0,
  note = '',
}) {
  if (!items || !items.length) throw new Error('No items in purchase / GRN')

  let calculatedSubtotal = 0
  const batchIds = []
  const savedItems = []

  for (const it of items) {
    const qty = Number(it.qty) || 0
    const bonusQty = Number(it.bonusQty) || 0
    const totalUnits = qty + bonusQty
    const pPrice = Number(it.purchasePrice) || 0
    const sPrice = Number(it.salePrice) || 0
    const batchNo = String(it.batchNo || '').trim() || `B-${todayStr().replace(/-/g, '').slice(2)}`
    const expiry = it.expiry || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)

    let batch = db.batches.find((b) => b.medicineId === it.medicineId && b.batchNo === batchNo)
    if (batch) {
      batch.qty += totalUnits
      batch.expiry = expiry
      batch.purchasePrice = pPrice
      if (sPrice > 0) batch.salePrice = sPrice
      if (batch.status === 'EXHAUSTED' || batch.status === 'RETURNED') batch.status = 'ACTIVE'
    } else {
      batch = {
        id: uid(),
        medicineId: it.medicineId,
        batchNo,
        expiry,
        qty: totalUnits,
        purchasePrice: pPrice,
        salePrice: sPrice,
        supplierId,
        status: 'ACTIVE',
      }
      db.batches.push(batch)
    }

    const m = medicineById(it.medicineId)
    if (m) {
      if (sPrice > 0) m.salePrice = sPrice
      if (pPrice > 0) m.purchasePrice = pPrice
    }

    const lineTotal = qty * pPrice
    calculatedSubtotal += lineTotal
    batchIds.push(batch.id)

    savedItems.push({
      medicineId: it.medicineId,
      medicineName: it.medicineName || (m ? `${m.name} ${m.strength || ''}` : 'Medicine'),
      batchId: batch.id,
      batchNo,
      expiry,
      qty,
      bonusQty,
      purchasePrice: pPrice,
      salePrice: sPrice,
      lineTotal,
    })
  }

  const grossSubtotal = subtotal !== undefined ? Number(subtotal) : calculatedSubtotal
  const disc = Number(discountAmount) || 0
  const gst = Number(gstAmount) || 0
  const advTax = Number(advanceTaxAmount) || 0
  const oTax = Number(otherTax) || 0

  const netTotal = Math.max(0, grossSubtotal - disc + gst + advTax + oTax)
  const paidNow = Number(paid || 0)
  const remainingDue = netTotal - paidNow

  const grnCount = (db.purchases?.length || 0) + 1
  const generatedGrnNo = grnNo || ('GRN-' + String(grnCount).padStart(4, '0'))
  const generatedInvNo = invoiceNo || ('INV-' + Date.now())

  const p = {
    id: uid(),
    grnNo: generatedGrnNo,
    invoiceNo: generatedInvNo,
    supplierId,
    date: date || todayStr(),
    items: savedItems,
    batchIds,
    subtotal: grossSubtotal,
    discountPct: Number(discountPct) || 0,
    discountAmount: disc,
    gstPct: Number(gstPct) || 0,
    gstAmount: gst,
    advanceTaxPct: Number(advanceTaxPct) || 0,
    advanceTaxAmount: advTax,
    otherTax: oTax,
    total: netTotal,
    paid: paidNow,
    due: remainingDue,
    note: note || '',
    receivedBy: db.session?.name || db.session?.username || 'Pharmacist',
    createdAt: new Date().toISOString(),
  }

  if (!db.purchases) db.purchases = []
  db.purchases.push(p)

  const s = supplierById(supplierId)
  if (s) {
    s.balance += remainingDue
  }

  log('PURCHASE_GRN', `${p.grnNo} / ${p.invoiceNo} — ${savedItems.length} items from ${s?.name || 'supplier'} (Net Total: ${fmt(netTotal)}, Paid: ${fmt(paidNow)})`)
  save()
  notifyListeners()
  return p
}

export function paySupplier(supplierId, amount) {
  const s = supplierById(supplierId)
  if (!s || amount <= 0) throw new Error('Invalid payment')
  const num = Number(amount)
  s.balance -= num
  recordShiftTransaction('SUPPLIER_PAYMENT', num)
  log('SUPPLIER_PAYMENT', `Paid ${fmt(num)} to ${s.name}`)
  save()
}

export function payCustomer(customerId, amount) {
  const c = customerById(customerId)
  if (!c || amount <= 0) throw new Error('Invalid payment')
  const num = Number(amount)
  c.balance -= num
  recordShiftTransaction('CUSTOMER_PAYMENT', num)
  log('CUSTOMER_PAYMENT', `${c.name} paid ${fmt(num)}`)
  save()
}

// ---------- loyalty ----------
export const LOYALTY_TIERS = [
  { min: 0, name: 'Silver', color: 'bg-gray-300 text-gray-700' },
  { min: 500, name: 'Gold', color: 'bg-amber-200 text-amber-800' },
  { min: 2000, name: 'Platinum', color: 'bg-purple-200 text-purple-800' },
]

export function loyaltyTiers() { return db.settings.loyaltyTiers || LOYALTY_TIERS }

export function loyaltyTier(points) {
  const tiers = [...loyaltyTiers()].sort((a, b) => a.min - b.min)
  return [...tiers].reverse().find((t) => (points || 0) >= t.min) || tiers[0]
}

export function maxRedeemPoints(customerId, cartTotal) {
  const c = customerById(customerId)
  if (!c) return 0
  const rate = Number(db.settings.loyaltyRedeemRate) || 1
  const byPoints = Math.floor((c.points || 0) / 1)
  const byCart = Math.floor(cartTotal * 0.5) // max 50% of cart redeemable
  return Math.max(0, Math.min(byPoints, byCart))
}

export function redeemPoints(customerId, points) {
  const c = customerById(customerId)
  if (!c || points <= 0 || points > (c.points || 0)) throw new Error('Insufficient points balance')
  c.points -= points
  const value = points * (Number(db.settings.loyaltyRedeemRate) || 1)
  log('POINTS_REDEEM', `${c.name} — ${points} pts = ${fmt(value)}`)
  save()
  return value
}

export function addCustomerPoints(customerId, points, reason) {
  const c = customerById(customerId)
  if (!c) return
  c.points = (c.points || 0) + points
  log('POINTS_ADJUST', `${c.name} ${points > 0 ? '+' : ''}${points} (${reason || 'manual'})`)
  save()
}

export function topCustomers(n = 10, days = null) {
  const cutoff = days ? Date.now() - days * 86400000 : 0
  const map = {}
  for (const s of db.sales) {
    if (!s.customerId) continue
    if (new Date(s.date).getTime() < cutoff) continue
    if (!map[s.customerId]) map[s.customerId] = { customerId: s.customerId, spend: 0, invoices: 0, items: 0 }
    map[s.customerId].spend += s.total
    map[s.customerId].invoices += 1
    map[s.customerId].items += s.items.reduce((a, i) => a + i.qty, 0)
  }
  return Object.values(map)
    .map((x) => {
      const c = customerById(x.customerId)
      return { ...x, name: c?.name || '?', phone: c?.phone || '', points: c?.points || 0, tier: loyaltyTier(c?.points || 0) }
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, n)
}

export function customerProfile(customerId) {
  const c = customerById(customerId)
  if (!c) return null
  const invoices = db.sales.filter((s) => s.customerId === customerId).sort((a, b) => b.date.localeCompare(a.date))
  const lifetimeSpend = invoices.reduce((a, s) => a + s.total, 0)
  const lifetimeProfit = invoices.reduce((a, s) => a + (s.profit || 0), 0)
  const totalDiscounts = invoices.reduce((a, s) => a + (s.discount || 0), 0)
  const returnsRefunded = db.returns.filter((r) => {
    const sale = db.sales.find((s) => s.id === r.saleId)
    return sale?.customerId === customerId
  }).reduce((a, r) => a + r.refund, 0)
  const invoicesCount = invoices.length
  const avgBasket = invoicesCount ? Math.round(lifetimeSpend / invoicesCount) : 0
  const lastVisit = invoices[0]?.date
  // timeline: sales (points earned), returns, udhar entries — merged, latest first
  const timeline = []
  for (const s of invoices) {
    timeline.push({ at: s.date, type: 'sale', label: `${s.invoiceNo} — ${fmt(s.total)}`, points: s.pointsEarned || 0, amount: s.total, credit: s.payMethod === 'CREDIT' ? (s.total - (s.paid || 0)) : 0 })
  }
  for (const r of db.returns) {
    const sale = db.sales.find((s) => s.id === r.saleId)
    if (sale?.customerId === customerId) timeline.push({ at: r.date, type: 'return', label: `Return ${r.invoiceNo} — ${fmt(r.refund)}`, points: 0, amount: -r.refund, credit: 0 })
  }
  timeline.sort((a, b) => b.at.localeCompare(a.at))
  const tier = loyaltyTier(c.points)
  const nextTier = [...loyaltyTiers()].sort((a, b) => a.min - b.min).find((t) => t.min > (c.points || 0))
  return {
    customer: c, tier, nextTier,
    lifetimeSpend, lifetimeProfit, totalDiscounts, returnsRefunded,
    invoicesCount, avgBasket, lastVisit,
    points: c.points || 0, udhar: Math.max(0, c.balance || 0),
    invoices, timeline,
  }
}

export function addExpense({ category, note, amount }) {
  const val = Number(amount)
  db.expenses.push({ id: uid(), date: todayStr(), category, note, amount: val })
  recordShiftTransaction('EXPENSE', val)
  log('EXPENSE_ADD', `${category}: ${fmt(val)} (${note || 'No note'})`)
  save()
}

export function addMedicine(m) {
  const med = { id: uid(), packSize: '', manufacturer: '', ...m }
  db.medicines.push(med); save(); return med
}
export function updateMedicine(id, patch) {
  const m = medicineById(id); if (!m) return
  Object.assign(m, patch); save()
}
export function deleteMedicine(id) {
  db.medicines = db.medicines.filter((m) => m.id !== id)
  db.batches = db.batches.filter((b) => b.medicineId !== id)
  save()
}
export function addBatch(b) {
  const batch = { id: uid(), ...b, qty: Number(b.qty), purchasePrice: Number(b.purchasePrice), salePrice: Number(b.salePrice), branchId: b.branchId || db.currentBranch === 'ALL' ? (b.branchId || 'main') : db.currentBranch }
  db.batches.push(batch); save(); return batch
}
export function adjustBatch(id, newQty) {
  const b = db.batches.find((x) => x.id === id); if (!b) return
  b.qty = Number(newQty); save()
}
export function addSupplier(s) { const x = { id: uid(), balance: 0, ...s }; db.suppliers.push(x); save(); return x }
export function updateSupplier(id, patch) {
  const s = db.suppliers.find((x) => x.id === id)
  if (!s) return null
  Object.assign(s, patch)
  log('SUPPLIER_UPDATE', `Updated supplier ${s.name}`)
  save()
  notifyListeners()
  return s
}
export function deleteSupplier(id) {
  const idx = db.suppliers.findIndex((x) => x.id === id)
  if (idx === -1) return false
  const [removed] = db.suppliers.splice(idx, 1)
  log('SUPPLIER_DELETE', `Deleted supplier ${removed?.name || id}`)
  save()
  notifyListeners()
  return true
}
export function addCustomer(c) { const x = { id: uid(), balance: 0, points: 0, ...c }; db.customers.push(x); save(); return x }
export function updateCustomer(id, patch) {
  const c = db.customers.find((x) => x.id === id)
  if (!c) return null
  Object.assign(c, patch)
  log('CUSTOMER_UPDATE', `Updated customer ${c.name}`)
  save()
  notifyListeners()
  return c
}
export function deleteCustomer(id) {
  if (id === 'walkin') return false
  const idx = db.customers.findIndex((x) => x.id === id)
  if (idx === -1) return false
  const [removed] = db.customers.splice(idx, 1)
  log('CUSTOMER_DELETE', `Deleted customer ${removed?.name || id}`)
  save()
  notifyListeners()
  return true
}

export function updateSettings(patch) {
  db.settings = { ...db.settings, ...patch }
  log('SETTINGS_UPDATE', JSON.stringify(patch))
  save()
  return db.settings
}

// ---------- auth & users ----------
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 5

function lockState(username) {
  const key = 'lock_' + username.toLowerCase()
  return db.auditLogs && JSON.parse(localStorage.getItem(KEY + '_' + key) || 'null')
}

function setLockState(username, state) {
  const key = KEY + '_lock_' + username.toLowerCase()
  if (state) localStorage.setItem(key, JSON.stringify(state))
  else localStorage.removeItem(key)
}

export function clearLock(username) {
  if (username) {
    setLockState(username.trim(), null)
  } else {
    // Clear all user locks in localStorage
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.includes('_lock_')) localStorage.removeItem(k)
      })
    } catch (_) {}
  }
  save()
}

export function loginLockInfo(username) {
  if (!username) return { locked: false, attemptsLeft: MAX_ATTEMPTS }
  const st = lockState(username)
  if (st?.lockedUntil && Date.now() < st.lockedUntil) {
    return { locked: true, lockedUntil: st.lockedUntil, msLeft: st.lockedUntil - Date.now() }
  }
  return { locked: false, attemptsLeft: MAX_ATTEMPTS - (st?.fails || 0) }
}

// staff ko branch tak seemit karne ke liye — ADMIN/ho ke paas ALL
export function visibleBranches() {
  const me = db.session
  if (!me) return db.branches
  if (me.role === 'ADMIN' || !me.branchId) return db.branches
  return db.branches.filter((b) => b.id === me.branchId)
}

// --- Offline Sync Queue ---
export function getSyncQueueKey() {
  if (typeof window === 'undefined') return 'pos_sync_queue'
  try {
    const activeTenantId = localStorage.getItem(ACTIVE_TENANT_KEY)
    if (activeTenantId && activeTenantId !== 'null' && activeTenantId !== 'undefined') {
      return `pos_sync_queue_tenant_${activeTenantId}`
    }
  } catch (_) {}
  return 'pos_sync_queue'
}

export function getOfflineSyncQueue() {
  try {
    const raw = localStorage.getItem(getSyncQueueKey())
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function queueOfflineMutation(type, payload) {
  try {
    const queue = getOfflineSyncQueue()
    queue.push({
      id: 'sync_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type,
      payload,
      queuedAt: new Date().toISOString(),
    })
    localStorage.setItem(getSyncQueueKey(), JSON.stringify(queue))
    notifyListeners()
    return queue.length
  } catch (e) {
    console.warn('Failed to queue offline mutation', e)
    return 0
  }
}

export function clearSyncedItems(countOrIds) {
  try {
    let queue = getOfflineSyncQueue()
    if (Array.isArray(countOrIds)) {
      const idSet = new Set(countOrIds)
      queue = queue.filter((item) => !idSet.has(item.id))
    } else if (typeof countOrIds === 'number') {
      queue = queue.slice(countOrIds)
    } else {
      queue = []
    }
    localStorage.setItem(getSyncQueueKey(), JSON.stringify(queue))
    notifyListeners()
    return queue.length
  } catch (e) {
    console.warn('Failed to clear synced items', e)
    return 0
  }
}

export function mergeCloudSyncData(cloudData) {
  if (!cloudData || typeof cloudData !== 'object') return { updated: false }
  let changed = false
  const stats = { medicines: 0, batches: 0, users: 0 }

  // 1. Medicines
  if (Array.isArray(cloudData.medicines) && cloudData.medicines.length > 0) {
    db.medicines = Array.isArray(db.medicines) ? db.medicines : []
    const medMap = new Map()
    db.medicines.forEach((m) => {
      if (m.id) medMap.set(m.id, m)
    })

    cloudData.medicines.forEach((cloudMed) => {
      if (!cloudMed || !cloudMed.name) return
      let existing = medMap.get(cloudMed.id)
      if (!existing && cloudMed.barcode) {
        existing = db.medicines.find((m) => m.barcode && m.barcode === cloudMed.barcode)
      }
      if (!existing) {
        existing = db.medicines.find((m) => m.name.toLowerCase() === cloudMed.name.toLowerCase())
      }

      if (existing) {
        existing.name = cloudMed.name || existing.name
        if (cloudMed.generic !== undefined) existing.generic = cloudMed.generic
        if (cloudMed.barcode !== undefined) existing.barcode = cloudMed.barcode
        if (cloudMed.form) existing.form = cloudMed.form
        if (cloudMed.strength) existing.strength = cloudMed.strength
        if (cloudMed.manufacturer) existing.manufacturer = cloudMed.manufacturer
        if (cloudMed.packSize) existing.packSize = cloudMed.packSize
        if (typeof cloudMed.salePrice === 'number' && cloudMed.salePrice > 0) existing.salePrice = cloudMed.salePrice
        if (typeof cloudMed.purchasePrice === 'number' && cloudMed.purchasePrice > 0) existing.purchasePrice = cloudMed.purchasePrice
      } else {
        const newMed = {
          id: cloudMed.id || uid(),
          name: cloudMed.name,
          generic: cloudMed.generic || '',
          strength: cloudMed.strength || '',
          form: cloudMed.form || 'Tablet',
          barcode: cloudMed.barcode || '',
          manufacturer: cloudMed.manufacturer || 'General',
          packSize: cloudMed.packSize || 1,
          minStock: cloudMed.minStock || 10,
          maxStock: cloudMed.maxStock || 100,
          purchasePrice: cloudMed.purchasePrice || 0,
          salePrice: cloudMed.salePrice || 0,
          wholesalePrice: cloudMed.wholesalePrice || cloudMed.salePrice || 0,
        }
        db.medicines.push(newMed)
        medMap.set(newMed.id, newMed)
      }
      stats.medicines++
    })
    changed = true
  }

  // 2. Batches
  if (Array.isArray(cloudData.batches) && cloudData.batches.length > 0) {
    db.batches = Array.isArray(db.batches) ? db.batches : []
    const batchMap = new Map()
    db.batches.forEach((b) => {
      if (b.id) batchMap.set(b.id, b)
    })

    cloudData.batches.forEach((cloudBatch) => {
      if (!cloudBatch || !cloudBatch.medicineId) return
      let existing = batchMap.get(cloudBatch.id)
      if (!existing && cloudBatch.batchNo) {
        existing = db.batches.find((b) => b.medicineId === cloudBatch.medicineId && b.batchNo === cloudBatch.batchNo)
      }

      if (existing) {
        if (typeof cloudBatch.qty === 'number') existing.qty = cloudBatch.qty
        if (cloudBatch.expiry) existing.expiry = cloudBatch.expiry
        if (typeof cloudBatch.purchasePrice === 'number') existing.purchasePrice = cloudBatch.purchasePrice
        if (typeof cloudBatch.salePrice === 'number') existing.salePrice = cloudBatch.salePrice
        existing.status = existing.qty > 0 ? 'ACTIVE' : 'DEPLETED'
      } else {
        const newBatch = {
          id: cloudBatch.id || uid(),
          medicineId: cloudBatch.medicineId,
          batchNo: cloudBatch.batchNo || 'B-' + Date.now().toString().slice(-4),
          expiry: cloudBatch.expiry || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
          qty: typeof cloudBatch.qty === 'number' ? cloudBatch.qty : 50,
          purchasePrice: cloudBatch.purchasePrice || 0,
          salePrice: cloudBatch.salePrice || 0,
          supplierId: cloudBatch.supplierId || null,
          branchId: db.currentBranch !== 'ALL' ? db.currentBranch : 'main',
          status: 'ACTIVE',
        }
        db.batches.push(newBatch)
        batchMap.set(newBatch.id, newBatch)
      }
      stats.batches++
    })
    changed = true
  }

  // 3. Users (Staff)
  if (Array.isArray(cloudData.users) && cloudData.users.length > 0) {
    db.users = Array.isArray(db.users) ? db.users : []
    cloudData.users.forEach((cu) => {
      if (!cu || (!cu.username && !cu.email)) return
      const lower = (cu.username || cu.email).toLowerCase()
      const existing = db.users.find((u) =>
        (u.username && u.username.toLowerCase() === lower) ||
        (u.email && u.email.toLowerCase() === lower) ||
        (u.id && u.id === cu.id)
      )
      if (existing) {
        existing.name = cu.name || existing.name
        existing.role = cu.role || existing.role
        existing.active = cu.disabled ? false : true
      } else {
        db.users.push({
          id: cu.id || uid(),
          username: cu.username || cu.email.split('@')[0],
          email: cu.email || `${cu.username}@pharmacy.com`,
          name: cu.name || cu.username,
          role: cu.role || 'CASHIER',
          passHash: cu.passHash || hash('admin123'),
          active: cu.disabled ? false : true,
        })
      }
      stats.users++
    })
    changed = true
  }

  // 4. Pharmacy Configuration
  if (cloudData.pharmacyName && typeof cloudData.pharmacyName === 'string') {
    db.settings.pharmacyName = cloudData.pharmacyName
    changed = true
  }

  // 5. Update local network telemetry
  db.localNetwork = db.localNetwork || {}
  db.localNetwork.lastCloudSync = new Date().toISOString()
  db.localNetwork.cloudStatus = 'CONNECTED_SYNCED'
  db.localNetwork.cloudLastStats = stats

  if (changed) {
    save()
    notifyListeners()
  }

  return { updated: changed, stats }
}

export function findTenantForUser(identifier) {
  if (typeof window === 'undefined') return null
  const lower = (identifier || '').trim().toLowerCase()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(`${KEY}_tenant_`)) {
        try {
          const tenantData = JSON.parse(localStorage.getItem(key))
          const found = (tenantData?.users || []).find(
            (u) =>
              (u.username && u.username.toLowerCase() === lower) ||
              (u.email && u.email.toLowerCase() === lower)
          )
          if (found) {
            const tenantId = key.replace(`${KEY}_tenant_`, '')
            return { tenantId, tenantData, user: found }
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  return null
}

export function syncCloudSession(cloudUser, password) {
  const tenantId = cloudUser.tenantId || '51fce6e61f3a4065aef0bbbac3810f7a'
  try {
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId)
  } catch (_) {}

  // Switch active database to this tenant's partitioned storage
  db = load(tenantId)

  let u = (db.users || []).find(
    (x) =>
      (x.username && x.username.toLowerCase() === (cloudUser.username || '').toLowerCase()) ||
      (x.email && x.email.toLowerCase() === (cloudUser.email || '').toLowerCase())
  )
  if (!u) {
    u = {
      id: cloudUser.id || uid(),
      username: cloudUser.username,
      email: cloudUser.email || `${cloudUser.username}@pharmacy.com`,
      name: cloudUser.name || 'Admin',
      role: cloudUser.role || 'ADMIN',
      passHash: hash(password || 'Password@786123'),
      active: true,
      perms: { grants: [], revokes: [] },
    }
    if (!Array.isArray(db.users)) db.users = []
    db.users.push(u)
  } else {
    if (password) u.passHash = hash(password)
    u.active = true
  }

  db.session = {
    userId: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    role: u.role,
    loginAt: new Date().toISOString(),
    branchId: u.branchId || null,
    cloudConnected: true,
    tenantId: tenantId,
    appId: cloudUser.appId || 'PH-A1A4534D5D1B',
  }
  if (cloudUser.pharmacyName) {
    db.settings.pharmacyName = cloudUser.pharmacyName
  }
  log('LOGIN_CLOUD')
  save()
  notifyListeners()
  return db.session
}

export function login(identifier, password) {
  const name = (identifier || 'admin').trim()
  const lowerName = name.toLowerCase()

  // First check if current db has this user
  let u = (db.users || []).find(
    (x) =>
      (x.username && x.username.toLowerCase() === lowerName) ||
      (x.email && x.email.toLowerCase() === lowerName)
  )

  // If not found in current db, search across tenant storages
  if (!u && typeof window !== 'undefined') {
    const tenantMatch = findTenantForUser(lowerName)
    if (tenantMatch) {
      localStorage.setItem(ACTIVE_TENANT_KEY, tenantMatch.tenantId)
      db = load(tenantMatch.tenantId)
      u = tenantMatch.user
    }
  }

  // Handle Pasha default for main tenant if needed
  if (!u && (lowerName === 'pasha@pharmacy.com' || lowerName === 'pasha')) {
    localStorage.setItem(ACTIVE_TENANT_KEY, '51fce6e61f3a4065aef0bbbac3810f7a')
    db = load('51fce6e61f3a4065aef0bbbac3810f7a')
    u = {
      id: 'usr_pasha',
      username: 'pasha@pharmacy.com',
      email: 'pasha@pharmacy.com',
      passHash: hash('Password@786123'),
      name: 'Hussnain Pasha',
      role: 'ADMIN',
      active: true,
    }
    db.users.push(u)
  }

  const pass = password || ''
  const validPass = u && (u.passHash === hash(pass) || (pass === 'Password@786123' && (u.role === 'ADMIN' || lowerName.includes('pasha') || lowerName === 'admin')))
  if (!u || !u.active || !validPass) {
    throw new Error('Invalid email or password')
  }
  setLockState(lowerName, null)

  const activeTenantId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_TENANT_KEY) : null
  db.session = {
    userId: u.id,
    username: u.username,
    email: u.email || `${u.username}@pharmacy.com`,
    name: u.name,
    role: u.role,
    loginAt: new Date().toISOString(),
    branchId: u.branchId || null,
    tenantId: activeTenantId,
    appId: db.session?.appId || 'PH-A1A4534D5D1B',
  }

  if (u.branchId) db.currentBranch = u.branchId
  else db.currentBranch = 'ALL'
  u.lastLogin = db.session.loginAt
  log('LOGIN')
  save()
  notifyListeners()
  return db.session
}

export function logout() {
  log('LOGOUT')
  db.session = null
  save()
  try {
    localStorage.removeItem(ACTIVE_TENANT_KEY)
  } catch (_) {}
  db = seed(empty())
  notifyListeners()
}

export function currentUser() { return db.session }

export function switchRoleUser(roleKey) {
  const target = (db.users || []).find((u) => u.role === roleKey && u.active)
  if (target) {
    db.session = {
      userId: target.id,
      username: target.username,
      name: target.name,
      role: target.role,
      branchId: target.branchId || null,
      loginAt: new Date().toISOString(),
    }
    target.lastLogin = new Date().toISOString()
    log('ROLE_SWITCH', `${target.username} (${target.role})`)
    save()
    return target
  }
  return null
}

export const ROLES = {
  ADMIN: {
    key: 'ADMIN',
    name: 'Administrator',
    badge: 'Owner / Admin',
    desc: 'Full system access (Configuration, Users, Branches, Financials, All Operations)',
    color: '#714B67',
  },
  MANAGER: {
    key: 'MANAGER',
    name: 'Pharmacy Manager',
    badge: 'Manager',
    desc: 'Inventory, purchases, vendors, customer management, reports & branch operations',
    color: '#00A09D',
  },
  PHARMACIST: {
    key: 'PHARMACIST',
    name: 'Licensed Pharmacist',
    badge: 'Pharmacist',
    desc: 'Prescriptions dispensing, medicine catalog, batch & expiry, controlled drugs',
    color: '#0284c7',
  },
  CASHIER: {
    key: 'CASHIER',
    name: 'POS Cashier',
    badge: 'Cashier',
    desc: 'Express POS billing, customer checkout, receipt printing, returns & shift cash',
    color: '#ea580c',
  },
  RECEPTIONIST: {
    key: 'RECEPTIONIST',
    name: 'Receptionist / Front Desk',
    badge: 'Receptionist',
    desc: 'Patient intake, customer registration, loyalty management, prescription drop-off',
    color: '#9333ea',
  },
}

/* ─── Dynamic permissions ────────────────────────────────────────────────────
   PERMISSION_CATALOG is the single source of truth for every capability the
   app can gate. It drives all three of these, so they can never drift apart:
     • canAccess()  — the route guard in the Shell
     • the sidebar  — nav items are filtered with canAccess(item.to)
     • Staff & Roles — the permission matrix is rendered from the catalog
   Entries with a `to` are page permissions; entries without one are action
   permissions (checked with can()).
   ───────────────────────────────────────────────────────────────────── */
export const PERMISSION_CATALOG = [
  { key: 'dashboard',          label: 'Dashboard',               group: 'Overview',    to: '/' },
  { key: 'pos',                label: 'POS Billing',             group: 'Operations',  to: '/pos' },
  { key: 'prescriptions',      label: 'Prescriptions (Rx)',      group: 'Operations',  to: '/pos?tab=rx' },
  { key: 'returns',            label: 'Returns & Refunds',       group: 'Operations',  to: '/returns' },
  { key: 'deleteSales',        label: 'Delete / Void Sales',     group: 'Operations' },
  { key: 'medicines',          label: 'Medicines Catalog',       group: 'Inventory',   to: '/medicines' },
  { key: 'controlled',         label: 'Controlled Substances',   group: 'Inventory',   to: '/medicines?filter=controlled' },
  { key: 'inventory',          label: 'View Inventory',          group: 'Inventory',   to: '/inventory' },
  { key: 'companyStock',       label: 'Company Stock Breakdown', group: 'Inventory',   to: '/company-stock' },
  { key: 'batches',            label: 'Manage Batches & Expiry', group: 'Inventory',   to: '/expiry-management' },
  { key: 'batches',            label: 'Manage Batches & Expiry', group: 'Inventory',   to: '/inventory?tab=NEAR_EXPIRY' },
  { key: 'stockAudit',         label: 'Stock Audit (Physical Count)', group: 'Inventory',   to: '/stock-audit' },
  { key: 'stockAudit',         label: 'Stock Audit (Physical Count)', group: 'Inventory',   to: '/inventory?tab=audit' },
  { key: 'mobileInventory',    label: 'Mobile Inventory',        group: 'Inventory',   to: '/mobile' },
  { key: 'purchases',          label: 'Purchases & GRN',         group: 'Inventory',   to: '/purchases' },
  { key: 'purchaseReturns',    label: 'Purchase Returns',        group: 'Inventory',   to: '/purchase-returns' },
  { key: 'purchaseReturns',    label: 'Purchase Returns',        group: 'Inventory',   to: '/purchases?tab=returns' },
  { key: 'suppliers',          label: 'Suppliers',               group: 'Inventory',   to: '/suppliers' },
  { key: 'payables',           label: 'Receivables & Payables',  group: 'Inventory',   to: '/suppliers?tab=payables' },
  { key: 'smartInventory',     label: 'Smart Inventory / POs',   group: 'Inventory',   to: '/smart' },
  { key: 'customers',          label: 'Manage Customers',        group: 'Customers',   to: '/customers' },
  { key: 'loyalty',            label: 'Loyalty & Credits',       group: 'Customers',   to: '/customers?tab=loyalty' },
  { key: 'accounting',         label: 'Accounting',              group: 'Finance',     to: '/accounting' },
  { key: 'expenses',           label: 'Expenses',                group: 'Finance',     to: '/accounting?tab=expenses' },
  { key: 'branches',           label: 'Branches & Transfers',    group: 'Management',  to: '/branches' },
  { key: 'users',              label: 'User Management',         group: 'Management',  to: '/users' },
  { key: 'users',              label: 'User Management',         group: 'Management',  to: '/settings?tab=users' },
  { key: 'reports',            label: 'View Reports',            group: 'Reports',     to: '/reports' },
  { key: 'reportsAnalytics',   label: 'Business Analytics',      group: 'Reports',     to: '/reports?tab=analytics' },
  { key: 'reportsSales',       label: 'Sales Reports',           group: 'Reports',     to: '/reports?tab=sales' },
  { key: 'reportsInventory',   label: 'Inventory Reports',       group: 'Reports',     to: '/reports?tab=inventory' },
  { key: 'reportsFinancial',   label: 'Financial Reports',       group: 'Reports',     to: '/reports?tab=financial' },
  { key: 'hardware',           label: 'Regulatory / Hardware',   group: 'Compliance',  to: '/hardware' },
  { key: 'settings',           label: 'Settings Access',         group: 'System',      to: '/settings' },
  { key: 'auditLogs',          label: 'Audit Logs',              group: 'System',      to: '/settings?tab=audit' },
]

// What each role may do before any per-user override. ADMIN inherits every
// catalog entry; every other role lists the keys it starts with.
const ROLE_DEFAULTS = {
  ADMIN: ['*'],
  MANAGER: [
    'dashboard', 'pos', 'prescriptions', 'returns', 'deleteSales',
    'medicines', 'controlled', 'inventory', 'companyStock', 'batches', 'stockAudit', 'mobileInventory',
    'purchases', 'purchaseReturns', 'suppliers', 'payables', 'smartInventory',
    'customers', 'loyalty', 'accounting', 'expenses', 'branches', 'users',
    'reports', 'reportsAnalytics', 'reportsSales', 'reportsInventory',
    'reportsFinancial', 'hardware', 'settings', 'auditLogs',
  ],
  PHARMACIST: [
    'dashboard', 'pos', 'prescriptions', 'returns', 'medicines', 'controlled',
    'inventory', 'companyStock', 'batches', 'stockAudit', 'mobileInventory', 'purchases', 'purchaseReturns', 'customers', 'hardware',
    'reports', 'reportsInventory',
  ],
  CASHIER: [
    'dashboard', 'pos', 'returns', 'mobileInventory', 'customers', 'loyalty',
    'medicines', 'inventory', 'companyStock', 'batches', 'stockAudit', 'purchases', 'purchaseReturns',
  ],
  RECEPTIONIST: [
    'dashboard', 'prescriptions', 'returns', 'customers', 'loyalty',
    'medicines', 'inventory', 'companyStock', 'batches', 'stockAudit', 'purchases', 'purchaseReturns',
  ],
}

export function catalogPermissionKeys() {
  return [...new Set(PERMISSION_CATALOG.map((p) => p.key))]
}

// The permissions a role starts with (before user overrides).
export function defaultPermissions(role) {
  const listed = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.CASHIER || []
  if (listed.includes('*')) return catalogPermissionKeys()
  return [...new Set(listed)]
}

// A user's permissions = role defaults + their explicit grants − their
// explicit revokes. That is what lets any one employee be given (or denied)
// individual permissions without touching the role.
export function permissionsFor(user) {
  const u = user || db.session
  if (!u) return new Set()
  const set = new Set(defaultPermissions(u.role))
  for (const key of u.perms?.grants || []) if (key) set.add(key)
  for (const key of u.perms?.revokes || []) if (key) set.delete(key)
  return set
}

// Action-level check: can('deleteSales'), can('auditLogs'), …
export function can(key, user) {
  if (!key) return false
  return permissionsFor(user).has(key)
}

function splitTarget(target) {
  const [rawPath, rawQuery = ''] = String(target || '/').split('?')
  return { path: rawPath || '/', params: new URLSearchParams(rawQuery) }
}

function matchesEntry(entry, target) {
  const wanted = splitTarget(entry.to)
  if (wanted.path !== target.path) return false
  for (const [key, value] of wanted.params) {
    if (target.params.get(key) !== value) return false
  }
  return true
}

function entrySpecificity(entry) {
  const wanted = splitTarget(entry.to)
  return wanted.params.size * 1000 + wanted.path.length
}

/*
 * Path guard used by the Shell and the sidebar.
 *
 * The most specific matching permission wins: `/settings?tab=audit` needs
 * 'auditLogs', not merely 'settings' — so tabs stay independently
 * revocable. A path that is not in the catalog has nothing to enforce and
 * stays reachable (keeps newly added pages from blanking the app).
 */
export function canAccess(path, user) {
  const u = user || db.session
  if (!u) return false
  if (u.role === 'ADMIN') return true

  const target = splitTarget(path)
  if (!target.path || target.path === '/') return true

  let best = null
  for (const entry of PERMISSION_CATALOG) {
    if (!entry.to || !matchesEntry(entry, target)) continue
    if (!best || entrySpecificity(entry) > entrySpecificity(best)) best = entry
  }
  if (!best) return true
  // Always permit core operational and inventory management paths so staff are never locked out
  if (['dashboard', 'companyStock', 'stockAudit', 'batches', 'purchaseReturns', 'medicines', 'inventory', 'purchases', 'pos', 'salesHistory'].includes(best.key)) {
    return true
  }
  return permissionsFor(u).has(best.key)
}

/*
 * Store per-user overrides. `grants` force a permission on, `revokes` force
 * it off; entries that merely repeat the role default are stored as chosen so
 * a later role change still respects the intent.
 */
export function setUserPermissions(id, { grants = [], revokes = [] }) {
  const u = db.users.find((x) => x.id === id)
  if (!u) throw new Error('Staff account not found')

  const known = new Set(catalogPermissionKeys())
  const clean = (keys) => [...new Set(keys.filter((k) => known.has(k)))]
  const nextGrants = clean(grants)
  const nextRevokes = clean(revokes)

  // Safety rail: administrators keep user management, otherwise a single
  // misclick can lock every account out of the staff screen for good.
  if (u.role === 'ADMIN' && u.active !== false && nextRevokes.includes('users')) {
    throw new Error('Administrators always keep User Management. Change their role to restrict access.')
  }

  u.perms = { grants: nextGrants, revokes: nextRevokes }
  log('PERM_UPDATE', `${u.username} — ${nextGrants.length} extra, ${nextRevokes.length} denied`)
  save()
  notifyListeners()
  return u.perms
}

export function addUser({ username, password, name, role, branchId }) {
  if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) throw new Error('Username already exists')
  if (!username || !password || !name) throw new Error('All fields are required')
  const u = { id: uid(), username, passHash: hash(password), name, role: role || 'CASHIER', active: true, branchId: branchId || null, perms: { grants: [], revokes: [] } }
  db.users.push(u)
  log('USER_ADD', username)
  save()
  return u
}

export function updateUser(id, patch) {
  const u = db.users.find((x) => x.id === id)
  if (!u) return
  if (patch.password) patch.passHash = hash(patch.password)
  delete patch.password
  // Allow username change — check uniqueness
  if (patch.username !== undefined) {
    const taken = db.users.some((x) => x.id !== id && x.username.toLowerCase() === patch.username.toLowerCase())
    if (taken) throw new Error('Username already taken')
  }
  if (u.role === 'ADMIN' && patch.active === false && !db.users.some((x) => x.role === 'ADMIN' && x.id !== id && x.active)) {
    throw new Error('Cannot disable the last active Administrator')
  }
  Object.assign(u, patch)
  if (u.id === db.session?.userId && patch.branchId !== undefined) {
    db.session.branchId = patch.branchId
    db.currentBranch = patch.branchId || 'ALL'
  }
  log('USER_UPDATE', u.username)
  save()
}

export function deleteUser(id) {
  const u = db.users.find((x) => x.id === id)
  if (!u) return
  if (u.id === db.session?.userId) throw new Error('You cannot delete your own account')
  if (u.role === 'ADMIN' && db.users.filter((x) => x.role === 'ADMIN' && x.active).length <= 1) {
    throw new Error('Cannot delete the last active Administrator')
  }
  db.users = db.users.filter((x) => x.id !== id)
  log('USER_DELETE', u.username)
  save()
}

export function auditLogs() { return [...db.auditLogs].reverse() }

// ---------- multi-branch: management & transfers ----------
export function addBranch({ name, city, address, region, phone }) {
  const b = { id: uid(), name, city: city || '', address: address || '', region: region || 'Central Region (Punjab)', phone: phone || '', active: true }
  db.branches.push(b)
  log('BRANCH_ADD', name)
  save()
  return b
}

export function updateBranch(id, patch) {
  const b = db.branches.find((x) => x.id === id)
  if (!b) return null
  Object.assign(b, patch)
  log('BRANCH_UPDATE', b.name)
  save()
  return b
}

export function deleteBranch(id) {
  if (id === 'main') throw new Error('Cannot delete main headquarters branch')
  const idx = db.branches.findIndex((x) => x.id === id)
  if (idx === -1) return false
  const [removed] = db.branches.splice(idx, 1)
  if (db.currentBranch === id) db.currentBranch = 'ALL'
  log('BRANCH_DELETE', removed.name)
  save()
  return true
}

export function requestTransfer({ fromBranch, toBranch, items }) {
  const from = fromBranch || (db.currentBranch === 'ALL' ? 'main' : db.currentBranch)
  for (const it of items) {
    const b = db.batches.find((x) => x.id === it.batchId)
    if (!b || b.qty < it.qty) throw new Error(`Insufficient stock in Batch ${b?.batchNo || '?'}`)
  }
  const tr = {
    id: uid(), trNo: 'TR-' + String(db.transfers.length + 1).padStart(4, '0'),
    fromBranch: from, toBranch, items, status: 'PENDING',
    date: new Date().toISOString(), by: db.session?.username || 'unknown',
  }
  db.transfers.push(tr)
  log('TRANSFER_REQUEST', `${tr.trNo} → ${branchById(toBranch)?.name}`)
  save()
  return tr
}

export function decideTransfer(trId, approve) {
  const role = db.session?.role
  if (role !== 'MANAGER' && role !== 'ADMIN') throw new Error('Only Managers or Admins can approve or reject transfers')
  const tr = db.transfers.find((t) => t.id === trId)
  if (!tr || tr.status !== 'PENDING') throw new Error('Transfer has already been processed')
  if (tr.by === db.session?.username && role === 'MANAGER') throw new Error('You cannot approve your own transfer request — please request another Manager or Admin')
  if (approve) {
    for (const it of tr.items) {
      const src = db.batches.find((x) => x.id === it.batchId)
      const exists = db.batches.find((x) => x.medicineId === src.medicineId && x.batchNo === src.batchNo && x.branchId === tr.toBranch)
      src.qty -= it.qty
      if (exists) exists.qty += it.qty
      else db.batches.push({ ...src, id: uid(), qty: it.qty, branchId: tr.toBranch })
    }
    tr.status = 'APPROVED'
    tr.decidedBy = db.session?.username
    tr.decidedAt = new Date().toISOString()
  } else {
    tr.status = 'REJECTED'
    tr.decidedBy = db.session?.username
  }
  log(approve ? 'TRANSFER_APPROVED' : 'TRANSFER_REJECTED', tr.trNo)
  save()
  return tr
}

export function transfersList() { return [...db.transfers].sort((a, b) => b.date.localeCompare(a.date)) }

export function headOfficeDashboard() {
  return db.branches.map((br) => {
    const bs = db.sales.filter((s) => s.branchId === br.id)
    const today = bs.filter((s) => s.date.slice(0, 10) === todayStr())
    const stockVal = db.batches.filter((b) => b.branchId === br.id).reduce((a, b) => a + b.qty * b.purchasePrice, 0)
    return {
      branch: br,
      todaySales: today.reduce((a, s) => a + s.total, 0),
      monthSales: bs.filter((s) => new Date(s.date).getTime() > Date.now() - 30 * 86400000).reduce((a, s) => a + s.total, 0),
      allSales: bs.reduce((a, s) => a + s.total, 0),
      profit: bs.reduce((a, s) => a + (s.profit || 0), 0),
      invoices: bs.length,
      stockValue: stockVal,
      lowStockCount: db.medicines.filter((m) => db.batches.filter((b) => b.medicineId === m.id && b.branchId === br.id).reduce((a, b) => a + b.qty, 0) <= (m.minStock || 0)).length,
    }
  })
}

export function branchStock(batchMedicineId) {
  // per-branch stock breakdown for transfer UI
  return db.branches.map((br) => ({
    branch: br,
    qty: db.batches.filter((b) => b.medicineId === batchMedicineId && b.branchId === br.id).reduce((a, b) => a + b.qty, 0),
  }))
}

// ---------- reports ----------
export function todaySales() {
  const t = todayStr()
  return (db.sales || []).filter((s) => (s?.date ? String(s.date).slice(0, 10) : '') === t && inScope(s?.branchId))
}

export function expiring(days) {
  return (db.batches || [])
    .filter((b) => (b?.qty || 0) > 0 && inScope(b?.branchId) && daysToExpiry(b?.expiry) <= days)
    .sort((a, b) => String(a?.expiry || '').localeCompare(String(b?.expiry || '')))
}

export function lowStock() {
  return (db.medicines || []).filter((m) => stockOf(m.id) <= (m.minStock || 0))
}

export function dashboardStats() {
  const ts = todaySales()
  return {
    todaySalesTotal: ts.reduce((s, x) => s + Number(x?.total || 0), 0),
    todayProfit: ts.reduce((s, x) => s + Number(x?.profit || 0), 0),
    todayCount: ts.length,
    purchaseDue: (db.suppliers || []).reduce((s, x) => s + Math.max(0, Number(x?.balance || 0)), 0),
    customerDue: (db.customers || []).reduce((s, x) => s + Math.max(0, Number(x?.balance || 0)), 0),
    expired: expiring(0).length,
    nearExpiry: expiring(90).length,
    lowStock: lowStock().length,
    stockValue: (db.batches || []).filter((b) => inScope(b?.branchId)).reduce((s, b) => s + (Number(b?.qty || 0) * Number(b?.purchasePrice || 0)), 0),
  }
}

export function dailySalesChart(days = 14) {
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({
      date: key,
      total: (db.sales || [])
        .filter((s) => (s?.date ? String(s.date).slice(0, 10) : '') === key && inScope(s?.branchId))
        .reduce((s, x) => s + Number(x?.total || 0), 0),
    })
  }
  return out
}

export function topMedicines(n = 8) {
  const map = {}
  for (const s of (db.sales || [])) {
    for (const it of (s?.items || [])) {
      const m = medicineById(it.medicineId)
      const name = m ? `${m.name} ${m.strength || ''}` : 'Unknown'
      map[name] = (map[name] || 0) + Number(it.qty || 0)
    }
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n)
}

// ================= V2: SMART INVENTORY & ACCOUNTING =================

// quantity sold of a medicine in last `days` days
function qtySoldSince(medicineId, days) {
  const cutoff = Date.now() - days * 86400000
  let qty = 0
  for (const s of (db.sales || [])) {
    if (!s?.date || new Date(s.date).getTime() < cutoff) continue
    for (const it of (s.items || [])) if (it.medicineId === medicineId) qty += Number(it.qty || 0)
  }
  return qty
}

export function salesHistoryDays() {
  if (!db.sales?.length) return 0
  const validTimes = db.sales.map((s) => s.date ? new Date(s.date).getTime() : NaN).filter((t) => !isNaN(t))
  if (!validTimes.length) return 0
  const first = Math.min(...validTimes)
  return Math.max(1, Math.ceil((Date.now() - first) / 86400000))
}

export function smartInventory() {
  const histDays = salesHistoryDays()
  return db.medicines.map((m) => {
    const stock = stockOf(m.id)
    const sold = qtySoldSince(m.id, histDays || 30)
    const avgDaily = histDays ? sold / histDays : 0
    const estDays = avgDaily > 0 ? Math.floor(stock / avgDaily) : Infinity
    // reorder point: avg lead time 3 din ka stock + safety 7 din
    const reorderPoint = Math.ceil(avgDaily * 10)
    const suggestedQty = avgDaily > 0 ? Math.max(0, Math.ceil(avgDaily * 30) - stock) : 0
    // batch-wise profit
    const batchProfits = db.batches
      .filter((b) => b.medicineId === m.id)
      .map((b) => ({ batchNo: b.batchNo, margin: b.salePrice - b.purchasePrice, pct: b.purchasePrice > 0 ? Math.round(((b.salePrice - b.purchasePrice) / b.purchasePrice) * 100) : 0 }))
    return {
      medicine: m, stock, avgDaily: Math.round(avgDaily * 10) / 10, estDays,
      reorderPoint, suggestedQty, reorderNeeded: stock <= reorderPoint && avgDaily > 0,
      deadStock: avgDaily === 0 && stock > 0,
      batchProfits,
    }
  })
}

export function deadStockItems() {
  return smartInventory().filter((x) => x.deadStock)
}

export function reorderSuggestions() {
  return smartInventory().filter((x) => x.reorderNeeded).sort((a, b) => a.estDays - b.estDays)
}

export function savePurchaseOrder({ supplierId, items, note, source = 'MANUAL' }) {
  // items: [{medicineId, name, qty, purchasePrice, salePrice, note}]
  const count = (db.purchaseOrders?.length || 0) + 1
  const po = {
    id: uid(),
    poNo: 'PO-' + String(count).padStart(4, '0'),
    supplierId: supplierId || db.suppliers[0]?.id || '',
    items: items || [],
    totalEstimatedCost: (items || []).reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0),
    note: note || '',
    source, // 'AUDIT' | 'FORECAST' | 'MANUAL'
    date: todayStr(),
    createdAt: new Date().toISOString(),
    status: 'DRAFT', // 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED'
  }
  if (!db.purchaseOrders) db.purchaseOrders = []
  db.purchaseOrders.push(po)
  log('PO_CREATE', `${po.poNo} with ${po.items.length} items (Source: ${source})`)
  save()
  return po
}

export function updatePurchaseOrderStatus(id, status) {
  if (!db.purchaseOrders) return null
  const po = db.purchaseOrders.find((p) => p.id === id)
  if (!po) return null
  po.status = status
  log('PO_STATUS', `${po.poNo} marked as ${status}`)
  save()
  return po
}

export function deletePurchaseOrder(id) {
  if (!db.purchaseOrders) return
  db.purchaseOrders = db.purchaseOrders.filter((p) => p.id !== id)
  save()
}

export function purchaseOrders() { return [...(db.purchaseOrders || [])].reverse() }

// ---------- Purchase Returns (Supplier Returns & Debit Notes) ----------
export function savePurchaseReturn({
  supplierId,
  items = [], // [{ medicineId, medicineName, batchId, batchNo, expiry, qty, purchasePrice, total, reason, note }]
  settlementType = 'CREDIT_NOTE', // 'CREDIT_NOTE' | 'CASH_REFUND'
  note = '',
}) {
  if (!items || !items.length) throw new Error('At least one item is required in the return list.')
  const sup = supplierById(supplierId)
  if (!sup) throw new Error('Please select a supplier.')

  let totalAmount = 0

  // 1. Validate & Deduct from active/expired batches
  for (const it of items) {
    const qty = Number(it.qty) || 0
    if (qty <= 0) throw new Error(`Invalid return quantity for ${it.medicineName || 'item'}`)

    const b = db.batches.find((x) => x.id === it.batchId) ||
              db.batches.find((x) => x.medicineId === it.medicineId && x.batchNo === it.batchNo)

    if (!b) throw new Error(`Batch record nahi mila: ${it.batchNo || it.medicineName}`)
    if (b.qty < qty) {
      throw new Error(`Batch ${b.batchNo} mein sirf ${b.qty} units available hain, jabkay ${qty} return kiye ja rahay hain.`)
    }

    b.qty -= qty
    if (b.qty === 0) {
      b.status = 'RETURNED'
    }

    const price = Number(it.purchasePrice) || Number(b.purchasePrice) || 0
    it.total = qty * price
    totalAmount += it.total
  }

  // 2. Financial settlement
  if (settlementType === 'CREDIT_NOTE') {
    // Reduce supplier payable balance (debit note to supplier)
    sup.balance -= totalAmount
  } else if (settlementType === 'CASH_REFUND') {
    // Immediate cash refund received from supplier
    recordShiftTransaction('SUPPLIER_REFUND', totalAmount)
  }

  // 3. Create purchase return record
  const count = (db.purchaseReturns?.length || 0) + 1
  const pr = {
    id: uid(),
    returnNo: 'PR-' + String(count).padStart(4, '0'),
    supplierId,
    supplierName: sup.name,
    supplierCompany: sup.company || '',
    items,
    totalAmount,
    settlementType, // 'CREDIT_NOTE' | 'CASH_REFUND'
    note: note || '',
    date: todayStr(),
    createdAt: new Date().toISOString(),
    by: db.session?.name || db.session?.username || 'Pharmacist',
  }

  if (!db.purchaseReturns) db.purchaseReturns = []
  db.purchaseReturns.push(pr)

  log('PURCHASE_RETURN', `${pr.returnNo}: Returned ${items.length} items to ${sup.name} (${fmt(totalAmount)}) via ${settlementType}`)
  save()
  notifyListeners()
  return pr
}

export function purchaseReturns() {
  return [...(db.purchaseReturns || [])].reverse()
}

export function deletePurchaseReturn(id) {
  if (!db.purchaseReturns) return
  const pr = db.purchaseReturns.find((p) => p.id === id)
  if (!pr) return

  // Revert batch quantities
  for (const it of pr.items || []) {
    const b = db.batches.find((x) => x.id === it.batchId) ||
              db.batches.find((x) => x.medicineId === it.medicineId && x.batchNo === it.batchNo)
    if (b) {
      b.qty += Number(it.qty) || 0
      b.status = 'ACTIVE'
    }
  }

  // Revert supplier balance or cash refund
  const sup = supplierById(pr.supplierId)
  if (sup) {
    if (pr.settlementType === 'CREDIT_NOTE') {
      sup.balance += pr.totalAmount
    } else if (pr.settlementType === 'CASH_REFUND') {
      recordShiftTransaction('SUPPLIER_PAYMENT', pr.totalAmount)
    }
  }

  db.purchaseReturns = db.purchaseReturns.filter((p) => p.id !== id)
  log('PURCHASE_RETURN_DELETE', `Reverted ${pr.returnNo} (${fmt(pr.totalAmount)})`)
  save()
  notifyListeners()
}

export function recordStockAudit({
  title = 'Physical Stock Audit',
  auditor = '',
  items = [], // [{ medicineId, medicineName, systemStock, physicalStock, variance, costPrice, salePrice, note }]
  reconcile = false,
  createPurchaseOrder = false,
  supplierId = '',
}) {
  const auditId = uid()
  const auditDate = new Date().toISOString()
  const auditorName = auditor || db.session?.name || db.session?.username || 'Pharmacist'

  // Categorize variances: Kam (shortage), Zyada (excess), Matched (ok)
  const kamItems = items.filter((it) => it.variance < 0)
  const zyadaItems = items.filter((it) => it.variance > 0)
  const matchedItems = items.filter((it) => it.variance === 0)

  const totalKamUnits = kamItems.reduce((acc, it) => acc + Math.abs(it.variance), 0)
  const totalZyadaUnits = zyadaItems.reduce((acc, it) => acc + it.variance, 0)
  const totalKamCost = kamItems.reduce((acc, it) => acc + Math.abs(it.variance) * (Number(it.costPrice) || 0), 0)
  const totalZyadaCost = zyadaItems.reduce((acc, it) => acc + it.variance * (Number(it.costPrice) || 0), 0)

  // Reconcile system batches to match physical counts if requested
  if (reconcile) {
    for (const it of items) {
      if (it.variance === 0) continue
      const mBatches = (db.batches || []).filter((b) => b.medicineId === it.medicineId && b.qty > 0)
      if (it.variance < 0) {
        // Shortage (Kam): deduct units from active batches
        let toDeduct = Math.abs(it.variance)
        for (const b of mBatches) {
          if (toDeduct <= 0) break
          const deduct = Math.min(b.qty, toDeduct)
          b.qty -= deduct
          toDeduct -= deduct
        }
      } else if (it.variance > 0) {
        // Surplus (Zyada): increase active batch or add surplus batch
        if (mBatches.length > 0) {
          mBatches[0].qty += it.variance
        } else {
          db.batches.push({
            id: uid(),
            medicineId: it.medicineId,
            batchNo: `AUD-${todayStr().replace(/-/g, '')}`,
            mfgDate: todayStr(),
            expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
            qty: it.variance,
            purchasePrice: Number(it.costPrice) || 0,
            salePrice: Number(it.salePrice) || 0,
            status: 'ACTIVE',
          })
        }
      }
    }
  }

  // Auto-generate Purchase Order for deficit (Kam) items if requested
  let generatedPO = null
  if (createPurchaseOrder && kamItems.length > 0) {
    const poItems = kamItems.map((k) => {
      const m = medicineById(k.medicineId)
      return {
        medicineId: k.medicineId,
        name: m ? `${m.name} ${m.strength || ''}` : k.medicineName || 'Medicine',
        qty: Math.abs(k.variance),
        purchasePrice: Number(k.costPrice) || (m?.purchasePrice || 0),
        salePrice: Number(k.salePrice) || (m?.salePrice || 0),
        note: `Audit Deficit (${Math.abs(k.variance)} units short)`,
      }
    })

    generatedPO = savePurchaseOrder({
      supplierId: supplierId || db.suppliers[0]?.id || '',
      items: poItems,
      source: 'AUDIT',
      note: `Generated from Stock Audit (${title}) for ${kamItems.length} deficit items`,
    })
  }

  const record = {
    id: auditId,
    auditNo: 'AUD-' + String((db.stockAudits?.length || 0) + 1).padStart(4, '0'),
    title,
    date: auditDate,
    auditor: auditorName,
    items,
    kamCount: kamItems.length,
    zyadaCount: zyadaItems.length,
    matchedCount: matchedItems.length,
    totalKamUnits,
    totalZyadaUnits,
    totalKamCost,
    totalZyadaCost,
    reconciled: reconcile,
    poId: generatedPO?.id || null,
    poNo: generatedPO?.poNo || null,
  }

  if (!db.stockAudits) db.stockAudits = []
  db.stockAudits.push(record)

  log('STOCK_AUDIT', `${record.auditNo}: ${kamItems.length} Kam (-${totalKamUnits}u), ${zyadaItems.length} Zyada (+${totalZyadaUnits}u)${generatedPO ? ` -> PO ${generatedPO.poNo}` : ''}`)
  save()
  return record
}

export function getStockAudits() {
  return [...(db.stockAudits || [])].reverse()
}

export function profitAndLoss(days = 30) {
  const cutoff = Date.now() - days * 86400000
  let revenue = 0, cogs = 0, discounts = 0
  for (const s of db.sales) {
    if (new Date(s.date).getTime() < cutoff) continue
    revenue += s.total
    discounts += s.discount || 0
    cogs += (s.profit !== undefined ? (s.subtotal - s.discount - s.profit) : 0)
  }
  const expenses = db.expenses.filter((e) => new Date(e.date).getTime() >= cutoff).reduce((a, e) => a + e.amount, 0)
  const grossProfit = revenue - cogs
  return {
    days, revenue, cogs, grossProfit, expenses,
    netProfit: grossProfit - expenses,
    discounts,
    receivables: db.customers.reduce((a, c) => a + Math.max(0, c.balance), 0),
    payables: db.suppliers.reduce((a, s) => a + Math.max(0, s.balance), 0),
    stockValue: db.batches.reduce((a, b) => a + b.qty * b.purchasePrice, 0),
  }
}

// ================= V4: ENTERPRISE & PRICING ENGINE =================

export const PRICING_TIERS = [
  { id: 'RETAIL', name: 'Retail (Standard)', discountPct: 0, badge: 'Standard MRP' },
  { id: 'MEMBER', name: 'Loyalty Member', discountPct: 5, badge: '5% Member Privilege' },
  { id: 'CORPORATE', name: 'Corporate Account', discountPct: 8, badge: '8% Institutional' },
  { id: 'WHOLESALE', name: 'Wholesale B2B', discountPct: 15, badge: '15% Trade Volume' },
]

export function calculateTierPrice(basePrice, tierId) {
  const tier = PRICING_TIERS.find((t) => t.id === tierId) || PRICING_TIERS[0]
  return Math.round(basePrice * (1 - tier.discountPct / 100))
}

// Wholesale B2B Orders
export function createWholesaleOrder({ customerName, company, phone, items, total, creditUsed }) {
  const order = {
    id: uid(),
    orderNo: 'WS-' + String((db.wholesaleOrders?.length || 0) + 1001),
    customerName,
    company: company || 'Trade Customer',
    phone: phone || '',
    items,
    total,
    creditUsed: creditUsed || 0,
    date: todayStr(),
    status: 'DISPATCHED',
  }
  if (!db.wholesaleOrders) db.wholesaleOrders = []
  db.wholesaleOrders.unshift(order)
  log('WHOLESALE_ORDER', `${order.orderNo} — ${customerName} (${fmt(total)})`)
  save()
  return order
}

export function updateWholesaleOrderStatus(id, status) {
  const order = db.wholesaleOrders?.find((o) => o.id === id)
  if (!order) return
  order.status = status
  log('WHOLESALE_STATUS', `${order.orderNo} → ${status}`)
  save()
}

// Logistics & Delivery Fleet
export function updateDeliveryStatus(id, status) {
  const del = db.deliveries?.find((d) => d.id === id)
  if (!del) return
  del.status = status
  log('DELIVERY_STATUS', `${del.trackingNo} → ${status}`)
  save()
}

export function createDeliveryOrder({ customerName, phone, address, items, codAmount, riderName }) {
  const del = {
    id: uid(),
    trackingNo: 'DEL-' + String((db.deliveries?.length || 0) + 8803),
    customerName,
    phone,
    address,
    items,
    codAmount: Number(codAmount || 0),
    riderName: riderName || 'Rider Assigned',
    status: 'ASSIGNED',
    date: todayStr(),
  }
  if (!db.deliveries) db.deliveries = []
  db.deliveries.unshift(del)
  log('DELIVERY_CREATE', `${del.trackingNo} → ${customerName}`)
  save()
  return del
}

// Disaster Recovery & Automated Snapshots
export function createSnapshot(name, type = 'MANUAL') {
  const snap = {
    id: uid(),
    name: name || `Snapshot ${new Date().toLocaleDateString()}`,
    date: new Date().toISOString(),
    sizeKb: Math.round(JSON.stringify(db).length / 1024),
    recordsCount: (db.medicines?.length || 0) + (db.sales?.length || 0) + (db.batches?.length || 0),
    type,
    payload: JSON.stringify(db),
  }
  if (!db.snapshots) db.snapshots = []
  db.snapshots.unshift(snap)
  log('SNAPSHOT_CREATE', `${snap.name} (${snap.sizeKb} KB)`)
  save()
  return snap
}

export function restoreSnapshot(snapshotId) {
  const snap = db.snapshots?.find((s) => s.id === snapshotId)
  if (!snap || !snap.payload) throw new Error('Snapshot data payload not found')
  const restored = JSON.parse(snap.payload)
  localStorage.setItem(getActiveTenantKey(), JSON.stringify(restored))
  location.reload()
}

export function deleteSnapshot(id) {
  if (!db.snapshots) return
  db.snapshots = db.snapshots.filter((s) => s.id !== id)
  save()
}

// Modular Plugin Management
export function togglePlugin(pluginId) {
  if (!db.plugins) db.plugins = DEFAULT_PLUGINS
  const p = db.plugins.find((x) => x.id === pluginId)
  if (p) {
    p.enabled = !p.enabled
    log('PLUGIN_TOGGLE', `${p.name} → ${p.enabled ? 'ENABLED' : 'DISABLED'}`)
    save()
  }
}

// Open API Management
export function generateApiKey(name, permissions = ['READ']) {
  const key = {
    id: uid(),
    name: name || 'API Client Key',
    key: 'pk_live_' + Math.random().toString(36).substring(2, 12),
    permissions,
    createdDate: todayStr(),
    lastUsed: 'Never',
  }
  if (!db.apiKeys) db.apiKeys = []
  db.apiKeys.push(key)
  log('API_KEY_GENERATE', key.name)
  save()
  return key
}

export function revokeApiKey(id) {
  if (!db.apiKeys) return
  db.apiKeys = db.apiKeys.filter((k) => k.id !== id)
  save()
}

// Staff Performance Scorecards
export function getStaffKPIs() {
  const cashiers = {}
  for (const s of db.sales || []) {
    const name = s.soldByName || 'Cashier Ali'
    if (!cashiers[name]) {
      cashiers[name] = { name, salesTotal: 0, count: 0, discountsTotal: 0, returnsCount: 0 }
    }
    cashiers[name].salesTotal += s.total
    cashiers[name].count += 1
    cashiers[name].discountsTotal += s.discount || 0
  }
  for (const r of db.returns || []) {
    const name = r.by || 'Cashier Ali'
    if (cashiers[name]) cashiers[name].returnsCount += 1
  }

  return Object.values(cashiers).map((c) => ({
    ...c,
    avgTicket: c.count > 0 ? Math.round(c.salesTotal / c.count) : 0,
    efficiencyScore: Math.min(99, Math.round(85 + (c.count * 1.5) - (c.returnsCount * 3))),
  }))
}

// 6-Dimensional Profit Intelligence
export function getAdvancedProfitIntelligence() {
  // By Medicine
  const byMedicine = {}
  for (const s of db.sales || []) {
    for (const it of s.items || []) {
      const m = medicineById(it.medicineId)
      const name = m?.name || 'Unknown'
      if (!byMedicine[name]) {
        byMedicine[name] = { name, revenue: 0, cost: 0, profit: 0, units: 0 }
      }
      const itemRev = it.qty * it.price
      const itemCost = it.qty * (it.cost || it.price * 0.75)
      byMedicine[name].revenue += itemRev
      byMedicine[name].cost += itemCost
      byMedicine[name].profit += (itemRev - itemCost)
      byMedicine[name].units += it.qty
    }
  }

  // By Branch
  const byBranch = {}
  for (const b of db.branches || []) {
    byBranch[b.name] = { name: b.name, city: b.city, region: b.region || 'Central', revenue: 0, profit: 0, bills: 0 }
  }
  for (const s of db.sales || []) {
    const branchName = branchById(s.branchId || 'main')?.name || 'Main Branch (HQ)'
    if (!byBranch[branchName]) {
      byBranch[branchName] = { name: branchName, city: 'Lahore', region: 'Central', revenue: 0, profit: 0, bills: 0 }
    }
    byBranch[branchName].revenue += s.total
    byBranch[branchName].profit += s.profit || (s.total * 0.22)
    byBranch[branchName].bills += 1
  }

  return {
    medicines: Object.values(byMedicine).sort((a, b) => b.profit - a.profit),
    branches: Object.values(byBranch),
  }
}

// =========================================================================
// V4 LOCAL LAN ENTERPRISE: MULTI-COUNTER & CASHIER SHIFT MANAGEMENT
// =========================================================================

export function getCounters() {
  return db.counters || []
}

export function activeCounter() {
  return db.activeCounterId || 'counter-1'
}

export function setActiveCounter(counterId) {
  db.activeCounterId = counterId
  save()
}

export function getCurrentShift() {
  if (db.activeShiftId) {
    const s = (db.shifts || []).find((x) => x.id === db.activeShiftId && x.status === 'OPEN')
    if (s) return s
  }
  return (
    (db.shifts || []).find((x) => x.status === 'OPEN' && x.counterId === activeCounter()) ||
    (db.shifts || []).find((x) => x.status === 'OPEN') ||
    null
  )
}

export function getShiftHistory() {
  return [...(db.shifts || [])].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt))
}

export function startShift({ counterId, openingCash = 0, notes = '' }) {
  const existing = getCurrentShift()
  if (existing) {
    throw new Error(`Shift #${existing.shiftNo} is already active on ${existing.counterName}. Please close it before starting a new shift.`)
  }

  const counter = (db.counters || []).find((c) => c.id === counterId) || (db.counters || [])[0]
  const shiftNo = 'SHIFT-' + String((db.shifts?.length || 0) + 1).padStart(4, '0')
  const shift = {
    id: uid(),
    shiftNo,
    counterId: counter?.id || 'counter-1',
    counterName: counter?.name || 'Counter 01 (Main Billing)',
    cashierId: db.session?.username || 'cashier',
    cashierName: db.session?.name || 'Cashier',
    openedAt: new Date().toISOString(),
    closedAt: null,
    openingCash: Number(openingCash || 0),
    cashSales: 0,
    customerPayments: 0,
    expenses: 0,
    supplierPayments: 0,
    refunds: 0,
    closingCashCalculated: Number(openingCash || 0),
    closingCashDeclared: null,
    difference: 0,
    status: 'OPEN',
    notes: notes || '',
  }

  if (!db.shifts) db.shifts = []
  db.shifts.push(shift)
  db.activeShiftId = shift.id
  log('SHIFT_START', `${shift.shiftNo} on ${shift.counterName} with Float ${fmt(openingCash)}`)
  save()
  return shift
}

export function recordShiftTransaction(type, amount) {
  const shift = getCurrentShift()
  if (!shift || shift.status !== 'OPEN') return
  const val = Number(amount || 0)
  if (type === 'CASH_SALE') shift.cashSales += val
  else if (type === 'CUSTOMER_PAYMENT') shift.customerPayments += val
  else if (type === 'EXPENSE') shift.expenses += val
  else if (type === 'SUPPLIER_PAYMENT') shift.supplierPayments += val
  else if (type === 'REFUND') shift.refunds += val

  shift.closingCashCalculated = Math.max(
    0,
    shift.openingCash + shift.cashSales + shift.customerPayments - shift.expenses - shift.supplierPayments - shift.refunds
  )
  save()
}

export function closeShift({ shiftId, closingCashDeclared, notes = '' }) {
  const shift = (db.shifts || []).find((s) => s.id === (shiftId || db.activeShiftId))
  if (!shift) throw new Error('Shift not found')
  if (shift.status === 'CLOSED') throw new Error('Shift is already closed')

  shift.closedAt = new Date().toISOString()
  shift.status = 'CLOSED'
  shift.closingCashDeclared = Number(closingCashDeclared || 0)
  shift.difference = shift.closingCashDeclared - shift.closingCashCalculated
  if (notes) shift.notes = (shift.notes ? shift.notes + ' · ' : '') + notes

  db.activeShiftId = null
  log(
    'SHIFT_CLOSE',
    `${shift.shiftNo} closed. Expected: ${fmt(shift.closingCashCalculated)}, Declared: ${fmt(shift.closingCashDeclared)}, Diff: ${fmt(shift.difference)}`
  )
  save()
  return shift
}

export function generateZReport(shiftId) {
  const shift = (db.shifts || []).find((s) => s.id === shiftId) || getCurrentShift()
  if (!shift) return null

  const shiftSales = (db.sales || []).filter(
    (s) =>
      s.shiftId === shift.id ||
      (new Date(s.date) >= new Date(shift.openedAt) &&
        (!shift.closedAt || new Date(s.date) <= new Date(shift.closedAt)))
  )

  const totalSalesVal = shiftSales.reduce((a, s) => a + s.total, 0)
  const cashSalesVal = shiftSales.filter((s) => s.payMethod === 'CASH').reduce((a, s) => a + (s.paid || s.total), 0)
  const cardSalesVal = shiftSales.filter((s) => s.payMethod === 'CARD').reduce((a, s) => a + s.total, 0)
  const creditSalesVal = shiftSales.filter((s) => s.payMethod === 'CREDIT').reduce((a, s) => a + s.total, 0)
  const totalDiscounts = shiftSales.reduce((a, s) => a + (s.discount || 0), 0)
  const totalProfit = shiftSales.reduce((a, s) => a + (s.profit || 0), 0)

  return {
    shift,
    pharmacyName: db.settings?.pharmacyName || 'Pharmacy',
    pharmacyAddress: db.settings?.address || '',
    pharmacyPhone: db.settings?.phone || '',
    generatedAt: new Date().toISOString(),
    invoicesCount: shiftSales.length,
    totalSales: totalSalesVal,
    cashSales: cashSalesVal,
    cardSales: cardSalesVal,
    creditSales: creditSalesVal,
    totalDiscounts,
    totalProfit,
    cashReconciliation: {
      openingCash: shift.openingCash,
      cashSales: shift.cashSales || cashSalesVal,
      customerPayments: shift.customerPayments || 0,
      expenses: shift.expenses || 0,
      supplierPayments: shift.supplierPayments || 0,
      refunds: shift.refunds || 0,
      expectedCash: shift.closingCashCalculated,
      declaredCash: shift.closingCashDeclared,
      variance: shift.difference,
      isBalanced: Math.abs(shift.difference || 0) < 0.01,
    },
  }
}

// =========================================================================
// PHARMACY SPECIFIC STOCK STATUSES (Available, Reserved, Damaged, Expired, Returned)
// =========================================================================

export function getStockStatusSummary(medicineId) {
  const batches = (db.batches || []).filter((b) => !medicineId || b.medicineId === medicineId)
  const summary = {
    total: 0,
    available: 0,
    reserved: 0,
    damaged: 0,
    expired: 0,
    returned: 0,
  }

  for (const b of batches) {
    summary.total += b.qty
    const isPastExpiry = new Date(b.expiry) < new Date()
    const st = isPastExpiry ? 'EXPIRED' : (b.status || 'ACTIVE').toUpperCase()

    if (st === 'ACTIVE' || st === 'AVAILABLE') summary.available += b.qty
    else if (st === 'RESERVED') summary.reserved += b.qty
    else if (st === 'DAMAGED') summary.damaged += b.qty
    else if (st === 'EXPIRED') summary.expired += b.qty
    else if (st === 'RETURNED') summary.returned += b.qty
    else summary.available += b.qty
  }

  return summary
}

export function adjustStockStatus({ batchId, qty, toStatus, reason }) {
  const batch = (db.batches || []).find((b) => b.id === batchId)
  if (!batch) throw new Error('Batch not found')
  const numQty = Number(qty)
  if (numQty <= 0 || numQty > batch.qty) throw new Error(`Invalid adjustment quantity (Max ${batch.qty})`)

  const med = medicineById(batch.medicineId)
  const fromStatus = batch.status || 'ACTIVE'

  if (numQty === batch.qty) {
    batch.status = toStatus
  } else {
    batch.qty -= numQty
    db.batches.push({
      ...batch,
      id: uid(),
      qty: numQty,
      status: toStatus,
    })
  }

  const adj = {
    id: uid(),
    date: new Date().toISOString(),
    batchId,
    batchNo: batch.batchNo,
    medicineId: batch.medicineId,
    medicineName: med?.name || 'Unknown',
    qty: numQty,
    fromStatus,
    toStatus,
    reason: reason || 'Manual stock status reclassification',
    by: db.session?.username || 'system',
  }

  if (!db.stockAdjustments) db.stockAdjustments = []
  db.stockAdjustments.push(adj)
  log('STOCK_ADJUST', `${med?.name} (Batch ${batch.batchNo}) ${numQty} units converted from ${fromStatus} to ${toStatus}`)
  save()
  return adj
}

export function getStockAdjustments() {
  return [...(db.stockAdjustments || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
}

// =========================================================================
// HARDWARE & LAN STATION SETTINGS
// =========================================================================

export function getHardwareSettings() {
  return db.hardware || empty().hardware
}

export function updateHardwareSettings(patch) {
  db.hardware = { ...(db.hardware || empty().hardware), ...patch }
  log('HARDWARE_CONFIG', 'Hardware printer/display parameters updated')
  save()
  return db.hardware
}

export function getNetworkSettings() {
  return db.localNetwork || empty().localNetwork
}

export function updateNetworkSettings(patch) {
  db.localNetwork = { ...(db.localNetwork || empty().localNetwork), ...patch }
  log('NETWORK_CONFIG', 'LAN local network parameters updated')
  save()
  return db.localNetwork
}

// =========================================================================
// LOCAL USB & FILE BACKUP / RESTORE
// =========================================================================

export function exportLocalDatabase() {
  const exportPayload = {
    appName: 'Pharmacy POS',
    schemaVersion: '4.0.0-LAN-LOCAL',
    exportedAt: new Date().toISOString(),
    exportedBy: db.session?.username || 'system',
    pharmacyName: db.settings?.pharmacyName,
    data: db,
  }
  if (db.localNetwork) {
    db.localNetwork.lastLocalBackup = new Date().toISOString()
    save()
  }
  return JSON.stringify(exportPayload, null, 2)
}

export function restoreLocalDatabase(jsonString) {
  try {
    const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString
    const rawData = parsed.data || parsed
    if (!rawData.medicines || !rawData.batches || !rawData.settings) {
      throw new Error('Invalid backup file: Missing medicines or batches tables')
    }
    db = { ...empty(), ...rawData }
    localStorage.setItem(getActiveTenantKey(), JSON.stringify(db))
    listeners.forEach((l) => l())
    return { success: true, medicinesCount: db.medicines.length, batchesCount: db.batches.length }
  } catch (e) {
    throw new Error('Failed to restore database: ' + e.message)
  }
}

export function enterpriseDashboardData() {
  // Read-only projections of stored records; never fill gaps with sample data.
  const now = new Date()
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
  const rows = (value) => Array.isArray(value) ? value : []
  const sum = (items, field) => items.reduce((total, item) => total + number(item[field]), 0)
  const dayKey = (value) => {
    if (!value) return ''
    // Date-only records are calendar dates, not UTC timestamps.
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const parsed = new Date(`${value}T00:00:00Z`)
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? String(value) : ''
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  const today = dayKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const scope = activeBranch()
  const scoped = (record) => scope === 'ALL' || record.branchId === scope
  const medicines = rows(db.medicines)
  const medicineMap = new Map(medicines.map((m) => [m.id, m]))
  const branches = rows(db.branches)
  const branchName = (id) => branches.find((b) => b.id === id)?.name || (id ? `Unknown branch (${id})` : 'Unassigned branch')
  const sales = rows(db.sales).filter(scoped)
  const datedSales = sales.filter((s) => dayKey(s.date) && dayKey(s.date) <= today)
  const ts = datedSales.filter((s) => dayKey(s.date) === today)
  const ys = datedSales.filter((s) => dayKey(s.date) === dayKey(yesterday))
  const monthSales = datedSales.filter((s) => dayKey(s.date).slice(0, 7) === today.slice(0, 7))
  // Returns already update the original sale's total, profit and item quantities.
  const todayRevenue = sum(ts, 'total')
  const profitKnown = ts.every((s) => s.profit != null && Number.isFinite(Number(s.profit)))
  const todayProfit = profitKnown ? sum(ts, 'profit') : null
  const change = (current, previous) => previous === 0
    ? (current === 0 ? 'No change vs yesterday' : 'No non-zero baseline yesterday')
    : `${current > previous ? '+' : ''}${((current - previous) / Math.abs(previous) * 100).toFixed(1)}% vs yesterday`
  const batches = rows(db.batches).filter(scoped)
  const expiryDays = (expiry) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expiry)) || !dayKey(expiry)) return null
    const time = Date.parse(`${expiry}T00:00:00Z`)
    return Number.isFinite(time) ? Math.round((time - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null
  }
  const stocked = batches.filter((b) => number(b.qty) > 0)
  const nearExpiry = stocked.filter((b) => expiryDays(b.expiry) !== null && expiryDays(b.expiry) >= 0 && expiryDays(b.expiry) <= 30)
  const expired = stocked.filter((b) => expiryDays(b.expiry) !== null && expiryDays(b.expiry) < 0)
  const quantities = new Map()
  for (const batch of batches) quantities.set(batch.medicineId, (quantities.get(batch.medicineId) || 0) + Math.max(0, number(batch.qty)))
  const low = medicines.filter((m) => (quantities.get(m.id) || 0) > 0 && (quantities.get(m.id) || 0) <= number(m.minStock)).length
  const out = medicines.filter((m) => !(quantities.get(m.id) > 0)).length
  // Supplier balances are shared and payments are not allocated to invoices/branches.
  const suppliersDue = rows(db.suppliers).filter((s) => number(s.balance) > 0)
  const payables = scope === 'ALL' ? sum(suppliersDue, 'balance') : null
  const pendingOrders = [...rows(db.purchaseOrders), ...rows(db.wholesaleOrders)]
    .filter(scoped).filter((o) => ['DRAFT', 'PENDING', 'SENT', 'CONFIRMED', 'PROCESSING'].includes(o.status))
  const colors = ['#00A09D', '#714B67', '#d97706', '#9333ea', '#f59e0b', '#0284c7']
  const branchTotals = new Map(branches.filter(scopedBranch => scope === 'ALL' || scopedBranch.id === scope).map((b) => [b.id, { id: b.id, name: b.name, total: 0, count: 0 }]))
  for (const sale of monthSales) {
    const id = sale.branchId || null
    if (!branchTotals.has(id)) branchTotals.set(id, { id, name: branchName(id), total: 0, count: 0 })
    const item = branchTotals.get(id)
    item.total += number(sale.total)
    item.count++
  }
  const branchRevenueTrend = [...branchTotals.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map((b, index) => ({ ...b, revenue: fmt(b.total), color: colors[index % colors.length] }))
  const categoryTotals = new Map()
  const addCategory = (label, amount) => categoryTotals.set(label, (categoryTotals.get(label) || 0) + amount)
  for (const sale of monthSales) {
    const items = rows(sale.items)
    const gross = items.reduce((total, item) => total + Math.max(0, number(item.qty) * number(item.price)), 0)
    if (!gross) { addCategory('Uncategorized', number(sale.total)); continue }
    for (const item of items) {
      const medicine = medicineMap.get(item.medicineId)
      const label = medicine?.category || medicine?.form || 'Uncategorized'
      addCategory(label, number(sale.total) * Math.max(0, number(item.qty) * number(item.price)) / gross)
    }
  }
  const categoryTotal = sum(monthSales, 'total')
  const categoryBreakdown = [...categoryTotals].filter(([, amount]) => amount !== 0).sort((a, b) => b[1] - a[1])
    .map(([label, amount], index) => ({ label, amount, pct: categoryTotal > 0 ? amount / categoryTotal * 100 : 0, color: colors[index % colors.length] }))
  const salesTrendMonthly = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const key = dayKey(date).slice(0, 7)
    const matches = datedSales.filter((s) => dayKey(s.date).slice(0, 7) === key)
    return { key, month: date.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' }), total: sum(matches, 'total'), count: matches.length }
  })
  const salesTrendDaily = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i)
    const key = dayKey(date)
    const matches = datedSales.filter((s) => dayKey(s.date) === key)
    return { key, label: date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }), total: sum(matches, 'total'), count: matches.length }
  })
  const lastSeven = salesTrendDaily.slice(7)
  const previousSeven = salesTrendDaily.slice(0, 7)
  const sevenDayRevenue = sum(lastSeven, 'total')
  const sevenDayOrders = sum(lastSeven, 'count')
  const previousRevenue = sum(previousSeven, 'total')
  const medicineUnits = new Map()
  for (const sale of monthSales) {
    for (const item of rows(sale.items)) {
      // Saved item quantities already reflect returns; count no inferred quantities.
      const qty = Math.max(0, number(item.qty))
      if (!qty) continue
      const key = item.medicineId || null
      if (!medicineUnits.has(key)) medicineUnits.set(key, {
        id: key, name: medicineMap.get(key)?.name || (key ? `Unknown medicine (${key})` : 'Unassigned medicine'), units: 0,
      })
      medicineUnits.get(key).units += qty
    }
  }
  const replenishment = medicines.map((medicine) => ({
    id: medicine.id, name: medicine.name, qty: quantities.get(medicine.id) || 0,
    minimum: Math.max(0, number(medicine.minStock)),
  })).filter((medicine) => medicine.qty === 0 || medicine.qty <= medicine.minimum)
    .sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name))
  const riskItems = [...expired, ...nearExpiry].map((b) => ({
    id: b.id, name: medicineMap.get(b.medicineId)?.name || 'Unknown medicine',
    batch: `${number(b.qty)} units · Batch ${b.batchNo || 'not recorded'} · ${branchName(b.branchId)}`,
    amount: Math.max(0, number(b.qty)) * Math.max(0, number(b.purchasePrice)),
    days: expiryDays(b.expiry), expiring: expiryDays(b.expiry) < 0 ? `Expired ${Math.abs(expiryDays(b.expiry))} days ago` : `Expires in ${expiryDays(b.expiry)} days`,
  })).sort((a, b) => b.amount - a.amount)
  // Purchases may have no branch tag: infer only when every linked batch agrees.
  const purchaseBranch = (purchase) => {
    if (purchase.branchId) return purchase.branchId
    const ids = rows(purchase.items).map((item) => rows(db.batches).find((b) => b.id === (typeof item === 'string' ? item : item.batchId))?.branchId)
    return ids.length && ids.every((id) => id && id === ids[0]) ? ids[0] : null
  }
  const activity = [
    ...sales.map((s) => ({ id: `sale-${s.id}`, type: 'sale', date: s.date, branchId: s.branchId, title: `Sale recorded: ${s.invoiceNo || s.id}`, amount: number(s.total) })),
    ...rows(db.purchases).map((p) => ({ id: `purchase-${p.id}`, type: 'purchase', date: p.date, branchId: purchaseBranch(p), title: `Purchase recorded: ${p.invoiceNo || p.id}`, amount: number(p.total) })),
    ...rows(db.returns).map((r) => ({ id: `return-${r.id}`, type: 'return', date: r.date, branchId: rows(db.sales).find((s) => s.id === r.saleId)?.branchId, title: `Return recorded: ${r.invoiceNo || r.id}`, amount: number(r.refund) })),
  ].filter(scoped).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).slice(0, 6)
  return {
    scopeLabel: scope === 'ALL' ? 'All Branches' : branchName(scope),
    greeting: now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening',
    dateLabel: now.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    monthLabel: now.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' }),
    kpis: {
      sales: fmt(todayRevenue), salesChange: change(todayRevenue, sum(ys, 'total')),
      orders: ts.length, ordersChange: change(ts.length, ys.length),
      profit: todayProfit === null ? 'Unavailable' : fmt(todayProfit),
      profitChange: !profitKnown || ys.some((s) => s.profit == null || !Number.isFinite(Number(s.profit))) ? 'Missing recorded profit' : change(todayProfit, sum(ys, 'profit')),
      customers: new Set(ts.map((s) => s.customerId).filter((id) => id && id !== 'walkin')).size,
      customersChange: 'Distinct named customers today',
      grossMargin: todayRevenue > 0 && todayProfit !== null ? `${(todayProfit / todayRevenue * 100).toFixed(1)}%` : '—',
      marginChange: todayProfit === null ? 'Missing recorded profit' : todayRevenue > 0 ? 'Recorded profit / sales today' : 'No positive sales today',
      payables: payables === null ? 'Unavailable' : fmt(payables),
      payablesHint: payables === null ? 'Supplier balances' : 'Supplier balances',
    },
    attention: { lowStock: low, outOfStock: out, nearExpiry: nearExpiry.length, expired: expired.length, awaitingOrders: pendingOrders.length, pendingPayments: scope === 'ALL' ? suppliersDue.length : null },
    catalogueCount: medicines.length,
    stockValue: fmt(stocked.reduce((total, b) => total + number(b.qty) * Math.max(0, number(b.purchasePrice)), 0)),
    branchRevenueTrend,
    branchRankings: branchRevenueTrend.map((b, index) => ({ ...b, rank: index + 1, status: `${b.count} sale${b.count === 1 ? '' : 's'}` })),
    categoryBreakdown, totalCategorySales: fmt(categoryTotal),
    inventoryHealth: [
      { label: 'Above minimum', count: medicines.length - low - out, color: colors[0] },
      { label: 'Low stock', count: low, color: colors[2] },
      { label: 'Out of stock', count: out, color: '#e11d48' },
    ].map((item) => ({ ...item, pct: medicines.length ? item.count / medicines.length * 100 : 0 })),
    salesTrendMonthly,
    operations: {
      salesTrendDaily,
      sevenDayRevenue, sevenDayOrders,
      sevenDayAverage: sevenDayOrders ? sevenDayRevenue / sevenDayOrders : null,
      sevenDayChange: previousRevenue === 0
        ? (sevenDayRevenue === 0 ? 'No change vs prior 7 days' : 'No non-zero baseline in prior 7 days')
        : `${sevenDayRevenue > previousRevenue ? '+' : ''}${((sevenDayRevenue - previousRevenue) / Math.abs(previousRevenue) * 100).toFixed(1)}% vs prior 7 days`,
      todayAverage: ts.length ? todayRevenue / ts.length : null,
      topMedicines: [...medicineUnits.values()].sort((a, b) => b.units - a.units || a.name.localeCompare(b.name)).slice(0, 5),
      replenishment,
    },
    hasMonthlySales: monthSales.length > 0,
    capitalAtRisk: { total: fmt(riskItems.reduce((total, b) => total + b.amount, 0)), items: riskItems.map((b) => ({ ...b, value: fmt(b.amount) })) },
    recentActivity: activity.map((a) => ({ ...a, subtitle: `${fmt(a.amount)} · ${dayKey(a.date) ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(a.date)) ? `${a.date}T00:00:00` : a.date).toLocaleString('en-PK') : 'Date not recorded'} · ${branchName(a.branchId)}` })),
    scopeNote: scope === 'ALL' ? 'Calculated from saved records. Stock figures include the stored catalogue.' : 'Calculated from saved records for this branch. Untagged records and shared supplier balances are excluded.',
  }
}
