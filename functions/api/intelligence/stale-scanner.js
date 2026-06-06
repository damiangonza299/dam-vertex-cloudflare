/* =========================================================
   POST /api/intelligence/stale-scanner
   Detector de Leads Vencidos

   Busca leads con status=pending y más de 5 días sin compra.
   Los registra en lead_quality como vencidos.
   NO modifica la tabla leads.
   NO envía eventos a Meta.
   Auth: Bearer ADMIN_PASSWORD
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

import { VIP_PYG, HIGH_VALUE_PYG, STALE_DAYS, SCORE_VERSION, scoreToLabel, slugify } from './_bqe-scorer.js';

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const now = Date.now();
    const staleThresholdSec = STALE_DAYS * 24 * 3600;
    const staleBeforeTs = new Date(now - staleThresholdSec * 1000).toISOString().slice(0, 19);

    // Buscar leads pending vencidos
    const { results: staleLeads } = await env.DB.prepare(`
      SELECT l.* FROM leads l
      WHERE l.status = 'pending'
        AND l.created_at < ?
      ORDER BY l.created_at ASC
      LIMIT 500
    `).bind(staleBeforeTs).all();

    if (!staleLeads || staleLeads.length === 0) {
      return json({ ok: true, scanned: 0, marked_stale: 0, message: 'Sin leads vencidos nuevos.' });
    }

    // Obtener session_ids para behavior_events
    const sessionIds = staleLeads.map(l => l.session_id).filter(Boolean);
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
                     ELSE 0 END) AS scroll_depth,
            COUNT(CASE WHEN event_type = 'cta_click' THEN 1 END) AS cta_clicks,
            COUNT(DISTINCT section) AS section_count
          FROM behavior_events
          WHERE session_id IN (${placeholders})
          GROUP BY session_id
        `).bind(...sessionIds).all();
        (bRows || []).forEach(r => behaviorMap.set(r.session_id, r));
      } catch (e) {
        console.warn('STALE_SCAN_BEHAVIOR_WARN', e.message);
      }
    }

    const stmts = [];
    let marked = 0;

    for (const lead of staleLeads) {
      const createdMs  = lead.created_at ? new Date(lead.created_at).getTime() : now;
      const leadAgeH   = Math.round((now - createdMs) / 3600000 * 10) / 10;
      const leadAgeDays = Math.floor(leadAgeH / 24);
      const beh        = behaviorMap.get(lead.session_id) || null;
      const city       = (lead.location_city || lead.city || '').toLowerCase();
      const productSlug = lead.product_slug || slugify(lead.product_name || '');
      const attrConf   = lead.attribution_confidence || 'none';
      const value      = Number(lead.value || 0);

      const granAsuncion = ['asunción','asuncion','luque','lambaré','lambare',
        'san lorenzo','fernando de la mora','capiatá','capiata',
        'mariano roque alonso','ñemby','nemby','villa elisa','limpio'].some(c => city.includes(c));

      let score = -40;
      const reasons = [`lead vencido ${leadAgeDays}d -40`];

      if (!granAsuncion) { score -= 10; reasons.push('interior sin cierre -10'); }
      if (attrConf === 'none') { score -= 5; reasons.push('sin atribución -5'); }
      if (beh) { score += 3; reasons.push('tenía sesión InSync +3'); }

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
          status_snapshot    = 'stale',
          quality_score      = excluded.quality_score,
          quality_label      = excluded.quality_label,
          buyer_type         = 'vencido',
          lead_age_h         = excluded.lead_age_h,
          is_dead_lead       = 1,
          had_insync_session = excluded.had_insync_session,
          scroll_depth       = excluded.scroll_depth,
          cta_clicks         = excluded.cta_clicks,
          section_count      = excluded.section_count,
          reason             = excluded.reason,
          score_version      = excluded.score_version,
          processed_at       = datetime('now'),
          updated_at         = datetime('now')
      `).bind(
        lead.id,
        lead.session_id || null,
        lead.phone || null,
        productSlug,
        lead.product_name || null,
        lead.location_city || lead.city || null,
        lead.campaign_id || null,
        lead.adset_id || null,
        lead.ad_id || null,
        lead.campaign_name || null,
        lead.adset_name || null,
        lead.ad_name || null,
        attrConf,
        'stale',
        Math.max(-100, score),
        scoreToLabel(score),
        'vencido',
        null,
        leadAgeH,
        value,
        productSlug === 'combo-reloj-cadena' ? 1 : 0,
        value >= VIP_PYG        ? 1 : 0,
        0,
        value >= HIGH_VALUE_PYG ? 1 : 0,
        1,
        0,
        0,
        beh ? 1 : 0,
        beh?.scroll_depth || null,
        beh?.cta_clicks || 0,
        beh?.section_count || 0,
        reasons.join(' | '),
        SCORE_VERSION
      ));
      marked++;
    }

    for (let i = 0; i < stmts.length; i += 100) {
      await env.DB.batch(stmts.slice(i, i + 100));
    }

    return json({ ok: true, scanned: staleLeads.length, marked_stale: marked });

  } catch (err) {
    console.error('STALE_SCANNER_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
