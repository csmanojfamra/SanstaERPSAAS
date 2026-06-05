const PDFDocument = require('pdfkit')
const path = require('path')
const fs = require('fs')

const { amountToHindiWords, formatIndianNumber } = require('../utils/hindiNumbers')

const FONT_DIR = path.join(__dirname, '../../fonts')
const FONT_REGULAR = path.join(FONT_DIR, 'NotoSansDevanagari-Regular.ttf')
const FONT_BOLD = path.join(FONT_DIR, 'NotoSansDevanagari-Bold.ttf')

const FONTS_AVAILABLE = fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD)

const COLORS = {
  saffron: '#FF6B00',
  maroon: '#7B1C1C',
  cream: '#FFF8F0',
  black: '#1A1A1A',
}

const DEVANAGARI_RE = /[\u0900-\u097F\uA8E0-\uA8FF]/

function hasDevanagari(text) {
  return DEVANAGARI_RE.test(String(text || ''))
}

function registerFonts(doc) {
  if (FONTS_AVAILABLE) {
    doc.registerFont('hindi', FONT_REGULAR)
    doc.registerFont('hindi-bold', FONT_BOLD)
  }
}

function useLatin(doc, bold = false) {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
}

function useHindi(doc, bold = false) {
  if (FONTS_AVAILABLE) {
    doc.font(bold ? 'hindi-bold' : 'hindi')
  } else {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
  }
}

function useFontForText(doc, text, bold = false) {
  if (hasDevanagari(text)) {
    useHindi(doc, bold)
  } else {
    useLatin(doc, bold)
  }
}

/** Never mix scripts in one text() call — PDFKit corrupts mixed Hindi/Latin. */
function textLatin(doc, text, x, y, opts = {}) {
  useLatin(doc, opts.bold)
  doc.fillColor(opts.color || COLORS.black).fontSize(opts.size || 8)
  doc.text(text, x, y, { width: opts.width, align: opts.align })
}

function textHindi(doc, text, x, y, opts = {}) {
  useHindi(doc, opts.bold)
  doc.fillColor(opts.color || COLORS.black).fontSize(opts.size || 8)
  doc.text(text, x, y, { width: opts.width, align: opts.align })
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const paymentModeMap = {
  CASH: 'Cash',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  DD: 'Demand Draft',
  ONLINE: 'Online',
}

function drawDoubleBorder(doc, x, y, w, h, primary, secondary) {
  doc.rect(x, y, w, h).lineWidth(2).strokeColor(primary).stroke()
  doc.rect(x + 4, y + 4, w - 8, h - 8).lineWidth(0.75).strokeColor(secondary).stroke()
}

function drawTableRow(doc, x, y, w, hindiLabel, value, labelW = 118) {
  const rowH = 20
  doc.rect(x, y, w, rowH).lineWidth(0.5).strokeColor(COLORS.maroon).stroke()
  doc.moveTo(x + labelW, y).lineTo(x + labelW, y + rowH).stroke()

  textHindi(doc, hindiLabel, x + 6, y + 6, {
    width: labelW - 10,
    bold: true,
    color: COLORS.maroon,
    size: 8,
  })

  useFontForText(doc, value)
  doc.fillColor(COLORS.black).fontSize(8).text(String(value || '-'), x + labelW + 6, y + 6, {
    width: w - labelW - 12,
  })

  return y + rowH
}

async function generateReceiptBuffer(donation, trust) {
  return new Promise((resolve, reject) => {
    try {
      const primary = trust.primary_color || COLORS.saffron
      const secondary = trust.secondary_color || COLORS.maroon

      const doc = new PDFDocument({
        size: [419.53, 595.28],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })

      const buffers = []
      doc.on('data', (b) => buffers.push(b))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      registerFonts(doc)

      const pageW = doc.page.width
      const pageH = doc.page.height
      const m = 14
      const innerX = m + 6
      const innerW = pageW - 2 * innerX

      doc.rect(0, 0, pageW, pageH).fill(COLORS.cream)
      drawDoubleBorder(doc, m, m, pageW - 2 * m, pageH - 2 * m, primary, secondary)

      let y = m + 12

      textHindi(doc, 'ॐ', innerX, y, { align: 'center', width: innerW, size: 22, color: primary, bold: true })
      y += 28

      textHindi(doc, trust.name_hindi, innerX, y, {
        align: 'center',
        width: innerW,
        size: 13,
        color: secondary,
        bold: true,
      })
      y += 20

      if (trust.name) {
        textLatin(doc, trust.name, innerX, y, { align: 'center', width: innerW, size: 9, bold: true })
        y += 14
      }

      textLatin(doc, trust.address, innerX, y, { align: 'center', width: innerW, size: 7.5 })
      y += 22

      textLatin(doc, `Phone: ${trust.phone}`, innerX, y, { align: 'center', width: innerW, size: 8 })
      y += 12

      const metaParts = []
      if (trust.reg_number) metaParts.push(`Reg. No.: ${trust.reg_number}`)
      if (trust.pan_number) metaParts.push(`PAN: ${trust.pan_number}`)
      if (metaParts.length) {
        textLatin(doc, metaParts.join('   |   '), innerX, y, { align: 'center', width: innerW, size: 7 })
        y += 12
      }

      doc.moveTo(innerX, y).lineTo(innerX + innerW, y).lineWidth(1).strokeColor(primary).stroke()
      y += 10

      const titleH = 38
      doc.rect(innerX, y, innerW, titleH).fill(secondary)
      textHindi(doc, 'दान रसीद', innerX, y + 5, { align: 'center', width: innerW, size: 12, color: '#FFFFFF', bold: true })
      textLatin(doc, 'DONATION RECEIPT', innerX, y + 22, {
        align: 'center',
        width: innerW,
        size: 10,
        color: '#FFFFFF',
        bold: true,
      })
      y += titleH + 8

      const receiptRowH = 22
      doc.rect(innerX, y, innerW, receiptRowH).lineWidth(0.5).strokeColor(secondary).stroke()
      doc.moveTo(innerX + innerW / 2, y).lineTo(innerX + innerW / 2, y + receiptRowH).stroke()

      textLatin(doc, `Receipt No.: ${donation.receipt_number}`, innerX + 8, y + 7, {
        width: innerW / 2 - 16,
        bold: true,
        color: secondary,
      })
      textLatin(doc, `Date: ${formatDate(donation.donation_date)}`, innerX + innerW / 2 + 8, y + 7, {
        width: innerW / 2 - 16,
        bold: true,
        color: secondary,
      })
      y += receiptRowH + 10

      textHindi(doc, 'निम्नलिखित दाता से निम्न विवरणानुसार दान प्राप्त हुआ।', innerX, y, {
        width: innerW,
        size: 8,
      })
      y += 12
      textLatin(doc, 'Received with thanks from:', innerX, y, { width: innerW, size: 8 })
      y += 16

      let tableY = y
      tableY = drawTableRow(doc, innerX, tableY, innerW, 'दाता का नाम', donation.donor_name)
      tableY = drawTableRow(doc, innerX, tableY, innerW, 'मोबाइल नंबर', donation.donor_mobile)
      tableY = drawTableRow(doc, innerX, tableY, innerW, 'शहर', donation.donor_city || '-')
      tableY = drawTableRow(doc, innerX, tableY, innerW, 'उद्देश्य', donation.purpose || 'सामान्य दान')
      y = tableY + 10

      const amountBoxH = 86
      doc.rect(innerX, y, innerW, amountBoxH).lineWidth(1.5).strokeColor(primary).stroke()

      textHindi(doc, 'राशि (अंकों में)', innerX + 8, y + 6, { color: secondary, bold: true, size: 8 })
      textLatin(doc, 'Amount in Figures', innerX + 8, y + 16, { color: secondary, size: 7 })

      textLatin(doc, `Rs. ${formatIndianNumber(Number(donation.amount))}/-`, innerX, y + 26, {
        align: 'center',
        width: innerW,
        size: 20,
        color: primary,
        bold: true,
      })

      textHindi(doc, 'राशि (शब्दों में)', innerX + 8, y + 52, { color: secondary, bold: true, size: 7.5 })
      textLatin(doc, 'Amount in Words', innerX + 8, y + 60, { color: secondary, size: 7 })

      const amountWords = amountToHindiWords(Number(donation.amount))
      textHindi(doc, `(${amountWords})`, innerX + 8, y + 70, { width: innerW - 16, size: 8 })
      y += amountBoxH + 8

      const payLabel = paymentModeMap[donation.payment_mode] || donation.payment_mode
      textLatin(doc, `Payment Mode: ${payLabel}`, innerX, y, { width: innerW, size: 8 })
      y += 11
      textHindi(doc, `भुगतान विधि: ${payLabel}`, innerX, y, { width: innerW, size: 7.5 })
      y += 12

      if (donation.upi_ref) {
        textLatin(doc, `UPI Reference: ${donation.upi_ref}`, innerX, y, { width: innerW, size: 7.5 })
        y += 11
      }
      if (donation.cheque_number) {
        textLatin(doc, `Cheque No.: ${donation.cheque_number}`, innerX, y, { width: innerW, size: 7.5 })
        y += 11
      }

      if (donation.payment_mode === 'CHEQUE' || donation.payment_mode === 'DD') {
        textLatin(doc, 'Subject to realisation of cheque / demand draft.', innerX, y, {
          width: innerW,
          size: 7,
          color: secondary,
        })
        y += 12
      }

      if (donation.is_80g_eligible && (trust.pan_number || donation.pan_number)) {
        textLatin(doc, 'Eligible for deduction under Section 80G of the Income Tax Act, 1961.', innerX, y, {
          width: innerW,
          size: 7,
        })
        y += 12
      }

      textLatin(doc, 'Amount shall be used for religious and charitable objects of the trust / temple construction.', innerX, y, {
        align: 'center',
        width: innerW,
        size: 7.5,
      })
      y += 24

      const sigW = (innerW - 20) / 3
      const sigs = [
        { en: 'President', hi: 'अध्यक्ष' },
        { en: 'Secretary', hi: 'सचिव' },
        { en: 'Receiver', hi: 'प्राप्तकर्ता' },
      ]
      sigs.forEach((sig, i) => {
        const sx = innerX + 10 + i * sigW
        textLatin(doc, sig.en, sx, y, { width: sigW - 4, align: 'center', size: 7 })
        textHindi(doc, sig.hi, sx, y + 10, { width: sigW - 4, align: 'center', size: 7 })
        doc
          .moveTo(sx + 10, y + 30)
          .lineTo(sx + sigW - 14, y + 30)
          .lineWidth(0.5)
          .strokeColor(COLORS.black)
          .stroke()
      })
      y += 40

      doc.rect(innerX, y, innerW, 44).fill(secondary)
      textHindi(doc, '॥ श्री सांवलिया सेठ जी की जय ॥', innerX, y + 8, {
        align: 'center',
        width: innerW,
        size: 10,
        color: '#FFFFFF',
        bold: true,
      })
      textLatin(doc, 'This is a computer-generated receipt.', innerX, y + 24, {
        align: 'center',
        width: innerW,
        size: 6.5,
        color: '#FFFFFF',
      })
      textLatin(doc, 'Powered by Fastlegal Technologies Pvt Ltd', innerX, y + 33, {
        align: 'center',
        width: innerW,
        size: 6,
        color: '#FFFFFF',
      })

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = { generateReceiptBuffer }
