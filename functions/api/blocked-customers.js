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

/* ── POST — crear bloqueo desde lead_id O teléfono manual ── */
export async function onRequestPost({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const body               = await request.json();
    const { lead_id, reason, notes } = body;

    /* ── Modo manual: phone sin lead_id ── */
    if (!lead_id) {
      const phone = normalizePhone(body.phone || '');
      if (!phone) return json({ ok: false, error: 'Teléfono inválido. Formatos aceptados: 099X, 595X, +595X.' }, 400);

      const name = (body.name || '').trim() || null;

      /* Bloqueo activo ya existente */
      const activeBlock = await env.DB.prepare(
        'SELECT id FROM blocked_customers WHERE phone = ? AND active = 1 LIMIT 1'
      ).bind(phone).first();
      if (activeBlock) return json({ ok: false, error: 'already_blocked' }, 409);

      /* Bloqueo inactivo → reactivar en lugar de crear duplicado */
      const inactiveBlock = await env.DB.prepare(
        'SELECT id, name FROM blocked_customers WHERE phone = ? AND active = 0 ORDER BY id DESC LIMIT 1'
      ).bind(phone).first();
      if (inactiveBlock) {
        await env.DB.prepare(
          `UPDATE blocked_customers SET active = 1, unblocked_at = NULL,
           reason = ?, notes = ?, name = COALESCE(?, name) WHERE id = ?`
        ).bind(reason || null, notes || null, name, inactiveBlock.id).run();
        return json({ ok: true, reactivated: true });
      }

      /* Crear registro nuevo */
      await env.DB.prepare(
        'INSERT INTO blocked_customers (lead_id, name, phone, reason, notes) VALUES (NULL, ?, ?, ?, ?)'
      ).bind(name, phone, reason || null, notes || null).run();

      return json({ ok: true });
    }

    /* ── Modo lead: lead_id existente ── */
    const lead = await env.DB.prepare(
      'SELECT * FROM leads WHERE id = ? LIMIT 1'
    ).bind(lead_id).first();

    if (!lead) return json({ ok: false, error: 'Lead no encontrado' }, 404);

    /* Prevenir bloqueos duplicados — verificar por teléfono normalizado o raw */
    if (lead.phone) {
      const normPhone = normalizePhone(lead.phone) || lead.phone;
      const existingBlock = await env.DB.prepare(
        'SELECT id FROM blocked_customers WHERE phone IN (?, ?) AND active = 1 LIMIT 1'
      ).bind(lead.phone, normPhone).first();
      if (existingBlock) return json({ ok: false, error: 'already_blocked' }, 409);
    }

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

    const hard = url.searchParams.get('hard') === '1';
    if (hard) {
      /* Eliminar definitivamente solo registros inactivos (active = 0) */
      await env.DB.prepare(
        'DELETE FROM blocked_customers WHERE id = ? AND active = 0'
      ).bind(parseInt(id)).run();
    } else {
      await env.DB.prepare(
        "UPDATE blocked_customers SET active = 0, unblocked_at = datetime('now') WHERE id = ?"
      ).bind(parseInt(id)).run();
    }

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

/* Normaliza teléfono paraguayo a formato 595XXXXXXXXX (12 dígitos).
   Acepta: 099X / 59599X / +59599X — quita espacios, guiones, paréntesis. */
function normalizePhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  let norm;
  if      (digits.startsWith('595')) norm = digits;
  else if (digits.startsWith('0'))   norm = '595' + digits.slice(1);
  else if (digits.startsWith('9'))   norm = '595' + digits;
  else return '';
  return /^5959\d{8}$/.test(norm) ? norm : '';
}
