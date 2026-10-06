/*****************************************************************
 * Pharmacy POS — Google Apps Script backend (Code.gs)
 * Database: the bound Google Sheet (one tab per table).
 *
 * SETUP:
 *  1. Create a Google Sheet, open Extensions > Apps Script.
 *  2. Paste this file as Code.gs and the built index.html as index.html.
 *  3. Run setupSheet() once (grant permissions), then Deploy > New deployment
 *     > Web app > Execute as: Me, Access: Anyone (or Anyone with Google account).
 *
 * All frontend calls go through __api(fn, userJson, argsJson) via
 * google.script.run, matching the MockAPI contract in the web app.
 *****************************************************************/

var SHEETS = {
  settings:        ['key','value'],
  users:           ['id','name','username','passwordHash','role','active'],
  permissions:     ['role','matrix'],
  medicines:       ['id','generic','brand','manufacturer','strength','form','hsn','gst','rack','controlled','storage','reorderLevel','rxRequired','packCarton','packBox','packPacket'],
  batches:         ['id','medicineId','batchNo','mfg','expiry','cost','mrp','qty','supplierId'],
  customers:       ['id','name','phone','address','allergies','notes','creditLimit','membershipCard','balance','loyaltyPoints'],
  suppliers:       ['id','name','phone','address','balance'],
  doctors:         ['id','name','regNo','specialization','clinic','phone'],
  prescriptions:   ['id','doctorId','customerId','date','validTill','dosage','days','refills','imageUrl','notes'],
  sales:           ['id','date','customerId','doctorId','prescriptionId','subtotal','discount','tax','total','paid','balance','payments','delivery','notes','userId','status'],
  saleItems:       ['id','saleId','medicineId','batchId','level','qty','rate','discount','amount'],
  saleReturns:     ['id','saleId','date','items','refund','restockTo','reason','userId'],
  pos:             ['id','supplierId','date','status','total','notes','userId'],
  poItems:         ['id','poId','medicineId','qty','rate','amount'],
  grns:            ['id','poId','date','invoiceNo','charges','total','userId'],
  grnItems:        ['id','grnId','medicineId','batchNo','qty','cost'],
  purchaseReturns: ['id','date','supplierId','items','amount','notes','userId'],
  supplierPayments:['id','date','supplierId','amount','method','notes','userId'],
  expenses:        ['id','date','head','amount','notes','userId'],
  income:          ['id','date','head','amount','notes','userId'],
  banks:           ['id','name','account','balance'],
  employees:       ['id','name','role','phone','salary','active'],
  advances:        ['id','employeeId','date','amount','notes','userId'],
  payroll:         ['id','employeeId','month','salary','advances','net','paid','date','userId'],
  stockAdjustments:['id','date','medicineId','batchId','qtyChange','reason','userId'],
  paymentMethods:  ['id','name','type']
};

/* ---------------- web app entry ---------------- */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Pharmacy POS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* Single dispatch entry for the frontend adapter */
function __api(fn, userJson, argsJson) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { throw new Error('Server busy, try again'); }
  try {
    var user = userJson ? JSON.parse(userJson) : null;
    if (fn !== 'login' && user && user.token) {
      var cached = CacheService.getScriptCache().get('tok_' + user.token);
      if (!cached) throw new Error('Session expired — please sign in again');
      user = JSON.parse(cached);
    }
    var args = argsJson ? JSON.parse(argsJson) : [];
    var f = API[fn];
    if (typeof f !== 'function') throw new Error('Unknown API function: ' + fn);
    return f.apply(null, [user].concat(args));
  } finally { lock.releaseLock(); }
}

/* ---------------- sheet helpers ---------------- */
function sh_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); s.appendRow(SHEETS[name]); s.setFrozenRows(1); }
  return s;
}
function val_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}
function rows_(name) {
  var s = sh_(name);
  var vals = s.getDataRange().getValues();
  if (vals.length < 2) return [];
  var heads = SHEETS[name], out = [];
  var tz = Session.getScriptTimeZone();
  for (var i = 1; i < vals.length; i++) {
    var o = { _row: i + 1 };
    for (var j = 0; j < heads.length; j++) {
      var v = vals[i][j];
      if (v === '') v = null;
      /* Sheets auto-converts date-like strings to Date objects. Convert back
         to ISO date strings: (1) google.script.run cannot transport Dates to
         the client (dashboard got null), (2) day-level string comparisons. */
      else if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()))
        v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      o[heads[j]] = v;
    }
    out.push(o);
  }
  return out;
}
function num_(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
function bool_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1; }
function append_(name, obj) {
  sh_(name).appendRow(SHEETS[name].map(function (k) { return val_(obj[k]); }));
}
function update_(name, id, obj) {
  var s = sh_(name), heads = SHEETS[name];
  var ids = s.getRange(2, 1, Math.max(1, s.getLastRow() - 1), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      s.getRange(i + 2, 1, 1, heads.length).setValues([heads.map(function (k) { return val_(obj[k]); })]);
      return true;
    }
  }
  return false;
}
function remove_(name, id) {
  var s = sh_(name);
  var ids = s.getRange(2, 1, Math.max(1, s.getLastRow() - 1), 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(id)) s.deleteRow(i + 2);
  }
}
function nextId_(prefix, name) {
  var max = 0, re = new RegExp('^' + prefix + '-(\\d+)$');
  rows_(name).forEach(function (r) {
    var m = String(r.id || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  var n = String(max + 1);
  while (n.length < 4) n = '0' + n;
  return prefix + '-' + n;
}
function sha256_(s) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s);
  return d.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function setting_(k, fb) {
  var r = rows_('settings').filter(function (x) { return x.key === k; })[0];
  return r ? r.value : fb;
}
function requireUser_(u) { if (!u || !u.id) throw new Error('Not logged in'); return u; }
function clean_(o) { var c = {}; for (var k in o) if (k !== '_row') c[k] = o[k]; return c; }
function medById_(id) { return rows_('medicines').filter(function (m) { return m.id === id; })[0]; }
function batchById_(id) { return rows_('batches').filter(function (b) { return b.id === id; })[0]; }
function stockOf_(medId) {
  return rows_('batches').filter(function (b) { return b.medicineId === medId; })
    .reduce(function (s, b) { return s + num_(b.qty); }, 0);
}
function levelU_(med, level) {
  med = med || {};
  if (level === 'carton') return num_(med.packCarton) || 1;
  if (level === 'box') return num_(med.packBox) || 1;
  if (level === 'packet') return num_(med.packPacket) || 1;
  return 1;
}
function deduct_(medId, units, preferredBatch) {
  var need = units, picked = [];
  var list = rows_('batches').filter(function (b) {
    return b.medicineId === medId && (preferredBatch ? b.id === preferredBatch : num_(b.qty) > 0);
  });
  if (!preferredBatch) list.sort(function (a, b) { return new Date(a.expiry) - new Date(b.expiry); });
  for (var i = 0; i < list.length && need > 0; i++) {
    var b = list[i], take = Math.min(num_(b.qty), need);
    b.qty = num_(b.qty) - take; need -= take;
    update_('batches', b.id, Object.assign(clean_(b), { qty: b.qty }));
    picked.push({ batchId: b.id, qty: take, cost: num_(b.cost) });
  }
  if (need > 0) {
    var m = medById_(medId);
    throw new Error('Insufficient stock for ' + (m ? m.brand : medId) + ' (short ' + need + ' units)');
  }
  return picked;
}
function daysLeft_(iso) {
  if (!iso) return 99999;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}
function todayStr_() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

/* ================= API implementation ================= */
var API = {

  /* ---------- auth ---------- */
  login: function (user, username, password) {
    var u = rows_('users').filter(function (x) {
      return String(x.username).toLowerCase() === String(username).toLowerCase() && bool_(x.active);
    })[0];
    if (!u || u.passwordHash !== sha256_(password)) throw new Error('Invalid username or password');
    var out = { id: u.id, name: u.name, username: u.username, role: u.role, token: Utilities.getUuid() };
    CacheService.getScriptCache().put('tok_' + out.token, JSON.stringify(out), 21600);
    return { user: out, token: out.token };
  },
  getBootstrap: function (user) {
    requireUser_(user);
    var s = {};
    rows_('settings').forEach(function (x) { s[x.key] = x.value; });
    var pm = rows_('permissions').filter(function (p) { return p.role === user.role; })[0];
    return {
      user: user,
      permissions: pm ? JSON.parse(pm.matrix) : {},
      settings: s,
      paymentMethods: rows_('paymentMethods').map(clean_),
      store: { name: s.storeName, address: s.address, phone: s.phone }
    };
  },
  getSettings: function (user) {
    requireUser_(user);
    var s = {};
    rows_('settings').forEach(function (x) { s[x.key] = x.value; });
    s.paymentMethods = rows_('paymentMethods').map(clean_);
    return s;
  },
  saveSettings: function (user, s) {
    requireUser_(user);
    var ss = sh_('settings');
    var vals = ss.getDataRange().getValues();
    var keyRow = {};
    for (var i = 1; i < vals.length; i++) keyRow[String(vals[i][0])] = i + 1;
    Object.keys(s).forEach(function (k) {
      if (k === 'paymentMethods') return;
      if (keyRow[k]) ss.getRange(keyRow[k], 2).setValue(val_(s[k]));
      else append_('settings', { key: k, value: s[k] });
    });
    if (s.paymentMethods) {
      var ps = sh_('paymentMethods');
      if (ps.getLastRow() > 1) ps.deleteRows(2, ps.getLastRow() - 1);
      s.paymentMethods.forEach(function (p) { append_('paymentMethods', p); });
    }
    return true;
  },
  listUsers: function (user) {
    requireUser_(user);
    return rows_('users').map(function (u) { u = clean_(u); u.passwordHash = undefined; u.active = bool_(u.active); return u; });
  },
  saveUser: function (user, u) {
    requireUser_(user);
    if (u.id) {
      var r = rows_('users').filter(function (x) { return x.id === u.id; })[0];
      if (!r) throw new Error('User not found');
      r.name = u.name; r.username = String(u.username).toLowerCase(); r.role = u.role; r.active = u.active !== false;
      if (u.password) r.passwordHash = sha256_(u.password);
      update_('users', r.id, clean_(r));
    } else {
      if (rows_('users').some(function (x) { return String(x.username).toLowerCase() === String(u.username).toLowerCase(); }))
        throw new Error('Username already exists');
      append_('users', { id: nextId_('U', 'users'), name: u.name, username: String(u.username).toLowerCase(),
        passwordHash: sha256_(u.password || '123456'), role: u.role || 'cashier', active: true });
    }
    return true;
  },
  toggleUser: function (user, id, active) {
    requireUser_(user);
    var r = rows_('users').filter(function (x) { return x.id === id; })[0];
    if (r) { r.active = active; update_('users', id, clean_(r)); }
    return true;
  },
  getPermissions: function (user) {
    requireUser_(user);
    return rows_('permissions').map(function (p) { p = clean_(p); p.matrix = JSON.parse(p.matrix); return p; });
  },
  savePermissions: function (user, matrix) {
    requireUser_(user);
    matrix.forEach(function (m) {
      var r = rows_('permissions').filter(function (p) { return p.role === m.role; })[0];
      var v = JSON.stringify(m.matrix);
      if (r) update_('permissions', r.id, { id: r.id, role: m.role, matrix: v });
      else append_('permissions', { id: nextId_('R', 'permissions'), role: m.role, matrix: v });
    });
    return true;
  },

  /* ---------- dashboard ---------- */
  getDashboard: function (user) {
    requireUser_(user);
    var t = todayStr_(), tm = t.slice(0, 7);
    var sales = rows_('sales'), items = rows_('saleItems');
    var tsales = sales.filter(function (s) { return String(s.date).slice(0, 10) === t; });
    var todaySales = tsales.reduce(function (s, x) { return s + num_(x.total); }, 0);
    var monthSales = sales.filter(function (s) { return String(s.date).slice(0, 7) === tm; })
      .reduce(function (s, x) { return s + num_(x.total); }, 0);
    var cogs = 0;
    tsales.forEach(function (s) {
      items.filter(function (i) { return i.saleId === s.id; }).forEach(function (i) {
        var b = batchById_(i.batchId);
        cogs += num_(i.qty) * levelU_(medById_(i.medicineId), i.level) * (b ? num_(b.cost) : 0);
      });
    });
    var alerts = API.getStockAlerts(user);
    var trend = [];
    for (var d = 13; d >= 0; d--) {
      var dt = new Date(Date.now() - d * 86400000);
      var k = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
      trend.push({ d: k, total: sales.filter(function (s) { return String(s.date).slice(0, 10) === k; })
        .reduce(function (s, x) { return s + num_(x.total); }, 0) });
    }
    var byMed = {};
    items.forEach(function (i) {
      var m = medById_(i.medicineId), k2 = m ? m.brand : i.medicineId;
      byMed[k2] = byMed[k2] || { brand: k2, qty: 0, amount: 0 };
      byMed[k2].qty += num_(i.qty) * levelU_(m, i.level);
      byMed[k2].amount += num_(i.amount);
    });
    var pay = {};
    sales.forEach(function (s) {
      try { JSON.parse(s.payments || '[]').forEach(function (p) { pay[p.method] = (pay[p.method] || 0) + num_(p.amount); }); } catch (e) {}
    });
    var custs = rows_('customers'), sups = rows_('suppliers');
    return {
      kpis: {
        todaySales: todaySales, todayProfit: todaySales - cogs, monthSales: monthSales,
        lowStock: alerts.lowStock.length + alerts.outOfStock.length,
        nearExpiry: alerts.nearExpiry.length + alerts.expired.length,
        totalCustomers: Math.max(0, custs.length - 1),
        pendingDues: custs.reduce(function (s, c) { return s + num_(c.balance); }, 0) +
                     sups.reduce(function (s, x) { return s + num_(x.balance); }, 0)
      },
      salesTrend: trend,
      topMeds: Object.keys(byMed).map(function (k) { return byMed[k]; })
        .sort(function (a, b) { return b.amount - a.amount; }).slice(0, 8),
      paySplit: Object.keys(pay).map(function (k) { return { method: k, total: pay[k] }; }),
      alerts: alerts
    };
  },

  /* ---------- medicines ---------- */
  listMedicines: function (user, q, filters) {
    requireUser_(user);
    q = String(q || '').toLowerCase(); filters = filters || {};
    var batches = rows_('batches');
    return rows_('medicines').filter(function (m) {
      if (q && (String(m.brand) + ' ' + String(m.generic) + ' ' + String(m.manufacturer)).toLowerCase().indexOf(q) < 0) return false;
      if (filters.lowStock && stockOf_(m.id) >= num_(m.reorderLevel || 0)) return false;
      if (filters.controlled && !bool_(m.controlled)) return false;
      return true;
    }).map(function (m) {
      m = clean_(m);
      m.pack = { carton: num_(m.packCarton) || 1, box: num_(m.packBox) || 1, packet: num_(m.packPacket) || 1 };
      m.stock = stockOf_(m.id);
      m.controlled = bool_(m.controlled); m.rxRequired = bool_(m.rxRequired);
      m.nearExpiry = batches.some(function (b) { return b.medicineId === m.id && num_(b.qty) > 0 && daysLeft_(b.expiry) <= 90; });
      return m;
    });
  },
  saveMedicine: function (user, m) {
    requireUser_(user);
    var obj = {
      generic: m.generic || '', brand: m.brand, manufacturer: m.manufacturer || '', strength: m.strength || '',
      form: m.form || 'Tablet', hsn: m.hsn || '', gst: num_(m.gst), rack: m.rack || '',
      controlled: !!m.controlled, storage: m.storage || '', reorderLevel: num_(m.reorderLevel) || 50,
      rxRequired: !!m.rxRequired,
      packCarton: num_((m.pack || {}).carton) || 1, packBox: num_((m.pack || {}).box) || 1, packPacket: num_((m.pack || {}).packet) || 1
    };
    if (m.id) { var r = medById_(m.id); if (!r) throw new Error('Medicine not found'); obj.id = m.id; update_('medicines', m.id, obj); return m.id; }
    obj.id = nextId_('MED', 'medicines'); append_('medicines', obj); return obj.id;
  },
  deleteMedicine: function (user, id) {
    requireUser_(user);
    if (rows_('batches').some(function (b) { return b.medicineId === id && num_(b.qty) > 0; }))
      throw new Error('Cannot delete: stock batches exist');
    remove_('medicines', id); return true;
  },
  importMedicines: function (user, rows) {
    requireUser_(user);
    var added = 0, updated = 0, errors = [];
    rows.forEach(function (r, i) {
      try {
        if (!r.brand) throw new Error('missing brand');
        var ex = rows_('medicines').filter(function (m) { return String(m.brand).toLowerCase() === String(r.brand).toLowerCase(); })[0];
        var m = { generic: r.generic || '', brand: r.brand, manufacturer: r.manufacturer || '', strength: r.strength || '',
          form: r.form || 'Tablet', hsn: r.hsn || '', gst: num_(r.gst), rack: r.rack || '',
          controlled: /^(y|1|true)$/i.test(String(r.controlled || '')), storage: r.storage || '',
          reorderLevel: num_(r.reorderLevel) || 50, rxRequired: /^(y|1|true)$/i.test(String(r.rxRequired || '')),
          pack: { carton: num_(r.carton) || 1, box: num_(r.box) || 1, packet: num_(r.packet) || 1 } };
        if (ex) { m.id = ex.id; API.saveMedicine(user, m); updated++; }
        else { API.saveMedicine(user, m); added++; }
      } catch (e) { errors.push('Row ' + (i + 1) + ': ' + e.message); }
    });
    return { added: added, updated: updated, errors: errors };
  },

  /* ---------- batches / stock ---------- */
  listBatches: function (user, medicineId, filters) {
    requireUser_(user); filters = filters || {};
    var meds = {}, sups = {};
    rows_('medicines').forEach(function (m) { meds[m.id] = m; });
    rows_('suppliers').forEach(function (s) { sups[s.id] = s; });
    return rows_('batches').filter(function (b) {
      return (!medicineId || b.medicineId === medicineId) && (filters.zero ? true : num_(b.qty) > 0);
    }).map(function (b) {
      b = clean_(b);
      var m = meds[b.medicineId] || {}, s = sups[b.supplierId] || {};
      b.brand = m.brand || '?'; b.generic = m.generic || ''; b.supplier = s.name || '';
      b.daysLeft = daysLeft_(b.expiry); return b;
    }).sort(function (a, b) { return new Date(a.expiry) - new Date(b.expiry); });
  },
  saveBatch: function (user, b) {
    requireUser_(user);
    if (b.id) { var r = batchById_(b.id); if (!r) throw new Error('Batch not found'); b.id = b.id; update_('batches', b.id, Object.assign(clean_(r), b)); return b.id; }
    b.id = nextId_('B', 'batches'); append_('batches', b); return b.id;
  },
  adjustStock: function (user, items) {
    requireUser_(user);
    items.forEach(function (it) {
      var b = batchById_(it.batchId); if (!b) throw new Error('Batch not found');
      b.qty = num_(b.qty) + num_(it.qtyChange);
      update_('batches', b.id, Object.assign(clean_(b), { qty: b.qty }));
      append_('stockAdjustments', { id: nextId_('ADJ', 'stockAdjustments'), date: new Date().toISOString(),
        medicineId: b.medicineId, batchId: b.id, qtyChange: num_(it.qtyChange), reason: it.reason || 'Adjustment', userId: user.id });
    });
    return true;
  },
  getStockAlerts: function (user) {
    requireUser_(user);
    var expired = [], nearExpiry = [], lowStock = [], outOfStock = [];
    var meds = {}; rows_('medicines').forEach(function (m) { meds[m.id] = clean_(m); });
    rows_('batches').forEach(function (b) {
      if (num_(b.qty) <= 0) return;
      var dl = daysLeft_(b.expiry), m = meds[b.medicineId] || {};
      var row = clean_(b); row.brand = m.brand || '?'; row.daysLeft = dl;
      if (dl < 0) expired.push(row); else if (dl <= 90) nearExpiry.push(row);
    });
    Object.keys(meds).forEach(function (id) {
      var s = stockOf_(id), m = meds[id];
      if (s <= 0) outOfStock.push(Object.assign(m, { stock: s }));
      else if (s <= num_(m.reorderLevel || 0)) lowStock.push(Object.assign(m, { stock: s }));
    });
    nearExpiry.sort(function (a, b) { return a.daysLeft - b.daysLeft; });
    return { expired: expired, nearExpiry: nearExpiry, lowStock: lowStock, outOfStock: outOfStock };
  },

  /* ---------- suppliers ---------- */
  listSuppliers: function (user, q) {
    requireUser_(user); q = String(q || '').toLowerCase();
    return rows_('suppliers').filter(function (s) {
      return !q || (String(s.name) + ' ' + String(s.phone)).toLowerCase().indexOf(q) >= 0;
    }).map(clean_);
  },
  saveSupplier: function (user, s) {
    requireUser_(user);
    if (s.id) { var r = rows_('suppliers').filter(function (x) { return x.id === s.id; })[0]; if (r) update_('suppliers', s.id, Object.assign(clean_(r), s)); return s.id; }
    s.id = nextId_('SUP', 'suppliers'); s.balance = 0; append_('suppliers', s); return s.id;
  },
  deleteSupplier: function (user, id) {
    requireUser_(user);
    if (rows_('pos').some(function (p) { return p.supplierId === id; })) throw new Error('Cannot delete: purchase history exists');
    remove_('suppliers', id); return true;
  },
  getSupplierLedger: function (user, supplierId) {
    requireUser_(user);
    var sup = rows_('suppliers').filter(function (s) { return s.id === supplierId; })[0];
    if (!sup) throw new Error('Supplier not found');
    var pos = rows_('pos').filter(function (p) { return p.supplierId === supplierId; })
      .map(function (p) { return { date: p.date, ref: p.id, desc: 'Purchase ' + p.id, amount: num_(p.total), status: p.status }; });
    var pays = rows_('supplierPayments').filter(function (p) { return p.supplierId === supplierId; })
      .map(function (p) { return { date: p.date, ref: p.id, desc: 'Payment (' + p.method + ')', amount: -num_(p.amount) }; });
    return { supplier: clean_(sup), entries: pos.concat(pays).sort(function (a, b) { return new Date(b.date) - new Date(a.date); }) };
  },
  recordSupplierPayment: function (user, p) {
    requireUser_(user);
    var sup = rows_('suppliers').filter(function (s) { return s.id === p.supplierId; })[0];
    if (!sup) throw new Error('Supplier not found');
    append_('supplierPayments', { id: nextId_('SP', 'supplierPayments'), date: p.date || todayStr_(), supplierId: p.supplierId,
      amount: num_(p.amount), method: p.method || 'Cash', notes: p.notes || '', userId: user.id });
    sup.balance = num_(sup.balance) - num_(p.amount);
    update_('suppliers', sup.id, clean_(sup));
    return true;
  },

  /* ---------- purchases ---------- */
  listPOs: function (user, status) {
    requireUser_(user);
    var sups = {}; rows_('suppliers').forEach(function (s) { sups[s.id] = s.name; });
    return rows_('pos').filter(function (p) { return !status || p.status === status; })
      .map(function (p) { p = clean_(p); p.supplier = sups[p.supplierId] || '?'; return p; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  },
  getPO: function (user, id) {
    requireUser_(user);
    var po = rows_('pos').filter(function (p) { return p.id === id; })[0];
    if (!po) throw new Error('PO not found');
    var meds = {}; rows_('medicines').forEach(function (m) { meds[m.id] = m.brand; });
    var items = rows_('poItems').filter(function (i) { return i.poId === id; })
      .map(function (i) { i = clean_(i); i.brand = meds[i.medicineId] || '?'; return i; });
    return { po: clean_(po), items: items, grns: rows_('grns').filter(function (g) { return g.poId === id; }).map(clean_) };
  },
  savePO: function (user, p) {
    requireUser_(user);
    var id = nextId_('PO', 'pos');
    var items = p.items || [];
    var total = items.reduce(function (s, i) { return s + num_(i.qty) * num_(i.rate); }, 0);
    append_('pos', { id: id, supplierId: p.supplierId, date: p.date || todayStr_(), status: p.status || 'ordered', total: total, notes: p.notes || '', userId: user.id });
    items.forEach(function (i) {
      append_('poItems', { id: nextId_('PI', 'poItems'), poId: id, medicineId: i.medicineId, qty: num_(i.qty), rate: num_(i.rate), amount: num_(i.qty) * num_(i.rate) });
    });
    return id;
  },
  setPOStatus: function (user, id, status) {
    requireUser_(user);
    var p = rows_('pos').filter(function (x) { return x.id === id; })[0];
    if (p) { p.status = status; update_('pos', id, clean_(p)); }
    return true;
  },
  receiveGRN: function (user, g) {
    requireUser_(user);
    var po = rows_('pos').filter(function (p) { return p.id === g.poId; })[0];
    if (!po) throw new Error('PO not found');
    var id = nextId_('GRN', 'grns'), total = 0;
    (g.items || []).forEach(function (it) {
      var qty = num_(it.qty), cost = num_(it.cost); total += qty * cost;
      append_('batches', { id: nextId_('B', 'batches'), medicineId: it.medicineId, batchNo: it.batchNo, mfg: it.mfg || '',
        expiry: it.expiry, cost: cost, mrp: num_(it.mrp), qty: qty, supplierId: po.supplierId });
      append_('grnItems', { id: nextId_('GI', 'grnItems'), grnId: id, medicineId: it.medicineId, batchNo: it.batchNo, qty: qty, cost: cost });
    });
    total += num_(g.charges);
    append_('grns', { id: id, poId: po.id, date: g.date || todayStr_(), invoiceNo: g.invoiceNo || '', charges: num_(g.charges), total: total, userId: user.id });
    po.status = (po.status === 'partial' || g.partial) ? 'partial' : 'received';
    update_('pos', po.id, clean_(po));
    var sup = rows_('suppliers').filter(function (s) { return s.id === po.supplierId; })[0];
    if (sup) { sup.balance = num_(sup.balance) + total; update_('suppliers', sup.id, clean_(sup)); }
    return id;
  },
  listGRNs: function (user) {
    requireUser_(user);
    var pos = {}, sups = {};
    rows_('pos').forEach(function (p) { pos[p.id] = p; });
    rows_('suppliers').forEach(function (s) { sups[s.id] = s.name; });
    return rows_('grns').map(function (g) {
      g = clean_(g); var po = pos[g.poId] || {};
      g.supplier = sups[po.supplierId] || '?'; return g;
    }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  },
  listPurchaseReturns: function (user) {
    requireUser_(user);
    var sups = {}; rows_('suppliers').forEach(function (s) { sups[s.id] = s.name; });
    return rows_('purchaseReturns').map(function (r) {
      r = clean_(r); r.supplier = sups[r.supplierId] || '?';
      try { r.items = JSON.parse(r.items || '[]'); } catch (e) { r.items = []; }
      return r;
    }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  },
  savePurchaseReturn: function (user, r) {
    requireUser_(user);
    var id = nextId_('PR', 'purchaseReturns'), amount = 0;
    (r.items || []).forEach(function (it) {
      var b = batchById_(it.batchId);
      if (b) { b.qty = Math.max(0, num_(b.qty) - num_(it.qty)); update_('batches', b.id, Object.assign(clean_(b), { qty: b.qty })); amount += num_(it.qty) * num_(b.cost); }
    });
    append_('purchaseReturns', { id: id, date: r.date || todayStr_(), supplierId: r.supplierId, items: JSON.stringify(r.items), amount: amount, notes: r.notes || '', userId: user.id });
    var sup = rows_('suppliers').filter(function (s) { return s.id === r.supplierId; })[0];
    if (sup) { sup.balance = num_(sup.balance) - amount; update_('suppliers', sup.id, clean_(sup)); }
    return id;
  },

  /* ---------- sales ---------- */
  createSale: function (user, p) {
    requireUser_(user);
    if (!p.items || !p.items.length) throw new Error('Cart is empty');
    var saleId = nextId_('S', 'sales'), now = new Date().toISOString(), subtotal = 0;
    var saleItems = [];
    p.items.forEach(function (it) {
      var med = medById_(it.medicineId); if (!med) throw new Error('Medicine not found');
      if (bool_(med.rxRequired) && !(p.doctorId && p.prescriptionId))
        throw new Error(med.brand + ' requires a prescription (doctor + prescription)');
      var units = num_(it.qty) * levelU_(med, it.level);
      var picked = deduct_(it.medicineId, units, it.batchId || null);
      var amount = num_(it.qty) * num_(it.rate) - num_(it.discount);
      subtotal += amount;
      saleItems.push({ id: nextId_('SI', 'saleItems'), saleId: saleId, medicineId: med.id,
        batchId: picked[0] ? picked[0].batchId : '', level: it.level, qty: num_(it.qty),
        rate: num_(it.rate), discount: num_(it.discount), amount: amount });
    });
    var total = subtotal - num_(p.discount) + num_(p.tax);
    var payTotal = (p.payments || []).reduce(function (s, x) { return s + num_(x.amount); }, 0);
    var balance = Math.max(0, total - payTotal);
    var sale = { id: saleId, date: now, customerId: p.customerId || 'C-0001', doctorId: p.doctorId || '',
      prescriptionId: p.prescriptionId || '', subtotal: subtotal, discount: num_(p.discount), tax: num_(p.tax),
      total: total, paid: payTotal, balance: balance, payments: JSON.stringify(p.payments || []),
      delivery: p.delivery ? JSON.stringify(p.delivery) : '', notes: p.notes || '', userId: user.id, status: 'completed' };
    append_('sales', sale);
    saleItems.forEach(function (i) { append_('saleItems', i); });
    var cust = rows_('customers').filter(function (c) { return c.id === sale.customerId; })[0];
    if (cust) {
      cust.balance = num_(cust.balance) + balance;
      cust.loyaltyPoints = num_(cust.loyaltyPoints) + Math.floor(total / 100);
      update_('customers', cust.id, clean_(cust));
    }
    return clean_(sale);
  },
  listSales: function (user, f) {
    requireUser_(user); f = f || {};
    var custs = {}; rows_('customers').forEach(function (c) { custs[c.id] = c.name; });
    return rows_('sales').filter(function (s) {
      return (!f.from || String(s.date).slice(0, 10) >= f.from) && (!f.to || String(s.date).slice(0, 10) <= f.to) &&
        (!f.q || String(s.id).toLowerCase().indexOf(String(f.q).toLowerCase()) >= 0) &&
        (!f.customerId || s.customerId === f.customerId);
    }).map(function (s) { s = clean_(s); s.customer = custs[s.customerId] || '?'; return s; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 500);
  },
  getSale: function (user, id) {
    requireUser_(user);
    var sale = rows_('sales').filter(function (s) { return s.id === id; })[0];
    if (!sale) throw new Error('Sale not found');
    var meds = {}; rows_('medicines').forEach(function (m) { meds[m.id] = m; });
    var items = rows_('saleItems').filter(function (i) { return i.saleId === id; }).map(function (i) {
      i = clean_(i); var m = meds[i.medicineId] || {};
      i.brand = m.brand || '?'; i.generic = m.generic || ''; return i;
    });
    var customer = rows_('customers').filter(function (c) { return c.id === sale.customerId; })[0] || {};
    var doctor = rows_('doctors').filter(function (x) { return x.id === sale.doctorId; })[0] || null;
    return { sale: clean_(sale),
      items: items,
      customer: clean_(customer),
      returns: rows_('saleReturns').filter(function (r) { return r.saleId === id; }).map(clean_),
      doctor: doctor ? clean_(doctor) : null };
  },
  saleReturn: function (user, r) {
    requireUser_(user);
    var sale = rows_('sales').filter(function (s) { return s.id === r.saleId; })[0];
    if (!sale) throw new Error('Sale not found');
    var id = nextId_('SR', 'saleReturns'), refund = 0;
    var allItems = rows_('saleItems');
    (r.items || []).forEach(function (it) {
      var si = allItems.filter(function (x) { return x.id === it.saleItemId; })[0]; if (!si) return;
      var med = medById_(si.medicineId);
      var units = num_(it.qty) * levelU_(med, si.level);
      refund += num_(it.qty) * num_(si.rate);
      if (r.restockTo === 'batch' && si.batchId) {
        var b = batchById_(si.batchId);
        if (b) { b.qty = num_(b.qty) + units; update_('batches', b.id, Object.assign(clean_(b), { qty: b.qty })); }
      }
      si.qty = Math.max(0, num_(si.qty) - num_(it.qty));
      update_('saleItems', si.id, clean_(si));
    });
    append_('saleReturns', { id: id, saleId: r.saleId, date: new Date().toISOString(),
      items: JSON.stringify(r.items), refund: refund, restockTo: r.restockTo || 'batch', reason: r.reason || '', userId: user.id });
    sale.paid = Math.max(0, num_(sale.paid) - refund);
    sale.total = Math.max(0, num_(sale.total) - refund);
    update_('sales', sale.id, clean_(sale));
    return { id: id, refund: refund };
  },
  recordCustomerPayment: function (user, p) {
    requireUser_(user);
    var c = rows_('customers').filter(function (x) { return x.id === p.customerId; })[0];
    if (!c) throw new Error('Customer not found');
    c.balance = Math.max(0, num_(c.balance) - num_(p.amount));
    update_('customers', c.id, clean_(c));
    append_('income', { id: nextId_('IN', 'income'), date: p.date || todayStr_(), head: 'Customer Dues Collection',
      amount: num_(p.amount), notes: (p.notes || '') + ' [' + c.name + ']', userId: user.id });
    return true;
  },

  /* ---------- doctors / prescriptions ---------- */
  listDoctors: function (user, q) {
    requireUser_(user); q = String(q || '').toLowerCase();
    return rows_('doctors').filter(function (x) {
      return !q || (String(x.name) + ' ' + String(x.specialization)).toLowerCase().indexOf(q) >= 0;
    }).map(clean_);
  },
  saveDoctor: function (user, x) {
    requireUser_(user);
    if (x.id) { var r = rows_('doctors').filter(function (y) { return y.id === x.id; })[0]; if (r) update_('doctors', x.id, Object.assign(clean_(r), x)); return x.id; }
    x.id = nextId_('D', 'doctors'); append_('doctors', x); return x.id;
  },
  deleteDoctor: function (user, id) { requireUser_(user); remove_('doctors', id); return true; },
  listPrescriptions: function (user, f) {
    requireUser_(user); f = f || {};
    var docs = {}, custs = {};
    rows_('doctors').forEach(function (x) { docs[x.id] = x.name; });
    rows_('customers').forEach(function (x) { custs[x.id] = x.name; });
    return rows_('prescriptions').filter(function (p) {
      return (!f.doctorId || p.doctorId === f.doctorId) && (!f.customerId || p.customerId === f.customerId);
    }).map(function (p) { p = clean_(p); p.doctor = docs[p.doctorId] || '?'; p.customer = custs[p.customerId] || '?'; return p; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  },
  savePrescription: function (user, p) {
    requireUser_(user);
    if (p.id) { var r = rows_('prescriptions').filter(function (x) { return x.id === p.id; })[0]; if (r) update_('prescriptions', p.id, Object.assign(clean_(r), p)); return p.id; }
    p.id = nextId_('RX', 'prescriptions'); append_('prescriptions', p); return p.id;
  },

  /* ---------- customers ---------- */
  listCustomers: function (user, q) {
    requireUser_(user); q = String(q || '').toLowerCase();
    return rows_('customers').filter(function (c) {
      return !q || (String(c.name) + ' ' + String(c.phone)).toLowerCase().indexOf(q) >= 0;
    }).map(clean_);
  },
  saveCustomer: function (user, c) {
    requireUser_(user);
    if (c.id) { var r = rows_('customers').filter(function (x) { return x.id === c.id; })[0]; if (r) update_('customers', c.id, Object.assign(clean_(r), c)); return c.id; }
    c.id = nextId_('C', 'customers'); c.balance = 0; c.loyaltyPoints = 0; append_('customers', c); return c.id;
  },
  deleteCustomer: function (user, id) {
    requireUser_(user);
    if (rows_('sales').some(function (s) { return s.customerId === id; })) throw new Error('Cannot delete: sales history exists');
    remove_('customers', id); return true;
  },
  getCustomerHistory: function (user, id) {
    requireUser_(user);
    var customer = rows_('customers').filter(function (c) { return c.id === id; })[0];
    if (!customer) throw new Error('Customer not found');
    var sales = rows_('sales').filter(function (s) { return s.customerId === id; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).map(clean_);
    var saleIds = sales.map(function (s) { return s.id; });
    return {
      customer: clean_(customer), sales: sales,
      returns: rows_('saleReturns').filter(function (r) { return saleIds.indexOf(r.saleId) >= 0; }).map(clean_),
      prescriptions: rows_('prescriptions').filter(function (p) { return p.customerId === id; }).map(clean_)
    };
  },

  /* ---------- accounting ---------- */
  listExpenses: function (user, f) {
    requireUser_(user); f = f || {};
    return rows_('expenses').filter(function (e) { return (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to); })
      .map(clean_).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  },
  saveExpense: function (user, e) {
    requireUser_(user);
    e.id = nextId_('EX', 'expenses'); e.userId = user.id; append_('expenses', e); return e.id;
  },
  listIncome: function (user, f) {
    requireUser_(user); f = f || {};
    return rows_('income').filter(function (e) { return (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to); })
      .map(clean_).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  },
  saveIncome: function (user, e) {
    requireUser_(user);
    e.id = nextId_('IN', 'income'); e.userId = user.id; append_('income', e); return e.id;
  },
  listBanks: function (user) { requireUser_(user); return rows_('banks').map(clean_); },
  saveBank: function (user, b) {
    requireUser_(user);
    if (b.id) { var r = rows_('banks').filter(function (x) { return x.id === b.id; })[0]; if (r) update_('banks', b.id, Object.assign(clean_(r), b)); return b.id; }
    b.id = nextId_('BK', 'banks'); append_('banks', b); return b.id;
  },
  getCashBook: function (user, from, to) {
    requireUser_(user);
    var rws = [];
    rows_('sales').forEach(function (s) {
      try { JSON.parse(s.payments || '[]').forEach(function (p) {
        if (p.method === 'Cash') rws.push({ date: String(s.date).slice(0, 10), desc: 'Sale ' + s.id, type: 'in', amount: num_(p.amount) });
      }); } catch (e) {}
    });
    rows_('expenses').forEach(function (e) { rws.push({ date: e.date, desc: e.head + ' — ' + (e.notes || ''), type: 'out', amount: num_(e.amount) }); });
    rows_('income').forEach(function (e) { rws.push({ date: e.date, desc: e.head + ' — ' + (e.notes || ''), type: 'in', amount: num_(e.amount) }); });
    rows_('supplierPayments').forEach(function (p) { rws.push({ date: p.date, desc: 'Supplier payment', type: 'out', amount: num_(p.amount) }); });
    var f = rws.filter(function (r) { return (!from || r.date >= from) && (!to || r.date <= to); })
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var bal = 0;
    f.forEach(function (r) { bal += r.type === 'in' ? r.amount : -r.amount; r.balance = bal; });
    return { rows: f,
      totalIn: f.filter(function (r) { return r.type === 'in'; }).reduce(function (s, r) { return s + r.amount; }, 0),
      totalOut: f.filter(function (r) { return r.type === 'out'; }).reduce(function (s, r) { return s + r.amount; }, 0) };
  },
  getProfitLoss: function (user, from, to) {
    requireUser_(user);
    var sales = rows_('sales').filter(function (s) { return (!from || String(s.date).slice(0, 10) >= from) && (!to || String(s.date).slice(0, 10) <= to); });
    var rev = sales.reduce(function (s, x) { return s + num_(x.total); }, 0);
    var items = rows_('saleItems'), cogs = 0;
    sales.forEach(function (s) {
      items.filter(function (i) { return i.saleId === s.id; }).forEach(function (i) {
        var b = batchById_(i.batchId);
        cogs += num_(i.qty) * levelU_(medById_(i.medicineId), i.level) * (b ? num_(b.cost) : 0);
      });
    });
    var exp = rows_('expenses').filter(function (e) { return (!from || e.date >= from) && (!to || e.date <= to); });
    var inc = rows_('income').filter(function (e) { return (!from || e.date >= from) && (!to || e.date <= to) && e.head !== 'Customer Dues Collection'; });
    var byHead = {};
    exp.forEach(function (e) { byHead[e.head] = (byHead[e.head] || 0) + num_(e.amount); });
    var tExp = exp.reduce(function (s, e) { return s + num_(e.amount); }, 0);
    var tInc = inc.reduce(function (s, e) { return s + num_(e.amount); }, 0);
    return { sales: rev, cogs: cogs, gross: rev - cogs, expenses: tExp, otherIncome: tInc, net: rev - cogs - tExp + tInc, byHead: byHead };
  },

  /* ---------- payroll ---------- */
  listEmployees: function (user) { requireUser_(user); return rows_('employees').map(clean_); },
  saveEmployee: function (user, e) {
    requireUser_(user);
    if (e.id) { var r = rows_('employees').filter(function (x) { return x.id === e.id; })[0]; if (r) update_('employees', e.id, Object.assign(clean_(r), e)); return e.id; }
    e.id = nextId_('E', 'employees'); e.active = true; append_('employees', e); return e.id;
  },
  recordAdvance: function (user, a) {
    requireUser_(user);
    append_('advances', { id: nextId_('ADV', 'advances'), employeeId: a.employeeId, date: a.date || todayStr_(),
      amount: num_(a.amount), notes: a.notes || '', userId: user.id });
    return true;
  },
  listAdvances: function (user, employeeId, month) {
    requireUser_(user);
    return rows_('advances').filter(function (a) { return a.employeeId === employeeId && (!month || String(a.date).slice(0, 7) === month); }).map(clean_);
  },
  generatePayroll: function (user, m) {
    requireUser_(user);
    var month = (m && typeof m === 'object') ? m.month : m;
    if (rows_('payroll').some(function (p) { return p.month === month; })) throw new Error('Payroll for ' + month + ' already generated');
    var ids = [];
    rows_('employees').filter(function (e) { return bool_(e.active); }).forEach(function (e) {
      var adv = rows_('advances').filter(function (a) { return a.employeeId === e.id && String(a.date).slice(0, 7) === month; })
        .reduce(function (s, a) { return s + num_(a.amount); }, 0);
      var id = nextId_('PR', 'payroll');
      append_('payroll', { id: id, employeeId: e.id, month: month, salary: num_(e.salary), advances: adv,
        net: num_(e.salary) - adv, paid: false, date: todayStr_(), userId: user.id });
      ids.push(id);
    });
    return ids;
  },
  listPayroll: function (user, month) {
    requireUser_(user);
    var emps = {}; rows_('employees').forEach(function (e) { emps[e.id] = e.name; });
    return rows_('payroll').filter(function (p) { return !month || p.month === month; })
      .map(function (p) { p = clean_(p); p.employee = emps[p.employeeId] || '?'; p.paid = bool_(p.paid); return p; });
  },
  markPayrollPaid: function (user, id) {
    requireUser_(user);
    var p = rows_('payroll').filter(function (x) { return x.id === id; })[0];
    if (!p) throw new Error('Not found');
    p.paid = true; update_('payroll', id, clean_(p));
    append_('expenses', { id: nextId_('EX', 'expenses'), date: todayStr_(), head: 'Salary',
      amount: num_(p.net), notes: 'Salary ' + p.month + ' [' + p.employeeId + ']', userId: user.id });
    return true;
  },

  /* ---------- reports ---------- */
  reportSales: function (user, f) {
    requireUser_(user); f = f || {};
    var users = {}; rows_('users').forEach(function (x) { users[x.id] = x.name; });
    var meds = {}; rows_('medicines').forEach(function (m) { meds[m.id] = m.brand; });
    var sales = rows_('sales').filter(function (s) {
      return (!f.from || String(s.date).slice(0, 10) >= f.from) && (!f.to || String(s.date).slice(0, 10) <= f.to);
    });
    var items = rows_('saleItems'), by = {};
    function bump(k, qty, amt) { by[k] = by[k] || { label: k, qty: 0, amount: 0 }; by[k].qty += qty; by[k].amount += amt; }
    if (f.groupBy === 'medicine') {
      items.filter(function (i) { return sales.some(function (s) { return s.id === i.saleId; }); })
        .forEach(function (i) { bump(meds[i.medicineId] || i.medicineId, num_(i.qty), num_(i.amount)); });
    } else if (f.groupBy === 'user') {
      sales.forEach(function (s) { bump(users[s.userId] || s.userId, 1, num_(s.total)); });
    } else {
      sales.forEach(function (s) { bump(String(s.date).slice(0, 10), 1, num_(s.total)); });
    }
    var rws = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return String(a.label).localeCompare(String(b.label)); });
    return { rows: rws, total: rws.reduce(function (s, r) { return s + r.amount; }, 0), count: sales.length };
  },
  reportPurchases: function (user, f) {
    requireUser_(user); f = f || {};
    var pos = {}, sups = {};
    rows_('pos').forEach(function (p) { pos[p.id] = p; });
    rows_('suppliers').forEach(function (s) { sups[s.id] = s.name; });
    var rws = rows_('grns').filter(function (g) { return (!f.from || g.date >= f.from) && (!f.to || g.date <= f.to); })
      .map(function (g) { var po = pos[g.poId] || {};
        return { date: g.date, grn: g.id, po: g.poId, supplier: sups[po.supplierId] || '?', invoice: g.invoiceNo, charges: num_(g.charges), total: num_(g.total) }; });
    return { rows: rws, total: rws.reduce(function (s, r) { return s + r.total; }, 0) };
  },
  reportInventory: function (user) {
    requireUser_(user);
    var meds = {}; rows_('medicines').forEach(function (m) { meds[m.id] = m.brand; });
    var rws = rows_('batches').filter(function (b) { return num_(b.qty) > 0; }).map(function (b) {
      return { brand: meds[b.medicineId] || '?', batch: b.batchNo, expiry: b.expiry, qty: num_(b.qty),
        cost: num_(b.cost), value: num_(b.qty) * num_(b.cost), mrp: num_(b.mrp) };
    });
    return { rows: rws,
      totalValue: rws.reduce(function (s, r) { return s + r.value; }, 0),
      totalMRP: rws.reduce(function (s, r) { return s + r.qty * r.mrp; }, 0) };
  },
  reportExpiry: function (user, days) {
    requireUser_(user);
    var a = API.getStockAlerts(user);
    return (num_(days) < 0 ? a.expired : a.nearExpiry.filter(function (r) { return r.daysLeft <= num_(days); }));
  },
  reportFastMovers: function (user, f) {
    requireUser_(user); f = f || {};
    var meds = {}; rows_('medicines').forEach(function (m) { meds[m.id] = m; });
    var sales = rows_('sales').filter(function (s) {
      return (!f.from || String(s.date).slice(0, 10) >= f.from) && (!f.to || String(s.date).slice(0, 10) <= f.to);
    });
    var saleIds = sales.map(function (s) { return s.id; });
    var by = {};
    rows_('saleItems').filter(function (i) { return saleIds.indexOf(i.saleId) >= 0; }).forEach(function (i) {
      var m = meds[i.medicineId] || {}, k = m.brand || i.medicineId;
      by[k] = by[k] || { brand: k, units: 0, amount: 0 };
      by[k].units += num_(i.qty) * levelU_(m, i.level);
      by[k].amount += num_(i.amount);
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return b.units - a.units; }).slice(0, f.limit || 20);
  },
  reportDues: function (user) {
    requireUser_(user);
    return {
      customers: rows_('customers').filter(function (c) { return num_(c.balance) > 0; })
        .map(function (c) { return { name: c.name, phone: c.phone, balance: num_(c.balance) }; }),
      suppliers: rows_('suppliers').filter(function (s) { return num_(s.balance) > 0; })
        .map(function (s) { return { name: s.name, phone: s.phone, balance: num_(s.balance) }; })
    };
  },

  /* ---------- AI ---------- */
  aiAsk: function (user, question) {
    requireUser_(user);
    var provider = setting_('aiProvider', 'none'), key = setting_('aiKey', '');
    var inv = API.reportInventory(user);
    var stats = 'Store stats — medicines: ' + rows_('medicines').length +
      ', sales records: ' + rows_('sales').length +
      ', inventory value: ' + inv.totalValue.toFixed(2) +
      ', low stock items: ' + API.getStockAlerts(user).lowStock.length + '.';
    if (!key || provider === 'none') {
      return { answer: 'Demo mode (no AI key configured in Settings). ' + stats + ' Add a Gemini API key in Settings → AI to enable live answers.' };
    }
    var prompt = 'You are a pharmacy store assistant. ' + stats + ' Question: ' + question + ' Answer briefly.';
    try {
      var resp;
      if (provider === 'gemini') {
        resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key, {
          method: 'post', contentType: 'application/json',
          payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), muteHttpExceptions: true
        });
        var j = JSON.parse(resp.getContentText());
        return { answer: j.candidates[0].content.parts[0].text };
      } else {
        resp = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
          method: 'post', contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + key },
          payload: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
          muteHttpExceptions: true
        });
        var j2 = JSON.parse(resp.getContentText());
        return { answer: j2.choices[0].message.content };
      }
    } catch (e) { throw new Error('AI request failed: ' + e.message); }
  }
};

/* ---------------- one-time setup ---------------- */
function setupSheet() {
  Object.keys(SHEETS).forEach(sh_);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName('Sheet1')) ss.deleteSheet(ss.getSheetByName('Sheet1'));

  function setSettings(list) {
    var cur = {};
    rows_('settings').forEach(function (x) { cur[x.key] = true; });
    list.forEach(function (kv) {
      if (!cur[kv[0]]) append_('settings', { key: kv[0], value: kv[1] });
    });
  }
  setSettings([
    ['storeName', 'City Pharmacy'], ['address', 'Main Road, Lahore'], ['phone', '0300-1234567'],
    ['email', ''], ['logoUrl', ''], ['currency', 'PKR'],
    ['receiptFooter', 'Thank you for your visit. Get well soon!'],
    ['whatsapp', 'FALSE'], ['whatsappNumber', ''],
    ['aiProvider', 'none'], ['aiKey', ''], ['printSize', '80mm']
  ]);
  if (!rows_('paymentMethods').length) {
    append_('paymentMethods', { id: 'pm1', name: 'Cash', type: 'cash' });
    append_('paymentMethods', { id: 'pm2', name: 'Card', type: 'card' });
    append_('paymentMethods', { id: 'pm3', name: 'Bank Transfer', type: 'bank' });
  }
  if (!rows_('users').length) {
    append_('users', { id: 'U-0001', name: 'Administrator', username: 'admin',
      passwordHash: sha256_('admin123'), role: 'admin', active: true });
  }
  if (!rows_('permissions').length) {
    var mods = ['dashboard','pos','sales','inventory','purchases','suppliers','doctors','prescriptions',
      'customers','accounting','payroll','reports','users','settings','ai'];
    var full = {}; mods.forEach(function (m) { full[m] = { view: true, create: true, edit: true, delete: true }; });
    var mgr = JSON.parse(JSON.stringify(full)); delete mgr.users; delete mgr.settings;
    var pharm = JSON.parse(JSON.stringify(full)); delete pharm.users; delete pharm.settings; delete pharm.payroll; delete pharm.accounting;
    var cash = {};
    ['dashboard','pos','sales','customers'].forEach(function (m) { cash[m] = { view: true, create: true, edit: false, delete: false }; });
    append_('permissions', { id: 'R-0001', role: 'admin', matrix: JSON.stringify(full) });
    append_('permissions', { id: 'R-0002', role: 'manager', matrix: JSON.stringify(mgr) });
    append_('permissions', { id: 'R-0003', role: 'pharmacist', matrix: JSON.stringify(pharm) });
    append_('permissions', { id: 'R-0004', role: 'cashier', matrix: JSON.stringify(cash) });
  }
  seedDemoData_();
  Logger.log('Setup complete. Now Deploy > New deployment > Web app (Execute as: Me).');
  return 'Setup complete';
}

/* Demo data so the deployed app is not empty — safe to delete rows later */
function seedDemoData_() {
  if (rows_('medicines').length) return;
  var user = { id: 'U-0001', name: 'Setup', username: 'admin', role: 'admin' };
  var sups = [
    API.saveSupplier(user, { name: 'Sami Distributors', phone: '0301-1111111', address: 'Lahore' }),
    API.saveSupplier(user, { name: 'GSK Traders', phone: '0302-2222222', address: 'Lahore' }),
    API.saveSupplier(user, { name: 'PharmaLink', phone: '0303-3333333', address: 'Lahore' })
  ];
  var meds = [
    ['Paracetamol','Panadol','GSK','500mg','Tablet',10,50,200,'A1',false,''],
    ['Ibuprofen','Brufen','Abbott','400mg','Tablet',20,100,500,'A2',false,''],
    ['Amoxicillin','Amoxil','GSK','250mg','Capsule',30,150,600,'B1',false,''],
    ['Omeprazole','Risek','Sami','20mg','Capsule',10,50,200,'B2',false,''],
    ['Metformin','Glucophage','Martin Dow','500mg','Tablet',50,200,1000,'C1',false,''],
    ['Cetirizine','Rigix','PharmEvo','10mg','Tablet',10,100,1000,'A3',false,''],
    ['Insulin Glargine','Lantus','Sanofi','100IU/ml','Injection',1,1,5,'E1',true,'y']
  ];
  meds.forEach(function (m, i) {
    var id = API.saveMedicine(user, { generic: m[0], brand: m[1], manufacturer: m[2], strength: m[3], form: m[4],
      hsn: '3004', gst: 0, rack: m[8], controlled: m[9], storage: 'Cool & dry place', reorderLevel: 50,
      rxRequired: m[10] === 'y', pack: { carton: m[7], box: m[6], packet: m[5] } });
    var mrp = 100 + i * 8;
    API.saveBatch(user, { medicineId: id, batchNo: 'B' + (1000 + i), mfg: '2025-06-01',
      expiry: i % 3 === 0 ? '2026-11-20' : '2027-12-31', cost: Math.round((mrp / m[5]) * 0.7 * 100) / 100, mrp: mrp,
      qty: m[7] * 2, supplierId: sups[i % 3] });
  });
  API.saveCustomer(user, { name: 'Walk-in Customer', phone: '', address: '', allergies: '', notes: '', creditLimit: 0, membershipCard: '' });
  API.saveCustomer(user, { name: 'Ahmed Raza', phone: '0300-5551234', address: 'Model Town, Lahore', allergies: 'Penicillin', notes: 'Diabetic', creditLimit: 5000, membershipCard: 'MC-1001' });
  API.saveDoctor(user, { name: 'Dr. Imran Sheikh', regNo: 'PMC-12345', specialization: 'General Physician', clinic: 'City Clinic', phone: '0300-9990001' });
  API.saveEmployee(user, { name: 'Bilal Ahmed', role: 'Pharmacist', phone: '0300-1112223', salary: 60000 });
}
