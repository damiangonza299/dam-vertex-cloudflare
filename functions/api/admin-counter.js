/* =========================================================
   /api/admin-counter — Contadores del día para el panel PiP
   GET → { leads_today, purchases_today }

   Fuente: Cloudflare KV (plan Free — sin Durable Objects).
   Los contadores se incrementan en leads.js / confirm-purchase.js
   al momento de cada evento, con clave por fecha Paraguay
   (counter:leads:{fecha} / counter:purchases:{fecha}) para que
   reinicien solos cada día sin necesidad de un job de reset.
   ========================================================= */

import { verifyAdminToken } from '../_lib/adminAuth.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  if (!(await verifyAdminToken(request, env))) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const date = getParaguayDateString();
    const [leadsVal, purchasesVal] = await Promise.all([
      env.COUNTER_KV.get(`counter:leads:${date}`),
      env.COUNTER_KV.get(`counter:purchases:${date}`),
    ]);

    return json({
      ok: true,
      leads_today:     Number(leadsVal || 0),
      purchases_today: Number(purchasesVal || 0),
    });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

/* Misma lógica de día operativo Paraguay que functions/api/leads.js — reutilizada, no reinventada */
function getParaguayDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
