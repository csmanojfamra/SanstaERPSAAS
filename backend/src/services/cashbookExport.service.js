const PDFDocument = require('pdfkit')
const ExcelJS = require('exceljs')
const { buildExportRows, buildPeriodLabel } = require('./cashbook.service')
const path = require('path')
const fs = require('fs')
const { drawPdfFooter } = require('./pdfStyle.service')

const COLORS = {
  saffron: 'FFFF6B00',
  grey: 'FFE0E0E0',
  maroon: 'FF7B1C1C',
  cream: 'FFFFF8E7',
  white: 'FFFFFFFF',
  totalsBlue: 'FFB3D9FF',
}

const LEDGER_HEADERS = ['Date', 'Type', 'Particulars', 'Details', 'Reference', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)']

const FONT_DIR = path.join(__dirname, '../../fonts')
const FONT_REGULAR = path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf')
const FONT_BOLD = path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf')
const HAS_UNICODE_FONT = fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD)

function registerFonts(doc) {
  if (HAS_UNICODE_FONT) {
    doc.registerFont('ledger-regular', FONT_REGULAR)
    doc.registerFont('ledger-bold', FONT_BOLD)
  }
}

function setFont(doc, bold = false, useHindi = false) {
  if (HAS_UNICODE_FONT && useHindi) {
    doc.font(bold ? 'ledger-bold' : 'ledger-regular')
  } else {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
  }
}

function styleHeaderRow(row, bgArgb) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
}

function applyTrustHeader(worksheet, trustName, metaLine, colCount) {
  worksheet.mergeCells(1, 1, 1, colCount)
  const titleCell = worksheet.getCell(1, 1)
  titleCell.value = trustName
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.saffron } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }

  worksheet.mergeCells(2, 1, 2, colCount)
  const metaCell = worksheet.getCell(2, 1)
  metaCell.value = metaLine
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grey } }
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' }

  worksheet.getRow(3).height = 8
}

function autoWidthColumns(worksheet) {
  worksheet.columns.forEach((col, idx) => {
    let maxLen = LEDGER_HEADERS[idx] ? LEDGER_HEADERS[idx].length : 10
    col.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value != null) {
        maxLen = Math.max(maxLen, String(cell.value).length)
      }
    })
    col.width = Math.min(Math.max(maxLen + 3, 12), 42)
  })
}

function addLedgerSheet(worksheet, trustName, ledgerTitle, periodLine, ledger) {
  const { rows, totalsRow } = buildExportRows(ledger)
  const colCount = LEDGER_HEADERS.length

  applyTrustHeader(worksheet, trustName, `${ledgerTitle} · ${periodLine}`, colCount)

  const headerRow = worksheet.getRow(4)
  LEDGER_HEADERS.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h
  })
  styleHeaderRow(headerRow, COLORS.maroon)

  rows.forEach((rowValues, idx) => {
    const row = worksheet.getRow(5 + idx)
    const bg = idx % 2 === 0 ? COLORS.white : COLORS.cream
    rowValues.forEach((val, i) => {
      const cell = row.getCell(i + 1)
      cell.value = val
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      if (i >= 5) {
        cell.numFmt = '₹#,##0.00'
        cell.alignment = { horizontal: 'right' }
      }
    })
  })

  const totalRowNum = 5 + rows.length
  const totalRow = worksheet.getRow(totalRowNum)
  totalsRow.forEach((val, i) => {
    const cell = totalRow.getCell(i + 1)
    cell.value = val
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalsBlue } }
    cell.font = { bold: true }
    if (i >= 5) {
      cell.numFmt = '₹#,##0.00'
      cell.alignment = { horizontal: 'right' }
    }
  })

  worksheet.getRow(1).height = 24
  worksheet.getRow(2).height = 18
  autoWidthColumns(worksheet)
}

async function generateCashbookExcel({ trust, cashbook, dateFrom, dateTo, channel = 'both' }) {
  const trustName = trust.name_hindi || trust.name
  const periodLine = buildPeriodLabel(dateFrom, dateTo)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Fastlegal Technologies Pvt Ltd'
  workbook.created = new Date()

  const channels =
    channel === 'both' ? ['CASH', 'BANK'] : [channel.toUpperCase()]

  for (const ch of channels) {
    const ledger = cashbook[ch]
    if (!ledger) continue
    const sheetName = ch === 'CASH' ? 'Cash Book' : 'Bank Book'
    const ws = workbook.addWorksheet(sheetName)
    addLedgerSheet(ws, trustName, sheetName, periodLine, ledger)
  }

  if (channels.length === 2) {
    const summary = workbook.addWorksheet('Summary')
    applyTrustHeader(summary, trustName, periodLine, 5)
    const hr = summary.getRow(4)
    ;['Ledger', 'Opening (₹)', 'Total Debit (₹)', 'Total Credit (₹)', 'Closing (₹)'].forEach((h, i) => {
      hr.getCell(i + 1).value = h
    })
    styleHeaderRow(hr, COLORS.maroon)

    ;[
      ['Cash Book', cashbook.CASH.opening_balance, cashbook.CASH.totals.debit, cashbook.CASH.totals.credit, cashbook.CASH.closing_balance],
      ['Bank Book', cashbook.BANK.opening_balance, cashbook.BANK.totals.debit, cashbook.BANK.totals.credit, cashbook.BANK.closing_balance],
    ].forEach((row, idx) => {
      const r = summary.getRow(5 + idx)
      row.forEach((val, i) => {
        const cell = r.getCell(i + 1)
        cell.value = val
        if (i > 0) cell.numFmt = '₹#,##0.00'
      })
    })
    autoWidthColumns(summary)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function formatInrPdf(n) {
  const num = Number(n) || 0
  const symbol = HAS_UNICODE_FONT ? '₹' : 'Rs. '
  return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatBalanceDrCr(n) {
  const num = Number(n) || 0
  const side = num >= 0 ? 'Dr' : 'Cr'
  return `${formatInrPdf(Math.abs(num))} ${side}`
}

function getFinancialYearLabel(anchorDate = new Date()) {
  const d = new Date(anchorDate)
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0')
  return `FY ${startYear}-${endYearShort}`
}

async function generateCashbookPdf({ trust, cashbook, dateFrom, dateTo, channel = 'both', generatedBy = 'System' }) {
  const trustName = trust.name_hindi || trust.name
  const periodLine = buildPeriodLabel(dateFrom, dateTo)
  const channels =
    channel === 'both' ? ['CASH', 'BANK'] : [channel.toUpperCase()]

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28, bufferPages: true })
      registerFonts(doc)
      const buffers = []
      doc.on('data', (b) => buffers.push(b))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const left = 28
      const pageW = doc.page.width - left * 2
      const colWidths = [60, 108, 250, 86, 86, 96]
      const colX = [left]
      for (let i = 1; i < colWidths.length; i++) {
        colX.push(colX[i - 1] + colWidths[i - 1])
      }

      const drawLedgerSection = (ledgerTitle, ledger) => {
        const fy = getFinancialYearLabel(dateTo || dateFrom || new Date())
        setFont(doc, true, true)
        doc.fillColor('#7B1C1C').fontSize(15).text(trustName, left, left, { width: pageW, align: 'left' })
        setFont(doc, false)
        doc.fillColor('#374151').fontSize(8.5)
        if (trust.address) doc.text(trust.address, left, doc.y + 2, { width: pageW * 0.64 })
        const trustMeta = []
        if (trust.reg_number) trustMeta.push(`Reg No: ${trust.reg_number}`)
        if (trust.pan_number) trustMeta.push(`PAN: ${trust.pan_number}`)
        if (trust.phone) trustMeta.push(`Contact: ${trust.phone}`)
        if (trustMeta.length) doc.text(trustMeta.join('  |  '), left, doc.y + 1, { width: pageW * 0.64 })

        const metaX = left + pageW * 0.66
        const metaW = pageW * 0.34
        doc.roundedRect(metaX, left + 2, metaW, 70, 6).lineWidth(0.8).strokeColor('#D1D5DB').stroke()
        setFont(doc, true)
        doc.fillColor('#111827').fontSize(9).text('Report Metadata', metaX + 8, left + 8)
        setFont(doc, false)
        doc.fontSize(8).fillColor('#374151')
        doc.text(`Ledger Type: ${ledgerTitle}`, metaX + 8, left + 22, { width: metaW - 12 })
        doc.text(`Financial Year: ${fy}`, metaX + 8, left + 34, { width: metaW - 12 })
        doc.text(`Generated On: ${new Date().toLocaleString('en-IN')}`, metaX + 8, left + 46, { width: metaW - 12 })
        doc.text(`Generated By: ${generatedBy}`, metaX + 8, left + 58, { width: metaW - 12 })

        const titleY = left + 84
        doc.rect(left, titleY, pageW, 24).fill('#7B1C1C')
        setFont(doc, true, false)
        doc.fillColor('#FFFFFF').fontSize(12).text(`Trust ${ledgerTitle} Ledger`, left, titleY + 7, { width: pageW, align: 'center' })

        const periodY = titleY + 30
        setFont(doc, true)
        doc.fillColor('#111827').fontSize(9).text('Financial Period:', left, periodY)
        setFont(doc, false)
        doc.fillColor('#374151').fontSize(9).text(periodLine.replace('Period: ', ''), left + 90, periodY)

        const opening = Number(ledger.opening_balance || 0)
        const receipts = Number(ledger.totals?.debit || 0)
        const payments = Number(ledger.totals?.credit || 0)
        const closing = Number(ledger.closing_balance || 0)
        const summaryY = periodY + 14
        const summaryW = (pageW - 12) / 4
        const summaryItems = [
          ['Opening Balance', formatBalanceDrCr(opening)],
          ['Total Receipts', formatInrPdf(receipts)],
          ['Total Payments', formatInrPdf(payments)],
          ['Closing Balance', formatBalanceDrCr(closing)],
        ]
        summaryItems.forEach((item, idx) => {
          const x = left + idx * (summaryW + 4)
          doc.roundedRect(x, summaryY, summaryW, 38, 4).lineWidth(0.8).strokeColor('#E5E7EB').fillAndStroke('#F9FAFB', '#E5E7EB')
          setFont(doc, false)
          doc.fillColor('#6B7280').fontSize(7.5).text(item[0], x + 6, summaryY + 6, { width: summaryW - 12 })
          setFont(doc, true)
          doc.fillColor(item[0] === 'Closing Balance' && closing < 0 ? '#B91C1C' : '#111827').fontSize(9).text(item[1], x + 6, summaryY + 19, { width: summaryW - 12 })
        })

        if (closing < 0) {
          doc.roundedRect(left, summaryY + 44, pageW, 18, 4).fill('#FEF2F2')
          setFont(doc, false)
          doc.fillColor('#B91C1C').fontSize(8).text(
            'Warning: Cash book reflects credit/negative balance for selected period. Please review payment timing and ledger entries.',
            left + 8,
            summaryY + 50,
            { width: pageW - 16 }
          )
        }

        const headers = ['Date', 'Voucher Ref.', 'Particulars', 'Receipts (Dr)', 'Payments (Cr)', 'Running Balance']
        let y = summaryY + (closing < 0 ? 70 : 50)
        const headerH = 20

        doc.rect(left, y, pageW, headerH).fill('#7B1C1C')
        headers.forEach((h, i) => {
          setFont(doc, true)
          doc.fillColor('#FFFFFF').fontSize(8).text(h, colX[i] + 4, y + 6, {
            width: colWidths[i] - 4,
            align: i >= 3 ? 'right' : 'left',
          })
        })
        y += headerH

        const entries = ledger.entries || []
        const allRows = entries.map((r) => ({
          date: r.date,
          ref: r.ref || '-',
          particulars: [
            `${r.type_label || (r.kind === 'DONATION' ? 'Donation' : 'Expense')} — ${r.description}`,
            r.meta ? `Details: ${r.meta}` : null,
            r.narration ? `Narration: ${r.narration}` : null,
          ].filter(Boolean),
          debit: r.debit || 0,
          credit: r.credit || 0,
          runningBalance: r.running_balance || 0,
        }))

        allRows.forEach((row, idx) => {
          const rowH = 30
          if (y > doc.page.height - 94) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 })
            y = 28
            doc.rect(left, y, pageW, headerH).fill('#7B1C1C')
            headers.forEach((h, i) => {
              setFont(doc, true)
              doc.fillColor('#FFFFFF').fontSize(8).text(h, colX[i] + 4, y + 6, {
                width: colWidths[i] - 4,
                align: i >= 3 ? 'right' : 'left',
              })
            })
            y += headerH
          }
          const bg = idx % 2 === 0 ? '#FFFFFF' : '#FFFBF5'
          doc.rect(left, y, pageW, rowH).fill(bg)
          doc.rect(left, y, pageW, rowH).lineWidth(0.2).strokeColor('#E5E7EB').stroke()

          setFont(doc, false)
          doc.fillColor('#111827').fontSize(7.5).text(new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), colX[0] + 4, y + 10, { width: colWidths[0] - 8 })
          setFont(doc, true)
          doc.fillColor('#374151').fontSize(7.5).text(row.ref, colX[1] + 4, y + 10, { width: colWidths[1] - 8 })
          setFont(doc, false)
          doc.fillColor('#111827').fontSize(7.5).text(row.particulars[0] || '-', colX[2] + 4, y + 5, { width: colWidths[2] - 8 })
          if (row.particulars[1]) doc.fillColor('#6B7280').fontSize(7).text(row.particulars[1], colX[2] + 4, y + 14, { width: colWidths[2] - 8 })

          doc.fillColor('#065F46').fontSize(7.5).text(row.debit > 0 ? formatInrPdf(row.debit) : '—', colX[3] + 4, y + 10, { width: colWidths[3] - 8, align: 'right' })
          doc.fillColor('#B45309').fontSize(7.5).text(row.credit > 0 ? formatInrPdf(row.credit) : '—', colX[4] + 4, y + 10, { width: colWidths[4] - 8, align: 'right' })
          setFont(doc, true)
          doc.fillColor(Number(row.runningBalance) < 0 ? '#B91C1C' : '#111827').fontSize(7.5).text(formatBalanceDrCr(row.runningBalance), colX[5] + 4, y + 10, { width: colWidths[5] - 8, align: 'right' })

          y += rowH
        })

        if (y > doc.page.height - 76) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 })
          y = 28
        }

        const totalsY = y + 2
        doc.rect(left, totalsY, pageW, 22).fill('#E5E7EB')
        doc.rect(left, totalsY, pageW, 22).lineWidth(0.8).strokeColor('#9CA3AF').stroke()
        setFont(doc, true)
        doc.fillColor('#111827').fontSize(8).text('TOTAL', colX[2] + 4, totalsY + 7, { width: colWidths[2] - 8 })
        doc.text(formatInrPdf(Number(ledger.totals?.debit || 0)), colX[3] + 4, totalsY + 7, { width: colWidths[3] - 8, align: 'right' })
        doc.text(formatInrPdf(Number(ledger.totals?.credit || 0)), colX[4] + 4, totalsY + 7, { width: colWidths[4] - 8, align: 'right' })
        doc.text(formatBalanceDrCr(Number(ledger.closing_balance || 0)), colX[5] + 4, totalsY + 7, { width: colWidths[5] - 8, align: 'right' })

        const signY = totalsY + 34
        const signW = (pageW - 24) / 3
        const signTitles = ['Prepared By', 'Verified By', 'Authorized Signatory']
        signTitles.forEach((title, i) => {
          const sx = left + i * (signW + 12)
          setFont(doc, false)
          doc.fillColor('#374151').fontSize(8).text(title, sx + 2, signY, { width: signW - 4, align: 'center' })
          doc.moveTo(sx + 8, signY + 28).lineTo(sx + signW - 8, signY + 28).lineWidth(0.6).strokeColor('#9CA3AF').stroke()
        })

        doc.moveDown(1)
      }

      channels.forEach((ch, idx) => {
        if (idx > 0) doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 })
        const title = ch === 'CASH' ? 'Cash Book' : 'Bank Book'
        drawLedgerSection(title, cashbook[ch])
      })

      drawPdfFooter(doc, {
        text: `System Generated Ledger Report | Generated on: ${new Date().toLocaleString('en-IN')} | Powered by FastLegal Technologies Pvt Ltd`,
        left,
      })

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = {
  generateCashbookExcel,
  generateCashbookPdf,
  LEDGER_HEADERS,
}
