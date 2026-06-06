/* =========================================================
   POST /api/intelligence/run-bqe
   Motor de Calidad de Compradores — Buyer Quality Engine

   Procesa leads y escribe/actualiza lead_quality.
   NO modifica la tabla leads.
   NO envía eventos a Meta.
   Auth: Bearer ADMIN_PASSWORD

   Body (opcional):
     { lead_ids: [1,2,3] }   → procesa solo esos leads
     {}                      → procesa todos los leads sin procesar o actualizables
   ========================================================= */

import { scoreLeadBQE, scoreToLabel, slugify, normalizePhone, STALE_DAYS, SCORE_VERSION } from './_bqe-scorer.js';

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

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const lead_ids = Array.isArray(body.lead_ids) ? body.lead_ids : null;

  try {
    // Obtener leads a procesar
    let leads;
    if (lead_ids && lead_ids.length > 0) {
      const placeholders = lead_ids.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT * FROM leads WHERE id IN (${placeholders})`
      ).bind(...lead_ids).all();
      leads = results || [];
    } else {
      // Procesar todos los leads: sin entrada en lead_quality o con score_version distinta
      const { results } = await env.DB.prepare(`
        SELECT l.* FROM leads l
        LEFT JOIN lead_quality lq ON lq.lead_id = l.id
        WHERE lq.id IS NULL
           OR lq.score_version != ?
           OR (l.status = 'purchased' AND lq.status_snapshot != 'purchased')
           OR (l.status = 'cancelled' AND lq.status_snapshot != 'cancelled')
        ORDER BY l.id DESC
        LIMIT 500
      `).bind(SCORE_VERSION).all();
      leads = results || [];
    }

    if (leads.length === 0) {
      return json({ ok: true, processed: 0, message: 'No hay leads pendientes de procesar.' });
    }

    // Batch: conteo de compras previas por teléfono (para detectar reincidentes)
    const purchaseCountMap = new Map();
    try {
      const { results: phoneCounts } = await env.DB.prepare(
        `SELECT phone, COUNT(*) AS cnt FROM leads WHERE status = 'purchased' AND phone IS NOT NULL GROUP BY phone`
      ).all();
      (phoneCounts || []).forEach(r => {
        if (r.phone) purchaseCountMap.set(normalizePhone(r.phone), Number(r.cnt));
      });
    } catch (e) {
      console.warn('BQE_PHONE_COUNT_WARN', e.message);
    }

    // Obtener session_ids para cruzar con behavior_events
    const sessionIds = leads.map(l => l.session_id).filter(Boolean);
    let behaviorMap = new Map();

    if (sessionIds.length > 0) {
      const placeholders = sessionIds.map(() => '?').join(',');
      try {
        const { results: bRows } = await env.DB.prepare(`
          SELECT
            session_id,
            MAX(CASE WHEN event_type = 'scroll_90' THEN 90
                     WHEN event_type = 'scroll_75' THEN 75
                     WHEN event_type = 'scroll_50' THEN 50
                     WHEN event_type = 'scroll_25' THEN 25
                     ELSE 0 END)                          AS scroll_depth,
            COUNT(CASE WHEN event_type = 'cta_click' THEN 1 END) AS cta_clicks,
            COUNT(DISTINCT section)                       AS section_count
          FROM behavior_events
          WHERE session_id IN (${placeholders})
          GROUP BY session_id
        `).bind(...sessionIds).all();
        (bRows || []).forEach(r => behaviorMap.set(r.session_id, r));
      } catch (e) {
        console.warn('BQE_BEHAVIOR_QUERY_WARN', e.message);
      }
    }

    // Procesar cada lead
    const now = Date.now();
    const stmts = [];
    let processed = 0;

    for (const lead of leads) {
      try {
        const normPhone    = normalizePhone(lead.phone || '');
        const totalForPhone = normPhone ? (purchaseCountMap.get(normPhone) || 0) : 0;
        const prevPurchases = lead.status === 'purchased'
          ? Math.max(0, totalForPhone - 1)
          : 0;

        const scored = scoreLeadBQE(lead, behaviorMap, now, prevPurchases);
        const beh    = behaviorMap.get(lead.session_id) || null;

        stmts.push(env.DB.prepare(`
          INSERT INTO lead_quality (
            lead_id, session_id, phone, product_slug, product_name, city,
            campaign_id, adset_id, ad_id, campaign_name, adset_name, ad_name,
            attribution_confidence, status_snapshot,
            quality_score, quality_label, buyer_type,
            time_to_purchase_h, lead_age_h, total_value,
            is_combo, is_vip, is_fast_buyer, is_high_value,
            is_dead_lead, is_cancelled, is_blocked,
            had_insync_session, scroll_depth, cta_clicks, section_count,
            reason, score_version, processed_at, updated_at
          ) VALUES (
            ?,?,?,?,?,?,
            ?,?,?,?,?,?,
            ?,?,
            ?,?,?,
            ?,?,?,
            ?,?,?,?,
            ?,?,?,
            ?,?,?,?,
            ?,?,datetime('now'),datetime('now')
          )
          ON CONFLICT(lead_id) DO UPDATE SET
            status_snapshot      = excluded.status_snapshot,
            quality_score        = excluded.quality_score,
            quality_label        = excluded.quality_label,
            buyer_type           = excluded.buyer_type,
            time_to_purchase_h   = excluded.time_to_purchase_h,
            lead_age_h           = excluded.lead_age_h,
            total_value          = excluded.total_value,
            is_combo             = excluded.is_combo,
            is_vip               = excluded.is_vip,
            is_fast_buyer        = excluded.is_fast_buyer,
            is_high_value        = excluded.is_high_value,
            is_dead_lead         = excluded.is_dead_lead,
            is_cancelled         = excluded.is_cancelled,
            is_blocked           = excluded.is_blocked,
            had_insync_session   = excluded.had_insync_session,
            scroll_depth         = excluded.scroll_depth,
            cta_clicks           = excluded.cta_clicks,
            section_count        = excluded.section_count,
            reason               = excluded.reason,
            score_version        = excluded.score_version,
            processed_at         = datetime('now'),
            updated_at           = datetime('now')
        `).bind(
          lead.id,
          lead.session_id || null,
          lead.phone || null,
          scored.product_slug,
          lead.product_name || null,
          lead.location_city || lead.city || null,
          lead.campaign_id || null,
          lead.adset_id || null,
          lead.ad_id || null,
          lead.campaign_name || null,
          lead.adset_name || null,
          lead.ad_name || null,
          lead.attribution_confidence || null,
          scored.status_snapshot,
          scored.quality_score,
          scored.quality_label,
          scored.buyer_type,
          scored.time_to_purchase_h,
          scored.lead_age_h,
          lead.value || 0,
          scored.is_combo ? 1 : 0,
          scored.is_vip ? 1 : 0,
          scored.is_fast_buyer ? 1 : 0,
          scored.is_high_value ? 1 : 0,
          scored.is_dead_lead ? 1 : 0,
          lead.status === 'cancelled' ? 1 : 0,
          lead.status === 'blocked' ? 1 : 0,
          beh ? 1 : 0,
          beh?.scroll_depth || null,
          beh?.cta_clicks || 0,
          beh?.section_count || 0,
          scored.reason,
          SCORE_VERSION
        ));
        processed++;
      } catch (e) {
        console.error('BQE_SCORE_ERROR lead_id=' + lead.id, e.message);
      }
    }

    // Ejecutar en batches de 100
    for (let i = 0; i < stmts.length; i += 100) {
      await env.DB.batch(stmts.slice(i, i + 100));
    }

    return json({ ok: true, processed, total_leads: leads.length });

  } catch (err) {
    console.error('RUN_BQE_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
