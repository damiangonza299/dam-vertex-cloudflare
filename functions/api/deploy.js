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

  /* Paso 1 — Crear deployment */
  const deployRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`,
    {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    }
  );
  const deploy = await deployRes.json();
  console.log('Paso 1 status:', deployRes.status, '| success:', deploy.success);
  console.log('Paso 1 result:', JSON.stringify(deploy).substring(0, 400));

  if (!deploy.success) {
    return Response.json({ ok: false, step: 1, error: JSON.stringify(deploy.errors) }, { status: 502 });
  }

  const deploymentId = deploy.result?.id;
  if (!deploymentId) {
    return Response.json({ ok: false, step: 1, error: 'No deploymentId en respuesta' }, { status: 502 });
  }

  /* Paso 2 — Subir archivo con manifest */
  const encoded    = new TextEncoder().encode(html);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashHex    = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  const filePath   = `/${slug}/index.html`;

  const formData = new FormData();
  formData.append('manifest', JSON.stringify({ [filePath]: hashHex }));
  formData.append(filePath, new Blob([html], { type: 'text/html' }), 'index.html');

  const uploadRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${deploymentId}/files`,
    {
      method:  'PUT',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
      body:    formData,
    }
  );
  const upload = await uploadRes.json().catch(() => ({}));
  console.log('Paso 2 status:', uploadRes.status, '| result:', JSON.stringify(upload).substring(0, 300));

  if (uploadRes.ok) {
    return Response.json({
      ok:      true,
      message: '✅ Deployado en Cloudflare — cambios en vivo en segundos',
      deployment_id: deploymentId,
    });
  }

  return Response.json({ ok: false, step: 2, error: JSON.stringify(upload) }, { status: 502 });
}
