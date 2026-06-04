/* =========================================================
   /api/admin-leads-count
   GET ?date=YYYY-MM-DD  → cuenta leads creados ese día (Paraguay UTC-4)
   Público — solo lectura, sin datos sensibles.
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date'); // YYYY-MM-DD en hora Paraguay

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ ok: false, error: 'date requerida (YYYY-MM-DD)' }, 400);
  }

  try {
    // Paraguay = UTC-4 → el día empieza a las 04:00 UTC
    const startUTC = new Date(`${date}T04:00:00.000Z`);
    const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM leads WHERE created_at >= ? AND created_at < ?`
    ).bind(
      startUTC.toISOString().replace('T', ' ').slice(0, 19),
      endUTC.toISOString().replace('T', ' ').slice(0, 19)
    ).first();

    return json({ ok: true, date, count: Number(row?.count || 0) });
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
