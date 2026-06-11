/* fix-auto-scan.js
   Reemplaza runIntelligenceScan() con _scanIntelligence() silencioso + cooldown localStorage.
   Auto-dispara en DOMContentLoaded y visibilitychange — sin necesidad del botón.
*/
const fs = require('fs');
const filePath = require('path').join(__dirname, '../public/assets/js/admin.js');

const content = fs.readFileSync(filePath, 'utf8');
const lines   = content.split('\r\n');

/* ── 1. Reemplazar función runIntelligenceScan ── */
const startIdx = lines.findIndex(l => l.trim() === 'async function runIntelligenceScan() {');
if (startIdx < 0) { console.error('runIntelligenceScan not found'); process.exit(1); }

// Encontrar cierre de la función
let depth = 0, endIdx = -1;
for (let i = startIdx; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
  }
  if (endIdx >= 0) break;
}
if (endIdx < 0) { console.error('runIntelligenceScan end not found'); process.exit(1); }
console.log(`runIntelligenceScan: lines ${startIdx + 1}–${endIdx + 1}`);

const newScanFn = [
  '/* ── Intelligence Scan: corre automáticamente al iniciar y al recuperar foco ── */',
  'async function _scanIntelligence() {',
  '  const COOLDOWN = 5 * 60 * 1000;',
  "  const last = parseInt(localStorage.getItem('dam_last_scan') || '0');",
  '  if (Date.now() - last < COOLDOWN) return;',
  "  localStorage.setItem('dam_last_scan', String(Date.now()));",
  '  try {',
  '    await Promise.all([',
  "      fetch('/api/intelligence/stale-scanner', { method: 'POST', headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }),",
  "      fetch('/api/intelligence/run-bqe', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH_TOKEN}` }, body: '{}' }),",
  '    ]);',
  '    loadLeads();',
  '  } catch (_) {}',
  '}',
];

// Mantener también runIntelligenceScan como alias por si hay otras referencias
const aliasFn = [
  '',
  '/* alias para llamadas manuales residuales */',
  'function runIntelligenceScan() { _scanIntelligence(); }',
];

lines.splice(startIdx, endIdx - startIdx + 1, ...newScanFn, ...aliasFn);
console.log('runIntelligenceScan replaced');

/* ── 2. Actualizar DOMContentLoaded: agregar _scanIntelligence() después de loadLeads() ── */
// Buscar el bloque: "    loadLeads();\n  } else {\n    showLogin();\n  }"
const loadLeadsInitIdx = lines.findIndex((l, i) =>
  l.trim() === 'loadLeads();' &&
  lines[i + 1] && lines[i + 1].trim() === '} else {' &&
  lines[i + 2] && lines[i + 2].trim() === 'showLogin();'
);
if (loadLeadsInitIdx >= 0) {
  // Insertar _scanIntelligence() después de loadLeads()
  lines.splice(loadLeadsInitIdx + 1, 0, '    _scanIntelligence();');
  console.log(`_scanIntelligence() added after loadLeads() at line ${loadLeadsInitIdx + 1}`);
} else {
  console.warn('loadLeads init block not found — skipping step 2');
}

/* ── 3. Actualizar visibilitychange: agregar _scanIntelligence() ── */
const visIdx = lines.findIndex(l =>
  l.includes('visibilitychange') && l.includes('loadLeads()') && !l.includes('_scanIntelligence')
);
if (visIdx >= 0) {
  lines[visIdx] = lines[visIdx].replace(
    /if \(!document\.hidden && AUTH_TOKEN\) loadLeads\(\);/,
    'if (!document.hidden && AUTH_TOKEN) { loadLeads(); _scanIntelligence(); }'
  );
  console.log(`visibilitychange updated at line ${visIdx + 1}`);
} else {
  console.warn('visibilitychange handler not found — skipping step 3');
}

/* ── 4. Escribir ── */
fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
console.log('Done.');
