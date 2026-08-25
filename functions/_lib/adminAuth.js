/* =========================================================
   functions/_lib/adminAuth.js
   Sesión admin — JWT HMAC-SHA256, sin dependencias externas
   (Web Crypto API, disponible en el runtime de Cloudflare Workers).

   Reemplaza el modelo anterior donde ADMIN_PASSWORD viajaba como
   bearer token eterno guardado en localStorage. Ahora ADMIN_PASSWORD
   solo se usa para autenticar POST /api/admin-login; ese endpoint
   emite este JWT de sesión corta (por defecto 8h, ver admin-login.js),
   firmado con ADMIN_JWT_SECRET — una variable de entorno distinta de
   ADMIN_PASSWORD.
   ========================================================= */

const HEADER_B64 = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signAdminJWT(payload, secret, expiresInSeconds = 8 * 3600) {
  const now  = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + expiresInSeconds };
  const body = b64url(JSON.stringify(full));
  const data = `${HEADER_B64}.${body}`;
  const key  = await importHmacKey(secret);
  const sig  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${b64urlBuf(new Uint8Array(sig))}`;
}

/* Decodifica y verifica firma+expiración de un JWT admin crudo (sin mirar `type`).
   Uso interno — verifyAdminToken y verifyDeviceToken filtran por `type` encima de esto. */
async function verifyJWT(token, env) {
  if (!token || !env.ADMIN_JWT_SECRET) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, sigB64] = parts;
  const key = await importHmacKey(env.ADMIN_JWT_SECRET);
  const sig = b64ToUint8(sigB64);
  const ok  = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(`${header}.${body}`));
  if (!ok) return null;

  const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) return null;
  if (payload.role !== 'admin') return null;

  return payload;
}

/* Verifica el JWT de SESIÓN (corta duración, ver admin-login.js) recibido en el
   header Authorization: Bearer <token>. Devuelve el payload si es válido,
   null si falta el header, el token es inválido, expiró, no es admin, o es
   un JWT de dispositivo (type:'device') en vez de sesión.
   Nunca lanza — todos los endpoints admin-*.js pueden llamarla directo en un `if`. */
export async function verifyAdminToken(request, env) {
  try {
    const auth  = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '').trim();
    const payload = await verifyJWT(token, env);
    if (!payload || payload.type !== 'session') return null;
    return payload;
  } catch (_) {
    return null;
  }
}

/* Verifica el JWT de DISPOSITIVO CONOCIDO (30 días, ver admin-login.js).
   Solo lo acepta /api/admin-refresh — nunca da acceso directo a datos:
   únicamente puede canjearse por un JWT de sesión nuevo. */
export async function verifyDeviceToken(request, env) {
  try {
    const auth  = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '').trim();
    const payload = await verifyJWT(token, env);
    if (!payload || payload.type !== 'device') return null;
    return payload;
  } catch (_) {
    return null;
  }
}

/* Verifica el secret de SERVICIO A SERVICIO (SERVICE_SECRET), para llamadas
   entre sistemas sin sesión de usuario — ej. GitHub Actions crons llamando
   a /api/intelligence/run-bqe, /send-alerts, /stale-scanner.
   No es un JWT: token de larga vida propio, separado de ADMIN_PASSWORD y
   de ADMIN_JWT_SECRET. Comparación constant-time para evitar timing attacks. */
export async function verifyServiceToken(request, env) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || !env.SERVICE_SECRET) return false;

  const a = new TextEncoder().encode(token);
  const b = new TextEncoder().encode(env.SERVICE_SECRET);
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ── Helpers base64url ── */
function b64url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlBuf(buf) {
  return btoa(String.fromCharCode(...buf))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64ToUint8(str) {
  return Uint8Array.from(
    atob(str.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0),
  );
}
