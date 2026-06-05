const twilio = require('twilio')
const { formatIndianNumber } = require('../utils/hindiNumbers')

const TWILIO_CONFIGURED = !!(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_ACCOUNT_SID !== 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' &&
  process.env.TWILIO_AUTH_TOKEN
)

if (!TWILIO_CONFIGURED) {
  console.warn('Twilio not configured. WhatsApp sending disabled.')
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

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB')
}

async function sendReceiptWhatsApp(donation, trust, receiptUrl) {
  try {
    if (!TWILIO_CONFIGURED) {
      return {
        sent: false,
        reason: 'not_configured',
      }
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

    const messageText = `
🛕 *${trust.name_hindi}*

🙏 Donation Receipt

━━━━━━━━━━━━━━━━━━

Receipt No: ${donation.receipt_number}
Donor: ${donation.donor_name}
Amount: ₹${formatIndianNumber(Number(donation.amount))}/-
Date: ${formatDate(donation.donation_date)}
Payment Mode: ${paymentModeMap[donation.payment_mode]}

आपके सहयोग के लिए धन्यवाद। 🙏

Receipt Download:
${receiptUrl}

Contact:
${trust.phone}

जय श्री कृष्ण 🙏
`

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:+91${donation.donor_mobile}`,
      body: messageText,
    })

    return {
      sent: true,
      sid: message.sid,
    }
  } catch (err) {
    console.error('WhatsApp send failed:', err.message)

    return {
      sent: false,
      reason: err.message,
    }
  }
}

module.exports = { sendReceiptWhatsApp }
