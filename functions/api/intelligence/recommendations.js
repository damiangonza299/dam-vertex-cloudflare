/* =========================================================
   GET /api/intelligence/recommendations
   Generador de Recomendaciones — Dam Intelligence

   Lee D1 + lead_quality. NO ejecuta acciones.
   Genera recomendaciones con evidencia, riesgo y acción sugerida.

   Params: ?since=YYYY-MM-DD&until=YYYY-MM-DD
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
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url   = new URL(request.url);
  const today = new Date().toISOString().split('T')[0];
  const ago14 = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  const since = url.searchParams.get('since') || ago14;
  const until = url.searchParams.get('until') || today;

  try {
    const [adStatsR, campaignStatsR, cityStatsR, globalR, staleR] = await env.DB.batch([

      // Stats por ad_id (cruzando leads + lead_quality)
      env.DB.prepare(`
        SELECT
          l.ad_id,
          MAX(l.ad_name)                                                            AS ad_name,
          MAX(l.campaign_name)                                                      AS campaign_name,
          COUNT(DISTINCT l.id)                                                      AS total_leads,
          SUM(CASE WHEN l.status='purchased' THEN 1 ELSE 0 END)                    AS purchased,
          SUM(CASE WHEN l.status='cancelled' THEN 1 ELSE 0 END)                    AS cancelled,
          SUM(CASE WHEN l.status='purchased' THEN COALESCE(l.value,0) ELSE 0 END)  AS revenue,
          COUNT(DISTINCT CASE WHEN lq.is_dead_lead=1 THEN l.id END)               AS dead_leads,
          AVG(CASE WHEN l.status='purchased' THEN lq.quality_score END)            AS avg_buyer_score,
          AVG(CASE WHEN l.status='purchased' THEN lq.time_to_purchase_h END)       AS avg_time_h
        FROM leads l
        LEFT JOIN lead_quality lq ON lq.lead_id = l.id
        WHERE l.created_at >= ? AND l.created_at < date(?, '+1 day')
          AND l.ad_id IS NOT NULL
        GROUP BY l.ad_id
        HAVING total_leads >= 2
        ORDER BY total_leads DESC
        LIMIT 50
      `).bind(since, until),

      // Stats por campaña
      env.DB.prepare(`
        SELECT
          l.campaign_id,
          MAX(l.campaign_name)                                                      AS campaign_name,
          COUNT(DISTINCT l.id)                                                      AS total_leads,
          SUM(CASE WHEN l.status='purchased' THEN 1 ELSE 0 END)                    AS purchased,
          SUM(CASE WHEN l.status='cancelled' THEN 1 ELSE 0 END)                    AS cancelled,
          SUM(CASE WHEN l.status='purchased' THEN COALESCE(l.value,0) ELSE 0 END)  AS revenue,
          COUNT(DISTINCT CASE WHEN lq.is_dead_lead=1 THEN l.id END)               AS dead_leads,
          AVG(CASE WHEN l.status='purchased' THEN lq.time_to_purchase_h END)       AS avg_time_h
        FROM leads l
        LEFT JOIN lead_quality lq ON lq.lead_id = l.id
        WHERE l.created_at >= ? AND l.created_at < date(?, '+1 day')
          AND l.campaign_id IS NOT NULL
        GROUP BY l.campaign_id
        HAVING total_leads >= 3
        ORDER BY total_leads DESC
        LIMIT 20
      `).bind(since, until),

      // Stats por ciudad
      env.DB.prepare(`
        SELECT
          COALESCE(l.location_city, l.city, 'Desconocida')                         AS city,
          COUNT(DISTINCT l.id)                                                      AS total_leads,
          SUM(CASE WHEN l.status='purchased' THEN 1 ELSE 0 END)                    AS purchased,
          SUM(CASE WHEN l.status='cancelled' THEN 1 ELSE 0 END)                    AS cancelled,
          SUM(CASE WHEN l.status='purchased' THEN COALESCE(l.value,0) ELSE 0 END)  AS revenue
        FROM leads l
        WHERE l.created_at >= ? AND l.created_at < date(?, '+1 day')
        GROUP BY city
        HAVING total_leads >= 2
        ORDER BY purchased DESC
        LIMIT 20
      `).bind(since, until),

      // Resumen global
      env.DB.prepare(`
        SELECT
          COUNT(*)                                                                  AS total_leads,
          SUM(CASE WHEN status='purchased' THEN 1 ELSE 0 END)                      AS total_purchased,
          SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END)                      AS total_cancelled,
          SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END)                      AS total_pending,
          SUM(CASE WHEN status='purchased' THEN COALESCE(value,0) ELSE 0 END)      AS total_revenue
        FROM leads
        WHERE created_at >= ? AND created_at < date(?, '+1 day')
      `).bind(since, until),

      // Leads vencidos sin procesar (para alerta)
      env.DB.prepare(`
        SELECT COUNT(*) AS stale_count
        FROM leads
        WHERE status = 'pending'
          AND created_at < datetime('now', '-5 days')
      `),
    ]);

    const adStats       = adStatsR.results || [];
    const campaignStats = campaignStatsR.results || [];
    const cityStats     = cityStatsR.results || [];
    const global        = globalR.results?.[0] || {};
    const staleCount    = staleR.results?.[0]?.stale_count || 0;

    const recommendations = [];

    // Alerta: leads vencidos sin procesar
    if (staleCount > 0) {
      recommendations.push({
        tipo:             'alerta',
        titulo:           `${staleCount} leads vencidos sin clasificar`,
        explicacion:      'Hay leads con más de 5 días sin compra que aún no fueron evaluados por el Motor de Calidad.',
        evidencia:        `${staleCount} leads pending con más de 5 días.`,
        datos:            { stale_count: staleCount },
        riesgo:           'Bajo. Solo afecta el análisis interno, no la operación.',
        accion_sugerida:  'Ejecutar POST /api/intelligence/stale-scanner para clasificarlos.',
        requiere_aprobacion: false,
      });
    }

    // Recomendaciones por anuncio
    for (const ad of adStats) {
      const purchaseRate  = ad.total_leads > 0 ? ad.purchased / ad.total_leads : 0;
      const deadRate      = ad.total_leads > 0 ? ad.dead_leads / ad.total_leads : 0;
      const cancelRate    = ad.total_leads > 0 ? ad.cancelled / ad.total_leads : 0;
      const avgScore      = Math.round(ad.avg_buyer_score || 0);
      const name          = ad.ad_name || ad.ad_id;
      const revFmt        = (ad.revenue || 0).toLocaleString('es-PY');

      // Creativo ganador — mínimo: 10 leads, 3 compras, dead_rate < 40%
      if (purchaseRate >= 0.25 && avgScore >= 65 && ad.revenue > 0 && deadRate < 0.4 && ad.total_leads >= 10 && ad.purchased >= 3) {
        recommendations.push({
          tipo:             'oportunidad',
          titulo:           `Anuncio con compradores reales: ${name}`,
          explicacion:      'Este anuncio tiene alta tasa de compra y compradores de buena calidad.',
          evidencia:        `${ad.purchased}/${ad.total_leads} compras (${(purchaseRate*100).toFixed(0)}%), score promedio ${avgScore}, revenue Gs. ${revFmt}.`,
          datos:            { ad_id: ad.ad_id, purchase_rate: (purchaseRate*100).toFixed(1), avg_score: avgScore, revenue: ad.revenue },
          riesgo:           'Escalar sin validar ventana operativa puede sacar la campaña del aprendizaje.',
          accion_sugerida:  'Candidato para subir presupuesto 15-20% si tiene 48h+ estable. Validar antes de actuar.',
          requiere_aprobacion: true,
        });
      }

      // Creativo basura — mínimo: 10 leads para evitar conclusiones prematuras
      if (deadRate >= 0.6 && ad.purchased === 0 && ad.total_leads >= 10) {
        recommendations.push({
          tipo:             'problema',
          titulo:           `Anuncio con tráfico basura: ${name}`,
          explicacion:      'Este anuncio genera leads que no compran y vencen sin respuesta.',
          evidencia:        `${ad.dead_leads}/${ad.total_leads} leads vencidos (${(deadRate*100).toFixed(0)}%), 0 compras.`,
          datos:            { ad_id: ad.ad_id, dead_lead_rate: (deadRate*100).toFixed(1), dead_leads: ad.dead_leads, purchased: ad.purchased },
          riesgo:           'Pausar un anuncio activo puede reiniciar el aprendizaje de la campaña. Esperar 72h de datos mínimos.',
          accion_sugerida:  'Evaluar pausar si el patrón se mantiene mañana. NO pausar campañas automáticamente.',
          requiere_aprobacion: true,
        });
      }

      // Leads de baja calidad — mínimo: 10 leads
      if (deadRate >= 0.5 && purchaseRate < 0.1 && ad.total_leads >= 10) {
        recommendations.push({
          tipo:             'atencion',
          titulo:           `Anuncio con leads de baja calidad: ${name}`,
          explicacion:      'Muchos leads entran pero no convierten en compras reales.',
          evidencia:        `${ad.total_leads} leads, ${ad.purchased} compras (${(purchaseRate*100).toFixed(0)}%), ${ad.dead_leads} vencidos.`,
          datos:            { ad_id: ad.ad_id, total_leads: ad.total_leads, purchased: ad.purchased, dead_leads: ad.dead_leads },
          riesgo:           'Puede ser problema de promesa del anuncio vs landing vs producto real.',
          accion_sugerida:  'Revisar coherencia anuncio → landing → precio → producto. No pausar sin diagnóstico.',
          requiere_aprobacion: false,
        });
      }

      // Compradores lentos — mínimo: 10 leads, 3 compras
      if (purchaseRate >= 0.1 && ad.avg_time_h && ad.avg_time_h > 72 && ad.total_leads >= 10 && ad.purchased >= 3) {
        recommendations.push({
          tipo:             'info',
          titulo:           `Compradores lentos en: ${name}`,
          explicacion:      'Este anuncio convierte pero los compradores tardan más de 3 días.',
          evidencia:        `${ad.purchased} compras, tiempo promedio ${Math.round(ad.avg_time_h)}h (${(ad.avg_time_h/24).toFixed(1)} días).`,
          datos:            { ad_id: ad.ad_id, avg_time_h: Math.round(ad.avg_time_h), purchased: ad.purchased },
          riesgo:           'Bajo. El patrón puede ser normal para interior o para productos de mayor valor.',
          accion_sugerida:  'Observar. Puede funcionar bien con seguimiento por WhatsApp activo.',
          requiere_aprobacion: false,
        });
      }
    }

    // Recomendaciones por campaña
    for (const c of campaignStats) {
      const purchaseRate = c.total_leads > 0 ? c.purchased / c.total_leads : 0;
      const deadRate     = c.total_leads > 0 ? c.dead_leads / c.total_leads : 0;
      const name         = c.campaign_name || c.campaign_id;

      if (purchaseRate >= 0.2 && c.purchased >= 3 && c.total_leads >= 10) {
        recommendations.push({
          tipo:             'oportunidad',
          titulo:           `Campaña con ventas reales: ${name}`,
          explicacion:      'Esta campaña tiene tasa de conversión real destacada.',
          evidencia:        `${c.purchased}/${c.total_leads} compras (${(purchaseRate*100).toFixed(0)}%), revenue Gs. ${(c.revenue||0).toLocaleString('es-PY')}.`,
          datos:            { campaign_id: c.campaign_id, purchase_rate: (purchaseRate*100).toFixed(1), purchased: c.purchased },
          riesgo:           'Escalar requiere validación de ventana operativa y Meta Learning Phase.',
          accion_sugerida:  'Mantener. Evaluar escalar si llevan 48h+ estables.',
          requiere_aprobacion: true,
        });
      }
    }

    // Recomendaciones por ciudad
    for (const city of cityStats) {
      const purchaseRate = city.total_leads > 0 ? city.purchased / city.total_leads : 0;
      const cancelRate   = city.total_leads > 0 ? city.cancelled / city.total_leads : 0;

      if (purchaseRate >= 0.35 && city.total_leads >= 10 && city.purchased >= 3) {
        recommendations.push({
          tipo:             'info',
          titulo:           `Ciudad con alta conversión: ${city.city}`,
          explicacion:      'Esta ciudad tiene una tasa de compra real muy alta.',
          evidencia:        `${city.purchased}/${city.total_leads} compras (${(purchaseRate*100).toFixed(0)}%) desde ${city.city}.`,
          datos:            { city: city.city, purchase_rate: (purchaseRate*100).toFixed(1), purchased: city.purchased },
          riesgo:           'Ninguno. Es dato informativo.',
          accion_sugerida:  'Considerar segmentación geográfica hacia esta zona si el presupuesto lo permite.',
          requiere_aprobacion: false,
        });
      }

      if (cancelRate >= 0.5 && city.total_leads >= 10) {
        recommendations.push({
          tipo:             'atencion',
          titulo:           `Ciudad con alta cancelación: ${city.city}`,
          explicacion:      'Esta ciudad genera muchos cancelados. Puede ser fricción de entrega o leads de mala calidad.',
          evidencia:        `${city.cancelled}/${city.total_leads} cancelados (${(cancelRate*100).toFixed(0)}%) desde ${city.city}.`,
          datos:            { city: city.city, cancel_rate: (cancelRate*100).toFixed(1), cancelled: city.cancelled },
          riesgo:           'Bajo. Es dato informativo. Puede ser problema de entrega en zona.',
          accion_sugerida:  'Evaluar logística de entrega en esta zona. No excluir de Meta sin más datos.',
          requiere_aprobacion: false,
        });
      }
    }

    // Ordenar: problema > atencion > oportunidad > info > alerta
    const order = { problema: 0, atencion: 1, oportunidad: 2, info: 3, alerta: 4 };
    recommendations.sort((a, b) => (order[a.tipo] ?? 5) - (order[b.tipo] ?? 5));

    return json({
      ok: true,
      period: { since, until },
      global: {
        total_leads:     global.total_leads     || 0,
        total_purchased: global.total_purchased || 0,
        total_cancelled: global.total_cancelled || 0,
        total_pending:   global.total_pending   || 0,
        total_revenue:   global.total_revenue   || 0,
        purchase_rate:   global.total_leads > 0
          ? parseFloat((global.total_purchased / global.total_leads * 100).toFixed(1))
          : 0,
      },
      recommendations,
      total: recommendations.length,
    });

  } catch (err) {
    console.error('RECOMMENDATIONS_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
