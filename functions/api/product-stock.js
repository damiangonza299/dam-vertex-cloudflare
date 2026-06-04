/* =========================================================
   /api/product-stock
   GET ?slug=<slug>  → público — stock de un producto
   GET               → público — todos los productos
   PATCH             → admin   — actualizar stock
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const slug = url.searchParams.get('slug');
  try {
    if (slug) {
      const row = await env.DB.prepare(
        'SELECT * FROM products WHERE slug = ?'
      ).bind(slug).first();
      return json({ ok: true, product: row ? parseProduct(row) : null });
    }
    const { results } = await env.DB.prepare(
      'SELECT * FROM products ORDER BY id'
    ).all();
    return json({ ok: true, products: (results || []).map(parseProduct) });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestPatch({ request, env }) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const body = await request.json();
    const { slug, name, stock_total, variants_json, active } = body;
    if (!slug) return json({ ok: false, error: 'slug requerido' }, 400);

    const varJson = typeof variants_json === 'string'
      ? variants_json
      : (variants_json != null ? JSON.stringify(variants_json) : null);

    await env.DB.prepare(`
      INSERT INTO products (slug, name, stock_total, variants_json, active, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        name          = excluded.name,
        stock_total   = excluded.stock_total,
        variants_json = excluded.variants_json,
        active        = excluded.active,
        updated_at    = datetime('now')
    `).bind(
      slug,
      name || slug,
      typeof stock_total === 'number' ? stock_total : 0,
      varJson,
      typeof active === 'number' ? active : 1,
    ).run();

    const row = await env.DB.prepare(
      'SELECT * FROM products WHERE slug = ?'
    ).bind(slug).first();
    return json({ ok: true, product: parseProduct(row) });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

function parseProduct(row) {
  if (!row) return null;
  let variants = null;
  if (row.variants_json) {
    try { variants = JSON.parse(row.variants_json); } catch (_) {}
  }
  let variants_meta = null;
  if (row.variants_meta_json) {
    try { variants_meta = JSON.parse(row.variants_meta_json); } catch (_) {}
  }
  return {
    id:            row.id,
    slug:          row.slug,
    name:          row.name,
    stock_total:   row.stock_total,
    variants:      variants,
    variants_meta: variants_meta,
    unit_cost:     row.unit_cost     || 0,
    default_price: row.default_price || 0,
    min_stock:     row.min_stock     || 0,
    active:        row.active,
    updated_at:    row.updated_at,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
