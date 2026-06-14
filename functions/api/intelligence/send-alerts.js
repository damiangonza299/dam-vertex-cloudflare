/* =========================================================
   POST /api/intelligence/send-alerts  v3
   Envío de alertas Dam Intelligence a Telegram.

   Cambios v3:
     - dry_run=true simula sin enviar a Telegram ni escribir en logs
     - Mensajes incluyen: producto, campaña, período, leads, compras,
       conversión compra/lead, revenue, gasto, CPA, ROAS, confianza
     - Nuevo tipo city_risk en formatMessage y getAlertSubject
     - Deduplicación con ventana temporal por severidad:
         info → 7d | media → 14d | alta → 30d

   Variables requeridas:
     ADMIN_PASSWORD
     TELEGRAM_BOT_TOKEN
     TELEGRAM_INTELLIGENCE_CHAT_ID
   Opcionales (para CPA/ROAS y filtro de activos):
     META_MARKETING_TOKEN
     META_AD_ACCOUNT_ID

   Disparado por: GitHub Actions (cron 11:00 UTC = 07:00 PYT)
                  o manualmente vía POST autenticado.
   ========================================================= */

import { generateAlerts } from './_alert-engine.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const META_VERSION = 'v21.0';

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

  const url    = new URL(request.url);
  const force  = url.searchParams.get('force')   === 'true';
  const dryRun = url.searchParams.get('dry_run') === 'true';
  const source = dryRun ? 'dry_run' : force ? 'manual-force' : (url.searchParams.get('source') || 'cron');

  try {
    // Crear tablas de log si no existen
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_run_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        run_at      TEXT    NOT NULL,
        alerts_sent INTEGER DEFAULT 0,
        source      TEXT    DEFAULT 'cron'
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_alert_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_key   TEXT NOT NULL,
        date_bucket TEXT NOT NULL,
        sent_at     TEXT NOT NULL,
        UNIQUE(alert_key, date_bucket)
      )
    `).run();

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

    // Protección anti-ejecución duplicada (omitir en dry_run y force)
    if (!force && !dryRun) {
      const since6h = new Date(Date.now() - 6 * 3600000).toISOString();
      const last = await env.DB.prepare(
        `SELECT run_at FROM intelligence_run_log WHERE run_at >= ? ORDER BY run_at DESC LIMIT 1`
      ).bind(since6h).first();
      if (last) {
        return json({
          ok: true, skipped: true,
          message: `Ya se ejecutó a las ${last.run_at}. Usar ?force=true para forzar.`,
          last_run: last.run_at,
        });
      }
    }

    // ── Prefetch Meta: activeAdIds + metaSpendMap (misma ventana 30d) ─────────
    let activeAdIds  = null;
    let metaSpendMap = new Map();

    if (env.META_MARKETING_TOKEN && env.META_AD_ACCOUNT_ID) {
      const rawAccId = String(env.META_AD_ACCOUNT_ID);
      const accId    = rawAccId.startsWith('act_') ? rawAccId : `act_${rawAccId}`;

      // 1. IDs de anuncios activos (para filtrar creativos inactivos en el motor)
      try {
        const activeUrl = new URL(`https://graph.facebook.com/${META_VERSION}/${accId}/ads`);
        activeUrl.searchParams.set('fields', 'id,effective_status');
        activeUrl.searchParams.set('filtering', JSON.stringify([
          { field: 'effective_status', operator: 'IN', value: ['ACTIVE'] },
        ]));
        activeUrl.searchParams.set('limit', '500');
        activeUrl.searchParams.set('access_token', env.META_MARKETING_TOKEN);

        const res = await fetch(activeUrl.toString());
        if (res.ok) {
          const data = await res.json();
          activeAdIds = new Set((data.data || []).map(a => String(a.id)));
          console.log('ALERT_META_ACTIVE_ADS', activeAdIds.size);
        } else {
          console.warn('ALERT_META_ACTIVE_FAIL', res.status);
        }
      } catch (e) {
        console.warn('ALERT_META_ACTIVE_ERR', e.message);
      }

      // 2. Gasto por anuncio — ventana 30d (misma que D1 para ROAS/CPA consistente)
      try {
        const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const today   = new Date().toISOString().slice(0, 10);
        const insUrl  = new URL(`https://graph.facebook.com/${META_VERSION}/${accId}/insights`);
        insUrl.searchParams.set('fields', 'ad_id,spend');
        insUrl.searchParams.set('level', 'ad');
        insUrl.searchParams.set('time_range', JSON.stringify({ since: since30, until: today }));
        insUrl.searchParams.set('limit', '500');
        insUrl.searchParams.set('access_token', env.META_MARKETING_TOKEN);

        const res = await fetch(insUrl.toString());
        if (res.ok) {
          const data = await res.json();
          for (const row of (data.data || [])) {
            if (row.ad_id && row.spend) {
              metaSpendMap.set(String(row.ad_id), { spend: Number(row.spend) });
            }
          }
          console.log('ALERT_META_SPEND_ADS', metaSpendMap.size);
        } else {
          console.warn('ALERT_META_SPEND_FAIL', res.status);
        }
      } catch (e) {
        console.warn('ALERT_META_SPEND_ERR', e.message);
      }
    } else {
      console.warn('ALERT_META_SKIP — META_MARKETING_TOKEN o META_AD_ACCOUNT_ID no configurados. Fallback seguro: sin filtro de activos, sin CPA/ROAS.');
    }
    // ─────────────────────────────────────────────────────────────────────────

    const { alerts, generated_at, global_conv_rate_pct } = await generateAlerts(env.DB, {
      metaSpendMap,
      activeAdIds,
    });

    if (alerts.length === 0) {
      if (!dryRun) await logRun(env.DB, 0, source);
      return json({
        ok: true, sent: 0, total_alerts: 0,
        message: 'Sin alertas activas. No se enviaron mensajes.',
        generated_at, dry_run: dryRun,
      });
    }

    const bucket       = getWeekBucket();
    let sent           = 0;
    let failed         = 0;
    let dedupSkipped   = 0;
    const errors       = [];
    const dryRunMessages = [];

    for (const alert of alerts) {
      const alertKey   = `${alert.tipo}:${getAlertSubject(alert)}:${alert.severidad}`;
      const windowDays = getDedupWindowDays(alert.severidad);

      // Dedup con ventana temporal (también en dry_run para simular comportamiento real)
      if (!force) {
        const windowStart = new Date(Date.now() - windowDays * 86400000).toISOString();
        const existing = await env.DB.prepare(
          `SELECT id FROM intelligence_alert_log WHERE alert_key = ? AND sent_at >= ?`
        ).bind(alertKey, windowStart).first();
        if (existing) {
          dedupSkipped++;
          continue;
        }
      }

      const text = formatMessage(alert, global_conv_rate_pct);

      // dry_run: colectar mensajes sin enviar a Telegram ni escribir logs
      if (dryRun) {
        sent++;
        dryRunMessages.push({
          alert_key:  alertKey,
          tipo:       alert.tipo,
          severidad:  alert.severidad,
          titulo:     alert.titulo,
          text,
        });
        continue;
      }

      try {
        const res = await fetch(
          `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              chat_id: chatId,
              text,
              disable_web_page_preview: true,
            }),
          }
        );
        if (res.ok) {
          sent++;
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

    if (!dryRun) await logRun(env.DB, sent, source);

    if (dryRun) {
      return json({
        ok:            true,
        dry_run:       true,
        would_send:    sent,
        dedup_skipped: dedupSkipped,
        total_alerts:  alerts.length,
        generated_at,
        active_ads:    activeAdIds ? activeAdIds.size : null,
        spend_ads:     metaSpendMap.size,
        messages:      dryRunMessages,
      });
    }

    return json({
      ok:            true,
      sent,
      failed,
      dedup_skipped: dedupSkipped,
      total_alerts:  alerts.length,
      generated_at,
      source,
      active_ads:    activeAdIds ? activeAdIds.size : null,
      spend_ads:     metaSpendMap.size,
      ...(errors.length > 0 && { errors }),
    });

  } catch (err) {
    console.error('SEND_ALERTS_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

// ── Formateadores de mensaje ──────────────────────────────────────────────────

function formatMessage(alert, globalConvPct) {
  const ev   = alert.evidencia || {};
  const icon = alert.severidad === 'alta' ? '🚨' : alert.severidad === 'media' ? '⚠️' : 'ℹ️';

  const lines = [
    `${icon} Dam Intelligence`,
    alert.titulo,
    '',
    `Período: ${alert.periodo || 'últimos 30 días'}`,
  ];

  switch (alert.tipo) {

    case 'creative_dead':
    case 'creative_scalable':
    case 'garbage_risk': {
      if (ev.campaign_name)  lines.push(`Campaña: ${ev.campaign_name}`);
      if (ev.ad_name)        lines.push(`Anuncio: ${ev.ad_name}`);
      lines.push('');
      if (ev.total_leads != null)        lines.push(`Leads: ${ev.total_leads}`);
      if (ev.purchased != null)          lines.push(`Compras: ${ev.purchased}`);
      if (ev.purchase_rate_pct != null)  lines.push(`Conversión: ${ev.purchase_rate_pct}%`);
      if (ev.revenue)                    lines.push(`Revenue: Gs. ${fmtN(ev.revenue)}`);
      if (ev.dead_leads != null)         lines.push(`Vencidos: ${ev.dead_leads}`);
      if (ev.dead_lead_rate_pct != null) lines.push(`Dead rate: ${ev.dead_lead_rate_pct}%`);
      if (ev.cancel_rate_pct != null)    lines.push(`Cancel rate: ${ev.cancel_rate_pct}%`);
      if (ev.avg_score != null)          lines.push(`Score comprador: ${ev.avg_score}/100`);
      if (ev.meta_spend)                 lines.push(`Gasto Meta: Gs. ${fmtN(ev.meta_spend)}`);
      if (ev.cpa_real != null)           lines.push(`CPA real: Gs. ${fmtN(ev.cpa_real)}`);
      if (ev.avg_ticket != null)         lines.push(`Ticket promedio: Gs. ${fmtN(ev.avg_ticket)}`);
      if (ev.roas != null)               lines.push(`ROAS: ${ev.roas}x`);
      if (ev.data_days != null)          lines.push(`Días de datos: ${ev.data_days}`);
      break;
    }

    case 'winning_city':
    case 'city_risk': {
      if (ev.product_name)   lines.push(`Producto: ${ev.product_name}`);
      if (ev.campaign_name)  lines.push(`Campaña: ${ev.campaign_name}`);
      lines.push('');
      if (ev.total_leads != null)        lines.push(`Leads: ${ev.total_leads}`);
      if (ev.purchased != null)          lines.push(`Compras: ${ev.purchased}`);
      if (ev.purchase_rate_pct != null)  lines.push(`Conversión: ${ev.purchase_rate_pct}%`);
      if (ev.national_rate_pct != null)  lines.push(`Promedio nacional (producto): ${ev.national_rate_pct}%`);
      if (ev.delta_vs_national != null) {
        const sign = ev.delta_vs_national >= 0 ? '+' : '';
        lines.push(`Diferencia: ${sign}${ev.delta_vs_national}pp`);
      }
      if (ev.revenue)                    lines.push(`Revenue: Gs. ${fmtN(ev.revenue)}`);
      if (ev.data_days != null)          lines.push(`Días de datos: ${ev.data_days}`);
      if (ev.confidence)                 lines.push(`Confianza: ${ev.confidence}`);
      break;
    }

    case 'buyer_type_increase': {
      if (ev.buyer_type)   lines.push(`Tipo: ${ev.buyer_type}`);
      lines.push('');
      if (ev.recent_7d != null) lines.push(`Esta semana: ${ev.recent_7d} compradores`);
      if (ev.prev_7d != null)   lines.push(`Semana anterior: ${ev.prev_7d} compradores`);
      if (ev.delta_pct != null) lines.push(`Variación: +${ev.delta_pct}%`);
      break;
    }

    case 'conversion_drop': {
      lines.push('');
      if (ev.recent_purchased != null) lines.push(`Compras esta semana: ${ev.recent_purchased}`);
      if (ev.prev_purchased != null)   lines.push(`Compras semana anterior: ${ev.prev_purchased}`);
      if (ev.delta_pct != null)        lines.push(`Variación compras: ${ev.delta_pct}%`);
      lines.push('');
      if (ev.recent_leads != null)     lines.push(`Leads esta semana: ${ev.recent_leads}`);
      if (ev.prev_leads != null)       lines.push(`Leads semana anterior: ${ev.prev_leads}`);
      if (ev.tipo_caida) {
        const tipo = ev.tipo_caida === 'cierre'
          ? 'Caída de cierre (tráfico activo)'
          : 'Caída de demanda y cierre';
        lines.push(`Diagnóstico: ${tipo}`);
      }
      break;
    }

    case 'product_winner': {
      lines.push('');
      if (ev.product_name)              lines.push(`Producto: ${ev.product_name}`);
      if (ev.total_leads != null)       lines.push(`Leads: ${ev.total_leads}`);
      if (ev.purchased != null)         lines.push(`Compras: ${ev.purchased}`);
      if (ev.purchase_rate_pct != null) lines.push(`Conversión: ${ev.purchase_rate_pct}%`);
      if (ev.revenue)                   lines.push(`Revenue: Gs. ${fmtN(ev.revenue)}`);
      break;
    }

    case 'product_risk': {
      lines.push('');
      if (ev.product_name)              lines.push(`Producto: ${ev.product_name}`);
      if (ev.total_leads != null)       lines.push(`Leads: ${ev.total_leads}`);
      if (ev.purchased != null)         lines.push(`Compras: ${ev.purchased}`);
      if (ev.purchase_rate_pct != null) lines.push(`Conversión: ${ev.purchase_rate_pct}%`);
      if (ev.revenue != null)           lines.push(`Revenue: Gs. ${fmtN(ev.revenue)}`);
      if (ev.dead_leads != null)        lines.push(`Vencidos: ${ev.dead_leads}`);
      if (ev.dead_rate_pct != null)     lines.push(`Dead rate: ${ev.dead_rate_pct}%`);
      if (ev.posible_causa)             lines.push(`Posible causa: ${ev.posible_causa}`);
      break;
    }

    case 'cpa_high': {
      if (ev.campaign_name)             lines.push(`Campaña: ${ev.campaign_name}`);
      if (ev.ad_name)                   lines.push(`Anuncio: ${ev.ad_name}`);
      lines.push('');
      if (ev.total_leads != null)       lines.push(`Leads: ${ev.total_leads}`);
      if (ev.purchased != null)         lines.push(`Compras reales: ${ev.purchased}`);
      if (ev.purchase_rate_pct != null) lines.push(`Conversión: ${ev.purchase_rate_pct}%`);
      if (ev.meta_spend != null)        lines.push(`Gasto Meta: Gs. ${fmtN(ev.meta_spend)}`);
      if (ev.cpa_real != null)          lines.push(`CPA real: Gs. ${fmtN(ev.cpa_real)}`);
      if (ev.avg_ticket != null)        lines.push(`Ticket promedio: Gs. ${fmtN(ev.avg_ticket)}`);
      if (ev.cpa_ratio_pct != null)     lines.push(`CPA / Ticket: ${ev.cpa_ratio_pct}%`);
      if (ev.revenue)                   lines.push(`Revenue: Gs. ${fmtN(ev.revenue)}`);
      break;
    }

    case 'roas_alert': {
      if (ev.campaign_name)             lines.push(`Campaña: ${ev.campaign_name}`);
      if (ev.ad_name)                   lines.push(`Anuncio: ${ev.ad_name}`);
      lines.push('');
      if (ev.total_leads != null)       lines.push(`Leads: ${ev.total_leads}`);
      if (ev.purchased != null)         lines.push(`Compras: ${ev.purchased}`);
      if (ev.purchase_rate_pct != null) lines.push(`Conversión: ${ev.purchase_rate_pct}%`);
      if (ev.meta_spend != null)        lines.push(`Gasto Meta: Gs. ${fmtN(ev.meta_spend)}`);
      if (ev.revenue != null)           lines.push(`Revenue real: Gs. ${fmtN(ev.revenue)}`);
      if (ev.roas != null)              lines.push(`ROAS: ${ev.roas}x`);
      break;
    }

    default:
      lines.push('');
      lines.push(alert.explicacion || '');
  }

  if (alert.accion_sugerida) {
    lines.push('');
    lines.push(`Accion: ${alert.accion_sugerida}`);
  }

  if (alert.requiere_aprobacion) {
    lines.push('');
    lines.push('Requiere aprobacion manual antes de actuar.');
  }

  return lines.filter(l => l !== undefined).join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDedupWindowDays(severidad) {
  if (severidad === 'info')  return 7;
  if (severidad === 'media') return 14;
  return 30; // alta
}

function getAlertSubject(alert) {
  const ev = alert.evidencia || {};
  if (ev.ad_id)                        return `ad:${ev.ad_id}`;
  if (ev.city && ev.product_slug)      return `city:${String(ev.city).toLowerCase()}:${ev.product_slug}`;
  if (ev.city)                         return `city:${String(ev.city).toLowerCase()}`;
  if (ev.product_slug)                 return `product:${ev.product_slug}`;
  if (ev.buyer_type)                   return `buyer:${ev.buyer_type}`;
  return 'global';
}

function getWeekBucket(date = new Date()) {
  const d   = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week      = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function logRun(DB, alertsSent, source) {
  await DB.prepare(
    `INSERT INTO intelligence_run_log (run_at, alerts_sent, source) VALUES (?, ?, ?)`
  ).bind(new Date().toISOString(), alertsSent, source).run().catch(() => {});
}

function fmtN(n) { return Math.round(n || 0).toLocaleString('es-PY'); }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
