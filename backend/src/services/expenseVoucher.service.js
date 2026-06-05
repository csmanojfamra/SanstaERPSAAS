const PDFDocument = require('pdfkit')
const path = require('path')
const fs = require('fs')

const FONT_DIR = path.join(__dirname, '../../fonts')
const FONT_REGULAR = path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf')
const FONT_BOLD = path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf')
const FONTS_AVAILABLE = fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD)

const DEVANAGARI_RE = /[\u0900-\u097F\uA8E0-\uA8FF]/

const CATEGORY_LABELS = {
  LABOUR_CONSTRUCTION: 'Labour & Construction',
  RELIGIOUS_ACTIVITIES: 'Religious Activities',
  TEMPLE_MAINTENANCE: 'Temple Maintenance',
  UTILITIES: 'Utilities',
  PRASAD_FOOD_DISTRIBUTION: 'Prasad / Food Distribution',
  FESTIVAL_EXPENSES: 'Festival Expenses',
  ADMINISTRATIVE_EXPENSES: 'Administrative Expenses',
  SALARY_WAGES: 'Salary / Wages',
  LEGAL_PROFESSIONAL: 'Legal & Professional',
  TRAVEL: 'Travel',
  CHARITY_RELIEF: 'Charity / Relief',
  BANK_CHARGES: 'Bank Charges',
  OTHER: 'Other',
  CONSTRUCTION: 'Construction',
  MATERIALS: 'Materials',
  LABOUR: 'Labour',
  PUJA: 'Puja',
  ADMIN: 'Administration',
  FOOD: 'Food',
}

const NATURE_LABELS = {
  OPERATIONAL: 'Operational',
  RELIGIOUS: 'Religious',
  CONSTRUCTION: 'Construction',
  ADMINISTRATIVE: 'Administrative',
  WELFARE: 'Welfare',
  OTHER: 'Other',
}

function hasDevanagari(text) {
  return DEVANAGARI_RE.test(String(text || ''))
}

function registerFonts(doc) {
  if (FONTS_AVAILABLE) {
    doc.registerFont('hindi', FONT_REGULAR)
    doc.registerFont('hindi-bold', FONT_BOLD)
  }
}

function applyFont(doc, text, bold = false) {
  if (hasDevanagari(text) && FONTS_AVAILABLE) {
    doc.font(bold ? 'hindi-bold' : 'hindi')
    return
  }
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(value) {
  return `Rs. ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)}`
}

function generateExpenseVoucherPdf({ trust, expense, preparedBy }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 42 })
      const chunks = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      registerFonts(doc)
      const left = 42
      const width = 511

      applyFont(doc, trust.name_hindi || trust.name || 'Temple Trust', true)
      doc.fontSize(19).fillColor('#7B1C1C').text(trust.name_hindi || trust.name || 'Temple Trust', left, 42, { width })
      if (trust.name_hindi && trust.name) {
        doc.moveDown(0.15)
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#374151').text(trust.name, { width })
      }
      doc.moveDown(0.25)
      doc.font('Helvetica').fontSize(9.5).fillColor('#4B5563').text(trust.address || '-', { width, lineGap: 1 })
      doc.text(`Reg No: ${trust.reg_number || '-'}   PAN: ${trust.pan_number || '-'}`, { width })

      doc.moveDown(0.55)
      doc.rect(left, doc.y, width, 28).fill('#7B1C1C')
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text('EXPENSE VOUCHER', left, doc.y + 7, {
        width,
        align: 'center',
      })
      doc.moveDown(1.5)

      const boxTop = doc.y
      doc.rect(left, boxTop, width, 88).lineWidth(1).strokeColor('#D1D5DB').stroke()
      doc.moveTo(left + width / 2, boxTop).lineTo(left + width / 2, boxTop + 88).strokeColor('#E5E7EB').stroke()
      doc.font('Helvetica').fontSize(10).fillColor('#111827')
      doc.text(`Voucher Number: ${expense.voucher_number || '-'}`, left + 12, boxTop + 12, { width: width / 2 - 24 })
      doc.text(`Voucher Date: ${formatDate(expense.expense_date)}`, left + 12, boxTop + 32, { width: width / 2 - 24 })
      doc.text(`Expense Category: ${CATEGORY_LABELS[expense.category] || expense.category || '-'}`, left + 12, boxTop + 52, {
        width: width / 2 - 24,
      })
      doc.text(`Expense Nature: ${NATURE_LABELS[expense.expense_nature] || expense.expense_nature || '-'}`, left + width / 2 + 12, boxTop + 12, {
        width: width / 2 - 24,
      })
      doc.text(`Paid Through: ${expense.payment_channel || '-'}`, left + width / 2 + 12, boxTop + 32, { width: width / 2 - 24 })
      doc.text(`Payment Mode: ${expense.payment_mode || '-'}`, left + width / 2 + 12, boxTop + 52, { width: width / 2 - 24 })

      doc.x = left
      doc.y = boxTop + 100
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#111827').text('Payment Details', left, doc.y, { width })
      doc.moveDown(0.3)
      const detailsTop = doc.y
      const detailsRowH = 24
      const detailsRows = [
        { label: 'Amount', value: formatCurrency(expense.amount), highlight: true },
        {
          label: 'Transaction Reference',
          value: expense.transaction_id || expense.upi_ref || expense.cheque_number || expense.reference || '-',
        },
        { label: 'Vendor / Payee', value: expense.paid_to || '-' },
        { label: 'Vendor Mobile', value: expense.vendor_mobile || '-' },
      ]
      const detailsH = detailsRows.length * detailsRowH
      const labelColW = 185
      doc.rect(left, detailsTop, width, detailsH).lineWidth(1).strokeColor('#D1D5DB').stroke()
      doc.moveTo(left + labelColW, detailsTop).lineTo(left + labelColW, detailsTop + detailsH).strokeColor('#E5E7EB').stroke()
      for (let i = 1; i < detailsRows.length; i++) {
        const y = detailsTop + i * detailsRowH
        doc.moveTo(left, y).lineTo(left + width, y).strokeColor('#E5E7EB').stroke()
      }
      detailsRows.forEach((row, idx) => {
        const y = detailsTop + idx * detailsRowH + 7
        doc.font('Helvetica').fontSize(10).fillColor('#374151').text(row.label, left + 10, y, {
          width: labelColW - 20,
        })
        doc
          .font(row.highlight ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(row.highlight ? 10.8 : 10)
          .fillColor('#111827')
          .text(row.value, left + labelColW + 10, y, {
            width: width - labelColW - 20,
          })
      })
      doc.y = detailsTop + detailsH + 12

      doc.moveDown(0.5)
      doc.font('Helvetica-Bold').fontSize(10.5).text('Description', left, doc.y, { width })
      doc.font('Helvetica').fontSize(10).text(expense.description || '-', left, doc.y, { width, lineGap: 1 })
      if (expense.notes) {
        doc.moveDown(0.35)
        doc.font('Helvetica-Bold').fontSize(10.5).text('Additional Notes', left, doc.y, { width })
        doc.font('Helvetica').fontSize(10).text(expense.notes, left, doc.y, { width, lineGap: 1 })
      }
      doc.moveDown(0.45)
      doc.font('Helvetica').fontSize(10).text(`Supporting Bill Attached: ${expense.attachment_url ? 'Yes' : 'No'}`, left, doc.y, { width })

      const signTop = Math.min(doc.y + 28, 740)
      const colWidth = width / 4
      const labels = ['Prepared By', 'Verified By', 'Approved By', 'Receiver Signature']
      doc.font('Helvetica').fontSize(9).fillColor('#111827')
      labels.forEach((label, idx) => {
        const x = left + idx * colWidth
        doc.text(label, x + 4, signTop, { width: colWidth - 8, align: 'center' })
        doc.moveTo(x + 8, signTop + 34).lineTo(x + colWidth - 8, signTop + 34).strokeColor('#9CA3AF').stroke()
      })
      if (preparedBy) {
        doc.font('Helvetica').fontSize(9).fillColor('#374151').text(preparedBy, left + 4, signTop + 16, {
          width: colWidth - 8,
          align: 'center',
        })
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = { generateExpenseVoucherPdf }
