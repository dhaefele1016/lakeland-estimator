#!/usr/bin/env node
/* Connection diagnostic for the Neon database.
 *
 *   source .env.local && node tools/check-db.js
 *
 * Prefers variables already in the environment (the shell's own parsing, which is
 * authoritative) and falls back to reading .env.local directly. Reports the SHAPE
 * of each connection string — never its contents — then tries the plausible
 * connection variants and dumps every property of whatever error comes back.
 * All output is safe to paste.
 */
const fs = require('fs');
const path = require('path');

const KEYS = ['POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'DATABASE_URL_UNPOOLED'];

// Env files, in precedence order. .env.db.local is the hand-made one for local
// database work; .env.local is whatever `vercel env pull` produced, which may hold
// Vercel's "[SENSITIVE]" placeholders rather than real credentials.
const FILES = ['.env.db.local', '.env.local'];
const fileEnv = {};   // key -> { v, file }
for (const f of FILES) {
  const full = path.resolve(process.cwd(), f);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in fileEnv)) fileEnv[m[1]] = { v, file: f };   // first file wins
  }
}

// A value that is not a postgres URL is unusable — most often Vercel's placeholder.
const usable = (v) => /^postgres(ql)?:\/\//.test(v);

/* Precedence: the purpose-made file, then the shell, then the pulled file. A
   placeholder is skipped wherever it appears rather than silently tried. */
const get = (k) => {
  const cands = [];
  if (fileEnv[k] && fileEnv[k].file === '.env.db.local') cands.push({ v: fileEnv[k].v, from: '.env.db.local' });
  if (process.env[k]) cands.push({ v: process.env[k], from: 'shell' });
  if (fileEnv[k] && fileEnv[k].file === '.env.local') cands.push({ v: fileEnv[k].v, from: '.env.local' });
  const good = cands.find((c) => usable(c.v));
  if (good) return good;
  if (cands.length) return Object.assign({}, cands[0], { placeholder: true });
  return null;
};

/* Structure only: every alphanumeric run becomes x's, so the punctuation that
   makes or breaks a connection string survives and nothing else does. */
const skeleton = (s) => s.replace(/[A-Za-z0-9]+/g, (m) => 'x'.repeat(Math.min(m.length, 4)));

let parseCS;
try { parseCS = require('pg-connection-string').parse; } catch (e) { /* older pg */ }

console.log('--- connection strings, shape only ---');
for (const k of KEYS) {
  const g = get(k);
  if (!g) { console.log('  ' + k.padEnd(26) + ' MISSING'); continue; }
  console.log('  ' + k);
  console.log('      source ' + g.from + '   length ' + g.v.length +
              (g.placeholder ? '   <-- NOT a connection string (placeholder?) — unusable' : ''));
  console.log('      shape  ' + skeleton(g.v));
  if (parseCS) {
    try {
      const p = parseCS(g.v);
      console.log('      parsed host=' + JSON.stringify(p.host) + ' port=' + JSON.stringify(p.port) +
                  ' db=' + JSON.stringify(p.database) + ' ssl=' + JSON.stringify(p.ssl));
    } catch (e) {
      console.log('      parsed FAILED: ' + e.message);
    }
  }
}
console.log('  node ' + process.version);

let pg;
try { pg = require('pg'); }
catch (e) { console.error('\npg not installed here. Run: npm i pg'); process.exit(2); }

const describe = (e) => {
  const out = {};
  for (const k of ['name', 'code', 'errno', 'syscall', 'address', 'port', 'severity', 'routine', 'detail', 'hint']) {
    if (e && e[k] !== undefined) out[k] = e[k];
  }
  out.message = e && e.message !== undefined ? JSON.stringify(e.message) : '(none)';
  if (e && e.cause) out.cause = String((e.cause && e.cause.message) || e.cause);
  return out;
};

async function attempt(label, config) {
  const c = new pg.Client(Object.assign({ connectionTimeoutMillis: 15000 }, config));
  const t0 = Date.now();
  try {
    await c.connect();
    const r = await c.query('select version()');
    await c.end();
    console.log('  ✓ ' + label + '  (' + (Date.now() - t0) + 'ms)');
    console.log('      ' + r.rows[0].version.split(' on ')[0]);
    return true;
  } catch (e) {
    console.log('  ✗ ' + label + '  (' + (Date.now() - t0) + 'ms)');
    for (const kv of Object.entries(describe(e))) console.log('      ' + kv[0] + ': ' + kv[1]);
    try { await c.end(); } catch (e2) {}
    return false;
  }
}

(async () => {
  console.log('\n--- connection attempts ---');
  const direct = get('POSTGRES_URL_NON_POOLING') || get('DATABASE_URL_UNPOOLED');
  const pooled = get('POSTGRES_URL') || get('DATABASE_URL');
  let ok = false;
  if (direct) {
    ok = await attempt('direct, as configured', { connectionString: direct.v });
    if (!ok) ok = await attempt('direct, ssl on, no cert check',
      { connectionString: direct.v, ssl: { rejectUnauthorized: false } });
  }
  if (!ok && pooled) {
    ok = await attempt('pooled, as configured', { connectionString: pooled.v });
    if (!ok) ok = await attempt('pooled, ssl on, no cert check',
      { connectionString: pooled.v, ssl: { rejectUnauthorized: false } });
  }

  console.log('\n--- verdict ---');
  if (ok) console.log('  Connected. Use whichever variant succeeded above.');
  else console.log('  Nothing connected — read the shape lines above first. A host that is a\n' +
                   '  fragment of a word means the string was mangled in transit, not that\n' +
                   '  the database is down.');
  process.exit(ok ? 0 : 1);
})();
