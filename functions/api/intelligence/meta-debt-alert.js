/* =========================================================
   POST /api/intelligence/meta-debt-alert
   Alerta de deuda Meta Ads — chequeo horario.

   Consulta GET /{account}?fields=amount_spent,balance,funding_source_details
   y usa balance (monto adeudado desde el último pago, sube y baja con
   cada pago) como "deuda actual". amount_spent se descartó: es un
   acumulado histórico que nunca baja de 700.000 en esta cuenta y
   generaría alerta cada 6h para siempre — verificado en dry_run
   (amount_spent=24.572.957 vs balance=386.554 el 2026-08-12).

   Si deuda >= UMBRAL_ALERTA (Gs. 700.000) envía alerta al grupo Telegram
   DAM INTELLIGENCE. Si ya bajó de ese umbral, no envía nada.
   No repite la alerta más de una vez cada DEDUP_HOURS (6h) aunque la
   deuda se mantenga alta.

   Variables requeridas:
     SERVICE_SECRET
     TELEGRAM_BOT_TOKEN
     TELEGRAM_INTELLIGENCE_CHAT_ID
     META_MARKETING_TOKEN
     META_AD_ACCOUNT_ID   (act_992345752726304 — cuenta PYG, no multiplicar por tasa USD)

   Disparado por: GitHub Actions (cron cada hora, meta-debt-alert-hourly.yml)
                  o manualmente vía POST autenticado.
   ========================================================= */

import { verifyServiceToken } from '../../_lib/adminAuth.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const META_VERSION   = 'v21.0';
const UMBRAL_ALERTA  = 700000;  // Gs. — a partir de acá se envía alerta
const LIMITE_CUENTA  = 840000;  // Gs. — límite de cuenta informado en el mensaje
const DEDUP_HOURS    = 6;

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  if (!(await verifyServiceToken(request, env))) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado' }, 500);
  }
  if (!env.TELEGRAM_INTELLIGENCE_CHAT_ID) {
    return json({ ok: false, error: 'TELEGRAM_INTELLIGENCE_CHAT_ID no configurado' }, 500);
  }
  if (!env.META_MARKETING_TOKEN || !env.META_AD_ACCOUNT_ID) {
    return json({ ok: false, error: 'META_MARKETING_TOKEN o META_AD_ACCOUNT_ID no configurados' }, 500);
  }

  const chatId  = env.TELEGRAM_INTELLIGENCE_CHAT_ID.replace(/^﻿/, '').trim();
  const rawAcc  = String(env.META_AD_ACCOUNT_ID);
  const accId   = rawAcc.startsWith('act_') ? rawAcc : `act_${rawAcc}`;

  const url    = new URL(request.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';
  const force  = url.searchParams.get('force')   === 'true';

  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS intelligence_meta_debt_log (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        balance REAL    NOT NULL,
        sent_at TEXT    NOT NULL
      )
    `).run();

    const metaUrl = new URL(`https://graph.facebook.com/${META_VERSION}/${accId}`);
    metaUrl.searchParams.set('fields', 'amount_spent,balance,funding_source_details');
    metaUrl.searchParams.set('access_token', env.META_MARKETING_TOKEN);

    const res = await fetch(metaUrl.toString());
    if (!res.ok) {
      const errText = await res.text();
      console.error('META_DEBT_FETCH_FAIL', res.status, errText);
      return json({ ok: false, error: `Meta API HTTP ${res.status}`, detail: errText.slice(0, 300) }, 502);
    }

    const data  = await res.json();
    const deuda = Number(data.balance || 0);

    if (dryRun) {
      return json({
        ok: true, dry_run: true, deuda,
        threshold_check: deuda >= UMBRAL_ALERTA ? 'ALERTARIA' : 'no_alertaria',
      });
    }

    if (deuda < UMBRAL_ALERTA) {
      return json({ ok: true, sent: false, deuda, message: 'Deuda bajo el umbral. No se envía alerta.' });
    }

    if (!force) {
      const windowStart = new Date(Date.now() - DEDUP_HOURS * 3600000).toISOString();
      const last = await env.DB.prepare(
        `SELECT id FROM intelligence_meta_debt_log WHERE sent_at >= ? ORDER BY sent_at DESC LIMIT 1`
      ).bind(windowStart).first();
      if (last) {
        return json({
          ok: true, sent: false, skipped: true, deuda,
          message: `Ya se alertó en las últimas ${DEDUP_HOURS}h. No se repite.`,
        });
      }
    }

    const pct  = Math.round((deuda / LIMITE_CUENTA) * 100);
    const text = [
      '🚨 DEUDA META ADS 🚨',
      '',
      `💳 Deuda actual: Gs. ${fmtN(deuda)}`,
      `🔴 Límite: Gs. ${fmtN(LIMITE_CUENTA)}`,
      `📊 Usado: ${pct}% del límite`,
      '',
      '⚡ ACCIÓN REQUERIDA: Pagar antes de que se bloqueen los anuncios',
    ].join('\n');

    const tgRes = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      }
    );

    if (!tgRes.ok) {
      const errText = await tgRes.text();
      console.error('TG_DEBT_FAIL', tgRes.status, errText);
      return json({ ok: false, error: `Telegram HTTP ${tgRes.status}`, detail: errText.slice(0, 200) }, 502);
    }

    await env.DB.prepare(
      `INSERT INTO intelligence_meta_debt_log (balance, sent_at) VALUES (?, ?)`
    ).bind(deuda, new Date().toISOString()).run().catch(() => {});

    return json({ ok: true, sent: true, deuda, pct });

  } catch (err) {
    console.error('META_DEBT_ALERT_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

function fmtN(n) { return Math.round(n || 0).toLocaleString('es-PY'); }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
