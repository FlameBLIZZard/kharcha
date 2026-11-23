// Smoke test for the Nov 2026 enhancement loop: quick picks, category drill-down, Insights month switcher,
// swipe to delete, chart tooltips, missed-subscription catch-up and the Bill Buddy breakdown.
// Serve the folder first (npm start), then: node tests/loop-smoke.cjs [screenshot-dir]
const { chromium } = require('playwright');
const shots = process.argv[2];
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = [], fail = m => errs.push(m);
  p.on('pageerror', e => fail('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') fail('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.addInitScript(() => {
    if (localStorage.getItem('kharcha.v1')) return;
    const D = 864e5, now = Date.now(), lm = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 12).getTime();
    const tx = [];
    for (let i = 0; i < 4; i++) tx.push({ id: 'c' + i, amt: 20, cat: 'food', note: 'Chai', mode: 'UPI', ts: now - i * D - 3600e3, src: 'manual' });
    tx.push({ id: 'm1', amt: 60, cat: 'travel', note: 'Metro', mode: 'UPI', ts: now - 2 * D, src: 'manual' }, { id: 'm2', amt: 60, cat: 'travel', note: 'Metro', mode: 'UPI', ts: now - 5 * D, src: 'manual' });
    tx.push({ id: 'old1', amt: 900, cat: 'shopping', note: 'Shoes', mode: 'UPI', ts: lm, src: 'manual' });
    const two = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).getTime();
    localStorage.setItem('kharcha.v1', JSON.stringify({ v: 1, created: two, settings: { name: 'Aditya', income: 40000, saveTarget: 8000, startDay: 1, currency: '₹', theme: 'dark', onboarded: true, catsV2: true, seenVersion: '1.2.0', wrapSeen: 'x', permLater: true, upi: 'aditya@okaxis' },
      tx, goals: [], saves: [], subs: [{ id: 's1', name: 'Netflix', amt: 199, day: 5, cat: 'subscriptions', last: 'never', since: two }],
      friends: [{ id: 'f1', name: 'Rohan', upi: '' }], bills: [{ id: 'b1', title: 'Dinner', amt: 900, ts: now - D, cat: 'food', payer: 'me', mode: 'equal', shares: { me: 450, f1: 450 } }], settles: [] }));
  });
  await p.goto(process.env.KHARCHA_URL || 'http://127.0.0.1:8080/index.html');
  await p.waitForTimeout(700);
  const tap = sel => p.locator(sel).first().click({ timeout: 3000 });
  const shot = async n => { if (shots) await p.screenshot({ path: `${shots}/${n}.png` }); };
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('kharcha.v1')));
  const step = async (name, fn) => { try { await fn(); } catch (e) { fail(name + ': ' + e.message.split('\n')[0]); } };

  await step('catch-up', async () => {
    const s = await st(), lm = new Date(); lm.setMonth(lm.getMonth() - 1);
    if (!s.tx.some(t => t.id === 's1-x' || t.id === 'sub-s1-' + lm.getFullYear() + '-' + (lm.getMonth() + 1))) fail('missed Netflix of last month was not logged');
  });
  await step('quick picks', async () => {
    await tap('nav [data-act=add]'); await p.waitForTimeout(500); await shot('quick');
    const n = await p.locator('#sheet [data-quick]').count(); if (n < 2) throw new Error('expected 2+ quick picks, got ' + n);
    await tap('#sheet [data-quick="0"]'); await p.waitForTimeout(200);
    const amt = await p.locator('#sheet .amount .val').innerText(); if (!amt.includes('20')) throw new Error('quick pick did not fill 20: ' + amt);
    const before = (await st()).tx.length; await tap('[data-act=savetx]'); await p.waitForTimeout(500);
    const s = await st(); if (s.tx.length !== before + 1 || s.tx[s.tx.length - 1].note !== 'Chai') throw new Error('quick pick save failed');
  });
  await step('category drill-down', async () => {
    await tap('#app [data-act=catgo][data-id=food]'); await p.waitForTimeout(500);
    const sel = await p.locator('.chip.sel').innerText(); if (!/Food/.test(sel)) throw new Error('history not filtered to Food: ' + sel);
    await shot('drill');
  });
  await step('insights months', async () => {
    await tap('[data-hview=insights]'); await p.waitForTimeout(400);
    const m0 = await p.locator('.mswitch .bold').innerText();
    await tap('[data-ins="1"]'); await p.waitForTimeout(400);
    const m1 = await p.locator('.mswitch .bold').innerText(); if (m0 === m1) throw new Error('month did not change');
    if (!(await p.locator('text=Shoes').count())) throw new Error('last month top spend missing');
    await shot('insights-last');
    await p.locator('.dbars .db').nth(11).click(); await p.waitForTimeout(200);
    if (!(await p.locator('.tipbub').count())) throw new Error('no bar tooltip');
    await tap('[data-ins="-1"]');
  });
  await step('swipe delete', async () => {
    await tap('[data-hview=list]'); await tap('[data-hist=all]'); await p.waitForTimeout(400);
    const row = p.locator('#app .list button.item[data-act=edit]').first(), id = await row.getAttribute('data-id'), bx = await row.boundingBox();
    const cdp = await ctx.newCDPSession(p), y = bx.y + bx.height / 2, pt = x => [{ x, y }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(bx.x + bx.width - 20) });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(bx.x + bx.width - 20 - i * 30) });
    await shot('swipe');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(600);
    if ((await st()).tx.some(t => t.id === id)) throw new Error('row not deleted by swipe');
    if (await p.locator('#sheet.show').count()) throw new Error('swipe also opened the edit sheet');
    await tap('[data-act=toastact]'); await p.waitForTimeout(300);
    if (!(await st()).tx.some(t => t.id === id)) throw new Error('undo did not restore');
  });
  await step('bill breakdown', async () => {
    await tap('[data-tab=goals]'); await tap('[data-gview=split]'); await p.waitForTimeout(300);
    await tap('[data-act=bbedit][data-id=b1]'); await p.waitForTimeout(400);
    const txt = await p.evaluate(() => billBreakdown(S.bills[0]));
    if (!/Dinner/.test(txt) || !/Rohan: ₹450/.test(txt) || !/aditya@okaxis/.test(txt)) throw new Error('bad breakdown: ' + txt);
    await p.evaluate(() => { bb = null; closeSheet(); }); await p.waitForTimeout(500);
  });
  await step('settle stamp', async () => {
    await tap('[data-act=bbfriend][data-id=f1]'); await p.waitForTimeout(300);
    await tap('[data-act=bbsettle]'); await p.waitForTimeout(300); await tap('[data-act=bbsetsave]'); await p.waitForTimeout(350);
    if (!(await p.locator('.stamp').count())) throw new Error('no Settled stamp'); await shot('stamp');
  });
  await b.close();
  console.log(errs.length ? errs.join('\n') : 'loop smoke OK');
  process.exit(errs.length ? 1 : 0);
})();
