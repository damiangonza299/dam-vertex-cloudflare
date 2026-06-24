/* =========================================================
   /api/admin-leads — Gestión de leads (solo admin)
   GET  → listar leads
   PATCH → cambiar status
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

/* ── GET — listar todos los leads ── */
export async function onRequestGet({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const { results } = await env.DB.prepare(
      `SELECT l.*, lq.is_dead_lead
       FROM leads l
       LEFT JOIN lead_quality lq ON l.id = lq.lead_id
       ORDER BY l.created_at DESC LIMIT 500`
    ).all();

    return json({ ok: true, leads: results || [] });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── PATCH — cambiar status (cancelar) ── */
export async function onRequestPatch({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const { id, status } = await request.json();
    const allowed = ['cancelled', 'pending'];
    if (!id || !allowed.includes(status)) {
      return json({ ok: false, error: 'id y status válido requeridos' }, 400);
    }

    await env.DB.prepare(
      'UPDATE leads SET status = ? WHERE id = ?'
    ).bind(status, id).run();

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── PUT — editar nombre, ciudad y valor ── */
export async function onRequestPut({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const { id, name, city, value, extra_product_slug, extra_product_variant, extra_product_qty } = await request.json();
    if (!id) return json({ ok: false, error: 'id requerido' }, 400);

    const trimName = (name || '').trim();
    if (!trimName) return json({ ok: false, error: 'name no puede estar vacío' }, 400);

    const trimCity = (city || '').trim() || null;

    const numValue = Math.floor(Number(value));
    if (!Number.isFinite(numValue) || numValue <= 0) {
      return json({ ok: false, error: 'El valor debe ser un número entero positivo' }, 400);
    }

    const extraSlug    = (extra_product_slug    || '').trim() || null;
    const extraVariant = (extra_product_variant || '').trim() || null;
    const extraQtyN    = extra_product_qty != null
      ? Math.max(1, Math.floor(Number(extra_product_qty)) || 1)
      : null;

    await env.DB.prepare(
      'UPDATE leads SET name = ?, city = ?, value = ?, extra_product_slug = ?, extra_product_variant = ?, extra_product_qty = ?, location_city = NULL WHERE id = ?'
    ).bind(trimName, trimCity, numValue, extraSlug, extraVariant, extraQtyN, id).run();

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── DELETE — eliminar lead ── */
export async function onRequestDelete({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const url        = new URL(request.url);
    const id         = url.searchParams.get('id');
    const force      = url.searchParams.get('force') === 'true';
    const mode       = url.searchParams.get('mode') || '';
    const isInternal = mode === 'internal_cleanup';
    if (!id) return json({ ok: false, error: 'id requerido' }, 400);

    const lead = await env.DB.prepare(
      `SELECT id, status, operational_date_py, source_type,
              product_slug, variant, quantity, stock_deducted
       FROM leads WHERE id = ?`
    ).bind(parseInt(id)).first();
    if (!lead) return json({ ok: false, error: 'Lead no encontrado' }, 404);

    if (lead.status === 'purchased' && !force && !isInternal) {
      return json({
        ok: false,
        requiresConfirmation: true,
        message: 'Este lead ya fue comprado y tiene registro en Dam Finanzas. ¿Eliminar y revertir también?',
      });
    }

    await env.DB.prepare('DELETE FROM lead_quality WHERE lead_id = ?').bind(parseInt(id)).run();
    await env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(parseInt(id)).run();

    const secret = env.DAM_FINANZAS_WEBHOOK_SECRET || '';
    const opDate = lead.operational_date_py || null;
    const notes  = [];
    let damFinanzasReverted = false;
    let stockRestored       = false;

    if (lead.status === 'purchased' && secret && opDate) {
      try {
        const r = await fetch('https://us-central1-dam-finanzas-cf863.cloudfunctions.net/onAdminSaleRevert', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-dam-vertex-secret': secret },
          body:    JSON.stringify({ adminOrderId: String(lead.id), operationalDate: opDate }),
        });
        if (r.ok) {
          damFinanzasReverted = true;
          notes.push('Dam Finanzas revertido');
        } else {
          notes.push(`Dam Finanzas revert HTTP ${r.status}`);
        }
      } catch (e) {
        notes.push(`Dam Finanzas revert error: ${e.message}`);
      }
    }

    if (opDate && secret) {
      try { await _resyncLeadsCount(opDate, secret, env.DB); } catch (_) {}
    }

    /* ── Stock restoration (solo internal_cleanup) ── */
    if (isInternal && lead.status === 'purchased') {
      // Landing leads (source_type IS NULL) always had stock deducted via confirm-purchase.js
      // Manual WA leads only if stock_deducted = 1
      const shouldRestore = lead.stock_deducted === 1 || !lead.source_type;

      if (shouldRestore && lead.product_slug) {
        const isCombo = lead.product_slug === 'combo-reloj-cadena';
        const saleQty = Math.max(1, Number(lead.quantity) || 1);
        const variants = _parseVariants(lead.variant);

        if (isCombo) {
          try {
            const [relojRow, cadenaRow] = await Promise.all([
              env.DB.prepare('SELECT * FROM products WHERE slug = ?').bind('reloj').first(),
              env.DB.prepare('SELECT * FROM products WHERE slug = ?').bind('cadena').first(),
            ]);
            const stmts = [];
            if (relojRow) {
              const model      = variants[0] || null;
              const newTotal   = (relojRow.stock_total || 0) + 1;
              let   newVarJson = relojRow.variants_json || null;
              if (model && relojRow.variants_json) {
                let vars;
                try { vars = JSON.parse(relojRow.variants_json); } catch (_) { vars = {}; }
                if (Number.isFinite(Number(vars[model]))) vars[model] = Number(vars[model]) + 1;
                newVarJson = JSON.stringify(vars);
              }
              stmts.push(env.DB.prepare(
                `UPDATE products SET stock_total = ?, variants_json = ?, updated_at = datetime('now') WHERE slug = 'reloj'`
              ).bind(newTotal, newVarJson));
            }
            if (cadenaRow) {
              stmts.push(env.DB.prepare(
                `UPDATE products SET stock_total = ?, updated_at = datetime('now') WHERE slug = 'cadena'`
              ).bind((cadenaRow.stock_total || 0) + 1));
            }
            if (stmts.length) {
              await env.DB.batch(stmts);
              stockRestored = true;
              notes.push('Stock Combo Reloj+Cadena restaurado');
            }
          } catch (e) {
            notes.push(`Error restaurando stock combo: ${e.message}`);
          }
        } else {
          try {
            const productRow = await env.DB.prepare(
              'SELECT * FROM products WHERE slug = ?'
            ).bind(lead.product_slug).first();

            if (productRow) {
              const newTotal   = (productRow.stock_total || 0) + saleQty;
              let   newVarJson = productRow.variants_json;
              if (variants.length && productRow.variants_json) {
                let vars;
                try { vars = JSON.parse(productRow.variants_json); } catch (_) { vars = {}; }
                const byColor = {};
                variants.forEach(c => { byColor[c] = (byColor[c] || 0) + 1; });
                for (const [c, q] of Object.entries(byColor)) {
                  if (Number.isFinite(Number(vars[c]))) vars[c] = Number(vars[c]) + q;
                }
                newVarJson = JSON.stringify(vars);
              }
              await env.DB.prepare(
                `UPDATE products SET stock_total = ?, variants_json = ?, updated_at = datetime('now') WHERE slug = ?`
              ).bind(newTotal, newVarJson, productRow.slug).run();
              stockRestored = true;
              notes.push(`Stock ${productRow.slug} restaurado: +${saleQty}`);
            } else {
              notes.push(`Producto ${lead.product_slug} no encontrado en products`);
            }
          } catch (e) {
            notes.push(`Error restaurando stock: ${e.message}`);
          }
        }
      } else if (!shouldRestore) {
        notes.push('Stock no restaurado: venta manual sin deducción original (stock_deducted=0)');
      }
    }

    if (isInternal) {
      return json({
        ok:                    true,
        lead_id:               parseInt(id),
        deleted_lead:          true,
        deleted_lead_quality:  true,
        stock_restored:        stockRestored,
        dam_finanzas_reverted: damFinanzasReverted,
        admin_order_id:        String(lead.id),
        notes,
      });
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

function _parseVariants(value) {
  if (!value) return [];
  try {
    const p = JSON.parse(value);
    if (Array.isArray(p)) return p.filter(Boolean);
    if (typeof p === 'string') return [p];
  } catch (_) {}
  return [value];
}

async function _resyncLeadsCount(date, secret, db) {
  const [year, month, day] = date.split('-').map(Number);
  const startUTC = new Date(Date.UTC(year, month - 1, day, 3, 0, 0)); // PY = UTC-3
  const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().replace('T', ' ').slice(0, 19);
  const row = await db.prepare(
    `SELECT COUNT(*) AS count FROM leads
     WHERE created_at >= ? AND created_at < ?
       AND (source_type IS NULL OR source_type != 'meta_ads_manual')`
  ).bind(fmt(startUTC), fmt(endUTC)).first();
  const leadsCount = Number(row?.count || 0);
  await fetch('https://us-central1-dam-finanzas-cf863.cloudfunctions.net/onLeadsCountUpdate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-dam-vertex-secret': secret },
    body:    JSON.stringify({ date, leadsCount }),
  });
}

/* ── Helpers ── */
function isAuthorized(request, env) {
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  return token && token === env.ADMIN_PASSWORD.trim();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
