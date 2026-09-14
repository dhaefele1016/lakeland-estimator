/* Golden-fixture scenarios for the Lakeland estimator cost model.
 *
 * These are INPUTS only. The expected outputs live in test/golden.json, captured
 * from the current index.html running in a real browser (tools/capture-golden.js)
 * BEFORE any code was moved. Nothing here encodes an assumption about how the
 * model works — that is the whole point.
 *
 * Every scenario starts from the shipped defaults (DEF for params, the default
 * Q.stock) and overrides only what it needs. `params`, `stock` and `custom` are
 * merges; `lines` replaces.
 *
 * Coverage is aimed at the branches the handoff flags as easy to get wrong:
 * the staircase, the 46" printable width vs the 54" roll, per-line setup with no
 * ganging, sheet-vs-bed splitting, and the two info/warning branches that only
 * fire on particular geometry.
 */

const L = (o) => Object.assign(
  { id: 'L1', desc: '', w: '', h: '', qty: '', con: '1', dcut: 'through', art: 'new' },
  o
);

module.exports = [
  // ---- construction 1: decal, film + optional overlaminate -------------------
  {
    id: 'con1_basic',
    note: '4×6 decal ×100, through cut, new art. The everyday case.',
    call: 'calcLine',
    lines: [L({ desc: '4x6 decal', w: 4, h: 6, qty: 100 })],
  },
  {
    id: 'con1_kiss_repeat',
    note: 'Same part, kiss cut and repeat artwork — exercises both alternate branches at once.',
    call: 'calcLine',
    lines: [L({ w: 4, h: 6, qty: 100, dcut: 'kiss', art: 'repeat' })],
  },
  {
    id: 'con1_no_overlam',
    note: 'Overlaminate set to None — drops both the material line and the laminator op.',
    call: 'calcLine',
    stock: { olam1: 'none' },
    lines: [L({ w: 4, h: 6, qty: 100 })],
  },
  {
    id: 'con1_rotation',
    note: '12×3 ×60. Rotating gets 14 across instead of 3 — checks the rot/pw/ph swap.',
    call: 'calcLine',
    lines: [L({ w: 12, h: 3, qty: 60 })],
  },

  // ---- the staircase --------------------------------------------------------
  {
    id: 'staircase_100',
    note: '4×6 ×100 at 10 across = exactly 10 full rows. Pair with staircase_101.',
    call: 'calcLine',
    lines: [L({ w: 4, h: 6, qty: 100 })],
  },
  {
    id: 'staircase_101',
    note: 'One more piece forces an 11th row. Unit cost must go UP vs staircase_100.',
    call: 'calcLine',
    lines: [L({ w: 4, h: 6, qty: 101 })],
  },

  // ---- waste / width info branches -----------------------------------------
  {
    id: 'info_low_yield',
    note: '2×2 ×4 — tiny run against a 3 ft leader. Fires the yld<0.45 info line.',
    call: 'calcLine',
    lines: [L({ w: 2, h: 2, qty: 4 })],
  },
  {
    id: 'info_wide_over_nest',
    note: '24" film under a 54" overlaminate — fires the "you pay the full roll width" info.',
    call: 'calcLine',
    stock: { film1: 'o651w', olam1: '8519_54' },
    lines: [L({ w: 4, h: 6, qty: 100 })],
  },
  {
    id: 'warn_multipass_overlam',
    note: '54" web under a 48.5" overlaminate — 2 passes, fires the multi-pass warning.',
    call: 'calcLine',
    stock: { film1: 'ij35c54', olam1: '8518_485' },
    lines: [L({ w: 4, h: 6, qty: 100 })],
  },
  {
    id: 'roll_magnet_50ft',
    note: 'Magnet stock — 24.375" wide on a 50 ft roll, not 150. Checks per-ft cost off lenFt.',
    call: 'calcLine',
    stock: { film1: 'mag', olam1: 'none' },
    lines: [L({ w: 4, h: 6, qty: 100 })],
  },

  // ---- construction 2: film + adhesive + rigid ------------------------------
  {
    id: 'con2_rigid_split',
    note: '8×10 ×50 on 24.5×48.5 acrylic. Sheet exceeds the 47.2×36 bed → splitK 2 + pre-cut op.',
    call: 'calcLine',
    lines: [L({ w: 8, h: 10, qty: 50, con: '2' })],
  },
  {
    id: 'con2_styrene_split3',
    note: '48×96 styrene → splitK 3. A different split count from con2_rigid_split.',
    call: 'calcLine',
    stock: { rig2: 'sty30' },
    lines: [L({ w: 8, h: 10, qty: 50, con: '2' })],
  },
  {
    id: 'con2_fits_bed',
    note: '3×3 ×40 on a 16×16.875 sheet — fits the bed, so splitK stays 1 and no pre-cut op.',
    call: 'calcLine',
    stock: { rig2: 'pc030s' },
    lines: [L({ w: 3, h: 3, qty: 40, con: '2' })],
  },
  {
    id: 'con3_backed',
    note: 'Construction 3 — adds the backer vinyl pass on top of con2.',
    call: 'calcLine',
    lines: [L({ w: 8, h: 10, qty: 50, con: '3' })],
  },

  // ---- error and empty paths ------------------------------------------------
  {
    id: 'err_too_wide',
    note: '50×50 will not fit 46" printable either way round — returns the error object.',
    call: 'calcLine',
    lines: [L({ w: 50, h: 50, qty: 10 })],
  },
  {
    id: 'err_sheet_too_small',
    note: '20×20 part on a 16×16.875 sheet — fits the web, fails the sheet. Second error path.',
    call: 'calcLine',
    stock: { rig2: 'pc030s' },
    lines: [L({ w: 20, h: 20, qty: 5, con: '2' })],
  },
  {
    id: 'empty_line',
    note: 'No dimensions entered — returns the empty marker, not an error.',
    call: 'calcLine',
    lines: [L({ w: '', h: '', qty: '' })],
  },

  // ---- knob turning ---------------------------------------------------------
  {
    id: 'coverage_and_speed',
    note: 'Fast mode, light coverage — moves ink cost and press run time together.',
    call: 'calcLine',
    stock: { mode: 200, cov: 0.3 },
    lines: [L({ w: 4, h: 6, qty: 100 })],
  },
  {
    id: 'param_util_300',
    note: 'Productive hours halved to 300 — every machine rate should roughly double.',
    call: 'calcLine',
    params: { util: 300 },
    lines: [L({ w: 4, h: 6, qty: 100 })],
  },
  {
    id: 'param_margin_burden',
    note: 'Burden 45% and gutter 0.5" — labour rates and imposition both shift.',
    call: 'calcLine',
    params: { burden: 45, gutter: 0.5 },
    lines: [L({ w: 4, h: 6, qty: 100 })],
  },

  // ---- custom materials (today localStorage, later the custom_materials table)
  {
    id: 'custom_roll_film',
    note: 'A roll Melissa added herself, used as the print film.',
    call: 'calcLine',
    custom: [{ id: 'cust_r1', n: 'Custom cast film 52"', kind: 'roll', custom: true, rollW: 52, lenFt: 150, cost: 412.5, psf: 412.5 / (52 / 12 * 150) }],
    stock: { film1: 'cust_r1' },
    lines: [L({ w: 4, h: 6, qty: 100 })],
  },
  {
    id: 'custom_sheet_rigid',
    note: 'A custom sheet used as the rigid substrate — checks the sheet path reads custom stock.',
    call: 'calcLine',
    custom: [{ id: 'cust_s1', n: 'Custom acrylic 30×40', kind: 'sheet', custom: true, shW: 30, shH: 40, cost: 7.25, psf: 7.25 / (30 * 40 / 144) }],
    stock: { rig2: 'cust_s1' },
    lines: [L({ w: 8, h: 10, qty: 50, con: '2' })],
  },

  // ---- whole-quote level ----------------------------------------------------
  {
    id: 'quote_multiline',
    note: 'Three mixed lines. Checks the pack-and-ship hour being split by piece share.',
    call: 'quote',
    lines: [
      L({ id: 'L1', desc: 'decal', w: 4, h: 6, qty: 100 }),
      L({ id: 'L2', desc: 'overlay', w: 8, h: 10, qty: 50, con: '2', dcut: 'kiss' }),
      L({ id: 'L3', desc: 'repeat decal', w: 12, h: 3, qty: 60, art: 'repeat' }),
    ],
  },
  {
    id: 'quote_margin_50',
    note: 'Same three lines at 50% margin instead of the default 35%.',
    call: 'quote',
    margin: 50,
    lines: [
      L({ id: 'L1', desc: 'decal', w: 4, h: 6, qty: 100 }),
      L({ id: 'L2', desc: 'overlay', w: 8, h: 10, qty: 50, con: '2', dcut: 'kiss' }),
      L({ id: 'L3', desc: 'repeat decal', w: 12, h: 3, qty: 60, art: 'repeat' }),
    ],
  },
  {
    id: 'breaks_default',
    note: 'Quantity breaks at 25/50/100/250 — four independent re-runs, never interpolated.',
    call: 'breaks',
    breaks: [{ qty: 25, margin: null }, { qty: 50, margin: null }, { qty: 100, margin: null }, { qty: 250, margin: null }],
    lines: [L({ w: 4, h: 6, qty: 100 })],
  },
  {
    id: 'betterqty_95',
    note: '95 pieces at 10 across wastes most of a row — betterQty should suggest 100.',
    call: 'betterQty',
    qtyOverride: 95,
    lines: [L({ w: 4, h: 6, qty: 95 })],
  },
];
