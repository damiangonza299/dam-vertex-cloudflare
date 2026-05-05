/* =========================================================
   /api/leads — Guardar lead en D1
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, quantity, variant } = body;

    if (!name || !phone || !product_name) {
      return json({ ok: false, error: 'Campos requeridos: name, phone, product_name' }, 400);
    }

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = user_agent || request.headers.get('User-Agent') || '';

    const bindArgs = [
      product_name,
      name.trim(),
      phone.trim(),
      email?.trim() || null,
      city?.trim()  || null,
      value  || null,
      currency || 'PYG',
      fbp  || null,
      fbc  || null,
      ua,
      ip,
      quantity || 1,
      variant  || null,
    ];

    let result;
    try {
      result = await env.DB.prepare(`
        INSERT INTO leads (product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity, variant)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(...bindArgs).run();
    } catch (insertErr) {
      if (!insertErr.message?.includes('variant')) throw insertErr;
      console.error('LEAD_SCHEMA: variant column missing, run migration');
      result = await env.DB.prepare(`
        INSERT INTO leads (product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(...bindArgs.slice(0, 12)).run();
    }

    /* Telegram — awaited for diagnostics, wrapped so it never breaks lead save */
    console.log('Telegram env exists', !!env.TELEGRAM_BOT_TOKEN, !!env.TELEGRAM_CHAT_ID);
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      try {
        const now         = new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' });
        const variantText = formatVariantForTelegram(variant);
        const text = [
          'Nuevo pedido DAM VERTEX',
          '',
          `Producto: ${product_name}`,
          `Nombre: ${name.trim()}`,
          `Telefono: ${phone.trim()}`,
          `Ciudad: ${city?.trim() || '-'}`,
          `Total: Gs. ${Number(value || 0).toLocaleString('es-PY')}`,
          ...(variantText ? [`Variante: ${variantText}`] : []),
          `Cantidad: ${quantity || 1}`,
          `Fecha: ${now}`,
          `Estado: pending`,
        ].join('\n');
        const tgRes  = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
        });
        const tgText = await tgRes.text();
        if (tgRes.ok) {
          console.log('Telegram status', tgRes.status, tgText);
        } else {
          console.error('Telegram error', tgRes.status, tgText);
        }
      } catch (tgErr) {
        console.error('Telegram exception', tgErr.message);
      }
    }

    return json({ ok: true, lead_id: result.meta?.last_row_id });

  } catch (err) {
    console.error('LEAD_SAVE_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

function formatVariantForTelegram(value) {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).join(' + ');
    if (typeof parsed === 'string') return parsed;
  } catch (_) {}
  return String(value);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
