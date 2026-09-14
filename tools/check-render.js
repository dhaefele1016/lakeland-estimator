#!/usr/bin/env node
/* Renders two builds of the page side by side and diffs the resulting DOM.
 *
 *   node tools/check-render.js <baseline.html> [candidate.html]
 *
 * The golden fixtures prove the model still computes the same numbers. This proves
 * the page still *shows* them — a renderer can break without throwing, and the
 * fixture capture would never notice. Both pages get identical state driven in
 * through the UI's own inputs, then every output panel's innerHTML is compared.
 */
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const { diff, report } = require(path.join(ROOT, 'test', 'compare.js'));

/* Baseline may be a file path, or git:<ref> to pull index.html out of history —
 * git:HEAD~1, git:<the pre-extraction commit>, and so on. */
let baseline = process.argv[2];
const candidate = process.argv[3] || path.join(ROOT, 'index.html');
if (!baseline) { console.error('usage: check-render.js <baseline.html|git:<ref>> [candidate.html]'); process.exit(2); }
if (baseline.startsWith('git:')) {
  const os = require('os');
  const fs = require('fs');
  const { execFileSync } = require('child_process');
  const ref = baseline.slice(4);
  // index.html loads model.js as a sibling, so the baseline has to be extracted as
  // a directory, not a lone file. Refs from before the extraction have no model.js
  // and don't need one.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `lg-baseline-${ref.replace(/\W/g, '_')}-`));
  const show = (p) => execFileSync('git', ['show', `${ref}:${p}`],
    { cwd: ROOT, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
  fs.writeFileSync(path.join(dir, 'index.html'), show('index.html'));
  try { fs.writeFileSync(path.join(dir, 'model.js'), show('model.js')); }
  catch (e) { /* pre-extraction ref — single-file build, nothing to place beside it */ }
  baseline = path.join(dir, 'index.html');
}

// Output panels — everything the estimator draws for the user.
const PANELS = ['lineTable', 'linesMeta', 'opTable', 'matTable', 'priceTable', 'qMeta',
                'breakTable', 'breaksMeta', 'breakNotes', 'machOut', 'nestRoll',
                'nestSheet', 'nestRollP', 'nestSheetP', 'nestRollH', 'nestSheetH',
                'byLine', 'foot', 'margHint', 'notes', 'customList'];

async function render(file) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Real JS errors only. The page pulls webfonts from Google, which this sandbox
  // blocks; that fails identically on both builds and says nothing about the code.
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource|ERR_(TUNNEL|NAME|INTERNET|CONNECTION)/.test(m.text())) return;
    errors.push('console: ' + m.text());
  });
  await page.goto('file://' + path.resolve(file));
  await page.waitForFunction(() => typeof quote === 'function');

  // Which encoding the browser actually settled on. Compared between builds before
  // any text is, because a mismatch makes every non-ASCII character differ.
  const charset = await page.evaluate(() => document.characterSet);

  // Drive state through the page's own model, then let it draw itself exactly as
  // it would for a user. Three lines, breaks on, so most of the UI is exercised.
  const dom = await page.evaluate((PANELS) => {
    Q.lines = [
      { id: 'L1', desc: 'decal',        w: 4,  h: 6,  qty: 100, con: '1', dcut: 'through', art: 'new' },
      { id: 'L2', desc: 'overlay',      w: 8,  h: 10, qty: 50,  con: '2', dcut: 'kiss',    art: 'new' },
      { id: 'L3', desc: 'repeat decal', w: 12, h: 3,  qty: 60,  con: '1', dcut: 'through', art: 'repeat' },
    ];
    Q.cust = { co: 'Acme Fuel', contact: 'M. Reyes', quote: '1234567', date: '2026-09-14', job: 'pump overlays' };
    Q.breaksOn = true;
    sel = 0;
    viewQty = null;
    render(); renderMeta(); renderMach(); renderBreaks(); renderCustomList();
    const out = {};
    for (const id of PANELS) {
      const el = document.getElementById(id);
      out[id] = el ? el.innerHTML : '(no such element)';
    }
    return out;
  }, PANELS);

  await browser.close();
  return { dom, errors, charset };
}

(async () => {
  const a = await render(baseline);
  const b = await render(candidate);

  if (a.errors.length) { console.error('baseline threw:\n  ' + a.errors.join('\n  ')); process.exit(1); }
  if (b.errors.length) { console.error('candidate threw:\n  ' + b.errors.join('\n  ')); process.exit(1); }

  // A page with no <meta charset> lets the browser guess, and the guess is not
  // reliably stable. When the two builds resolve to different encodings, every
  // non-ASCII character differs and the panel diff is noise hiding the real cause.
  if (a.charset !== b.charset) {
    console.error(`\n✗ the two builds decoded as different character sets — baseline ${a.charset}, candidate ${b.charset}`);
    console.error('  Any text diff below is that, not a rendering change. Check for <meta charset="utf-8">.\n');
    process.exit(1);
  }

  const diffs = diff(b.dom, a.dom, 'dom', []);
  const nonEmpty = Object.values(a.dom).filter((v) => v && v.length > 20).length;
  if (nonEmpty < 8) {
    console.error(`✗ baseline rendered almost nothing (${nonEmpty} populated panels) — the comparison would be vacuous`);
    process.exit(1);
  }
  const ok = report(`rendered DOM identical across both builds`, diffs,
                    `${Object.keys(a.dom).length} panels, ${nonEmpty} populated`);
  process.exit(ok ? 0 : 1);
})();
