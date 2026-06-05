const ones = [
  '',
  'एक',
  'दो',
  'तीन',
  'चार',
  'पाँच',
  'छः',
  'सात',
  'आठ',
  'नौ',
  'दस',
  'ग्यारह',
  'बारह',
  'तेरह',
  'चौदह',
  'पंद्रह',
  'सोलह',
  'सत्रह',
  'अठारह',
  'उन्नीस',
  'बीस',
  'इक्कीस',
  'बाईस',
  'तेईस',
  'चौबीस',
  'पच्चीस',
  'छब्बीस',
  'सत्ताईस',
  'अट्ठाईस',
  'उनतीस',
  'तीस',
  'इकतीस',
  'बत्तीस',
  'तैंतीस',
  'चौंतीस',
  'पैंतीस',
  'छत्तीस',
  'सैंतीस',
  'अड़तीस',
  'उनतालीस',
  'चालीस',
  'इकतालीस',
  'बयालीस',
  'तैंतालीस',
  'चवालीस',
  'पैंतालीस',
  'छियालीस',
  'सैंतालीस',
  'अड़तालीस',
  'उनचास',
  'पचास',
  'इक्यावन',
  'बावन',
  'तिरपन',
  'चौवन',
  'पचपन',
  'छप्पन',
  'सत्तावन',
  'अट्ठावन',
  'उनसठ',
  'साठ',
  'इकसठ',
  'बासठ',
  'तिरसठ',
  'चौंसठ',
  'पैंसठ',
  'छियासठ',
  'सड़सठ',
  'अड़सठ',
  'उनहत्तर',
  'सत्तर',
  'इकहत्तर',
  'बहत्तर',
  'तिहत्तर',
  'चौहत्तर',
  'पचहत्तर',
  'छिहत्तर',
  'सतहत्तर',
  'अठहत्तर',
  'उनासी',
  'अस्सी',
  'इक्यासी',
  'बयासी',
  'तिरासी',
  'चौरासी',
  'पचासी',
  'छियासी',
  'सत्तासी',
  'अट्ठासी',
  'नवासी',
  'नब्बे',
  'इक्यानवे',
  'बानवे',
  'तिरानवे',
  'चौरानवे',
  'पचानवे',
  'छियानवे',
  'सत्तानवे',
  'अट्ठानवे',
  'निन्यानवे',
]

/**
 * Convert amount to Hindi words for PDF receipts (Indian numbering system).
 * Verification examples:
 *   amountToHindiWords(1)       // एक रुपये मात्र
 *   amountToHindiWords(11)      // ग्यारह रुपये मात्र
 *   amountToHindiWords(100)     // एक सौ रुपये मात्र
 *   amountToHindiWords(1100)    // एक हजार एक सौ रुपये मात्र
 *   amountToHindiWords(5100)    // पाँच हजार एक सौ रुपये मात्र
 *   amountToHindiWords(11000)   // ग्यारह हजार रुपये मात्र
 *   amountToHindiWords(51000)   // इक्यावन हजार रुपये मात्र
 *   amountToHindiWords(100000)  // एक लाख रुपये मात्र
 *   amountToHindiWords(151000)  // एक लाख इक्यावन हजार रुपये मात्र
 *   amountToHindiWords(1510000) // पंद्रह लाख दस हजार रुपये मात्र
 */
function amountToHindiWords(amount) {
  const n = Math.floor(Number(amount))

  if (!n || n < 0) {
    return 'शून्य रुपये मात्र'
  }

  if (n > 99999999) {
    return `${n.toLocaleString('en-IN')} रुपये मात्र`
  }

  const parts = []

  const crores = Math.floor(n / 10000000)
  if (crores > 0) {
    parts.push(`${ones[crores]} करोड़`)
  }

  const lakhs = Math.floor((n % 10000000) / 100000)
  if (lakhs > 0) {
    parts.push(`${ones[lakhs]} लाख`)
  }

  const thousands = Math.floor((n % 100000) / 1000)
  if (thousands > 0) {
    parts.push(`${ones[thousands]} हजार`)
  }

  const hundreds = Math.floor((n % 1000) / 100)
  if (hundreds > 0) {
    parts.push(`${ones[hundreds]} सौ`)
  }

  const remainder = n % 100
  if (remainder > 0) {
    parts.push(ones[remainder])
  }

  if (parts.length === 0) {
    return 'शून्य रुपये मात्र'
  }

  return `${parts.join(' ')} रुपये मात्र`
}

/**
 * Format number in Indian comma grouping.
 * Examples: 1100 → '1,100' | 51000 → '51,000' | 151000 → '1,51,000'
 */
function formatIndianNumber(amount) {
  const n = Math.floor(Number(amount))
  if (Number.isNaN(n)) return '0'

  const s = String(n)
  if (s.length <= 3) return s

  const last3 = s.slice(-3)
  let rest = s.slice(0, -3)
  const groups = []

  while (rest.length > 0) {
    if (rest.length <= 2) {
      groups.unshift(rest)
      rest = ''
    } else {
      groups.unshift(rest.slice(-2))
      rest = rest.slice(0, -2)
    }
  }

  return [...groups, last3].join(',')
}

module.exports = { amountToHindiWords, formatIndianNumber }
