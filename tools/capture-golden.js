#!/usr/bin/env node
/* Golden fixtures, captured from index.html running in a real browser.
 *
 *   node tools/capture-golden.js          write test/golden.json
 *   node tools/capture-golden.js --check  capture and compare, write nothing
 *
 * The fixtures were captured from the single-file build BEFORE the model was
 * extracted. --check re-captures from the page as it stands now and diffs, which
 * is what proves the extraction changed nothing Melissa would see: the node test
 * proves model.js is right, this proves the page still uses it the same way.
 *
 * Nothing here reimplements the model. If a capture and the model ever disagree,
 * the capture is right by definition — that is what makes it a golden fixture.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'test', 'golden.json');
const scenarios = require(path.join(ROOT, 'test', 'scenarios.js'));
const { diff, report } = require(path.join(ROOT, 'test', 'compare.js'));
const CHECK = process.argv.includes('--check');

(async () => {
  const html = fs.readFileSync(SRC);
  const sha = crypto.createHash('sha256').update(html).digest('hex');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('file://' + SRC);
  await page.waitForFunction(() => typeof calcLine === 'function' && typeof quote === 'function');

  // Pin every table and default the model owns. The line fixtures exercise most
  // parameters but not all of them — this catches a transcription slip in one
  // that no scenario happens to touch.
  const page_defaults = await page.evaluate(() => ({
    DEF, CREW, ROLES, MACH, FILMS, OLAMS, ADHS, RIGIDS,
    PARAM_KEYS: PARAMS.map(p => p.k),
    PARAMS,
    // The page's own starting stock, not retyped here. Fresh context, so
    // localStorage is empty and this is the shipped default.
    default_stock: Q.stock,
  }));

  const results = {};
  for (const sc of scenarios) {
    results[sc.id] = await page.evaluate((sc) => {
      P = Object.assign({}, DEF, sc.params || {});
      CUSTOM = (sc.custom || []).slice();
      Q = {
        cust: { co: '', contact: '', quote: '', date: '2026-09-14', job: '' },
        stock: Object.assign(
          { film2: '3m50t', adh2: '9505_24', rig2: 'acr15', back2: 'o651w',
            film1: 'ij35c54', olam1: '8519_54', mode: 140, cov: 0.75 },
          sc.stock || {}
        ),
        lines: sc.lines,
        breaksOn: !!sc.breaks,
        breaks: sc.breaks || [{ qty: 25, margin: null }, { qty: 50, margin: null },
                              { qty: 100, margin: null }, { qty: 250, margin: null }],
      };
      switch (sc.call) {
        case 'calcLine':  return calcLine(Q.lines[0], sc.qtyOverride == null ? null : sc.qtyOverride);
        case 'quote':     return quote(sc.qtyOverride == null ? null : sc.qtyOverride,
                                       sc.margin == null ? null : sc.margin);
        case 'breaks':    return breakQuotes();
        case 'betterQty': return betterQty(Q.lines[0], sc.qtyOverride);
        default: throw new Error('unknown call: ' + sc.call);
      }
    }, sc);
  }

  await browser.close();

  if (pageErrors.length) {
    console.error('Page errors during capture:\n' + pageErrors.join('\n'));
    process.exit(1);
  }

  if (CHECK) {
    const golden = require(OUT);
    const diffs = [];
    // golden.json is the JSON form, so compare JSON forms. Without this, a key
    // whose value is undefined (a custom material has no vendor) reads as a
    // difference purely because JSON.stringify dropped it when the file was written.
    const j = (x) => JSON.parse(JSON.stringify(x));
    diff(j(page_defaults), golden.page_defaults, 'page_defaults', diffs);
    for (const sc of scenarios) diff(j(results[sc.id]), golden.results[sc.id], sc.id, diffs);
    const ok = report(
      'the page in a browser still reproduces golden.json',
      diffs,
      `${scenarios.length} scenarios + every table and default`
    );
    if (!ok) process.exit(1);
    if (sha !== golden.source_sha256) {
      console.log(`  index.html has changed since capture (${golden.source_sha256.slice(0, 12)}… → ${sha.slice(0, 12)}…)`);
      console.log('  — which is the point: different source, identical behaviour.');
    }
    return;
  }

  const payload = {
    captured_at: new Date().toISOString(),
    source_file: 'index.html',
    source_sha256: sha,
    capture_method: 'chromium via playwright, page globals, file:// load',
    scenario_count: scenarios.length,
    page_defaults,
    results,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.log('wrote ' + path.relative(ROOT, OUT) + ' — ' + scenarios.length + ' scenarios');
  console.log('index.html sha256 ' + sha);
})();
