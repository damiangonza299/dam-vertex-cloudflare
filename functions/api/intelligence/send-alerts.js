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
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado' }, 500);
  }
  if (!env.TELEGRAM_INTELLIGENCE_CHAT_ID) {
    return json({ ok: false, error: 'TELEGRAM_INTELLIGENCE_CHAT_ID no configurado' }, 500);
  }

  const chatId = env.TELEGRAM_INTELLIGENCE_CHAT_ID.replace(/^﻿/, '').trim();

  const url   = new URL(request.url);
  const force = url.searchParams.get('force') === 'true';
  const source = force ? 'manual-force' : (url.searchParams.get('source') || 'cron');

  try {
    // Tablas de log para deduplicación (crea si no existen)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_run_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        run_at      TEXT    NOT NULL,
        alerts_sent INTEGER DEFAULT 0,
        source      TEXT    DEFAULT 'cron'
      )
    `).run();

    // Historial por alerta individual — clave única (tipo:sujeto:severidad, bucket_semanal)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_alert_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_key   TEXT NOT NULL,
        date_bucket TEXT NOT NULL,
        sent_at     TEXT NOT NULL,
        UNIQUE(alert_key, date_bucket)
      )
    `).run();

    // Log de alertas descartadas por estado inactivo en Meta
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_meta_filter_log (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo             TEXT NOT NULL,
        ad_id            TEXT NOT NULL,
        ad_name          TEXT,
        effective_status TEXT NOT NULL,
        filtered_at      TEXT NOT NULL
      )
    `).run();

    // Protección contra duplicados de ejecución: omitir si ya se ejecutó en las últimas 6 h
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

    // ── Validación Meta: effective_status de todos los ad_id únicos ──────────
    // Fetch en paralelo antes del loop para minimizar llamadas API.
    const adStatusMap = new Map(); // ad_id (string) → { effective_status, name }
    const uniqueAdIds = [...new Set(
      alerts.filter(a => a.evidencia?.ad_id).map(a => String(a.evidencia.ad_id))
    )];

    if (uniqueAdIds.length > 0) {
      if (env.META_MARKETING_TOKEN) {
        await Promise.all(uniqueAdIds.map(async (adId) => {
          try {
            const u = new URL(`https://graph.facebook.com/v21.0/${adId}`);
            u.searchParams.set('fields', 'id,name,effective_status');
            u.searchParams.set('access_token', env.META_MARKETING_TOKEN);
            const res = await fetch(u.toString());
            if (res.ok) {
              const d = await res.json();
              adStatusMap.set(adId, { effective_status: d.effective_status || 'UNKNOWN', name: d.name || null });
            } else {
              console.warn('ALERT_META_STATUS_FAIL', adId, res.status);
            }
          } catch (e) {
            console.warn('ALERT_META_STATUS_ERR', adId, e.message);
          }
        }));
      } else {
        console.warn('ALERT_META_SKIP_NO_TOKEN — validación Meta omitida, META_MARKETING_TOKEN no configurado');
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const bucket = getWeekBucket();
    let sent            = 0;
    let failed          = 0;
    let dedupSkipped    = 0;
    let metaFiltered    = 0;
    const metaFilterDetails = [];
    const errors = [];

    for (const alert of alerts) {
      // ── Filtro Meta: verificar estado actual del activo antes de todo ────
      if (alert.evidencia?.ad_id) {
        const adId    = String(alert.evidencia.ad_id);
        const metaInfo = adStatusMap.get(adId);
        if (metaInfo && metaInfo.effective_status !== 'ACTIVE') {
          const adName = metaInfo.name || alert.evidencia.ad_name || null;
          console.log('ALERT_META_FILTERED', alert.tipo, `ad:${adId}`, metaInfo.effective_status);
          metaFiltered++;
          metaFilterDetails.push({
            tipo:             alert.tipo,
            ad_id:            adId,
            ad_name:          adName,
            effective_status: metaInfo.effective_status,
            filtered_at:      new Date().toISOString(),
          });
          await env.DB.prepare(
            `INSERT INTO intelligence_meta_filter_log (tipo, ad_id, ad_name, effective_status, filtered_at) VALUES (?, ?, ?, ?, ?)`
          ).bind(alert.tipo, adId, adName, metaInfo.effective_status, new Date().toISOString()).run().catch(() => {});
          continue;
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      const alertKey = `${alert.tipo}:${getAlertSubject(alert)}:${alert.severidad}`;

      // Dedup por alerta: saltar si ya fue enviada esta semana con la misma clave
      if (!force) {
        const existing = await env.DB.prepare(
          `SELECT id FROM intelligence_alert_log WHERE alert_key = ? AND date_bucket = ?`
        ).bind(alertKey, bucket).first();
        if (existing) {
          dedupSkipped++;
          continue;
        }
      }

      const text = formatMessage(alert);
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              chat_id:              chatId,
              text,
              disable_web_page_preview: true,
            }),
          }
        );
        if (res.ok) {
          sent++;
          // Registrar en historial para evitar reenvíos futuros esta semana
          await env.DB.prepare(
            `INSERT OR IGNORE INTO intelligence_alert_log (alert_key, date_bucket, sent_at) VALUES (?, ?, ?)`
          ).bind(alertKey, bucket, new Date().toISOString()).run().catch(() => {});
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

    // Registrar ejecución para deduplicación de runs completos
    await env.DB.prepare(
      `INSERT INTO intelligence_run_log (run_at, alerts_sent, source) VALUES (?, ?, ?)`
    ).bind(new Date().toISOString(), sent, source).run().catch(() => {});

    return json({
      ok:                  true,
      sent,
      failed,
      dedup_skipped:       dedupSkipped,
      meta_filtered:       metaFiltered,
      total_alerts:        alerts.length,
      generated_at,
      source,
      ...(metaFilterDetails.length > 0 && { meta_filter_details: metaFilterDetails }),
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

// ── Helpers de deduplicación ──────────────────────────────────────────────────

function getAlertSubject(alert) {
  const ev = alert.evidencia || {};
  if (ev.ad_id)      return `ad:${ev.ad_id}`;
  if (ev.city)       return `city:${String(ev.city).toLowerCase()}`;
  if (ev.buyer_type) return `buyer:${ev.buyer_type}`;
  return 'global';
}

function getWeekBucket(date = new Date()) {
  // ISO-8601 week bucket: YYYY-WNN — misma alerta no se reenvía dentro de la misma semana
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
