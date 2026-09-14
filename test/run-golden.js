#!/usr/bin/env node
/* Golden test: model.js in node must reproduce test/golden.json exactly.
 *
 *   node test/run-golden.js
 *
 * golden.json was captured from index.html in a browser before any code moved, so
 * this is a real regression test and not the model grading its own homework.
 * Comparison is exact on every field.
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const M = require(path.join(ROOT, 'model.js'));
const golden = require(path.join(ROOT, 'test', 'golden.json'));
const scenarios = require(path.join(ROOT, 'test', 'scenarios.js'));
const { diff, report } = require(path.join(ROOT, 'test', 'compare.js'));

const diffs = [];
const j = (x) => JSON.parse(JSON.stringify(x)); // compare the stored form

// 1. the tables and defaults the model now owns
const pd = golden.page_defaults;
if (pd) {
  for (const k of ['DEF', 'CREW', 'ROLES', 'MACH', 'FILMS', 'OLAMS', 'ADHS', 'RIGIDS', 'PARAMS']) {
    diff(j(M[k]), pd[k], k, diffs);
  }
  diff(j(M.DEFAULT_STOCK), pd.default_stock, 'DEFAULT_STOCK', diffs);
}

// 2. every scenario
let ran = 0;
for (const sc of scenarios) {
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
    default:
      throw new Error('unknown call: ' + sc.call);
  }
  diff(j(got), golden.results[sc.id], sc.id, diffs);
  ran++;
}

const ok = report('model.js in node reproduces golden.json', diffs,
  `${ran} scenarios, ${pd ? Object.keys(pd.DEF).length : 0} parameter defaults, every rate table`);
if (!ok) process.exit(1);
console.log(`  golden captured from ${golden.source_file} sha256 ${golden.source_sha256.slice(0, 12)}…`);
console.log(`  model version ${M.MODEL_VERSION}`);
