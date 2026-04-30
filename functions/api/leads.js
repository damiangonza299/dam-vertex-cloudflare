/* =========================================================
   /api/leads — Guardar lead en D1
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
    const { product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent } = body;

    if (!name || !phone || !product_name) {
      return json({ ok: false, error: 'Campos requeridos: name, phone, product_name' }, 400);
    }

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = user_agent || request.headers.get('User-Agent') || '';

    const stmt = env.DB.prepare(`
      INSERT INTO leads (product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.bind(
      product_name,
      name.trim(),
      phone.trim(),
      email?.trim() || null,
      city?.trim()  || null,
      value  || null,
      currency || 'PYG',
      fbp  || null,
      fbc  || null,
      ua,
      ip,
    ).run();

    return json({ ok: true, lead_id: result.meta?.last_row_id });

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
