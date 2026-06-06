/* =========================================================
   BQE Scorer — módulo compartido v2
   Importado por: run-bqe.js, confirm-purchase.js, manual-whatsapp-sale.js
   NO es una ruta de Cloudflare Pages (prefijo _).

   v2 — Buyer Evolution:
     - Nuevos buyer_type: reincidente, lento, muy_tardio, baja_calidad
     - Prioridad: reincidente > vip > alto_valor > rapido > lento > muy_tardio > baja_calidad > normal
     - prevPurchases: detecta comprador reincidente (+25 score)
     - normalizePhone: exportada para comparación consistente
   ========================================================= */

export const STALE_DAYS     = 5;
export const FAST_BUYER_H   = 24;
export const HIGH_VALUE_PYG = 200000;
export const VIP_PYG        = 300000;
export const SCORE_VERSION  = 'v2';

const GRAN_ASUNCION = [
  'asunción','asuncion','luque','lambaré','lambare',
  'san lorenzo','fernando de la mora','capiatá','capiata',
  'mariano roque alonso','ñemby','nemby','villa elisa','limpio',
];

export function normalizePhone(phone) {
  return (phone || '').replace(/[\s\-\+\(\)\.]/g, '');
}

export function scoreLeadBQE(lead, behaviorMap, nowMs, prevPurchases = 0) {
  const status      = lead.status || 'pending';
  const value       = Number(lead.value || 0);
  const productSlug = lead.product_slug || slugify(lead.product_name || '');
  const isCombo     = productSlug === 'combo-reloj-cadena';
  const isHighValue = value >= HIGH_VALUE_PYG;
  const isVIP       = value >= VIP_PYG;
  const attrConf    = lead.attribution_confidence || 'none';
  const city        = (lead.location_city || lead.city || '').toLowerCase();
  const createdMs   = lead.created_at ? new Date(lead.created_at).getTime() : nowMs;
  const purchasedMs = lead.purchased_at ? new Date(lead.purchased_at).getTime() : null;

  const leadAgeH    = (nowMs - createdMs) / 3600000;
  const timeToBuyH  = purchasedMs ? (purchasedMs - createdMs) / 3600000 : null;
  const isFastBuyer = timeToBuyH !== null && timeToBuyH < FAST_BUYER_H;
  const isDeadLead  = status === 'pending' && leadAgeH > STALE_DAYS * 24;
  const beh         = behaviorMap.get(lead.session_id) || null;
  const scrollDepth = beh?.scroll_depth || 0;

  const granAsuncion = GRAN_ASUNCION.some(c => city.includes(c));

  let score = 0;
  const reasons = [];

  if (status === 'purchased') {
    score += 50;
    reasons.push('compra confirmada +50');

    if (prevPurchases > 0) {
      score += 25;
      reasons.push(`reincidente (${prevPurchases + 1}ª compra) +25`);
    }

    if (isFastBuyer) {
      score += 15;
      reasons.push('comprador rápido <24h +15');
    } else if (timeToBuyH !== null && timeToBuyH < 48) {
      score += 8;
      reasons.push('comprador <48h +8');
    }

    if (isVIP) {
      score += 15;
      reasons.push(`VIP >=${VIP_PYG / 1000}k +15`);
    } else if (isHighValue) {
      score += 10;
      reasons.push(`alto valor >=${HIGH_VALUE_PYG / 1000}k +10`);
    }

    if (isCombo) {
      score += 8;
      reasons.push('combo +8');
    }

    if (granAsuncion) {
      score += 7;
      reasons.push('Gran Asunción +7');
    }

    if (attrConf === 'high') {
      score += 5;
      reasons.push('atribución alta +5');
    }

    if (beh) {
      score += 3;
      reasons.push('sesión InSync +3');
    }

    if (scrollDepth >= 75) {
      score += 2;
      reasons.push('scroll >=75% +2');
    }

  } else if (status === 'cancelled') {
    score -= 30;
    reasons.push('cancelado -30');

  } else if (status === 'blocked') {
    score -= 70;
    reasons.push('bloqueado -70');

  } else if (isDeadLead) {
    score -= 40;
    reasons.push(`lead vencido ${Math.round(leadAgeH / 24)}d -40`);

    if (!granAsuncion) {
      score -= 10;
      reasons.push('interior sin cierre -10');
    }

    if (attrConf === 'none') {
      score -= 5;
      reasons.push('sin atribución -5');
    }

  } else {
    if (leadAgeH < 24) {
      score += 10;
      reasons.push('lead fresco +10');
    } else if (leadAgeH < 48) {
      score += 5;
      reasons.push('lead reciente +5');
    }

    if (granAsuncion) {
      score += 3;
      reasons.push('Gran Asunción +3');
    }

    if (beh) {
      score += 3;
      reasons.push('sesión InSync +3');
    }

    if (scrollDepth >= 75) {
      score += 2;
      reasons.push('scroll >=75% +2');
    }
  }

  let statusSnapshot = status;
  if (status === 'pending' && isDeadLead) statusSnapshot = 'stale';

  const finalScore  = Math.max(-100, Math.min(100, score));
  const quality_label = scoreToLabel(finalScore);

  // Buyer type — prioridad: reincidente > vip > alto_valor > rapido > lento > muy_tardio > baja_calidad > normal
  let buyer_type;

  if (status === 'blocked') {
    buyer_type = 'bloqueado';
  } else if (status === 'cancelled') {
    buyer_type = 'cancelado';
  } else if (isDeadLead) {
    buyer_type = 'vencido';
  } else if (status === 'purchased') {
    const isBajaCalidad =
      (finalScore < 50) ||
      (timeToBuyH !== null && timeToBuyH > 120 && !isVIP && !isHighValue && attrConf === 'none');

    if      (prevPurchases > 0)                                               buyer_type = 'reincidente';
    else if (isVIP)                                                           buyer_type = 'vip';
    else if (isHighValue)                                                     buyer_type = 'alto_valor';
    else if (isFastBuyer)                                                     buyer_type = 'rapido';
    else if (timeToBuyH !== null && timeToBuyH >= 48 && timeToBuyH < 120)    buyer_type = 'lento';
    else if (timeToBuyH !== null && timeToBuyH >= 120)                        buyer_type = 'muy_tardio';
    else if (isBajaCalidad)                                                   buyer_type = 'baja_calidad';
    else                                                                      buyer_type = 'normal';
  } else {
    buyer_type = leadAgeH < 24 ? 'fresco' : 'pendiente';
  }

  return {
    product_slug:       productSlug,
    status_snapshot:    statusSnapshot,
    quality_score:      finalScore,
    quality_label,
    buyer_type,
    time_to_purchase_h: timeToBuyH !== null ? Math.round(timeToBuyH * 10) / 10 : null,
    lead_age_h:         Math.round(leadAgeH * 10) / 10,
    is_combo:           isCombo,
    is_vip:             isVIP,
    is_fast_buyer:      isFastBuyer,
    is_high_value:      isHighValue,
    is_dead_lead:       isDeadLead,
    reason:             reasons.join(' | '),
  };
}

export function scoreToLabel(score) {
  if (score <= 0)  return 'basura';
  if (score <= 20) return 'muy_baja';
  if (score <= 40) return 'baja';
  if (score <= 60) return 'normal';
  if (score <= 75) return 'bueno';
  if (score <= 85) return 'muy_bueno';
  return 'excelente';
}

export function slugify(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

/* =========================================================
   autoScorePurchase — Clasificación automática post-compra
   Se llama vía waitUntil: no bloquea la respuesta al admin.
   ========================================================= */
export async function autoScorePurchase(leadId, DB) {
  try {
    const lead = await DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first();
    if (!lead || lead.status !== 'purchased') return;

    // Detectar comprador reincidente (mismo teléfono, otras compras confirmadas)
    let prevPurchases = 0;
    if (lead.phone) {
      try {
        const prev = await DB.prepare(
          'SELECT COUNT(*) AS cnt FROM leads WHERE status = ? AND phone = ? AND id != ?'
        ).bind('purchased', lead.phone, lead.id).first();
        prevPurchases = Number(prev?.cnt || 0);
      } catch (_) {}
    }

    const behaviorMap = new Map();
    if (lead.session_id) {
      try {
        const { results: bRows } = await DB.prepare(`
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
          WHERE session_id = ?
          GROUP BY session_id
        `).bind(lead.session_id).all();
        (bRows || []).forEach(r => behaviorMap.set(r.session_id, r));
      } catch (_) {}
    }

    const now    = Date.now();
    const scored = scoreLeadBQE(lead, behaviorMap, now, prevPurchases);
    const beh    = behaviorMap.get(lead.session_id) || null;

    await DB.prepare(`
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
        status_snapshot    = excluded.status_snapshot,
        quality_score      = excluded.quality_score,
        quality_label      = excluded.quality_label,
        buyer_type         = excluded.buyer_type,
        time_to_purchase_h = excluded.time_to_purchase_h,
        lead_age_h         = excluded.lead_age_h,
        total_value        = excluded.total_value,
        is_combo           = excluded.is_combo,
        is_vip             = excluded.is_vip,
        is_fast_buyer      = excluded.is_fast_buyer,
        is_high_value      = excluded.is_high_value,
        is_dead_lead       = excluded.is_dead_lead,
        is_cancelled       = excluded.is_cancelled,
        is_blocked         = excluded.is_blocked,
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
      lead.session_id             || null,
      lead.phone                  || null,
      scored.product_slug,
      lead.product_name           || null,
      lead.location_city || lead.city || null,
      lead.campaign_id            || null,
      lead.adset_id               || null,
      lead.ad_id                  || null,
      lead.campaign_name          || null,
      lead.adset_name             || null,
      lead.ad_name                || null,
      lead.attribution_confidence || null,
      scored.status_snapshot,
      scored.quality_score,
      scored.quality_label,
      scored.buyer_type,
      scored.time_to_purchase_h,
      scored.lead_age_h,
      lead.value                  || 0,
      scored.is_combo             ? 1 : 0,
      scored.is_vip               ? 1 : 0,
      scored.is_fast_buyer        ? 1 : 0,
      scored.is_high_value        ? 1 : 0,
      scored.is_dead_lead         ? 1 : 0,
      lead.status === 'cancelled' ? 1 : 0,
      lead.status === 'blocked'   ? 1 : 0,
      beh                         ? 1 : 0,
      beh?.scroll_depth           || null,
      beh?.cta_clicks             || 0,
      beh?.section_count          || 0,
      scored.reason,
      SCORE_VERSION,
    ).run();

    console.log(`BQE_AUTO buyer_type=${scored.buyer_type} score=${scored.quality_score} lead_id=${leadId}${prevPurchases > 0 ? ' [REINCIDENTE]' : ''}`);
  } catch (err) {
    console.error(`BQE_AUTO_ERROR lead_id=${leadId}`, err.message);
  }
}
