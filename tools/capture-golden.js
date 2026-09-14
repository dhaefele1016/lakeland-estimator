#!/usr/bin/env node
/* Capture golden fixtures from the CURRENT index.html, running in a real browser.
 *
 * Run this BEFORE moving any code:   node tools/capture-golden.js
 *
 * It loads index.html exactly as shipped, sets the scenario's params/stock/custom
 * into the page's own globals, calls the page's own calcLine/quote/breakQuotes/
 * betterQty, and writes the results verbatim to test/golden.json.
 *
 * Nothing here reimplements the model. If the capture and the model ever disagree,
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

(async () => {
  const html = fs.readFileSync(SRC);
  const sha = crypto.createHash('sha256').update(html).digest('hex');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto('file://' + SRC);
  await page.waitForFunction(() => typeof calcLine === 'function' && typeof quote === 'function');

  const results = {};
  for (const sc of scenarios) {
    results[sc.id] = await page.evaluate((sc) => {
      // Reset the page's globals to the shipped defaults, then apply the scenario.
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
        case 'calcLine':
          return calcLine(Q.lines[0], sc.qtyOverride == null ? null : sc.qtyOverride);
        case 'quote':
          return quote(sc.qtyOverride == null ? null : sc.qtyOverride,
                       sc.margin == null ? null : sc.margin);
        case 'breaks':
          return breakQuotes();
        case 'betterQty':
          return betterQty(Q.lines[0], sc.qtyOverride);
        default:
          throw new Error('unknown call: ' + sc.call);
      }
    }, sc);
  }

  await browser.close();

  if (pageErrors.length) {
    console.error('Page errors during capture:\n' + pageErrors.join('\n'));
    process.exit(1);
  }

  const payload = {
    captured_at: new Date().toISOString(),
    source_file: 'index.html',
    source_sha256: sha,
    capture_method: 'chromium via playwright, page globals, file:// load',
    scenario_count: scenarios.length,
    results,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.log('wrote ' + path.relative(ROOT, OUT) + ' — ' + scenarios.length + ' scenarios');
  console.log('index.html sha256 ' + sha);
})();
