#!/usr/bin/env node
/* Check a model change against the CURRENT fixtures before regenerating them:
 * that the scenarios which moved are exactly the ones intended to move, and that
 * the tables changed in exactly the intended ways.
 *
 *   node tools/verify-additive.js
 *
 * Run BEFORE regenerating test/golden.json — afterwards the old expectations are
 * gone and the question can no longer be asked.
 *
 * Fill in the four EXPECTED_* blocks to describe THIS change only. Changes from
 * earlier commits are already in the fixtures; the commits that made them recorded
 * their own verification. An empty EXPECTED_MOVED means "purely additive".
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const M = require(path.join(ROOT, 'model.js'));
const golden = require(path.join(ROOT, 'test', 'golden.json'));
const scenarios = require(path.join(ROOT, 'test', 'scenarios.js'));
const { diff } = require(path.join(ROOT, 'test', 'compare.js'));

// ---- what this change is meant to do --------------------------------------
/* Scenarios whose results are SUPPOSED to move. Anything else that moves is a
   failure; anything listed here that does NOT move is also a failure, because a
   stale list quietly stops protecting the scenarios still on it. */
const EXPECTED_MOVED = ['dcut_none_wall_size', 'dcut_none_lifts_width', 'dcut_none_vs_through'];
const EXPECTED_ADDITIONS = { ROLES: ['opTrim'], PARAMS: ['trimHandleMin', 'trimIpm', 'opTrim'] };
const EXPECTED_REMOVALS = { PARAMS: ['trimMin'] };
const EXPECTED_EDITS = [];                       // "<table>.<key>.<field>"
const EXPECTED_DEF_ADDED = ['trimHandleMin', 'trimIpm', 'opTrim'];
const EXPECTED_DEF_REMOVED = ['trimMin'];

const j = (x) => JSON.parse(JSON.stringify(x));
let bad = 0;

// ---- 1. scenarios ----------------------------------------------------------
const moved = [], stayed = [], unexpected = [];
for (const sc of scenarios) {
  if (!golden.results[sc.id]) continue;            // new scenario, nothing to compare
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
  const d = diff(j(got), golden.results[sc.id], sc.id, []);
  if (d.length) { moved.push({ id: sc.id, d }); if (!EXPECTED_MOVED.includes(sc.id)) unexpected.push({ id: sc.id, d }); }
  else stayed.push(sc.id);
}

if (unexpected.length) {
  console.error(`✗ ${unexpected.length} scenario(s) moved that should not have:\n`);
  for (const u of unexpected) { console.error('  ' + u.id); u.d.slice(0, 4).forEach((x) => console.error('      ' + x)); }
  bad++;
} else {
  console.log(`✓ ${stayed.length} scenario(s) unchanged, as intended`);
}

const didNotMove = EXPECTED_MOVED.filter((id) => golden.results[id] && !moved.some((m) => m.id === id));
if (didNotMove.length) {
  console.error(`✗ listed as expected-to-move but did not move: ${didNotMove.join(', ')}`);
  console.error('  Either the change did not take effect, or the list is stale and is no longer protecting these.');
  bad++;
} else if (EXPECTED_MOVED.length) {
  console.log(`✓ ${moved.length} scenario(s) moved, exactly the ones intended:`);
  for (const m of moved) console.log(`    ${m.id} — ${m.d.length} field(s) differ`);
}

// ---- 2. tables -------------------------------------------------------------
const pd = golden.page_defaults;
const keyOf = (x) => x && (x.id || x.k);

for (const k of ['DEF', 'CREW', 'ROLES', 'MACH', 'FILMS', 'OLAMS', 'ADHS', 'RIGIDS', 'PARAMS']) {
  const now = j(M[k]), before = pd[k];
  if (!before) { console.log(`· ${k} not in fixtures, skipped`); continue; }

  if (!Array.isArray(now)) {                       // DEF is an object
    const a = Object.assign({}, now), b = Object.assign({}, before);
    for (const key of EXPECTED_DEF_ADDED) delete a[key];
    for (const key of EXPECTED_DEF_REMOVED) delete b[key];
    const d = diff(a, b, k, []);
    if (d.length) { console.error(`✗ ${k} changed beyond the intended keys:`); d.slice(0, 8).forEach((x) => console.error('    ' + x)); bad++; }
    else console.log(`✓ ${k}: ${Object.keys(before).length} → ${Object.keys(now).length} keys, only the intended additions and removals`);
    continue;
  }

  const added = EXPECTED_ADDITIONS[k] || [], removed = EXPECTED_REMOVALS[k] || [];
  const a = now.filter((x) => !added.includes(keyOf(x)));
  const b = before.filter((x) => !removed.includes(keyOf(x)));
  let d = diff(j(a), b, k, []);

  if (d.length && EXPECTED_EDITS.length) {         // allow only the listed field edits
    const allowed = new Set(EXPECTED_EDITS);
    d = d.filter((line) => {
      const m = line.match(/^(\w+)\[(\d+)\]\.(\w+):/);
      const key = m && b[+m[2]] && keyOf(b[+m[2]]);
      return !(m && key && allowed.has(`${m[1]}.${key}.${m[3]}`));
    });
  }

  if (d.length) {
    console.error(`✗ ${k} changed beyond what was intended:`);
    d.slice(0, 8).forEach((x) => console.error('    ' + x));
    bad++;
  } else if (added.length || removed.length) {
    const bits = [];
    if (added.length) bits.push('+' + added.join(', +'));
    if (removed.length) bits.push('−' + removed.join(', −'));
    console.log(`✓ ${k}: ${before.length} → ${now.length}, the only change being ${bits.join('  ')}`);
  } else {
    console.log(`✓ ${k} unchanged`);
  }
}

console.log('');
if (bad) { console.error('✗ this change did more than it was meant to — see above'); process.exit(1); }
console.log('✓ the change did exactly what it was meant to: intended scenarios moved, ' +
            'everything else untouched, tables differ only as declared');
