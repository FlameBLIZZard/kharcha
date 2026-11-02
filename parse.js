/* Kharcha parser: turns a bank SMS / UPI notification into {amount, merchant, kind}.
   Works in the browser (window.KharchaParse) and in Node (module.exports). */
(function (root) {
  const AMT = /(?:rs\.?|inr|₹|rupees)\s*:?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;
  const AMT_AFTER = /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr|₹|rupees)\b/i;
  const DEBIT = /\b(debited|debit|spent|paid|sent|withdrawn|purchase|payment of|txn of|transferred|dr\.?)\b/i;
  const CREDIT = /\b(credited|received|refund|cashback|deposited|cr\.?)\b/i;
  const NOISE = /\b(otp|one time password|verification code|do not share)\b/i;

  const MERCHANT_PATTERNS = [
    /\bpaid\s+(?:rs\.?|inr|₹)?\s*[0-9,.]*\s*to\s+([^\n.,]+?)(?=\s+(?:on|via|using|from|ref|upi|txn|for|avl|bal)\b|[.,\n]|$)/i,
    /\b(?:to|towards)\s+(?:vpa\s+|a\/c\s+)?([^\n.,]+?)(?=\s+(?:on|via|using|from|ref|upi|txn|avl|bal|is|has|successful|success|done|completed|failed)\b|[.,\n]|$)/i,
    /\b(?:at|@)\s+([^\n.,]+?)(?=\s+(?:on|via|using|from|ref|txn|avl|bal)\b|[.,\n]|$)/i,
    /\binfo[:\s]+(?:upi\/)?([^\n.,]+)/i,
    /\bfor\s+([^\n.,]+?)(?=\s+(?:on|via|using|from|ref|upi|txn)\b|[.,\n]|$)/i,
  ];

  function cleanMerchant(m) {
    if (!m) return '';
    m = m.replace(/\s+/g, ' ').trim();
    if (/@/.test(m)) {               // a VPA like zomato.payu@hdfcbank -> zomato
      m = m.split('@')[0].split(/[._-]/)[0];
    }
    m = m.replace(/^(mr|ms|mrs|m\/s)\.?\s+/i, '').replace(/\b(upi|ref|no|txn)\b.*$/i, '').trim();
    if (/^[x*\d\s]+$/i.test(m)) return '';  // masked account numbers
    if (m.length > 32) m = m.slice(0, 32).trim();
    return m.replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w+/g, w => w.toLowerCase());
  }

  function parse(text) {
    const out = { amount: 0, merchant: '', kind: 'unknown' };
    if (!text) return out;
    text = String(text).replace(/ /g, ' ');
    if (NOISE.test(text)) { out.kind = 'otp'; return out; }
    const m = text.match(AMT) || text.match(AMT_AFTER);
    if (m) out.amount = Math.round(parseFloat(m[1].replace(/,/g, '')) * 100) / 100;
    const d = DEBIT.test(text), c = CREDIT.test(text);
    out.kind = d && !/\bcredited to your\b/i.test(text) ? 'debit' : c ? 'credit' : d ? 'debit' : 'unknown';
    // "credited to <merchant> ... debited from your a/c" is still a debit
    if (/debited/i.test(text)) out.kind = 'debit';
    for (const re of MERCHANT_PATTERNS) {
      const mm = text.match(re);
      if (mm) { const name = cleanMerchant(mm[1]); if (name && !/^(your|a\/c|account|ac|you)\b/i.test(name)) { out.merchant = name; break; } }
    }
    return out;
  }

  const KEYWORDS = {
    food: /zomato|swiggy|domino|pizza|mcdonald|kfc|burger|cafe|coffee|starbucks|chai|restaurant|hotel|dhaba|bakery|eats|food|biryani|subway|haldiram/i,
    groceries: /blinkit|zepto|instamart|bigbasket|dmart|grocer|kirana|mart|reliance fresh|jiomart|milk|dairy|vegetable|fruit/i,
    travel: /uber|ola|rapido|irctc|railway|metro|petrol|fuel|hpcl|bpcl|indian oil|shell|fastag|redbus|makemytrip|goibibo|indigo|air|cab|auto|parking/i,
    shopping: /amazon|flipkart|myntra|ajio|meesho|nykaa|decathlon|croma|store|shop|mall|fashion|lifestyle/i,
    bills: /airtel|jio|vodafone|\bvi\b|bsnl|electric|bescom|msedcl|tata power|recharge|broadband|wifi|gas|water|rent|emi|insurance|lic/i,
    fun: /netflix|spotify|prime|hotstar|bookmyshow|pvr|inox|steam|playstation|game|movie|youtube|disney/i,
    health: /pharm|medic|apollo|1mg|netmeds|hospital|clinic|doctor|lab|gym|cult/i,
  };
  function guessCategory(text) {
    if (!text) return '';
    for (const k in KEYWORDS) if (KEYWORDS[k].test(text)) return k;
    return '';
  }

  const api = { parse, guessCategory, cleanMerchant };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KharchaParse = api;
})(typeof self !== 'undefined' ? self : this);
