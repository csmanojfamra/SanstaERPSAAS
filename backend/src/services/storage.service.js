const path = require('path')
const fs = require('fs')

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'receipts')

fs.mkdirSync(RECEIPTS_DIR, { recursive: true })

function sanitizeReceiptNumber(receiptNumber) {
  return receiptNumber.replace(/\//g, '-')
}

function getReceiptFilePath(receiptNumber) {
  const filename = `${sanitizeReceiptNumber(receiptNumber)}.pdf`

  return {
    filename,
    filepath: path.join(RECEIPTS_DIR, filename),
    publicPath: `/uploads/receipts/${filename}`,
  }
}

function saveReceiptPDF(receiptNumber, pdfBuffer) {
  const { filepath, publicPath } = getReceiptFilePath(receiptNumber)

  fs.writeFileSync(filepath, pdfBuffer)

  return {
    path: filepath,
    url: publicPath,
  }
}

function receiptExists(receiptNumber) {
  const { filepath } = getReceiptFilePath(receiptNumber)
  return fs.existsSync(filepath)
}

function deleteReceiptPDF(receiptNumber) {
  const { filepath } = getReceiptFilePath(receiptNumber)

  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
  }
}

module.exports = {
  saveReceiptPDF,
  receiptExists,
  deleteReceiptPDF,
  getReceiptFilePath,
}
