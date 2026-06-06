/* =========================================================
   GET /api/intelligence/alerts
   Sistema de Alertas Automáticas — Dam Intelligence

   Detecta en tiempo real desde D1:
     1. Creativo muerto    (dead_lead_rate alto + pocas compras)
     2. Creativo escalable (purchase_rate alto + buyer_score alto)
     3. Ciudad ganadora    (purchase_rate > 40%)
     4. Buyer type aumentó (compradores premium vs semana anterior)
     5. Riesgo basura      (stale_rate alto por creativo o ciudad)

   Muestras mínimas:
     - 10 leads, 3 días de datos
     - 3 compras cuando la alerta depende de compras

   NO toca Meta Ads. NO pausa campañas. NO modifica datos.
   Auth: Bearer ADMIN_PASSWORD
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MIN_LEADS     = 10;
const MIN_PURCHASES = 3;
const MIN_DAYS      = 3;

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const since7  = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10);
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  try {
    const [creativeLeads, creativeLQ, cityData, buyerTrend] = await Promise.all([
      fetchCreativeLeads(env.DB, since30),
      fetchCreativeLQ(env.DB, since30),
      fetchCityData(env.DB, since30),
      fetchBuyerTrend(env.DB, since7, since14),
    ]);

    const alerts = [];

    // Mapa lead_quality por ad_id
    const lqMap = new Map();
    creativeLeads.forEach(r => lqMap.set(r.ad_id, { dead_leads: 0, avg_score: 0 }));
    creativeLQ.forEach(r => { if (r.ad_id) lqMap.set(r.ad_id, r); });

    // Alertas por creativo
    for (const cr of creativeLeads) {
      if (!cr.ad_id) continue;

      const lq           = lqMap.get(cr.ad_id) || {};
      const total_leads  = Number(cr.total_leads  || 0);
      const purchased    = Number(cr.purchased    || 0);
      const cancelled    = Number(cr.cancelled    || 0);
      const data_days    = Number(cr.data_days    || 1);
      const dead_leads   = Number(lq.dead_leads   || 0);
      const avg_score    = Number(lq.avg_score    || 0);

      const purchase_rate  = total_leads > 0 ? purchased  / total_leads : 0;
      const dead_lead_rate = total_leads > 0 ? dead_leads / total_leads : 0;
      const cancel_rate    = total_leads > 0 ? cancelled  / total_leads : 0;

      const hasData      = total_leads >= MIN_LEADS && data_days >= MIN_DAYS;
      const hasPurchases = purchased >= MIN_PURCHASES;
      const name         = (cr.ad_name || cr.ad_id || '').slice(0, 60);

      // 1. Creativo muerto
      if (hasData && dead_lead_rate >= 0.6 && purchase_rate < 0.05) {
        alerts.push({
          tipo:               'creative_dead',
          severidad:          'alta',
          titulo:             `Creativo muerto: ${name}`,
          explicacion:        `${pct(dead_lead_rate)}% de leads vencidos y solo ${pct(purchase_rate)}% de compras reales en los últimos 30 días.`,
          evidencia:          {
            ad_id: cr.ad_id, ad_name: cr.ad_name,
            total_leads, purchased, dead_leads,
            purchase_rate_pct: pct(purchase_rate),
            dead_lead_rate_pct: pct(dead_lead_rate),
            data_days,
          },
          accion_sugerida:    'Revisar segmentación y promesa del creativo. Considerar pausar si el gasto lo justifica.',
          requiere_aprobacion: true,
        });
      }

      // 2. Creativo escalable (ganador)
      if (hasData && hasPurchases && purchase_rate >= 0.25 && avg_score >= 70 && dead_lead_rate < 0.4) {
        alerts.push({
          tipo:               'creative_scalable',
          severidad:          'info',
          titulo:             `Creativo escalable: ${name}`,
          explicacion:        `${pct(purchase_rate)}% de compras reales, score promedio ${Math.round(avg_score)}/100 y ${pct(dead_lead_rate)}% leads vencidos.`,
          evidencia:          {
            ad_id: cr.ad_id, ad_name: cr.ad_name,
            total_leads, purchased,
            purchase_rate_pct: pct(purchase_rate),
            avg_score: Math.round(avg_score),
            dead_lead_rate_pct: pct(dead_lead_rate),
          },
          accion_sugerida:    'Candidato para escalar. Validar ROAS real antes de subir presupuesto.',
          requiere_aprobacion: true,
        });
      }

      // 5. Riesgo de tráfico basura (por creativo)
      if (hasData && dead_lead_rate >= 0.5 && total_leads >= 15 && !alerts.some(a => a.tipo === 'creative_dead' && a.evidencia?.ad_id === cr.ad_id)) {
        alerts.push({
          tipo:               'garbage_risk',
          severidad:          'alta',
          titulo:             `Tráfico basura: ${name}`,
          explicacion:        `${pct(dead_lead_rate)}% de leads de este creativo vencen sin compra.`,
          evidencia:          {
            ad_id: cr.ad_id, ad_name: cr.ad_name,
            total_leads, dead_leads,
            dead_lead_rate_pct: pct(dead_lead_rate),
            cancel_rate_pct: pct(cancel_rate),
          },
          accion_sugerida:    'Verificar coherencia entre promesa del anuncio, landing y producto. No pausar sin más datos.',
          requiere_aprobacion: false,
        });
      }
    }

    // Alertas por ciudad
    for (const city of cityData) {
      const total    = Number(city.total_leads || 0);
      const purchased = Number(city.purchased  || 0);
      const stale    = Number(city.stale        || 0);
      const data_days = Number(city.data_days   || 1);
      const revenue  = Number(city.revenue      || 0);

      if (total < MIN_LEADS) continue;

      const purchase_rate = total > 0 ? purchased / total : 0;
      const stale_rate    = total > 0 ? stale      / total : 0;

      // 3. Ciudad ganadora
      if (purchased >= MIN_PURCHASES && purchase_rate >= 0.4 && data_days >= MIN_DAYS) {
        alerts.push({
          tipo:               'winning_city',
          severidad:          'info',
          titulo:             `Ciudad ganadora: ${city.city}`,
          explicacion:        `${pct(purchase_rate)}% de conversión desde ${city.city} (${purchased} compras de ${total} leads, revenue Gs. ${revenue.toLocaleString('es-PY')}).`,
          evidencia:          {
            city: city.city, total_leads: total, purchased,
            purchase_rate_pct: pct(purchase_rate), revenue, data_days,
          },
          accion_sugerida:    'Considerar aumentar cobertura geográfica hacia esta zona.',
          requiere_aprobacion: false,
        });
      }

      // 5. Riesgo de tráfico basura (por ciudad)
      if (stale_rate >= 0.5 && total >= 15) {
        alerts.push({
          tipo:               'garbage_risk',
          severidad:          'alta',
          titulo:             `Tráfico basura desde: ${city.city}`,
          explicacion:        `${pct(stale_rate)}% de leads desde ${city.city} vencieron sin compra en 30 días.`,
          evidencia:          {
            city: city.city, total_leads: total, stale,
            stale_rate_pct: pct(stale_rate),
          },
          accion_sugerida:    'Revisar targeting geográfico. Alta tasa de leads sin intención real de compra en esta zona.',
          requiere_aprobacion: false,
        });
      }
    }

    // 4. Buyer type premium aumentó (compradores rápidos, VIP, alto valor, reincidentes)
    const premiumLabels = { rapido: 'rápidos', vip: 'VIP', alto_valor: 'alto valor', reincidente: 'reincidentes' };
    for (const row of buyerTrend) {
      if (!premiumLabels[row.buyer_type]) continue;
      const recent = Number(row.recent || 0);
      const prev   = Number(row.prev   || 0);

      if (recent >= MIN_PURCHASES && prev > 0 && recent > prev * 1.5) {
        const delta = Math.round(((recent - prev) / prev) * 100);
        alerts.push({
          tipo:               'buyer_type_increase',
          severidad:          'info',
          titulo:             `+${delta}% compradores ${premiumLabels[row.buyer_type]}`,
          explicacion:        `Los compradores ${premiumLabels[row.buyer_type]} aumentaron ${delta}% vs la semana anterior (${recent} vs ${prev}).`,
          evidencia:          {
            buyer_type: row.buyer_type,
            recent_7d: recent, prev_7d: prev, delta_pct: delta,
          },
          accion_sugerida:    'Señal positiva. Analizar qué creativos o ciudades están atrayendo este perfil de comprador.',
          requiere_aprobacion: false,
        });
      }
    }

    // Ordenar: alta primero, luego media, luego info
    const severityOrder = { alta: 0, media: 1, info: 2 };
    alerts.sort((a, b) => (severityOrder[a.severidad] ?? 3) - (severityOrder[b.severidad] ?? 3));

    return json({ ok: true, alerts, total: alerts.length, generated_at: new Date().toISOString() });

  } catch (err) {
    console.error('ALERTS_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

async function fetchCreativeLeads(DB, since) {
  const { results } = await DB.prepare(`
    SELECT
      ad_id,
      MAX(ad_name)                                                             AS ad_name,
      MAX(campaign_name)                                                       AS campaign_name,
      COUNT(*)                                                                 AS total_leads,
      SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END)                   AS purchased,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)                   AS cancelled,
      SUM(CASE WHEN status = 'purchased' THEN COALESCE(value, 0) ELSE 0 END)  AS revenue,
      CAST((julianday(MAX(created_at)) - julianday(MIN(created_at))) AS INTEGER) + 1 AS data_days
    FROM leads
    WHERE created_at >= ? AND ad_id IS NOT NULL
    GROUP BY ad_id
    ORDER BY total_leads DESC
    LIMIT 50
  `).bind(since).all();
  return results || [];
}

async function fetchCreativeLQ(DB, since) {
  try {
    const { results } = await DB.prepare(`
      SELECT
        ad_id,
        SUM(CASE WHEN is_dead_lead = 1 THEN 1 ELSE 0 END) AS dead_leads,
        AVG(CASE WHEN status_snapshot = 'purchased' THEN quality_score END) AS avg_score
      FROM lead_quality
      WHERE processed_at >= ? AND ad_id IS NOT NULL
      GROUP BY ad_id
    `).bind(since).all();
    return results || [];
  } catch (e) {
    console.warn('ALERTS_LQ_WARN', e.message);
    return [];
  }
}

async function fetchCityData(DB, since) {
  const { results } = await DB.prepare(`
    SELECT
      LOWER(TRIM(COALESCE(location_city, city))) AS city,
      COUNT(*)                                                                 AS total_leads,
      SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END)                   AS purchased,
      SUM(CASE WHEN status = 'purchased' THEN COALESCE(value, 0) ELSE 0 END)  AS revenue,
      SUM(CASE WHEN status = 'pending' AND created_at < datetime('now', '-5 days') THEN 1 ELSE 0 END) AS stale,
      CAST((julianday(MAX(created_at)) - julianday(MIN(created_at))) AS INTEGER) + 1 AS data_days
    FROM leads
    WHERE created_at >= ?
      AND (location_city IS NOT NULL OR city IS NOT NULL)
    GROUP BY LOWER(TRIM(COALESCE(location_city, city)))
    HAVING total_leads >= 5
    ORDER BY purchased DESC
    LIMIT 30
  `).bind(since).all();
  return results || [];
}

async function fetchBuyerTrend(DB, since7, since14) {
  try {
    const { results } = await DB.prepare(`
      SELECT
        lq.buyer_type,
        SUM(CASE WHEN l.purchased_at >= ?                        THEN 1 ELSE 0 END) AS recent,
        SUM(CASE WHEN l.purchased_at >= ? AND l.purchased_at < ? THEN 1 ELSE 0 END) AS prev
      FROM lead_quality lq
      JOIN leads l ON l.id = lq.lead_id
      WHERE l.status = 'purchased'
        AND lq.buyer_type IN ('rapido', 'vip', 'alto_valor', 'reincidente')
      GROUP BY lq.buyer_type
    `).bind(since7, since14, since7).all();
    return results || [];
  } catch (e) {
    console.warn('ALERTS_BUYER_TREND_WARN', e.message);
    return [];
  }
}

function pct(rate) { return Math.round(rate * 100); }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
