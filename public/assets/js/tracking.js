/* =========================================================
   Dam Vertex — Meta Pixel + CAPI Tracking
   ========================================================= */

const PIXEL_ID = '1502854450830084';

/* ── Pixel loader ── */
(function () {
  if (window.fbq) return;
  var f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
  if (!window._fbq) window._fbq = f;
  f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
  var s = document.createElement('script'); s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
})();

fbq('init', PIXEL_ID);
fbq('track', 'PageView');

/* ── Helpers ── */
function genEventId(prefix, slug) {
  const ts   = Math.floor(Date.now() / 1000);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${slug}_${ts}_${rand}`;
}

function getCookie(name) {
  return (document.cookie.split(';').find(c => c.trim().startsWith(name + '=')) || '').split('=')[1] || '';
}

function getFbc() {
  const existing = getCookie('_fbc');
  if (existing && existing.startsWith('fb.1.')) return existing;

  const fbclid = new URLSearchParams(location.search).get('fbclid');
  if (!fbclid) return '';

  const fbc     = `fb.1.${Date.now()}.${fbclid}`;
  const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `_fbc=${fbc}; path=/; expires=${expires}; SameSite=Lax`;
  return fbc;
}

function getClientData() {
  return {
    fbp:        getCookie('_fbp'),
    fbc:        getFbc(),
    user_agent: navigator.userAgent,
    page_url:   location.href,
  };
}

/* ── CAPI proxy ── */
async function sendCAPI(payload) {
  try {
    await fetch('/api/meta-event', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (_) {}
}

/* ── Public tracking functions ── */

window.DV = window.DV || {};

DV.trackViewContent = function (product) {
  const event_id = genEventId('vc', product.slug);
  const client   = getClientData();

  fbq('track', 'ViewContent', {
    content_name:  product.name,
    content_ids:   [product.slug],
    content_type:  'product',
    value:         product.price,
    currency:      'PYG',
  }, { eventID: event_id });

  sendCAPI({
    event_name:  'ViewContent',
    event_id,
    product,
    client,
    num_items:   1,
  });
};

DV.trackAddToCart = function (product) {
  const event_id = genEventId('atc', product.slug);
  const client   = getClientData();

  fbq('track', 'AddToCart', {
    content_name:  product.name,
    content_ids:   [product.slug],
    content_type:  'product',
    value:         product.price,
    currency:      'PYG',
  }, { eventID: event_id });

  sendCAPI({
    event_name:  'AddToCart',
    event_id,
    product,
    client,
    num_items:   1,
  });

  return event_id;
};

DV.trackInitiateCheckout = function (product, lead, qty) {
  const event_id = genEventId('ic', product.slug);
  const client   = getClientData();

  fbq('track', 'InitiateCheckout', {
    content_name:  product.name,
    content_ids:   [product.slug],
    content_type:  'product',
    value:         product.price,
    currency:      'PYG',
    num_items:     qty || 1,
  }, { eventID: event_id });

  sendCAPI({
    event_name:  'InitiateCheckout',
    event_id,
    product,
    lead,
    client,
    num_items:   qty || 1,
  });

  return event_id;
};

/* ── Attribution capture (interno, no Meta) ── */
(function () {
  const ATTR_KEY = 'dv_attr';
  const params   = new URLSearchParams(location.search);
  const FIELDS   = [
    'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'campaign_id', 'adset_id', 'ad_id', 'campaign_name', 'adset_name', 'ad_name',
  ];
  const hasTracking = FIELDS.some(f => params.get(f));

  try {
    if (hasTracking) {
      const attr = { landing_path: location.pathname + location.search, referrer: document.referrer || '' };
      FIELDS.forEach(f => { const v = params.get(f); if (v) attr[f] = v; });
      sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr));
    } else if (!sessionStorage.getItem(ATTR_KEY)) {
      sessionStorage.setItem(ATTR_KEY, JSON.stringify({
        landing_path: location.pathname,
        referrer:     document.referrer || '',
      }));
    }
  } catch (_) {}
})();

function getAttribution() {
  try { return JSON.parse(sessionStorage.getItem('dv_attr') || 'null') || {}; } catch (_) { return {}; }
}

DV.getAttribution = getAttribution;
