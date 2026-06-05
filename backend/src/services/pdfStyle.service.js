const path = require('path')
const fs = require('fs')

const FONT_DIR = path.join(__dirname, '../../fonts')
const FONT_REGULAR = path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf')
const FONT_BOLD = path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf')
const HAS_UNICODE_FONT = fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD)

function registerPdfFonts(doc, prefix = 'pdf') {
  if (HAS_UNICODE_FONT) {
    doc.registerFont(`${prefix}-regular`, FONT_REGULAR)
    doc.registerFont(`${prefix}-bold`, FONT_BOLD)
  }
}

function setPdfFont(doc, { prefix = 'pdf', bold = false, useHindi = false } = {}) {
  if (HAS_UNICODE_FONT && useHindi) {
    doc.font(bold ? `${prefix}-bold` : `${prefix}-regular`)
  } else {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
  }
}

function formatInrPdf(value) {
  const symbol = HAS_UNICODE_FONT ? '₹' : 'Rs. '
  return `${symbol}${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function drawPdfHeader(doc, { trustName, subtitle, metadata = [], left = 28, top = 28, prefix = 'pdf' }) {
  const contentWidth = doc.page.width - left * 2
  setPdfFont(doc, { prefix, bold: true, useHindi: true })
  doc.fillColor('#7B1C1C').fontSize(15).text(trustName, left, top - 2)
  setPdfFont(doc, { prefix, bold: false })
  doc.fillColor('#374151').fontSize(8.5).text(subtitle || '', left, top + 18, { width: contentWidth * 0.64 })

  const metaX = left + contentWidth * 0.66
  const metaW = contentWidth * 0.34
  const metaH = Math.max(58, 22 + metadata.length * 12)
  doc.roundedRect(metaX, top - 4, metaW, metaH, 6).lineWidth(0.8).strokeColor('#D1D5DB').stroke()
  setPdfFont(doc, { prefix, bold: true })
  doc.fillColor('#111827').fontSize(9).text('Report Metadata', metaX + 8, top + 2)
  setPdfFont(doc, { prefix, bold: false })
  doc.fillColor('#374151').fontSize(8)
  metadata.forEach((line, idx) => {
    doc.text(line, metaX + 8, top + 16 + idx * 12, { width: metaW - 12 })
  })
  return { contentWidth, nextY: top + metaH + 10 }
}

function drawPdfTitleBar(doc, { title, left = 28, y }) {
  const contentWidth = doc.page.width - left * 2
  doc.rect(left, y, contentWidth, 24).fill('#7B1C1C')
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12).text(title, left, y + 7, {
    width: contentWidth,
    align: 'center',
  })
  return y + 30
}

function drawPdfSummaryCards(doc, { cards, left = 28, y }) {
  const contentWidth = doc.page.width - left * 2
  const cardWidth = (contentWidth - 12) / 4
  cards.slice(0, 4).forEach((card, idx) => {
    const x = left + idx * (cardWidth + 4)
    doc.roundedRect(x, y, cardWidth, 38, 4).lineWidth(0.8).strokeColor('#E5E7EB').fillAndStroke('#F9FAFB', '#E5E7EB')
    doc.fillColor('#6B7280').font('Helvetica').fontSize(7.5).text(card.label, x + 6, y + 6, { width: cardWidth - 12 })
    doc.fillColor(card.alert ? '#B91C1C' : '#111827').font('Helvetica-Bold').fontSize(9).text(card.value, x + 6, y + 19, {
      width: cardWidth - 12,
    })
  })
  return y + 48
}

function drawPdfSectionTable(doc, { title, rows, columns, startY, left = 28 }) {
  const contentWidth = doc.page.width - left * 2
  const xPositions = [left]
  for (let i = 1; i < columns.length; i += 1) {
    xPositions.push(xPositions[i - 1] + columns[i - 1].width)
  }
  let y = startY

  doc.roundedRect(left, y, contentWidth, 20, 4).fill('#7B1C1C')
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text(title, left + 8, y + 6, { width: contentWidth - 16 })
  y += 24

  const drawHeader = () => {
    doc.rect(left, y, contentWidth, 20).fill('#F3F4F6')
    columns.forEach((col, idx) => {
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8).text(col.label, xPositions[idx] + 4, y + 6, {
        width: col.width - 8,
        align: col.align || 'left',
      })
    })
    y += 20
  }
  drawHeader()

  rows.forEach((row, rowIndex) => {
    const rowHeight = 18
    if (y + rowHeight > doc.page.height - 92) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 28 })
      y = 34
      drawHeader()
    }
    if (rowIndex % 2 === 0) {
      doc.rect(left, y, contentWidth, rowHeight).fill('#FCFCFD')
    }
    columns.forEach((col, idx) => {
      const value = row[col.key] == null ? '-' : String(row[col.key])
      doc.fillColor('#1F2937').font('Helvetica').fontSize(7.6).text(value, xPositions[idx] + 4, y + 5, {
        width: col.width - 8,
        align: col.align || 'left',
        lineBreak: false,
        ellipsis: true,
      })
    })
    y += rowHeight
  })
  return y + 10
}

function drawPdfSignatureBlock(doc, { left = 28, y }) {
  const contentWidth = doc.page.width - left * 2
  if (y > doc.page.height - 76) {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 28 })
    y = 36
  }
  const blockWidth = (contentWidth - 24) / 3
  ;['Prepared By', 'Verified By', 'Authorized Signatory'].forEach((label, idx) => {
    const x = left + idx * (blockWidth + 12)
    doc.fillColor('#374151').font('Helvetica').fontSize(8).text(label, x + 2, y, { width: blockWidth - 4, align: 'center' })
    doc.moveTo(x + 8, y + 28).lineTo(x + blockWidth - 8, y + 28).lineWidth(0.6).strokeColor('#9CA3AF').stroke()
  })
}

function drawPdfFooter(doc, { text, left = 28 }) {
  const contentWidth = doc.page.width - left * 2
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(i)
    doc.fillColor('#6B7280').font('Helvetica').fontSize(7).text(text, left, doc.page.height - 22, {
      width: contentWidth,
      align: 'left',
    })
    doc.text(`Page ${i + 1} of ${range.count}`, left, doc.page.height - 22, { width: contentWidth, align: 'right' })
  }
}

module.exports = {
  registerPdfFonts,
  setPdfFont,
  formatInrPdf,
  drawPdfHeader,
  drawPdfTitleBar,
  drawPdfSummaryCards,
  drawPdfSectionTable,
  drawPdfSignatureBlock,
  drawPdfFooter,
  HAS_UNICODE_FONT,
}
