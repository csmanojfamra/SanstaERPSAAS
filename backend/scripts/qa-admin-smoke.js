#!/usr/bin/env node
/**
 * Admin API smoke test — run: node backend/scripts/qa-admin-smoke.js
 */
const BASE = process.env.API_BASE || 'http://localhost:3000/api/v1'

async function req(method, path, { token, body, expectJson = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const ct = res.headers.get('content-type') || ''
  let data = null
  if (expectJson && ct.includes('application/json')) {
    data = await res.json()
  } else {
    data = await res.arrayBuffer()
  }
  return { ok: res.ok, status: res.status, data, headers: res.headers }
}

function assert(name, cond, detail = '') {
  if (!cond) throw new Error(`${name}: ${detail}`)
  console.log(`✓ ${name}`)
}

async function main() {
  const login = await req('POST', '/auth/login', {
    body: { username: 'admin', password: 'Admin@1234' },
  })
  assert('login', login.ok && login.data.token, login.status)
  const token = login.data.token

  const endpoints = [
    ['GET', '/analytics/dashboard'],
    ['GET', '/donations?limit=5'],
    ['GET', '/trustees'],
    ['GET', '/expenses?limit=5'],
    ['GET', '/cashbook'],
    ['GET', '/reports/daily-summary?date=2026-05-27'],
    ['GET', '/reports/financial-summary'],
    ['GET', '/reports/trustee-contributions'],
    ['GET', '/reconciliation/logs?limit=5'],
    ['GET', '/audit-logs?limit=5'],
    ['GET', '/settings'],
    ['GET', '/analytics/notifications?limit=5'],
  ]

  for (const [method, path] of endpoints) {
    const r = await req(method, path, { token })
    assert(`${method} ${path}`, r.ok, `status ${r.status}`)
  }

  const trustee = await req('POST', '/trustees', {
    token,
    body: {
      name: 'QA Trustee',
      role: 'Member',
      mobile: '9123456789',
      display_order: 99,
    },
  })
  assert('create trustee', trustee.ok, JSON.stringify(trustee.data))
  const trusteeId = trustee.data.trustee?.id || trustee.data.id

  const contrib = await req('POST', `/trustees/${trusteeId}/contributions`, {
    token,
    body: {
      amount: 500,
      contribution_date: '2026-05-27',
      payment_mode: 'CASH',
      remarks: 'QA test',
    },
  })
  assert('create contribution', contrib.ok, JSON.stringify(contrib.data))

  const expense = await req('POST', '/expenses', {
    token,
    body: {
      category: 'OTHER',
      amount: 100,
      expense_date: '2026-05-27',
      description: 'QA expense',
      payment_channel: 'CASH',
    },
  })
  assert('create expense', expense.ok, JSON.stringify(expense.data))

  const excel = await req('GET', '/cashbook/export/excel?channel=both', { token, expectJson: false })
  assert('cashbook excel', excel.ok && excel.data.byteLength > 1000, `bytes ${excel.data.byteLength}`)

  const pdf = await req('GET', '/cashbook/export/pdf?channel=CASH', { token, expectJson: false })
  assert('cashbook pdf', pdf.ok && pdf.data.byteLength > 500, `bytes ${pdf.data.byteLength}`)

  const reportXlsx = await req('GET', '/reports/export-excel?type=donations', { token, expectJson: false })
  assert('reports excel', reportXlsx.ok && reportXlsx.data.byteLength > 1000)

  const donations = await req('GET', '/donations?limit=1', { token })
  const donId = donations.data.donations?.[0]?.id
  if (donId) {
    const receipt = await req('GET', `/donations/${donId}/receipt`, { token, expectJson: false })
    const buf = Buffer.from(receipt.data)
    assert('receipt pdf', receipt.ok && buf.slice(0, 4).toString() === '%PDF', `status ${receipt.status}`)
  }

  // cleanup QA trustee
  if (trusteeId) {
    const del = await req('DELETE', `/trustees/${trusteeId}`, { token })
    assert('delete qa trustee', del.ok || del.status === 200, `status ${del.status}`)
  }

  console.log('\nAll smoke tests passed.')
}

main().catch((e) => {
  console.error('\nFAILED:', e.message)
  process.exit(1)
})
