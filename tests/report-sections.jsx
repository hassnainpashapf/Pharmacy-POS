import React from 'react'
import assert from 'node:assert/strict'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import Reports from '../src/pages/Reports'

// Rendering only: never touch the user's browser storage or production data.
const cases = [
  ['analytics', 'Business Analytics', 'Monthly Sales Comparison', 'Current Stock Master'],
  ['sales', 'Sales Reports', 'Daily Sales Summary', 'Current Stock Master'],
  ['inventory', 'Inventory Reports', 'Current Stock Master', 'Daily Sales Summary'],
  ['financial', 'Financial Reports', 'Profit by Medicine', 'Daily Sales Summary'],
  ['unknown', 'Sales Reports', 'Daily Sales Summary', 'Current Stock Master'],
]

for (const [tab, title, initialReport, excludedReport] of cases) {
  const html = renderToString(<MemoryRouter initialEntries={[`/reports?tab=${tab}`]}><Reports /></MemoryRouter>)
  assert.ok(html.includes(title), `${tab}: section title`)
  assert.ok(html.includes(`<h3 class="text-base font-extrabold text-slate-900">${initialReport}</h3>`), `${tab}: initial report`)
  assert.ok(!html.includes(excludedReport), `${tab}: unrelated report excluded`)
}
console.log('PASS: four report sections and unknown-tab fallback')
