/* =========================================================
   /api/delivery-shipping
   GET  ?date=YYYY-MM-DD         → count de ventas compradas ese día (Paraguay)
   POST { date, totalShipping }  → envía al DAM Finanzas para distribuir entre reportes
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

/* ── GET: cuántas ventas compradas hubo ese día Paraguay ── */
export async function onRequestGet({ request, env }) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url  = new URL(request.url);
  const date = url.searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ ok: false, error: 'date requerida (YYYY-MM-DD)' }, 400);
  }

  try {
    const { startUTC, endUTC } = paraguayDayBounds(date);
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM leads WHERE status = 'purchased' AND purchased_at >= ? AND purchased_at < ?`
    ).bind(startUTC, endUTC).first();

    return json({ ok: true, date, purchasedCount: Number(row?.count || 0) });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── POST: distribuir total de envíos en DAM Finanzas ── */
export async function onRequestPost({ request, env }) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const body = await request.json();
    const { date, totalShipping } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ ok: false, error: 'date requerida (YYYY-MM-DD)' }, 400);
    }
    if (typeof totalShipping !== 'number' || totalShipping < 0) {
      return json({ ok: false, error: 'totalShipping debe ser número >= 0' }, 400);
    }

    /* Contar ventas compradas en D1 para ese día Paraguay */
    const { startUTC, endUTC } = paraguayDayBounds(date);
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM leads WHERE status = 'purchased' AND purchased_at >= ? AND purchased_at < ?`
    ).bind(startUTC, endUTC).first();
    const purchasedCount = Number(row?.count || 0);

    /* Enviar a DAM Finanzas */
    const secret = env.DAM_FINANZAS_WEBHOOK_SECRET || '';
    if (!secret) {
      return json({ ok: false, error: 'DAM_FINANZAS_WEBHOOK_SECRET no configurado' }, 500);
    }

    const endpoint = 'https://us-central1-dam-finanzas-cf863.cloudfunctions.net/onShippingDistribute';
    const dfRes = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-dam-vertex-secret': secret },
      body:    JSON.stringify({ date, totalShipping }),
    });
    const dfBody = await dfRes.json().catch(() => ({}));

    if (!dfRes.ok) {
      console.error('SHIPPING_DISTRIBUTE_FAILED', date, dfRes.status, JSON.stringify(dfBody));
      return json({ ok: false, error: 'Error en DAM Finanzas', detail: dfBody }, 502);
    }

    console.log('SHIPPING_DISTRIBUTE_OK', date, totalShipping, 'purchasedD1=', purchasedCount);
    return json({
      ok:              true,
      date,
      totalShipping,
      purchasedCount,
      perSaleShipping: purchasedCount > 0 ? Math.round(totalShipping / purchasedCount) : 0,
      damFinanzas:     dfBody,
    });

  } catch (err) {
    console.error('DELIVERY_SHIPPING_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── Helpers ── */
function paraguayDayBounds(dateISO) {
  // Paraguay = UTC-4. El día Paraguay comienza a las 04:00 UTC.
  const startUTC = new Date(`${dateISO}T04:00:00.000Z`);
  const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
  return {
    startUTC: startUTC.toISOString().replace('T', ' ').slice(0, 19),
    endUTC:   endUTC.toISOString().replace('T', ' ').slice(0, 19),
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
