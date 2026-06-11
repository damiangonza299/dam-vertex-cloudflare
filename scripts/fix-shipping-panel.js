/* fix-shipping-panel.js
   Mueve setShipDateActive / setShipTypeActive a nivel módulo,
   reescribe initShippingPanel sin closures locales,
   elimina el handler last_month,
   renombra textos del botón Escanear → Analizar.
*/
const fs = require('fs');
const filePath = require('path').join(__dirname, '../public/assets/js/admin.js');

const content = fs.readFileSync(filePath, 'utf8');
const lines   = content.split('\r\n');

/* ── 1. Encontrar líneas clave ── */
const allRowsIdx = lines.findIndex(l => /^let _allShippingRows\s*=/.test(l.trim()));
const initFnIdx  = lines.findIndex(l => l.trim() === 'function initShippingPanel() {');
if (allRowsIdx < 0) { console.error('allShippingRows not found'); process.exit(1); }
if (initFnIdx  < 0) { console.error('initShippingPanel not found'); process.exit(1); }

/* ── 2. Encontrar cierre de initShippingPanel ── */
let depth = 0;
let initFnEnd = -1;
for (let i = initFnIdx; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) { initFnEnd = i; break; } }
  }
  if (initFnEnd >= 0) break;
}
if (initFnEnd < 0) { console.error('initShippingPanel end not found'); process.exit(1); }
console.log(`initShippingPanel: lines ${initFnIdx + 1}–${initFnEnd + 1}`);

/* ── 3. Nueva initShippingPanel (sin closures locales) ── */
const newInitFn = [
  'function initShippingPanel() {',
  '  shippingDate      = getParaguayDateLocal();',
  "  shippingRangeMode = 'today';",
  '  const todayStr    = shippingDate;',
  '  const yestStr     = getParaguayDateLocal(new Date(Date.now() - 86400000));',
  '',
  "  document.getElementById('ship-date-all')?.addEventListener('click', () => {",
  "    shippingRangeMode = 'all';",
  "    setShipDateActive('ship-date-all');",
  '    loadShippingStats();',
  '  });',
  '',
  "  document.getElementById('ship-date-today')?.addEventListener('click', () => {",
  "    shippingRangeMode = 'today';",
  '    shippingDate      = todayStr;',
  "    setShipDateActive('ship-date-today');",
  '    loadShippingStats();',
  '  });',
  '',
  "  document.getElementById('ship-date-yesterday')?.addEventListener('click', () => {",
  "    shippingRangeMode = 'yesterday';",
  '    shippingDate      = yestStr;',
  "    setShipDateActive('ship-date-yesterday');",
  '    loadShippingStats();',
  '  });',
  '',
  "  document.getElementById('ship-date-this-month')?.addEventListener('click', () => {",
  "    shippingRangeMode = 'this_month';",
  "    setShipDateActive('ship-date-this-month');",
  '    loadShippingStats();',
  '  });',
  '',
  "  document.getElementById('ship-date-picker')?.addEventListener('change', e => {",
  '    if (e.target.value) {',
  "      shippingRangeMode = 'custom';",
  '      shippingDate      = e.target.value;',
  "      ['ship-date-all','ship-date-today','ship-date-yesterday','ship-date-this-month'].forEach(bid => document.getElementById(bid)?.classList.remove('date-btn--active'));",
  '      loadShippingStats();',
  '    }',
  '  });',
  '',
  "  document.getElementById('ship-type-all')?.addEventListener('click', () => {",
  "    shippingTypeFilter = 'all';",
  "    setShipTypeActive('ship-type-all');",
  '    renderShippingHistory(_allShippingRows);',
  '  });',
  '',
  "  document.getElementById('ship-type-delivery')?.addEventListener('click', () => {",
  "    shippingTypeFilter = 'delivery';",
  "    setShipTypeActive('ship-type-delivery');",
  '    renderShippingHistory(_allShippingRows);',
  '  });',
  '',
  "  document.getElementById('ship-type-encomienda')?.addEventListener('click', () => {",
  "    shippingTypeFilter = 'encomienda';",
  "    setShipTypeActive('ship-type-encomienda');",
  '    renderShippingHistory(_allShippingRows);',
  '  });',
  '}',
];

/* ── 4. Funciones helper a nivel módulo ── */
const helperFns = [
  '',
  'function setShipDateActive(id) {',
  "  ['ship-date-all','ship-date-today','ship-date-yesterday','ship-date-this-month'].forEach(bid => document.getElementById(bid)?.classList.remove('date-btn--active'));",
  "  document.getElementById(id)?.classList.add('date-btn--active');",
  "  const dp = document.getElementById('ship-date-picker');",
  "  if (dp) dp.value = '';",
  '}',
  '',
  'function setShipTypeActive(id) {',
  "  ['ship-type-all','ship-type-delivery','ship-type-encomienda'].forEach(bid => document.getElementById(bid)?.classList.remove('date-btn--active'));",
  "  document.getElementById(id)?.classList.add('date-btn--active');",
  '}',
];

/* ── 5. Aplicar cambios (orden: primero los de índice mayor para no desplazar los menores) ── */

// 5a. Reemplazar initShippingPanel
lines.splice(initFnIdx, initFnEnd - initFnIdx + 1, ...newInitFn);

// 5b. Insertar helpers después de _allShippingRows (índice no afectado por 5a porque es anterior)
lines.splice(allRowsIdx + 1, 0, ...helperFns);

/* ── 6. Arreglar editShippingRow: quitar last-month del array ── */
const editIdx = lines.findIndex(l =>
  l.includes("'ship-date-last-month'") && l.includes('forEach')
);
if (editIdx >= 0) {
  lines[editIdx] = lines[editIdx]
    .replace(",'ship-date-last-month'", '')
    .replace("'ship-date-last-month',", '');
  console.log(`editShippingRow array fixed at line ${editIdx + 1}`);
} else {
  console.log('editShippingRow array: last-month already removed or not found');
}

/* ── 7. Renombrar textos Escanear → Analizar en runIntelligenceScan ── */
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('⚡ Escanear'))     lines[i] = lines[i].replace(/⚡ Escanear/g, '⚡ Analizar');
  if (lines[i].includes('⏳ Escaneando'))   lines[i] = lines[i].replace(/⏳ Escaneando/g, '⏳ Analizando');
}

/* ── 8. Escribir ── */
fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
console.log('Done. allRows=' + (allRowsIdx + 1) + ', initFn=' + (initFnIdx + 1) + '–' + (initFnEnd + 1));
