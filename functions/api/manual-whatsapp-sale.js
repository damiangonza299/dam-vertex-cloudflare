import { autoScorePurchase } from './intelligence/_bqe-scorer.js';

/* =========================================================
   /api/manual-whatsapp-sale — Registrar venta manual (admin)
   POST → crear venta + enviar Purchase CAPI opcionalmente
   =========================================================
   POLÍTICAS META:
   - Solo acepta ventas confirmadas como reales y pagadas.
   - action_source = 'business_messaging' para WhatsApp.
   - action_source = 'other' para resto de fuentes manuales.
   - NO se envía event_source_url (no hubo sesión browser).
   - NO se inventa fbp / fbc / fbclid.
   - Se hashean phone, fn, ln con SHA256 normalizados.
   - Teléfonos Paraguay normalizados a 595XXXXXXXXX antes del hash.
   - event_id único por venta: manual_wa_{id}_{timestamp}
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const VALID_SOURCES = ['manual_whatsapp', 'meta_ads_manual', 'referido', 'otro'];

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env, waitUntil }) {
  /* ── Auth ── */
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const body = await request.json();
    const {
      name, phone, product_name, product_slug,
      value, payment_method, source_type,
      confirmed, send_capi, force, deduct_stock,
      quantity, variant, city, observation,
      campaign_id, campaign_name,
      adset_id, adset_name,
      ad_id, ad_name,
    } = body;

    /* ── Validar campos requeridos ── */
    if (!name?.trim())                        return json({ ok: false, error: 'Nombre requerido' }, 400);
    if (!phone?.trim())                       return json({ ok: false, error: 'Teléfono requerido' }, 400);
    if (!product_name?.trim())                return json({ ok: false, error: 'Producto requerido' }, 400);
    if (!value || Number(value) <= 0)         return json({ ok: false, error: 'Valor inválido' }, 400);
    if (!payment_method?.trim())              return json({ ok: false, error: 'Método de pago requerido' }, 400);
    if (!VALID_SOURCES.includes(source_type)) return json({ ok: false, error: 'source_type inválido' }, 400);

    /* ── Política Meta: confirmación explícita requerida para CAPI ── */
    if (send_capi && !confirmed) {
      return json({
        ok: false,
        error: 'Debés confirmar que la compra es real y fue pagada antes de enviar Purchase a Meta',
      }, 400);
    }

    /* ── Normalizar teléfono ── */
    const phoneNorm = normalizePhone(phone.trim());
    const phoneFinal = phoneNorm || phone.trim();

    /* ── Detección de duplicados (ventana 2 horas) ── */
    if (!force) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
        .toISOString().replace('T', ' ').slice(0, 19);

      let dupeResult = { results: [] };
      try {
        dupeResult = await env.DB.prepare(`
          SELECT id FROM leads
          WHERE phone = ?
            AND (product_slug = ? OR product_name = ?)
            AND value = ?
            AND status = 'purchased'
            AND created_at > ?
          LIMIT 5
        `).bind(
          phoneFinal,
          product_slug || '',
          product_name.trim(),
          Number(value),
          twoHoursAgo,
        ).all();
      } catch (_) {}

      if (dupeResult.results?.length > 0) {
        return json({
          ok: false,
          duplicate_warning: true,
          duplicate_ids: dupeResult.results.map(r => r.id),
          error: 'Posible duplicado detectado — misma compra en las últimas 2 horas',
        });
      }
    }

    /* ── Calcular cantidades ── */
    const saleQty   = Math.max(1, parseInt(quantity) || 1);
    const saleValue = Number(value);

    /* ── Validar stock antes de crear venta (si deduct_stock) ── */
    let stockCtx = null;
    if (deduct_stock) {
      const stockSlug = product_slug || slugify(product_name.trim());
      try {
        stockCtx = await checkStock(env, stockSlug, variant || null, saleQty);
      } catch (stockErr) {
        return json({ ok: false, error: `Error al verificar stock: ${stockErr.message}` }, 500);
      }
      if (!stockCtx.ok) {
        return json({ ok: false, error: stockCtx.error }, 409);
      }
    }

    /* ── Crear registro en D1 ── */

    let saleId;
    try {
      const result = await env.DB.prepare(`
        INSERT INTO leads (
          product_name, name, phone, city, value, currency,
          quantity, variant, payment_method, product_slug,
          campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
          source_type, attribution_type, observation,
          status, capi_status, purchased_at
        ) VALUES (
          ?, ?, ?, ?, ?, 'PYG',
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, 'manual', ?,
          'purchased', 'pending', datetime('now')
        )
      `).bind(
        product_name.trim(),
        name.trim(),
        phoneFinal,
        city?.trim()         || null,
        saleValue,
        saleQty,
        variant              || null,
        payment_method.trim(),
        product_slug         || null,
        campaign_id          || null,
        campaign_name        || null,
        adset_id             || null,
        adset_name           || null,
        ad_id                || null,
        ad_name              || null,
        source_type,
        observation?.trim()  || null,
      ).run();

      saleId = result.meta?.last_row_id;
    } catch (insertErr) {
      const msg = insertErr.message || '';
      if (
        msg.includes('source_type') ||
        msg.includes('attribution_type') ||
        msg.includes('capi_status') ||
        msg.includes('observation')
      ) {
        return json({
          ok: false,
          error: 'Migración pendiente: ejecutar migrate11.sql antes de usar esta función',
        }, 500);
      }
      throw insertErr;
    }

    /* ── Descontar stock ── */
    let stockDeducted    = false;
    let stockDeductedAt  = null;
    let stockDeductError = null;

    if (deduct_stock && stockCtx?.ok) {
      try {
        const dr = await deductStock(env, stockCtx);
        if (dr.ok) {
          stockDeducted   = true;
          stockDeductedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
        } else {
          stockDeductError = dr.error || 'Error al descontar stock';
        }
      } catch (stockErr) {
        stockDeductError = stockErr.message;
      }

      /* Registrar resultado en D1 — silencioso si migrate12 no fue ejecutado */
      try {
        if (stockDeducted) {
          await env.DB.prepare(
            `UPDATE leads SET stock_deducted = 1, stock_deducted_at = ? WHERE id = ?`
          ).bind(stockDeductedAt, saleId).run();
        } else {
          await env.DB.prepare(
            `UPDATE leads SET stock_error = ? WHERE id = ?`
          ).bind(stockDeductError, saleId).run();
        }
      } catch (upErr) {
        console.error('STOCK_TRACK_UPDATE_FAILED (ejecutar migrate12.sql)', upErr.message);
      }

      /* Si el descuento falló: retornar advertencia sin enviar CAPI */
      if (!stockDeducted) {
        try { await env.DB.prepare(`UPDATE leads SET capi_status = 'skipped' WHERE id = ?`).bind(saleId).run(); } catch (_) {}
        return json({
          ok:          true,
          sale_id:     saleId,
          capi_status: 'skipped',
          stock_error: stockDeductError,
          warning:     'Venta guardada pero stock NO descontado — revisá manualmente',
        });
      }
    }

    /* ── Enviar Purchase CAPI (solo si send_capi y confirmed) ── */
    let capiStatus  = send_capi ? 'pending' : 'skipped';
    let capiEventId = null;
    let capiError   = null;

    if (send_capi && confirmed) {
      const capiResult = await sendPurchaseCapi({
        saleId,
        name:         name.trim(),
        phone:        phoneFinal,
        city:         city?.trim() || null,
        product_name: product_name.trim(),
        product_slug: product_slug || slugify(product_name.trim()),
        value:        saleValue,
        quantity:     saleQty,
        source_type,
        env,
      });
      capiStatus  = capiResult.ok ? 'sent' : 'error';
      capiEventId = capiResult.event_id || null;
      capiError   = capiResult.error    || null;
    }

    /* ── Actualizar capi_status en D1 ── */
    try {
      await env.DB.prepare(
        `UPDATE leads SET capi_status = ?, capi_event_id = ?, capi_error = ? WHERE id = ?`
      ).bind(capiStatus, capiEventId, capiError, saleId).run();
    } catch (_) {}

    /* Ventas manuales: no enviar Telegram. El registro queda en admin/D1. */

    /* ── Notificar DAM Finanzas (waitUntil — garantiza que el fetch completa antes que CF cierre el contexto) ── */
    const stockSlugFinal  = product_slug || slugify(product_name.trim());
    const isManualCombo   = stockSlugFinal === 'combo-reloj-cadena';
    const dfNotifyPromise = notifyDamFinanzas({
      saleId, product_name, stockSlugFinal,
      value: saleValue, variant: variant || null, saleQty,
      isCombo: isManualCombo,
    }, env).catch(e => console.warn('DAM_FINANZAS_MANUAL_NOTIFY_FAILED', saleId, e?.message));
    if (typeof waitUntil === 'function') {
      waitUntil(Promise.all([
        dfNotifyPromise,
        autoScorePurchase(saleId, env.DB),
      ]));
    }

    return json({
      ok:             true,
      sale_id:        saleId,
      event_id:       capiEventId,
      capi_status:    capiStatus,
      capi_error:     capiError,
      stock_deducted: stockDeducted,
      stock_error:    stockDeductError,
    });

  } catch (err) {
    console.error('MANUAL_SALE_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

/* =========================================================
   sendPurchaseCapi
   action_source:
     'business_messaging' para WhatsApp (Meta CAPI policy)
     'other' para resto de fuentes manuales
   NO se envía event_source_url (no hubo sesión browser).
   NO se inventa fbp / fbc.
   Se hashean ph, fn, ln con SHA256 normalizados.
   ========================================================= */
async function sendPurchaseCapi({
  saleId, name, phone, product_name, product_slug,
  value, quantity, source_type, env,
}) {
  const pixelId     = env.META_PIXEL_ID;
  const accessToken = env.META_ACCESS_TOKEN;
  const testCode    = env.META_TEST_EVENT_CODE;

  if (!pixelId || !accessToken) {
    return { ok: false, error: 'CAPI no configurado (META_PIXEL_ID / META_ACCESS_TOKEN)' };
  }

  const ts       = Math.floor(Date.now() / 1000);
  const event_id = `manual_wa_${saleId}_${ts}`;

  /* ── user_data: solo datos reales, nunca fbp/fbc ── */
  const user_data = {};

  /* Teléfono Paraguay: 595XXXXXXXXX → SHA256 */
  if (phone) {
    const phoneNorm = normalizePhone(phone);
    const phoneHash = phoneNorm || phone.replace(/\D/g, '');
    if (phoneHash) user_data.ph = [await sha256(phoneHash)];
  }

  /* Nombre → fn (first name) + ln (last name) */
  const nameParts = name.trim().split(/\s+/);
  if (nameParts[0]) {
    user_data.fn = [await sha256(normalizeForMeta(nameParts[0]))];
  }
  if (nameParts.length > 1) {
    user_data.ln = [await sha256(normalizeForMeta(nameParts.slice(1).join(' ')))];
  }

  /* action_source: business_messaging para WhatsApp, other para el resto */
  const action_source = source_type === 'manual_whatsapp' ? 'business_messaging' : 'other';

  const event = {
    event_name:    'Purchase',
    event_time:    ts,
    event_id,
    action_source,
    /* event_source_url: omitido — no hubo sesión browser */
    user_data,
    custom_data: {
      content_name: product_name,
      content_ids:  [product_slug],
      content_type: 'product',
      value,
      currency:     'PYG',
      num_items:    quantity,
    },
  };

  try {
    const payload = {
      data: [event],
      ...(testCode && { test_event_code: testCode }),
    };

    const res  = await fetch(
      `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      },
    );
    const resBody = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errStr = JSON.stringify(resBody).slice(0, 300);
      console.error('MANUAL_SALE_CAPI_FAILED', event_id, errStr);
      return { ok: false, event_id, error: errStr };
    }

    console.log('MANUAL_SALE_CAPI_OK', event_id, resBody.events_received ?? '?');
    return { ok: true, event_id };

  } catch (err) {
    console.error('MANUAL_SALE_CAPI_EXCEPTION', event_id, err.message);
    return { ok: false, event_id, error: err.message };
  }
}

/* ── Helpers ── */

function normalizePhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('595')) return digits.slice(0, 12);
  if (digits.startsWith('0')  ) return '595' + digits.slice(1);
  return '595' + digits;
}

function normalizeForMeta(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

async function sha256(str) {
  if (!str) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

/* =========================================================
   Stock helpers — lógica espejada de confirm-purchase.js
   ========================================================= */

function parseLeadVariants(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (typeof parsed === 'string') return [parsed];
  } catch (_) {}
  return [value];
}

/* Valida stock SIN modificar nada. Devuelve el contexto necesario para deductStock. */
async function checkStock(env, productSlug, variantStr, saleQty) {
  const isCombo = productSlug === 'combo-reloj-cadena';
  const requestedVariants = parseLeadVariants(variantStr);

  if (isCombo) {
    let relojRow = null, cadenaRow = null;
    try {
      [relojRow, cadenaRow] = await Promise.all([
        env.DB.prepare('SELECT * FROM products WHERE slug = ?').bind('reloj').first(),
        env.DB.prepare('SELECT * FROM products WHERE slug = ?').bind('cadena').first(),
      ]);
    } catch (err) {
      return { ok: false, error: `Error al leer stock: ${err.message}` };
    }
    if (!relojRow)                         return { ok: false, error: 'Producto reloj no encontrado' };
    if (Number(relojRow.stock_total) < 1)  return { ok: false, error: 'Sin stock del reloj' };
    if (!cadenaRow)                        return { ok: false, error: 'Cadena Apex no encontrada' };
    if (Number(cadenaRow.stock_total) < 1) return { ok: false, error: 'Sin stock de Cadena Apex' };

    if (requestedVariants.length && relojRow.variants_json) {
      let vars;
      try { vars = JSON.parse(relojRow.variants_json); } catch (_) { vars = {}; }
      for (const color of requestedVariants) {
        const available = Number(vars[color] ?? -1);
        if (available === 0) return { ok: false, error: `Sin stock del modelo: ${color}` };
        if (available < 0)  return { ok: false, error: `Modelo no encontrado: ${color}` };
      }
    }
    return { ok: true, isCombo: true, relojRow, cadenaRow, requestedVariants, saleQty };
  }

  /* Producto normal */
  let productRow = null;
  try {
    productRow = await env.DB.prepare('SELECT * FROM products WHERE slug = ?').bind(productSlug).first();
  } catch (err) {
    return { ok: false, error: `Error al leer stock: ${err.message}` };
  }

  if (!productRow) {
    return { ok: false, error: `Producto "${productSlug}" no encontrado en inventario` };
  }

  if (productRow.stock_total < saleQty) {
    const errMsg = productRow.stock_total === 0
      ? 'Sin stock disponible para este producto'
      : `Stock insuficiente — disponible: ${productRow.stock_total}`;
    return { ok: false, error: errMsg };
  }

  if (requestedVariants.length && productRow.variants_json) {
    let vars;
    try { vars = JSON.parse(productRow.variants_json); } catch (_) { vars = {}; }
    const byColor = {};
    requestedVariants.forEach(c => { byColor[c] = (byColor[c] || 0) + 1; });
    for (const color of Object.keys(byColor)) {
      const available = Number(vars[color] ?? -1);
      const needed    = byColor[color];
      if (available < needed) {
        return {
          ok: false,
          error: available <= 0
            ? `Sin stock del color: ${color}`
            : `Stock insuficiente para ${color} — disponible: ${available}`,
        };
      }
    }
  }

  return { ok: true, isCombo: false, productRow, requestedVariants, saleQty };
}

/* Descuenta stock usando el contexto ya validado de checkStock. */
async function deductStock(env, stockCtx) {
  const { isCombo, relojRow, cadenaRow, productRow, requestedVariants, saleQty } = stockCtx;

  if (isCombo) {
    const relojModel    = requestedVariants[0] || null;
    const newRelojTotal = Math.max(0, (relojRow.stock_total || 0) - 1);
    let   newRelojVarJson = relojRow.variants_json || null;

    if (relojModel && relojRow.variants_json) {
      let vars;
      try { vars = JSON.parse(relojRow.variants_json); } catch (_) { vars = {}; }
      if (Number.isFinite(Number(vars[relojModel]))) {
        vars[relojModel] = Math.max(0, Number(vars[relojModel]) - 1);
      }
      newRelojVarJson = JSON.stringify(vars);
    }

    const newCadenaTotal = Math.max(0, (cadenaRow.stock_total || 0) - 1);

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE products SET stock_total = ?, variants_json = ?, updated_at = datetime('now') WHERE slug = 'reloj'`
      ).bind(newRelojTotal, newRelojVarJson),
      env.DB.prepare(
        `UPDATE products SET stock_total = ?, updated_at = datetime('now') WHERE slug = 'cadena'`
      ).bind(newCadenaTotal),
    ]);

    console.log(`MANUAL_COMBO_STOCK_OK reloj=${newRelojTotal} model=${relojModel} cadena=${newCadenaTotal}`);
    return { ok: true };
  }

  if (!productRow) return { ok: false, error: 'Producto no encontrado en inventario' };

  const newTotal = Math.max(0, productRow.stock_total - saleQty);
  let newVarJson = productRow.variants_json;

  if (requestedVariants.length && productRow.variants_json) {
    let vars;
    try { vars = JSON.parse(productRow.variants_json); } catch (_) { vars = {}; }
    const byColor = {};
    requestedVariants.forEach(c => { byColor[c] = (byColor[c] || 0) + 1; });
    for (const color of Object.keys(byColor)) {
      const current = Number(vars[color]);
      if (Number.isFinite(current)) vars[color] = Math.max(0, current - byColor[color]);
    }
    newVarJson = JSON.stringify(vars);
  }

  await env.DB.prepare(
    `UPDATE products SET stock_total = ?, variants_json = ?, updated_at = datetime('now') WHERE slug = ?`
  ).bind(newTotal, newVarJson, productRow.slug).run();

  console.log(`MANUAL_STOCK_OK ${productRow.slug} total=${newTotal} variants=${newVarJson}`);
  return { ok: true };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/* ── DAM Finanzas webhook (fire-and-forget) ── */
function getParaguayDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

async function notifyDamFinanzas({ saleId, product_name, stockSlugFinal, value, variant, saleQty, isCombo }, env) {
  const secret = env.DAM_FINANZAS_WEBHOOK_SECRET || '';
  if (!secret) return;

  const adminOrderId    = `manual-wa-${saleId}`;
  const operationalDate = getParaguayDateString();
  const totalValue      = Number(value);
  const endpoint        = 'https://us-central1-dam-finanzas-cf863.cloudfunctions.net/onAdminSale';
  const headers         = { 'Content-Type': 'application/json', 'x-dam-vertex-secret': secret };

  async function sendItem(pl) {
    const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(pl) });
    console.log('DAM_FINANZAS_MANUAL_NOTIFY', saleId, `item${pl.itemIndex}`, pl.variantName ?? pl.productSlug, r.status);
  }

  if (isCombo) {
    // Combo reloj + cadena: 1 card con 2 items
    const rawVariants  = variant ? (Array.isArray(variant) ? variant : [variant]) : [];
    const relojVariant = rawVariants[0] || null;
    const relojPrice   = Math.round(totalValue / 2);
    await sendItem({
      sourceSystem: 'DAM_VERTEX', adminOrderId, productSlug: 'reloj',
      productName: 'Reloj Blackout Minimal', variantName: relojVariant, variantId: null,
      quantity: 1, salePrice: relojPrice, itemIndex: 0,
      purchasedAt: new Date().toISOString(), operationalDate,
    });
    await sendItem({
      sourceSystem: 'DAM_VERTEX', adminOrderId, productSlug: 'cadena',
      productName: 'Cadena Apex', variantName: null, variantId: null,
      quantity: 1, salePrice: totalValue - relojPrice, itemIndex: 1,
      purchasedAt: new Date().toISOString(), operationalDate,
    });
    return;
  }

  // Producto normal: 1 webhook por variante distinta
  const rawVariants    = variant ? (Array.isArray(variant) ? variant : [variant]) : [];
  const variantsToSend = rawVariants.length > 0 ? rawVariants : [null];
  const unitPrice      = Math.round(totalValue / saleQty);

  for (let i = 0; i < variantsToSend.length; i++) {
    const qty = variantsToSend.length === 1 ? saleQty : 1; // multi-unit single-variant
    await sendItem({
      sourceSystem: 'DAM_VERTEX', adminOrderId, productSlug: stockSlugFinal,
      productName: product_name, variantName: variantsToSend[i], variantId: null,
      quantity: qty, salePrice: unitPrice, itemIndex: i,
      purchasedAt: new Date().toISOString(), operationalDate,
    });
  }
}
