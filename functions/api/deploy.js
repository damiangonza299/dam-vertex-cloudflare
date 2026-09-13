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

  const boundary   = '----FormBoundary' + Math.random().toString(36).slice(2);
  const multipart  = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${slug}/index.html"`,
    `Content-Type: text/html`,
    ``,
    html,
    `--${boundary}--`,
  ].join('\r\n');

  const deployRes  = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type':  `multipart/form-data; boundary=${boundary}`,
      },
      body: multipart,
    }
  );
  const deployData = await deployRes.json().catch(() => ({}));
  console.log('Deploy status:', deployRes.status);
  console.log('Deploy result:', JSON.stringify(deployData));

  if (deployData.success) {
    return Response.json({
      ok:      true,
      message: '✅ Deployado en Cloudflare — cambios en vivo en segundos',
      url:     deployData.result?.url,
    });
  }

  return Response.json({ ok: false, status: deployRes.status, error: JSON.stringify(deployData) }, { status: 502 });
}
