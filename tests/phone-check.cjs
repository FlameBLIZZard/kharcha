// On-phone check: drives the installed debug build through its WebView over adb + CDP.
// adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>, then: node tests/phone-check.cjs
// It never saves anything: sheets are opened and closed, a swiped row springs back.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const p = b.contexts()[0].pages()[0];
  const errs = [], fail = m => errs.push(m), info = {};
  p.on('pageerror', e => fail('pageerror: ' + e.message));
  const step = async (name, fn) => { try { await fn(); } catch (e) { fail(name + ': ' + e.message.split('\n')[0]); } };
  const ev = f => p.evaluate(f);
  const snap = () => ev(() => JSON.stringify({ ...S, settings: { ...S.settings, pc: null } }));   // PC sync stamps its own time
  const before = await snap();
  await step('version', async () => { Object.assign(info, await ev(() => ({ version: VERSION, app: appInfo, tx: S.tx.length, onboarded: S.settings.onboarded, lock: !!S.settings.lock }))); if (info.version !== '1.3.0') fail('version ' + info.version); });
  await step('home', async () => { await ev(() => { closeSheet(); go('home'); }); await p.waitForTimeout(800);
    info.catRows = await p.locator('#app [data-act=catgo]').count(); info.tips = await p.locator('#app .week [data-tip]').count(); });
  await step('quick picks', async () => { await ev(() => openAdd()); await p.waitForTimeout(600); info.picks = await ev(() => (draft.picks || []).map(q => q.note + ' ' + q.amt));
    if (info.picks.length) { await p.locator('#sheet [data-quick="0"]').click(); await p.waitForTimeout(300); info.pickFilled = await p.locator('#sheet .amount .val').innerText(); }
    await ev(() => closeSheet()); await p.waitForTimeout(400); });
  await step('insights', async () => { await ev(() => { histView = 'insights'; insOff = 0; go('history'); }); await p.waitForTimeout(600);
    info.month = await p.locator('.mswitch .bold').innerText(); info.months = await ev(() => insMonths());
    await p.locator('.dbars .db.today').dispatchEvent('click'); await p.waitForTimeout(200); info.tip = await p.locator('.tipbub').innerText(); });
  await step('wrapped', async () => { info.wrapped = await ev(() => !!(window.kharchaWrapped && kharchaWrapped.ranges && kharchaWrapped.ranges().length)); });
  await step('buddy', async () => { await ev(() => { goalsView = 'split'; go('goals'); }); await p.waitForTimeout(500); info.buddyHero = await p.locator('.bbhero .big').innerText(); });
  await ev(() => { histView = 'list'; goalsView = 'goals'; go('home'); });
  const after = await snap();
  if (before !== after) fail('data changed during a read-only check');
  console.log(JSON.stringify(info, null, 1));
  console.log(errs.length ? errs.join('\n') : 'phone check OK');
  await b.close();
})();
