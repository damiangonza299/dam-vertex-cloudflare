import { verifyAdminToken } from '../_lib/adminAuth.js';

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  if (new URL(request.url).searchParams.get('verify')) {
    const token = env.CLOUDFLARE_API_TOKEN?.trim().replace(/^﻿/, '');
    const res   = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    return Response.json({ token_preview: token?.slice(0, 8), verify: data });
  }
  return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  if (!(await verifyAdminToken(request, env))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch (_) {
    return Response.json({ ok: false, error: 'Body inválido' }, { status: 400 });
  }

  const { html, slug } = body;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ ok: false, error: 'slug inválido' }, { status: 400 });
  }
  if (!html || html.length < 100) {
    return Response.json({ ok: false, error: 'html vacío' }, { status: 400 });
  }

  const ACCOUNT_ID   = env.CLOUDFLARE_ACCOUNT_ID?.trim().replace(/^﻿/, '');
  const API_TOKEN    = env.CLOUDFLARE_API_TOKEN?.trim().replace(/^﻿/, '');
  const PROJECT_NAME = 'dam-vertex-cloudflare';

  if (!ACCOUNT_ID || !API_TOKEN) {
    return Response.json({ ok: false, error: 'Secrets de Cloudflare no configurados' }, { status: 500 });
  }

  console.log('Slug:', slug, '| HTML length:', html.length);

  /* Paso 1 — Obtener JWT de upload */
  const tokenRes  = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/upload-token`,
    { headers: { 'Authorization': `Bearer ${API_TOKEN}` } }
  );
  const tokenData = await tokenRes.json();
  console.log('Paso 1 status:', tokenRes.status, '| success:', tokenData.success);
  if (!tokenData.success) {
    return Response.json({ ok: false, step: 1, error: JSON.stringify(tokenData.errors) }, { status: 502 });
  }
  const jwt = tokenData.result?.jwt;

  /* Paso 2 — Hash SHA-256 truncado a 32 chars (MD5 no disponible en crypto.subtle) */
  const encoded    = new TextEncoder().encode(html);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashHex    = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  console.log('Paso 2 hash:', hashHex);

  /* Paso 3 — Subir archivo con JWT */
  const base64Content = btoa(unescape(encodeURIComponent(html)));
  const uploadRes     = await fetch('https://api.cloudflare.com/client/v4/pages/assets/upload', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify([{ key: hashHex, value: base64Content, base64: true, metadata: { contentType: 'text/html' } }]),
  });
  const uploadData = await uploadRes.json().catch(() => ({}));
  console.log('Paso 3 status:', uploadRes.status, '| result:', JSON.stringify(uploadData).substring(0, 200));
  if (!uploadRes.ok) {
    return Response.json({ ok: false, step: 3, error: JSON.stringify(uploadData) }, { status: 502 });
  }

  /* Paso 4 — Crear deployment con manifest */
  const deployRes  = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`,
    {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ manifest: { [`/${slug}/index.html`]: hashHex } }),
    }
  );
  const deployData = await deployRes.json().catch(() => ({}));
  console.log('Paso 4 status:', deployRes.status, '| success:', deployData.success);
  console.log('Paso 4 result:', JSON.stringify(deployData).substring(0, 300));

  if (deployData.success) {
    return Response.json({
      ok:      true,
      message: '✅ Deployado en Cloudflare — cambios en vivo en segundos',
      url:     deployData.result?.url,
    });
  }

  return Response.json({ ok: false, step: 4, error: JSON.stringify(deployData.errors) }, { status: 502 });
}
