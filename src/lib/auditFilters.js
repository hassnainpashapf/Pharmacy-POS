// Date input values and displayed timestamps use the same local calendar.
export function filterAuditLogs(logs, { query = '', user = '', action = '', from = '', to = '' } = {}) {
  const term = query.trim().toLowerCase()
  return logs.filter((log) => {
    const date = new Date(log.at)
    const valid = !Number.isNaN(date.getTime())
    const day = valid ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : ''
    return (!user || log.user === user)
      && (!action || log.action === action)
      && (!from || (day && day >= from))
      && (!to || (day && day <= to))
      && (!term || `${log.user || ''} ${log.action || ''} ${log.detail || ''}`.toLowerCase().includes(term))
  }).sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
}
