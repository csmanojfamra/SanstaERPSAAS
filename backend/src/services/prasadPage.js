function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function when(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}

function renderPrasadPage(token) {
  const used = token.status === 'REDEEMED'
  const trustName = token.trust?.name_hindi || token.trust?.name || 'Mandir'
  const amount = Number(token.amount).toLocaleString('en-IN')
  const statusBlock = used
    ? `<div class="banner used">Yeh token pehle use ho chuka hai.<br>Prasad dubara mat dena.${
        token.redeemed_at ? `<div class="when">${esc(when(token.redeemed_at))}</div>` : ''
      }</div>`
    : `<form method="post" action="/p/${esc(token.code)}/redeem">
        <button type="submit">Prasad de diya</button>
      </form>
      <p class="hint">Ek baar dabane ke baad yeh token band ho jayega.</p>`

  return `<!doctype html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prasad token</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f6f1ea; color: #1c1917; }
    main { max-width: 420px; margin: 0 auto; padding: 20px 16px 40px; }
    h1 { font-size: 18px; margin: 0 0 4px; color: #7a1f2b; }
    .sub { margin: 0 0 16px; color: #57534e; font-size: 14px; }
    .card { background: #fff; border-radius: 16px; padding: 18px; box-shadow: 0 8px 24px rgba(0,0,0,.06); }
    .packets { font-size: 72px; line-height: 1; font-weight: 800; text-align: center; color: #7a1f2b; margin: 8px 0 0; }
    .label { text-align: center; color: #57534e; margin: 0 0 16px; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid #eee; font-size: 16px; }
    .row b { font-weight: 600; }
    button { width: 100%; margin-top: 18px; border: 0; border-radius: 12px; background: #15803d; color: #fff; font-size: 20px; font-weight: 700; padding: 16px; }
    .hint { text-align: center; color: #57534e; font-size: 13px; }
    .banner { margin-top: 18px; border-radius: 12px; padding: 16px; text-align: center; font-size: 18px; font-weight: 700; }
    .used { background: #fee2e2; color: #991b1b; }
    .when { margin-top: 8px; font-size: 13px; font-weight: 500; }
  </style>
</head>
<body>
  <main>
    <h1>${esc(trustName)}</h1>
    <p class="sub">Prasad counter</p>
    <div class="card">
      <p class="packets">${esc(token.packets)}</p>
      <p class="label">packet</p>
      <div class="row"><span>Name</span><b>${esc(token.donor_name)}</b></div>
      <div class="row"><span>Mobile</span><b>${esc(token.donor_mobile)}</b></div>
      <div class="row"><span>Amount</span><b>₹${esc(amount)}</b></div>
      ${statusBlock}
    </div>
  </main>
</body>
</html>`
}

function renderMissing() {
  return `<!doctype html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Token not found</title>
</head>
<body style="font-family:system-ui,sans-serif;padding:32px;text-align:center">
  <h1>Token nahi mila</h1>
  <p>Yeh QR galat hai ya token delete ho chuka hai. Prasad mat dena.</p>
</body>
</html>`
}

module.exports = { renderPrasadPage, renderMissing }
