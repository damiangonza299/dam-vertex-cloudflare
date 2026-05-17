/**
 * test-meta-api.mjs
 * Prueba directa contra Meta Marketing API (sin pasar por el Worker).
 * Lee credentials desde .dev.vars del proyecto.
 *
 * Uso:
 *   node scripts/test-meta-api.mjs
 *
 * Requiere que .dev.vars tenga:
 *   META_MARKETING_TOKEN=xxxxx
 *   META_AD_ACCOUNT_ID=act_992345752726304
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, '..');
const VERSION = 'v21.0';

/* ── Leer .dev.vars ── */
function loadDevVars() {
  const path = join(ROOT, '.dev.vars');
  if (!existsSync(path)) {
    console.error('ERROR: No se encontró .dev.vars en la raíz del proyecto.');
    console.error('Crear el archivo con META_MARKETING_TOKEN y META_AD_ACCOUNT_ID.');
    process.exit(1);
  }
  const vars = {};
  readFileSync(path, 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.trim().split('=');
    if (k && rest.length) vars[k] = rest.join('=').trim();
  });
  return vars;
}

const env = loadDevVars();

const RAW_ID   = env.META_AD_ACCOUNT_ID || '';
const ACCOUNT  = RAW_ID.startsWith('act_') ? RAW_ID : `act_${RAW_ID}`;
const TOKEN    = env.META_MARKETING_TOKEN || '';

if (!TOKEN || TOKEN === 'PONER_TOKEN_AQUI') {
  console.error('ERROR: META_MARKETING_TOKEN no configurado en .dev.vars');
  process.exit(1);
}

console.log(`\n=== Meta Marketing API — Prueba de integración`);
console.log(`Account ID : ${ACCOUNT}`);
console.log(`API version: ${VERSION}`);
console.log(`Token      : ${TOKEN.slice(0, 12)}...[oculto]\n`);

/* ── Helper fetch ── */
async function metaGet(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${VERSION}/${path}`);
  url.searchParams.set('access_token', TOKEN);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
  }
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error?.message || 'Meta API error'), { meta: data.error });
  return data;
}

/* ── TEST 1: Campañas ── */
async function testCampaigns() {
  console.log('── TEST 1: Campañas activas ──────────────────────');
  const data = await metaGet(`${ACCOUNT}/campaigns`, {
    fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
    filtering: [{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }],
  });
  const camps = data.data || [];
  if (!camps.length) {
    console.log('  Sin campañas activas o pausadas en este periodo.');
  } else {
    camps.forEach(c => {
      const budget = c.daily_budget
        ? `${(+c.daily_budget / 100).toLocaleString()} PYG/día`
        : c.lifetime_budget
          ? `${(+c.lifetime_budget / 100).toLocaleString()} PYG total`
          : 'sin presupuesto';
      console.log(`  [${c.effective_status}] ${c.name} (${c.objective}) — ${budget}`);
    });
  }
  console.log(`  Total: ${camps.length} campañas\n`);
  return camps;
}

/* ── TEST 2: Anuncios ── */
async function testAds() {
  console.log('── TEST 2: Anuncios ──────────────────────────────');
  const data = await metaGet(`${ACCOUNT}/ads`, {
    fields: 'id,name,status,effective_status,campaign_id,adset_id',
    limit: 10,
  });
  const ads = data.data || [];
  if (!ads.length) {
    console.log('  Sin anuncios encontrados.');
  } else {
    ads.slice(0, 5).forEach(a => {
      console.log(`  [${a.effective_status}] ${a.name} — campaign: ${a.campaign_id}`);
    });
    if (ads.length > 5) console.log(`  ... y ${ads.length - 5} más`);
  }
  console.log(`  Total (primeros 10): ${ads.length} anuncios\n`);
}

/* ── TEST 3: Insights — últimos 7 días ── */
async function testInsights() {
  const today       = new Date().toISOString().split('T')[0];
  const sevenAgo    = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0];

  console.log(`── TEST 3: Insights (${sevenAgo} → ${today}) ──────────`);
  const data = await metaGet(`${ACCOUNT}/insights`, {
    fields: 'campaign_name,campaign_id,impressions,reach,clicks,spend,cpc,cpm,ctr,actions,action_values',
    time_range: { since: sevenAgo, until: today },
    level: 'campaign',
  });
  const rows = data.data || [];
  if (!rows.length) {
    console.log('  Sin datos de insights en los últimos 7 días.');
    console.log('  (Posible causa: sin campañas activas con gasto en ese periodo)\n');
  } else {
    rows.forEach(r => {
      const spend    = parseFloat(r.spend   || 0).toLocaleString();
      const cpc      = parseFloat(r.cpc     || 0).toFixed(4);
      const ctr      = parseFloat(r.ctr     || 0).toFixed(2);
      const cpm      = parseFloat(r.cpm     || 0).toFixed(2);
      const clicks   = r.clicks  || '0';
      const imps     = r.impressions || '0';
      const purchases = (r.actions || []).find(a => a.action_type === 'purchase')?.value || '0';
      const purValue  = (r.action_values || []).find(a => a.action_type === 'purchase')?.value || '0';
      const roas      = parseFloat(r.spend) > 0
        ? (parseFloat(purValue) / parseFloat(r.spend)).toFixed(2)
        : 'N/A';

      console.log(`\n  Campaña: ${r.campaign_name}`);
      console.log(`    Gasto     : ${spend} PYG`);
      console.log(`    Impres.   : ${imps}`);
      console.log(`    Clics     : ${clicks}`);
      console.log(`    CTR       : ${ctr}%`);
      console.log(`    CPC       : ${cpc}`);
      console.log(`    CPM       : ${cpm}`);
      console.log(`    Compras   : ${purchases}`);
      console.log(`    Val.compra: ${purValue} PYG`);
      console.log(`    ROAS      : ${roas}`);
    });
    console.log('');
  }
}

/* ── Verificación de permisos ── */
async function testPermissions() {
  console.log('── Verificación de permisos del token ────────────');
  try {
    const data = await metaGet('me', { fields: 'id,name' });
    console.log(`  Token válido. Usuario/app: ${data.name || data.id}`);
  } catch (e) {
    console.log(`  ERROR al verificar token: ${e.message}`);
    if (e.meta) console.log('  Meta error:', JSON.stringify(e.meta));
  }
  try {
    const data = await metaGet(`${ACCOUNT}`, { fields: 'id,name,account_status,currency' });
    const status = { 1: 'ACTIVA', 2: 'DESHABILITADA', 3: 'SIN PAGO', 9: 'CANCELADA' }[data.account_status] || data.account_status;
    console.log(`  Cuenta publicitaria: ${data.name} | Estado: ${status} | Moneda: ${data.currency}`);
  } catch (e) {
    console.log(`  ERROR al leer cuenta: ${e.message}`);
    if (e.meta?.code === 100) console.log('  → Verificar que META_AD_ACCOUNT_ID sea correcto');
    if (e.meta?.code === 190) console.log('  → Token inválido o expirado');
    if (e.meta?.code === 10)  console.log('  → Permisos insuficientes (falta ads_read o read_insights)');
  }
  console.log('');
}

/* ── Ejecutar todos los tests ── */
(async () => {
  try {
    await testPermissions();
    await testCampaigns();
    await testAds();
    await testInsights();
    console.log('=== Prueba completada ===\n');
  } catch (err) {
    console.error('\nERROR FATAL:', err.message);
    if (err.meta) {
      console.error('Código Meta:', err.meta.code);
      console.error('Mensaje    :', err.meta.message);
      console.error('Tipo       :', err.meta.type);
      if (err.meta.code === 190) console.error('→ Token inválido o expirado. Regenerar en Meta Business Manager.');
      if (err.meta.code === 10)  console.error('→ Sin permisos ads_read / read_insights en el token.');
      if (err.meta.code === 100) console.error('→ Account ID incorrecto. Verificar act_992345752726304.');
    }
    process.exit(1);
  }
})();
