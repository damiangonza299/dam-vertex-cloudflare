/* =========================================================
   GET /api/insync-report — DAM INTELLIGENCE Analytics
   Admin auth required: Authorization: Bearer ADMIN_PASSWORD
   Query params:
     ?period=24h|48h|7d|30d  (default: 24h)
     ?landing=cepillo|reloj|lentes|cadena|all  (default: all)
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const PERIOD_SECS = { '24h': 86400, '48h': 172800, '7d': 604800, '30d': 2592000 };
const ATTN_MIN    = 30; /* min section views for attention score */
const REV_MIN     = 5;  /* min purchases for revenue insight */

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url     = new URL(request.url);
  const period  = url.searchParams.get('period')  || '24h';
  const landing = url.searchParams.get('landing') || 'all';

  const periodSec     = PERIOD_SECS[period] || 86400;
  const since         = Math.floor(Date.now() / 1000) - periodSec;
  const landingFilter = landing === 'all' ? '%' : `%/${landing}%`;

  try {
    const [
      volumeR, scrollR, sectionR, ctaClickR,
      modalOpenR, formSubmitR, errorR, leadR, revenueR, landingsR,
    ] = await env.DB.batch([

      /* 1 — Volume */
      env.DB.prepare(
        'SELECT COUNT(DISTINCT session_id) AS sessions, COUNT(*) AS events FROM behavior_events WHERE landing LIKE ? AND ts >= ?'
      ).bind(landingFilter, since),

      /* 2 — Scroll funnel */
      env.DB.prepare(
        "SELECT event_type, COUNT(DISTINCT session_id) AS cnt FROM behavior_events WHERE event_type IN ('scroll_25','scroll_50','scroll_75','scroll_90') AND landing LIKE ? AND ts >= ? GROUP BY event_type"
      ).bind(landingFilter, since),

      /* 3 — Sections (views + avg time) */
      env.DB.prepare(
        "SELECT section, COUNT(*) FILTER (WHERE event_type='section_view') AS views, AVG(CAST(json_extract(meta,'$.duration_s') AS REAL)) FILTER (WHERE event_type='section_time') AS avg_time FROM behavior_events WHERE section IS NOT NULL AND landing LIKE ? AND ts >= ? GROUP BY section ORDER BY views DESC LIMIT 20"
      ).bind(landingFilter, since),

      /* 4 — CTA clicks */
      env.DB.prepare(
        "SELECT cta_type, COUNT(*) AS clicks, COUNT(DISTINCT session_id) AS sessions FROM behavior_events WHERE event_type='cta_click' AND cta_type IS NOT NULL AND landing LIKE ? AND ts >= ? GROUP BY cta_type ORDER BY clicks DESC"
      ).bind(landingFilter, since),

      /* 5 — Modal opens by trigger CTA */
      env.DB.prepare(
        "SELECT json_extract(meta,'$.trigger_cta') AS cta, COUNT(*) AS opens FROM behavior_events WHERE event_type='modal_open' AND landing LIKE ? AND ts >= ? GROUP BY json_extract(meta,'$.trigger_cta')"
      ).bind(landingFilter, since),

      /* 6 — Form submits */
      env.DB.prepare(
        "SELECT COUNT(*) AS cnt FROM behavior_events WHERE event_type='form_submit' AND landing LIKE ? AND ts >= ?"
      ).bind(landingFilter, since),

      /* 7 — Errors */
      env.DB.prepare(
        "SELECT event_type, COUNT(*) AS cnt FROM behavior_events WHERE event_type IN ('stock_error','modal_error') AND landing LIKE ? AND ts >= ? GROUP BY event_type"
      ).bind(landingFilter, since),

      /* 8 — Lead attribution (sessions linked to leads via session_id) */
      env.DB.prepare(
        'SELECT COUNT(DISTINCT be.session_id) AS attributed, COUNT(DISTINCT l.id) AS leads FROM behavior_events be JOIN leads l ON l.session_id = be.session_id WHERE be.landing LIKE ? AND be.ts >= ?'
      ).bind(landingFilter, since),

      /* 9 — Revenue attribution */
      env.DB.prepare(
        "SELECT COUNT(DISTINCT CASE WHEN l.status='purchased' THEN be.session_id END) AS purchased_sessions, COALESCE(SUM(CASE WHEN l.status='purchased' THEN CAST(l.value AS REAL) ELSE 0 END),0) AS revenue FROM behavior_events be JOIN leads l ON l.session_id = be.session_id WHERE be.landing LIKE ? AND be.ts >= ?"
      ).bind(landingFilter, since),

      /* 10 — Distinct landings (for dynamic selector) */
      env.DB.prepare(
        'SELECT DISTINCT landing FROM behavior_events ORDER BY landing'
      ),
    ]);

    /* ── Volume ── */
    const sessions = volumeR.results[0]?.sessions || 0;
    const events   = volumeR.results[0]?.events   || 0;

    /* ── Scroll funnel ── */
    const scrollMap = {};
    (scrollR.results || []).forEach(r => { scrollMap[r.event_type] = r.cnt; });
    const scrollFunnel = {
      p25: sessions ? Math.round((scrollMap['scroll_25'] || 0) / sessions * 100) : 0,
      p50: sessions ? Math.round((scrollMap['scroll_50'] || 0) / sessions * 100) : 0,
      p75: sessions ? Math.round((scrollMap['scroll_75'] || 0) / sessions * 100) : 0,
      p90: sessions ? Math.round((scrollMap['scroll_90'] || 0) / sessions * 100) : 0,
    };

    /* ── Section stats + attention score ── */
    const sections = (sectionR.results || []).map(r => {
      const reachPct  = sessions ? Math.round(r.views / sessions * 100) : 0;
      const timeSc    = r.avg_time ? Math.min(Math.round((r.avg_time / 15) * 100), 100) : 0;
      const aScore    = r.views >= ATTN_MIN
        ? Math.round(reachPct * 0.5 + timeSc * 0.5)
        : null;
      return {
        name:            r.section,
        views:           r.views,
        avg_time_s:      r.avg_time ? Math.round(r.avg_time) : 0,
        reach_pct:       reachPct,
        attention_score: aScore,
        low_volume:      r.views < ATTN_MIN,
      };
    });

    /* ── CTA funnel ── */
    const modalMap = {};
    (modalOpenR.results || []).forEach(r => { if (r.cta) modalMap[r.cta] = r.opens; });

    const ctaFunnel = (ctaClickR.results || []).map(r => ({
      cta_type:        r.cta_type,
      clicks:          r.clicks,
      unique_sessions: r.sessions,
      modal_opens:     modalMap[r.cta_type] || 0,
      modal_open_rate: r.clicks ? Math.round((modalMap[r.cta_type] || 0) / r.clicks * 100) : 0,
    }));

    /* ── Revenue ── */
    const formSubmits        = formSubmitR.results[0]?.cnt              || 0;
    const attributedSessions = leadR.results[0]?.attributed             || 0;
    const attributedLeads    = leadR.results[0]?.leads                  || 0;
    const purchasedSessions  = revenueR.results[0]?.purchased_sessions  || 0;
    const totalRevenue       = revenueR.results[0]?.revenue             || 0;

    /* ── Distinct landing slugs (for dynamic selector) ── */
    const slugSet = new Set();
    (landingsR.results || []).forEach(r => {
      const slug = (r.landing || '').split('?')[0].split('/').filter(Boolean)[0];
      if (slug) slugSet.add(slug);
    });
    const landings = Array.from(slugSet).sort();

    /* ── Errors ── */
    const errorMap = {};
    (errorR.results || []).forEach(r => { errorMap[r.event_type] = r.cnt; });

    /* ── Insights (volume-gated, never on attention alone) ── */
    const insights = buildInsights({ sessions, scrollFunnel, sections, purchasedSessions, totalRevenue, attributedLeads });

    return json({
      ok: true,
      period,
      landing,
      landings,
      volume: { sessions, events, low_volume: sessions < 30 },
      attention: { scroll_funnel: scrollFunnel, sections },
      conversion: { cta_funnel: ctaFunnel, form_submits: formSubmits },
      revenue: {
        attributed_sessions: attributedSessions,
        attributed_leads:    attributedLeads,
        purchased_sessions:  purchasedSessions,
        total_revenue_gs:    Math.round(totalRevenue),
        revenue_per_session: purchasedSessions ? Math.round(totalRevenue / purchasedSessions) : 0,
        low_volume:          purchasedSessions < REV_MIN,
      },
      errors: {
        stock_error: errorMap['stock_error'] || 0,
        modal_error: errorMap['modal_error'] || 0,
      },
      insights,
    });

  } catch (err) {
    console.error('INSYNC_REPORT_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

function buildInsights({ sessions, scrollFunnel, sections, purchasedSessions, totalRevenue, attributedLeads }) {
  const out = [];

  if (sessions < 30) {
    out.push({ type: 'VOLUMEN', text: `Solo ${sessions} sesiones. Se necesitan 30+ para hipótesis. Acumulando datos.`, confidence: 0 });
    return out;
  }

  /* Scroll drop-off */
  if (scrollFunnel.p50 < 40) {
    out.push({
      type: 'HIPOTESIS',
      text: `${100 - scrollFunnel.p50}% de sesiones abandona antes del 50% de scroll. La mitad del contenido no se ve.`,
      confidence: Math.min(sessions / 200, 1).toFixed(2),
    });
  }

  /* Top attention section — hipótesis only, never conclusión sin revenue */
  const topSec = sections.filter(s => !s.low_volume && s.attention_score != null).sort((a, b) => b.attention_score - a.attention_score)[0];
  if (topSec && topSec.attention_score >= 60) {
    out.push({
      type: 'HIPOTESIS',
      text: `Sección "${topSec.name}" lidera atención (score ${topSec.attention_score}, ${topSec.views} vistas). Sin datos de compra suficientes para CONCLUSIÓN.`,
      confidence: Math.min(sessions / 200, 1).toFixed(2),
    });
  }

  /* Revenue CONCLUSIÓN — solo cuando hay datos */
  if (purchasedSessions >= REV_MIN) {
    const rps = Math.round(totalRevenue / purchasedSessions);
    out.push({
      type: 'CONCLUSION',
      text: `${purchasedSessions} sesiones atribuidas a compras. Revenue período: Gs. ${Math.round(totalRevenue).toLocaleString('es-PY')}. Revenue/sesión comprada: Gs. ${rps.toLocaleString('es-PY')}.`,
      confidence: 1,
    });
  }

  /* Lead attribution note */
  if (attributedLeads > 0 && purchasedSessions < REV_MIN) {
    out.push({
      type: 'HIPOTESIS',
      text: `${attributedLeads} leads con session_id atribuido. Insuficiente volumen de compras (${purchasedSessions}/${REV_MIN}) para CONCLUSIÓN de revenue.`,
      confidence: Math.min(attributedLeads / 20, 1).toFixed(2),
    });
  }

  return out;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
