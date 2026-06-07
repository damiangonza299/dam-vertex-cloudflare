/* =========================================================
   /api/meta/insights — Leer métricas de rendimiento (READ-ONLY)

   REQUISITOS PREVIOS (no configurar hasta tener el token):
     Cloudflare Dashboard > Settings > Env Vars:
       META_MARKETING_TOKEN = token con scope ads_read + read_insights
       META_AD_ACCOUNT_ID   = act_XXXXXXXXXX

   Query params:
     ?since=2025-05-01   → fecha inicio (YYYY-MM-DD), por defecto: últimos 7 días
     ?until=2025-05-17   → fecha fin (YYYY-MM-DD), por defecto: hoy
     ?level=campaign     → nivel: campaign | adset | ad (por defecto: campaign)

   IMPORTANTE:
   - Solo GET. No modifica nada.
   - No toca CAPI, Pixel, Purchase, D1 ni admin.
   - read_insights es necesario además de ads_read para este endpoint.
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
  /* Auth interna */
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const marketingToken = env.META_MARKETING_TOKEN;
  const rawAccountId   = env.META_AD_ACCOUNT_ID || '';
  const adAccountId    = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;

  if (!marketingToken || !rawAccountId) {
    return json({
      ok: false,
      error: 'META_MARKETING_TOKEN o META_AD_ACCOUNT_ID no configurados',
      hint: 'Configurar en Cloudflare Dashboard > Settings > Environment Variables',
    }, 503);
  }

  const { searchParams } = new URL(request.url);

  /* Rango de fechas — por defecto últimos 7 días */
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0];
  const since = searchParams.get('since') || sevenDaysAgo;
  const until = searchParams.get('until') || today;
  const level = ['campaign', 'adset', 'ad'].includes(searchParams.get('level'))
    ? searchParams.get('level')
    : 'campaign';

  /* Validación simple de fechas */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return json({ ok: false, error: 'Formato de fecha inválido. Usar YYYY-MM-DD' }, 400);
  }

  try {
    /* Campos base disponibles en todos los niveles */
    const metricFields = [
      'impressions',
      'reach',
      'frequency',
      'clicks',
      'unique_clicks',
      'spend',
      'cpc',
      'cpm',
      'ctr',
      'cpp',
      'actions',
      'action_values',
      'cost_per_action_type',
    ];

    /* Campos de ID/nombre que existen solo en ciertos niveles */
    const levelFields = {
      campaign: ['campaign_name', 'campaign_id'],
      adset:    ['campaign_name', 'campaign_id', 'adset_name', 'adset_id'],
      ad:       ['campaign_name', 'campaign_id', 'adset_name', 'adset_id', 'ad_name', 'ad_id'],
    };

    const fields = [...(levelFields[level] ?? levelFields.campaign), ...metricFields].join(',');

    const url = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights`
    );
    url.searchParams.set('fields', fields);
    url.searchParams.set('time_range', JSON.stringify({ since, until }));
    url.searchParams.set('level', level);
    url.searchParams.set('access_token', marketingToken);

    const res  = await fetch(url.toString(), { method: 'GET' });
    const data = await res.json();

    if (!res.ok) {
      return json({ ok: false, meta_error: data.error }, res.status);
    }

    /* Calcular ROAS básico si hay datos de purchase */
    const enriched = (data.data || []).map(row => {
      const spend = parseFloat(row.spend) || 0;
      const purchaseValue = (row.action_values || [])
        .filter(a => a.action_type === 'purchase')
        .reduce((sum, a) => sum + parseFloat(a.value || 0), 0);
      const roas = spend > 0 ? (purchaseValue / spend) : null;
      return { ...row, _roas: roas !== null ? parseFloat(roas.toFixed(2)) : null };
    });

    return json({
      ok:      true,
      period:  { since, until },
      level,
      insights: enriched,
      paging:   data.paging,
    });

  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
