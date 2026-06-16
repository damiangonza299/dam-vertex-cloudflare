/* =========================================================
   _aliexpress-scanner.js — DAM Product Radar
   Scannea AliExpress para productos con alta demanda global.
   NO es ruta de Cloudflare Pages.

   Estrategia (sin API key):
   1. glosearch/api/product — endpoint JSON interno de AliExpress
   2. Si falla: HTML scraping de búsqueda con extracción de JSON-LD
   3. Si falla: retorno vacío gracioso (el radar sigue operativo con Meta)

   Los candidatos de AliExpress complementan Meta Ads:
   - órdenes globales = señal de demanda probada internacionalmente
   - precio USD = base para estimar margen en Paraguay
   ========================================================= */

const AE_GLOSEARCH = 'https://www.aliexpress.com/glosearch/api/product';
const AE_SEARCH    = 'https://www.aliexpress.com/wholesale';
const MIN_ORDERS   = 50;

// Keywords en inglés (AliExpress es global, inglés tiene más resultados)
const SCAN_KEYWORDS = [
  'smart watch women',
  'crystal bracelet women',
  'led ring light selfie',
  'electric face brush cleaner',
  'hair straightener wireless',
  'tws wireless earbuds',
  'fast wireless charger',
  'vitamin c serum face',
  'face sheet mask collagen',
  'led desk lamp usb',
  'portable humidifier mini',
  'kitchen storage organizer',
  'waist trainer slimming',
  'posture corrector back',
  'nail gel uv lamp',
];

const AE_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Accept':          'application/json, text/html,*/*',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  'Referer':         'https://www.aliexpress.com/',
};

export async function scanAliExpress(env, { dryRun = false } = {}) {
  // Nota: El scraping directo de AliExpress está bloqueado desde IPs de servidor.
  // Para producción: configurar AE_APP_KEY via AliExpress Affiliate API (gratuito).
  // Registro en: https://portals.aliexpress.com/ (aprobación en 1-3 días).
  // Mientras tanto: el scanner intenta igualmente y falla graciosamente.

  const candidates = [];
  const debugLog   = [];

  for (const keyword of SCAN_KEYWORDS) {
    let found = false;

    // Estrategia 1: glosearch JSON API
    try {
      const url = new URL(AE_GLOSEARCH);
      url.searchParams.set('keywords',    keyword);
      url.searchParams.set('SortType',    'total_tranr_asc');
      url.searchParams.set('pageSize',    '20');
      url.searchParams.set('currentPage', '1');

      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12000);
      let res;
      try {
        res = await fetch(url.toString(), { headers: AE_HEADERS, signal: controller.signal });
      } finally {
        clearTimeout(tid);
      }

      if (res.ok) {
        const data = await res.json().catch(() => null);
        const items = extractItemList(data);

        if (items.length > 0) {
          const parsed = parseItems(items, keyword);
          candidates.push(...parsed);
          debugLog.push({ keyword, strategy: 'glosearch', items: items.length, parsed: parsed.length });
          found = true;
        } else {
          debugLog.push({ keyword, strategy: 'glosearch', status: res.status, items: 0, raw_keys: data ? Object.keys(data).slice(0, 8).join(',') : 'null' });
        }
      } else {
        debugLog.push({ keyword, strategy: 'glosearch', status: res.status });
      }
    } catch (err) {
      const label = err.name === 'AbortError' ? 'timeout' : err.message;
      console.warn(`AE_GLOSEARCH_ERROR keyword="${keyword}"`, label);
      debugLog.push({ keyword, strategy: 'glosearch', error: label });
    }

    // Estrategia 2: HTML search + JSON-LD
    if (!found) {
      try {
        const url = new URL(AE_SEARCH);
        url.searchParams.set('SearchText', keyword);
        url.searchParams.set('SortType',   'total_tranr_asc');

        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 12000);
        let res;
        try {
          res = await fetch(url.toString(), {
            headers: { ...AE_HEADERS, 'Accept': 'text/html,application/xhtml+xml' },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(tid);
        }

        if (res.ok) {
          const html    = await res.text();
          const parsed  = parseHtmlProducts(html, keyword);
          if (parsed.length > 0) {
            candidates.push(...parsed);
            found = true;
          }
          const hasRunParams = html.includes('window.runParams');
          const hasLdJson    = html.includes('application/ld+json');
          debugLog.push({ keyword, strategy: 'html', status: res.status, parsed: parsed.length, has_run_params: hasRunParams, has_ld_json: hasLdJson, html_size: html.length });
        } else {
          debugLog.push({ keyword, strategy: 'html', status: res.status });
        }
      } catch (err) {
        const label = err.name === 'AbortError' ? 'timeout' : err.message;
        console.warn(`AE_HTML_ERROR keyword="${keyword}"`, label);
        debugLog.push({ keyword, strategy: 'html', error: label });
      }
    }

    if (!dryRun) await sleep(600);
  }

  return { ok: true, candidates, debug: debugLog };
}

// ── Parsers ────────────────────────────────────────────────────────────────

function extractItemList(data) {
  if (!data) return [];
  return (
    data?.result?.resultList      ||
    data?.resultList               ||
    data?.data?.resultList         ||
    data?.data?.products           ||
    []
  );
}

function parseItems(items, keyword) {
  const results = [];
  for (const raw of items.slice(0, 5)) {
    const item = raw?.item || raw?.productCard || raw || {};

    const title    = String(item.title || item.productTitle || item.name || '').trim();
    const priceRaw = parsePrice(item.salePrice || item.price || item.priceRange || '');
    const orders   = parseOrders(item.tradeDesc || item.orders || item.volume || item.sold || '');
    const rating   = Number(item.starRating || item.averageStar || item.score || 0);
    const image    = String(item.imageUrl || item.mainImageUrl || item.img || '').replace(/^\/\//, 'https://');
    const pid      = String(item.productId || item.itemId || item.id || '');
    const url      = pid ? `https://www.aliexpress.com/item/${pid}.html` : '';

    if (!title || title.length < 4) continue;
    if (orders > 0 && orders < MIN_ORDERS) continue;

    const priceGs = priceRaw > 0 ? Math.round(priceRaw * 7600) : 0;

    results.push({
      source:    'aliexpress',
      source_id: pid ? `ae_${pid}` : `ae_kw_${keyword.replace(/\s+/g, '_')}`,
      source_url: url,
      name:      cleanTitle(title),
      category:  keywordToCategory(keyword),
      image_url: image || null,
      signals: {
        keyword,
        orders_30d: orders,
        price_usd:  priceRaw,
        price_gs:   priceGs,
        rating,
        product_id: pid,
      },
    });
  }
  return results;
}

function parseHtmlProducts(html, keyword) {
  // Buscar JSON-LD product data
  const ldMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const results   = [];

  for (const [, jsonStr] of ldMatches) {
    try {
      const data = JSON.parse(jsonStr.trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] !== 'Product') continue;
        const title    = String(item.name || '').trim();
        const priceRaw = Number(item.offers?.price || item.offers?.lowPrice || 0);
        const image    = String(item.image || (Array.isArray(item.image) ? item.image[0] : '') || '');
        const url      = String(item.url || item.offers?.url || '');
        const rating   = Number(item.aggregateRating?.ratingValue || 0);

        if (!title || title.length < 4) continue;

        const priceGs = priceRaw > 0 ? Math.round(priceRaw * 7600) : 0;

        results.push({
          source:    'aliexpress',
          source_id: `ae_html_${keyword.replace(/\s+/g, '_')}_${results.length}`,
          source_url: url,
          name:      cleanTitle(title),
          category:  keywordToCategory(keyword),
          image_url: image || null,
          signals: {
            keyword,
            orders_30d: 0,
            price_usd:  priceRaw,
            price_gs:   priceGs,
            rating,
            product_id: '',
          },
        });

        if (results.length >= 3) break;
      }
    } catch (_) {}

    if (results.length >= 3) break;
  }

  // Fallback: window.runParams JSON embedding
  if (results.length === 0) {
    const rpMatch = html.match(/window\.runParams\s*=\s*(\{[\s\S]{0,8000}?\});\s*(?:window|var|\n)/);
    if (rpMatch) {
      try {
        const rp    = JSON.parse(rpMatch[1]);
        const items = rp?.data?.result?.resultList || rp?.resultList || [];
        const parsed = parseItems(items, keyword);
        results.push(...parsed.slice(0, 3));
      } catch (_) {}
    }
  }

  return results;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parsePrice(priceVal) {
  if (!priceVal) return 0;
  if (typeof priceVal === 'number') return priceVal;
  const s = String(priceVal?.value || priceVal?.minAmount || priceVal || '');
  const m = s.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

function parseOrders(orderVal) {
  if (!orderVal) return 0;
  const s = String(orderVal).toLowerCase().replace(/,/g, '').replace(/\./g, '');
  const m = s.match(/(\d+)\s*(k|m)?/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  if (m[2] === 'k') return n * 1000;
  if (m[2] === 'm') return n * 1000000;
  return n;
}

function cleanTitle(title) {
  return title
    .replace(/\[.*?\]/g, '')
    .replace(/\([\d\w\s,/-]{1,20}\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function keywordToCategory(kw) {
  const k = kw.toLowerCase();
  if (k.includes('watch'))                                     return 'Relojes';
  if (['bracelet', 'necklace', 'ring', 'earring'].some(c => k.includes(c))) return 'Accesorios';
  if (['ring light', 'led', 'lamp'].some(c => k.includes(c))) return 'Gadgets';
  if (['brush', 'massager', 'posture', 'waist'].some(c => k.includes(c))) return 'Salud';
  if (['serum', 'mask', 'vitamin', 'nail', 'hair', 'face'].some(c => k.includes(c))) return 'Belleza';
  if (['earbuds', 'charger', 'phone', 'wireless'].some(c => k.includes(c))) return 'Tecnología';
  if (['humidifier', 'kitchen', 'organizer', 'storage'].some(c => k.includes(c))) return 'Hogar';
  return 'General';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
