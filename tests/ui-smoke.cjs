// UI smoke test: drives Kharcha in a phone-sized headless browser and fails on any page error.
// Needs Playwright. Serve the folder first (npm start), then: node tests/ui-smoke.cjs [native]
const { chromium } = require('playwright');
const native = process.argv[2] === 'native';
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  if (native) await p.addInitScript(() => {
    const calls = window.__calls = [];
    const ok = (name, ret) => (...a) => { calls.push([name, a]); return Promise.resolve(ret); };
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      App: { addListener() {}, getLaunchUrl: () => Promise.resolve(null), exitApp() {} },
      KharchaNative: new Proxy({}, { get: (t, k) => ({ drain: ok('drain', { items: [{ id: 'n1', amt: 99, cat: 'food', note: 'Swiggy', ts: Date.now() }] }),
        status: ok('status', { listener: true, notifications: true, overlay: false }), lockAvailable: ok('lockAvailable', { available: true }),
        appInfo: ok('appInfo', { versionName: '1.99 (test)' }), saveText: ok('saveText', { where: 'Downloads/Kharcha' }) }[k] || ok(String(k), {})) }) } };
  });
  await p.goto(process.env.KHARCHA_URL || 'http://127.0.0.1:8080/index.html');
  const step = async (name, fn) => { try { await fn(); } catch (e) { errs.push(name + ': ' + e.message.split('\n')[0]); } };
  const tap = sel => p.locator(sel).first().click({ timeout: 3000 });
  await step('onb', async () => {
    await p.fill('#o-name', 'Aditya'); await tap('[data-onb=next]');
    await p.fill('#o-income', '40000'); await tap('[data-pct="30"]'); await tap('[data-onb=next]');
    await tap('[data-goalpick^="✈"]'); await p.fill('#o-goalt', '25000'); await tap('[data-onb=finish]');
  });
  await p.waitForTimeout(800);
  if (native) await step('perms', async () => { if (await p.locator('[data-act=permlater]').count()) await tap('[data-act=permlater]'); });
  const addTx = async (keys, cat, note) => {
    await tap('nav [data-act=add]'); await p.waitForTimeout(400);
    for (const k of keys) await tap(`[data-key="${k}"]`);
    if (cat) await tap(`#sheet [data-cat="${cat}"]`);
    if (note) await p.fill('#note', note);
    await tap('[data-act=savetx]'); await p.waitForTimeout(500);
  };
  await step('add1', () => addTx('250', 'food', 'Zomato'));
  await step('add2', () => addTx('1299', 'shopping', 'Amazon'));
  await step('add3', () => addTx('12.5', 'petrol', ''));
  await step('add-zero', async () => { await tap('nav [data-act=add]'); await p.waitForTimeout(300); await tap('[data-act=savetx]'); await p.keyboard.press('Escape'); await p.waitForTimeout(400); });
  await step('received', async () => { await tap('nav [data-act=add]'); await p.waitForTimeout(300); await tap('[data-dir=in]'); for (const k of '500') await tap(`[data-key="${k}"]`); await tap('#sheet [data-cat=refund]'); await tap('[data-act=savetx]'); await p.waitForTimeout(400); });
  await step('split', async () => { await tap('nav [data-act=add]'); await p.waitForTimeout(300); for (const k of '900') await tap(`[data-key="${k}"]`); await tap('[data-act=splitcycle]'); await tap('[data-act=splitcycle]'); await tap('#sheet [data-cat=food]'); await tap('[data-act=savetx]'); await p.waitForTimeout(400); });
  await step('skip', async () => { await tap('nav [data-act=add]'); await p.waitForTimeout(300); for (const k of '300') await tap(`[data-key="${k}"]`); await tap('[data-act=skip]'); await p.waitForTimeout(600); });
  await step('undo', async () => { await addTx('77', 'food', 'undo me'); await tap('#toast [data-act=toastact]'); await p.waitForTimeout(300); });
  await step('edit', async () => { await tap('#app [data-act=edit]'); await p.waitForTimeout(300); await tap('[data-key="⌫"]'); await tap('[data-act=savetx]'); await p.waitForTimeout(300); });
  await step('history', async () => { await tap('nav [data-tab=history]'); await p.fill('#histq', 'zom'); await p.fill('#histq', ''); await tap('[data-hist=month]'); await tap('[data-hcat=food]'); await tap('[data-hcat=""]'); await tap('[data-hview=insights]'); await p.waitForTimeout(300); await tap('[data-hview=list]'); await tap('[data-hist=in]'); });
  await step('goals', async () => { await tap('nav [data-tab=goals]'); await tap('[data-act=deposit]'); await p.fill('#d-amt', '7000'); await tap('[data-act=depositsave]'); await p.waitForTimeout(1200);
    await tap('[data-gview=split]'); await tap('[data-act=iounew]'); await p.fill('#i-who', 'Rohan'); await p.fill('#i-amt', '200'); await tap('[data-act=iousave]'); await tap('[data-act=iousettle]'); });
  await step('settings', async () => { await tap('nav [data-tab=settings]'); await tap('[data-act=subnew]'); await p.fill('#s-name', 'Netflix'); await p.fill('#s-amt', '199'); await tap('[data-act=subsave]');
    await tap('[data-act=catnew]'); await p.fill('#c-name', 'Gym'); await tap('[data-act=catsave]'); await tap('[data-act=catup]');
    await tap('[data-act=cashnew]'); await p.fill('#k-amt', '2000'); await tap('[data-act=cashsave]');
    await tap('[data-theme-btn=light]'); await tap('[data-theme-btn=dark]'); await tap('[data-act=whatsnew]'); await p.waitForTimeout(300); await tap('#sheet [data-act=close]'); await p.waitForTimeout(300);
    if (native) { await tap('[data-tog=notifWeekly]'); await tap('[data-tog=lock]'); }
  });
  await step('deeplink', async () => { await p.evaluate(() => { location.hash = '#add?text=' + encodeURIComponent('Rs.180 debited from A/c XX12 to VPA swiggy@icici'); }); await p.waitForTimeout(500); await tap('#sheet [data-cat=food]'); await p.waitForTimeout(400); });
  
  await tap('nav [data-tab=home]').catch(() => {}); await p.waitForTimeout(900);
  
  const st = await p.evaluate(() => ({ tx: S.tx.length, inc: S.inc.length, saves: S.saves.length, ious: S.ious.length, subs: S.subs.length, cats: S.cats.length, calls: (window.__calls || []).map(c => c[0]).join(',') }));
  console.log(JSON.stringify(st));
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
  process.exitCode = errs.length ? 1 : 0;
})();
