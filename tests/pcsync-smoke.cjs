// PC sync smoke test against a fake Beam: connect with a pasted link, push data, merge a PC-added expense once,
// ack it, fall back to a second address when the first is down. Run: node tests/pcsync-smoke.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await (await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true })).newPage();
  const errs = [], calls = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('dialog', d => d.accept());
  let inbox = [{ id: 'pc1', kind: 'tx', amt: 240, cat: 'food', note: 'Chai from PC', ts: Date.now() }], down = 'a.test';
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  await p.route(u => u.hostname.endsWith('.test'), async r => {
    const u = new URL(r.request().url());
    if (u.hostname === 'app.test') {   // serve the app itself from an http origin
      const f = path.join(root, u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }[path.extname(f)] || 'application/octet-stream';
      return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: type, body: fs.readFileSync(f) }) : r.fulfill({ status: 404, body: '' });
    }
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
    if (u.hostname === down) return r.abort();
    const body = JSON.parse(r.request().postData() || '{}');
    calls.push({ host: u.hostname, key: r.request().headers()['x-beam-key'], acked: body.acked, tx: body.state && body.state.tx.length });
    inbox = inbox.filter(x => !(body.acked || []).includes(x.id));
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ saved: true, inbox, pc: 'TEST-PC', urls: ['http://a.test:7788/?k=K1', 'http://b.test:7788/?k=K1'] }) });
  });
  await p.addInitScript(() => { if (!localStorage.getItem('kharcha.v1')) localStorage.setItem('kharcha.v1', JSON.stringify({ v: 1, created: Date.now(), settings: { name: 'A', income: 40000, saveTarget: 0, startDay: 1, currency: '₹', theme: 'dark', onboarded: true, catsV2: true, permLater: true }, tx: [], goals: [], saves: [] })); });
  await p.goto('http://app.test/index.html');
  await p.waitForTimeout(500);
  await p.evaluate(() => closeSheet());
  const expect = (c, m) => { if (!c) errs.push('expect: ' + m); };
  await p.locator('nav [data-tab=settings]').click();
  await p.fill('#pc-link', 'here you go http://b.test:7788/?k=K1');
  await p.locator('[data-act=pcconnect]').click();
  await p.waitForTimeout(1500);
  let s = await p.evaluate(() => S);
  expect(s.tx.filter(t => t.id === 'pc1').length === 1, 'PC expense merged once');
  expect(calls[0] && calls[0].key === 'K1', 'key header sent');
  await p.evaluate(() => pcSync(true)); await p.waitForTimeout(300);
  s = await p.evaluate(() => S);
  expect(s.tx.filter(t => t.id === 'pc1').length === 1, 'still once after resync');
  expect(calls.some(c => (c.acked || []).includes('pc1')), 'acked to the PC');
  // first address down: falls back to the other one
  await p.evaluate(() => { S.settings.pc.base = 'http://a.test:7788'; });
  down = 'a.test';
  const ok = await p.evaluate(() => pcSync(false));
  s = await p.evaluate(() => S.settings.pc);
  expect(ok && s.base === 'http://b.test:7788', 'fell back to the working address: ' + s.base);
  expect(await p.locator('#app >> text=Synced with TEST-PC').count() === 1, 'settings card shows synced');
  await b.close();
  if (errs.length) { console.error('FAIL\n' + errs.join('\n')); process.exit(1); }
  console.log('pcsync smoke OK');
})();
