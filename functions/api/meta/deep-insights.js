/* =========================================================
   /api/meta/deep-insights — Métricas profundas de campañas (READ-ONLY)

   Endpoint analítico para CloudCode. NO usar para UI del admin.

   GET /api/meta/deep-insights
   Auth: Bearer {ADMIN_PASSWORD}

   Query params:
     ?since=YYYY-MM-DD       fecha inicio (default: últimos 30 días)
     ?until=YYYY-MM-DD       fecha fin (default: hoy)
     ?level=campaign         nivel: campaign | adset | ad (default: campaign)
     ?campaign_id=XXXX       filtrar por campaña específica (opcional)
     ?status=ARCHIVED        filtrar por effective_status: ACTIVE | PAUSED | ARCHIVED
                             omitir para obtener todos (incluye histórico)

   Métricas devueltas:
     Identidad    — campaign_name/id, adset_name/id, ad_name/id
     Delivery     — spend, impressions, reach, frequency, cpm, effective_status
     Clicks       — inline_link_clicks, ctr_link, cpc_link, outbound_clicks, unique_link_clicks
     Funnel       — landing_page_views, view_content, add_to_cart, initiate_checkout, purchases
     Costos       — cost_per_landing_page_view, cost_per_add_to_cart, cost_per_initiate_checkout, cost_per_purchase
     Revenue      — purchase_value, roas_meta
     Video        — avg_time_watched_ms/sec, plays, p25/p50/p75/p95/thruplay (null si no aplica)
     Raw          — _actions_raw para inspección manual

   Para creative body/title a nivel ad: usar /api/meta/ads?campaign_id=X
   NO modifica nada. No toca CAPI, Pixel, Purchase, D1, campañas ni anuncios.
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
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD) {
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

  const today      = new Date().toISOString().split('T')[0];
  const thirtyAgo  = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const since      = searchParams.get('since') || thirtyAgo;
  const until      = searchParams.get('until') || today;
  const level      = ['campaign', 'adset', 'ad'].includes(searchParams.get('level'))
    ? searchParams.get('level')
    : 'campaign';
  const campaignId   = searchParams.get('campaign_id') || null;
  const statusFilter = searchParams.get('status') || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return json({ ok: false, error: 'Formato de fecha inválido. Usar YYYY-MM-DD' }, 400);
  }

  try {
    const levelFields = {
      campaign: ['campaign_name', 'campaign_id'],
      adset:    ['campaign_name', 'campaign_id', 'adset_name', 'adset_id'],
      ad:       ['campaign_name', 'campaign_id', 'adset_name', 'adset_id', 'ad_name', 'ad_id'],
    };

    const metricFields = [
      /* Delivery */
      'impressions',
      'reach',
      'frequency',
      'spend',
      'cpm',
      /* Clicks — link-específicos (distintos de all-clicks) */
      'inline_link_clicks',
      'inline_link_click_ctr',
      'cost_per_inline_link_click',
      'outbound_clicks',
      'unique_inline_link_clicks',
      /* Clicks — all */
      'ctr',
      'clicks',
      'unique_clicks',
      /* Acciones del funnel (arrays: [{action_type, value}]) */
      'actions',
      'action_values',
      'cost_per_action_type',
      'unique_actions',
      /* Video (arrays: [{action_type: "video_view", value}]) */
      'video_avg_time_watched_actions',
      'video_play_actions',
      'video_p25_watched_actions',
      'video_p50_watched_actions',
      'video_p75_watched_actions',
      'video_p95_watched_actions',
      'video_thruplay_watched_actions',
    ];

    const fields = [...(levelFields[level] ?? levelFields.campaign), ...metricFields].join(',');

    const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights`);
    url.searchParams.set('fields',     fields);
    url.searchParams.set('time_range', JSON.stringify({ since, until }));
    url.searchParams.set('level',      level);
    url.searchParams.set('limit',      '200');
    url.searchParams.set('access_token', marketingToken);

    /* Filtros opcionales */
    const filtering = [];
    if (campaignId) {
      filtering.push({ field: 'campaign_id', operator: 'IN', value: [campaignId] });
    }
    if (statusFilter) {
      filtering.push({ field: 'effective_status', operator: 'IN', value: [statusFilter] });
    }
    if (filtering.length) {
      url.searchParams.set('filtering', JSON.stringify(filtering));
    }

    const res  = await fetch(url.toString(), { method: 'GET' });
    const data = await res.json();

    if (!res.ok) {
      return json({ ok: false, meta_error: data.error }, res.status);
    }

    const rows = (data.data || []).map(row => extractDeepMetrics(row));

    return json({
      ok:                 true,
      period:             { since, until },
      level,
      campaign_id_filter: campaignId,
      status_filter:      statusFilter,
      count:              rows.length,
      rows,
      paging:             data.paging,
      note:               level === 'ad'
        ? 'Para creative body/title usar /api/meta/ads?campaign_id=X o ?status=ARCHIVED'
        : undefined,
    });

  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── Extraer un tipo de acción del array actions ── */
function extractAction(actions, type) {
  if (!Array.isArray(actions)) return null;
  const match = actions.find(a => a.action_type === type);
  return match ? parseInt(match.value || 0) : null;
}

/* ── Extraer costo por tipo de acción ── */
function extractCostPerAction(costArr, type) {
  if (!Array.isArray(costArr)) return null;
  const match = costArr.find(a => a.action_type === type);
  return match ? parseFloat(parseFloat(match.value || 0).toFixed(2)) : null;
}

/* ── Extraer métrica de video del array correspondiente ── */
function extractVideoVal(videoArr, type) {
  if (!Array.isArray(videoArr)) return null;
  const match = videoArr.find(a => a.action_type === type);
  return match ? parseFloat(match.value || 0) : null;
}

/* ── Extraer outbound_clicks (Meta lo devuelve como array) ── */
function extractOutboundClicks(raw) {
  if (Array.isArray(raw)) {
    const match = raw.find(a => a.action_type === 'outbound_click');
    return match ? parseInt(match.value || 0) : 0;
  }
  /* Fallback: algunos niveles lo devuelven como string directamente */
  return parseInt(raw || 0);
}

/* ── Construir fila con métricas profundas nombradas ── */
function extractDeepMetrics(row) {
  const spend       = parseFloat(row.spend       || 0);
  const impressions = parseInt(row.impressions   || 0);

  /* Clicks link-específicos */
  const inlineLinkClicks    = parseInt(row.inline_link_clicks      || 0);
  const inlineLinkCtr       = parseFloat(row.inline_link_click_ctr || 0);
  const cpcLink             = parseFloat(row.cost_per_inline_link_click || 0);
  const uniqueLinkClicks    = parseInt(row.unique_inline_link_clicks || 0);
  const outboundClicks      = extractOutboundClicks(row.outbound_clicks);

  /* Funnel events */
  const actions         = row.actions          || [];
  const costPerAction   = row.cost_per_action_type || [];

  const landingPageViews = extractAction(actions, 'landing_page_view');

  /* view_content — puede venir como 'view_content' o 'onsite_web_view_content' */
  const viewContent = extractAction(actions, 'view_content')
    ?? extractAction(actions, 'onsite_web_view_content');

  /* add_to_cart */
  const addToCart = extractAction(actions, 'add_to_cart')
    ?? extractAction(actions, 'onsite_web_add_to_cart');

  /* initiate_checkout */
  const initiateCheckout = extractAction(actions, 'initiate_checkout')
    ?? extractAction(actions, 'onsite_web_initiate_checkout');

  /* purchases */
  const purchases = extractAction(actions, 'purchase')
    ?? extractAction(actions, 'onsite_web_purchase');

  /* purchase value → ROAS Meta */
  const purchaseValue = (row.action_values || [])
    .filter(a => a.action_type === 'purchase')
    .reduce((sum, a) => sum + parseFloat(a.value || 0), 0);

  const roas_meta = spend > 0 ? parseFloat((purchaseValue / spend).toFixed(2)) : null;

  /* Costo por evento de funnel */
  const costPerLpv  = extractCostPerAction(costPerAction, 'landing_page_view');
  const costPerAtc  = extractCostPerAction(costPerAction, 'add_to_cart')
    ?? extractCostPerAction(costPerAction, 'onsite_web_add_to_cart');
  const costPerIco  = extractCostPerAction(costPerAction, 'initiate_checkout')
    ?? extractCostPerAction(costPerAction, 'onsite_web_initiate_checkout');
  const costPerPur  = extractCostPerAction(costPerAction, 'purchase');

  /* Video */
  const videoAvgMs   = extractVideoVal(row.video_avg_time_watched_actions, 'video_view');
  const videoPlays   = extractVideoVal(row.video_play_actions,              'video_view');
  const videoP25     = extractVideoVal(row.video_p25_watched_actions,       'video_view');
  const videoP50     = extractVideoVal(row.video_p50_watched_actions,       'video_view');
  const videoP75     = extractVideoVal(row.video_p75_watched_actions,       'video_view');
  const videoP95     = extractVideoVal(row.video_p95_watched_actions,       'video_view');
  const videoThru    = extractVideoVal(row.video_thruplay_watched_actions,  'video_view');

  const hasVideo = videoPlays !== null || videoAvgMs !== null;

  return {
    /* Identidad */
    campaign_id:   row.campaign_id   ?? null,
    campaign_name: row.campaign_name ?? null,
    adset_id:      row.adset_id      ?? null,
    adset_name:    row.adset_name    ?? null,
    ad_id:         row.ad_id         ?? null,
    ad_name:       row.ad_name       ?? null,

    /* Delivery */
    spend,
    impressions,
    reach:      parseInt(row.reach      || 0),
    frequency:  parseFloat(parseFloat(row.frequency || 0).toFixed(2)),
    cpm:        parseFloat(parseFloat(row.cpm       || 0).toFixed(2)),

    /* Clicks — link-específicos (los que Meta llama "link clicks" en Ads Manager) */
    inline_link_clicks: inlineLinkClicks,
    ctr_link:           parseFloat(inlineLinkCtr.toFixed(3)),
    cpc_link:           cpcLink  > 0 ? parseFloat(cpcLink.toFixed(2))  : null,
    outbound_clicks:    outboundClicks,
    unique_link_clicks: uniqueLinkClicks,

    /* Clicks — all (incluye clics en perfil, likes, etc.) */
    ctr_all:      parseFloat(parseFloat(row.ctr    || 0).toFixed(3)),
    clicks_all:   parseInt(row.clicks        || 0),
    unique_clicks: parseInt(row.unique_clicks || 0),

    /* Funnel — eventos nombrados */
    landing_page_views: landingPageViews,
    view_content:       viewContent,
    add_to_cart:        addToCart,
    initiate_checkout:  initiateCheckout,
    purchases,
    purchase_value:     parseFloat(purchaseValue.toFixed(2)),
    roas_meta,

    /* Costo por evento de funnel */
    cost_per_landing_page_view:  costPerLpv,
    cost_per_add_to_cart:        costPerAtc,
    cost_per_initiate_checkout:  costPerIco,
    cost_per_purchase:           costPerPur,

    /* Video (null si el anuncio no es video) */
    video: hasVideo ? {
      avg_time_watched_ms:  videoAvgMs,
      avg_time_watched_sec: videoAvgMs !== null
        ? parseFloat((videoAvgMs / 1000).toFixed(1))
        : null,
      plays:           videoPlays  !== null ? parseInt(videoPlays)  : null,
      p25_completions: videoP25    !== null ? parseInt(videoP25)    : null,
      p50_completions: videoP50    !== null ? parseInt(videoP50)    : null,
      p75_completions: videoP75    !== null ? parseInt(videoP75)    : null,
      p95_completions: videoP95    !== null ? parseInt(videoP95)    : null,
      thruplay:        videoThru   !== null ? parseInt(videoThru)   : null,
    } : null,

    /* Raw — para inspección manual de CloudCode */
    _actions_raw: actions,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
