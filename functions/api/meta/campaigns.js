/* =========================================================
   /api/meta/campaigns — Leer campañas activas (READ-ONLY)

   REQUISITOS PREVIOS (no configurar hasta tener el token):
     Cloudflare Dashboard > Settings > Env Vars:
       META_MARKETING_TOKEN = token con scope ads_read
       META_AD_ACCOUNT_ID   = act_XXXXXXXXXX

   IMPORTANTE:
   - Este Worker NO toca CAPI, Pixel, Purchase, D1 ni admin.
   - META_MARKETING_TOKEN es distinto de META_ACCESS_TOKEN (CAPI).
   - Solo permite GET. No modifica campañas.
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
  /* Auth interna — reutiliza ADMIN_PASSWORD existente */
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const marketingToken = env.META_MARKETING_TOKEN;
  const rawAccountId   = env.META_AD_ACCOUNT_ID || '';
  const adAccountId    = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;

  /* Sin token configurado: retorna estado claro, sin error de producción */
  if (!marketingToken || !rawAccountId) {
    return json({
      ok: false,
      error: 'META_MARKETING_TOKEN o META_AD_ACCOUNT_ID no configurados',
      hint: 'Configurar en Cloudflare Dashboard > Settings > Environment Variables',
    }, 503);
  }

  try {
    const fields = [
      'id',
      'name',
      'status',
      'effective_status',
      'objective',
      'daily_budget',
      'lifetime_budget',
      'start_time',
      'stop_time',
    ].join(',');

    const url = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/campaigns`
    );
    url.searchParams.set('fields', fields);
    url.searchParams.set('filtering', JSON.stringify([
      { field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] },
    ]));
    url.searchParams.set('access_token', marketingToken);

    const res  = await fetch(url.toString(), { method: 'GET' });
    const data = await res.json();

    if (!res.ok) {
      return json({ ok: false, meta_error: data.error }, res.status);
    }

    return json({ ok: true, campaigns: data.data, paging: data.paging });

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
