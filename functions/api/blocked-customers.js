/* =========================================================
   /api/blocked-customers — Gestión de clientes bloqueados
   GET    → listar bloqueos (admin)
   POST   → crear bloqueo desde un lead_id (admin)
   DELETE → desbloquear por id de bloqueo (admin)
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

/* ── GET — listar todos los bloqueos ── */
export async function onRequestGet({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM blocked_customers ORDER BY created_at DESC LIMIT 200'
    ).all();

    return json({ ok: true, blocks: results || [] });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── POST — crear bloqueo desde lead_id ── */
export async function onRequestPost({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const { lead_id, reason, notes } = await request.json();
    if (!lead_id) return json({ ok: false, error: 'lead_id requerido' }, 400);

    const lead = await env.DB.prepare(
      'SELECT * FROM leads WHERE id = ? LIMIT 1'
    ).bind(lead_id).first();

    if (!lead) return json({ ok: false, error: 'Lead no encontrado' }, 404);

    let session_id = null;
    try {
      const r = await env.DB.prepare(
        'SELECT session_id FROM leads WHERE id = ? LIMIT 1'
      ).bind(lead_id).first();
      session_id = r?.session_id || null;
    } catch (_) {}

    await env.DB.prepare(`
      INSERT INTO blocked_customers (lead_id, name, phone, ip, user_agent, fbp, fbc, session_id, reason, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      lead_id,
      lead.name         || null,
      lead.phone        || null,
      lead.ip           || null,
      lead.user_agent   || null,
      lead.fbp          || null,
      lead.fbc          || null,
      session_id,
      reason            || null,
      notes             || null,
    ).run();

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── DELETE — desbloquear por id ── */
export async function onRequestDelete({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');
    if (!id) return json({ ok: false, error: 'id requerido' }, 400);

    await env.DB.prepare(
      "UPDATE blocked_customers SET active = 0, unblocked_at = datetime('now') WHERE id = ?"
    ).bind(parseInt(id)).run();

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── Helpers ── */
function isAuthorized(request, env) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  return token && token === env.ADMIN_PASSWORD.trim();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
