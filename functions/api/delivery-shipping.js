/* =========================================================
   /api/delivery-shipping
   GET  ?date=YYYY-MM-DD         → count de ventas compradas + historial reciente
   POST { date, deliveryAmount, encomiendaAmount }  → distribuye en DAM Finanzas
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

/* ── GET: cuántas ventas compradas hubo ese día + historial reciente ── */
export async function onRequestGet({ request, env }) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url    = new URL(request.url);
  const date   = url.searchParams.get('date');
  const month  = url.searchParams.get('month');
  const getAll = url.searchParams.get('all') === '1';

  /* ── Modo mes: ?month=YYYY-MM ── */
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT * FROM shipping_history WHERE date >= ? AND date <= ? ORDER BY date DESC`
      ).bind(`${month}-01`, `${month}-31`).all();
      return json({ ok: true, mode: 'month', month, recentHistory: results || [] });
    } catch (err) {
      return json({ ok: false, error: err.message }, 500);
    }
  }

  /* ── Modo todos: ?all=1 — últimos 90 registros ── */
  if (getAll) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT * FROM shipping_history ORDER BY date DESC LIMIT 90`
      ).all();
      return json({ ok: true, mode: 'all', recentHistory: results || [] });
    } catch (err) {
      return json({ ok: false, error: err.message }, 500);
    }
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ ok: false, error: 'date requerida (YYYY-MM-DD)' }, 400);
  }

  try {
    const { startUTC, endUTC } = paraguayDayBounds(date);
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM leads WHERE status = 'purchased' AND purchased_at >= ? AND purchased_at < ?`
    ).bind(startUTC, endUTC).first();
    const purchasedCount = Number(row?.count || 0);

    /* Historial: entrada del día solicitado + últimas 30 entradas */
    let history       = null;
    let recentHistory = [];
    try {
      const histRow = await env.DB.prepare(
        `SELECT * FROM shipping_history WHERE date = ?`
      ).bind(date).first();
      if (histRow) history = histRow;

      const recent = await env.DB.prepare(
        `SELECT * FROM shipping_history ORDER BY date DESC LIMIT 30`
      ).all();
      recentHistory = recent?.results || [];
    } catch (_) { /* tabla puede no existir aún */ }

    return json({ ok: true, date, purchasedCount, history, recentHistory });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── POST: distribuir total de envíos en DAM Finanzas ── */
export async function onRequestPost({ request, env }) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const body = await request.json();
    const { date, deliveryAmount, encomiendaAmount } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ ok: false, error: 'date requerida (YYYY-MM-DD)' }, 400);
    }

    const delivery   = Math.max(0, Math.round(Number(deliveryAmount)   || 0));
    const encomienda = Math.max(0, Math.round(Number(encomiendaAmount) || 0));
    const total      = delivery + encomienda;

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
      body:    JSON.stringify({ date, totalShipping: total, deliveryAmount: delivery, encomiendaAmount: encomienda }),
    });
    const dfBody = await dfRes.json().catch(() => ({}));

    if (!dfRes.ok) {
      console.error('SHIPPING_DISTRIBUTE_FAILED', date, dfRes.status, JSON.stringify(dfBody));
      return json({ ok: false, error: 'Error en DAM Finanzas', detail: dfBody }, 502);
    }

    /* Guardar historial en D1 */
    const dfCount   = dfBody.count || 0;
    const dfPerSale = dfBody.perSale || (dfCount > 0 ? Math.floor(total / dfCount) : 0);
    try {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO shipping_history
          (date, delivery_amount, encomienda_amount, total_shipping, purchased_count, per_sale, dam_finanzas_count, applied_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(date, delivery, encomienda, total, purchasedCount, dfPerSale, dfCount).run();
    } catch (histErr) {
      console.warn('SHIPPING_HISTORY_SAVE_FAILED', histErr?.message);
    }

    console.log('SHIPPING_DISTRIBUTE_OK', date, `delivery=${delivery}`, `encomienda=${encomienda}`, `total=${total}`, `purchasedD1=${purchasedCount}`);
    return json({
      ok:              true,
      date,
      deliveryAmount:  delivery,
      encomiendaAmount: encomienda,
      totalShipping:   total,
      purchasedCount,
      perSaleShipping: purchasedCount > 0 ? Math.round(total / purchasedCount) : 0,
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
