import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAuditLogs } from '../src/lib/auditFilters.js'
const records = [
  { id: '1', at: '2026-09-28T12:00:00', user: 'one', action: 'LOGIN', detail: '' },
  { id: '2', at: '2026-09-29T23:59:59', user: 'two', action: 'SALE', detail: 'Invoice 123' },
  { id: '3', at: 'invalid', user: 'one', action: 'UPDATE', detail: '' },
]
test('audit filters search/user/action, inclusive dates and sorting without mutating logs', () => {
  assert.equal(filterAuditLogs(records)[0].id, '2')
  assert.equal(records[0].id, '1')
  assert.deepEqual(filterAuditLogs(records, { query: 'invoice', user: 'two', action: 'SALE', from: '2026-09-29', to: '2026-09-29' }).map(log => log.id), ['2'])
  assert.equal(filterAuditLogs(records, { from: '2026-09-30', to: '2026-09-28' }).length, 0)
  assert.equal(filterAuditLogs(records, { from: '2026-01-01' }).length, 2)
})
