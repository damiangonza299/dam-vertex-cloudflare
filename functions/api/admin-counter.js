/* =========================================================
   /api/admin-counter — Contadores del día para el panel PiP
   GET → { leads_today, purchases_today }

   Fuente: D1, consulta directa (no KV).
   leads_today     = COUNT leads con status='pending' creados hoy (Paraguay)
   purchases_today = COUNT leads con status='purchased' confirmados hoy (Paraguay, por purchased_at)
   Los nombres de las keys se mantienen por compatibilidad con counter.html,
   pero ya no son "total leads del día" / "total compras del día" — son el
   pendiente real y las confirmaciones reales de hoy, cada uno de su propia
   cohorte (evita el problema de comparar leads creados hoy contra compras
   confirmadas hoy de leads viejos, que con KV daba números inconsistentes).
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
    const startUTC = getParaguayDayStartUTC(date);
    const endUTC   = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
    const startStr = startUTC.toISOString().replace('T', ' ').slice(0, 19);
    const endStr   = endUTC.toISOString().replace('T', ' ').slice(0, 19);

    const [pendingRow, purchasesRow] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) AS count FROM leads
         WHERE status = 'pending'
           AND ((operational_date_py = ?) OR (operational_date_py IS NULL AND created_at >= ? AND created_at < ?))`
      ).bind(date, startStr, endStr).first(),
      env.DB.prepare(
        `SELECT COUNT(*) AS count FROM leads
         WHERE status = 'purchased'
           AND purchased_at >= ? AND purchased_at < ?`
      ).bind(startStr, endStr).first(),
    ]);

    return json({
      ok: true,
      leads_today:     Number(pendingRow?.count || 0),
      purchases_today: Number(purchasesRow?.count || 0),
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

/* DST-safe: Paraguay es UTC-4 (abr-sep, PYT) o UTC-3 (oct-mar, PYST).
   Mismo patrón que admin-leads-count.js — no asumir un offset fijo. */
function getParaguayDayStartUTC(dateStr) {
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
  return new Date(`${dateStr}T04:00:00.000Z`); // fallback seguro
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
