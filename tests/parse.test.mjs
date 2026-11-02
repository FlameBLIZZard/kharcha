import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { parse, guessCategory } = require('../parse.js');

const cases = [
  ['Rs.250.00 debited from A/c XX1234 on 02-11-26 to VPA zomato.payu@hdfcbank UPI Ref 123456789. Not you? Call 1800', 250, 'Zomato', 'debit'],
  ['You paid ₹1,299 to Amazon Pay via Google Pay', 1299, 'Amazon Pay', 'debit'],
  ['Sent Rs.40.00 From HDFC Bank A/C *1234 To RAMESH KUMAR On 02/11/26 Ref 1234', 40, 'Ramesh Kumar', 'debit'],
  ['INR 560.50 spent on ICICI Bank Card XX9876 on 02-Nov-26 at SWIGGY. Avl Lmt: INR 45,000', 560.5, 'Swiggy', 'debit'],
  ['Your A/c XX1234 is credited with Rs 5000.00 on 01-11-26 by NEFT', 5000, '', 'credit'],
  ['Payment of Rs 199 to Netflix successful', 199, 'Netflix', 'debit'],
  ['Your OTP is 123456 for txn of Rs 500. Do not share', 0, '', 'otp'],
];
let ok = 0;
for (const [text, amt, merchant, kind] of cases) {
  const r = parse(text);
  try {
    assert.equal(r.amount, amt, 'amount');
    assert.equal(r.kind, kind, 'kind');
    if (merchant) assert.equal(r.merchant, merchant, 'merchant');
    ok++;
  } catch (e) { console.error('FAIL', JSON.stringify(text), r, e.message); process.exitCode = 1; }
}
assert.equal(guessCategory('Zomato'), 'food');
assert.equal(guessCategory('UBER INDIA'), 'travel');
assert.equal(guessCategory('blinkit'), 'groceries');
console.log(`${ok}/${cases.length} parser cases passed`);
