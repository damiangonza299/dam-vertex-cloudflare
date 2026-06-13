/* =========================================================
   GET /api/insync/structure-patterns — CAPA A Structure Engine
   InSync Recommendation Engine — Phase 1

   Admin auth required: Authorization: Bearer ADMIN_PASSWORD
   Query params:
     ?category=relojes   (required — normalized at compare time)
     ?period=24h|48h|7d|30d|90d  (default: 30d)

   Read-only. Does NOT write to any table.
   Source of truth: product_briefs (category) + behavior_events (metrics)
   Normalization spec: AI_SYSTEM/skills/insync-recommendation-engine.md
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const PERIOD_SECS = { '24h': 86400, '48h': 172800, '7d': 604800, '30d': 2592000, '90d': 7776000 };

/* Sessions threshold below which all sections are PENDIENTE */
const MIN_SESSIONS_FOR_STRENGTH = 100;

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const url         = new URL(request.url);
  const rawCategory = url.searchParams.get('category');
  const period      = url.searchParams.get('period') || '30d';

  if (!rawCategory) {
    return json({ ok: false, error: 'category requerido' }, 400);
  }
  if (!PERIOD_SECS[period]) {
    return json({ ok: false, error: `period inválido. Valores: ${Object.keys(PERIOD_SECS).join(', ')}` }, 400);
  }

  const queryCategory = normalizeCategory(rawCategory);
  const since         = Math.floor(Date.now() / 1000) - PERIOD_SECS[period];

  try {
    /* ── Step 1: find slugs matching category ── */
    const { results: briefs } = await env.DB.prepare(
      'SELECT product_slug, op_json FROM product_briefs'
    ).all();

    const matchingSlugs = (briefs || [])
      .filter(b => {
        const op = parseJson(b.op_json, {});
        return normalizeCategory(op.category || '') === queryCategory;
      })
      .map(b => b.product_slug);

    if (!matchingSlugs.length) {
      return json(emptyResponse(queryCategory, period));
    }

    /* ── Step 2: build WHERE clause ──
       Slugs come from product_briefs (trusted source, alphanumeric + hyphens).
       Pattern: landing LIKE '/slug/' prevents '/reloj/' matching '/reloj-imperial-verde/'.  */
    const landingWhere = matchingSlugs.map(s => `landing LIKE '/${s}/%'`).join(' OR ');

    /* ── Step 3: batch queries ── */
    const [sessionsR, sectionViewR, sectionTimeR, ctaClickR] = await env.DB.batch([

      /* sessions per landing (page_view as session anchor) */
      env.DB.prepare(
        `SELECT landing, COUNT(DISTINCT session_id) AS sessions
         FROM behavior_events
         WHERE event_type = 'page_view' AND (${landingWhere}) AND ts >= ?
         GROUP BY landing`
      ).bind(since),

      /* section view counts per section per landing */
      env.DB.prepare(
        `SELECT landing, section, COUNT(*) AS views
         FROM behavior_events
         WHERE event_type = 'section_view' AND section IS NOT NULL
               AND (${landingWhere}) AND ts >= ?
         GROUP BY landing, section`
      ).bind(since),

      /* section average dwell time per section per landing */
      env.DB.prepare(
        `SELECT landing, section,
                AVG(CAST(json_extract(meta, '$.duration_s') AS REAL)) AS avg_time
         FROM behavior_events
         WHERE event_type = 'section_time' AND section IS NOT NULL
               AND (${landingWhere}) AND ts >= ?
         GROUP BY landing, section`
      ).bind(since),

      /* CTA clicks per cta_type per landing */
      env.DB.prepare(
        `SELECT landing, cta_type, COUNT(*) AS clicks
         FROM behavior_events
         WHERE event_type = 'cta_click' AND cta_type IS NOT NULL
               AND (${landingWhere}) AND ts >= ?
         GROUP BY landing, cta_type`
      ).bind(since),
    ]);

    /* ── Step 4: aggregate sessions ── */
    const sessionsBySlug = {};
    (sessionsR.results || []).forEach(r => {
      const slug = extractSlug(r.landing);
      if (slug && matchingSlugs.includes(slug)) {
        sessionsBySlug[slug] = (sessionsBySlug[slug] || 0) + r.sessions;
      }
    });

    const totalSessions = Object.values(sessionsBySlug).reduce((a, b) => a + b, 0);

    /* ── Step 5: aggregate section metrics ──
       sectionData shape:
         { normalizedName → { views, timeSum, timeCount, ctaClicks, byLanding: { slug → {...} } } } */
    const sectionData = {};

    const ensureSection = name => {
      if (!sectionData[name]) {
        sectionData[name] = { views: 0, timeSum: 0, timeCount: 0, ctaClicks: 0, byLanding: {} };
      }
    };

    /* section_view — primary source for section discovery */
    (sectionViewR.results || []).forEach(r => {
      const slug = extractSlug(r.landing);
      if (!slug || !matchingSlugs.includes(slug)) return;
      const name = normalizeSection(r.section);
      if (!name) return;

      ensureSection(name);
      sectionData[name].views += r.views;

      if (!sectionData[name].byLanding[slug]) {
        sectionData[name].byLanding[slug] = { views: 0, avgTimeS: 0, ctaClicks: 0 };
      }
      sectionData[name].byLanding[slug].views += r.views;
    });

    /* section_time — only enriches existing sections */
    (sectionTimeR.results || []).forEach(r => {
      const slug = extractSlug(r.landing);
      if (!slug || !matchingSlugs.includes(slug) || !r.avg_time) return;
      const name = normalizeSection(r.section);
      if (!name || !sectionData[name]) return;

      sectionData[name].timeSum   += r.avg_time;
      sectionData[name].timeCount += 1;
      if (sectionData[name].byLanding[slug]) {
        sectionData[name].byLanding[slug].avgTimeS = r.avg_time;
      }
    });

    /* cta_click — only enriches sections that already exist from section_view.
       cta_type values like "nav" or "sticky" that don't match any section are ignored. */
    (ctaClickR.results || []).forEach(r => {
      const slug = extractSlug(r.landing);
      if (!slug || !matchingSlugs.includes(slug)) return;
      const name = normalizeSection(r.cta_type || '');
      if (!name || !sectionData[name]) return;

      sectionData[name].ctaClicks += r.clicks;
      if (sectionData[name].byLanding[slug]) {
        sectionData[name].byLanding[slug].ctaClicks += r.clicks;
      }
    });

    /* ── Step 6: compute metrics and classify ── */
    const sections = Object.entries(sectionData).map(([name, data]) => {
      const slugSessions = sessionsBySlug;

      /* aggregate metrics */
      const reachPct  = totalSessions > 0 ? Math.round(data.views / totalSessions * 100) : 0;
      const avgTimeS  = data.timeCount > 0
        ? Math.round((data.timeSum / data.timeCount) * 10) / 10
        : 0;
      const timeScore = avgTimeS ? Math.min(Math.round((avgTimeS / 15) * 100), 100) : 0;
      const attnScore = Math.round(reachPct * 0.5 + timeScore * 0.5);
      const ctaRate   = totalSessions > 0 ? Math.round(data.ctaClicks / totalSessions * 100) : 0;

      /* per-landing breakdown */
      const byLanding = {};
      Object.entries(data.byLanding).forEach(([slug, d]) => {
        const sSlug    = sessionsBySlug[slug] || 0;
        const lReach   = sSlug > 0 ? Math.round(d.views / sSlug * 100) : 0;
        const lTime    = d.avgTimeS
          ? Math.min(Math.round((d.avgTimeS / 15) * 100), 100)
          : 0;
        const lAttn    = Math.round(lReach * 0.5 + lTime * 0.5);
        const lCta     = sSlug > 0 ? Math.round(d.ctaClicks / sSlug * 100) : 0;

        byLanding[slug] = {
          sessions:        sSlug,
          views:           d.views,
          reach_pct:       lReach,
          avg_time_s:      Math.round(d.avgTimeS * 10) / 10,
          attention_score: lAttn,
          cta_rate:        lCta,
        };
      });

      return {
        name,
        reach_pct:       reachPct,
        avg_time_s:      avgTimeS,
        attention_score: attnScore,
        cta_rate:        ctaRate,
        landing_count:   Object.keys(data.byLanding).length,
        sessions_sample: totalSessions,
        strength:        classifyStrength(reachPct, attnScore, totalSessions),
        by_landing:      byLanding,
      };
    });

    /* sort by attention_score descending */
    sections.sort((a, b) => b.attention_score - a.attention_score);

    /* build ranking buckets */
    const ranking = { strong: [], neutral: [], weak: [], pending: [] };
    sections.forEach(s => {
      ranking[s.strength.toLowerCase()].push(s.name);
    });

    /* ── Step 7: build meta ── */
    const landingsMeta = matchingSlugs.map(slug => ({
      slug,
      sessions:  sessionsBySlug[slug] || 0,
      has_data:  !!(sessionsBySlug[slug]),
    }));
    const landingCount = landingsMeta.filter(l => l.has_data).length;

    return json({
      ok:      true,
      engine:  'structure-v1',
      query:   { category: queryCategory, period },
      meta: {
        total_sessions: totalSessions,
        landing_count:  landingCount,
        low_volume:     totalSessions < 30,
        landings:       landingsMeta,
      },
      structure: { sections, ranking },
      principles: null,
    });

  } catch (err) {
    console.error('STRUCTURE_PATTERNS_ERROR', err.message);
    return json({ ok: false, error: err.message }, 500);
  }
}

/* ── Helpers ── */

function normalizeCategory(raw) {
  return (raw || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');
}

function normalizeSection(raw) {
  if (!raw) return null;
  const n = raw.trim().toLowerCase().replace(/^section-/, '').replace(/-section$/, '');
  return n || null;
}

function extractSlug(landing) {
  /* '/reloj-imperial-verde/?utm_source=fb' → 'reloj-imperial-verde' */
  return (landing || '').split('?')[0].split('/').filter(Boolean)[0] || null;
}

function classifyStrength(reachPct, attnScore, sessionsSample) {
  if (sessionsSample < MIN_SESSIONS_FOR_STRENGTH) return 'PENDIENTE';
  if (reachPct >= 60 && attnScore >= 55)          return 'FUERTE';
  if (reachPct < 30  && attnScore < 30)           return 'DEBIL';
  return 'NEUTRO';
}

function emptyResponse(category, period) {
  return {
    ok:     true,
    engine: 'structure-v1',
    query:  { category, period },
    meta:   { total_sessions: 0, landing_count: 0, low_volume: true, landings: [] },
    structure: {
      sections: [],
      ranking:  { strong: [], neutral: [], weak: [], pending: [] },
    },
    principles: null,
  };
}

function parseJson(str, fallback) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch (_) { return fallback; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
