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
  const API_TOKEN    = env.CLOUDFLARE_API_TOKEN;
  const PROJECT_NAME = 'dam-vertex-cloudflare';

  if (!ACCOUNT_ID || !API_TOKEN) {
    return Response.json({ ok: false, error: 'Secrets de Cloudflare no configurados' }, { status: 500 });
  }

  console.log('HTML length:', html.length);
  console.log('Slug:', slug);
  console.log('HTML_PREVIEW:', html.substring(0, 500));

  const formData = new FormData();
  formData.append(
    `public/${slug}/index.html`,
    new Blob([html], { type: 'text/html' }),
    'index.html'
  );

  const deployRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`,
    {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${API_TOKEN}` },
      body:    formData,
    }
  );

  const result = await deployRes.json();
  console.log('CF deploy status:', deployRes.status);
  console.log('CF deploy result:', JSON.stringify(result).substring(0, 300));

  if (result.success) {
    return Response.json({
      ok:      true,
      message: '✅ Deployado en Cloudflare — cambios en vivo en segundos',
      url:     result.result?.url,
    });
  }

  return Response.json({ ok: false, error: JSON.stringify(result.errors) }, { status: 502 });
}
