import { verifyAdminToken } from '../_lib/adminAuth.js';

export async function onRequestGet(ctx) {
  const { request, env } = ctx;

  if (!(await verifyAdminToken(request, env))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url  = new URL(request.url);
  const slug = url.searchParams.get('slug') || '';
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ ok: false, error: 'slug requerido' }, { status: 400 });
  }

  /* Derive the public URL of the landing */
  const host       = request.headers.get('host') || 'dam-vertex-cloudflare.pages.dev';
  const targetUrl  = `https://${host}/${slug}/`;
  const apiKey     = env.PAGESPEED_API_KEY || '';
  const cats       = 'performance,accessibility,seo';
  const psUrl      = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=mobile&category=${cats}${apiKey ? '&key=' + apiKey : ''}`;

  try {
    const res  = await fetch(psUrl, { cf: { cacheTtl: 60 } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return Response.json({ ok: false, error: err?.error?.message || 'PageSpeed error' }, { status: 502 });
    }
    const data = await res.json();
    const cats = data.lighthouseResult?.categories || {};
    const score = (key) => cats[key] ? Math.round(cats[key].score * 100) : null;

    return Response.json({
      ok: true,
      url: targetUrl,
      scores: {
        performance:   score('performance'),
        accessibility: score('accessibility'),
        seo:           score('seo'),
      },
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
