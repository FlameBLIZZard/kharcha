/* Kharcha Wrapped: a loud, animated, swipeable story recap of a month or a year of spending.
   Everything is drawn on one canvas, so the same frames play on screen and export as a reel
   (MediaRecorder) or as images. Loaded after the main script; uses its globals (S, money, period,
   catById, openSheet, toast, KN, IS_APP ...). */
(() => {
  'use strict';
  const W = 1080, H = 1920;
  const C = { bg: '#16141a', ink: '#000', paper: '#fff8ec', mute: '#b6aea3', mint: '#5dffb0', volt: '#ffc93d', pink: '#ff5fa2',
    blue: '#4dc3ff', orange: '#ff8a3d', purple: '#b28bff', red: '#ff5d6c', lime: '#c6ff3d', well: '#0f0e12', card: '#221f27' };
  const PAL = [C.mint, C.volt, C.pink, C.blue, C.orange, C.purple, C.lime];
  const DISPLAY = '"Archivo Black", "Arial Black", Impact, sans-serif';
  const BODY = '"Space Grotesk", Inter, system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  const M = (n) => money(Math.round(n), { dec: false });
  const DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ---------------- numbers ---------------- */
  function ranges() {
    const cur = period(), last = period(new Date(+cur.start - DAY));
    const out = [];
    const mName = p => p.start.toLocaleDateString('en-IN', { month: 'long' });
    out.push({ id: 'last', kind: 'month', start: last.start, end: last.end, label: mName(last), sub: 'Last month' });
    out.push({ id: 'cur', kind: 'month', start: cur.start, end: new Date(Math.min(+cur.end, Date.now() + 1)), label: mName(cur), sub: 'This month so far', partial: true });
    const y = new Date().getFullYear();
    out.push({ id: 'year', kind: 'year', start: new Date(y, 0, 1), end: new Date(Math.min(+new Date(y + 1, 0, 1), Date.now() + 1)), label: String(y), sub: 'This year so far', partial: true });
    const first = S.tx.length ? Math.min(...S.tx.map(t => t.ts)) : Date.now();
    if (new Date(first).getFullYear() < y) out.push({ id: 'prevyear', kind: 'year', start: new Date(y - 1, 0, 1), end: new Date(y, 0, 1), label: String(y - 1), sub: 'Last year' });
    return out.map(r => Object.assign(r, { n: S.tx.filter(t => inRange(t.ts, r.start, r.end)).length }));
  }

  function stats(r) {
    const tx = S.tx.filter(t => inRange(t.ts, r.start, r.end)).sort((a, b) => a.ts - b.ts);
    const spent = sum(tx.map(t => t.amt));
    const lenMs = +r.end - +r.start;
    const prevTx = S.tx.filter(t => inRange(t.ts, +r.start - lenMs, r.start));
    const prev = sum(prevTx.map(t => t.amt));
    const today = startOfDay(Date.now());
    const lastDay = new Date(Math.min(+r.end - 1, +today));
    const days = [];
    // count from when you started using Kharcha, not from 1 Jan
    const began = startOfDay(Math.min(S.created || Date.now(), ...S.tx.map(t => t.ts)));
    for (let d = startOfDay(Math.max(+r.start, +began)); d <= lastDay; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push({ d, amt: 0, n: 0 });
    const idx = {}; days.forEach((x, i) => idx[dayKey(x.d)] = i);
    tx.forEach(t => { const i = idx[dayKey(t.ts)]; if (i != null) { days[i].amt += t.amt; days[i].n++; } });
    const byCat = {}; tx.forEach(t => byCat[t.cat] = (byCat[t.cat] || 0) + t.amt);
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ c: catById(id), v, share: spent ? v / spent : 0 }));
    let big = null; days.forEach(x => { if (x.amt && (!big || x.amt > big.amt)) big = x; });
    const bigTx = big ? tx.filter(t => dayKey(t.ts) === dayKey(big.d)).sort((a, b) => b.amt - a.amt)[0] : null;
    let noSpend = 0, run = 0, best = 0, spendRun = 0, bestSpend = 0;
    days.forEach(x => { if (!x.amt) { noSpend++; run++; best = Math.max(best, run); spendRun = 0; } else { run = 0; spendRun++; bestSpend = Math.max(bestSpend, spendRun); } });
    const wd = [0, 0, 0, 0, 0, 0, 0]; tx.forEach(t => wd[new Date(t.ts).getDay()] += t.amt);
    const favDay = tx.length ? wd.indexOf(Math.max(...wd)) : null;
    const night = tx.filter(t => { const h = new Date(t.ts).getHours(); return h >= 22 || h < 5; }).length;
    const notes = {}; tx.forEach(t => { const k = String(t.note || '').trim().toLowerCase().replace(/\s+/g, ' '); if (k && k.length <= 24) (notes[k] = notes[k] || { n: 0, v: 0, label: String(t.note).trim() }).n++, notes[k].v += t.amt; });
    const topNote = Object.values(notes).filter(x => x.n >= 2).sort((a, b) => b.n - a.n || b.v - a.v)[0] || null;
    const small = tx.length ? tx.reduce((a, b) => (b.amt < a.amt ? b : a)) : null;
    const months = [];
    if (r.kind === 'year') for (let m = 0; m < 12; m++) {
      const a = new Date(r.start.getFullYear(), m, 1), b = new Date(r.start.getFullYear(), m + 1, 1);
      months.push({ m, v: sum(tx.filter(t => inRange(t.ts, a, b)).map(t => t.amt)), future: +a > Date.now() });
    }
    const inc = sum((S.inc || []).filter(x => inRange(x.ts, r.start, r.end)).map(x => x.amt));
    const skipped = sum((S.saves || []).filter(x => x.kind === 'skip' && inRange(x.ts, r.start, r.end)).map(x => x.amt));
    const saved = sum((S.saves || []).filter(x => x.kind !== 'skip' && inRange(x.ts, r.start, r.end)).map(x => x.amt));
    return { r, tx, spent, prev, prevN: prevTx.length, days, cats, big, bigTx, noSpend, bestNoSpend: best, bestSpend, favDay, night,
      topNote, small, months, inc, skipped, saved, perDay: spent / Math.max(1, days.length) };
  }

  const PERSONA = {
    food: ['🍔', 'The Foodie', 'Your money had one true love: snacks.'],
    groceries: ['🥬', 'The Home Chef', 'Fridge full, wallet steady.'],
    shopping: ['🛍️', 'The Haul Hunter', 'Cart first, questions later.'],
    petrol: ['⛽', 'The Road Warrior', 'Always on the move.'],
    travel: ['🚕', 'The Explorer', 'Going places, literally.'],
    subscriptions: ['🔁', 'The Subscriber', 'Every app has your card.'],
    bills: ['🧾', 'The Responsible One', 'Bills paid, lights on.'],
  };
  function persona(st) {
    if (st.days.length >= 10 && st.noSpend / st.days.length > .5) return ['🧘', 'The Monk', 'More no-spend days than spend days. Legend.'];
    const top = st.cats[0];
    if (!top) return ['🌱', 'The Fresh Start', 'Nothing logged yet. Next time.'];
    if (top.share < .3 && st.cats.length >= 4) return ['🎲', 'The Balancer', 'A bit of everything, nothing too wild.'];
    const p = PERSONA[top.c.id];
    return p || [top.c.emoji || '✨', 'The ' + top.c.name + ' Fan', `${Math.round(top.share * 100)}% of everything went to ${top.c.name}.`];
  }

  /* ---------------- drawing kit ---------------- */
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = x => 1 - Math.pow(1 - clamp(x), 3);
  const back = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const prog = (t, a, d) => clamp((t - a) / d);

  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
  /** Ink block: hard black shadow, ink outline. */
  function block(g, x, y, w, h, fill, o = {}) {
    const s = o.shadow ?? 14, r = o.r ?? 34;
    g.fillStyle = C.ink; rr(g, x + s, y + s, w, h, r); g.fill();
    g.fillStyle = fill; rr(g, x, y, w, h, r); g.fill();
    g.lineWidth = o.lw ?? 7; g.strokeStyle = C.ink; g.stroke();
  }
  function font(g, size, fam = DISPLAY, weight = '') { g.font = `${weight} ${size}px ${fam}`.trim(); }
  /** Text with a thick ink outline (the "sticker" look). */
  function stroked(g, s, x, y, size, fill, o = {}) {
    font(g, size, o.fam || DISPLAY, o.weight); g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'alphabetic';
    if (o.lw !== 0) { g.lineJoin = 'round'; g.lineWidth = o.lw ?? Math.max(6, size * .11); g.strokeStyle = C.ink; g.strokeText(s, x, y); }
    g.fillStyle = fill; g.fillText(s, x, y);
  }
  function text(g, s, x, y, size, fill, o = {}) { stroked(g, s, x, y, size, fill, Object.assign({ lw: 0, fam: BODY, weight: '700' }, o)); }
  /** Largest font size (<= max) that fits the width. */
  function fit(g, s, maxW, max, fam = DISPLAY, weight = '') {
    let z = max; font(g, z, fam, weight);
    while (z > 20 && g.measureText(s).width > maxW) { z -= 4; font(g, z, fam, weight); }
    return z;
  }
  function wrap(g, s, maxW, size, fam = BODY, weight = '700') {
    font(g, size, fam, weight); const words = String(s).split(' '), lines = []; let l = '';
    words.forEach(w => { const tr = l ? l + ' ' + w : w; if (g.measureText(tr).width > maxW && l) { lines.push(l); l = w; } else l = tr; });
    if (l) lines.push(l); return lines;
  }
  function withT(g, x, y, sc, rot, fn) { g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(sc, sc); fn(); g.restore(); }
  function dots(g, col) {   // the suite's dot-grid paper
    g.fillStyle = col; for (let y = 24; y < H; y += 48) for (let x = 24; x < W; x += 48) { g.beginPath(); g.arc(x, y, 3.4, 0, 7); g.fill(); }
  }
  function bg(g, fill, t, seed = 0) {
    g.fillStyle = fill; g.fillRect(0, 0, W, H); dots(g, 'rgba(0,0,0,.10)');
    // floating ink shapes
    for (let i = 0; i < 5; i++) {
      const a = seed * 1.7 + i * 2.1, px = (Math.sin(a * 3.1) * .5 + .5) * W, py = (Math.cos(a * 1.9) * .5 + .5) * H;
      const r = 26 + (i % 3) * 18, k = Math.sin(t * 1.6 + i) * 18;
      g.save(); g.translate(px, py + k); g.rotate(t * (i % 2 ? .6 : -.5) + i);
      g.globalAlpha = .9; g.lineWidth = 7; g.strokeStyle = C.ink;
      if (i % 3 === 0) { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); }
      else if (i % 3 === 1) { g.strokeRect(-r, -r, r * 2, r * 2); }
      else { g.beginPath(); for (let j = 0; j < 5; j++) { const an = j * 4 * Math.PI / 5 - Math.PI / 2; g[j ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); } g.closePath(); g.stroke(); }
      g.restore();
    }
  }
  function chip(g, s, x, y, fill, size = 38, align = 'center') {
    font(g, size, MONO, '700'); const w = g.measureText(s).width + 52, h = size + 34;
    const x0 = align === 'center' ? x - w / 2 : x;
    block(g, x0, y, w, h, fill, { r: h / 2, shadow: 8, lw: 5 });
    text(g, s, x0 + w / 2, y + h / 2 + size * .36, size, C.ink, { fam: MONO });
    return w;
  }
  function eyebrow(g, s, y, col = C.ink) { text(g, s.toUpperCase(), W / 2, y, 40, col, { fam: MONO }); }
  function countUp(v, p) { return v * ease(p); }
  function footer(g, st) {
    text(g, 'KHARCHA WRAPPED · ' + st.r.label.toUpperCase(), W / 2, H - 70, 30, 'rgba(0,0,0,.55)', { fam: MONO });
  }

  /* ---------------- the cards ---------------- */
  function cards(st) {
    const L = [];
    const R = st.r, name = (S.settings.name || '').trim();
    const what = R.kind === 'year' ? R.label : R.label;
    // 1. intro
    L.push({ dur: 4.2, fill: C.mint, draw(g, t) {
      bg(g, C.mint, t, 1);
      const words = ['YOUR', what.toUpperCase(), 'WRAPPED'], cols = [C.paper, C.volt, C.pink];
      words.forEach((w, i) => {
        const p = back(prog(t, .15 + i * .28, .55)), sz = fit(g, w, W - 140, i === 1 ? 210 : 190);
        withT(g, W / 2, 640 + i * 250, p, (1 - p) * (i % 2 ? .35 : -.35) + (i - 1) * -.04, () => stroked(g, w, 0, 0, sz, cols[i], { lw: 22 }));
      });
      const p = ease(prog(t, 1.2, .6));
      g.globalAlpha = p; chip(g, (R.partial ? R.sub : (R.kind === 'year' ? 'Your year' : 'Your month')) + (name ? ' · ' + name : ''), W / 2, 1360 + (1 - p) * 40, C.paper, 40); g.globalAlpha = 1;
      const b = ease(prog(t, 1.6, .5)); g.globalAlpha = b; text(g, 'tap to go on →', W / 2, 1600, 40, 'rgba(0,0,0,.6)', { fam: MONO }); g.globalAlpha = 1;
      footer(g, st);
    } });
    // 2. total
    const ch = st.prev ? (st.spent - st.prev) / st.prev : null;
    L.push({ dur: 5, fill: C.volt, draw(g, t) {
      bg(g, C.volt, t, 2);
      eyebrow(g, 'You spent', 470);
      const p = prog(t, .3, 1.6), v = M(countUp(st.spent, p)), sz = fit(g, v, W - 220, 230);
      const pb = back(prog(t, .15, .5));
      withT(g, W / 2, 700, pb, (1 - pb) * -.2, () => { block(g, -(W - 140) / 2, -190, W - 140, 330, C.paper); stroked(g, v, 0, sz * .36 - 25, sz, C.ink, { lw: 0 }); });
      const q = ease(prog(t, 1.4, .5));
      g.globalAlpha = q;
      text(g, `${st.tx.length} expenses · ${M(st.perDay)} a day`, W / 2, 1010 + (1 - q) * 30, 54, C.ink);
      g.globalAlpha = 1;
      if (ch !== null && isFinite(ch)) {
        const r2 = back(prog(t, 2.1, .5)), up = ch > 0;
        withT(g, W / 2, 1180, r2, (1 - r2) * .4 - .05, () => chip(g, `${up ? '▲' : '▼'} ${Math.abs(Math.round(ch * 100))}% vs ${R.kind === 'year' ? 'last year' : 'the month before'}`, 0, 0, up ? C.red : C.mint, 42));
        const s3 = ease(prog(t, 2.7, .5)); g.globalAlpha = s3;
        text(g, up ? (ch > .25 ? 'Big jump. Who are you now?' : 'A little more than before.') : (ch < -.25 ? 'Massive cut. Respect.' : 'Spent less than before. Nice.'), W / 2, 1400, 46, C.ink, { fam: BODY });
        g.globalAlpha = 1;
      }
      footer(g, st);
    } });
    // 3. top categories
    if (st.cats.length) L.push({ dur: 5.5, fill: C.bg, dark: true, draw(g, t) {
      bg(g, C.bg, t, 3); dots(g, 'rgba(255,255,255,.05)');
      const p0 = back(prog(t, .1, .5));
      withT(g, W / 2, 330, p0, (1 - p0) * -.3, () => stroked(g, 'WHERE IT WENT', 0, 0, 104, C.mint, { lw: 14 }));
      const top = st.cats.slice(0, 5), mx = top[0].v;
      top.forEach((x, i) => {
        const y = 480 + i * 240, a = prog(t, .45 + i * .22, .55), e = back(a);
        if (a <= 0) return;
        g.save(); g.translate((1 - e) * -W * .6, 0);
        block(g, 80, y, 150, 150, PAL[i % PAL.length], { r: 30, shadow: 10, lw: 6 });
        font(g, 84, 'sans-serif'); g.textAlign = 'center'; g.fillText(x.c.emoji || '✨', 155, y + 106);
        text(g, x.c.name, 270, y + 52, 48, C.paper, { align: 'left' });
        const bw = (W - 600) * (x.v / mx) * ease(prog(t, .6 + i * .22, .9));
        block(g, 270, y + 78, Math.max(40, bw), 58, PAL[i % PAL.length], { r: 29, shadow: 8, lw: 5 });
        text(g, M(x.v), 270 + Math.max(40, bw) + 26, y + 124, 40, C.paper, { align: 'left', fam: MONO });
        g.restore();
      });
      const s = ease(prog(t, 2.2, .5)), c0 = st.cats[0]; g.globalAlpha = s;
      text(g, `${Math.round(c0.share * 100)}% of everything went to ${c0.c.name}.`, W / 2, 1720, 44, C.mute, { fam: BODY });
      g.globalAlpha = 1;
      text(g, 'KHARCHA WRAPPED · ' + R.label.toUpperCase(), W / 2, H - 70, 30, 'rgba(255,255,255,.4)', { fam: MONO });
    } });
    // 4. biggest day
    if (st.big) L.push({ dur: 5, fill: C.pink, draw(g, t) {
      bg(g, C.pink, t, 4);
      eyebrow(g, 'Your biggest day', 430);
      const d = st.big.d, p = back(prog(t, .2, .6));
      withT(g, W / 2, 640, p, (1 - p) * .5, () => {
        stroked(g, d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase(), 0, -40, 120, C.paper, { lw: 16 });
        stroked(g, d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase(), 0, 130, 180, C.volt, { lw: 20 });
      });
      // the stamp
      const s = back(prog(t, 1.0, .45)), sz = fit(g, M(st.big.amt), 640, 150);
      withT(g, W / 2, 1060, s * (1 + (1 - ease(prog(t, 1.0, .25))) * .6), -.08, () => {
        block(g, -380, -130, 760, 240, C.paper, { r: 26 });
        stroked(g, M(st.big.amt), 0, sz * .36 - 8, sz, C.ink, { lw: 0 });
      });
      const q = ease(prog(t, 1.8, .5)); g.globalAlpha = q;
      text(g, `${st.big.n} expense${st.big.n > 1 ? 's' : ''} that day`, W / 2, 1320, 50, C.ink);
      if (st.bigTx) wrap(g, `Biggest one: ${st.bigTx.note ? '“' + String(st.bigTx.note).slice(0, 30) + '” ' : ''}${M(st.bigTx.amt)} on ${catById(st.bigTx.cat).name}`, W - 200, 42, BODY, '500')
        .forEach((l, i) => text(g, l, W / 2, 1410 + i * 56, 42, C.ink, { weight: '500' }));
      g.globalAlpha = 1;
      footer(g, st);
    } });
    // 5. streaks + calendar
    L.push({ dur: 5.5, fill: C.blue, draw(g, t) {
      bg(g, C.blue, t, 5);
      eyebrow(g, 'No-spend days', 380);
      const p = prog(t, .2, 1.2), n = Math.round(countUp(st.noSpend, p)), b = back(prog(t, .1, .5));
      withT(g, W / 2, 620, b, 0, () => stroked(g, String(n), 0, 0, 300, C.paper, { lw: 26 }));
      // calendar of the period: one square per day, darker = more spent
      const days = st.days.slice(-(R.kind === 'year' ? 366 : 42));
      const cols = R.kind === 'year' ? 21 : 7, rows = Math.ceil(days.length / cols);
      const gap = R.kind === 'year' ? 6 : 14;
      const cell = Math.min(R.kind === 'year' ? 40 : 104, Math.floor((W - 200) / cols) - gap, Math.floor(820 / Math.max(1, rows)) - gap);
      const gw = cols * (cell + gap) - gap, x0 = (W - gw) / 2, y0 = 760;
      const mx = Math.max(...days.map(x => x.amt), 1);
      days.forEach((x, i) => {
        const a = prog(t, .6 + i * (R.kind === 'year' ? .004 : .03), .35); if (a <= 0) return;
        const cx = x0 + (i % cols) * (cell + gap), cy = y0 + Math.floor(i / cols) * (cell + gap), e = back(a);
        g.save(); g.translate(cx + cell / 2, cy + cell / 2); g.scale(e, e);
        const fill = x.amt ? `rgba(22,20,26,${.25 + .75 * x.amt / mx})` : C.paper;
        g.fillStyle = fill; rr(g, -cell / 2, -cell / 2, cell, cell, cell * .22); g.fill();
        g.lineWidth = R.kind === 'year' ? 2.5 : 5; g.strokeStyle = C.ink; g.stroke();
        g.restore();
      });
      const yb = y0 + rows * (cell + gap) + 70, q = ease(prog(t, 1.8, .5)); g.globalAlpha = q;
      text(g, st.bestNoSpend >= 2 ? `Longest streak: ${st.bestNoSpend} days without spending` : 'White squares = no-spend days', W / 2, Math.min(yb, 1700), 44, C.ink);
      if (st.bestSpend >= 3) text(g, `Longest spending run: ${st.bestSpend} days in a row`, W / 2, Math.min(yb + 64, 1770), 38, C.ink, { weight: '500' });
      g.globalAlpha = 1;
      footer(g, st);
    } });
    // 6. year: the months
    if (R.kind === 'year' && st.months.some(m => m.v)) L.push({ dur: 5.5, fill: C.purple, draw(g, t) {
      bg(g, C.purple, t, 6);
      const top = st.months.reduce((a, b) => (b.v > a.v ? b : a));
      eyebrow(g, 'Your priciest month', 380);
      const p = back(prog(t, .2, .55));
      withT(g, W / 2, 560, p, (1 - p) * -.4, () => stroked(g, new Date(2000, top.m, 1).toLocaleDateString('en-IN', { month: 'long' }).toUpperCase(), 0, 0, fit(g, 'SEPTEMBER', W - 160, 170), C.paper, { lw: 18 }));
      text(g, M(top.v), W / 2, 680, 60, C.ink, { fam: MONO });
      const mx = top.v || 1, bw = 62, gap = (W - 160 - bw * 12) / 11;
      st.months.forEach((m, i) => {
        const h = 760 * (m.v / mx) * ease(prog(t, .7 + i * .07, .7)), x = 80 + i * (bw + gap), yb = 1620;
        if (h > 4) block(g, x, yb - h, bw, h, m === top ? C.volt : C.paper, { r: 14, shadow: 8, lw: 5 });
        text(g, 'JFMAMJJASOND'[i], x + bw / 2, yb + 70, 40, m.future ? 'rgba(0,0,0,.3)' : C.ink, { fam: MONO });
      });
      footer(g, st);
    } });
    // 7. fun stats
    const fun = [];
    if (st.topNote) fun.push(['🔁', 'On repeat', `“${st.topNote.label.slice(0, 18)}” × ${st.topNote.n}`]);
    if (st.favDay !== null) fun.push(['📅', 'Big spending day', DAYN[st.favDay] + 's']);
    if (st.night) fun.push(['🌙', 'Night owl', `${st.night} spend${st.night > 1 ? 's' : ''} after 10 pm`]);
    if (st.small) fun.push(['🪙', 'Smallest spend', `${M(st.small.amt)}${st.small.note ? ' · ' + String(st.small.note).slice(0, 14) : ''}`]);
    if (st.skipped) fun.push(['✋', 'Skipped buys', `${M(st.skipped)} not spent`]);
    if (fun.length >= 2) L.push({ dur: 5.5, fill: C.orange, draw(g, t) {
      bg(g, C.orange, t, 7);
      const p0 = back(prog(t, .1, .5));
      withT(g, W / 2, 360, p0, (1 - p0) * .3, () => stroked(g, 'FUN FACTS', 0, 0, 140, C.paper, { lw: 16 }));
      fun.slice(0, 4).forEach((f, i) => {
        const a = prog(t, .5 + i * .35, .55); if (a <= 0) return;
        const e = back(a), y = 500 + i * 300, rot = (i % 2 ? .025 : -.025);
        withT(g, W / 2, y + 120, e, rot + (1 - e) * (i % 2 ? .3 : -.3), () => {
          block(g, -440, -120, 880, 240, i % 2 ? C.paper : C.volt, { r: 30 });
          font(g, 96, 'sans-serif'); g.textAlign = 'center'; g.fillText(f[0], -330, 34);
          text(g, f[1].toUpperCase(), -240, -22, 34, 'rgba(0,0,0,.6)', { align: 'left', fam: MONO });
          const z = fit(g, f[2], 620, 56, BODY, '700');
          text(g, f[2], -240, 52, z, C.ink, { align: 'left' });
        });
      });
      footer(g, st);
    } });
    // 8. personality
    const pe = persona(st);
    L.push({ dur: 5, fill: C.lime, draw(g, t) {
      bg(g, C.lime, t, 8);
      eyebrow(g, 'Your spending personality', 420);
      const s = back(prog(t, .25, .7));
      withT(g, W / 2, 760, s, (1 - s) * Math.PI * 2, () => {
        block(g, -190, -190, 380, 380, C.paper, { r: 190, shadow: 16 });
        font(g, 230, 'sans-serif'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(pe[0], 0, 14); g.textBaseline = 'alphabetic';
      });
      const q = back(prog(t, 1.0, .55)), z = fit(g, pe[1].toUpperCase(), W - 140, 150);
      withT(g, W / 2, 1180, q, (1 - q) * -.2, () => stroked(g, pe[1].toUpperCase(), 0, 0, z, C.paper, { lw: 18 }));
      const r = ease(prog(t, 1.6, .5)); g.globalAlpha = r;
      wrap(g, pe[2], W - 220, 50).forEach((l, i) => text(g, l, W / 2, 1330 + i * 66, 50, C.ink));
      g.globalAlpha = 1;
      footer(g, st);
    } });
    // 9. outro
    L.push({ dur: 5, fill: C.bg, dark: true, outro: true, draw(g, t) {
      bg(g, C.bg, t, 9); dots(g, 'rgba(255,255,255,.05)');
      const p = back(prog(t, .1, .55));
      withT(g, W / 2, 470, p, (1 - p) * .3, () => {
        stroked(g, "THAT'S", 0, -60, 130, C.paper, { lw: 14 });
        stroked(g, 'A WRAP', 0, 110, 170, C.mint, { lw: 18 });
      });
      const rows = [['Spent', M(st.spent), C.volt], ['Expenses', String(st.tx.length), C.pink], ['No-spend days', String(st.noSpend), C.blue]];
      if (st.inc) rows.push(['Money in', M(st.inc), C.mint]); else if (st.saved) rows.push(['Saved first', M(st.saved), C.mint]);
      rows.forEach((x, i) => {
        const a = back(prog(t, .6 + i * .18, .5)); if (a <= 0) return;
        const y = 780 + i * 170;
        g.save(); g.translate(W / 2, y + 60); g.scale(a, a); g.translate(-W / 2, -(y + 60));
        block(g, 120, y, W - 240, 130, x[2], { r: 26, shadow: 10, lw: 6 });
        text(g, x[0], 170, y + 82, 46, C.ink, { align: 'left' });
        text(g, x[1], W - 170, y + 84, 54, C.ink, { align: 'right', fam: MONO });
        g.restore();
      });
      const q = ease(prog(t, 1.6, .5)); g.globalAlpha = q;
      stroked(g, 'KHARCHA', W / 2, 1600, 76, C.mint, { lw: 10 });
      text(g, 'log it in two taps · save before you spend', W / 2, 1670, 34, C.mute, { fam: MONO });
      g.globalAlpha = 1;
    } });
    return L;
  }

  /* ---------------- sound: a small, loud beat (WebAudio, no files) ---------------- */
  function beat(ac, dest, startAt, seconds) {
    const bpm = 124, sp = 60 / bpm, master = ac.createGain(); master.gain.value = .55; master.connect(dest);
    const noise = ac.createBuffer(1, ac.sampleRate * .2, ac.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const bass = [55, 55, 65.4, 49];
    const stop = [];
    for (let i = 0; i * sp < seconds; i++) {
      const t0 = startAt + i * sp;
      // kick on every beat
      const o = ac.createOscillator(), gk = ac.createGain();
      o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + .16);
      gk.gain.setValueAtTime(1, t0); gk.gain.exponentialRampToValueAtTime(.001, t0 + .3);
      o.connect(gk).connect(master); o.start(t0); o.stop(t0 + .32); stop.push(o);
      // off-beat hat
      const h = ac.createBufferSource(), hp = ac.createBiquadFilter(), gh = ac.createGain();
      h.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 7000;
      gh.gain.setValueAtTime(.35, t0 + sp / 2); gh.gain.exponentialRampToValueAtTime(.001, t0 + sp / 2 + .06);
      h.connect(hp).connect(gh).connect(master); h.start(t0 + sp / 2); h.stop(t0 + sp / 2 + .08); stop.push(h);
      // clap on 2 and 4
      if (i % 2 === 1) { const c = ac.createBufferSource(), bp = ac.createBiquadFilter(), gc = ac.createGain();
        c.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = 1500; gc.gain.setValueAtTime(.5, t0); gc.gain.exponentialRampToValueAtTime(.001, t0 + .14);
        c.connect(bp).connect(gc).connect(master); c.start(t0); c.stop(t0 + .16); stop.push(c); }
      // bass on the off-beats
      const b = ac.createOscillator(), gb = ac.createGain(), lp = ac.createBiquadFilter();
      b.type = 'sawtooth'; b.frequency.value = bass[Math.floor(i / 4) % 4]; lp.type = 'lowpass'; lp.frequency.value = 420;
      gb.gain.setValueAtTime(.0001, t0 + sp / 2); gb.gain.exponentialRampToValueAtTime(.28, t0 + sp / 2 + .02); gb.gain.exponentialRampToValueAtTime(.001, t0 + sp * .95);
      b.connect(lp).connect(gb).connect(master); b.start(t0 + sp / 2); b.stop(t0 + sp); stop.push(b);
    }
    return () => { stop.forEach(n => { try { n.stop(); } catch (e) {} }); try { master.disconnect(); } catch (e) {} };
  }

  /* ---------------- player ---------------- */
  let P = null;   // { st, L, i, t0, paused, raf, el, cv, g, ac, stopBeat, muted }
  async function fontsReady() {
    try { await Promise.all([`400 100px "Archivo Black"`, `700 40px "Space Grotesk"`, `700 40px "JetBrains Mono"`].map(f => document.fonts.load(f))); } catch (e) {}
  }

  async function play(r) {
    const st = stats(r);
    if (!st.tx.length) { toast('Nothing logged in ' + r.label + ' yet'); return; }
    await fontsReady();
    closeSheetIfOpen();
    const el = document.createElement('div'); el.className = 'kw'; el.innerHTML = `
      <div class="kw-stage"><canvas width="${W}" height="${H}"></canvas>
        <div class="kw-bars"></div>
        <div class="kw-top"><button class="kw-ic" data-kw="mute" aria-label="Sound">🔊</button><button class="kw-ic" data-kw="close" aria-label="Close">✕</button></div>
        <div class="kw-tap l" data-kw="prev"></div><div class="kw-tap r" data-kw="next"></div>
        <div class="kw-end"><button class="kw-btn" data-kw="reel">🎬 Save reel</button><button class="kw-btn" data-kw="imgs">🖼️ Save images</button><button class="kw-btn ghost" data-kw="again">↺ Replay</button></div>
        <div class="kw-busy"><div class="kw-busy-in"><b>Making your reel…</b><div class="kw-pb"><i></i></div><span>Keep Kharcha open. It records in real time.</span></div></div>
      </div>`;
    document.body.appendChild(el);
    const cv = el.querySelector('canvas');
    const L = cards(st);
    el.querySelector('.kw-bars').innerHTML = L.map(() => '<i><b></b></i>').join('');
    P = { st, L, i: 0, t0: performance.now(), paused: false, el, cv, g: cv.getContext('2d'), muted: !!S.settings.wrapMuted, holdT: 0 };
    el.querySelector('[data-kw=mute]').textContent = P.muted ? '🔇' : '🔊';
    requestAnimationFrame(() => el.classList.add('in'));
    startSound();
    loop();
    try { tick(12); } catch (e) {}
  }
  function closeSheetIfOpen() { const sh = $('#sheet'); if (sh && sh.classList.contains('show')) { const c = document.querySelector('#sheet [data-act=close]'); if (c) c.click(); } }

  function startSound() {
    stopSound();
    if (P.muted) return;
    try {
      P.ac = P.ac || new (window.AudioContext || window.webkitAudioContext)();
      P.ac.resume();
      const left = sum(P.L.slice(P.i).map(c => c.dur)) + 2;
      P.stopBeat = beat(P.ac, P.ac.destination, P.ac.currentTime + .05, left);
    } catch (e) {}
  }
  function stopSound() { if (P && P.stopBeat) { P.stopBeat(); P.stopBeat = null; } }

  function loop() {
    if (!P) return;
    const now = performance.now();
    if (P.paused) P.t0 = now - P.pt * 1000;
    let t = (now - P.t0) / 1000;
    const c = P.L[P.i];
    if (t >= c.dur && !c.outro) { go(P.i + 1); t = 0; }
    t = Math.min(t, P.L[P.i].dur);
    P.L[P.i].draw(P.g, t);
    P.pt = t;
    const bars = P.el.querySelectorAll('.kw-bars b');
    bars.forEach((b, k) => b.style.width = (k < P.i ? 100 : k > P.i ? 0 : Math.min(100, t / P.L[P.i].dur * 100)) + '%');
    P.el.classList.toggle('end', !!P.L[P.i].outro && t > 1.4);
    P.el.classList.toggle('dark', !!P.L[P.i].dark);
    P.raf = requestAnimationFrame(loop);
  }
  function go(i) {
    if (!P) return;
    P.i = clamp(i, 0, P.L.length - 1) | 0; P.t0 = performance.now(); P.pt = 0;
    P.el.classList.remove('flash'); void P.el.offsetWidth; P.el.classList.add('flash');
    try { tick(6); } catch (e) {}
  }
  function close() {
    if (!P) return;
    cancelAnimationFrame(P.raf); stopSound(); try { P.ac && P.ac.close(); } catch (e) {}
    const el = P.el; P = null; el.classList.remove('in'); setTimeout(() => el.remove(), 300);
  }

  /* ---------------- export ---------------- */
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  function b64(blob) { return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(blob); }); }
  async function saveBlob(blob, name, mime, dir) {
    if (typeof KN !== 'undefined' && KN && KN.saveMedia) return KN.saveMedia({ name, data: await b64(blob), mime, dir });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); return { where: 'Downloads' };
  }
  async function share(uris, mime) {
    if (typeof KN !== 'undefined' && KN && KN.shareMedia && uris.length) { try { await KN.shareMedia({ uris, mime }); } catch (e) {} }
  }

  async function saveImages() {
    if (!P) return;
    const { st, L } = P, off = document.createElement('canvas'); off.width = W; off.height = H;
    const g = off.getContext('2d'), uris = [], base = 'kharcha-wrapped-' + st.r.label.toLowerCase().replace(/\s+/g, '-') + '-' + stamp();
    toast('Saving ' + L.length + ' images…', 6000);
    try {
      for (let i = 0; i < L.length; i++) {
        L[i].draw(g, L[i].dur);   // the settled final frame of each card
        const blob = await new Promise(ok => off.toBlob(ok, 'image/png'));
        const r = await saveBlob(blob, `${base}-${String(i + 1).padStart(2, '0')}.png`, 'image/png', 'Pictures');
        if (r && r.uri) uris.push(r.uri);
      }
      toast(`Saved ${L.length} images to ${IS_APP ? 'Pictures/Kharcha' : 'Downloads'}`, 4200);
      share(uris, 'image/png');
    } catch (e) { toast('Could not save the images'); }
  }

  function recMime() {
    const opts = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return opts.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
  }
  async function saveReel() {
    if (!P || P.rec) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('This phone can\'t record video here. Save images instead.'); return; }
    const { st, L } = P, mime = recMime();
    const RW = 720, RH = 1280, off = document.createElement('canvas'); off.width = RW; off.height = RH;
    const g = off.getContext('2d');
    const stream = off.captureStream(30);
    let ac, stopB;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
      const dest = ac.createMediaStreamDestination(); stopB = beat(ac, dest, ac.currentTime + .1, sum(L.map(c => c.dur)) + 1);
      dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
    } catch (e) {}
    const rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: 6e6 }, mime ? { mimeType: mime } : {}));
    const chunks = []; rec.ondataavailable = e => e.data && e.data.size && chunks.push(e.data);
    P.rec = rec; P.paused = true; stopSound(); P.el.classList.add('busy');
    const pb = P.el.querySelector('.kw-pb i'), total = sum(L.map(c => c.dur));
    const done = new Promise(ok => rec.onstop = ok);
    rec.start(500);
    const t0 = performance.now();
    await new Promise(ok => {
      const step = () => {
        const t = (performance.now() - t0) / 1000;
        if (t >= total + .4 || !P) return ok();
        let k = 0, acc = 0; while (k < L.length - 1 && t >= acc + L[k].dur) { acc += L[k].dur; k++; }
        g.save(); g.scale(RW / W, RH / H); L[k].draw(g, Math.min(t - acc, L[k].dur)); g.restore();
        if (pb) pb.style.width = Math.min(100, t / total * 100) + '%';
        requestAnimationFrame(step);
      };
      step();
    });
    rec.stop(); await done;
    try { stopB && stopB(); ac && ac.close(); } catch (e) {}
    stream.getTracks().forEach(tr => tr.stop());
    if (!P) return;
    P.el.classList.remove('busy'); P.rec = null; P.paused = false;
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0], ext = type.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type });
    try {
      const r = await saveBlob(blob, `kharcha-wrapped-${st.r.label.toLowerCase().replace(/\s+/g, '-')}-${stamp()}.${ext}`, type, 'Movies');
      toast(`Reel saved to ${IS_APP ? 'Movies/Kharcha' : 'Downloads'} (${(blob.size / 1048576).toFixed(1)} MB)`, 4200);
      if (r && r.uri) share([r.uri], type);
    } catch (e) { toast('Could not save the reel'); }
    startSound();
  }

  /* ---------------- input ---------------- */
  document.addEventListener('pointerdown', e => {
    if (!P || !e.target.closest('.kw-tap')) return;
    P.holdT = performance.now(); P.paused = true; P.el.classList.add('held');
  });
  document.addEventListener('pointerup', () => { if (P && !P.rec) { P.paused = false; P.el.classList.remove('held'); } });
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-kw]');
    if (k && P) {
      e.preventDefault(); e.stopPropagation();
      const a = k.dataset.kw;
      if (P.rec && a !== 'close') return;
      const tapHeld = performance.now() - P.holdT > 260;
      if (a === 'next' && !tapHeld) { if (P.i < P.L.length - 1) go(P.i + 1); }
      else if (a === 'prev' && !tapHeld) { if (P.pt > 1.2 || P.i === 0) go(P.i); else go(P.i - 1); }
      else if (a === 'close') close();
      else if (a === 'mute') { P.muted = !P.muted; S.settings.wrapMuted = P.muted; save(); k.textContent = P.muted ? '🔇' : '🔊'; P.muted ? stopSound() : startSound(); }
      else if (a === 'again') { go(0); startSound(); }
      else if (a === 'imgs') saveImages();
      else if (a === 'reel') saveReel();
      return;
    }
    const b = e.target.closest('[data-act=wrapped],[data-act=kwgo]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.dataset.act === 'kwgo') { const r = ranges().find(x => x.id === b.dataset.r); if (r) play(r); return; }
    if (b.dataset.r) { const r = ranges().find(x => x.id === b.dataset.r); if (r) return play(r); }
    picker();
  }, true);
  document.addEventListener('keydown', e => {
    if (!P) return;
    if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(P.i + 1); else if (e.key === 'ArrowLeft') go(P.i - 1);
  });
  // phone back button closes the player first
  if (typeof IS_APP !== 'undefined' && IS_APP && window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) {
    try { Capacitor.Plugins.App.addListener('backButton', () => { if (P) close(); }); } catch (e) {}
  }

  function picker() {
    const rs = ranges();
    openSheet(`<div class="small muted" style="font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase">Kharcha Wrapped</div>
      <h3 style="font-size:30px;margin:2px 0 6px">Pick your recap</h3>
      <p class="small muted" style="margin:0 0 14px">Tap through the story, then save it as a reel or images to share.</p>
      <div class="kw-pick">${rs.map((r, i) => `<button class="kw-opt" data-act="kwgo" data-r="${r.id}" ${r.n ? '' : 'disabled'} style="--c:${PAL[i % PAL.length]}">
        <span class="kw-o1">${esc(r.label)}</span><span class="kw-o2">${esc(r.sub)} · ${r.n} expense${r.n === 1 ? '' : 's'}</span><span class="kw-o3">▶</span></button>`).join('')}</div>
      <div class="actions" style="grid-template-columns:1fr"><button class="btn" data-act="close">Not now</button></div>`);
  }

  /** Home card in the first week of a new period, when last month has something to show. */
  window.wrappedCard = function () {
    const cur = period(); if (Date.now() - +cur.start > 8 * DAY) return '';
    const r = ranges().find(x => x.id === 'last'); if (!r || r.n < 3) return '';
    return `<button class="card kw-home" data-act="wrapped" data-r="last"><span class="kw-h1">Your ${esc(r.label)} Wrapped</span><span class="kw-h2">Tap to play the story · ${r.n} expenses</span><span class="kw-h3">▶</span></button>`;
  };
  window.kharchaWrapped = { isOpen: () => !!P, close, ranges, stats, cards, play, picker, persona };
})();
