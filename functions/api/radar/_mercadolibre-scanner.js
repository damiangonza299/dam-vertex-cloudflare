/* =========================================================
   _mercadolibre-scanner.js — DAM Product Radar
   Scannea Mercado Libre Paraguay — API pública, sin auth.
   NO es ruta de Cloudflare Pages.

   Señal clave: sold_quantity = unidades vendidas reales en PY.
   Esto es más directo que anuncios Meta: mide compras, no avisos.
   ========================================================= */

const ML_API    = 'https://api.mercadolibre.com/sites/MPY/search';
const MIN_SOLD  = 3;

const SCAN_KEYWORDS = [
  // Joyería y accesorios
  'reloj dama', 'pulsera acero', 'collar dama', 'aretes cristal',
  'gafas sol mujer',
  // Salud y belleza
  'masajeador facial electrico', 'cepillo electrico', 'plancha cabello',
  'serum vitamina c', 'crema facial', 'mascarilla facial',
  // Tecnología
  'auriculares bluetooth', 'cargador inalambrico',
  // Hogar
  'lampara led escritorio', 'humidificador', 'organizador cocina',
  // Fitness / Adelgazante
  'faja reductora', 'cinturon adelgazante',
];

export async function scanMercadoLibre(env, { dryRun = false } = {}) {
  if (!env.ML_ACCESS_TOKEN) {
    return {
      ok: false,
      error: 'ML_ACCESS_TOKEN no configurado',
      setup_guide: 'Obtener en 5 min: (1) Ir a https://developers.mercadolibre.com.py/ (2) Crear cuenta y nueva app (3) Ir a Credenciales → Obtener token de aplicación (client_credentials) (4) Agregar ML_ACCESS_TOKEN en Cloudflare Pages → Settings → Environment variables',
      candidates: [],
      debug: [],
    };
  }

  const candidates = [];
  const debugLog   = [];
  const authHeader = `Bearer ${env.ML_ACCESS_TOKEN}`;

  for (const keyword of SCAN_KEYWORDS) {
    try {
      const url = new URL(ML_API);
      url.searchParams.set('q',     keyword);
      url.searchParams.set('sort',  'sold_quantity_desc');
      url.searchParams.set('limit', '10');

      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12000);
      let res;
      try {
        res = await fetch(url.toString(), {
          headers: { 'Accept': 'application/json', 'Authorization': authHeader },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(tid);
      }

      if (!res.ok) {
        debugLog.push({ keyword, status: res.status });
        console.warn(`ML_RADAR keyword="${keyword}" status=${res.status}`);
        continue;
      }

      const data    = await res.json();
      const results = data.results || [];

      if (results.length === 0) {
        debugLog.push({ keyword, results: 0 });
        continue;
      }

      let added = 0;
      for (const item of results.slice(0, 4)) {
        if (!item.title) continue;

        const sold   = Number(item.sold_quantity || 0);
        const priceGs = Number(item.price || 0);

        if (sold < MIN_SOLD) continue;

        const clean = cleanTitle(item.title);
        if (clean.length < 4) continue;

        candidates.push({
          source:    'mercadolibre_py',
          source_id: `meli_${item.id}`,
          source_url: item.permalink || null,
          name:      clean,
          category:  keywordToCategory(keyword),
          image_url: (item.thumbnail || '').replace('http:', 'https:') || null,
          signals: {
            keyword,
            orders_30d: sold,
            price_gs:   priceGs,
            meli_id:    item.id,
            condition:  item.condition || 'new',
          },
        });
        added++;
      }

      debugLog.push({ keyword, results: results.length, added });
      if (!dryRun) await sleep(250);

    } catch (err) {
      const label = err.name === 'AbortError' ? 'timeout' : err.message;
      console.warn(`ML_RADAR_ERROR keyword="${keyword}"`, label);
      debugLog.push({ keyword, error: label });
    }
  }

  return { ok: true, candidates, debug: debugLog };
}

function cleanTitle(title) {
  return title
    .replace(/\d+\s*(unidad|und|pcs|pc|pack|set|combo)\b.*/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function keywordToCategory(kw) {
  const k = kw.toLowerCase();
  if (['reloj', 'pulsera', 'collar', 'aretes'].some(c => k.includes(c)))    return 'Accesorios';
  if (['gafas', 'lentes'].some(c => k.includes(c)))                          return 'Lentes';
  if (['masajeador', 'cepillo', 'plancha', 'faja', 'cinturon'].some(c => k.includes(c))) return 'Salud';
  if (['serum', 'crema', 'mascarilla'].some(c => k.includes(c)))             return 'Belleza';
  if (['auricular', 'cargador'].some(c => k.includes(c)))                    return 'Tecnología';
  if (['lampara', 'humidificador', 'organizador'].some(c => k.includes(c)))  return 'Hogar';
  return 'General';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
