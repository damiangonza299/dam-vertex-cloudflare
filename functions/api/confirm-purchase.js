/* =========================================================
   /api/confirm-purchase — Confirmar compra real (solo admin)
   ========================================================= */

import { autoScorePurchase } from './intelligence/_bqe-scorer.js';
import { verifyAdminToken }  from '../_lib/adminAuth.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env, waitUntil }) {
  /* Auth */
  if (!(await verifyAdminToken(request, env))) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const { id } = await request.json();
    if (!id) return json({ ok: false, error: 'id requerido' }, 400);

    /* Obtener lead */
    const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
    if (!lead)           return json({ ok: false, error: 'Lead no encontrado' }, 404);
    if (lead.status === 'purchased') return json({ ok: false, error: 'Ya fue confirmado' }, 409);

    /* Verificar stock — ANTES de enviar Purchase a Meta */
    const saleQty     = Number(lead.quantity) || 1;
    const productSlug = lead.product_slug || getProductSlug(lead.product_name);
    const isCombo     = productSlug === 'combo-reloj-cadena';
    const requestedVariants = parseLeadVariants(lead.variant);
    const isDorado    = isCombo && requestedVariants[0] === 'Negro Dorado';
    const isRosa      = isCombo && requestedVariants[0] === 'Negro Rosa';

    let productRow     = null;
    let comboRelojRow  = null;
    let comboCadenaRow = null;

    if (isCombo) {
      /* Combo: verificar stock de reloj Y cadena por separado */
      try {
        [comboRelojRow, comboCadenaRow] = await Promise.all([
          env.DB.prepare('SELECT * FROM products WHERE slug = ?').bind('reloj').first(),
          env.DB.prepare('SELECT * FROM products WHERE slug = ?').bind('cadena').first(),
        ]);
      } catch (err) {
        console.error('COMBO_STOCK_LOOKUP_ERROR', err.message);
      }

      if (!comboRelojRow) return json({ ok: false, error: 'Producto reloj no encontrado' }, 409);

      if (isDorado) {
        /* Negro Dorado: stock propio — no depende de reloj.stock_total */
        if (Number(comboRelojRow.combo_apex_dorado_stock || 0) < 1)
          return json({ ok: false, error: 'Sin stock del modelo: Negro Dorado' }, 409);
      } else if (isRosa) {
        /* Negro Rosa: stock propio — no depende de reloj.stock_total */
        if (Number(comboRelojRow.combo_apex_rosa_stock || 0) < 1)
          return json({ ok: false, error: 'Sin stock del modelo: Negro Rosa' }, 409);
      } else {
        /* Cualquier otro color del combo: guard original intacto */
        if (Number(comboRelojRow.stock_total) < 1)
          return json({ ok: false, error: 'Sin stock del reloj' }, 409);

        if (requestedVariants.length && comboRelojRow.variants_json) {
          let vars;
          try { vars = JSON.parse(comboRelojRow.variants_json); } catch (_) { vars = {}; }
          for (const color of requestedVariants) {
            const available = Number(vars[color] ?? -1);
            if (available === 0) return json({ ok: false, error: `Sin stock del modelo: ${color}` }, 409);
            if (available < 0)  return json({ ok: false, error: `Modelo no encontrado: ${color}` }, 409);
          }
        }
      }

      if (!comboCadenaRow) return json({ ok: false, error: 'Cadena Apex no encontrada' }, 409);
      if (Number(comboCadenaRow.stock_total) < 1)
        return json({ ok: false, error: 'Sin stock de Cadena Apex' }, 409);

    } else {
      try {
        productRow = await env.DB.prepare(
          'SELECT * FROM products WHERE slug = ?'
        ).bind(productSlug).first();
        if (!productRow) {
          productRow = await env.DB.prepare(
            'SELECT * FROM products WHERE name = ?'
          ).bind(lead.product_name).first();
        }
      } catch (err) {
        console.error('STOCK_LOOKUP_ERROR', err.message);
      }

      if (productRow) {
        if (productRow.stock_total < saleQty) {
          const errMsg = productRow.stock_total === 0
            ? 'Sin stock disponible para este producto'
            : `Stock insuficiente — disponible: ${productRow.stock_total}`;
          return json({ ok: false, error: errMsg }, 409);
        }

        if (requestedVariants.length && productRow.variants_json) {
          let vars;
          try { vars = JSON.parse(productRow.variants_json); } catch (_) { vars = {}; }

          const requestedByColor = {};
          requestedVariants.forEach(color => {
            requestedByColor[color] = (requestedByColor[color] || 0) + 1;
          });

          for (const color of Object.keys(requestedByColor)) {
            const available = Number(vars[color] ?? -1);
            const requested = requestedByColor[color];
            if (available < requested) {
              const errMsg = available <= 0
                ? `Sin stock del color: ${color}`
                : `Stock insuficiente para ${color} — disponible: ${available}`;
              return json({ ok: false, error: errMsg }, 409);
            }
          }
        }
      }
    }

    /* Stock guard — producto adicional */
    let extraProductRow = null;
    const extraSlug    = lead.extra_product_slug    || null;
    const extraVariant = lead.extra_product_variant || null;
    const extraQty     = Math.max(1, Number(lead.extra_product_qty) || 1);

    if (extraSlug) {
      try {
        extraProductRow = await env.DB.prepare(
          'SELECT * FROM products WHERE slug = ?'
        ).bind(extraSlug).first();
      } catch (err) {
        console.error('EXTRA_STOCK_LOOKUP_ERROR', err.message);
      }
      if (!extraProductRow)
        return json({ ok: false, error: `Producto adicional no encontrado: ${extraSlug}` }, 409);
      if (Number(extraProductRow.stock_total) < extraQty) {
        const msg = extraProductRow.stock_total === 0
          ? `Sin stock para producto adicional: ${extraProductRow.name}`
          : `Stock insuficiente para adicional (${extraProductRow.name}) — disponible: ${extraProductRow.stock_total}`;
        return json({ ok: false, error: msg }, 409);
      }
      if (extraVariant && extraProductRow.variants_json) {
        let vars; try { vars = JSON.parse(extraProductRow.variants_json); } catch (_) { vars = {}; }
        const av = Number(vars[extraVariant] ?? -1);
        if (av < extraQty)
          return json({ ok: false, error: `Sin stock variante adicional: ${extraVariant}` }, 409);
      }
    }

    /* Claim atómico del lead — ANTES de mandar nada a Meta CAPI. Si dos requests
       llegan casi simultáneas para el mismo id (doble click, retry de red), la
       condición WHERE status != 'purchased' garantiza que solo una gana el UPDATE;
       la otra ve changes=0 y aborta acá, sin disparar un segundo evento Purchase. */
    const claim = await env.DB.prepare(
      `UPDATE leads SET status = 'purchased', purchased_at = datetime('now') WHERE id = ? AND status != 'purchased'`
    ).bind(id).run();
    if (!claim.meta.changes) {
      return json({ ok: false, error: 'Ya fue confirmado' }, 409);
    }

    /* Desbloqueo automático — si el teléfono del lead tiene un bloqueo activo en
       blocked_customers, se levanta como parte de confirmar la compra. Misma
       operación que unblockCustomer() en admin.js (DELETE /api/blocked-customers),
       en reversa: active=0 + unblocked_at. Best-effort — nunca debe frenar la
       confirmación ni el envío de CAPI si falla. */
    if (lead.phone) {
      try {
        const normPhoneUnblock = normalizePhone(lead.phone) || lead.phone;
        await env.DB.prepare(
          `UPDATE blocked_customers SET active = 0, unblocked_at = datetime('now')
           WHERE phone IN (?, ?) AND active = 1`
        ).bind(lead.phone, normPhoneUnblock).run();
      } catch (err) {
        console.error('AUTO_UNBLOCK_ERROR lead_id=' + id, err.message);
      }
    }

    /* FLUJO DE EVENTOS META — IMPORTANTE (ver CLAUDE.md/GEMINI.md):
       Este endpoint YA NO envía ningún evento a Meta CAPI. Purchase se dispara
       en functions/api/leads.js, al crear el lead. Confirmar la compra acá
       es una operación 100% interna: D1, stock, Dam Finanzas, desbloqueo. */

    /* Incrementar contador del panel PiP — KV, best-effort (no bloquea la confirmación) */
    if (env.COUNTER_KV && typeof waitUntil === 'function') {
      waitUntil((async () => {
        try {
          const key     = `counter:purchases:${getParaguayDateString()}`;
          const current = Number((await env.COUNTER_KV.get(key)) || 0);
          await env.COUNTER_KV.put(key, String(current + 1));
        } catch (_) {}
      })());
    }

    /* Descontar stock */
    if (isCombo) {
      /* Combo: descontar stock según variante */
      try {
        const newCadenaTotal = Math.max(0, (comboCadenaRow?.stock_total || 0) - 1);

        if (isDorado) {
          /* Negro Dorado: solo combo_apex_dorado_stock — reloj.stock_total y variants_json intactos */
          const newDoradoStock = Math.max(0, Number(comboRelojRow?.combo_apex_dorado_stock || 0) - 1);
          await env.DB.batch([
            env.DB.prepare(
              `UPDATE products SET combo_apex_dorado_stock = ?, updated_at = datetime('now') WHERE slug = 'reloj'`
            ).bind(newDoradoStock),
            env.DB.prepare(
              `UPDATE products SET stock_total = ?, updated_at = datetime('now') WHERE slug = 'cadena'`
            ).bind(newCadenaTotal),
          ]);
          console.log(`COMBO_DORADO_STOCK_OK lead_id=${id}: dorado=${newDoradoStock} cadena=${newCadenaTotal}`);
        } else if (isRosa) {
          /* Negro Rosa: solo combo_apex_rosa_stock — reloj.stock_total y variants_json intactos */
          const newRosaStock = Math.max(0, Number(comboRelojRow?.combo_apex_rosa_stock || 0) - 1);
          await env.DB.batch([
            env.DB.prepare(
              `UPDATE products SET combo_apex_rosa_stock = ?, updated_at = datetime('now') WHERE slug = 'reloj'`
            ).bind(newRosaStock),
            env.DB.prepare(
              `UPDATE products SET stock_total = ?, updated_at = datetime('now') WHERE slug = 'cadena'`
            ).bind(newCadenaTotal),
          ]);
          console.log(`COMBO_ROSA_STOCK_OK lead_id=${id}: rosa=${newRosaStock} cadena=${newCadenaTotal}`);
        } else {
          /* Otro color: lógica original intacta */
          const relojModel    = requestedVariants[0] || null;
          const newRelojTotal = Math.max(0, (comboRelojRow?.stock_total || 0) - 1);
          let   newRelojVarJson = comboRelojRow?.variants_json || null;

          if (relojModel && comboRelojRow?.variants_json) {
            let vars;
            try { vars = JSON.parse(comboRelojRow.variants_json); } catch (_) { vars = {}; }
            if (Number.isFinite(Number(vars[relojModel]))) {
              vars[relojModel] = Math.max(0, Number(vars[relojModel]) - 1);
            }
            newRelojVarJson = JSON.stringify(vars);
          }

          await env.DB.batch([
            env.DB.prepare(
              `UPDATE products SET stock_total = ?, variants_json = ?, updated_at = datetime('now') WHERE slug = 'reloj'`
            ).bind(newRelojTotal, newRelojVarJson),
            env.DB.prepare(
              `UPDATE products SET stock_total = ?, updated_at = datetime('now') WHERE slug = 'cadena'`
            ).bind(newCadenaTotal),
          ]);
          console.log(`COMBO_STOCK_OK lead_id=${id}: reloj total=${newRelojTotal} model=${relojModel} cadena total=${newCadenaTotal}`);
        }
      } catch (err) {
        console.error('COMBO_STOCK_UPDATE_FAILED lead_id=' + id, err.message);
      }

    } else if (productRow) {
      try {
        const newTotal = Math.max(0, productRow.stock_total - saleQty);
        let newVarJson = productRow.variants_json;

        if (requestedVariants.length && productRow.variants_json) {
          let vars;
          try { vars = JSON.parse(productRow.variants_json); } catch (_) { vars = {}; }

          const requestedByColor = {};
          requestedVariants.forEach(color => {
            requestedByColor[color] = (requestedByColor[color] || 0) + 1;
          });

          for (const color of Object.keys(requestedByColor)) {
            const current = Number(vars[color]);
            if (Number.isFinite(current)) {
              vars[color] = Math.max(0, current - requestedByColor[color]);
            }
          }

          newVarJson = JSON.stringify(vars);
        }

        await env.DB.prepare(
          `UPDATE products SET stock_total = ?, variants_json = ?, updated_at = datetime('now') WHERE slug = ?`
        ).bind(newTotal, newVarJson, productRow.slug).run();

        console.log(`STOCK_UPDATE OK: ${productRow.slug} total=${newTotal} variants=${newVarJson}`);
      } catch (err) {
        console.error('STOCK_UPDATE_FAILED lead_id=' + id, err.message);
      }
    }

    /* Descontar stock del producto adicional */
    if (extraSlug && extraProductRow) {
      try {
        const newExtraTotal = Math.max(0, Number(extraProductRow.stock_total) - extraQty);
        let newExtraVarJson = extraProductRow.variants_json;
        if (extraVariant && extraProductRow.variants_json) {
          let vars; try { vars = JSON.parse(extraProductRow.variants_json); } catch (_) { vars = {}; }
          if (Number.isFinite(Number(vars[extraVariant])))
            vars[extraVariant] = Math.max(0, Number(vars[extraVariant]) - extraQty);
          newExtraVarJson = JSON.stringify(vars);
        }
        await env.DB.prepare(
          `UPDATE products SET stock_total = ?, variants_json = ?, updated_at = datetime('now') WHERE slug = ?`
        ).bind(newExtraTotal, newExtraVarJson, extraSlug).run();
        console.log(`EXTRA_STOCK_OK lead_id=${id}: ${extraSlug} total=${newExtraTotal}`);
      } catch (err) {
        console.error('EXTRA_STOCK_UPDATE_FAILED lead_id=' + id, err.message);
      }
    }

    /* Venta Hipnótica (product_name='V.H') SÍ dispara webhook a Dam Finanzas (para que
       aparezca en reportes/revenue — requiere el producto 'venta-hipnotica' ya registrado
       ahí con unitCost:0 e isDigital:true). NO dispara factura por Telegram — pedido
       explícito, se gestiona aparte en la sección V.H. */
    const isVH = lead.product_name === 'V.H';

    const damNotifyPromise = notifyDamFinanzasSale(
      { lead, productSlug, saleQty, isCombo, requestedVariants, productRow, comboRelojRow, comboCadenaRow,
        extraSlug, extraVariant, extraQty, extraProductRow },
      env
    ).catch(e => console.warn('DAM_FINANZAS_NOTIFY_FAILED', String(lead.id), e?.message));

    const tgInvoicePromise = (!isVH && lead.invoice_requested && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_INVOICE_CHAT_ID)
      ? sendTelegramInvoice(lead, env).catch(e => console.warn('TG_INVOICE_WARN lead_id=' + lead.id, e?.message))
      : Promise.resolve();

    if (typeof waitUntil === 'function') {
      waitUntil(Promise.all([
        damNotifyPromise,
        autoScorePurchase(id, env.DB),
        tgInvoicePromise,
      ]));
    }
    return json({ ok: true, name: lead.name });

  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── Helpers ── */
async function sha256(str) {
  if (!str) return null;
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizePhone(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('595')) return d.slice(0, 12);
  if (d.startsWith('0'))   return '595' + d.slice(1);
  return '595' + d;
}

function normalizeForMeta(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}
function getProductSlug(name) {
  const MAP = {
    'Reloj Blackout Minimal':                       'reloj',
    'Reloj Imperial Verde':                         'reloj-imperial-verde',
    'Cepillo Eléctrico Recargable (4 Cabezales)':   'cepillo',
    'Lentes Anti Luz Azul Rojos':                   'lentes',
    'Cadena Apex':                                  'cadena',
    'Combo Reloj Blackout Minimal + Cadena Apex':   'combo-reloj-cadena',
  };
  return MAP[name] || slugify(name);
}
function parseLeadVariants(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (typeof parsed === 'string') return [parsed];
  } catch (_) {}

  return [value];
}
async function sendTelegramInvoice(lead, env) {
  const fmtNum = n => Number(n || 0).toLocaleString('es-PY');
  let variants = '';
  try {
    const parsed = JSON.parse(lead.variant || 'null');
    if (Array.isArray(parsed) && parsed.length) variants = ' — ' + parsed.filter(Boolean).join(' + ');
    else if (typeof parsed === 'string' && parsed) variants = ' — ' + parsed;
  } catch (_) {}

  /* La factura solo corresponde al producto — el extra de envío express
     (Gs. 10.000, columna express_amount vía migrate34.sql) se muestra
     aparte y se resta del total facturable. Ver CLAUDE.md, incidente
     factura+express 2026-08. */
  const expressAmount  = Number(lead.express_amount) || 0;
  const invoiceSubtotal = Number(lead.value || 0) - expressAmount;

  const lines = [
    '🧾 FACTURA SOLICITADA',
    '',
    `Pedido: #${lead.id}`,
    `Cliente: ${lead.name || ''}`,
    `Teléfono: ${lead.phone || ''}`,
    `Producto: ${lead.product_name || ''}${variants}`,
    ...(expressAmount > 0
      ? [
          `Subtotal producto: Gs. ${fmtNum(invoiceSubtotal)}`,
          `Envío express: Gs. ${fmtNum(expressAmount)}`,
          `Total cobrado: Gs. ${fmtNum(lead.value)}`,
          `Total facturable (sin express): Gs. ${fmtNum(invoiceSubtotal)}`,
        ]
      : [`Total cobrado: Gs. ${fmtNum(lead.value)}`]),
    `RUC: ${lead.invoice_ruc || ''}`,
    `Razón social: ${lead.invoice_name || ''}`,
    `Email: ${lead.invoice_email || 'No proporcionado'}`,
    '',
    'Concepto sugerido: Venta de mercadería',
    'IVA: 10%',
  ];

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: env.TELEGRAM_INVOICE_CHAT_ID, text: lines.join('\n') }),
  });
}

function buildContents({ isCombo, productSlug, saleQty, extraSlug, extraQty, totalValue }) {
  if (isCombo) {
    const half = Math.round(totalValue / 2);
    return [
      { id: 'reloj',  quantity: 1, item_price: half },
      { id: 'cadena', quantity: 1, item_price: totalValue - half },
    ];
  }
  if (extraSlug) {
    const totalItems = saleQty + extraQty;
    const unitPrice  = Math.round(totalValue / totalItems);
    return [
      { id: productSlug, quantity: saleQty,  item_price: unitPrice },
      { id: extraSlug,   quantity: extraQty, item_price: unitPrice },
    ];
  }
  return [{ id: productSlug, quantity: saleQty, item_price: Math.round(totalValue / saleQty) }];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/* ── DAM Finanzas webhook helpers ── */

function getParaguayDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function resolveVariantId(metaJson, variantName) {
  if (!metaJson || !variantName) return null;
  try {
    const meta = JSON.parse(metaJson);
    return meta[variantName]?.variantId || null;
  } catch (_) { return null; }
}

async function notifyDamFinanzasSale(
  { lead, productSlug, saleQty, isCombo, requestedVariants, productRow, comboRelojRow, comboCadenaRow,
    extraSlug, extraVariant, extraQty, extraProductRow },
  env
) {
  const secret = env.DAM_FINANZAS_WEBHOOK_SECRET || '';
  if (!secret) return;

  const adminOrderId    = String(lead.id);
  const operationalDate = lead.operational_date_py || getParaguayDateString();
  const totalValue      = Number(lead.value || 0);
  const endpoint        = 'https://us-central1-dam-finanzas-cf863.cloudfunctions.net/onAdminSale';
  const headers         = { 'Content-Type': 'application/json', 'x-dam-vertex-secret': secret };

  async function sendItem(pl) {
    const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(pl) });
    console.log('DAM_FINANZAS_NOTIFY', pl.adminOrderId, `item${pl.itemIndex}`, pl.variantName ?? pl.productSlug, r.status);
  }

  if (isCombo) {
    // Combo reloj + cadena: 1 card en DAM Finanzas con 2 items (misma adminOrderId)
    const relojVariant = requestedVariants[0] || null;
    const relojPrice   = Math.round(totalValue / 2);
    await sendItem({
      sourceSystem: 'DAM_VERTEX', adminOrderId, productSlug: 'reloj',
      productName: 'Reloj Blackout Minimal',
      variantName: relojVariant,
      variantId:   resolveVariantId(comboRelojRow?.variants_meta_json, relojVariant),
      quantity: 1, salePrice: relojPrice, itemIndex: 0,
      purchasedAt: new Date().toISOString(), operationalDate,
    });
    await sendItem({
      sourceSystem: 'DAM_VERTEX', adminOrderId, productSlug: 'cadena',
      productName: 'Cadena Apex',
      variantName: null, variantId: null,
      quantity: 1, salePrice: totalValue - relojPrice, itemIndex: 1,
      purchasedAt: new Date().toISOString(), operationalDate,
    });
    return;
  }

  // Producto normal: 1 webhook por variante distinta
  // Si hay una sola variante con qty > 1, mandamos quantity real (no qty=1)
  const variantsToSend = requestedVariants.length > 0 ? requestedVariants : [null];
  const unitPrice      = Math.round(totalValue / saleQty);

  for (let i = 0; i < variantsToSend.length; i++) {
    const vn  = variantsToSend[i];
    const qty = variantsToSend.length === 1 ? saleQty : 1; // multi-unit single-variant
    await sendItem({
      sourceSystem: 'DAM_VERTEX', adminOrderId, productSlug,
      productName:     lead.product_name,
      variantName:     vn,
      variantId:       resolveVariantId(productRow?.variants_meta_json, vn),
      quantity:        qty,
      salePrice:       unitPrice,
      itemIndex:       i,
      purchasedAt:     new Date().toISOString(),
      operationalDate,
    });
  }

  if (extraSlug && extraProductRow) {
    const totalItems = saleQty + extraQty;
    const extraPrice = Math.round(totalValue * extraQty / totalItems);
    await sendItem({
      sourceSystem: 'DAM_VERTEX', adminOrderId, productSlug: extraSlug,
      productName:     extraProductRow.name || extraSlug,
      variantName:     extraVariant || null,
      variantId:       resolveVariantId(extraProductRow?.variants_meta_json, extraVariant),
      quantity:        extraQty,
      salePrice:       extraPrice,
      itemIndex:       variantsToSend.length,
      purchasedAt:     new Date().toISOString(),
      operationalDate,
    });
  }
}
