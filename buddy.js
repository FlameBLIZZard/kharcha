'use strict';
/* ---------- Bill Buddy ----------
   Split a bill with friends, see who owes what, settle up, and ask for money with a UPI link or QR.
   Loaded before the main script; everything here runs only when called, so S, money, openSheet and friends exist by then.

   Data (inside S):
     friends: [{ id, name, upi }]
     bills:   [{ id, title, amt, ts, cat, payer: 'me' | friendId, mode: 'equal' | 'custom', shares: { me?: n, [friendId]: n }, txId? }]
     settles: [{ id, fid, amt, dir: 'in' (they paid me) | 'out' (I paid them), ts, note }]
   Balance with a friend > 0 means they owe me. Only money between me and each friend is tracked. */

let goalsView = 'goals', bb = null, bbBack = null;
const BB = () => { for (const k of ['friends', 'bills', 'settles']) if (!Array.isArray(S[k])) S[k] = []; return S; };
const friendById = id => BB().friends.find(f => f.id === id);
const r2 = n => Math.round(n * 100) / 100;
const pname = id => id === 'me' ? 'You' : (friendById(id) || { name: 'Someone' }).name;
const AV_COLORS = ['#5dffb0', '#4dc3ff', '#ffc93d', '#ff5fa2', '#b28bff', '#ff8a3d', '#c6ff3d', '#ff6b4a'];
function avatar(id, size) {
  const n = id === 'me' ? (S.settings.name || 'Me') : pname(id), h = [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `<span class="av${size ? ' ' + size : ''}" style="--av:${id === 'me' ? 'var(--ink)' : AV_COLORS[h % AV_COLORS.length]}">${esc([...n.trim()][0] || '?').toUpperCase()}</span>`;
}

function balanceOf(fid) {
  BB(); let b = 0;
  S.bills.forEach(x => { if (x.payer === 'me') b += +(x.shares[fid] || 0); else if (x.payer === fid) b -= +(x.shares.me || 0); });
  S.settles.forEach(s => { if (s.fid === fid) b += s.dir === 'in' ? -s.amt : s.amt; });
  return r2(b);
}
function buddyTotals() {
  let owed = 0, owe = 0;
  BB().friends.forEach(f => { const b = balanceOf(f.id); if (b > 0) owed += b; else owe -= b; });
  return { owed: r2(owed), owe: r2(owe) };
}
function balLine(fid, b = balanceOf(fid)) {
  if (Math.abs(b) < .01) return `<span class="muted">All square</span>`;
  return b > 0 ? `<span class="ok">owes you ${money(b)}</span>` : `<span class="bad">you owe ${money(-b)}</span>`;
}

/* equal split in paise; leftover paise go to whoever paid first, so totals always add up */
function equalShares(total, people, payer) {
  const n = people.length; if (!n) return {};
  const cents = Math.round(total * 100), base = Math.floor(cents / n); let left = cents - base * n;
  const order = people.includes(payer) ? [payer, ...people.filter(p => p !== payer)] : people, out = {};
  order.forEach(p => { out[p] = (base + (left > 0 ? 1 : 0)) / 100; if (left > 0) left--; });
  return out;
}

/* ---------- UPI ---------- */
function upiLink(pa, pn, amt, note) {
  const q = [['pa', pa], ['pn', pn || 'Kharcha'], ['am', (+amt).toFixed(2)], ['cu', 'INR'], ['tn', (note || '').slice(0, 50)]].filter(x => x[1]);
  return 'upi://pay?' + q.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
}
const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,63}$/;
function qrSvg(text) {
  try {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return `<svg class="qr" viewBox="-4 -4 ${n + 8} ${n + 8}" shape-rendering="crispEdges" role="img" aria-label="UPI payment QR code"><rect x="-4" y="-4" width="${n + 8}" height="${n + 8}" fill="#fff"/><path d="${d}" fill="#16141a"/></svg>`;
  } catch (e) { return `<div class="empty">Could not draw the QR code.</div>`; }
}
function openExternal(url) {
  // In the APK, Capacitor hands non-app URLs (upi://, https://wa.me) to Android, which opens the right app.
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
}
const copyText = (txt, ok) => (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(ok || 'Copied'), () => prompt('Copy this', txt));

/* ---------- views ---------- */
const goalsSeg = () => `<div class="seg">${[['goals', 'Goals'], ['split', 'Bill Buddy']].map(([k, l]) => `<button data-gview="${k}" class="${goalsView === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
function viewBuddy() {
  BB();
  const t = buddyTotals(), fr = [...S.friends].sort((a, b) => Math.abs(balanceOf(b.id)) - Math.abs(balanceOf(a.id)) || a.name.localeCompare(b.name));
  let h = `<div class="top"><div class="hi">Bill Buddy</div><button class="chip" data-act="bbfriendnew">＋ Friend</button></div>${goalsSeg()}`;
  const square = !t.owed && !t.owe;
  h += `<div class="card hero bbhero"><div class="label">${square ? 'Between you and your friends' : t.owed >= t.owe ? 'Friends owe you' : 'You owe friends'}</div>
    <div class="big"${square ? '' : ` data-count="${Math.round(Math.max(t.owed, t.owe))}"`}>${square ? 'All square' : money(Math.max(t.owed, t.owe), { dec: false })}</div>
    <div class="line">${square ? (S.bills.length ? 'Nobody owes anybody. Nice.' : 'Split a dinner, a cab or a trip. Kharcha keeps score.') : t.owed && t.owe ? `You owe ${money(t.owe, { dec: false })} on the other side` : t.owed ? 'Tap a friend to ask with a UPI link or QR' : 'Tap a friend to pay them by UPI'}</div>
    <button class="btn block bbsplit" data-act="bbnew">＋ Split a bill</button></div>`;
  h += `<h2>Friends</h2><div class="card list">${fr.length ? fr.map(f => { const b = balanceOf(f.id);
      return `<button class="item" data-act="bbfriend" data-id="${f.id}">${avatar(f.id)}<div class="grow"><div class="bold ellipsis">${esc(f.name)}</div><div class="small ellipsis">${balLine(f.id, b)}${f.upi ? '' : ' <span class="muted">· no UPI ID</span>'}</div></div>${Math.abs(b) >= .01 ? `<span class="pill ${b > 0 ? 'in' : 'out'}">${b > 0 ? 'Ask' : 'Pay'}</span>` : ''}</button>`; }).join('')
    : `<div class="empty" style="padding:14px 10px">Add the people you split with. A UPI ID is optional; it lets you pay them in one tap.</div>`}
    <div class="item"><button class="btn block" data-act="bbfriendnew">＋ Add a friend</button></div></div>`;
  const bills = [...S.bills].sort((a, b) => b.ts - a.ts).slice(0, 25);
  if (bills.length) h += `<h2>Bills</h2><div class="card list">${bills.map(billRow).join('')}</div>`;
  if (openIous().length) h += `<h2>Quick IOUs</h2><div class="card list">${openIous().map(o => `<div class="item"><div class="emoji">${o.dir === 'owe' ? '📤' : '📥'}</div><button class="grow" data-act="iouedit" data-id="${o.id}" style="text-align:left"><div class="bold ellipsis">${o.dir === 'owe' ? 'You owe ' : ''}${esc(o.who)}</div><div class="small muted ellipsis">${esc(o.note || 'No note')} · ${relDay(o.ts)}</div></button><div class="bold num">${money(o.amt)}</div>${o.dir === 'owe' ? '' : `<button class="btn ghost small" data-act="ioucopy" data-id="${o.id}" aria-label="Copy a reminder message">📋</button>`}<button class="btn small" data-act="iousettle" data-id="${o.id}">Settle</button></div>`).join('')}
    <div class="item"><button class="btn block ghost" data-act="iounew">＋ Add a quick IOU</button></div></div>`;
  const me = S.settings.upi;
  h += `<h2>Your UPI ID</h2><button class="card" style="display:block;width:100%;text-align:left" data-act="bbmyupi"><div class="row"><div class="emoji">🔗</div><div class="grow"><div class="bold ellipsis">${me ? esc(me) : 'Add your UPI ID'}</div><div class="small muted">${me ? 'Used in the payment links and QR codes you send. Tap to change.' : 'So friends can pay you from a link or QR. Looks like name@okaxis.'}</div></div></div></button>`;
  return h;
}
function billRow(x) {
  const ppl = Object.keys(x.shares), mine = +(x.shares.me || 0);
  const sub = (x.payer === 'me' ? 'You paid' : esc(pname(x.payer)) + ' paid') + ' · ' + ppl.length + ' people · ' + relDay(x.ts);
  const net = x.payer === 'me' ? x.amt - mine : -mine;
  return `<button class="item${x.id === freshId ? ' fresh' : ''}" data-act="bbedit" data-id="${x.id}"><div class="emoji">${catById(x.cat).emoji}</div><div class="grow"><div class="bold ellipsis">${esc(x.title)}</div><div class="small muted ellipsis">${sub}</div></div>
    <div style="text-align:right"><div class="bold num">${money(x.amt)}</div><div class="small num ${net > 0 ? 'ok' : net < 0 ? 'bad' : 'muted'}">${net > 0 ? '+' + money(net) : net < 0 ? '−' + money(-net) : 'even'}</div></div></button>`;
}

/* ---------- bill form ---------- */
function billForm(x, pre) {
  BB();
  if (x) bb = { id: x.id, editing: true, title: x.title, amt: String(x.amt), ts: x.ts, cat: x.cat, payer: x.payer, people: Object.keys(x.shares), mode: x.mode || 'equal', custom: { ...x.shares }, log: !!x.txId, adding: false };
  else bb = { id: uid(), editing: false, title: (pre && pre.title) || '', amt: pre && pre.amt ? String(pre.amt) : '', ts: (pre && pre.ts) || Date.now(), cat: (pre && pre.cat) || 'food', payer: 'me', people: ['me', ...((pre && pre.people) || [])], mode: 'equal', custom: {}, log: true, adding: !S.friends.length };
  renderBill(true);
}
function syncBill() {
  if (!bb) return;
  const g = id => document.getElementById(id);
  if (g('bb-title')) bb.title = g('bb-title').value;
  if (g('bb-amt')) bb.amt = g('bb-amt').value;
  if (g('bb-cat')) bb.cat = g('bb-cat').value;
  document.querySelectorAll('[data-bbshare]').forEach(i => { bb.custom[i.dataset.bbshare] = i.value; });
}
function billShares() {
  const total = r2(parseFloat(bb.amt) || 0);
  if (bb.mode === 'equal') return equalShares(total, bb.people, bb.payer);
  const out = {}; bb.people.forEach(p => { out[p] = r2(parseFloat(bb.custom[p]) || 0); }); return out;
}
function renderBill(fresh) {
  const total = r2(parseFloat(bb.amt) || 0), sh = billShares(), assigned = r2(sum(Object.values(sh)));
  if (!bb.people.includes(bb.payer)) bb.payer = bb.people[0] || 'me';
  const pchips = ['me', ...S.friends.map(f => f.id)].map(p => `<button class="chip pchip ${bb.people.includes(p) ? 'sel' : ''}" data-bbp="${p}">${avatar(p, 'sm')}${esc(p === 'me' ? 'Me' : pname(p))}</button>`).join('');
  const payChips = bb.people.map(p => `<button class="chip ${bb.payer === p ? 'sel' : ''}" data-bbpay="${p}">${esc(p === 'me' ? 'Me' : pname(p))}</button>`).join('');
  const left = r2(total - assigned);
  const lines = bb.people.map(p => `<div class="sharerow">${avatar(p, 'sm')}<span class="grow ellipsis">${esc(p === 'me' ? 'You' : pname(p))}${p === bb.payer ? ' <span class="muted small">paid</span>' : ''}</span>${bb.mode === 'custom'
      ? `<input data-bbshare="${p}" type="number" inputmode="decimal" value="${esc(bb.custom[p] ?? '')}" placeholder="0" aria-label="Share for ${esc(pname(p))}">`
      : `<span class="bold num">${money(sh[p] || 0)}</span>`}</div>`).join('');
  const myShare = sh.me || 0;
  openSheet(`<h3 style="margin:4px 0 14px">${bb.editing ? 'Edit bill' : 'Split a bill'}</h3>
    <div class="field"><label>What for</label><input id="bb-title" value="${esc(bb.title)}" placeholder="e.g. Dinner at Toit, Goa cab" maxlength="60" autocomplete="off"></div>
    <div class="two"><div class="field"><label>Total</label><input id="bb-amt" type="number" inputmode="decimal" value="${esc(bb.amt)}" placeholder="0"></div>
    <div class="field"><label>Category</label><select id="bb-cat">${S.cats.map(c => `<option value="${c.id}" ${c.id === bb.cat ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select></div></div>
    <div class="field"><label>Who was in</label><div class="wrapchips">${pchips}<button class="chip" data-act="bbaddf">＋ New</button></div>
      ${bb.adding ? `<div class="row" style="gap:8px;margin-top:10px"><input id="bb-fname" placeholder="Friend's name" maxlength="30" autocomplete="off" style="flex:1"><button class="btn small" data-act="bbaddfsave">Add</button></div>` : ''}</div>
    ${bb.people.length ? `<div class="field"><label>Who paid</label><div class="wrapchips">${payChips}</div></div>` : ''}
    <div class="seg">${[['equal', 'Split equally'], ['custom', 'Exact amounts']].map(([k, l]) => `<button data-bbmode="${k}" class="${bb.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="card shares">${lines || '<div class="small muted">Pick who was in.</div>'}
      ${bb.mode === 'custom' ? `<div class="small ${Math.abs(left) < .01 ? 'ok' : 'bad'}" id="bb-left" style="margin-top:8px">${Math.abs(left) < .01 ? 'Adds up ✓' : left > 0 ? money(left) + ' left to assign' : money(-left) + ' too much'}</div>` : ''}</div>
    ${bb.people.includes('me') ? togRowBB(myShare) : ''}
    ${bb.editing ? `<button class="btn block ghost small" data-act="bbshare" style="margin-bottom:8px">📤 Share the breakdown</button>` : ''}
    <div class="actions">${bb.editing ? `<button class="btn danger" data-act="bbdel" data-id="${bb.id}">Delete</button>` : `<button class="btn" data-act="close">Cancel</button>`}<button class="btn primary" data-act="bbsave">${bb.editing ? 'Update' : 'Save bill'}</button></div>`, fresh);
}
const togRowBB = mine => `<div class="tog" style="border-top:0"><div class="grow"><div class="bold">Log my share as an expense</div><div class="small muted">${mine ? money(mine) + ' goes into your spending today' : 'Your share counts toward your budget'}${bb.payer !== 'me' ? '. Paying them back later is not counted again.' : ''}</div></div><button class="switch ${bb.log ? 'on' : ''}" data-act="bblog" role="switch" aria-checked="${bb.log}" aria-label="Log my share as an expense"><i></i></button></div>`;

function saveBill() {
  syncBill();
  const total = r2(parseFloat(bb.amt) || 0), title = bb.title.trim();
  if (!total) { toast('How much was the bill?'); return; }
  if (!bb.people.some(p => p !== 'me')) { toast('Pick at least one friend'); return; }
  if (bb.payer !== 'me' && !bb.people.includes('me')) { toast('Add yourself, or pick yourself as the payer'); return; }
  const shares = billShares();
  if (Math.abs(r2(sum(Object.values(shares))) - total) >= .01) { toast('The amounts must add up to ' + money(total)); return; }
  Object.keys(shares).forEach(k => { if (!shares[k] && bb.mode === 'custom') delete shares[k]; });
  const old = S.bills.find(x => x.id === bb.id);
  const bill = { id: bb.id, title: title || catById(bb.cat).name, amt: total, ts: old ? old.ts : bb.ts, cat: bb.cat, payer: bb.payer, mode: bb.mode, shares };
  const txId = 'bill-' + bill.id;
  S.tx = S.tx.filter(t => t.id !== txId);
  if (bb.log && shares.me) { S.tx.push({ id: txId, amt: shares.me, cat: bill.cat, note: bill.title + ' (split)', mode: bill.payer === 'me' ? 'UPI' : 'Split', ts: bill.ts, src: 'bill' }); bill.txId = txId; }
  if (old) { Object.assign(old, bill); if (!bill.txId) delete old.txId; } else S.bills.push(bill);
  save(); markFresh(bill.id);
  const was = bb.editing; bb = null; closeSheet(); goalsView = 'split';
  if (tab !== 'goals') go('goals'); else render();
  tick(15);
  if (was) { toast('Bill updated'); return; }
  const others = r2(total - (shares.me || 0));
  toast(bill.payer === 'me' ? `Saved · friends owe you ${money(others)}` : `Saved · you owe ${pname(bill.payer)} ${money(shares.me || 0)}`, 5000,
    { label: 'Undo', fn: () => { S.bills = S.bills.filter(x => x.id !== bill.id); S.tx = S.tx.filter(t => t.id !== txId); save(); render(); toast('Removed'); } });
}

function billBreakdown(x) {
  const lines = Object.entries(x.shares).sort((a, b) => (a[0] === 'me') - (b[0] === 'me')).map(([p, v]) => `• ${p === 'me' ? (S.settings.name || 'Me') : pname(p)}: ${money(v)}`);
  const payer = x.payer === 'me' ? (S.settings.name || 'me') : pname(x.payer);
  return [`🧾 ${x.title}: ${money(x.amt)}`, ...lines, `Paid by ${payer}.`].concat(x.payer === 'me' && S.settings.upi ? [`UPI: ${S.settings.upi}`] : []).join('\n');
}
function shareText(text) {
  if (navigator.share) return navigator.share({ text }).catch(() => {});
  copyText(text, 'Breakdown copied. Paste it in the group');
}

/* ---------- friends ---------- */
function addFriend(name, upi) {
  name = (name || '').trim(); if (!name) return null;
  const ex = BB().friends.find(f => f.name.toLowerCase() === name.toLowerCase()); if (ex) return ex;
  const f = { id: 'f' + uid(), name, upi: (upi || '').trim() }; S.friends.push(f); save(); return f;
}
function friendForm(f) {
  const isNew = !f; f = f || { id: '', name: '', upi: '' };
  openSheet(`<h3 style="margin:4px 0 14px">${isNew ? 'Add a friend' : 'Edit ' + esc(f.name)}</h3>
    <div class="field"><label>Name</label><input id="f-name" value="${esc(f.name)}" placeholder="e.g. Rohan" maxlength="30" autocomplete="off"></div>
    <div class="field"><label>UPI ID (optional)</label><input id="f-upi" value="${esc(f.upi)}" placeholder="rohan@okicici" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    <p class="small muted" style="margin-top:-6px">With their UPI ID, <b>Pay</b> opens your UPI app with the amount filled in.</p>
    <div class="actions">${isNew ? `<button class="btn" data-act="close">Cancel</button>` : `<button class="btn danger" data-act="bbfrienddel" data-id="${f.id}">Remove</button>`}<button class="btn primary" data-act="bbfriendsave" data-id="${f.id}">Save</button></div>`, true);
}
function friendSheet(fid) {
  const f = friendById(fid); if (!f) return;
  const b = balanceOf(fid);
  const items = [...S.bills.filter(x => x.shares[fid] !== undefined || x.payer === fid).map(x => ({ ts: x.ts, k: 'bill', x })), ...S.settles.filter(s => s.fid === fid).map(s => ({ ts: s.ts, k: 'set', x: s }))].sort((a, z) => z.ts - a.ts);
  const row = it => {
    if (it.k === 'set') { const s = it.x; return `<div class="item"><div class="emoji">${s.dir === 'in' ? '📥' : '📤'}</div><div class="grow"><div class="bold ellipsis">${s.dir === 'in' ? esc(f.name) + ' paid you' : 'You paid ' + esc(f.name)}</div><div class="small muted ellipsis">${s.note ? esc(s.note) + ' · ' : ''}${relDay(s.ts)}</div></div><div class="bold num">${money(s.amt)}</div><button class="btn ghost small" data-act="bbsetdel" data-id="${s.id}" aria-label="Remove payment">✕</button></div>`; }
    const x = it.x, eff = x.payer === 'me' ? +(x.shares[fid] || 0) : x.payer === fid ? -(x.shares.me || 0) : 0;
    return `<button class="item" data-act="bbedit" data-id="${x.id}"><div class="emoji">${catById(x.cat).emoji}</div><div class="grow"><div class="bold ellipsis">${esc(x.title)}</div><div class="small muted ellipsis">${x.payer === 'me' ? 'You paid' : esc(pname(x.payer)) + ' paid'} ${money(x.amt)} · ${relDay(x.ts)}</div></div><div class="bold num ${eff > 0 ? 'ok' : eff < 0 ? 'bad' : 'muted'}">${eff > 0 ? '+' : eff < 0 ? '−' : ''}${money(Math.abs(eff))}</div></button>`;
  };
  const sq = Math.abs(b) < .01;
  openSheet(`<div class="row" style="gap:12px;margin:4px 0 12px">${avatar(fid, 'lg')}<div class="grow"><h3 style="margin:0">${esc(f.name)}</h3><div class="small muted ellipsis">${f.upi ? esc(f.upi) : 'No UPI ID yet'}</div></div><button class="btn ghost small" data-act="bbfriendedit" data-id="${fid}" aria-label="Edit friend">✎</button></div>
    <div class="card bbbal ${sq ? '' : b > 0 ? 'in' : 'out'}"><div class="small muted">${sq ? 'Balance' : b > 0 ? esc(f.name) + ' owes you' : 'You owe ' + esc(f.name)}</div><div class="bignum">${sq ? 'All square 🤝' : money(Math.abs(b))}</div></div>
    ${sq ? '' : b > 0 ? `<button class="btn primary block" data-act="bbask" data-id="${fid}">Ask for ${money(b)} · UPI link + QR</button>`
      : `<button class="btn primary block" data-act="bbpay" data-id="${fid}">${f.upi ? 'Pay ' + money(-b) + ' by UPI' : 'Add their UPI ID to pay'}</button>`}
    <div class="two" style="margin-top:10px"><button class="btn" data-act="bbsettle" data-id="${fid}">Record a payment</button><button class="btn" data-act="bbnewwith" data-id="${fid}">＋ New bill</button></div>
    <h2>History</h2><div class="card list">${items.length ? items.map(row).join('') : '<div class="empty" style="padding:14px 10px">Nothing yet.</div>'}</div>`, true);
}
function settleForm(fid, amt, dir) {
  const f = friendById(fid), b = balanceOf(fid);
  dir = dir || (b < 0 ? 'out' : 'in'); amt = amt || Math.abs(b) || '';
  openSheet(`<h3 style="margin:4px 0 14px">Record a payment</h3>
    <div class="seg">${[['in', esc(f.name) + ' paid me'], ['out', 'I paid ' + esc(f.name)]].map(([k, l]) => `<button data-bbdir="${k}" data-id="${fid}" class="${dir === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="two"><div class="field"><label>Amount</label><input id="st-amt" type="number" inputmode="decimal" value="${amt}"></div><div class="field"><label>Note</label><input id="st-note" placeholder="UPI, cash..." maxlength="40"></div></div>
    <p class="small muted" style="margin-top:-4px">This only settles the balance. Your share of each bill was already counted when you added it.</p>
    <div class="actions"><button class="btn" data-act="bbfriend" data-id="${fid}">Back</button><button class="btn primary" data-act="bbsetsave" data-id="${fid}" data-dir="${dir}">Save</button></div>`);
}
function recordSettle(fid, amt, dir, note) {
  const s = { id: uid(), fid, amt: r2(amt), dir, ts: Date.now(), note: note || '' };
  BB().settles.push(s); save(); render(); tick(15);
  const left = balanceOf(fid);
  toast(Math.abs(left) < .01 ? `Settled up with ${pname(fid)} 🤝` : left > 0 ? `Saved · ${pname(fid)} still owes ${money(left)}` : `Saved · you still owe ${money(-left)}`, 5000,
    { label: 'Undo', fn: () => { S.settles = S.settles.filter(x => x.id !== s.id); save(); render(); if ($('#sheet').classList.contains('show')) friendSheet(fid); } });
  if (Math.abs(left) < .01) { confetti(); stamp('Settled!'); }
}

function stamp(text) {
  const el = document.createElement('div'); el.className = 'stamp'; el.innerHTML = `<b>${esc(text)}</b>`;
  document.body.appendChild(el); setTimeout(() => el.classList.add('out'), 1100); setTimeout(() => el.remove(), 1500);
}

/* ---------- ask for money ---------- */
const lastBillWith = fid => S.bills.filter(x => x.payer === 'me' && x.shares[fid]).sort((a, b) => b.ts - a.ts)[0];
function askSheet(fid, amt) {
  const f = friendById(fid), me = S.settings.upi;
  if (!me) return myUpiForm({ fid, amt });
  const last = lastBillWith(fid), link = upiLink(me, S.settings.name || 'Kharcha', amt, 'Kharcha split' + (last ? ': ' + last.title : ''));
  openSheet(`<h3 style="margin:4px 0 4px">Ask ${esc(f.name)} for ${money(amt)}</h3>
    <p class="small muted" style="margin-top:0">They scan this with any UPI app (GPay, PhonePe, Paytm, BHIM). The amount is filled in.</p>
    <div class="qrbox">${qrSvg(link)}<div class="small bold" style="margin-top:8px">${esc(me)}</div><div class="bignum">${money(amt)}</div></div>
    <div class="two"><button class="btn primary" data-act="bbwa" data-id="${fid}" data-amt="${amt}">Send on WhatsApp</button><button class="btn" data-act="bbcopymsg" data-id="${fid}" data-amt="${amt}">Copy message</button></div>
    <button class="btn block ghost small" style="margin-top:8px" data-act="bbcopylink" data-link="${esc(link)}">Copy UPI link</button>
    <div class="actions" style="margin-top:8px"><button class="btn" data-act="bbfriend" data-id="${fid}">Back</button><button class="btn primary" data-act="bbgotpaid" data-id="${fid}" data-amt="${amt}">They paid ✓</button></div>`, true);
}
function askMessage(fid, amt) {
  const f = friendById(fid), me = S.settings.upi, last = lastBillWith(fid);
  return `Hey ${f.name}! Your share${last ? ' for ' + last.title : ''} comes to ${money(amt)}. UPI it to ${me} when you can 🙏\n\nTap to pay: ${upiLink(me, S.settings.name || 'Kharcha', amt, 'Kharcha split' + (last ? ': ' + last.title : ''))}`;
}
function myUpiForm(then) {
  bbBack = then || null;
  openSheet(`<h3 style="margin:4px 0 14px">Your UPI ID</h3>
    <div class="field"><label>UPI ID</label><input id="my-upi" value="${esc(S.settings.upi || '')}" placeholder="yourname@okaxis" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    <p class="small muted" style="margin-top:-6px">Find it in your UPI app under your profile. It goes into the links and QR codes you send, and never leaves this phone otherwise.</p>
    <div class="actions"><button class="btn" data-act="${then ? 'bbfriend' : 'close'}" data-id="${then ? then.fid : ''}">${then ? 'Back' : 'Cancel'}</button><button class="btn primary" data-act="bbmyupisave">Save</button></div>`, true);
}

/* ---------- events (called first from the main click handler) ---------- */
function buddyClick(t) {
  const d = t.dataset, id = d.id;
  if (d.gview) { goalsView = d.gview; render(true); return true; }
  if (d.bbp && bb) { syncBill(); const i = bb.people.indexOf(d.bbp); if (i >= 0) bb.people.splice(i, 1); else bb.people.push(d.bbp); tick(8); renderBill(); return true; }
  if (d.bbpay && bb) { syncBill(); bb.payer = d.bbpay; tick(8); renderBill(); return true; }
  if (d.bbmode && bb) {
    syncBill();
    if (bb.mode === 'equal' && d.bbmode === 'custom') { const eq = billShares(); bb.custom = {}; Object.keys(eq).forEach(k => { bb.custom[k] = eq[k] ? String(eq[k]) : ''; }); }   // start from the equal split
    bb.mode = d.bbmode; renderBill(); return true;
  }
  if (d.bbdir) { const a = $('#st-amt') ? $('#st-amt').value : ''; settleForm(id, a, d.bbdir); return true; }
  const act = d.act; if (!act || !act.startsWith('bb')) return false;
  switch (act) {
    case 'bbnew': billForm(); break;
    case 'bbnewwith': billForm(null, { people: [id] }); break;
    case 'bbedit': { const x = S.bills.find(b => b.id === id); if (x) billForm(x); break; }
    case 'bbsave': saveBill(); break;
    case 'bbshare': { const x = S.bills.find(b => b.id === bb.id); if (x) shareText(billBreakdown(x)); break; }
    case 'bblog': syncBill(); bb.log = !bb.log; tick(8); renderBill(); break;
    case 'bbaddf': syncBill(); bb.adding = true; renderBill(); setTimeout(() => { const i = $('#bb-fname'); if (i) i.focus(); }, 60); break;
    case 'bbaddfsave': { syncBill(); const f = addFriend(($('#bb-fname') || {}).value); if (!f) { toast('Type a name'); break; } if (!bb.people.includes(f.id)) bb.people.push(f.id); bb.adding = false; renderBill(); break; }
    case 'bbdel': {
      const x = S.bills.find(b => b.id === id); if (!x) break; const tx = S.tx.find(t => t.id === 'bill-' + id);
      S.bills = S.bills.filter(b => b.id !== id); S.tx = S.tx.filter(t => t.id !== 'bill-' + id); save(); bb = null; closeSheet(); render();
      toast('Bill deleted', 5000, { label: 'Undo', fn: () => { S.bills.push(x); if (tx) S.tx.push(tx); save(); render(); } }); break;
    }
    case 'bbfriendnew': friendForm(); break;
    case 'bbfriendedit': friendForm(friendById(id)); break;
    case 'bbfriendsave': {
      const name = $('#f-name').value.trim(), upi = $('#f-upi').value.trim();
      if (!name) { toast('Type a name'); break; }
      if (upi && !UPI_RE.test(upi)) { toast('That UPI ID looks off. It should look like name@bank'); break; }
      let f = friendById(id);
      if (f) Object.assign(f, { name, upi }); else f = Object.assign(addFriend(name, upi), { upi });
      save(); render(); friendSheet(f.id); break;
    }
    case 'bbfrienddel': {
      const f = friendById(id); if (!f) break;
      const used = S.bills.some(x => x.shares[id] !== undefined || x.payer === id);
      if (Math.abs(balanceOf(id)) >= .01) { toast('Settle up with ' + f.name + ' first'); break; }
      if (used && !confirm(`Remove ${f.name}? Their past bills stay, shown as "Someone".`)) break;
      S.friends = S.friends.filter(x => x.id !== id); S.settles = S.settles.filter(s => s.fid !== id); save(); closeSheet(); render(); toast('Removed ' + f.name); break;
    }
    case 'bbfriend': friendSheet(id); break;
    case 'bbsettle': settleForm(id); break;
    case 'bbsetsave': {
      const amt = +$('#st-amt').value; if (!(amt > 0)) { toast('How much?'); break; }
      recordSettle(id, amt, d.dir, $('#st-note').value.trim()); friendSheet(id); break;
    }
    case 'bbsetdel': {
      const s = S.settles.find(x => x.id === id); if (!s) break;
      S.settles = S.settles.filter(x => x.id !== id); save(); render(); friendSheet(s.fid);
      toast('Payment removed', 5000, { label: 'Undo', fn: () => { S.settles.push(s); save(); render(); friendSheet(s.fid); } }); break;
    }
    case 'bbask': askSheet(id, balanceOf(id)); break;
    case 'bbpay': {
      const f = friendById(id); if (!f) break;
      if (!f.upi) { friendForm(f); break; }
      const amt = -balanceOf(id);
      openExternal(upiLink(f.upi, f.name, amt, 'Kharcha split'));
      openSheet(`<h3 style="margin:4px 0 6px">Did it go through?</h3><p class="small muted" style="margin-top:0">Your UPI app opened with ${money(amt)} to ${esc(f.upi)}. Once it's paid, mark it here.</p>
        <button class="btn block ghost small" data-act="bbpay" data-id="${id}">Open the UPI app again</button>
        <div class="actions" style="margin-top:8px"><button class="btn" data-act="bbfriend" data-id="${id}">Not yet</button><button class="btn primary" data-act="bbpaid" data-id="${id}" data-amt="${amt}">Paid ✓</button></div>`, true);
      break;
    }
    case 'bbpaid': recordSettle(id, +d.amt, 'out', 'UPI'); friendSheet(id); break;
    case 'bbgotpaid': recordSettle(id, +d.amt, 'in', 'UPI'); friendSheet(id); break;
    case 'bbwa': openExternal('https://wa.me/?text=' + encodeURIComponent(askMessage(id, +d.amt))); break;
    case 'bbcopymsg': copyText(askMessage(id, +d.amt), 'Message copied. Paste it in any chat'); break;
    case 'bbcopylink': copyText(d.link, 'UPI link copied'); break;
    case 'bbmyupi': myUpiForm(); break;
    case 'bbmyupisave': {
      const v = $('#my-upi').value.trim();
      if (v && !UPI_RE.test(v)) { toast('That UPI ID looks off. It should look like name@bank'); break; }
      S.settings.upi = v; save(); render();
      const back = bbBack; bbBack = null;
      if (back && v) askSheet(back.fid, back.amt); else { closeSheet(); if (v) toast('Saved your UPI ID'); }
      break;
    }
    case 'bbfromadd': {
      syncDraftInputs(); const pre = { amt: parseFloat(draft.amtStr) || '', title: draft.note, cat: draft.cat || 'food', ts: draft.ts };
      draft = null; if (location.hash.startsWith('#add')) history.replaceState(null, '', location.pathname);
      billForm(null, pre); break;
    }
    default: return false;
  }
  return true;
}
document.addEventListener('input', e => {
  const t = e.target; if (!bb || !(t.dataset.bbshare || t.id === 'bb-amt')) return;
  syncBill();
  if (bb.mode === 'equal') { if (t.id === 'bb-amt') { const sh = billShares(); document.querySelectorAll('#sheet .sharerow').forEach((r, i) => { const n = r.querySelector('.num'); if (n) n.textContent = money(sh[bb.people[i]] || 0); }); } return; }
  const el = $('#bb-left'); if (!el) return;
  const left = r2((parseFloat(bb.amt) || 0) - sum(Object.values(billShares())));
  el.className = 'small ' + (Math.abs(left) < .01 ? 'ok' : 'bad');
  el.textContent = Math.abs(left) < .01 ? 'Adds up ✓' : left > 0 ? money(left) + ' left to assign' : money(-left) + ' too much';
});
