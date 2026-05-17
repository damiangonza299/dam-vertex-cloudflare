/* =========================================================
   /api/meta/report — Cruce Meta insights + D1 leads reales

   GET /api/meta/report?since=YYYY-MM-DD&until=YYYY-MM-DD
   Auth: Bearer {ADMIN_PASSWORD}

   Devuelve una fila por campaña con:
   - métricas de Meta (spend, CTR, CPC, CPM, ROAS Meta)
   - métricas reales de D1 (leads, comprados, revenue, tasa cierre)
   - ROAS real calculado
   - clasificación de calidad de campaña

   NO toca: CAPI, Purchase, Pixel, admin-leads, leads.js, D1 writes.
   ========================================================= */

const META_API_VERSION = 'v21.0';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  /* Auth */
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const marketingToken = env.META_MARKETING_TOKEN;
  const rawAccountId   = env.META_AD_ACCOUNT_ID || '';
  const adAccountId    = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;

  if (!marketingToken || !rawAccountId) {
    return json({ ok: false, error: 'META_MARKETING_TOKEN o META_AD_ACCOUNT_ID no configurados' }, 503);
  }

  /* Parámetros de fecha */
  const { searchParams } = new URL(request.url);
  const today      = new Date().toISOString().split('T')[0];
  const thirtyAgo  = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const since = searchParams.get('since') || thirtyAgo;
  const until = searchParams.get('until') || today;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return json({ ok: false, error: 'Formato de fecha inválido. Usar YYYY-MM-DD' }, 400);
  }

  try {
    /* ── 1. Fetch en paralelo: Meta insights + D1 leads ── */
    const [metaData, d1Data] = await Promise.all([
      fetchMetaInsights(adAccountId, marketingToken, since, until),
      fetchD1Leads(env.DB, since, until),
    ]);

    /* ── 2. Indexar D1 por campaign_id ── */
    const d1ByCampaignId   = new Map();
    const d1ByCampaignName = new Map();

    for (const row of d1Data) {
      if (row.campaign_id) {
        d1ByCampaignId.set(String(row.campaign_id), row);
      } else if (row.campaign_name) {
        d1ByCampaignName.set(row.campaign_name.toLowerCase().trim(), row);
      }
    }

    /* ── 3. Contar leads sin atribución ── */
    const noAttrCount = await fetchUnattributedCount(env.DB, since, until);

    /* ── 4. JOIN Meta + D1 ── */
    const rows = (metaData || []).map(meta => {
      const cid = String(meta.campaign_id || '');

      /* Buscar primero por ID, luego por nombre */
      const d1 = d1ByCampaignId.get(cid)
        ?? d1ByCampaignName.get((meta.campaign_name || '').toLowerCase().trim())
        ?? null;

      return buildRow(meta, d1);
    });

    /* ── 5. Campañas con leads pero sin datos Meta (período sin gasto) ── */
    const metaIds = new Set((metaData || []).map(m => String(m.campaign_id || '')));
    for (const row of d1Data) {
      const cid = String(row.campaign_id || '');
      if (cid && !metaIds.has(cid)) {
        rows.push(buildRow(null, row));
      }
    }

    /* ── 6. Ordenar por gasto descendente ── */
    rows.sort((a, b) => (b.meta?.spend_raw ?? 0) - (a.meta?.spend_raw ?? 0));

    /* ── 7. Alertas ── */
    const alerts = buildAlerts(rows);

    return json({
      ok:      true,
      period:  { since, until },
      rows,
      alerts,
      no_attribution_leads: noAttrCount,
    });

  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── Fetch Meta insights ── */
async function fetchMetaInsights(adAccountId, token, since, until) {
  const fields = [
    'campaign_id',
    'campaign_name',
    'impressions',
    'reach',
    'clicks',
    'spend',
    'cpc',
    'cpm',
    'ctr',
    'actions',
    'action_values',
  ].join(',');

  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('time_range', JSON.stringify({ since, until }));
  url.searchParams.set('level', 'campaign');
  url.searchParams.set('limit', '200');
  url.searchParams.set('access_token', token);

  const res  = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok) throw new Error(`Meta API: ${data.error?.message || res.status}`);
  return data.data || [];
}

/* ── Fetch D1 leads agrupados por campaña ── */
async function fetchD1Leads(DB, since, until) {
  /* D1 guarda fechas en UTC. Ajustar rango: desde inicio de 'since' hasta fin de 'until' */
  const { results } = await DB.prepare(`
    SELECT
      campaign_id,
      campaign_name,
      MAX(product_name)                                            AS product_name,
      COUNT(*)                                                     AS total_leads,
      SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END)       AS purchased,
      SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END)       AS pending,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)       AS cancelled,
      SUM(CASE WHEN status = 'purchased' THEN COALESCE(value, 0) ELSE 0 END) AS revenue_real,
      AVG(CASE WHEN status = 'purchased' THEN value ELSE NULL END) AS avg_ticket
    FROM leads
    WHERE created_at >= ?1
      AND created_at < date(?2, '+1 day')
      AND (campaign_id IS NOT NULL OR campaign_name IS NOT NULL OR utm_campaign IS NOT NULL)
    GROUP BY campaign_id, campaign_name
    ORDER BY total_leads DESC
  `).bind(since, until).all();

  return results || [];
}

/* ── Contar leads sin ninguna atribución ── */
async function fetchUnattributedCount(DB, since, until) {
  try {
    const row = await DB.prepare(`
      SELECT COUNT(*) AS cnt FROM leads
      WHERE created_at >= ?1
        AND created_at < date(?2, '+1 day')
        AND campaign_id IS NULL
        AND campaign_name IS NULL
        AND utm_campaign IS NULL
        AND fbclid IS NULL
    `).bind(since, until).first();
    return row?.cnt ?? 0;
  } catch {
    return null;
  }
}

/* ── Construir una fila combinada ── */
function buildRow(meta, d1) {
  /* Métricas Meta */
  const spend_raw    = parseFloat(meta?.spend    || 0);
  const impressions  = parseInt(meta?.impressions || 0);
  const clicks       = parseInt(meta?.clicks      || 0);
  const ctr          = parseFloat(meta?.ctr       || 0);
  const cpc          = parseFloat(meta?.cpc       || 0);
  const cpm          = parseFloat(meta?.cpm       || 0);

  const meta_purchase_value = (meta?.action_values || [])
    .filter(a => a.action_type === 'purchase')
    .reduce((s, a) => s + parseFloat(a.value || 0), 0);

  const roas_meta = spend_raw > 0 ? parseFloat((meta_purchase_value / spend_raw).toFixed(2)) : null;

  /* Métricas D1 */
  const total_leads   = parseInt(d1?.total_leads   || 0);
  const purchased     = parseInt(d1?.purchased     || 0);
  const pending       = parseInt(d1?.pending       || 0);
  const cancelled     = parseInt(d1?.cancelled     || 0);
  const revenue_real  = parseFloat(d1?.revenue_real  || 0);
  const avg_ticket    = d1?.avg_ticket ? parseFloat(d1.avg_ticket) : null;

  /* Métricas derivadas */
  const close_rate = total_leads > 0 ? parseFloat((purchased / total_leads * 100).toFixed(1)) : null;
  const roas_real  = spend_raw > 0   ? parseFloat((revenue_real / spend_raw).toFixed(2)) : null;
  const roas_delta = (roas_meta !== null && roas_real !== null)
    ? parseFloat((roas_real - roas_meta).toFixed(2))
    : null;

  /* Clasificación */
  const quality = classifyCampaign({ spend_raw, ctr, total_leads, purchased, roas_real, roas_delta });

  return {
    campaign_id:   meta?.campaign_id   ?? d1?.campaign_id   ?? null,
    campaign_name: meta?.campaign_name ?? d1?.campaign_name ?? '(sin nombre)',
    product_name:  d1?.product_name    ?? null,
    quality,
    meta: meta ? {
      spend_raw,
      spend_fmt:   spend_raw.toLocaleString('es-PY'),
      impressions,
      clicks,
      ctr:         parseFloat(ctr.toFixed(2)),
      cpc:         parseFloat(cpc.toFixed(0)),
      cpm:         parseFloat(cpm.toFixed(0)),
      roas_meta,
    } : null,
    d1: {
      total_leads,
      purchased,
      pending,
      cancelled,
      close_rate,
      revenue_real,
      revenue_fmt: revenue_real.toLocaleString('es-PY'),
      avg_ticket,
    },
    roas_real,
    roas_delta,
  };
}

/* ── Clasificación de calidad de campaña ── */
function classifyCampaign({ spend_raw, ctr, total_leads, purchased, roas_real, roas_delta }) {
  const closeRate = total_leads > 0 ? purchased / total_leads : 0;

  if (closeRate >= 0.25 && roas_real !== null && roas_real >= 1.5) return 'COMPRADOR';
  if (closeRate < 0.05  && ctr > 1.5 && total_leads > 2)          return 'CURIOSOS';
  if (roas_delta !== null && roas_delta < -0.8 && spend_raw > 50000) return 'META_OVERATRIB';
  if (spend_raw > 100000 && closeRate < 0.03 && total_leads > 0)   return 'QUEMANDO';
  if (ctr > 1.5 && total_leads === 0)                              return 'SIN_ATRIB';
  return 'NEUTRAL';
}

/* ── Generar alertas textuales ── */
function buildAlerts(rows) {
  const alerts = [];

  for (const row of rows) {
    const ctr       = row.meta?.ctr ?? 0;
    const closeRate = row.d1.total_leads > 0 ? row.d1.purchased / row.d1.total_leads : 0;
    const spend     = row.meta?.spend_raw ?? 0;
    const name      = row.campaign_name;

    if (row.quality === 'CURIOSOS') {
      alerts.push({ level: 'warn', msg: `${name} — CTR ${ctr}% pero solo ${row.d1.purchased} compras. Revisar coherencia anuncio → landing.` });
    }
    if (row.quality === 'COMPRADOR') {
      alerts.push({ level: 'ok', msg: `${name} — ${(closeRate * 100).toFixed(0)}% de cierre, ROAS real ${row.roas_real}x. Candidata a escalar.` });
    }
    if (row.quality === 'META_OVERATRIB') {
      alerts.push({ level: 'warn', msg: `${name} — ROAS Meta ${row.meta?.roas_meta}x vs Real ${row.roas_real}x. Meta está sobre-atribuyendo.` });
    }
    if (row.quality === 'QUEMANDO') {
      alerts.push({ level: 'danger', msg: `${name} — Gs. ${row.meta?.spend_fmt} gastado con ${(closeRate * 100).toFixed(0)}% de cierre. Evaluar pausa.` });
    }
    if (row.quality === 'SIN_ATRIB' && spend > 50000) {
      alerts.push({ level: 'info', msg: `${name} — Tráfico activo pero leads sin campaign_id. Verificar UTM parameters en Meta.` });
    }
  }

  return alerts;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
