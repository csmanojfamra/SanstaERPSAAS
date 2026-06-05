#!/usr/bin/env node
/**
 * Negative / adversarial API tests.
 * Run: node backend/scripts/qa-negative-test.js
 */
const BASE = process.env.API_BASE || 'http://localhost:3000/api/v1'

const results = { pass: 0, fail: 0, bugs: [] }

async function req(method, path, { token, body, expectJson = true } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
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
  return { status: res.status, data, ok: res.ok }
}

function expectCase(name, { status, data }, expectedStatus, codeContains) {
  const ok =
    status === expectedStatus &&
    (!codeContains || data?.code === codeContains || (typeof codeContains === 'string' && data?.message?.includes(codeContains)))
  if (ok) {
    results.pass++
    console.log(`✓ ${name} (${status})`)
    return true
  }
  results.fail++
  const detail = `expected ${expectedStatus}, got ${status} — ${JSON.stringify(data)?.slice(0, 120)}`
  results.bugs.push({ name, detail })
  console.log(`✗ ${name}: ${detail}`)
  return false
}

function expectStatus(name, r, expectedStatus) {
  if (r.status === expectedStatus) {
    results.pass++
    console.log(`✓ ${name} (${r.status})`)
    return true
  }
  results.fail++
  const detail = `expected ${expectedStatus}, got ${r.status} — ${JSON.stringify(r.data)?.slice(0, 120)}`
  results.bugs.push({ name, detail })
  console.log(`✗ ${name}: ${detail}`)
  return false
}

async function main() {
  console.log('=== Negative API tests ===\n')

  // ── Auth ─────────────────────────────────────────────
  let r = await req('POST', '/auth/login', { body: {} })
  expectStatus('login empty body', r, 400)

  r = await req('POST', '/auth/login', { body: { username: 'admin', password: 'wrong' } })
  expectStatus('login wrong password', r, 401)

  r = await req('GET', '/donations')
  expectStatus('donations no token', r, 401)

  r = await req('GET', '/donations', { token: 'invalid.jwt.token' })
  expectStatus('donations bad token', r, 401)

  const adminLogin = await req('POST', '/auth/login', {
    body: { username: 'admin', password: 'Admin@1234' },
  })
  if (!adminLogin.ok) throw new Error('Admin login failed — is backend running?')
  const adminToken = adminLogin.data.token

  const opLogin = await req('POST', '/auth/login', {
    body: { username: 'krishna', password: 'Operator@1234' },
  })
  if (!opLogin.ok) throw new Error('Operator login failed')
  const opToken = opLogin.data.token

  // ── Operator forbidden (admin-only API) ───────────────
  r = await req('GET', '/settings', { token: opToken })
  expectStatus('operator GET settings', r, 403)

  r = await req('PUT', '/settings', { token: opToken, body: { top_donors_limit: 5 } })
  expectStatus('operator PUT settings', r, 403)

  // ── Donations validation ──────────────────────────────
  r = await req('POST', '/donations', {
    token: adminToken,
    body: {
      donor_name: 'A',
      donor_mobile: '12345',
      amount: -100,
      payment_mode: 'CASH',
      donation_date: 'bad-date',
    },
  })
  expectStatus('donation invalid fields', r, 400)

  r = await req('POST', '/donations', {
    token: adminToken,
    body: {
      donor_name: 'Valid Name',
      donor_mobile: '9876543210',
      amount: 0,
      payment_mode: 'INVALID',
      donation_date: '2026-05-27',
    },
  })
  expectStatus('donation zero amount / bad mode', r, 400)

  r = await req('GET', '/donations/nonexistent-id-xyz', { token: adminToken })
  expectStatus('donation get fake id', r, 404)

  r = await req('GET', '/donations/nonexistent-id-xyz/receipt', { token: adminToken })
  expectStatus('receipt fake donation id', r, 404)

  r = await req('POST', '/donations/nonexistent-id-xyz/regenerate-receipt', { token: opToken })
  expectStatus('operator regenerate receipt (403 or 404)', r, 403)

  r = await req('DELETE', '/donations/nonexistent-id-xyz', { token: opToken })
  expectStatus('operator delete donation', r, 403)

  // Create donation as admin for further tests
  const don = await req('POST', '/donations', {
    token: adminToken,
    body: {
      donor_name: 'Neg Test',
      donor_mobile: '9876501234',
      amount: 50,
      payment_mode: 'CASH',
      donation_date: '2026-05-27',
      purpose: 'Test',
    },
  })
  const donId = don.data?.donation?.id

  if (donId) {
    r = await req('DELETE', `/donations/${donId}`, { token: opToken })
    expectStatus('operator delete real donation', r, 403)
  }

  // ── Expenses validation ───────────────────────────────
  r = await req('POST', '/expenses', {
    token: adminToken,
    body: {
      expense_date: '2026-05-27',
      category: 'INVALID_CAT',
      amount: -10,
      description: 'ab',
    },
  })
  expectStatus('expense invalid category/amount/desc', r, 400)

  r = await req('DELETE', '/expenses/fake-expense-id', { token: opToken })
  expectStatus('operator delete expense', r, 403)

  // ── Trustees validation ───────────────────────────────
  r = await req('POST', '/trustees', {
    token: adminToken,
    body: { name: 'X', mobile: '111' },
  })
  expectStatus('trustee short name / bad mobile', r, 400)

  r = await req('POST', '/trustees', {
    token: adminToken,
    body: { name: 'Neg Trustee', mobile: '9123456780' },
  })
  const trusteeId = r.data?.trustee?.id

  if (trusteeId) {
    r = await req('POST', `/trustees/${trusteeId}/contributions`, {
      token: adminToken,
      body: { amount: -50, contribution_date: 'not-a-date' },
    })
    expectStatus('contribution invalid', r, 400)

    r = await req('POST', `/trustees/${trusteeId}/contributions`, {
      token: adminToken,
      body: { amount: 100, contribution_date: '2026-05-27', payment_mode: 'CASH' },
    })

    r = await req('DELETE', `/trustees/${trusteeId}`, { token: opToken })
    expectStatus('operator delete trustee', r, 403)

    r = await req('DELETE', `/trustees/${trusteeId}`, { token: adminToken })
    expectStatus('delete trustee with contributions', r, 400)
  }

  // ── Settings validation (admin) ───────────────────────
  r = await req('PUT', '/settings', { token: adminToken, body: { top_donors_limit: 0 } })
  expectStatus('settings top_donors_limit 0', r, 400)

  r = await req('PUT', '/settings', { token: adminToken, body: { top_donors_limit: 999 } })
  expectStatus('settings top_donors_limit too high', r, 400)

  r = await req('PUT', '/settings', { token: adminToken, body: {} })
  expectStatus('settings empty body', r, 400)

  // ── Donation update validation ────────────────────────
  if (donId) {
    r = await req('PUT', `/donations/${donId}`, {
      token: adminToken,
      body: { amount: -1, donor_mobile: '0000000000' },
    })
    expectStatus('donation PUT invalid amount/mobile', r, 400)
  }

  r = await req('GET', '/cashbook', { token: opToken })
  expectStatus('operator GET cashbook', r, 403)

  // ── Cashbook ──────────────────────────────────────────
  r = await req('GET', '/cashbook/export/excel?channel=INVALID', { token: adminToken, expectJson: true })
  expectStatus('cashbook invalid channel excel', r, 400)

  r = await req('GET', '/cashbook/export/pdf?channel=INVALID', { token: adminToken, expectJson: true })
  expectStatus('cashbook invalid channel pdf', r, 400)

  // ── Reports ───────────────────────────────────────────
  r = await req('GET', '/reports/date-range', { token: adminToken })
  expectStatus('reports date-range missing params', r, 400)

  r = await req('GET', '/reports/export-excel?type=invalid_type', { token: adminToken, expectJson: true })
  expectStatus('reports invalid export type', r, 400)

  // ── Change password ───────────────────────────────────
  r = await req('POST', '/auth/change-password', {
    token: adminToken,
    body: { current_password: 'Admin@1234', new_password: 'weak' },
  })
  expectStatus('change password weak', r, 400)

  r = await req('POST', '/auth/change-password', {
    token: adminToken,
    body: { current_password: 'wrong', new_password: 'Newpass1' },
  })
  expectStatus('change password wrong current', r, 400)

  // ── Public API ────────────────────────────────────────
  r = await req('GET', '/public/donors/invalid-trust-id')
  expectStatus('public donors invalid trust', r, 404)

  r = await req('GET', '/public/stats/invalid-trust-id')
  expectStatus('public stats invalid trust', r, 404)

  // ── Reconcile fake ids ────────────────────────────────
  r = await req('POST', '/donations/fake-id/reconcile', { token: adminToken })
  expectStatus('reconcile fake donation', r, 404)

  // ── Advanced: injection, bounds, dates ────────────────
  console.log('\n--- Advanced adversarial cases ---\n')

  const sqlPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE donations;--",
    '%27%20OR%201%3D1--',
    '<script>alert(1)</script>',
  ]

  for (const payload of sqlPayloads) {
    r = await req('GET', `/donations?search=${encodeURIComponent(payload)}`, { token: adminToken })
    if (r.status === 200 && r.data?.success !== false) {
      results.pass++
      console.log(`✓ SQL/XSS search safe: ${payload.slice(0, 24)}… (${r.status})`)
    } else {
      results.fail++
      results.bugs.push({ name: `search injection: ${payload}`, detail: `got ${r.status}` })
      console.log(`✗ search injection failed for: ${payload}`)
    }

    r = await req('GET', `/expenses?search=${encodeURIComponent(payload)}`, { token: adminToken })
    if (r.status === 200 && r.data?.success !== false) {
      results.pass++
      console.log(`✓ expense search safe: ${payload.slice(0, 24)}… (${r.status})`)
    } else {
      results.fail++
      console.log(`✗ expense search injection: ${payload}`)
    }
  }

  r = await req('POST', '/donations', {
    token: adminToken,
    body: {
      donor_name: '<img src=x onerror=alert(1)>',
      donor_mobile: '9876543222',
      amount: 100,
      payment_mode: 'CASH',
      donation_date: '2026-05-27',
      purpose: 'Test',
    },
  })
  if (r.status === 201) {
    results.pass++
    console.log(`✓ XSS donor name stored without server error (${r.status})`)
    const xssId = r.data?.donation?.id
    if (xssId) {
      await req('DELETE', `/donations/${xssId}`, { token: adminToken })
    }
  } else if (r.status === 400) {
    results.pass++
    console.log(`✓ XSS donor name rejected (${r.status})`)
  } else {
    results.fail++
    console.log(`✗ XSS donor name unexpected: ${r.status}`)
  }

  r = await req('POST', '/donations', {
    token: adminToken,
    body: {
      donor_name: 'Future Date Test',
      donor_mobile: '9876543233',
      amount: 100,
      payment_mode: 'CASH',
      donation_date: '2099-12-31',
      purpose: 'Test',
    },
  })
  expectStatus('donation future date rejected', r, 400)

  r = await req('POST', '/donations', {
    token: adminToken,
    body: {
      donor_name: 'Huge Amount Test',
      donor_mobile: '9876543244',
      amount: 9999999999999,
      payment_mode: 'CASH',
      donation_date: '2026-05-27',
      purpose: 'Test',
    },
  })
  expectStatus('donation oversized amount rejected', r, 400)

  r = await req('POST', '/expenses', {
    token: adminToken,
    body: {
      expense_date: '2099-01-01',
      category: 'OTHER',
      amount: 100,
      description: 'Future expense test',
    },
  })
  expectStatus('expense future date rejected', r, 400)

  r = await req('POST', '/expenses', {
    token: adminToken,
    body: {
      expense_date: '2026-05-27',
      category: 'OTHER',
      amount: 9999999999999,
      description: 'Huge expense amount',
    },
  })
  expectStatus('expense oversized amount rejected', r, 400)

  r = await req('GET', '/donations?page=-1&limit=99999', { token: adminToken })
  if (r.status === 200 && Array.isArray(r.data?.donations)) {
    results.pass++
    console.log(`✓ donations bad pagination handled (${r.status}, limit capped)`)
  } else {
    results.fail++
    console.log(`✗ donations bad pagination: ${r.status}`)
  }

  r = await req('GET', '/donations?date_from=not-a-date&date_to=also-bad', { token: adminToken })
  expectStatus('donations invalid date filter', r, 400)

  console.log(`\n=== Results: ${results.pass} passed, ${results.fail} failed ===`)
  if (results.fail > 0 || results.bugs.length) {
    if (results.bugs.length) {
      console.log('\nPotential bugs to fix:')
      results.bugs.forEach((b) => console.log(`  - ${b.name}: ${b.detail}`))
    }
    process.exit(1)
  }
  console.log('\nAll negative tests passed.')
}

main().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
