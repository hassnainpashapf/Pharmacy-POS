// Same Jan–Dec groups as the original owner chart, using stored records only.
export function ownerSalesComparison(db, now = new Date()) {
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()]
  const colors = ['#714B67', '#d97706', '#00A09D']
  const months = Array.from({ length: 12 }, (_, month) => ({
    label: new Date(2000, month, 1).toLocaleDateString('en-GB', { month: 'short' }),
    values: years.map((year, index) => ({ year, color: colors[index], total: 0, count: 0, future: year === now.getFullYear() && month > now.getMonth() })),
  }))
  for (const sale of db.sales || []) {
    if (db.currentBranch && db.currentBranch !== 'ALL' && sale.branchId !== db.currentBranch) continue
    if (!sale.date) continue
    const date = /^\d{4}-\d{2}-\d{2}$/.test(sale.date) ? new Date(`${sale.date}T00:00:00`) : new Date(sale.date)
    const index = years.indexOf(date.getFullYear())
    if (!Number.isFinite(date.getTime()) || date > now || index < 0) continue
    const value = months[date.getMonth()].values[index]
    const total = Number(sale.total)
    if (!Number.isFinite(total)) continue
    value.total += total
    value.count++
  }
  return { years, colors, months }
}
