/* =========================================================
   /api/admin-leads — Gestión de leads (solo admin)
   GET  → listar leads
   PATCH → cambiar status
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

/* ── GET — listar todos los leads ── */
export async function onRequestGet({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM leads ORDER BY created_at DESC LIMIT 500'
    ).all();

    return json({ ok: true, leads: results || [] });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── PATCH — cambiar status (cancelar) ── */
export async function onRequestPatch({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const { id, status } = await request.json();
    const allowed = ['cancelled', 'pending'];
    if (!id || !allowed.includes(status)) {
      return json({ ok: false, error: 'id y status válido requeridos' }, 400);
    }

    await env.DB.prepare(
      'UPDATE leads SET status = ? WHERE id = ?'
    ).bind(status, id).run();

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── DELETE — eliminar lead ── */
export async function onRequestDelete({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');
    if (!id) return json({ ok: false, error: 'id requerido' }, 400);

    await env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(parseInt(id)).run();
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
