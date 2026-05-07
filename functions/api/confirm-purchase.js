/* =========================================================
   /api/confirm-purchase — Confirmar compra real (solo admin)
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
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
    const saleQty = Number(lead.quantity) || 1;
    let productRow = null;
    try {
      productRow = await env.DB.prepare(
        'SELECT * FROM products WHERE name = ?'
      ).bind(lead.product_name).first();
    } catch (err) {
      console.error('STOCK_LOOKUP_ERROR', err.message);
    }

    const requestedVariants = parseLeadVariants(lead.variant);

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

    const event = {
      event_name:       'Purchase',
      event_time:       Math.floor(Date.now() / 1000),
      event_id,
      action_source:    'website',
      user_data,
      custom_data: {
        content_name:  lead.product_name,
        content_ids:   [slugify(lead.product_name)],
        content_type:  'product',
        value:         lead.value || 0,
        currency:      lead.currency || 'PYG',
        num_items:     lead.quantity || 1,
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

      await fetch(
        `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        },
      );
    }

    /* Marcar como purchased */
    await env.DB.prepare(
      `UPDATE leads SET status = 'purchased', purchased_at = datetime('now') WHERE id = ?`
    ).bind(id).run();

    /* Descontar stock */
    if (productRow) {
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
        console.error('STOCK_UPDATE_ERROR', err.message);
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
          content_ids:  [slugify(lead.product_name)],
          content_type: 'product',
          value:        saleValue,
          currency:     lead.currency || 'PYG',
          num_items:    lead.quantity || 1,
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
            content_ids:  [slugify(lead.product_name)],
            content_type: 'product',
            value:        saleValue,
            currency:     lead.currency || 'PYG',
            num_items:    lead.quantity || 1,
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
