/* =========================================================
   /api/confirm-purchase — Confirmar compra real (solo admin)
   ========================================================= */

import { autoScorePurchase } from './intelligence/_bqe-scorer.js';

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
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const { id } = await request.json();
    if (!id) return json({ ok: false, error: 'id requerido' }, 400);

    /* Obtener lead */
    const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
    if (!lead)           return json({ ok: false, error: 'Lead no encontrado' }, 404);
    if (lead.status === 'purchased') return json({ ok: false, error: 'Ya fue confirmado' }, 409);
    if (lead.status === 'cancelled') return json({ ok: false, error: 'Lead cancelado' }, 409);

    /* Verificar stock — ANTES de enviar Purchase a Meta */
    const saleQty     = Number(lead.quantity) || 1;
    const productSlug = lead.product_slug || getProductSlug(lead.product_name);
    const isCombo     = productSlug === 'combo-reloj-cadena';
    const requestedVariants = parseLeadVariants(lead.variant);

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

    /* Preparar user_data hasheado */
    const user_data = {
      client_ip_address: lead.ip || '',
      client_user_agent: lead.user_agent || '',
    };
    if (lead.fbp)   user_data.fbp = lead.fbp;
    if (lead.fbc)   user_data.fbc = lead.fbc;
    if (lead.email) user_data.em  = [await sha256(lead.email)];
    if (lead.phone) user_data.ph  = [await sha256(lead.phone)];

    /* Evento Purchase */
    const event_id = `pur_${lead.id}_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).slice(2, 6)}`;

    const origin         = new URL(request.url).origin;
    const landingPath    = (lead.landing_path || '').split('?')[0] || ('/' + productSlug);
    const eventSourceUrl = origin + landingPath;

    const event = {
      event_name:       'Purchase',
      event_time:       Math.floor(Date.now() / 1000),
      event_id,
      action_source:    'website',
      event_source_url: eventSourceUrl,
      user_data,
      custom_data: {
        content_name:  lead.product_name,
        content_ids:   isCombo ? ['reloj', 'cadena'] : [productSlug],
        content_type:  'product',
        value:         lead.value || 0,
        currency:      lead.currency || 'PYG',
        num_items:     isCombo ? 2 : (lead.quantity || 1),
      },
    };

    const pixelId     = env.META_PIXEL_ID;
    const accessToken = env.META_ACCESS_TOKEN;
    const testCode    = env.META_TEST_EVENT_CODE;

    if (pixelId && accessToken) {
      const payload = {
        data: [event],
        ...(testCode && { test_event_code: testCode }),
      };

      const capiRes  = await fetch(
        `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        },
      );
      const capiBody = await capiRes.json().catch(() => ({}));
      if (!capiRes.ok) {
        console.error('PURCHASE_CAPI_FAILED lead_id=' + id, capiRes.status, JSON.stringify(capiBody));
      } else {
        console.log('PURCHASE_CAPI_OK lead_id=' + id, capiBody.events_received ?? '?');
      }
    }

    /* Marcar como purchased */
    await env.DB.prepare(
      `UPDATE leads SET status = 'purchased', purchased_at = datetime('now') WHERE id = ?`
    ).bind(id).run();

    /* Descontar stock */
    if (isCombo) {
      /* Combo: descontar reloj (variante seleccionada) + cadena (total) en batch */
      try {
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

        const newCadenaTotal = Math.max(0, (comboCadenaRow?.stock_total || 0) - 1);

        await env.DB.batch([
          env.DB.prepare(
            `UPDATE products SET stock_total = ?, variants_json = ?, updated_at = datetime('now') WHERE slug = 'reloj'`
          ).bind(newRelojTotal, newRelojVarJson),
          env.DB.prepare(
            `UPDATE products SET stock_total = ?, updated_at = datetime('now') WHERE slug = 'cadena'`
          ).bind(newCadenaTotal),
        ]);

        console.log(`COMBO_STOCK_OK lead_id=${id}: reloj total=${newRelojTotal} model=${relojModel} cadena total=${newCadenaTotal}`);
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

    /* HighValuePurchase / VIPPurchase — server-side only, no browser counterpart */
    const saleValue = lead.value || 0;
    if (saleValue >= 300000 && pixelId && accessToken) {
      const ts           = Math.floor(Date.now() / 1000);
      const customEvents = [];

      customEvents.push({
        event_name:    'HighValuePurchase',
        event_time:    ts,
        event_id:      `hvp_${lead.id}_${ts}`,
        action_source: 'website',
        user_data,
        custom_data: {
          content_name: lead.product_name,
          content_ids:  isCombo ? ['reloj', 'cadena'] : [productSlug],
          content_type: 'product',
          value:        saleValue,
          currency:     lead.currency || 'PYG',
          num_items:    isCombo ? 2 : (lead.quantity || 1),
        },
      });

      if (saleValue >= 500000) {
        customEvents.push({
          event_name:    'VIPPurchase',
          event_time:    ts,
          event_id:      `vip_${lead.id}_${ts}`,
          action_source: 'website',
          user_data,
          custom_data: {
            content_name: lead.product_name,
            content_ids:  isCombo ? ['reloj', 'cadena'] : [productSlug],
            content_type: 'product',
            value:        saleValue,
            currency:     lead.currency || 'PYG',
            num_items:    isCombo ? 2 : (lead.quantity || 1),
          },
        });
      }

      await fetch(
        `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            data: customEvents,
            ...(testCode && { test_event_code: testCode }),
          }),
        },
      );
    }

    /* FastBuyer / ComboBuyer — eventos CAPI positivos adicionales, no modifican Purchase */
    if (pixelId && accessToken && lead.created_at) {
      try {
        const purchasedAtMs = Date.now();
        const createdAtMs   = new Date(lead.created_at).getTime();
        const timeToH       = (purchasedAtMs - createdAtMs) / 3600000;
        const extraEvents   = [];
        const tsExtra       = Math.floor(purchasedAtMs / 1000);

        if (timeToH < 24) {
          extraEvents.push({
            event_name:    'FastBuyer',
            event_time:    tsExtra,
            event_id:      `fb_${lead.id}_${tsExtra}`,
            action_source: 'website',
            event_source_url: eventSourceUrl,
            user_data,
            custom_data: {
              content_name: lead.product_name,
              content_ids:  isCombo ? ['reloj', 'cadena'] : [productSlug],
              content_type: 'product',
              value:        saleValue,
              currency:     lead.currency || 'PYG',
              time_to_purchase_h: Math.round(timeToH * 10) / 10,
            },
          });
        }

        if (isCombo) {
          extraEvents.push({
            event_name:    'ComboBuyer',
            event_time:    tsExtra,
            event_id:      `cb_${lead.id}_${tsExtra}`,
            action_source: 'website',
            event_source_url: eventSourceUrl,
            user_data,
            custom_data: {
              content_name: lead.product_name,
              content_ids:  ['reloj', 'cadena'],
              content_type: 'product',
              value:        saleValue,
              currency:     lead.currency || 'PYG',
            },
          });
        }

        if (extraEvents.length > 0) {
          await fetch(
            `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`,
            {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                data: extraEvents,
                ...(testCode && { test_event_code: testCode }),
              }),
            },
          ).then(r => r.json())
            .then(b => console.log('EXTRA_EVENTS_OK lead_id=' + id, extraEvents.map(e=>e.event_name).join(','), b.events_received ?? '?'))
            .catch(e => console.warn('EXTRA_EVENTS_WARN lead_id=' + id, e.message));
        }
      } catch (extraErr) {
        console.warn('EXTRA_EVENTS_SKIP lead_id=' + id, extraErr.message);
      }
    }

    const damNotifyPromise = notifyDamFinanzasSale(
      { lead, productSlug, saleQty, isCombo, requestedVariants, productRow, comboRelojRow, comboCadenaRow },
      env
    ).catch(e => console.warn('DAM_FINANZAS_NOTIFY_FAILED', String(lead.id), e?.message));

    if (typeof waitUntil === 'function') {
      waitUntil(Promise.all([
        damNotifyPromise,
        autoScorePurchase(id, env.DB),
      ]));
    }
    return json({ ok: true, name: lead.name, event_id });

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

function slugify(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}
function getProductSlug(name) {
  const MAP = {
    'Reloj Blackout Minimal':                       'reloj',
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
  { lead, productSlug, saleQty, isCombo, requestedVariants, productRow, comboRelojRow, comboCadenaRow },
  env
) {
  const secret = env.DAM_FINANZAS_WEBHOOK_SECRET || '';
  if (!secret) return;

  const adminOrderId    = String(lead.id);
  const operationalDate = getParaguayDateString();
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
}
