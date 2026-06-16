/* =========================================================
   _meta-ads-scanner.js — DAM Product Radar
   Scannea Meta Ads Library para Paraguay.
   Usa META_MARKETING_TOKEN existente (ads_read).
   NO es ruta de Cloudflare Pages.

   Estrategia:
   - Por cada keyword, busca anuncios activos en PY
   - Agrupa por keyword: cuenta anunciantes únicos, suma spend/impressions
   - Retorna candidatos normalizados para scoring
   ========================================================= */

const META_API   = 'https://graph.facebook.com/v21.0/ads_archive';
const COUNTRY    = 'PY';
const AD_FIELDS  = [
  'id',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_captions',
  'page_name',
  'impressions',
  'spend',
  'ad_delivery_start_time',
  'publisher_platforms',
].join(',');

// Keywords calibradas para ecommerce de impulso en Paraguay
const SCAN_KEYWORDS = [
  // Joyería y accesorios
  'reloj mujer',
  'pulsera acero',
  'collar dama',
  'aretes cristal',
  'anillo plata',
  // Gafas
  'gafas de sol',
  'lentes de sol mujer',
  // Salud y belleza
  'masajeador facial electrico',
  'cepillo electrico facial',
  'plancha alisadora cabello',
  'serum vitamina c',
  'crema antiarrugas',
  // Tecnología
  'auriculares bluetooth',
  'funda celular',
  'cargador inalambrico',
  // Hogar
  'lampara led escritorio',
  'humidificador ultrasonico',
  'organizador cocina',
  // Fitness
  'faja modeladora',
  'cinturon adelgazante',
];

export async function scanMetaAds(env, { dryRun = false } = {}) {
  if (!env.META_MARKETING_TOKEN) {
    return { ok: false, error: 'META_MARKETING_TOKEN no configurado', candidates: [], debug: [] };
  }

  const candidates = [];
  const debugLog   = [];

  for (const keyword of SCAN_KEYWORDS) {
    try {
      const url = new URL(META_API);
      url.searchParams.set('access_token',         env.META_MARKETING_TOKEN);
      url.searchParams.set('ad_reached_countries', JSON.stringify([COUNTRY]));
      url.searchParams.set('ad_type',              'ALL');
      url.searchParams.set('search_terms',         keyword);
      url.searchParams.set('fields',               AD_FIELDS);
      url.searchParams.set('limit',                '50');

      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 15000);

      let res;
      try {
        res = await fetch(url.toString(), { signal: controller.signal });
      } finally {
        clearTimeout(tid);
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const errInfo = { keyword, status: res.status, error: errText.slice(0, 300) };
        console.warn(`META_RADAR keyword="${keyword}" status=${res.status}`, errText.slice(0, 200));
        debugLog.push(errInfo);
        continue;
      }

      const data = await res.json();
      if (data.error) {
        const errInfo = { keyword, api_error: data.error };
        console.warn(`META_RADAR_API_ERR keyword="${keyword}"`, JSON.stringify(data.error).slice(0, 200));
        debugLog.push(errInfo);
        continue;
      }

      debugLog.push({ keyword, ads_found: (data.data || []).length });

      const ads = data.data || [];
      if (ads.length === 0) continue;

      // Agregar señales
      const advertiserSet = new Set();
      let spendLow = 0, spendHigh = 0;
      let impLow   = 0, impHigh   = 0;
      let oldestMs = null;
      const platforms = new Set();

      for (const ad of ads) {
        advertiserSet.add(ad.page_name || 'unknown');

        const s = ad.spend       || {};
        const i = ad.impressions || {};
        spendLow  += Number(s.lower_bound || 0);
        spendHigh += Number(s.upper_bound || s.lower_bound || 0);
        impLow    += Number(i.lower_bound || 0);
        impHigh   += Number(i.upper_bound || i.lower_bound || 0);

        if (ad.ad_delivery_start_time) {
          const t = new Date(ad.ad_delivery_start_time).getTime();
          if (!isNaN(t) && (!oldestMs || t < oldestMs)) oldestMs = t;
        }

        for (const p of (ad.publisher_platforms || [])) platforms.add(p);
      }

      const numAdvertisers = advertiserSet.size;
      const numAds         = ads.length;
      const adAgeDays      = oldestMs ? Math.round((Date.now() - oldestMs) / 86400000) : null;
      const productName    = extractBestName(keyword, ads);

      candidates.push({
        source:    'meta_ads_library',
        source_id: `meta_py_${keyword.replace(/\s+/g, '_')}`,
        source_url: `https://www.facebook.com/ads/library/?country=${COUNTRY}&q=${encodeURIComponent(keyword)}&active_status=active&ad_type=all`,
        name:      productName,
        category:  keywordToCategory(keyword),
        signals: {
          keyword,
          num_ads:          numAds,
          num_advertisers:  numAdvertisers,
          spend_lower:      spendLow,
          spend_upper:      spendHigh,
          impressions_lower: impLow,
          impressions_upper: impHigh,
          ad_age_days:      adAgeDays,
          platforms:        Array.from(platforms),
          top_advertisers:  Array.from(advertiserSet).slice(0, 5),
        },
      });

      // Pausa suave para no golpear rate limits
      if (!dryRun) await sleep(400);

    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`META_RADAR_TIMEOUT keyword="${keyword}"`);
      } else {
        console.warn(`META_RADAR_ERROR keyword="${keyword}"`, err.message);
      }
    }
  }

  return { ok: true, candidates, debug: debugLog };
}

function extractBestName(keyword, ads) {
  // Intentar extraer nombre del título del creative
  for (const ad of ads.slice(0, 8)) {
    const titles = ad.ad_creative_link_titles || [];
    for (const t of titles) {
      if (t && t.length >= 4 && t.length <= 70) {
        const low = t.toLowerCase();
        const kwFirst = keyword.toLowerCase().split(' ')[0];
        if (low.includes(kwFirst)) {
          return t.trim().replace(/\s+/g, ' ');
        }
      }
    }
  }
  // Fallback: keyword capitalizado
  return keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function keywordToCategory(kw) {
  const k = kw.toLowerCase();
  if (['reloj', 'pulsera', 'collar', 'aretes', 'anillo'].some(c => k.includes(c))) return 'Accesorios';
  if (['gafas', 'lentes'].some(c => k.includes(c)))                                 return 'Lentes';
  if (['masajeador', 'cepillo', 'plancha', 'faja', 'cinturon'].some(c => k.includes(c))) return 'Salud';
  if (['serum', 'crema'].some(c => k.includes(c)))                                  return 'Belleza';
  if (['auricular', 'funda', 'cargador'].some(c => k.includes(c)))                  return 'Tecnología';
  if (['lampara', 'humidificador', 'organizador'].some(c => k.includes(c)))         return 'Hogar';
  return 'General';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
