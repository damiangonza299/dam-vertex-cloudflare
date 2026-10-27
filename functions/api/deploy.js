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

  /* ── Validar slug ── */
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ ok: false, error: 'slug inválido' }, { status: 400 });
  }
  if (!html || html.length < 100) {
    return Response.json({ ok: false, error: 'html vacío' }, { status: 400 });
  }

  /* ── Protección crítica: detectar JS corruptos por el editor visual ──
     El editor puede escapar operadores JS dentro de <script>:
     => se vuelve &gt; , && se vuelve &amp;&amp; , etc.
     Si esto pasa, el CTA no abre el modal y la landing queda rota. */
  const scriptBlocks = [...html.matchAll(/<script[\s\S]*?<\/script>/gi)].map(m => m[0]);
  for (const block of scriptBlocks) {
    if (/&amp;|&lt;|&gt;|&#x3[CE];/i.test(block)) {
      return Response.json({
        ok:    false,
        error: 'HTML rechazado: el editor corrompió operadores JavaScript dentro de <script> (encontrado &amp; o &gt;). Revertir cambios en el editor y volver a intentar.',
      }, { status: 422 });
    }
  }

  /* ── Ruta permitida: solo landing del slug, nunca _headers ni JS compartidos ── */
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

  /* ── Obtener SHA del archivo actual en GitHub ── */
  const fileRes  = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, { headers: HEADERS });
  const fileData = await fileRes.json().catch(() => ({}));
  const sha      = fileData.sha;
  if (!sha) {
    return Response.json({ ok: false, error: `Archivo no encontrado en GitHub: ${PATH}. ¿El slug es correcto?` }, { status: 502 });
  }

  /* ── Commit a GitHub ── */
  const content   = btoa(unescape(encodeURIComponent(html)));
  const commitRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
    method:  'PUT',
    headers: HEADERS,
    body:    JSON.stringify({
      message: `product-studio: update ${slug}`,
      content,
      sha,
      branch: 'main',
    }),
  });
  const result = await commitRes.json().catch(() => ({}));

  if (!result.commit) {
    /* SHA conflict: alguien commiteó después de que Product Studio leyó el SHA */
    if (commitRes.status === 409 || commitRes.status === 422) {
      return Response.json({
        ok:    false,
        error: 'Conflicto de versión: el archivo fue modificado desde que abriste el editor. Recargá Product Studio y volvé a aplicar tus cambios.',
      }, { status: 409 });
    }
    return Response.json({ ok: false, error: JSON.stringify(result) }, { status: 502 });
  }

  /* ── Disparar deploy en Cloudflare Pages vía API ──
     Esto hace que los cambios estén en producción sin tener que correr wrangler manual. */
  let deployTriggered = false;
  const CF_TOKEN = env.CLOUDFLARE_API_TOKEN?.trim().replace(/^﻿/, '');
  if (CF_TOKEN) {
    try {
      /* Obtener account_id del token */
      const acctRes  = await fetch('https://api.cloudflare.com/client/v4/accounts', {
        headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
      });
      const acctData = await acctRes.json().catch(() => ({}));
      const accountId = acctData.result?.[0]?.id;

      if (accountId) {
        const deployRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/dam-vertex-cloudflare/deployments`,
          {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ branch: 'main' }),
          }
        );
        const deployData = await deployRes.json().catch(() => ({}));
        deployTriggered = !!deployData.result?.id;
      }
    } catch (_) { /* no bloquea el flujo */ }
  }

  return Response.json({
    ok:      true,
    message: deployTriggered
      ? `✅ Commiteado en GitHub y deploy disparado en Cloudflare. Listo en ~30 segundos.`
      : `✅ Commiteado en GitHub (commit: ${result.commit.sha?.slice(0, 7)}). Deploy manual requerido.`,
    commit:          result.commit.sha?.slice(0, 7),
    deploy_triggered: deployTriggered,
  });
}
