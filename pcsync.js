'use strict';
/* ---------- PC sync through Beam ----------
   Kharcha sends its data to Beam on your PC (Wi-Fi or Tailscale) and picks up expenses you typed on the PC.
   The PC shows a dashboard at <beam>/kharcha and keeps a dated backup every day.
   Loaded before the main script; runs only when called.

   S.settings.pc = { base: 'http://192.168.0.148:7788', key, alts: [...], last, err, pc }
   S.pcMerged    = ids of PC entries already added here (so a lost reply never doubles them) */

const pcCfg = () => S.settings.pc || null;
function parseBeamLink(txt) {
  const m = String(txt || '').trim().match(/https?:\/\/[^\s"'<>]+/);
  if (!m) return null;
  try {
    const u = new URL(m[0]), key = u.searchParams.get('k');
    if (!key) return null;
    return { base: u.protocol + '//' + u.host, key };
  } catch (e) { return null; }
}
async function pcCall(base, key, path, body) {
  const url = base + path, headers = { 'Content-Type': 'application/json', 'X-Beam-Key': key };
  const H = IS_APP && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;
  if (H) {   // native HTTP: no mixed-content block from the app's https://localhost page
    const r = await H.request({ url, method: 'POST', headers, data: body, connectTimeout: 4000, readTimeout: 15000 });
    if (r.status === 401) throw new Error('Beam refused the key. Copy the link from Beam again.');
    if (r.status !== 200) throw new Error('Beam answered ' + r.status);
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  }
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
    if (r.status === 401) throw new Error('Beam refused the key. Copy the link from Beam again.');
    if (!r.ok) throw new Error('Beam answered ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
let pcBusy = false, pcSoonT = 0;
function pcSyncSoon(ms = 4000) { if (pcCfg()) { clearTimeout(pcSoonT); pcSoonT = setTimeout(() => pcSync(false), ms); } }
async function pcSync(loud) {
  const c = pcCfg(); if (!c || pcBusy) return false;
  pcBusy = true;
  if (!Array.isArray(S.pcMerged)) S.pcMerged = [];
  const tries = [c.base, ...(c.alts || []).filter(b => b !== c.base)];
  let res = null, used = null, err = null;
  for (const b of tries) {
    try { res = await pcCall(b, c.key, '/api/kharcha/sync', { state: S, acked: S.pcMerged.slice(-200) }); used = b; break; }
    catch (e) { err = e; if (/key/.test(e.message)) break; }
  }
  pcBusy = false;
  if (!res) { c.err = (err && err.message) || 'PC not reachable'; c.errAt = Date.now(); saveQuiet(); if (loud) toast('Could not reach Beam on the PC: ' + c.err); if (tab === 'settings' && !draft) render(); return false; }
  c.base = used; c.last = Date.now(); c.err = ''; c.pc = res.pc || c.pc;
  if (Array.isArray(res.urls)) { const alts = res.urls.map(parseBeamLink).filter(Boolean).map(x => x.base); if (alts.length) c.alts = [...new Set(alts)]; }
  let n = 0;
  (res.inbox || []).forEach(x => {
    if (S.pcMerged.includes(x.id)) return;
    if (x.kind === 'inc') { if (!Array.isArray(S.inc)) S.inc = []; S.inc.push({ id: x.id, amt: x.amt, kind: x.cat || 'other', note: x.note || '', ts: x.ts }); }
    else S.tx.push({ id: x.id, amt: x.amt, cat: S.cats.some(k => k.id === x.cat) ? x.cat : 'other', note: x.note || '', mode: x.mode || 'UPI', ts: x.ts, src: 'pc' });
    S.pcMerged.push(x.id); n++;
  });
  if (S.pcMerged.length > 400) S.pcMerged = S.pcMerged.slice(-400);
  saveQuiet();
  if (n) { if (!draft) render(); toast(`${n} entr${n > 1 ? 'ies' : 'y'} added from your PC`); pcSyncSoon(800); }
  else if (loud) toast('Synced with ' + (c.pc || 'your PC'));
  if (tab === 'settings' && !draft) render();
  return true;
}
function saveQuiet() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function pcCard() {
  const c = pcCfg();
  if (!c) return `<h2>PC sync</h2><div class="card"><div class="row"><div class="emoji">🖥️</div><div class="grow"><div class="bold">See Kharcha on your PC</div>
    <div class="small muted">Through Beam on your PC, over Wi-Fi or Tailscale. Big dashboard, add expenses from the keyboard, a backup every day. Nothing goes to the internet.</div></div></div>
    <ol class="steps small"><li>On the PC, open Beam and press <b>Copy</b> under the QR code.</li><li>Get it here (Beam's Clipboard tab does it), then paste it below.</li></ol>
    <div class="field"><label>Beam link</label><input id="pc-link" placeholder="http://192.168.0.148:7788/?k=…" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    <button class="btn primary block" data-act="pcconnect">Connect</button></div>`;
  const ok = c.last && !c.err;
  return `<h2>PC sync</h2><div class="card"><div class="row"><div class="emoji">${ok ? '🖥️' : '⚠️'}</div><div class="grow"><div class="bold">${ok ? 'Synced with ' + esc(c.pc || 'your PC') : c.last ? 'PC not reachable right now' : 'Not synced yet'}</div>
    <div class="small muted ellipsis">${c.last ? 'Last sync ' + relDay(c.last) + ' ' + timeStr(c.last) : ''}${c.err ? (c.last ? ' · ' : '') + esc(c.err) : ''}</div>
    <div class="small muted ellipsis">${esc(c.base)}${(c.alts || []).length > 1 ? ' · ' + ((c.alts || []).length - 1) + ' backup address' + ((c.alts || []).length > 2 ? 'es' : '') : ''}</div></div></div>
    <div class="small muted" style="margin-top:10px">On the PC, open <b>${esc(c.base)}/kharcha</b> for the dashboard. Syncs when you open Kharcha and after you save.</div>
    <div class="two" style="margin-top:12px"><button class="btn" data-act="pcforget">Disconnect</button><button class="btn primary" data-act="pcnow">Sync now</button></div></div>`;
}
function pcClick(t) {
  const act = t.dataset.act;
  if (act === 'pcconnect') {
    const v = parseBeamLink($('#pc-link').value);
    if (!v) { toast('Paste the whole Beam link, the one with ?k= at the end'); return true; }
    S.settings.pc = { base: v.base, key: v.key, alts: [] }; save();
    toast('Connecting…'); pcSync(true).then(ok => { if (ok) confetti(); });
    render(); return true;
  }
  if (act === 'pcnow') { toast('Syncing…', 1200); pcSync(true); return true; }
  if (act === 'pcforget') { if (confirm('Stop syncing with the PC? The PC keeps its backups.')) { delete S.settings.pc; save(); render(); } return true; }
  return false;
}
