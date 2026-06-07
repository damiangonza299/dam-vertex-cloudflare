/* =========================================================
   POST /api/intelligence/send-alerts
   Envío de alertas Dam Intelligence a Telegram.

   Genera alertas con el mismo motor que /api/intelligence/alerts
   y envía cada una al grupo exclusivo de Dam Intelligence.

   Variables requeridas:
     ADMIN_PASSWORD                — autenticación
     TELEGRAM_BOT_TOKEN            — ya existe (mismo bot que pedidos)
     TELEGRAM_INTELLIGENCE_CHAT_ID — grupo nuevo exclusivo de inteligencia

   Comportamiento:
     - Envía TODOS los tipos de alerta (alta, media, info)
     - 🚨 = alta  |  ⚠️ = media  |  ℹ️ = info
     - Si no hay alertas activas, no envía ningún mensaje
     - Si TELEGRAM_* no está configurado, retorna error claro
     - NO pausa anuncios. NO modifica Meta Ads. NO toca Purchase.

   Disparado por: GitHub Actions (cron diario 11:00 UTC = 07:00 PYT)
                  o manualmente vía POST autenticado.
   ========================================================= */

import { generateAlerts } from './_alert-engine.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado' }, 500);
  }
  if (!env.TELEGRAM_INTELLIGENCE_CHAT_ID) {
    return json({ ok: false, error: 'TELEGRAM_INTELLIGENCE_CHAT_ID no configurado' }, 500);
  }

  const url   = new URL(request.url);
  const force = url.searchParams.get('force') === 'true';
  const source = force ? 'manual-force' : (url.searchParams.get('source') || 'cron');

  try {
    // Tabla de log para deduplicación (crea si no existe)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_run_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        run_at      TEXT    NOT NULL,
        alerts_sent INTEGER DEFAULT 0,
        source      TEXT    DEFAULT 'cron'
      )
    `).run();

    // Protección contra duplicados: omitir si ya se ejecutó en las últimas 6 h
    if (!force) {
      const since6h = new Date(Date.now() - 6 * 3600000).toISOString();
      const last = await env.DB.prepare(
        `SELECT run_at FROM intelligence_run_log WHERE run_at >= ? ORDER BY run_at DESC LIMIT 1`
      ).bind(since6h).first();
      if (last) {
        return json({
          ok:       true,
          skipped:  true,
          message:  `Ya se ejecutó a las ${last.run_at}. Usar ?force=true para forzar.`,
          last_run: last.run_at,
        });
      }
    }

    const { alerts, generated_at } = await generateAlerts(env.DB);

    if (alerts.length === 0) {
      return json({ ok: true, sent: 0, total_alerts: 0, message: 'Sin alertas activas. No se enviaron mensajes.', generated_at });
    }

    let sent   = 0;
    let failed = 0;
    const errors = [];

    for (const alert of alerts) {
      const text = formatMessage(alert);
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              chat_id:              env.TELEGRAM_INTELLIGENCE_CHAT_ID,
              text,
              disable_web_page_preview: true,
            }),
          }
        );
        if (res.ok) {
          sent++;
        } else {
          failed++;
          const errText = await res.text();
          errors.push(`[${alert.tipo}] HTTP ${res.status}: ${errText.slice(0, 120)}`);
          console.error('TG_INTEL_FAIL', alert.tipo, res.status, errText);
        }
      } catch (tgErr) {
        failed++;
        errors.push(`[${alert.tipo}] ${tgErr.message}`);
        console.error('TG_INTEL_ERR', alert.tipo, tgErr.message);
      }
    }

    // Registrar ejecución para deduplicación
    await env.DB.prepare(
      `INSERT INTO intelligence_run_log (run_at, alerts_sent, source) VALUES (?, ?, ?)`
    ).bind(new Date().toISOString(), sent, source).run().catch(() => {});

    return json({
      ok:           true,
      sent,
      failed,
      total_alerts: alerts.length,
      generated_at,
      source,
      ...(errors.length > 0 && { errors }),
    });

  } catch (err) {
    console.error('SEND_ALERTS_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

// ── Formateadores de mensaje ─────────────────────────────────────────────────

function formatMessage(alert) {
  const ev   = alert.evidencia || {};
  const icon = alert.severidad === 'alta' ? '🚨' : alert.severidad === 'media' ? '⚠️' : 'ℹ️';

  const lines = [
    `${icon} Dam Intelligence`,
    alert.titulo,
    '',
  ];

  switch (alert.tipo) {
    case 'creative_dead':
      if (ev.ad_name || ev.ad_id)         lines.push(`Anuncio: ${ev.ad_name || ev.ad_id}`);
      if (ev.total_leads != null)          lines.push(`Leads: ${ev.total_leads}`);
      if (ev.dead_leads != null)           lines.push(`Vencidos: ${ev.dead_leads}`);
      if (ev.dead_lead_rate_pct != null)   lines.push(`Dead rate: ${ev.dead_lead_rate_pct}%`);
      if (ev.purchased != null)            lines.push(`Compras: ${ev.purchased}`);
      if (ev.purchase_rate_pct != null)    lines.push(`Purchase rate: ${ev.purchase_rate_pct}%`);
      if (ev.data_days != null)            lines.push(`Días de datos: ${ev.data_days}`);
      break;

    case 'creative_scalable':
      if (ev.ad_name || ev.ad_id)         lines.push(`Anuncio: ${ev.ad_name || ev.ad_id}`);
      if (ev.total_leads != null)          lines.push(`Leads: ${ev.total_leads}`);
      if (ev.purchased != null)            lines.push(`Compras: ${ev.purchased}`);
      if (ev.purchase_rate_pct != null)    lines.push(`Purchase rate: ${ev.purchase_rate_pct}%`);
      if (ev.avg_score != null)            lines.push(`Score promedio: ${ev.avg_score}/100`);
      if (ev.dead_lead_rate_pct != null)   lines.push(`Dead rate: ${ev.dead_lead_rate_pct}%`);
      break;

    case 'garbage_risk':
      if (ev.ad_name || ev.ad_id)         lines.push(`Anuncio: ${ev.ad_name || ev.ad_id}`);
      if (ev.city)                         lines.push(`Ciudad: ${ev.city}`);
      if (ev.total_leads != null)          lines.push(`Leads: ${ev.total_leads}`);
      if (ev.dead_leads != null)           lines.push(`Vencidos: ${ev.dead_leads}`);
      if (ev.dead_lead_rate_pct != null)   lines.push(`Dead rate: ${ev.dead_lead_rate_pct}%`);
      if (ev.stale_rate_pct != null)       lines.push(`Stale rate: ${ev.stale_rate_pct}%`);
      if (ev.purchased != null)            lines.push(`Compras: ${ev.purchased}`);
      if (ev.cancel_rate_pct != null)      lines.push(`Cancel rate: ${ev.cancel_rate_pct}%`);
      break;

    case 'winning_city':
      if (ev.city)                         lines.push(`Ciudad: ${ev.city}`);
      if (ev.total_leads != null)          lines.push(`Leads: ${ev.total_leads}`);
      if (ev.purchased != null)            lines.push(`Compras: ${ev.purchased}`);
      if (ev.purchase_rate_pct != null)    lines.push(`Conversión: ${ev.purchase_rate_pct}%`);
      if (ev.revenue)                      lines.push(`Revenue: Gs. ${Number(ev.revenue).toLocaleString('es-PY')}`);
      if (ev.data_days != null)            lines.push(`Días de datos: ${ev.data_days}`);
      break;

    case 'buyer_type_increase':
      if (ev.buyer_type)                   lines.push(`Tipo: ${ev.buyer_type}`);
      if (ev.recent_7d != null)            lines.push(`Última semana: ${ev.recent_7d} compradores`);
      if (ev.prev_7d != null)              lines.push(`Semana anterior: ${ev.prev_7d} compradores`);
      if (ev.delta_pct != null)            lines.push(`Variación: +${ev.delta_pct}%`);
      break;

    case 'conversion_drop':
      if (ev.recent_7d != null)            lines.push(`Compras esta semana: ${ev.recent_7d}`);
      if (ev.prev_7d != null)              lines.push(`Semana anterior: ${ev.prev_7d}`);
      if (ev.delta_pct != null)            lines.push(`Caída: ${ev.delta_pct}%`);
      break;
  }

  if (alert.accion_sugerida) {
    lines.push('');
    lines.push('Acción sugerida:');
    lines.push(alert.accion_sugerida);
  }

  if (alert.requiere_aprobacion) {
    lines.push('');
    lines.push('Requiere aprobación manual antes de actuar.');
  }

  return lines.join('\n');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
