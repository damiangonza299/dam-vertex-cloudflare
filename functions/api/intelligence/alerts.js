/* =========================================================
   GET /api/intelligence/alerts
   Sistema de Alertas Automáticas — Dam Intelligence

   Genera alertas en tiempo real desde D1 (sin Meta API).
   Lógica centralizada en _alert-engine.js.

   Tipos: creative_dead | creative_scalable | garbage_risk |
          winning_city | buyer_type_increase | conversion_drop

   Auth: Bearer ADMIN_PASSWORD
   ========================================================= */

import { generateAlerts } from './_alert-engine.js';

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
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const { alerts, generated_at } = await generateAlerts(env.DB);
    return json({ ok: true, alerts, total: alerts.length, generated_at });
  } catch (err) {
    console.error('ALERTS_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
