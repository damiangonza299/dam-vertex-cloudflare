/* =========================================================
   /api/meta-event — Proxy CAPI hacia Meta
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { event_name, event_id, product, lead, client, num_items } = body;

    const pixelId     = env.META_PIXEL_ID;
    const accessToken = env.META_ACCESS_TOKEN;
    const testCode    = env.META_TEST_EVENT_CODE;

    if (!pixelId || !accessToken) {
      return json({ ok: false, error: 'CAPI not configured' }, 500);
    }

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = client?.user_agent || request.headers.get('User-Agent') || '';

    /* Build user_data */
    const user_data = {
      client_ip_address: ip,
      client_user_agent: ua,
    };
    if (client?.fbp) user_data.fbp = client.fbp;
    if (client?.fbc) user_data.fbc = client.fbc;
    if (lead?.email) user_data.em  = [await sha256(lead.email)];

    const phME = normPhone(lead?.phone);
    if (phME) {
      const phHash = await sha256(phME);
      user_data.ph          = [phHash];
      user_data.external_id = [phHash];
    }

    /* Build custom_data */
    const custom_data = {};
    if (product) {
      custom_data.content_name  = product.name;
      custom_data.content_ids   = [product.slug];
      custom_data.content_type  = 'product';
      custom_data.value         = product.price;
      custom_data.currency      = 'PYG';
      if (num_items != null) custom_data.num_items = num_items;
    }

    const event = {
      event_name,
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         event_id || genId(event_name, product?.slug),
      event_source_url: client?.page_url || '',
      action_source:    'website',
      user_data,
      custom_data,
    };

    const payload = {
      data: [event],
      ...(testCode && { test_event_code: testCode }),
    };

    const res = await fetch(
      `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      },
    );

    const result = await res.json();
    return json({ ok: true, meta: result });

  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── Helpers ── */
function normPhone(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('595')) return d.slice(0, 12);
  if (d.startsWith('0'))   return '595' + d.slice(1);
  return '595' + d;
}

async function sha256(str) {
  if (!str) return null;
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function genId(event, slug) {
  return `${event}_${slug || 'x'}_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).slice(2, 6)}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
