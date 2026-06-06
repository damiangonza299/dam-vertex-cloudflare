/* =========================================================
   GET /api/intelligence/creative-quality
   Motor de Calidad de Creativos

   Cruza: D1 leads + lead_quality + Meta Ads API
   Calcula por ad_id: compras reales, revenue real, leads vencidos,
   cancelados, puntaje promedio, CPA real, tráfico basura.

   Params: ?since=YYYY-MM-DD&until=YYYY-MM-DD&level=ad|adset|campaign
   Auth: Bearer ADMIN_PASSWORD
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const META_API_VERSION = 'v21.0';

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url   = new URL(request.url);
  const today = new Date().toISOString().split('T')[0];
  const ago30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const since = url.searchParams.get('since') || ago30;
  const until = url.searchParams.get('until') || today;
  const level = url.searchParams.get('level') || 'ad'; // ad | adset | campaign

  const marketingToken = env.META_MARKETING_TOKEN;
  const rawAccountId   = env.META_AD_ACCOUNT_ID || '';
  const adAccountId    = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;

  try {
    // Datos D1 por ad_id
    const [d1ByAd, lqByAd] = await Promise.all([
      fetchD1ByAd(env.DB, since, until, level),
      fetchLQByAd(env.DB, since, until, level),
    ]);

    // Meta API (opcional si no hay token)
    let metaByKey = new Map();
    if (marketingToken && rawAccountId) {
      try {
        const metaRows = await fetchMetaByLevel(adAccountId, marketingToken, since, until, level);
        metaRows.forEach(r => {
          const key = level === 'ad' ? r.ad_id : level === 'adset' ? r.adset_id : r.campaign_id;
          metaByKey.set(String(key || ''), r);
        });
      } catch (e) {
        console.warn('CREATIVE_QUALITY_META_WARN', e.message);
      }
    }

    // Cruzar datos
    const rows = [];
    const allKeys = new Set([...d1ByAd.keys(), ...lqByAd.keys()]);

    for (const key of allKeys) {
      const d1  = d1ByAd.get(key) || {};
      const lq  = lqByAd.get(key) || {};
      const meta = metaByKey.get(key) || null;

      const total_leads   = parseInt(d1.total_leads  || 0);
      const purchased     = parseInt(d1.purchased    || 0);
      const cancelled     = parseInt(d1.cancelled    || 0);
      const pending       = parseInt(d1.pending      || 0);
      const revenue_real  = parseFloat(d1.revenue_real || 0);

      const dead_leads    = parseInt(lq.dead_leads   || 0);
      const avg_score     = parseFloat(lq.avg_score  || 0);
      const data_days     = parseInt(d1.data_days    || 1);

      const spend         = meta ? parseFloat(meta.spend || 0) : 0;
      const impressions   = meta ? parseInt(meta.impressions || 0) : 0;
      const clicks        = meta ? parseInt(meta.clicks || 0) : 0;
      const ctr           = meta ? parseFloat(meta.ctr || 0) : null;
      const cpc           = meta ? parseFloat(meta.cpc || 0) : null;
      const cpm           = meta ? parseFloat(meta.cpm || 0) : null;

      // Métricas derivadas
      const purchase_rate      = total_leads > 0 ? purchased / total_leads : 0;
      const dead_lead_rate     = total_leads > 0 ? dead_leads / total_leads : 0;
      const cancel_rate        = total_leads > 0 ? cancelled / total_leads : 0;
      const cpa_real           = purchased > 0 && spend > 0 ? Math.round(spend / purchased) : null;
      const garbage_score      = Math.round(dead_lead_rate * 100 + cancel_rate * 50);
      const buyer_score        = Math.round(purchase_rate * 60 + avg_score * 0.4);
      const classification     = classifyCreative({ purchase_rate, dead_lead_rate, avg_score, cpa_real, spend, total_leads, purchased, data_days });

      rows.push({
        key,
        level,
        name: d1.name || meta?.ad_name || meta?.adset_name || meta?.campaign_name || key,
        campaign_id:   d1.campaign_id || meta?.campaign_id || null,
        campaign_name: d1.campaign_name || meta?.campaign_name || null,
        adset_id:      d1.adset_id || meta?.adset_id || null,
        ad_id:         level === 'ad' ? key : null,
        product_slug:  d1.product_slug || null,
        d1: {
          total_leads,
          purchased,
          pending,
          cancelled,
          dead_leads,
          revenue_real,
          revenue_fmt: revenue_real.toLocaleString('es-PY'),
          avg_score:   Math.round(avg_score),
        },
        meta: meta ? { spend, spend_fmt: spend.toLocaleString('es-PY'), impressions, clicks, ctr, cpc, cpm } : null,
        metrics: {
          purchase_rate:    parseFloat((purchase_rate * 100).toFixed(1)),
          dead_lead_rate:   parseFloat((dead_lead_rate * 100).toFixed(1)),
          cancel_rate:      parseFloat((cancel_rate * 100).toFixed(1)),
          cpa_real,
          garbage_score,
          buyer_score,
        },
        classification,
        classification_label: classificationLabel(classification),
      });
    }

    // Ordenar por buyer_score DESC, garbage_score ASC
    rows.sort((a, b) => {
      const bsDiff = b.metrics.buyer_score - a.metrics.buyer_score;
      if (bsDiff !== 0) return bsDiff;
      return a.metrics.garbage_score - b.metrics.garbage_score;
    });

    return json({ ok: true, period: { since, until }, level, rows });

  } catch (err) {
    console.error('CREATIVE_QUALITY_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

async function fetchD1ByAd(DB, since, until, level) {
  const groupCol = level === 'ad' ? 'ad_id' : level === 'adset' ? 'adset_id' : 'campaign_id';
  const nameCol  = level === 'ad' ? 'ad_name' : level === 'adset' ? 'adset_name' : 'campaign_name';

  const { results } = await DB.prepare(`
    SELECT
      ${groupCol}                                                              AS key,
      MAX(${nameCol})                                                          AS name,
      MAX(campaign_id)                                                         AS campaign_id,
      MAX(campaign_name)                                                       AS campaign_name,
      MAX(adset_id)                                                            AS adset_id,
      MAX(product_slug)                                                        AS product_slug,
      COUNT(*)                                                                 AS total_leads,
      SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END)                   AS purchased,
      SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END)                   AS pending,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)                   AS cancelled,
      SUM(CASE WHEN status = 'purchased' THEN COALESCE(value, 0) ELSE 0 END)  AS revenue_real,
      CAST((julianday(MAX(created_at)) - julianday(MIN(created_at))) AS INTEGER) + 1 AS data_days
    FROM leads
    WHERE created_at >= ? AND created_at < date(?, '+1 day')
      AND ${groupCol} IS NOT NULL
    GROUP BY ${groupCol}
    ORDER BY total_leads DESC
  `).bind(since, until).all();

  const map = new Map();
  (results || []).forEach(r => map.set(String(r.key || ''), r));
  return map;
}

async function fetchLQByAd(DB, since, until, level) {
  const groupCol = level === 'ad' ? 'ad_id' : level === 'adset' ? 'adset_id' : 'campaign_id';

  try {
    const { results } = await DB.prepare(`
      SELECT
        ${groupCol}                                                AS key,
        COUNT(*)                                                   AS total,
        SUM(CASE WHEN is_dead_lead = 1 THEN 1 ELSE 0 END)         AS dead_leads,
        AVG(CASE WHEN status_snapshot = 'purchased'
              THEN quality_score END)                              AS avg_score
      FROM lead_quality
      WHERE processed_at >= ? AND processed_at < date(?, '+1 day')
        AND ${groupCol} IS NOT NULL
      GROUP BY ${groupCol}
    `).bind(since, until).all();

    const map = new Map();
    (results || []).forEach(r => map.set(String(r.key || ''), r));
    return map;
  } catch (e) {
    console.warn('LQ_BY_AD_WARN', e.message);
    return new Map();
  }
}

async function fetchMetaByLevel(adAccountId, token, since, until, level) {
  const levelMap = { ad: 'ad', adset: 'adset', campaign: 'campaign' };
  const metaLevel = levelMap[level] || 'ad';

  const fields = level === 'ad'
    ? 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm'
    : level === 'adset'
    ? 'adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm'
    : 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm';

  const metaUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights`);
  metaUrl.searchParams.set('fields', fields);
  metaUrl.searchParams.set('time_range', JSON.stringify({ since, until }));
  metaUrl.searchParams.set('level', metaLevel);
  metaUrl.searchParams.set('limit', '500');
  metaUrl.searchParams.set('access_token', token);

  const res  = await fetch(metaUrl.toString());
  const data = await res.json();
  if (!res.ok) throw new Error(`Meta API: ${data.error?.message || res.status}`);
  return data.data || [];
}

function classifyCreative({ purchase_rate, dead_lead_rate, avg_score, cpa_real, spend, total_leads, purchased, data_days }) {
  const hasEnoughData = total_leads >= 10 && purchased >= 3 && (data_days || 1) >= 3;
  if (!hasEnoughData)                                                          return 'observar';
  if (purchase_rate >= 0.25 && avg_score >= 70 && dead_lead_rate < 0.4)       return 'ganador';
  if (purchase_rate >= 0.15 && dead_lead_rate < 0.3)                          return 'prometedor';
  if (dead_lead_rate >= 0.6 && purchase_rate < 0.05)                          return 'basura';
  if (spend > 100000 && purchase_rate < 0.03)                                 return 'para_pausar';
  if (purchase_rate >= 0.1 && purchase_rate < 0.15)                           return 'normal';
  return 'observar';
}

function classificationLabel(c) {
  const labels = {
    ganador:     'Creativo Ganador',
    prometedor:  'Creativo Prometedor',
    basura:      'Creativo con Tráfico Basura',
    para_pausar: 'Creativo para Pausar',
    normal:      'Creativo Normal',
    observar:    'Creativo a Observar',
  };
  return labels[c] || c;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
