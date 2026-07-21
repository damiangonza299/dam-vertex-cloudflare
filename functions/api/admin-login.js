/* =========================================================
   POST /api/admin-login — Login del panel admin
   Reemplaza el flujo anterior (ADMIN_PASSWORD usada directamente
   como bearer token eterno). Ahora ADMIN_PASSWORD solo autentica
   este login; el cliente recibe:
     - token       → JWT de sesión, 8h (type:'session'), es lo que
                     viaja en Authorization en todos los demás
                     endpoints admin (ver functions/_lib/adminAuth.js)
     - deviceToken → JWT de "dispositivo conocido", 30 días
                     (type:'device'). No sirve para leer datos —
                     solo puede canjearse por un token de sesión
                     nuevo en /api/admin-refresh, sin re-pedir
                     contraseña mientras sea el mismo dispositivo.
   ========================================================= */

import { signAdminJWT } from '../_lib/adminAuth.js';

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
    let body;
    try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'invalid_json' }, 400); }

    const password = body?.password || '';

    if (!env.ADMIN_PASSWORD || !env.ADMIN_JWT_SECRET) {
      return json({ ok: false, error: 'Admin auth not configured' }, 500);
    }
    if (!password) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    /* Comparación constant-time vía digest SHA-256 — evita timing attacks
       de comparación carácter a carácter sobre la contraseña maestra. */
    const enc   = new TextEncoder();
    const aHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(password)));
    const bHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(env.ADMIN_PASSWORD.trim())));

    let diff = 0;
    for (let i = 0; i < aHash.length; i++) diff |= aHash[i] ^ bHash[i];
    if (diff !== 0) return json({ ok: false, error: 'Unauthorized' }, 401);

    const token       = await signAdminJWT({ role: 'admin', type: 'session' }, env.ADMIN_JWT_SECRET, 8 * 3600);
    const deviceToken = await signAdminJWT({ role: 'admin', type: 'device'  }, env.ADMIN_JWT_SECRET, 30 * 24 * 3600);
    return json({ ok: true, token, deviceToken });

  } catch (err) {
    console.error('ADMIN_LOGIN_ERROR', err.message);
    return json({ ok: false, error: 'internal_error' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
