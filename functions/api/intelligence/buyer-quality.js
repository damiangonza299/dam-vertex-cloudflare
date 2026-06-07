/* =========================================================
   GET /api/intelligence/buyer-quality
   Consulta de calidad de compradores desde lead_quality

   Params:
     ?since=YYYY-MM-DD
     ?until=YYYY-MM-DD
     ?product=reloj|cadena|...
     ?label=excelente|muy_bueno|bueno|normal|baja|muy_baja|basura
     ?buyer_type=rapido|vip|combo|alto_valor|normal|tardio|vencido|cancelado|bloqueado
     ?limit=100 (default)
   Auth: Bearer ADMIN_PASSWORD
   ========================================================= */

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
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url     = new URL(request.url);
  const today   = new Date().toISOString().split('T')[0];
  const ago30   = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const since   = url.searchParams.get('since')      || ago30;
  const until   = url.searchParams.get('until')      || today;
  const product = url.searchParams.get('product')    || null;
  const label   = url.searchParams.get('label')      || null;
  const btype   = url.searchParams.get('buyer_type') || null;
  const limit   = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  try {
    // Resumen agregado
    const [summaryR, topBuyersR, staleR, cancelledR] = await env.DB.batch([

      // Resumen por status y buyer_type
      env.DB.prepare(`
        SELECT
          status_snapshot,
          quality_label,
          buyer_type,
          COUNT(*)                                                          AS total,
          AVG(quality_score)                                                AS avg_score,
          SUM(total_value)                                                  AS total_revenue,
          SUM(CASE WHEN is_fast_buyer = 1 THEN 1 ELSE 0 END)              AS fast_buyers,
          SUM(CASE WHEN is_vip = 1 THEN 1 ELSE 0 END)                     AS vip_buyers,
          SUM(CASE WHEN is_high_value = 1 THEN 1 ELSE 0 END)              AS high_value_buyers,
          SUM(CASE WHEN is_combo = 1 THEN 1 ELSE 0 END)                   AS combo_buyers,
          AVG(CASE WHEN time_to_purchase_h IS NOT NULL THEN time_to_purchase_h END) AS avg_time_h
        FROM lead_quality
        WHERE processed_at >= ? AND processed_at < date(?, '+1 day')
          ${product ? "AND product_slug = '" + product.replace(/'/g,"''") + "'" : ''}
        GROUP BY status_snapshot, quality_label, buyer_type
        ORDER BY total DESC
      `).bind(since, until),

      // Top compradores
      env.DB.prepare(`
        SELECT lq.*, l.name, l.created_at AS lead_created
        FROM lead_quality lq
        JOIN leads l ON l.id = lq.lead_id
        WHERE lq.status_snapshot = 'purchased'
          AND lq.processed_at >= ? AND lq.processed_at < date(?, '+1 day')
          ${product ? "AND lq.product_slug = '" + product.replace(/'/g,"''") + "'" : ''}
          ${label   ? "AND lq.quality_label = '" + label.replace(/'/g,"''") + "'" : ''}
          ${btype   ? "AND lq.buyer_type = '" + btype.replace(/'/g,"''") + "'" : ''}
        ORDER BY lq.quality_score DESC, lq.total_value DESC
        LIMIT ?
      `).bind(since, until, limit),

      // Leads vencidos
      env.DB.prepare(`
        SELECT COUNT(*) AS total, AVG(lead_age_h) AS avg_age_h, SUM(total_value) AS lost_revenue
        FROM lead_quality
        WHERE is_dead_lead = 1
          AND processed_at >= ? AND processed_at < date(?, '+1 day')
          ${product ? "AND product_slug = '" + product.replace(/'/g,"''") + "'" : ''}
      `).bind(since, until),

      // Cancelados
      env.DB.prepare(`
        SELECT COUNT(*) AS total, SUM(total_value) AS lost_revenue
        FROM lead_quality
        WHERE is_cancelled = 1
          AND processed_at >= ? AND processed_at < date(?, '+1 day')
          ${product ? "AND product_slug = '" + product.replace(/'/g,"''") + "'" : ''}
      `).bind(since, until),
    ]);

    const summary    = summaryR.results || [];
    const topBuyers  = topBuyersR.results || [];
    const stale      = staleR.results?.[0] || {};
    const cancelled  = cancelledR.results?.[0] || {};

    // Calcular métricas agregadas del resumen
    let total_leads = 0, total_purchased = 0, total_revenue = 0, total_stale = 0, total_cancelled = 0;
    let score_sum = 0, score_count = 0;

    for (const row of summary) {
      total_leads += row.total;
      total_revenue += row.total_revenue || 0;
      if (row.status_snapshot === 'purchased') total_purchased += row.total;
      if (row.status_snapshot === 'stale' || row.is_dead_lead) total_stale += row.total;
      if (row.status_snapshot === 'cancelled') total_cancelled += row.total;
      if (row.avg_score) { score_sum += row.avg_score * row.total; score_count += row.total; }
    }

    const avg_buyer_score = score_count > 0 ? Math.round(score_sum / score_count) : 0;
    const purchase_rate   = total_leads > 0 ? Math.round(total_purchased / total_leads * 100) : 0;

    return json({
      ok: true,
      period: { since, until },
      summary: {
        total_leads,
        total_purchased,
        total_revenue,
        avg_buyer_score,
        purchase_rate,
        stale_leads:     stale.total || 0,
        stale_avg_age_h: stale.avg_age_h ? Math.round(stale.avg_age_h) : 0,
        cancelled_leads: cancelled.total || 0,
      },
      breakdown: summary,
      top_buyers: topBuyers,
    });

  } catch (err) {
    console.error('BUYER_QUALITY_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
