/* Exact deep comparison, shared by the node golden test and the browser re-check.
 * Exact on every field — numbers, strings, warnings — which is stricter than "to
 * the cent" and catches drift in the model's explanatory strings too.
 */
function diff(got, want, p, out) {
  out = out || [];
  (function cmp(a, b, p) {
    if (a === b) return;
    if (typeof a === 'number' && typeof b === 'number') {
      if (Number.isNaN(a) && Number.isNaN(b)) return;
      out.push(`${p}: expected ${b}, got ${a}` + (isFinite(a - b) ? ` (Δ ${a - b})` : ''));
      return;
    }
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      out.push(`${p}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
      return;
    }
    if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${p}: array/object mismatch`); return; }
    if (Array.isArray(a)) {
      if (a.length !== b.length) out.push(`${p}: length ${a.length} vs ${b.length}`);
      for (let i = 0; i < Math.max(a.length, b.length); i++) cmp(a[i], b[i], `${p}[${i}]`);
      return;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) { out.push(`${p}.${k}: missing`); continue; }
      if (!(k in b)) { out.push(`${p}.${k}: unexpected`); continue; }
      cmp(a[k], b[k], `${p}.${k}`);
    }
  })(got, want, p);
  return out;
}

function report(label, diffs, count) {
  if (diffs.length) {
    console.error(`\n✗ ${label}: ${diffs.length} difference(s)\n`);
    for (const d of diffs.slice(0, 40)) console.error('  ' + d);
    if (diffs.length > 40) console.error(`  … and ${diffs.length - 40} more`);
    console.error('');
    return false;
  }
  console.log(`✓ ${label}${count == null ? '' : ' — ' + count}`);
  return true;
}

module.exports = { diff, report };
