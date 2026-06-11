/* =========================================================
   POST /api/product-research — Research Engine
   Admin auth required: Authorization: Bearer ADMIN_PASSWORD

   Body: { url: string, source_type?: "supplier"|"competitor"|"reference" }

   Fetches the URL server-side (no CORS issues), extracts:
     title, description, features[], specs{}, price_signal
   Returns structured preview for user review — nothing auto-applied to brief.

   Contract is stable: extraction logic may improve (regex → AI) without
   changing the response shape.
   ========================================================= */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const FETCH_TIMEOUT_MS = 10000;
const MAX_BODY_BYTES   = 500_000; /* 500 KB — avoid huge pages */

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!env.ADMIN_PASSWORD || token !== env.ADMIN_PASSWORD.trim()) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let body = {};
  try { body = await request.json(); } catch (_) {}

  const { url, source_type = 'reference' } = body;
  if (!url) return json({ ok: false, error: 'url requerido' }, 400);

  let targetUrl;
  try { targetUrl = new URL(url); } catch (_) {
    return json({ ok: false, error: 'url_invalida' }, 400);
  }
  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return json({ ok: false, error: 'solo_http_https' }, 400);
  }

  /* Fetch with timeout */
  let html = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DAMResearch/1.0)',
        'Accept':     'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (!res.ok) return json({ ok: false, error: `http_${res.status}`, status: res.status }, 400);

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html')) return json({ ok: false, error: 'no_es_html', content_type: ct }, 400);

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      html = new TextDecoder().decode(buf.slice(0, MAX_BODY_BYTES));
    } else {
      html = new TextDecoder().decode(buf);
    }
  } catch (fetchErr) {
    if (fetchErr.name === 'AbortError') return json({ ok: false, error: 'timeout' }, 504);
    return json({ ok: false, error: 'fetch_error', detail: fetchErr.message }, 502);
  }

  const extracted = extractFromHtml(html);

  return json({
    ok: true,
    url,
    source_type,
    fetched_at: new Date().toISOString(),
    extracted,
  });
}

/* ── Extraction engine ── */

function extractFromHtml(html) {
  /* Strip scripts and styles first */
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const title       = extractTag(clean, 'title')                            || extractAttr(clean, 'meta[name="og:title"]', 'content')  || '';
  const h1          = extractTag(clean, 'h1')                               || '';
  const description = extractAttr(clean, 'meta[name="description"]', 'content') || extractAttr(clean, 'meta[property="og:description"]', 'content') || extractFirstParagraph(clean);

  const features   = extractListItems(clean);
  const specs      = extractSpecs(clean);
  const priceSignal = extractPrice(clean);

  return {
    title:       stripTags(title).trim().slice(0, 200),
    h1:          stripTags(h1).trim().slice(0, 200),
    description: stripTags(description).trim().slice(0, 500),
    features:    features.slice(0, 15),
    specs,
    price_signal: priceSignal,
  };
}

function extractTag(html, tag) {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1] : '';
}

function extractAttr(html, selector, attr) {
  /* Simplified: handle meta name/property tags */
  const nameMatch = selector.match(/\[(?:name|property)="([^"]+)"\]/);
  if (!nameMatch) return '';
  const nameVal = nameMatch[1];
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${escapeRe(nameVal)}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${escapeRe(nameVal)}["']`, 'i');
  const m = html.match(re) || html.match(re2);
  return m ? m[1] : '';
}

function extractFirstParagraph(html) {
  const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  for (const p of ps) {
    const text = stripTags(p[1]).trim();
    if (text.length > 30 && text.length < 600) return text;
  }
  return '';
}

function extractListItems(html) {
  const items = [];
  const lists = [...html.matchAll(/<(?:ul|ol)[^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi)];
  for (const list of lists) {
    const lis = [...list[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
    for (const li of lis) {
      const text = stripTags(li[1]).trim().replace(/\s+/g, ' ');
      if (isProductFeature(text)) items.push(text);
    }
    if (items.length >= 20) break;
  }
  return [...new Set(items)];
}

function isProductFeature(text) {
  if (!text || text.length < 15 || text.length > 300) return false;
  if (text.split(/\s+/).length < 3) return false;
  // Navigation breadcrumb separators
  if (/[>|\\]/.test(text)) return false;
  // Comma-separated category lists (e.g., "Jewelry, Eyewear, Watches & Accessories")
  const parts = text.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts.every(p => p.split(/\s+/).length <= 3)) return false;
  return true;
}

function extractSpecs(html) {
  const specs = {};

  /* Table with 2 columns: key | value */
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
  for (const table of tables) {
    const rows = [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
      if (cells.length === 2) {
        const k = stripTags(cells[0][1]).trim();
        const v = stripTags(cells[1][1]).trim();
        if (k && v && k.length < 60 && v.length < 200) specs[k] = v;
      }
    }
    if (Object.keys(specs).length >= 20) break;
  }

  /* Pattern: "Label: Value" in text */
  const SPEC_PATTERNS = [
    /\b(Material|Dimensions?|Dimensiones?|Weight|Peso|Size|Tama[ñn]o|Color|Colores?|Warranty|Garant[íi]a|Battery|Bater[íi]a|Power|Watts?|Voltage|Model|Modelo|SKU|Brand|Marca)\s*:\s*([^\n<]{2,80})/gi,
  ];
  for (const re of SPEC_PATTERNS) {
    const matches = [...html.matchAll(re)];
    for (const m of matches) {
      const k = m[1].trim();
      const v = stripTags(m[2]).trim();
      if (k && v && !specs[k]) specs[k] = v;
    }
  }

  return specs;
}

function extractPrice(html) {
  /* Look for common price patterns — signal only, not parsed */
  const patterns = [
    /\$\s*[\d,]+(?:\.\d{1,2})?/g,
    /USD\s*[\d,]+(?:\.\d{1,2})?/g,
    /Gs\.?\s*[\d,.]+/gi,
    /PYG\s*[\d,]+/gi,
    /[\d,]+(?:\.\d{1,2})?\s*USD/gi,
    /Price[^$\d]*\$?\s*([\d,.]+)/gi,
  ];
  const found = [];
  for (const re of patterns) {
    const matches = [...html.matchAll(re)];
    found.push(...matches.map(m => m[0].trim()));
    if (found.length >= 5) break;
  }
  return found.length ? [...new Set(found)].slice(0, 3).join(' · ') : null;
}

function stripTags(str) {
  return (str || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
