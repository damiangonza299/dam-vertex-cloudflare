import { verifyAdminToken } from '../_lib/adminAuth.js';

export async function onRequestGet(ctx) {
  const { request, env } = ctx;

  if (!(await verifyAdminToken(request, env))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const slug = new URL(request.url).searchParams.get('slug') || '';
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ ok: false, error: 'slug requerido' }, { status: 400 });
  }

  const url = `https://damvertex.com/${slug}/`;

  try {
    /* 3 HEAD requests para medir TTFB promedio */
    const times = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      await fetch(url, { method: 'HEAD' });
      times.push(Date.now() - t0);
    }

    const html   = await fetch(url).then(r => r.text());
    const ttfb   = Math.round(times.reduce((a, b) => a + b) / times.length);
    const sizeKb = Math.round(new Blob([html]).size / 1024);

    let score = 100;
    if (ttfb  > 200) score -= 10;
    if (ttfb  > 400) score -= 20;
    if (ttfb  > 600) score -= 20;
    if (sizeKb > 100) score -= 10;
    if (sizeKb > 200) score -= 10;

    const rating = score >= 90 ? '🟢 Excelente' : score >= 70 ? '🟡 Bueno' : '🔴 Mejorar';

    return Response.json({ ok: true, url, ttfb, size_kb: sizeKb, score, rating });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
