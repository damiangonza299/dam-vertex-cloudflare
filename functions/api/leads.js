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

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const body = await request.json();
    const {
      product_name, product_slug, name, phone, email, city, value, currency, fbp, fbc, user_agent, quantity, variant,
      fbclid, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      campaign_id, adset_id, ad_id, campaign_name, adset_name, ad_name,
      landing_path, referrer,
      address, payment_method,
      location_address, location_city, location_lat, location_lng, location_maps_url, location_place_id,
      session_id,
      invoice_requested, invoice_ruc, invoice_name, invoice_email,
    } = body;

    /* Si el picker detectó ciudad automáticamente, usarla como city efectiva */
    const effectiveCity = location_city?.trim() || city?.trim() || null;

    if (!name || !phone || !product_name) {
      return json({ ok: false, error: 'Campos requeridos: name, phone, product_name' }, 400);
    }

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = user_agent || request.headers.get('User-Agent') || '';

    /* ── Block check — multi-signal blacklist ── */
    try {
      const bPhone     = phone?.trim()        || '';
      const bPhoneNorm = normalizePhoneBlock(bPhone);
      const bUa        = ua                   || '';
      const bFbp       = fbp                  || '';
      const bFbc       = fbc                  || '';
      const bSession   = session_id?.trim()   || '';

      const conditions = [];
      const params     = [];

      if (bPhone)                              { conditions.push('phone = ?');                        params.push(bPhone); }
      if (bPhoneNorm && bPhoneNorm !== bPhone) { conditions.push('phone = ?');                        params.push(bPhoneNorm); }
      if (ip)                    { conditions.push('ip = ?');                           params.push(ip); }
      if (bUa && ip)             { conditions.push('(user_agent = ? AND ip = ?)');      params.push(bUa, ip); }
      if (bFbp)                  { conditions.push('fbp = ?');                          params.push(bFbp); }
      if (bFbc)                  { conditions.push('fbc = ?');                          params.push(bFbc); }
      if (bSession)              { conditions.push('session_id = ?');                   params.push(bSession); }

      if (conditions.length > 0) {
        const sql   = `SELECT id FROM blocked_customers WHERE active = 1 AND (${conditions.join(' OR ')}) LIMIT 1`;
        const match = await env.DB.prepare(sql).bind(...params).first();
        if (match) {
          return json({
            ok:      false,
            blocked: true,
            error:   'No podemos procesar nuevos pedidos desde este dispositivo en este momento. Si creés que se trata de un error, contactanos por WhatsApp.',
          }, 403);
        }
      }
    } catch (blockErr) {
      console.error('BLOCK_CHECK_SKIP:', blockErr.message);
    }
    /* ── /Block check ── */

    const locLat = location_lat != null ? Number(location_lat) || null : null;
    const locLng = location_lng != null ? Number(location_lng) || null : null;

    // Capture Paraguay date ONCE — reused for both operational_date_py (D1) and onLeadsCountUpdate (Firebase).
    // Two separate calls near midnight can return different dates due to clock rollover between INSERT and webhook.
    const leadDate = getParaguayDateString();

    const bindArgs = [
      product_name,
      name.trim(),
      phone.trim(),
      email?.trim() || null,
      effectiveCity,
      value    || null,
      currency || 'PYG',
      fbp      || null,
      fbc      || null,
      ua,
      ip,
      quantity || 1,
      variant  || null,
      // attribution (indices 13-26)
      fbclid        || null,
      utm_source    || null,
      utm_medium    || null,
      utm_campaign  || null,
      utm_content   || null,
      utm_term      || null,
      campaign_id   || null,
      adset_id      || null,
      ad_id         || null,
      campaign_name || null,
      adset_name    || null,
      ad_name       || null,
      landing_path  || null,
      referrer      || null,
      // delivery (indices 27-28)
      address        || null,
      payment_method || null,
      // slug (index 29)
      product_slug   || null,
      // attribution quality (indices 30-31)
      leadDate,
      getAttributionConfidence({ campaign_id, ad_id, fbclid, fbc, utm_source, utm_campaign }),
      // location picker (indices 32-37)
      location_address?.trim() || null,
      location_city?.trim()    || null,
      locLat,
      locLng,
      location_maps_url?.trim()  || null,
      location_place_id?.trim()  || null,
      // session_id for DAM inSync revenue attribution (index 38)
      session_id?.trim() || null,
      // invoice (indices 39-42)
      invoice_requested ? 1 : 0,
      invoice_ruc?.trim()   || null,
      invoice_name?.trim()  || null,
      invoice_email?.trim() || null,
    ];

    let result;
    try {
      result = await env.DB.prepare(`
        INSERT INTO leads (
          product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity, variant,
          fbclid, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          campaign_id, adset_id, ad_id, campaign_name, adset_name, ad_name, landing_path, referrer,
          address, payment_method, product_slug,
          operational_date_py, attribution_confidence,
          location_address, location_city, location_lat, location_lng, location_maps_url, location_place_id,
          session_id,
          invoice_requested, invoice_ruc, invoice_name, invoice_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(...bindArgs).run();
    } catch (insertErr) {
      const msg = insertErr.message || '';
      if (msg.includes('invoice_requested') || msg.includes('invoice_ruc') || msg.includes('invoice_name') || msg.includes('invoice_email')) {
        // invoice columns not yet migrated (run migrate24.sql) — retry without them
        console.error('LEAD_SCHEMA: run migrate24.sql for invoice columns');
        result = await env.DB.prepare(`
          INSERT INTO leads (
            product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity, variant,
            fbclid, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            campaign_id, adset_id, ad_id, campaign_name, adset_name, ad_name, landing_path, referrer,
            address, payment_method, product_slug,
            operational_date_py, attribution_confidence,
            location_address, location_city, location_lat, location_lng, location_maps_url, location_place_id,
            session_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(...bindArgs.slice(0, 39)).run();
      } else if (msg.includes('session_id')) {
        // session_id column not yet migrated (run migrate17.sql) — retry without it
        console.error('LEAD_SCHEMA: run migrate17.sql for session_id column');
        result = await env.DB.prepare(`
          INSERT INTO leads (
            product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity, variant,
            fbclid, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            campaign_id, adset_id, ad_id, campaign_name, adset_name, ad_name, landing_path, referrer,
            address, payment_method, product_slug,
            operational_date_py, attribution_confidence,
            location_address, location_city, location_lat, location_lng, location_maps_url, location_place_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(...bindArgs.slice(0, 38)).run();
      } else if (msg.includes('location_address') || msg.includes('location_city') || msg.includes('location_lat') || msg.includes('location_lng') || msg.includes('location_maps_url') || msg.includes('location_place_id')) {
        // location columns not yet migrated (run migrate14.sql) — retry without them
        console.error('LEAD_SCHEMA: run migrate14.sql for location columns');
        result = await env.DB.prepare(`
          INSERT INTO leads (
            product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity, variant,
            fbclid, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            campaign_id, adset_id, ad_id, campaign_name, adset_name, ad_name, landing_path, referrer,
            address, payment_method, product_slug,
            operational_date_py, attribution_confidence
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(...bindArgs.slice(0, 32)).run();
      } else if (msg.includes('operational_date_py') || msg.includes('attribution_confidence')) {
        // Attribution quality columns not yet added (run migrate13.sql) — retry without them
        console.error('LEAD_SCHEMA: run migrate13.sql for attribution_confidence/operational_date_py');
        result = await env.DB.prepare(`
          INSERT INTO leads (
            product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity, variant,
            fbclid, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            campaign_id, adset_id, ad_id, campaign_name, adset_name, ad_name, landing_path, referrer,
            address, payment_method, product_slug
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(...bindArgs.slice(0, 30)).run();
      } else if (msg.includes('product_slug')) {
        // product_slug column not yet added (run migrate9.sql) — save WITH attribution, without product_slug
        console.error('LEAD_SCHEMA: product_slug column missing, run migrate9.sql');
        result = await env.DB.prepare(`
          INSERT INTO leads (
            product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity, variant,
            fbclid, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            campaign_id, adset_id, ad_id, campaign_name, adset_name, ad_name, landing_path, referrer,
            address, payment_method
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(...bindArgs.slice(0, 29)).run();
      } else if (msg.includes('no column named') || msg.includes('fbclid') || msg.includes('utm_') || msg.includes('campaign_id') || msg.includes('landing_path')) {
        // Attribution columns not yet migrated — fallback to base insert
        console.error('LEAD_SCHEMA: attribution columns missing, run migrate7.sql');
        try {
          result = await env.DB.prepare(`
            INSERT INTO leads (product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity, variant)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(...bindArgs.slice(0, 13)).run();
        } catch (err2) {
          if (!err2.message?.includes('variant')) throw err2;
          console.error('LEAD_SCHEMA: variant column also missing');
          result = await env.DB.prepare(`
            INSERT INTO leads (product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(...bindArgs.slice(0, 12)).run();
        }
      } else if (msg.includes('variant')) {
        console.error('LEAD_SCHEMA: variant column missing, run migration');
        result = await env.DB.prepare(`
          INSERT INTO leads (product_name, name, phone, email, city, value, currency, fbp, fbc, user_agent, ip, quantity)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(...bindArgs.slice(0, 12)).run();
      } else {
        throw insertErr;
      }
    }

    /* Telegram — awaited for diagnostics, wrapped so it never breaks lead save */
    console.log('Telegram env exists', !!env.TELEGRAM_BOT_TOKEN, !!env.TELEGRAM_CHAT_ID);
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      try {
        const now         = new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' });
        const variantText = formatVariantForTelegram(variant);
        const isComboTg   = product_slug === 'combo-reloj-cadena' || (product_name || '').includes('Combo Reloj');
        const tgProductName = (isComboTg && variantText)
          ? 'Combo Reloj ' + variantText + ' + Cadena Apex'
          : product_name;
        const tgCity = (location_city?.trim() || city?.trim() || '');
        const text = [
          'Nuevo pedido Dam Vertex',
          '',
          `Producto: ${tgProductName}`,
          `Nombre: ${name.trim()}`,
          `Telefono: ${phone.trim()}`,
          ...(payment_method ? [`Metodo de pago: ${payment_method}`] : []),
          ...(tgCity ? [`Ciudad: ${tgCity}`] : []),
          `Total: Gs. ${Number(value || 0).toLocaleString('es-PY')}`,
          ...(!isComboTg && variantText ? [`Variante: ${variantText}`] : []),
          `Cantidad: ${quantity || 1}`,
          `Fecha: ${now}`,
          `Estado: pending`,
          ...(address ? [`Referencia: ${address}`] : []),
          ...(location_maps_url ? [`Ubicacion: ${location_maps_url}`] : []),
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

    /* CAPI QualifiedLead — una vez por insert D1 exitoso, fuente de verdad = backend */
    if (env.META_PIXEL_ID && env.META_ACCESS_TOKEN) {
      try {
        const ts  = Math.floor(Date.now() / 1000);
        const rnd = Math.random().toString(36).slice(2, 6);
        const qlId = `ql_${product_slug || 'lead'}_${ts}_${rnd}`;
        const ud = {};
        if (ip) ud.client_ip_address = ip;
        if (ua) ud.client_user_agent = ua;
        if (fbp) ud.fbp = fbp;
        if (fbc) ud.fbc = fbc;

        const phQL = normalizePhoneQL(phone?.trim());
        if (phQL) {
          const phHash = await sha256QL(phQL);
          ud.ph          = [phHash];
          ud.external_id = [phHash];
        }

        const namePartsQL = (name || '').trim().split(/\s+/);
        if (namePartsQL[0])           ud.fn = [await sha256QL(normForMetaQL(namePartsQL[0]))];
        if (namePartsQL.length > 1)   ud.ln = [await sha256QL(normForMetaQL(namePartsQL.slice(1).join(' ')))];

        if (email?.trim()) ud.em = [await sha256QL(email.trim().toLowerCase())];

        const cityQL = normForMetaQL(effectiveCity || '');
        if (cityQL) ud.ct = [await sha256QL(cityQL)];

        ud.country = [await sha256QL('py')];
        await fetch(
          `https://graph.facebook.com/v20.0/${env.META_PIXEL_ID}/events?access_token=${env.META_ACCESS_TOKEN}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: [{
                event_name:       'QualifiedLead',
                event_id:         qlId,
                event_time:       ts,
                action_source:    'website',
                event_source_url: landing_path ? `https://damvertex.com${landing_path}` : 'https://damvertex.com',
                user_data:        ud,
                custom_data: {
                  content_name: product_name || '',
                  content_ids:  [product_slug || ''],
                  content_type: 'product',
                  value:        value  || 0,
                  currency:     currency || 'PYG',
                },
              }],
              ...(env.META_TEST_EVENT_CODE && { test_event_code: env.META_TEST_EVENT_CODE }),
            }),
          },
        );
      } catch (_) {}
    }

    /* ── Notificar DAM Finanzas: actualizar shopifyOrdersTotal (Pedidos del día) ── */
    // leadDate was captured at the top of the request handler — same value used for operational_date_py.
    const leadsCountPromise = (async () => {
      try {
        const startUTC = getParaguayDayStartUTC(leadDate);
        const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
        const cntRow   = await env.DB.prepare(
          `SELECT COUNT(*) AS count FROM leads WHERE created_at >= ? AND created_at < ? AND (source_type IS NULL OR source_type != 'meta_ads_manual')`
        ).bind(
          startUTC.toISOString().replace('T', ' ').slice(0, 19),
          endUTC.toISOString().replace('T', ' ').slice(0, 19)
        ).first();
        const leadsCount = Number(cntRow?.count || 0);
        const secret = env.DAM_FINANZAS_WEBHOOK_SECRET || '';
        if (!secret) return;
        await fetch('https://us-central1-dam-finanzas-cf863.cloudfunctions.net/onLeadsCountUpdate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-dam-vertex-secret': secret },
          body: JSON.stringify({ date: leadDate, leadsCount }),
        });
        console.log('LEADS_COUNT_UPDATE', leadDate, leadsCount);
      } catch (cntErr) {
        console.warn('LEADS_COUNT_UPDATE_FAILED', cntErr?.message);
      }
    })();
    if (typeof waitUntil === 'function') waitUntil(leadsCountPromise);

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

function getParaguayDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function getParaguayDayStartUTC(dateStr) {
  // Finds the UTC timestamp of midnight (00:00) Paraguay time for dateStr.
  // Handles both PYT (UTC-4, winter) and PYST (UTC-3, summer DST).
  for (const h of [3, 4]) {
    const candidate = new Date(`${dateStr}T0${h}:00:00.000Z`);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(candidate);
    const pp = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    if (`${pp.year}-${pp.month}-${pp.day}` === dateStr && pp.hour === '00' && pp.minute === '00') {
      return candidate;
    }
  }
  return new Date(`${dateStr}T04:00:00.000Z`);
}

function getAttributionConfidence({ campaign_id, ad_id, fbclid, fbc, utm_source, utm_campaign }) {
  if (campaign_id && ad_id)             return 'high';
  if (campaign_id)                      return 'medium';
  if (fbclid || (fbc && fbc.startsWith('fb.1.'))) return 'fbc_only';
  if (utm_source || utm_campaign)       return 'utm_only';
  return 'none';
}

/* ── CAPI helpers (QualifiedLead) ── */
function normalizePhoneQL(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('595')) return d.slice(0, 12);
  if (d.startsWith('0'))   return '595' + d.slice(1);
  return '595' + d;
}

function normForMetaQL(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

async function sha256QL(str) {
  if (!str) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/* Normaliza teléfono para block check — mismo criterio que blocked-customers.js y admin.js */
function normalizePhoneBlock(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  let norm;
  if      (digits.startsWith('595')) norm = digits;
  else if (digits.startsWith('0'))   norm = '595' + digits.slice(1);
  else if (digits.startsWith('9'))   norm = '595' + digits;
  else return '';
  return /^5959\d{8}$/.test(norm) ? norm : '';
}
