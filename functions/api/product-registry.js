/* =========================================================
   /api/product-registry — Product Studio CRUD + DAM Finanzas sync
   Admin auth required: Authorization: Bearer ADMIN_PASSWORD

   GET  ?slug=X          → get one brief
   GET  (no slug)        → list all briefs (summary)
   POST body.action      → create | sync_to_finanzas | activate | archive | refresh_insync | save_landing
   PATCH ?slug=X         → update brief fields (partial)
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DAM_FINANZAS_BASE = 'https://us-central1-dam-finanzas-cf863.cloudfunctions.net';

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

function auth(request, env) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  return env.ADMIN_PASSWORD && token === env.ADMIN_PASSWORD.trim();
}

/* ── GET ── */
export async function onRequestGet({ request, env }) {
  if (!auth(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const url  = new URL(request.url);
  const slug = url.searchParams.get('slug');

  try {
    if (slug) {
      const brief = await env.DB.prepare(
        'SELECT * FROM product_briefs WHERE product_slug = ?'
      ).bind(slug).first();
      if (!brief) return json({ ok: false, error: 'not_found' }, 404);
      return json({ ok: true, brief: parseBrief(brief) });
    }

    const { results } = await env.DB.prepare(
      `SELECT pb.id, pb.product_slug, pb.status, pb.landing_status,
              pb.dam_finanzas_id, pb.dam_finanzas_status, pb.created_at, pb.updated_at,
              pb.op_json, pb.insights_json,
              p.name, p.stock_total, p.active
       FROM product_briefs pb
       LEFT JOIN products p ON p.slug = pb.product_slug
       ORDER BY pb.updated_at DESC`
    ).all();

    return json({ ok: true, briefs: (results || []).map(parseBriefSummary) });
  } catch (err) {
    console.error('PRODUCT_REGISTRY_GET', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── POST ── */
export async function onRequestPost({ request, env }) {
  if (!auth(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const { action } = body;

  try {
    if (!action || action === 'create') return handleCreate(body, env);
    if (action === 'sync_to_finanzas')  return handleSync(body, env);
    if (action === 'activate')          return handleActivate(body, env);
    if (action === 'archive')           return handleArchive(body, env);
    if (action === 'refresh_insync')    return handleRefreshInsync(body, env);
    if (action === 'save_landing')      return handleSaveLanding(body, env);
    return json({ ok: false, error: `accion_desconocida: ${action}` }, 400);
  } catch (err) {
    console.error('PRODUCT_REGISTRY_POST', action, err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── PATCH ── */
export async function onRequestPatch({ request, env }) {
  if (!auth(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const url  = new URL(request.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return json({ ok: false, error: 'slug requerido' }, 400);

  let body = {};
  try { body = await request.json(); } catch (_) {}

  try {
    const existing = await env.DB.prepare(
      'SELECT * FROM product_briefs WHERE product_slug = ?'
    ).bind(slug).first();
    if (!existing) return json({ ok: false, error: 'not_found' }, 404);

    const allowed = ['op_json','strategic_json','visual_json','research_json','insights_json','landing_html','landing_status'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = ?`);
        vals.push(typeof body[key] === 'object' ? JSON.stringify(body[key]) : body[key]);
      }
    }
    if (!sets.length) return json({ ok: false, error: 'sin_campos' }, 400);

    sets.push("updated_at = datetime('now')");
    vals.push(slug);

    await env.DB.prepare(
      `UPDATE product_briefs SET ${sets.join(', ')} WHERE product_slug = ?`
    ).bind(...vals).run();

    /* if op_json changed, mirror key fields to products table */
    if (body.op_json) {
      const op = typeof body.op_json === 'string' ? JSON.parse(body.op_json) : body.op_json;
      await mirrorOpToProducts(slug, op, env);
    }

    const updated = await env.DB.prepare(
      'SELECT * FROM product_briefs WHERE product_slug = ?'
    ).bind(slug).first();
    return json({ ok: true, brief: parseBrief(updated) });
  } catch (err) {
    console.error('PRODUCT_REGISTRY_PATCH', slug, err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── Handlers ── */

async function handleCreate(body, env) {
  const { slug, op_json, strategic_json, visual_json } = body;
  if (!slug) return json({ ok: false, error: 'slug requerido' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first();
  if (existing) return json({ ok: false, error: 'slug_ya_existe' }, 409);

  const op  = op_json || {};
  const opS = typeof op === 'string' ? op : JSON.stringify(op);
  const stS = typeof strategic_json === 'string' ? strategic_json : JSON.stringify(strategic_json || {});
  const viS = typeof visual_json    === 'string' ? visual_json    : JSON.stringify(visual_json    || {});

  const name         = (typeof op === 'object' ? op.name : JSON.parse(opS).name) || slug;
  const productType  = (typeof op === 'object' ? op.type : JSON.parse(opS).type) || 'simple';
  const stockTotal   = (typeof op === 'object' ? op.stock : JSON.parse(opS).stock) || 0;
  const variantsJson = buildVariantsJson(op);
  const unitCost     = (typeof op === 'object' ? op.cost   : JSON.parse(opS).cost)          || 0;
  const defaultPrice = (typeof op === 'object' ? op.price  : JSON.parse(opS).price)         || 0;
  const minStock     = (typeof op === 'object' ? op.min_stock : JSON.parse(opS).min_stock)  || 0;
  const comparePrice = (typeof op === 'object' ? op.compare_price : JSON.parse(opS).compare_price) || 0;

  await env.DB.prepare(`
    INSERT INTO products (slug, name, stock_total, variants_json, active,
                          unit_cost, default_price, min_stock,
                          status, product_type, compare_price, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'draft', ?, ?, datetime('now'))
  `).bind(slug, name, stockTotal, variantsJson, unitCost, defaultPrice, minStock, productType, comparePrice).run();

  await env.DB.prepare(`
    INSERT INTO product_briefs (product_slug, op_json, strategic_json, visual_json,
                                status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))
  `).bind(slug, opS, stS, viS).run();

  const brief = await env.DB.prepare(
    'SELECT * FROM product_briefs WHERE product_slug = ?'
  ).bind(slug).first();
  return json({ ok: true, action: 'created', brief: parseBrief(brief) }, 201);
}

async function handleSync(body, env) {
  const { slug } = body;
  if (!slug) return json({ ok: false, error: 'slug requerido' }, 400);

  const brief = await env.DB.prepare(
    'SELECT * FROM product_briefs WHERE product_slug = ?'
  ).bind(slug).first();
  if (!brief) return json({ ok: false, error: 'brief_not_found' }, 404);

  const secret = env.DAM_FINANZAS_WEBHOOK_SECRET || '';
  if (!secret) return json({ ok: false, error: 'DAM_FINANZAS_WEBHOOK_SECRET no configurado' }, 500);

  let finanzasRes, finanzasData;
  try {
    finanzasRes  = await fetch(`${DAM_FINANZAS_BASE}/importProductFromVertex`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-dam-vertex-secret': secret },
      body:    JSON.stringify({ productSlug: slug }),
    });
    finanzasData = await finanzasRes.json().catch(() => ({}));
  } catch (fetchErr) {
    await env.DB.prepare(
      "UPDATE product_briefs SET dam_finanzas_status='failed', dam_finanzas_note=?, updated_at=datetime('now') WHERE product_slug=?"
    ).bind(fetchErr.message, slug).run();
    return json({ ok: false, error: 'fetch_error', detail: fetchErr.message }, 502);
  }

  if (!finanzasRes.ok || !finanzasData.productId) {
    const note = finanzasData?.error || `HTTP ${finanzasRes.status}`;
    await env.DB.prepare(
      "UPDATE product_briefs SET dam_finanzas_status='failed', dam_finanzas_note=?, updated_at=datetime('now') WHERE product_slug=?"
    ).bind(note, slug).run();
    return json({ ok: false, error: 'finanzas_error', detail: note, finanzas: finanzasData });
  }

  await env.DB.prepare(
    "UPDATE product_briefs SET dam_finanzas_id=?, dam_finanzas_status='linked', dam_finanzas_note=?, status='pending_sync', updated_at=datetime('now') WHERE product_slug=?"
  ).bind(finanzasData.productId, finanzasData.action || 'linked', slug).run();

  const updated = await env.DB.prepare(
    'SELECT * FROM product_briefs WHERE product_slug = ?'
  ).bind(slug).first();
  return json({ ok: true, action: finanzasData.action, productId: finanzasData.productId, brief: parseBrief(updated) });
}

async function handleActivate(body, env) {
  const { slug } = body;
  if (!slug) return json({ ok: false, error: 'slug requerido' }, 400);

  const brief = await env.DB.prepare(
    'SELECT dam_finanzas_status FROM product_briefs WHERE product_slug = ?'
  ).bind(slug).first();
  if (!brief) return json({ ok: false, error: 'brief_not_found' }, 404);

  /* Activation requires DAM Finanzas link OR explicit force flag */
  if (brief.dam_finanzas_status !== 'linked' && !body.force) {
    return json({ ok: false, error: 'dam_finanzas_no_linked', hint: 'Sincronizá con DAM Finanzas primero, o usá force:true' }, 400);
  }

  await env.DB.batch([
    env.DB.prepare("UPDATE products       SET active=1, status='active',  updated_at=datetime('now') WHERE slug=?").bind(slug),
    env.DB.prepare("UPDATE product_briefs SET status='active', updated_at=datetime('now')             WHERE product_slug=?").bind(slug),
  ]);

  return json({ ok: true, action: 'activated', slug });
}

async function handleArchive(body, env) {
  const { slug } = body;
  if (!slug) return json({ ok: false, error: 'slug requerido' }, 400);

  await env.DB.batch([
    env.DB.prepare("UPDATE products       SET active=0, status='archived', updated_at=datetime('now') WHERE slug=?").bind(slug),
    env.DB.prepare("UPDATE product_briefs SET status='archived',            updated_at=datetime('now') WHERE product_slug=?").bind(slug),
  ]);

  return json({ ok: true, action: 'archived', slug });
}

async function handleRefreshInsync(body, env) {
  const { slug, period } = body;
  if (!slug) return json({ ok: false, error: 'slug requerido' }, 400);

  const p = period || '30d';
  const landingFilter = `%/${slug}%`;
  const periodSecs = { '24h': 86400, '7d': 604800, '30d': 2592000 };
  const since = Math.floor(Date.now() / 1000) - (periodSecs[p] || 2592000);

  const [volumeR, scrollR, sectionR, revenueR] = await env.DB.batch([
    env.DB.prepare(
      'SELECT COUNT(DISTINCT session_id) AS sessions FROM behavior_events WHERE landing LIKE ? AND ts >= ?'
    ).bind(landingFilter, since),
    env.DB.prepare(
      "SELECT event_type, COUNT(DISTINCT session_id) AS cnt FROM behavior_events WHERE event_type IN ('scroll_25','scroll_50','scroll_75','scroll_90') AND landing LIKE ? AND ts >= ? GROUP BY event_type"
    ).bind(landingFilter, since),
    env.DB.prepare(
      "SELECT section, COUNT(*) FILTER (WHERE event_type='section_view') AS views, AVG(CAST(json_extract(meta,'$.duration_s') AS REAL)) FILTER (WHERE event_type='section_time') AS avg_time FROM behavior_events WHERE section IS NOT NULL AND landing LIKE ? AND ts >= ? GROUP BY section ORDER BY views DESC LIMIT 10"
    ).bind(landingFilter, since),
    env.DB.prepare(
      "SELECT COUNT(DISTINCT CASE WHEN l.status='purchased' THEN be.session_id END) AS purchased_sessions, COALESCE(SUM(CASE WHEN l.status='purchased' THEN CAST(l.value AS REAL) ELSE 0 END),0) AS revenue, COUNT(DISTINCT l.id) AS attributed_leads FROM behavior_events be JOIN leads l ON l.session_id = be.session_id WHERE be.landing LIKE ? AND be.ts >= ?"
    ).bind(landingFilter, since),
  ]);

  const sessions  = volumeR.results[0]?.sessions || 0;
  const scrollMap = {};
  (scrollR.results || []).forEach(r => { scrollMap[r.event_type] = r.cnt; });

  const scrollFunnel = {
    p25: sessions ? Math.round((scrollMap['scroll_25']||0)/sessions*100) : 0,
    p50: sessions ? Math.round((scrollMap['scroll_50']||0)/sessions*100) : 0,
    p75: sessions ? Math.round((scrollMap['scroll_75']||0)/sessions*100) : 0,
    p90: sessions ? Math.round((scrollMap['scroll_90']||0)/sessions*100) : 0,
  };

  const topSections = (sectionR.results || []).map(r => {
    const reachPct = sessions ? Math.round(r.views/sessions*100) : 0;
    const timeSc   = r.avg_time ? Math.min(Math.round((r.avg_time/15)*100),100) : 0;
    return { name: r.section, views: r.views, reach_pct: reachPct, avg_time_s: Math.round(r.avg_time||0), attention_score: Math.round(reachPct*0.5+timeSc*0.5) };
  });

  const purchasedSessions = revenueR.results[0]?.purchased_sessions || 0;
  const totalRevenue      = revenueR.results[0]?.revenue            || 0;
  const attributedLeads   = revenueR.results[0]?.attributed_leads   || 0;

  const insync = {
    last_fetched:   new Date().toISOString(),
    period:         p,
    landing_path:   `/${slug}`,
    sessions,
    scroll_funnel:  scrollFunnel,
    top_sections:   topSections,
    conversion: {
      attributed_leads,
      purchased_sessions:        purchasedSessions,
      session_to_purchase_pct:   sessions ? Math.round(purchasedSessions/sessions*100*10)/10 : 0,
      total_revenue_gs:          Math.round(totalRevenue),
    },
    low_volume: sessions < 30,
  };

  const brief = await env.DB.prepare('SELECT insights_json FROM product_briefs WHERE product_slug=?').bind(slug).first();
  const insights = JSON.parse(brief?.insights_json || '{"insync":null,"landing_intelligence":null}');
  insights.insync = insync;

  await env.DB.prepare(
    "UPDATE product_briefs SET insights_json=?, updated_at=datetime('now') WHERE product_slug=?"
  ).bind(JSON.stringify(insights), slug).run();

  return json({ ok: true, insync });
}

async function handleSaveLanding(body, env) {
  const { slug, html } = body;
  if (!slug || !html) return json({ ok: false, error: 'slug y html requeridos' }, 400);

  await env.DB.prepare(
    "UPDATE product_briefs SET landing_html=?, landing_status='draft', updated_at=datetime('now') WHERE product_slug=?"
  ).bind(html, slug).run();

  return json({ ok: true, action: 'landing_saved', slug });
}

/* ── Helpers ── */

function buildVariantsJson(op) {
  if (!op) return null;
  const parsed = typeof op === 'string' ? JSON.parse(op) : op;
  if (!Array.isArray(parsed.variants) || !parsed.variants.length) return null;
  const obj = {};
  parsed.variants.forEach(v => { if (v.name) obj[v.name] = v.stock || 0; });
  return Object.keys(obj).length ? JSON.stringify(obj) : null;
}

async function mirrorOpToProducts(slug, op, env) {
  if (!op) return;
  const sets = [];
  const vals = [];
  if (op.name)          { sets.push('name=?');          vals.push(op.name); }
  if (op.cost != null)  { sets.push('unit_cost=?');      vals.push(op.cost); }
  if (op.price != null) { sets.push('default_price=?');  vals.push(op.price); }
  if (op.min_stock != null) { sets.push('min_stock=?'); vals.push(op.min_stock); }
  if (op.compare_price != null) { sets.push('compare_price=?'); vals.push(op.compare_price); }
  if (op.stock != null) { sets.push('stock_total=?');    vals.push(op.stock); }
  if (op.type)          { sets.push('product_type=?');   vals.push(op.type); }

  const varJson = buildVariantsJson(op);
  if (varJson !== undefined) { sets.push('variants_json=?'); vals.push(varJson); }

  if (!sets.length) return;
  sets.push("updated_at=datetime('now')");
  vals.push(slug);
  await env.DB.prepare(`UPDATE products SET ${sets.join(',')} WHERE slug=?`).bind(...vals).run();
}

function parseBrief(row) {
  if (!row) return null;
  return {
    id:                  row.id,
    product_slug:        row.product_slug,
    op_json:             parseJson(row.op_json, {}),
    strategic_json:      parseJson(row.strategic_json, {}),
    visual_json:         parseJson(row.visual_json, {}),
    research_json:       parseJson(row.research_json, []),
    insights_json:       parseJson(row.insights_json, { insync: null, landing_intelligence: null }),
    landing_html:        row.landing_html || null,
    status:              row.status,
    landing_status:      row.landing_status,
    dam_finanzas_id:     row.dam_finanzas_id || null,
    dam_finanzas_status: row.dam_finanzas_status,
    dam_finanzas_note:   row.dam_finanzas_note || null,
    created_at:          row.created_at,
    updated_at:          row.updated_at,
  };
}

function parseBriefSummary(row) {
  const op = parseJson(row.op_json, {});
  return {
    id:                  row.id,
    product_slug:        row.product_slug,
    name:                row.name || op.name || row.product_slug,
    status:              row.status,
    landing_status:      row.landing_status,
    dam_finanzas_status: row.dam_finanzas_status,
    dam_finanzas_id:     row.dam_finanzas_id || null,
    stock_total:         row.stock_total || 0,
    active:              row.active || 0,
    price:               op.price || 0,
    updated_at:          row.updated_at,
    insights_json:       parseJson(row.insights_json, { insync: null, landing_intelligence: null }),
  };
}

function parseJson(str, fallback) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch (_) { return fallback; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
