/* =========================================================
   POST /api/admin-refresh — Canjea un JWT de dispositivo conocido
   (30 días, ver /api/admin-login) por un JWT de sesión nuevo (8h),
   sin pedir contraseña. Permite "recordar este dispositivo" sin
   volver al modelo de token eterno que reemplazó la migración a JWT.
   ========================================================= */

import { verifyDeviceToken, signAdminJWT } from '../_lib/adminAuth.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const payload = await verifyDeviceToken(request, env);
    if (!payload) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const token = await signAdminJWT({ role: 'admin', type: 'session' }, env.ADMIN_JWT_SECRET, 8 * 3600);
    return json({ ok: true, token });

  } catch (err) {
    console.error('ADMIN_REFRESH_ERROR', err.message);
    return json({ ok: false, error: 'internal_error' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
