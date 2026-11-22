// Bill Buddy smoke test: add friends, split bills both ways, check balances, ask with a QR, settle up.
// Serve the folder first (npm start), then: node tests/buddy-smoke.cjs [screenshot-dir]
const { chromium } = require('playwright');
const shots = process.argv[2];
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.addInitScript(() => { if (!localStorage.getItem('kharcha.v1')) localStorage.setItem('kharcha.v1', JSON.stringify({ v: 1, created: Date.now(), settings: { name: 'Aditya', income: 40000, saveTarget: 8000, startDay: 1, currency: '₹', theme: 'dark', onboarded: true, catsV2: true, whatsNewSeen: '9', permLater: true }, tx: [], goals: [], saves: [] })); });
  await p.goto(process.env.KHARCHA_URL || 'http://127.0.0.1:8080/index.html');
  await p.waitForTimeout(600);
  const tap = sel => p.locator(sel).first().click({ timeout: 3000 });
  const shot = async n => { if (shots) await p.screenshot({ path: `${shots}/${n}.png` }); };
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('kharcha.v1')));
  const step = async (name, fn) => { try { await fn(); } catch (e) { errs.push(name + ': ' + e.message.split('\n')[0]); } };
  const expect = (cond, msg) => { if (!cond) errs.push('expect: ' + msg); };
  // close any startup sheet
  if (await p.locator('#sheet.show').count()) { await p.evaluate(() => closeSheet()); await p.waitForTimeout(300); }

  await step('open', async () => { await tap('nav [data-tab=goals]'); await tap('[data-gview=split]'); await p.waitForTimeout(300); await shot('1-empty'); });
  await step('friend', async () => { await tap('[data-act=bbfriendnew]'); await p.fill('#f-name', 'Rohan'); await p.fill('#f-upi', 'rohan@okicici'); await tap('[data-act=bbfriendsave]'); await p.waitForTimeout(300); await p.evaluate(() => closeSheet()); });
  await step('bill1', async () => {
    await tap('[data-act=bbnew]'); await p.waitForTimeout(300);
    await p.fill('#bb-title', 'Dinner at Toit'); await p.fill('#bb-amt', '1800');
    await tap('[data-bbp^=f]');                                  // Rohan in
    await tap('[data-act=bbaddf]'); await p.fill('#bb-fname', 'Priya'); await tap('[data-act=bbaddfsave]');
    await p.waitForTimeout(200); await shot('2-bill');
    await tap('[data-act=bbsave]'); await p.waitForTimeout(500);
  });
  await step('bill2', async () => {
    await tap('[data-act=bbnew]'); await p.waitForTimeout(300);
    await p.fill('#bb-title', 'Cab'); await p.fill('#bb-amt', '500');
    const rohan = await p.evaluate(() => S.friends.find(f => f.name === 'Rohan').id);
    await tap(`[data-bbp="${rohan}"]`); await tap(`[data-bbpay="${rohan}"]`);
    await tap('[data-bbmode=custom]'); await p.fill('[data-bbshare=me]', '300'); await p.fill(`[data-bbshare="${rohan}"]`, '200');
    await shot('3-custom');
    await tap('[data-act=bbsave]'); await p.waitForTimeout(500); await shot('4-list');
  });
  await step('balances', async () => {
    const s = await st(), r = s.friends.find(f => f.name === 'Rohan'), pr = s.friends.find(f => f.name === 'Priya');
    const bal = await p.evaluate(([a, b]) => [balanceOf(a), balanceOf(b)], [r.id, pr.id]);
    expect(bal[0] === 300, 'Rohan balance 600-300=300, got ' + bal[0]);
    expect(bal[1] === 600, 'Priya balance 600, got ' + bal[1]);
    expect(s.tx.filter(t => t.src === 'bill').map(t => t.amt).sort().join() === '300,600', 'my shares logged as expenses: ' + s.tx.map(t => t.amt));
  });
  await step('ask', async () => {
    const rid = await p.evaluate(() => S.friends.find(f => f.name === 'Rohan').id);
    await tap(`[data-act=bbfriend][data-id="${rid}"]`); await p.waitForTimeout(300); await shot('5-friend');
    await tap('[data-act=bbask]'); await p.waitForTimeout(200);
    await p.fill('#my-upi', 'aditya@okaxis'); await tap('[data-act=bbmyupisave]'); await p.waitForTimeout(400);
    expect(await p.locator('#sheet svg.qr').count() === 1, 'QR shown'); await shot('6-qr');
    const msg = await p.evaluate(() => askMessage(S.friends[0].id, 300));
    expect(/upi:\/\/pay\?pa=aditya%40okaxis&pn=Aditya&am=300\.00&cu=INR/.test(msg), 'UPI link in message: ' + msg);
    await tap('[data-act=bbgotpaid]'); await p.waitForTimeout(400);
  });
  await step('settled', async () => { const s = await st(); const v = await p.evaluate(id => balanceOf(id), s.friends[0].id); expect(v === 0, 'settled to 0, got ' + v); await p.evaluate(() => closeSheet()); });
  await step('home', async () => { await tap('nav [data-tab=home]'); await p.waitForTimeout(400); expect(await p.locator('[data-act=bbgo]').count() === 1, 'home owed card'); await shot('7-home'); });
  await step('fromadd', async () => {
    await tap('nav [data-act=add]'); await p.waitForTimeout(300); for (const k of '900') await tap(`[data-key="${k}"]`);
    await tap('[data-act=bbfromadd]'); await p.waitForTimeout(300);
    expect(await p.inputValue('#bb-amt') === '900', 'amount carried into bill form');
    await p.evaluate(() => closeSheet());
  });
  await step('light', async () => { await p.evaluate(() => { S.settings.theme = 'light'; goalsView = 'split'; go('goals'); }); await p.waitForTimeout(400); await shot('8-light'); });
  await b.close();
  if (errs.length) { console.error('FAIL\n' + errs.join('\n')); process.exit(1); }
  console.log('buddy smoke OK');
})();
