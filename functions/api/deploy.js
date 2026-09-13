import { verifyAdminToken } from '../_lib/adminAuth.js';

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  if (!(await verifyAdminToken(request, env))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  console.log('GITHUB_TOKEN presente:', !!env.GITHUB_TOKEN);
  console.log('GITHUB_TOKEN primeros 4 chars:', env.GITHUB_TOKEN?.slice(0, 4));

  const GITHUB_TOKEN = env.GITHUB_TOKEN || '';
  if (!GITHUB_TOKEN) {
    return Response.json({ ok: false, error: 'GITHUB_TOKEN no configurado' }, { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch (_) {
    return Response.json({ ok: false, error: 'Body inválido' }, { status: 400 });
  }

  console.log('HTML length:', body?.html?.length);
  console.log('Slug:', body?.slug);
  console.log('HTML_PREVIEW:', body?.html?.substring(0, 500));

  const { html, slug } = body;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ ok: false, error: 'slug inválido' }, { status: 400 });
  }
  if (!html || html.length < 100) {
    return Response.json({ ok: false, error: 'html vacío' }, { status: 400 });
  }

  const REPO   = 'damiangonza299/dam-vertex-cloudflare';
  const PATH   = `public/${slug}/index.html`;
  const BRANCH = 'main';
  const HEADERS = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Content-Type':  'application/json',
    'User-Agent':    'dam-vertex-product-studio',
  };

  /* Obtener SHA del archivo actual */
  const fileRes  = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, { headers: HEADERS });
  const fileData = await fileRes.json().catch(() => ({}));
  if (!fileRes.ok && fileRes.status !== 404) {
    return Response.json({ ok: false, error: `GitHub getfile error: ${fileData.message || fileRes.status}` }, { status: 502 });
  }
  const sha = fileData.sha || undefined;
  console.log('SHA obtenido:', sha);

  /* Encode HTML como base64 */
  const content = btoa(unescape(encodeURIComponent(html)));

  /* Commit */
  const commitRes  = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
    method:  'PUT',
    headers: HEADERS,
    body:    JSON.stringify({
      message: `product-studio: update landing ${slug}`,
      content,
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  const result = await commitRes.json().catch(() => ({}));
  console.log('GitHub PUT status:', commitRes.status);

  if (result.commit) {
    return Response.json({
      ok:      true,
      message: '✅ Deployado en GitHub — Cloudflare Pages building automáticamente',
      commit:  result.commit.sha?.slice(0, 7),
    });
  }

  return Response.json({ ok: false, error: result.message || JSON.stringify(result) }, { status: 502 });
}
