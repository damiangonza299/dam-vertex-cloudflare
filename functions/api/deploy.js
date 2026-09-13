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

  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return Response.json({ ok: false, error: 'GITHUB_TOKEN no configurado' }, { status: 500 });
  }

  const REPO    = 'damiangonza299/dam-vertex-cloudflare';
  const PATH    = `public/${slug}/index.html`;
  const HEADERS = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Content-Type':  'application/json',
    'User-Agent':    'dam-vertex',
  };

  /* Obtener SHA del archivo actual */
  const fileRes  = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, { headers: HEADERS });
  const fileData = await fileRes.json().catch(() => ({}));
  const sha      = fileData.sha;
  if (!sha) {
    return Response.json({ ok: false, error: `No SHA: ${JSON.stringify(fileData).slice(0, 200)}` }, { status: 502 });
  }

  /* Commit */
  const content   = btoa(unescape(encodeURIComponent(html)));
  const commitRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
    method:  'PUT',
    headers: HEADERS,
    body:    JSON.stringify({ message: `product-studio: update ${slug}`, content, sha, branch: 'main' }),
  });
  const result = await commitRes.json().catch(() => ({}));

  if (result.commit) {
    return Response.json({
      ok:      true,
      message: '✅ Commiteado en GitHub — los cambios aparecen cuando hagas wrangler deploy',
      commit:  result.commit.sha?.slice(0, 7),
    });
  }

  return Response.json({ ok: false, error: JSON.stringify(result) }, { status: 502 });
}
