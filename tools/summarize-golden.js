#!/usr/bin/env node
/* Human-readable summary of test/golden.json, plus a check that each scenario
 * actually reached the branch it was written to cover. A fixture that silently
 * fails to hit its branch is worse than no fixture — it reads as coverage.
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const g = require(path.join(ROOT, 'test', 'golden.json'));
const scenarios = require(path.join(ROOT, 'test', 'scenarios.js'));

const money = (n) => (n == null ? '—' : '$' + n.toFixed(2));
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

// What each scenario was written to prove. Checked against the captured result.
const EXPECT = {
  con1_basic:            r => r.across === 10 && !r.error,
  con1_kiss_repeat:      r => r.ops.some(o => /kiss/.test(o.n)),
  con1_no_overlam:       r => !r.ops.some(o => /Overlaminate/.test(o.n)),
  con1_rotation:         r => r.rot === true && r.across === 14,
  staircase_100:         r => r.rows === 10,
  staircase_101:         r => r.rows === 11,
  info_low_yield:        r => r.yld < 0.45 && r.info.length > 0,
  info_wide_over_nest:   r => r.info.some(i => /full roll width/.test(i)),
  warn_multipass_overlam:r => r.warn.some(w => /passes/.test(w)),
  roll_magnet_50ft:      r => r.film.lenFt === 50,
  con2_rigid_split:      r => r.splitK === 2 && r.ops.some(o => /Pre-cut/.test(o.n)),
  con2_styrene_split3:   r => r.splitK === 3,
  con2_fits_bed:         r => r.splitK === 1 && !r.ops.some(o => /Pre-cut/.test(o.n)),
  con3_backed:           r => r.backed === true && r.ops.some(o => /Backer/.test(o.n)),
  err_too_wide:          r => !!r.error,
  err_sheet_too_small:   r => !!r.error && /sheet/.test(r.error),
  empty_line:            r => r.empty === true,
  coverage_and_speed:    r => !r.error,
  param_util_300:        r => !r.error,
  param_margin_burden:   r => !r.error,
  custom_roll_film:      r => r.mats.some(m => m.src === 'usr'),
  custom_sheet_rigid:    r => r.mats.some(m => m.src === 'usr'),
  quote_multiline:       r => r.good.length === 3 && r.shipC > 0,
  quote_margin_50:       r => Math.abs(r.mg - 50) < 1e-9,
  breaks_default:        r => Array.isArray(r) && r.length === 4,
  betterqty_95:          r => r && r.qty === 100,
  // the no-substrate path, added with MODEL_VERSION 1.1.0
  con2_no_substrate:     r => r.rig === null && r.sheets === 0 && r.splitK === 1
                              && !r.ops.some(o => /Mount to substrate|Pre-cut/.test(o.n))
                              && !r.mats.some(m => /sheet/.test(m.q)),
  con3_no_substrate:     r => r.rig === null && r.backed === true
                              && r.ops.some(o => /Backer/.test(o.n))
                              && !r.ops.some(o => /Mount to substrate/.test(o.n)),
  con2_none_big_part:    r => !r.error && r.rig === null,
  quote_no_substrate_multiline:
                         r => r.good.length === 3 && r.shipC > 0
                              && r.good.every(g => !g.two || g.rig === null),
};

console.log('\nGolden fixtures — captured ' + g.captured_at);
console.log('from ' + g.source_file + ' sha256 ' + g.source_sha256.slice(0, 12) + '…\n');

// ---- per-line scenarios ----
console.log(pad('scenario', 24) + lpad('acr', 4) + lpad('rows', 5) + lpad('runFt', 8) +
            lpad('yld%', 6) + lpad('sh', 4) + lpad('spl', 4) +
            lpad('material', 11) + lpad('conv', 10) + lpad('base', 11) + lpad('unit', 9));
console.log('-'.repeat(96));
for (const sc of scenarios) {
  if (sc.call !== 'calcLine') continue;
  const r = g.results[sc.id];
  if (r.error) { console.log(pad(sc.id, 24) + '  ERROR  ' + r.error.slice(0, 60)); continue; }
  if (r.empty) { console.log(pad(sc.id, 24) + '  (empty line)'); continue; }
  console.log(
    pad(sc.id, 24) +
    lpad(r.across, 4) + lpad(r.rows, 5) + lpad(r.runFt.toFixed(2), 8) +
    lpad((r.yld * 100).toFixed(1), 6) + lpad(r.sheets || '—', 4) + lpad(r.splitK, 4) +
    lpad(money(r.matTotal), 11) + lpad(money(r.conv), 10) +
    lpad(money(r.base), 11) + lpad(money(r.base / r.qty), 9)
  );
}

// ---- quote-level scenarios ----
console.log('\n' + pad('quote scenario', 24) + lpad('lines', 6) + lpad('pcs', 6) +
            lpad('mat', 11) + lpad('conv', 11) + lpad('cost', 11) + lpad('price', 11) + lpad('margin', 8));
console.log('-'.repeat(84));
for (const sc of scenarios) {
  if (sc.call !== 'quote') continue;
  const r = g.results[sc.id];
  console.log(pad(sc.id, 24) + lpad(r.good.length, 6) + lpad(r.pcsReal, 6) +
    lpad(money(r.mat), 11) + lpad(money(r.conv), 11) + lpad(money(r.total), 11) +
    lpad(money(r.price), 11) + lpad(r.mg + '%', 8));
}

// ---- breaks ----
const br = g.results.breaks_default;
if (br) {
  console.log('\nbreaks_default — each quantity is a full independent re-run');
  console.log(lpad('qty', 8) + lpad('cost', 12) + lpad('price', 12) + lpad('unit price', 13));
  console.log('-'.repeat(45));
  for (const row of br) {
    console.log(lpad(row.b.qty, 8) + lpad(money(row.q.total), 12) +
      lpad(money(row.q.price), 12) + lpad(money(row.q.price / row.q.pcsReal), 13));
  }
}

// ---- betterQty ----
const bq = g.results.betterqty_95;
console.log('\nbetterqty_95 → ' + (bq ? `suggest ${bq.qty} at ${money(bq.unit)}/pc (${bq.save.toFixed(1)}% better)` : 'no suggestion'));

// ---- the staircase, stated plainly ----
const a = g.results.staircase_100, b = g.results.staircase_101;
const ua = a.base / a.qty, ub = b.base / b.qty;
console.log('\nstaircase check — 100 pc @ ' + money(ua) + '/pc vs 101 pc @ ' + money(ub) + '/pc' +
  (ub > ua ? '  ✓ steps UP as expected' : '  ✗ DID NOT STEP UP'));

// ---- branch checks ----
let bad = 0;
const missing = [];
for (const sc of scenarios) {
  const fn = EXPECT[sc.id];
  if (!fn) { missing.push(sc.id); continue; }
  let ok = false;
  try { ok = !!fn(g.results[sc.id]); } catch (e) { ok = false; }
  if (!ok) { bad++; console.log('  ✗ ' + sc.id + ' did not reach its intended branch'); }
}
if (missing.length) console.log('  ! no branch check written for: ' + missing.join(', '));
const checked = scenarios.length - missing.length;
console.log('\n' + (bad === 0 ? '✓ ' + checked + ' of ' + scenarios.length +
  ' scenarios reached their intended branch' + (missing.length ? ' (' + missing.length + ' unchecked — see above)' : '') :
  '✗ ' + bad + ' scenario(s) missed their branch'));
