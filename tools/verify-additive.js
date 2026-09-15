#!/usr/bin/env node
/* Prove a model change is additive: that no existing golden scenario moved, and
 * that the only table difference is the rows deliberately added.
 *
 *   node tools/verify-additive.js
 *
 * Run BEFORE regenerating test/golden.json. Once the fixtures are regenerated the
 * old expectations are gone and this can no longer be asked.
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const M = require(path.join(ROOT, 'model.js'));
const golden = require(path.join(ROOT, 'test', 'golden.json'));
const scenarios = require(path.join(ROOT, 'test', 'scenarios.js'));
const { diff } = require(path.join(ROOT, 'test', 'compare.js'));

const j = (x) => JSON.parse(JSON.stringify(x));
let bad = 0;

// 1. Every scenario the old fixtures knew about must produce byte-identical output.
const scenarioDiffs = [];
for (const sc of scenarios) {
  if (!golden.results[sc.id]) continue;          // new scenario, nothing to compare
  const ctx = M.createContext({ params: sc.params, stock: sc.stock, custom: sc.custom });
  let got;
  switch (sc.call) {
    case 'calcLine':
      got = M.calcLine(ctx, sc.lines[0], sc.qtyOverride == null ? null : sc.qtyOverride); break;
    case 'quote':
      got = M.quote(ctx, sc.lines, sc.qtyOverride == null ? null : sc.qtyOverride,
                    sc.margin == null ? null : sc.margin); break;
    case 'breaks':
      got = M.breakQuotes(ctx, sc.lines, sc.breaks); break;
    case 'betterQty':
      got = M.betterQty(ctx, sc.lines[0], sc.qtyOverride); break;
  }
  diff(j(got), golden.results[sc.id], sc.id, scenarioDiffs);
}
const compared = scenarios.filter((s) => golden.results[s.id]).length;
if (scenarioDiffs.length) {
  console.error(`✗ ${scenarioDiffs.length} existing scenario result(s) MOVED — this change is not additive\n`);
  for (const d of scenarioDiffs.slice(0, 30)) console.error('  ' + d);
  bad++;
} else {
  console.log(`✓ all ${compared} pre-existing scenarios produce byte-identical results`);
}

// 2. Table changes must be exactly the intended insertions and nothing else.
const pd = golden.page_defaults;
/* Describes THIS change only. Additions from earlier commits are already in the
   fixtures and are not re-proved here — the commit that made them recorded that. */
const EXPECTED_ADDITIONS = { PARAMS: ['trimMin'] };
/* Deliberate edits to existing rows, as "<table>.<key>.<field>". Anything not listed
   here that differs is a failure, so an accidental edit cannot hide behind these. */
const EXPECTED_EDITS = ['PARAMS.maxPrintW.l', 'PARAMS.maxPrintW.g'];
const EXPECTED_NEW_DEF_KEYS = ['trimMin'];

/* Once the fixtures have been regenerated they already contain the added rows, so
   the pre-change baseline no longer exists and additivity cannot be re-proved.
   Say that plainly rather than reporting a failure — a tool that cries wolf after
   its own window has closed gets ignored when it matters. */
const stale = Object.entries(EXPECTED_ADDITIONS).every(([k, ids]) =>
  Array.isArray(pd[k]) && ids.every((id) => pd[k].some((x) => x && x.id === id)));
if (stale) {
  console.log('\n  note: test/golden.json already contains ' +
    Object.entries(EXPECTED_ADDITIONS).map(([k, ids]) => ids.map((i) => k + '.' + i).join(', ')).join('; ') +
    ',\n  so the pre-change baseline is gone and additivity cannot be re-proved from here.');
  console.log('  Falling back to a plain equality check against the current fixtures.');
  console.log('  The additive result was recorded in the commit that made the change.\n');
}

for (const k of ['DEF', 'CREW', 'ROLES', 'MACH', 'FILMS', 'OLAMS', 'ADHS', 'RIGIDS', 'PARAMS']) {
  const now = j(M[k]), before = pd[k];
  let added = stale ? [] : (EXPECTED_ADDITIONS[k] || []);
  // Already in the fixtures? Then it landed in an earlier commit — compare plainly.
  if (added.length && Array.isArray(before) &&
      added.every((id) => before.some((x) => x && (x.id || x.k) === id))) added = [];
  if (!Array.isArray(now)) {                     // DEF is an object
    const pruned = Object.assign({}, now);
    if (!stale) for (const nk of EXPECTED_NEW_DEF_KEYS) delete pruned[nk];
    const d = diff(stale ? now : pruned, before, k, []);
    if (d.length) { console.error(`✗ ${k} changed unexpectedly:`); d.slice(0, 10).forEach((x) => console.error('    ' + x)); bad++; }
    else console.log(`✓ ${k} unchanged`);
    continue;
  }
  // Drop the deliberately added entries, then the remainder must match exactly.
  const trimmed = now.filter((x) => !added.includes(x && (x.id || x.k)));
  let d = diff(j(trimmed), before, k, []);
  if (!stale && d.length) {
    const allowed = new Set(EXPECTED_EDITS);
    const kept = [];
    for (const line of d) {
      // "PARAMS[2].l: expected ..." -> resolve the index back to that row's key
      const m = line.match(/^(\w+)\[(\d+)\]\.(\w+):/);
      const key = m && before[+m[2]] && (before[+m[2]].id || before[+m[2]].k);
      if (m && key && allowed.has(`${m[1]}.${key}.${m[3]}`)) continue;
      kept.push(line);
    }
    if (kept.length !== d.length) console.log(`  · ${k}: ${d.length - kept.length} deliberate edit(s) allowed (${EXPECTED_EDITS.join(', ')})`);
    d = kept;
  }
  if (d.length) {
    console.error(`✗ ${k} changed beyond the intended addition${added.length ? ' of ' + added.join(', ') : ''}:`);
    d.slice(0, 10).forEach((x) => console.error('    ' + x));
    bad++;
  } else if (added.length) {
    const rows = now.filter((x) => added.includes(x && (x.id || x.k)));
    console.log(`✓ ${k}: ${before.length} → ${now.length}, the only change being ` +
                rows.map((r) => `{${r.id ? 'id' : 'k'}:"${r.id || r.k}"}`).join(', '));
  } else {
    console.log(`✓ ${k} unchanged`);
  }
}

console.log('');
if (bad) { console.error('✗ ' + (stale ? 'model and fixtures disagree — see above'
                                       : 'change is NOT additive — see above')); process.exit(1); }
console.log(stale
  ? '✓ model matches the current fixtures (additivity itself was proved before they were regenerated)'
  : '✓ change is additive: existing behaviour untouched, tables differ only by the intended rows');
