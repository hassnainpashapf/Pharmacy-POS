// Demand Forecasting & Smart Transfer Algorithms for Pharmacy POS V4
import { useDB, smartInventory } from './db'

export function getDemandForecast30Days() {
  const items = smartInventory()
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sun, 6 = Sat

  // Day of week seasonality factors (e.g. weekends have 20% higher pharmacy footfall)
  const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 1.05

  return items.map((it) => {
    const dailyBase = it.avgDaily || 2.5
    // Projected 30 days demand with seasonality adjustment
    const projected30Days = Math.round(dailyBase * 30 * weekendMultiplier)
    const stockRunoutDays = it.stock > 0 && it.avgDaily > 0 ? Math.round(it.stock / it.avgDaily) : (it.stock > 0 ? 99 : 0)
    
    // Suggested replenishment order
    const safetyBuffer = Math.round(dailyBase * 7) // 7 days safety stock
    const deficit = Math.max(0, projected30Days + safetyBuffer - it.stock)

    return {
      medicineId: it.medicine.id,
      name: it.medicine.name,
      strength: it.medicine.strength,
      currentStock: it.stock,
      avgDaily: it.avgDaily,
      projected30Days,
      stockRunoutDays,
      suggestedOrderQty: deficit,
      reorderPriority: stockRunoutDays <= 7 ? 'CRITICAL' : stockRunoutDays <= 14 ? 'HIGH' : 'NORMAL',
    }
  }).sort((a, b) => a.stockRunoutDays - b.stockRunoutDays)
}

// Smart Inter-Branch Transfer Recommender
export function getSmartTransferRecommendations(db) {
  const recommendations = []
  const medicines = db.medicines || []
  const branches = db.branches || []

  if (branches.length < 2) return []

  for (const m of medicines) {
    const branchStockMap = {}
    for (const b of branches) {
      const totalQty = (db.batches || [])
        .filter((batch) => batch.medicineId === m.id && batch.branchId === b.id)
        .reduce((sum, batch) => sum + batch.qty, 0)
      branchStockMap[b.id] = { branch: b, qty: totalQty }
    }

    const stockEntries = Object.values(branchStockMap)
    const surplusBranch = stockEntries.find((s) => s.qty >= 60)
    const deficitBranch = stockEntries.find((s) => s.qty <= 15)

    if (surplusBranch && deficitBranch && surplusBranch.branch.id !== deficitBranch.branch.id) {
      const transferQty = Math.min(Math.round(surplusBranch.qty * 0.4), 25)
      recommendations.push({
        medicineId: m.id,
        medicineName: `${m.name} ${m.strength}`,
        fromBranch: surplusBranch.branch,
        toBranch: deficitBranch.branch,
        fromStock: surplusBranch.qty,
        toStock: deficitBranch.qty,
        recommendedQty: transferQty,
        reason: `Rebalance: ${surplusBranch.branch.name} has surplus (${surplusBranch.qty} units), ${deficitBranch.branch.name} is running low (${deficitBranch.qty} units).`,
      })
    }
  }

  return recommendations
}
