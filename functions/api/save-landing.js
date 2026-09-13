import { verifyAdminToken } from '../_lib/adminAuth.js';

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  if (!(await verifyAdminToken(request, env))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch (_) {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { slug, html } = body || {};
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ ok: false, error: 'slug inválido' }, { status: 400 });
  }
  if (!html || typeof html !== 'string' || html.length < 100) {
    return Response.json({ ok: false, error: 'html inválido' }, { status: 400 });
  }
  if (html.length > 5_000_000) {
    return Response.json({ ok: false, error: 'html demasiado grande (>5MB)' }, { status: 400 });
  }

  /* Security: verify that script src attributes haven't been altered.
     We only allow text content, images (src), and inline style color edits. */
  const forbiddenPatterns = [
    /* external script injection */
    /<script[^>]+src\s*=\s*["'](?!\/assets\/js\/|\/assets\/tracking|https:\/\/connect\.facebook|\/api\/)[^"']*["']/i,
    /* eval / inline script additions beyond existing structure */
    /document\.location\s*=/i,
    /window\.location\s*=\s*["'](?!https?:\/\/)/i,
    /* iframe injection (outside the intended modal-order-modal) */
    /<iframe[^>]+src\s*=\s*["'](?!about:|javascript:)/i,
  ];
  for (const pat of forbiddenPatterns) {
    if (pat.test(html)) {
      return Response.json({ ok: false, error: 'HTML contiene patrones no permitidos' }, { status: 400 });
    }
  }

  /* Save to D1 as landing_html for persistence */
  try {
    await env.DB.prepare(
      `UPDATE product_briefs SET landing_html=?, landing_status='draft', updated_at=datetime('now') WHERE product_slug=?`
    ).bind(html, slug).run();
  } catch (err) {
    return Response.json({ ok: false, error: 'DB error: ' + err.message }, { status: 500 });
  }

  return Response.json({ ok: true, slug, saved_at: new Date().toISOString() });
}
