/* =========================================================
   GET|POST /api/radar/scan
   DAM Product Radar — Motor de detección automática

   Params (query string):
     dry_run=true        → ejecuta sin escribir D1 ni enviar Telegram
     source=meta|aliexpress|all  → fuente a escanear (default: all)

   Auth: Bearer ADMIN_PASSWORD

   Variables requeridas:
     ADMIN_PASSWORD
     META_MARKETING_TOKEN
     TELEGRAM_BOT_TOKEN
     TELEGRAM_INTELLIGENCE_CHAT_ID
   ========================================================= */

import { scanMetaAds }       from './_meta-ads-scanner.js';
import { scanAliExpress }    from './_aliexpress-scanner.js';
import { scanMercadoLibre }  from './_mercadolibre-scanner.js';
import { scoreCandidate, normalizeProductName, nameHash } from './_radar-scorer.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SCORE_CANDIDATE = 70;  // umbral → product_candidates + Telegram
const SCORE_WATCHLIST = 50;  // umbral → candidate_watchlist
const MAX_ALERTS_DAY  = 5;
const ALERT_COOLDOWN_H = 72;
const SCAN_COOLDOWN_MIN = 60;

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
export async function onRequestGet(ctx)  { return handleScan(ctx); }
export async function onRequestPost(ctx) { return handleScan(ctx); }

// ── Handler principal ──────────────────────────────────────────────────────

async function handleScan({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url    = new URL(request.url);
  const dryRun = url.searchParams.get('dry_run') === 'true';
  const source = url.searchParams.get('source') || 'all';

  if (!['all', 'meta', 'aliexpress', 'mercadolibre'].includes(source)) {
    return json({ ok: false, error: 'source debe ser: all | meta | aliexpress | mercadolibre' }, 400);
  }

  try {
    await initTables(env.DB);

    // Anti-spam: no más de 1 scan real por hora
    if (!dryRun) {
      const sinceMs  = new Date(Date.now() - SCAN_COOLDOWN_MIN * 60000).toISOString();
      const lastRun  = await env.DB.prepare(
        `SELECT run_at FROM radar_run_log WHERE run_at >= ? AND dry_run = 0 ORDER BY run_at DESC LIMIT 1`
      ).bind(sinceMs).first();
      if (lastRun) {
        const nextTs = new Date(new Date(lastRun.run_at).getTime() + SCAN_COOLDOWN_MIN * 60000).toISOString();
        return json({
          ok: true, skipped: true,
          message: `Scan ejecutado a las ${lastRun.run_at}. Próximo disponible: ${nextTs}.`,
          last_run: lastRun.run_at,
        });
      }
    }

    // ── Ejecutar scanners ────────────────────────────────────────────────────
    const rawCandidates = [];
    const scanLog       = {};

    if (source === 'all' || source === 'meta') {
      const res = await scanMetaAds(env, { dryRun });
      const metaErrors = (res.debug || []).filter(d => d.status || d.api_error).length;
      scanLog.meta = {
        ok: res.ok, count: res.candidates?.length ?? 0, error: res.error,
        permission_issue: metaErrors > 0 ? 'Ads Library API requiere permiso especial en Meta App Review. Ver: https://developers.facebook.com/docs/marketing-api/reference/ads-archive' : null,
        debug_sample: (res.debug || []).slice(0, 2),
      };
      if (res.ok) rawCandidates.push(...(res.candidates || []));
    }

    if (source === 'all' || source === 'aliexpress') {
      const res = await scanAliExpress(env, { dryRun });
      scanLog.aliexpress = { ok: res.ok, count: res.candidates?.length ?? 0, error: res.error, debug: res.debug };
      if (res.ok) rawCandidates.push(...(res.candidates || []));
    }

    if (source === 'all' || source === 'mercadolibre') {
      const res = await scanMercadoLibre(env, { dryRun });
      scanLog.mercadolibre = { ok: res.ok, count: res.candidates?.length ?? 0, error: res.error, debug: res.debug };
      if (res.ok) rawCandidates.push(...(res.candidates || []));
    }

    // ── Deduplicación cross-source ───────────────────────────────────────────
    const deduped = deduplicateByName(rawCandidates);

    // ── Scoring ──────────────────────────────────────────────────────────────
    const scored = [];
    for (const c of deduped) {
      const { opportunity_score, score_breakdown, action_recommended } = scoreCandidate(c);
      scored.push({ ...c, opportunity_score, score_breakdown, action_recommended });
    }
    scored.sort((a, b) => b.opportunity_score - a.opportunity_score);

    // ── Anti-spam Telegram: cuántas alertas ya salieron hoy ─────────────────
    const since24h     = new Date(Date.now() - 86400000).toISOString();
    const alertsToday  = dryRun ? 0 : await countAlertsToday(env.DB, since24h);
    let remainingSlots = MAX_ALERTS_DAY - alertsToday;

    // ── Persistir en D1 y enviar Telegram ───────────────────────────────────
    let candidatesNew = 0, candidatesUpd = 0, watchlistNew = 0, alertsSent = 0;
    const dryLog      = [];

    for (const c of scored) {
      const hash = await nameHash(c.name);

      if (c.opportunity_score >= SCORE_CANDIDATE) {
        const existing = await findExistingCandidate(env.DB, hash, c.source_id);

        if (!dryRun) {
          if (existing) {
            await env.DB.prepare(`
              UPDATE product_candidates SET
                last_seen_at         = datetime('now'),
                opportunity_score    = ?,
                score_breakdown_json = ?,
                signals_json         = ?,
                updated_at           = datetime('now')
              WHERE id = ?
            `).bind(c.opportunity_score, JSON.stringify(c.score_breakdown), JSON.stringify(c.signals), existing.id).run();
            candidatesUpd++;
          } else {
            await env.DB.prepare(`
              INSERT INTO product_candidates
                (id, source, source_id, source_url, name, description, category, image_url,
                 signals_json, signal_strength, opportunity_score, score_breakdown_json,
                 status, name_hash, first_seen_at, last_seen_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, datetime('now'), datetime('now'), datetime('now'))
            `).bind(
              crypto.randomUUID(),
              c.source, c.source_id || null, c.source_url || null,
              c.name, c.description || null, c.category || null, c.image_url || null,
              JSON.stringify(c.signals || {}),
              Math.min(100, c.opportunity_score),
              c.opportunity_score,
              JSON.stringify(c.score_breakdown),
              hash,
            ).run();
            candidatesNew++;
          }
        }

        // Telegram: solo si no hay cooldown y quedan slots
        const inCooldown = existing ? isInCooldown(existing.alert_sent_at, ALERT_COOLDOWN_H) : false;
        if (!inCooldown && remainingSlots > 0) {
          const msg = buildTelegramMessage(c);
          if (dryRun) {
            dryLog.push({ action: 'telegram', name: c.name, score: c.opportunity_score, message: msg });
          } else {
            const sent = await sendTelegram(env, msg);
            if (sent) {
              alertsSent++;
              remainingSlots--;
              const rowId = existing?.id || await getIdByHash(env.DB, hash);
              if (rowId) {
                await env.DB.prepare(
                  `UPDATE product_candidates SET alert_sent_at = datetime('now'), alert_count = alert_count + 1 WHERE id = ?`
                ).bind(rowId).run().catch(() => {});
              }
            }
          }
        } else if (dryRun && !inCooldown && remainingSlots <= 0) {
          dryLog.push({ action: 'telegram_skipped_quota', name: c.name, score: c.opportunity_score });
        } else if (dryRun && inCooldown) {
          dryLog.push({ action: 'telegram_skipped_cooldown', name: c.name, score: c.opportunity_score });
        }

      } else if (c.opportunity_score >= SCORE_WATCHLIST) {
        if (!dryRun) {
          const existW = await env.DB.prepare(
            `SELECT id FROM candidate_watchlist WHERE name_hash = ? LIMIT 1`
          ).bind(hash).first();

          if (!existW) {
            await env.DB.prepare(`
              INSERT INTO candidate_watchlist
                (id, source, source_id, source_url, name, description, image_url,
                 signals_json, opportunity_score, score_breakdown_json,
                 name_hash, first_seen_at, last_seen_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
            `).bind(
              crypto.randomUUID(),
              c.source, c.source_id || null, c.source_url || null,
              c.name, c.description || null, c.image_url || null,
              JSON.stringify(c.signals || {}),
              c.opportunity_score,
              JSON.stringify(c.score_breakdown),
              hash,
            ).run();
            watchlistNew++;
          } else {
            await env.DB.prepare(
              `UPDATE candidate_watchlist SET last_seen_at = datetime('now'), opportunity_score = ?, updated_at = datetime('now') WHERE id = ?`
            ).bind(c.opportunity_score, existW.id).run();
          }
        } else {
          dryLog.push({ action: 'watchlist', name: c.name, score: c.opportunity_score });
        }
      }
    }

    // ── Registrar run ────────────────────────────────────────────────────────
    if (!dryRun) {
      await env.DB.prepare(`
        INSERT INTO radar_run_log (run_at, source, candidates_new, candidates_upd, watchlist_new, alerts_sent, dry_run)
        VALUES (datetime('now'), ?, ?, ?, ?, ?, 0)
      `).bind(source, candidatesNew, candidatesUpd, watchlistNew, alertsSent).run().catch(() => {});
    }

    const topPreview = scored.slice(0, 10).map(c => ({
      name:       c.name,
      source:     c.source,
      score:      c.opportunity_score,
      action:     c.action_recommended,
      breakdown:  c.score_breakdown,
      category:   c.category,
      signals_summary: summarizeSignals(c.signals),
    }));

    if (dryRun) {
      return json({
        ok:                   true,
        dry_run:              true,
        scan_log:             scanLog,
        total_raw:            rawCandidates.length,
        total_deduped:        deduped.length,
        would_be_candidates:  scored.filter(c => c.opportunity_score >= SCORE_CANDIDATE).length,
        would_be_watchlist:   scored.filter(c => c.opportunity_score >= SCORE_WATCHLIST && c.opportunity_score < SCORE_CANDIDATE).length,
        top_candidates:       topPreview,
        dry_log:              dryLog,
      });
    }

    return json({
      ok:             true,
      scan_log:       scanLog,
      total_raw:      rawCandidates.length,
      total_deduped:  deduped.length,
      candidates_new: candidatesNew,
      candidates_upd: candidatesUpd,
      watchlist_new:  watchlistNew,
      alerts_sent:    alertsSent,
      top_candidates: topPreview,
    });

  } catch (err) {
    console.error('RADAR_SCAN_ERROR', err.message, err.stack);
    return json({ ok: false, error: err.message }, 500);
  }
}

// ── Deduplicación ─────────────────────────────────────────────────────────

function deduplicateByName(candidates) {
  const map = new Map();

  for (const c of candidates) {
    const norm = normalizeProductName(c.name);
    const key  = norm.slice(0, 24);

    if (map.has(key)) {
      // Merge: marcar como double_signal y fusionar señales
      const existing = map.get(key);
      map.set(key, {
        ...existing,
        source:   'double_signal',
        signals:  { ...existing.signals, ...c.signals },
        image_url: existing.image_url || c.image_url,
      });
    } else {
      map.set(key, { ...c });
    }
  }

  return Array.from(map.values());
}

// ── D1 helpers ─────────────────────────────────────────────────────────────

async function findExistingCandidate(DB, hash, sourceId) {
  return DB.prepare(
    `SELECT id, alert_sent_at, alert_count FROM product_candidates
     WHERE name_hash = ? OR (source_id = ? AND source_id IS NOT NULL)
     LIMIT 1`
  ).bind(hash, sourceId || '___none___').first().catch(() => null);
}

async function getIdByHash(DB, hash) {
  const row = await DB.prepare(`SELECT id FROM product_candidates WHERE name_hash = ? LIMIT 1`).bind(hash).first().catch(() => null);
  return row?.id || null;
}

async function countAlertsToday(DB, since24h) {
  try {
    const row = await DB.prepare(
      `SELECT COALESCE(SUM(alerts_sent), 0) AS total FROM radar_run_log WHERE run_at >= ? AND dry_run = 0`
    ).bind(since24h).first();
    return Number(row?.total || 0);
  } catch (_) { return 0; }
}

async function initTables(DB) {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS product_candidates (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, source_id TEXT, source_url TEXT,
      name TEXT NOT NULL, description TEXT, category TEXT, image_url TEXT,
      signals_json TEXT, signal_strength INTEGER DEFAULT 0,
      opportunity_score INTEGER DEFAULT 0, score_breakdown_json TEXT,
      status TEXT DEFAULT 'new', status_note TEXT,
      estimated_sale_gs INTEGER, supplier_url TEXT, supplier_price_usd REAL,
      name_hash TEXT, first_seen_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT DEFAULT (datetime('now')), alert_sent_at TEXT,
      alert_count INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_radar_candidates_score  ON product_candidates(opportunity_score DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_radar_candidates_status ON product_candidates(status)`,
    `CREATE INDEX IF NOT EXISTS idx_radar_candidates_hash   ON product_candidates(name_hash)`,
    `CREATE TABLE IF NOT EXISTS candidate_watchlist (
      id TEXT PRIMARY KEY, source TEXT NOT NULL, source_id TEXT, source_url TEXT,
      name TEXT NOT NULL, description TEXT, image_url TEXT,
      signals_json TEXT, opportunity_score INTEGER DEFAULT 0, score_breakdown_json TEXT,
      name_hash TEXT, first_seen_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT DEFAULT (datetime('now')), promoted_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_watchlist_hash ON candidate_watchlist(name_hash)`,
    `CREATE TABLE IF NOT EXISTS radar_run_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, run_at TEXT NOT NULL,
      source TEXT DEFAULT 'manual', candidates_new INTEGER DEFAULT 0,
      candidates_upd INTEGER DEFAULT 0, watchlist_new INTEGER DEFAULT 0,
      alerts_sent INTEGER DEFAULT 0, dry_run INTEGER DEFAULT 0
    )`,
  ];
  for (const sql of stmts) {
    await DB.prepare(sql).run().catch(e => console.warn('RADAR_INIT_WARN', e.message));
  }
}

// ── Telegram ──────────────────────────────────────────────────────────────

function buildTelegramMessage(c) {
  const bd  = c.score_breakdown || {};
  const sig = c.signals || {};

  const sourceLabel =
    c.source === 'double_signal'      ? 'Doble señal (múltiples fuentes)' :
    c.source === 'meta_ads_library'   ? 'Meta Ads Library · Paraguay' :
    c.source === 'mercadolibre_py'    ? 'Mercado Libre · Paraguay' :
                                        'AliExpress · Global';

  const lines = [
    '🚨 NUEVO CANDIDATO — DAM Product Radar',
    '',
    `Producto: ${c.name}`,
    '',
    `Fuente: ${sourceLabel}`,
    '',
    `Score: ${c.opportunity_score}/100`,
    '',
    'Motivos:',
  ];

  if (bd.demand        != null) lines.push(`• Demanda: ${bd.demand}/35`);
  if (bd.fit_py        != null) lines.push(`• Fit Paraguay: ${bd.fit_py}/25`);
  if (bd.competition_py != null) lines.push(`• Competencia PY: ${bd.competition_py}/20`);
  if (bd.logistics     != null) lines.push(`• Logistica: ${bd.logistics}/10`);
  if (bd.margin        != null) lines.push(`• Margen estimado: ${bd.margin}/10`);

  lines.push('');

  if (sig.num_advertisers) lines.push(`• ${sig.num_advertisers} anunciantes activos en PY`);
  if (sig.num_ads)         lines.push(`• ${sig.num_ads} anuncios en circulacion`);
  if (sig.orders_30d)      lines.push(`• ${Number(sig.orders_30d).toLocaleString('es-PY')} ordenes globales`);
  if (sig.price_usd)       lines.push(`• Precio proveedor aprox: USD ${sig.price_usd}`);
  if (sig.price_gs)        lines.push(`• Precio venta estimado: Gs. ${Number(sig.price_gs).toLocaleString('es-PY')}`);
  if (c.source_url)        lines.push(`• ${c.source_url}`);

  lines.push('');
  lines.push(`Accion: ${c.action_recommended}`);

  return lines.join('\n');
}

async function sendTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_INTELLIGENCE_CHAT_ID) return false;
  const chatId = env.TELEGRAM_INTELLIGENCE_CHAT_ID.replace(/^﻿/, '').trim();
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      }
    );
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('RADAR_TG_FAIL', res.status, err.slice(0, 200));
    }
    return res.ok;
  } catch (err) {
    console.error('RADAR_TG_ERROR', err.message);
    return false;
  }
}

// ── Misc helpers ──────────────────────────────────────────────────────────

function isInCooldown(sentAt, hours) {
  if (!sentAt) return false;
  return (Date.now() - new Date(sentAt).getTime()) < hours * 3600000;
}

function summarizeSignals(sig = {}) {
  const out = {};
  if (sig.num_advertisers) out.anunciantes_py = sig.num_advertisers;
  if (sig.num_ads)         out.anuncios_py    = sig.num_ads;
  if (sig.orders_30d)      out.ordenes_ae     = sig.orders_30d;
  if (sig.price_usd)       out.precio_usd     = sig.price_usd;
  if (sig.spend_upper)     out.spend_usd_max  = sig.spend_upper;
  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
