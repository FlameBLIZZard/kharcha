// Drives a short tour of Kharcha 1.3 on the phone (for a screen recording). Leaves the data as it found it:
// the add sheet is closed without saving and the swiped expense is restored with Undo.
// adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>, then: node tests/phone-demo.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const p = b.contexts()[0].pages()[0], cdp = await p.context().newCDPSession(p);
  const wait = ms => p.waitForTimeout(ms), ev = f => p.evaluate(f);
  const tap = async (sel, ms = 900) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await l.click({ timeout: 4000 }); await wait(ms); };
  const scroll = async (dy, ms = 900) => { await ev(dy => window.scrollBy({ top: dy, behavior: 'smooth' }), dy); await wait(ms); };
  const log = m => console.log(new Date().toISOString().slice(11, 19), m);
  const before = await ev(() => S.tx.length);
  await ev(() => { closeSheet(); histView = 'list'; histFilter = 'all'; histCat = ''; goalsView = 'goals'; go('home'); }); await wait(1500);
  log('home'); await scroll(420, 1200); await scroll(500, 1200);
  log('tap a category'); await tap('#app [data-act=catgo]', 1800);
  log('insights'); await tap('[data-hview=insights]', 1500);
  const bars = p.locator('.dbars .db'); const n = await bars.count();
  for (const i of [Math.max(0, n - 18), Math.max(0, n - 12), Math.max(0, n - 9)]) { await bars.nth(i).click(); await wait(1100); }
  await scroll(500, 1300); await scroll(-2000, 900);
  log('add sheet'); await tap('nav [data-act=add]', 900);
  for (const k of ['1', '2', '0']) await tap(`[data-key="${k}"]`, 350);
  await tap('#sheet [data-cat]:nth-child(2)', 900); await tap('#sheet [data-cat]:nth-child(1)', 1200);
  await ev(() => closeSheet()); await wait(900);
  log('swipe to delete + undo');
  await tap('[data-hview=list]', 800); await ev(() => { histCat = ''; render(); }); await wait(700);
  const row = p.locator('#app .list button.item[data-act=edit]').first(), bx = await row.boundingBox(), y = bx.y + bx.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bx.x + bx.width - 20, y }] });
  for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bx.x + bx.width - 20 - i * 17, y }] }); await wait(28); }
  await wait(400); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(1500);
  await tap('[data-act=toastact]', 1500);
  log('bill buddy'); await tap('nav [data-tab=goals]', 1200); await tap('[data-gview=split]', 1800);
  log('whats new'); await tap('nav [data-tab=settings]', 900); await ev(() => whatsNew()); await wait(2600); await ev(() => closeSheet()); await wait(700);
  log('wrapped'); await ev(() => { go('home'); }); await wait(600);
  await ev(() => { const r = kharchaWrapped.ranges().find(x => x.n) ; kharchaWrapped.play(r); }); await wait(9000);
  await ev(() => kharchaWrapped.close()); await wait(1200);
  await ev(() => { histView = 'list'; go('home'); }); await wait(1200);
  const after = await ev(() => S.tx.length);
  console.log(after === before ? 'demo done, data unchanged (' + after + ' expenses)' : 'WARNING: expense count ' + before + ' -> ' + after);
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
