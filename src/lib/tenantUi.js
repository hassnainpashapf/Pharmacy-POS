export const DEFAULT_APP_ID = 'PH-A1A4534D5D1B'

export function appIdFromSearch(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('appId')?.trim() ?? ''
}

export function getEffectiveAppId(search = globalThis.location?.search ?? '') {
  return appIdFromSearch(search) || DEFAULT_APP_ID
}

export function pharmacyLinks(appId = DEFAULT_APP_ID, origin = globalThis.location?.origin) {
  const targetAppId = appId || DEFAULT_APP_ID
  if (!targetAppId || !origin) return null
  const links = {}
  for (const [key, path] of [['admin', '/admin'], ['mobile', '/mobile']]) {
    const url = new URL(path, origin)
    url.searchParams.set('appId', targetAppId)
    links[key] = url.href
  }
  return links
}

export function inventorySessionMode(user, requestedAppId = '') {
  if (!user?.id) return 'auth'
  if (user.role === 'SUPERADMIN') return 'platform'
  if (!user.tenantId || !user.appId) return 'invalid'
  if (requestedAppId && requestedAppId !== user.appId && requestedAppId !== DEFAULT_APP_ID) return 'different-pharmacy'
  return 'ready'
}

export function tenantTotals(tenants) {
  return tenants.reduce((totals, tenant) => ({
    pharmacies: totals.pharmacies + 1,
    active: totals.active + (tenant.disabled ? 0 : 1),
    medicines: totals.medicines + (Number(tenant.medicineCount) || 0),
    stock: totals.stock + (Number(tenant.stockUnits) || 0),
    users: totals.users + (Number(tenant.userCount) || 0),
  }), { pharmacies: 0, active: 0, medicines: 0, stock: 0, users: 0 })
}
