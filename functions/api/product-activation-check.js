/* =========================================================
   /api/product-activation-check?slug=<slug>
   GET — Admin auth required
   Verifica que un producto está listo para Activación Total.
   Devuelve: { ok, slug, overall, product_complete, verdict, fail_count, warning_count, checks }
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token || token !== (env.ADMIN_PASSWORD || '').trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url  = new URL(request.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return json({ ok: false, error: 'slug requerido' }, 400);

  const checks = [];

  try {
    /* ── 1. Producto existe en D1 ── */
    const product = await env.DB.prepare(
      'SELECT * FROM products WHERE slug = ?'
    ).bind(slug).first();

    if (!product) {
      checks.push(check('product_exists', 'Producto en D1', 'FAIL',
        `No existe ningún producto con slug "${slug}"`,
        `Crear el producto en Product Studio primero`));
      return json(result(slug, checks));
    }
    checks.push(check('product_exists', 'Producto en D1', 'PASS',
      `id=${product.id}, name="${product.name}"`, null));

    /* ── 2. Stock disponible ── */
    const stockNum = Number(product.stock_total) || 0;
    if (stockNum <= 0) {
      checks.push(check('stock', 'Stock disponible', 'WARNING',
        `stock_total = ${stockNum}`,
        `Cargar stock antes de activar para evitar sobreventa`));
    } else {
      checks.push(check('stock', 'Stock disponible', 'PASS',
        `stock_total = ${stockNum}`, null));
    }

    /* ── 3. Precio de venta configurado ── */
    const price = Number(product.default_price) || 0;
    if (price <= 0) {
      checks.push(check('price', 'Precio de venta', 'FAIL',
        `default_price = ${price}`,
        `Configurar precio en Product Studio → Tab Producto`));
    } else {
      checks.push(check('price', 'Precio de venta', 'PASS',
        `Gs. ${price.toLocaleString('es-PY')}`, null));
    }

    /* ── 3b. Precio de comparación (tachado) ── */
    const comparePrice = Number(product.compare_price) || 0;
    if (comparePrice <= 0 || comparePrice <= price) {
      checks.push(check('compare_price', 'Precio de comparación (tachado)', 'WARNING',
        `compare_price = ${comparePrice}`,
        `Configurar compare_price > default_price para mostrar precio tachado en cards`));
    } else {
      checks.push(check('compare_price', 'Precio de comparación (tachado)', 'PASS',
        `Gs. ${comparePrice.toLocaleString('es-PY')}`, null));
    }

    /* ── 4. Costo unitario configurado ── */
    const cost = Number(product.unit_cost) || 0;
    if (cost <= 0) {
      checks.push(check('unit_cost', 'Costo unitario', 'WARNING',
        `unit_cost = ${cost}`,
        `Sin costo configurado, el margen aparece como 100% en Dam Finanzas`));
    } else {
      checks.push(check('unit_cost', 'Costo unitario', 'PASS',
        `Gs. ${cost.toLocaleString('es-PY')}`, null));
    }

    /* ── 5. Dam Finanzas vinculado ── */
    const brief = await env.DB.prepare(
      'SELECT dam_finanzas_status, dam_finanzas_id FROM product_briefs WHERE product_slug = ?'
    ).bind(slug).first();

    if (!brief) {
      checks.push(check('dam_finanzas', 'Dam Finanzas vinculado', 'FAIL',
        `No existe brief en product_briefs para "${slug}"`,
        `Abrir Product Studio y completar el brief del producto`));
    } else if (brief.dam_finanzas_status !== 'linked') {
      checks.push(check('dam_finanzas', 'Dam Finanzas vinculado', 'FAIL',
        `dam_finanzas_status = "${brief.dam_finanzas_status || 'null'}"`,
        `Product Studio → Tab Sync → Sincronizar con DAM Finanzas`));
    } else {
      checks.push(check('dam_finanzas', 'Dam Finanzas vinculado', 'PASS',
        `linked, id=${brief.dam_finanzas_id}`, null));
    }

    /* ── 6. Slug collision ── */
    const { results: allProds } = await env.DB.prepare(
      'SELECT slug, name FROM products WHERE slug != ? AND active = 1'
    ).bind(slug).all();

    const collision = (allProds || []).filter(p => {
      const s = p.slug;
      return s.startsWith(slug) || slug.startsWith(s);
    });

    if (collision.length > 0) {
      checks.push(check('slug_collision', 'Sin colisión de slug', 'WARNING',
        `Slug "${slug}" comparte prefijo con: ${collision.map(p => p.slug).join(', ')}`,
        `Verificar que filtros LIKE usen trailing slash (%/${slug}/%)`));
    } else {
      checks.push(check('slug_collision', 'Sin colisión de slug', 'PASS',
        `Slug único entre productos activos`, null));
    }

    /* ── 7. Landing live — SIEMPRE fetch real, nunca D1 ── */
    const origin = url.origin;
    let landingHtml = '';
    let landingStatus = 0;

    try {
      const landingRes = await fetch(`${origin}/${slug}/`, {
        headers: { 'User-Agent': 'DAM-Vertex-Activation-Check/1.0' },
        cf: { cacheEverything: false },
      });
      landingStatus = landingRes.status;
      if (landingRes.ok) {
        landingHtml = await landingRes.text();
      }
    } catch (fetchErr) {
      checks.push(check('landing_exists', 'Landing responde 200', 'FAIL',
        `Error de red al verificar /${slug}/: ${fetchErr.message}`,
        `Verificar deploy y conectividad`));
      return json(result(slug, checks));
    }

    if (!landingHtml || landingStatus !== 200) {
      checks.push(check('landing_exists', 'Landing responde 200', 'FAIL',
        `GET /${slug}/ devolvió HTTP ${landingStatus || 'sin respuesta'}`,
        `Crear public/${slug}/index.html y deployar`));
      return json(result(slug, checks));
    }

    checks.push(check('landing_exists', 'Landing responde 200', 'PASS',
      `HTTP 200 · ${Math.round(landingHtml.length / 1024)}KB`, null));

    /* ── Content checks sobre el HTML real ── */
    verifyLandingHtml(landingHtml, slug, price, checks);

    return json(result(slug, checks));

  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── Verifica el contenido HTML de la landing ── */
function verifyLandingHtml(html, slug, price, checks) {

  /* PRODUCT.slug correcto */
  const hasSlug = html.includes(`'${slug}'`) || html.includes(`"${slug}"`);
  checks.push(check('product_slug_match', 'PRODUCT.slug en HTML', hasSlug ? 'PASS' : 'FAIL',
    hasSlug ? `'${slug}' encontrado en PRODUCT config` : `No se encontró '${slug}' en PRODUCT config`,
    hasSlug ? null : `Verificar const PRODUCT = { slug: '${slug}', ... } en la landing`));

  /* PRODUCT.price */
  const hasPrice = price > 0 && html.includes(String(price));
  const priceStatus = price <= 0 ? 'WARNING' : (hasPrice ? 'PASS' : 'WARNING');
  checks.push(check('product_price_match', 'PRODUCT.price en HTML', priceStatus,
    hasPrice ? `${price} encontrado` : `No se encontró ${price} en la landing`,
    priceStatus !== 'PASS' ? `Verificar que PRODUCT.price = ${price} en la landing` : null));

  /* tracking.js cargado */
  const hasTrackingJs = html.includes('tracking.js');
  checks.push(check('tracking_js_loaded', 'tracking.js cargado', hasTrackingJs ? 'PASS' : 'FAIL',
    hasTrackingJs ? 'Encontrado' : 'No encontrado',
    hasTrackingJs ? null : `Agregar <script src="/assets/js/tracking.js?vX" defer> antes de </body>`));

  /* insync.js cargado */
  const hasInsyncJs = html.includes('insync.js');
  checks.push(check('insync_js_loaded', 'insync.js cargado', hasInsyncJs ? 'PASS' : 'FAIL',
    hasInsyncJs ? 'Encontrado' : 'No encontrado',
    hasInsyncJs ? null : `Agregar <script defer src="/assets/js/insync.js?vX"> antes de </body>`));

  /* DV.trackViewContent */
  const hasVC = html.includes('DV.trackViewContent') || html.includes('trackViewContent');
  checks.push(check('tracking_viewcontent', 'DV.trackViewContent presente', hasVC ? 'PASS' : 'FAIL',
    hasVC ? 'Encontrado' : 'No encontrado',
    hasVC ? null : `Agregar DV.trackViewContent(PRODUCT) en DOMContentLoaded`));

  /* DV.initForm */
  const hasForm = html.includes('DV.initForm') || html.includes('initForm');
  checks.push(check('tracking_initform', 'DV.initForm presente', hasForm ? 'PASS' : 'FAIL',
    hasForm ? 'Encontrado' : 'No encontrado',
    hasForm ? null : `Agregar DV.initForm(PRODUCT) en DOMContentLoaded`));

  /* Modal #order-modal */
  const hasModal = html.includes('id="order-modal"') || html.includes("id='order-modal'");
  checks.push(check('modal_exists', 'Modal #order-modal existe', hasModal ? 'PASS' : 'FAIL',
    hasModal ? 'Encontrado' : 'No encontrado',
    hasModal ? null : `Agregar div#order-modal a la landing`));

  /* WhatsApp link */
  const hasWA = html.includes('wa.me/') || html.includes('api.whatsapp.com');
  checks.push(check('whatsapp_present', 'WhatsApp link presente', hasWA ? 'PASS' : 'FAIL',
    hasWA ? 'Encontrado' : 'No encontrado',
    hasWA ? null : `Agregar link wa.me/... en al menos un CTA de la landing`));

  /* /api/leads wired — acepta llamada directa o via tracking.js + DV.initForm */
  const hasDirectLeads = html.includes('/api/leads');
  const hasViaTracking = html.includes('DV.initForm') && html.includes('tracking.js');
  const hasLeads       = hasDirectLeads || hasViaTracking;
  const leadEvidence   = hasDirectLeads ? '/api/leads encontrado directamente'
    : hasViaTracking ? 'tracking.js + DV.initForm encontrados (maneja /api/leads internamente)'
    : 'No encontrado';
  checks.push(check('lead_endpoint_wired', '/api/leads conectado', hasLeads ? 'PASS' : 'FAIL',
    leadEvidence,
    hasLeads ? null : `Verificar que el modal llama a /api/leads o que tracking.js + DV.initForm estén presentes`));

  /* InSync sections — FAIL si ninguna sección tiene data-insync-section */
  const hasInsyncSection = html.includes('data-insync-section');
  checks.push(check('insync_sections', 'data-insync-section presente', hasInsyncSection ? 'PASS' : 'FAIL',
    hasInsyncSection ? 'Al menos un atributo encontrado' : 'No encontrado en ninguna sección',
    hasInsyncSection ? null : `Agregar data-insync-section="{nombre}" a cada sección visible (ver landing-insync-instrumentation.md)`));

  /* InSync CTAs — WARNING si ningún CTA tiene data-insync-cta */
  const hasInsyncCta = html.includes('data-insync-cta');
  checks.push(check('insync_ctas', 'data-insync-cta presente', hasInsyncCta ? 'PASS' : 'WARNING',
    hasInsyncCta ? 'Al menos un CTA encontrado' : 'No encontrado',
    hasInsyncCta ? null : `Agregar data-insync-cta="{nombre}" a los botones de compra principales`));

  /* InSync CTA ↔ Section match — FAIL si hay CTAs que no matchean secciones */
  if (hasInsyncSection && hasInsyncCta) {
    const sectionNames = new Set();
    const sectionRe = /data-insync-section=["']([^"']+)["']/g;
    let m;
    while ((m = sectionRe.exec(html)) !== null) sectionNames.add(m[1]);

    const EXCLUDED = new Set(['nav', 'sticky']);
    const ctaValues = new Set();
    const ctaRe = /data-insync-cta=["']([^"']+)["']/g;
    while ((m = ctaRe.exec(html)) !== null) {
      if (!EXCLUDED.has(m[1])) ctaValues.add(m[1]);
    }

    if (ctaValues.size > 0) {
      const matched = [...ctaValues].filter(v => sectionNames.has(v));
      if (matched.length === 0) {
        const ctaList = [...ctaValues].slice(0, 5).join(', ');
        const secList = [...sectionNames].slice(0, 5).join(', ');
        checks.push(check('insync_cta_section_match', 'data-insync-cta coincide con sección', 'FAIL',
          `CTAs: [${ctaList}] · Secciones: [${secList}] · Sin correlación`,
          `data-insync-cta debe usar el mismo valor que data-insync-section de su sección contenedora`));
      } else {
        checks.push(check('insync_cta_section_match', 'data-insync-cta coincide con sección', 'PASS',
          `${matched.length} CTA(s) correlacionados: [${matched.join(', ')}]`, null));
      }
    }
  }
}

/* ── Helpers ── */

function check(id, label, status, evidence, fix) {
  return { id, label, status, evidence: evidence || '', fix: fix || null };
}

function result(slug, checks) {
  const hasFail       = checks.some(c => c.status === 'FAIL');
  const hasWarning    = checks.some(c => c.status === 'WARNING');
  const overall       = hasFail ? 'FAIL' : hasWarning ? 'WARNING' : 'PASS';
  const product_complete = !hasFail;
  const verdict       = product_complete ? 'PRODUCTO COMPLETO' : 'PRODUCTO INCOMPLETO';
  const fail_count    = checks.filter(c => c.status === 'FAIL').length;
  const warning_count = checks.filter(c => c.status === 'WARNING').length;
  return { ok: product_complete, slug, overall, product_complete, verdict, fail_count, warning_count, checks };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
