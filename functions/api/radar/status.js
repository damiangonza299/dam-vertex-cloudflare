/* =========================================================
   GET /api/radar/status
   DAM Product Radar — Estado de credenciales y fuentes

   Muestra qué está configurado, qué falta, y cómo configurarlo.
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

  const sources = [
    {
      name:        'Mercado Libre Paraguay',
      source_id:   'mercadolibre_py',
      status:      env.ML_ACCESS_TOKEN ? 'OK' : 'NEEDS_SETUP',
      signal:      'sold_quantity — ventas reales en Paraguay',
      priority:    1,
      env_var:     'ML_ACCESS_TOKEN',
      configured:  !!env.ML_ACCESS_TOKEN,
      setup_steps: env.ML_ACCESS_TOKEN ? null : [
        '1. Ir a https://developers.mercadolibre.com.py/',
        '2. Crear cuenta gratuita',
        '3. Ir a "Mis Aplicaciones" → crear nueva app',
        '4. En la app creada, ir a Credenciales → "Obtener token de aplicación"',
        '5. Copiar el access_token resultante',
        '6. En Cloudflare Pages → Settings → Environment variables → agregar ML_ACCESS_TOKEN',
        '7. Hacer un nuevo deploy para que tome efecto',
      ],
      estimated_setup_time: '5-10 minutos',
    },
    {
      name:        'Meta Ads Library Paraguay',
      source_id:   'meta_ads_library',
      status:      'NEEDS_APP_REVIEW',
      signal:      'spend + impressions — inversión publicitaria en PY',
      priority:    2,
      env_var:     'META_MARKETING_TOKEN (ya configurado, pero app sin permiso)',
      configured:  !!env.META_MARKETING_TOKEN,
      permission_issue: true,
      setup_steps: [
        '1. Ir a https://developers.facebook.com/apps/',
        '2. Abrir la app asociada al META_MARKETING_TOKEN',
        '3. Ir a App Review → Permissions and Features',
        '4. Buscar "Ads Library API" y solicitar acceso',
        '5. Completar el formulario de revisión (uso: investigación de mercado)',
        '6. Esperar aprobación de Meta (típicamente 1-7 días hábiles)',
        '7. Una vez aprobado, el scanner funciona automáticamente con el token existente',
      ],
      estimated_setup_time: '1-7 días hábiles (proceso de review de Meta)',
    },
    {
      name:        'AliExpress',
      source_id:   'aliexpress',
      status:      env.AE_APP_KEY ? 'OK' : 'NEEDS_SETUP',
      signal:      'orders_30d — órdenes globales como señal de demanda',
      priority:    3,
      env_var:     'AE_APP_KEY',
      configured:  !!env.AE_APP_KEY,
      setup_steps: env.AE_APP_KEY ? null : [
        '1. Ir a https://portals.aliexpress.com/',
        '2. Crear cuenta de afiliado (gratuito)',
        '3. En la consola de afiliado, ir a Tools → API Portal',
        '4. Crear una aplicación para obtener APP_KEY y APP_SECRET',
        '5. Agregar AE_APP_KEY en Cloudflare Pages env vars',
        '6. Hacer un nuevo deploy',
      ],
      note:        'El scraping directo está bloqueado desde IPs de Cloudflare. Requiere API key oficial.',
      estimated_setup_time: '1-3 días (aprobación de cuenta afiliado)',
    },
  ];

  // Estadísticas de D1 si hay datos
  let radarStats = null;
  try {
    const [cands, watch, runs] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS total, MAX(first_seen_at) AS last_found FROM product_candidates`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM candidate_watchlist`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS total, MAX(run_at) AS last_run FROM radar_run_log WHERE dry_run = 0`).first(),
    ]);
    radarStats = {
      candidates_total: cands?.total || 0,
      candidates_last:  cands?.last_found || null,
      watchlist_total:  watch?.total || 0,
      scans_total:      runs?.total || 0,
      last_scan:        runs?.last_run || null,
    };
  } catch (_) {}

  const readySources   = sources.filter(s => s.status === 'OK').length;
  const totalSources   = sources.length;
  const systemStatus   = readySources === 0 ? 'PENDING_SETUP'
                       : readySources < totalSources ? 'PARTIAL'
                       : 'FULL';

  return json({
    ok:            true,
    system_status: systemStatus,
    ready_sources: readySources,
    total_sources: totalSources,
    sources,
    radar_stats:   radarStats,
    scan_endpoint:       '/api/radar/scan',
    scan_dry_run:        '/api/radar/scan?dry_run=true',
    scan_source_options: 'all | meta | aliexpress | mercadolibre',
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
