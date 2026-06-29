/* =========================================================
   /api/meta/ads — Leer anuncios por cuenta (READ-ONLY)

   REQUISITOS PREVIOS (no configurar hasta tener el token):
     Cloudflare Dashboard > Settings > Env Vars:
       META_MARKETING_TOKEN = token con scope ads_read
       META_AD_ACCOUNT_ID   = act_XXXXXXXXXX

   Query params opcionales:
     ?campaign_id=XXXX  → filtra anuncios de una campaña específica
     ?status=ACTIVE     → filtra por status (ACTIVE, PAUSED, ARCHIVED)

   IMPORTANTE:
   - Solo GET. No modifica anuncios.
   - No toca CAPI, Pixel, Purchase, D1 ni admin.
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

  const { searchParams } = new URL(request.url);
  const account        = searchParams.get('account') === 'pyg' ? 'pyg' : 'usd';
  const marketingToken = env.META_MARKETING_TOKEN;
  const rawAccountId   = account === 'pyg'
    ? (env.META_AD_ACCOUNT_ID_PYG || '')
    : (env.META_AD_ACCOUNT_ID || '');
  const adAccountId    = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;

  if (!marketingToken || !rawAccountId) {
    return json({
      ok: false,
      error: account === 'pyg'
        ? 'META_MARKETING_TOKEN o META_AD_ACCOUNT_ID_PYG no configurados'
        : 'META_MARKETING_TOKEN o META_AD_ACCOUNT_ID no configurados',
      hint: 'Configurar en Cloudflare Dashboard > Settings > Environment Variables',
    }, 503);
  }
  const campaignId = searchParams.get('campaign_id') || null;
  const statusFilter = searchParams.get('status') || null;

  try {
    const fields = [
      'id',
      'name',
      'status',
      'effective_status',
      'campaign_id',
      'adset_id',
      'creative{id,name,thumbnail_url,body,title}',
      'created_time',
      'updated_time',
    ].join(',');

    const filtering = [];
    if (statusFilter) {
      filtering.push({ field: 'effective_status', operator: 'IN', value: [statusFilter] });
    }

    const url = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/ads`
    );
    url.searchParams.set('fields', fields);
    if (filtering.length) url.searchParams.set('filtering', JSON.stringify(filtering));
    if (campaignId)        url.searchParams.set('campaign_id', campaignId);
    url.searchParams.set('access_token', marketingToken);

    const res  = await fetch(url.toString(), { method: 'GET' });
    const data = await res.json();

    if (!res.ok) {
      return json({ ok: false, meta_error: data.error }, res.status);
    }

    return json({ ok: true, account, ads: data.data, paging: data.paging });

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
