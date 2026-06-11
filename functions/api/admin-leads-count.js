/* =========================================================
   /api/admin-leads-count
   GET ?date=YYYY-MM-DD  → cuenta leads creados ese día (hora Paraguay)
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
    // DST-aware: Paraguay is UTC-4 (Apr-Sep, PYT) or UTC-3 (Oct-Mar, PYST).
    // operational_date_py is set atomically at lead INSERT using getParaguayDateString() —
    // the same source that onLeadsCountUpdate uses. Using it as primary key guarantees
    // that D1 count and Firebase shopifyOrdersTotal always reflect the same leads.
    // The created_at fallback covers pre-migration13 leads that lack operational_date_py.
    const startUTC = getParaguayDayStartUTC(date);
    const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
    const startStr = startUTC.toISOString().replace('T', ' ').slice(0, 19);
    const endStr   = endUTC.toISOString().replace('T', ' ').slice(0, 19);

    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM leads
       WHERE (operational_date_py = ?)
          OR (operational_date_py IS NULL AND created_at >= ? AND created_at < ?)`
    ).bind(date, startStr, endStr).first();

    return json({ ok: true, date, count: Number(row?.count || 0) });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

function getParaguayDayStartUTC(dateStr) {
  for (const h of [3, 4]) {
    const candidate = new Date(`${dateStr}T0${h}:00:00.000Z`);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(candidate);
    const pp = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    if (`${pp.year}-${pp.month}-${pp.day}` === dateStr && pp.hour === '00' && pp.minute === '00') {
      return candidate;
    }
  }
  return new Date(`${dateStr}T04:00:00.000Z`); // fallback seguro
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
