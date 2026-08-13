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
  const match = document.cookie.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(name + '='));
  if (!match) return '';
  return match.slice(name.length + 1);
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

/* ── Lead data hasheado — enriquece el ViewContent de visitas futuras ──
   Solo se persisten hashes SHA-256 irreversibles, nunca el dato real:
   si alguien lee este localStorage (XSS, browser compartido) no obtiene
   PII, solo un hash que ya es exactamente lo que Meta recibiría igual. */
const LEAD_LOCAL_KEY = '_dv_lead';
const LEAD_LOCAL_TTL = 90 * 24 * 60 * 60 * 1000;

async function sha256Hex(str) {
  if (!str) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeForMetaClient(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function normalizePhoneClient(raw) {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('595')) return d.slice(0, 12);
  if (d.startsWith('0'))   return '595' + d.slice(1);
  return '595' + d;
}

async function saveLeadDataLocal(phone, name, email) {
  try {
    const data = { ts: Date.now() };

    const ph = normalizePhoneClient(phone);
    if (ph) data.ph = await sha256Hex(ph);

    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts[0])         data.fn = await sha256Hex(normalizeForMetaClient(parts[0]));
    if (parts.length > 1) data.ln = await sha256Hex(normalizeForMetaClient(parts.slice(1).join(' ')));

    if (email) data.em = await sha256Hex(normalizeForMetaClient(email));

    if (data.ph || data.fn || data.em) localStorage.setItem(LEAD_LOCAL_KEY, JSON.stringify(data));
  } catch (_) {}
}

function getLeadDataLocal() {
  try {
    const raw = localStorage.getItem(LEAD_LOCAL_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.ts || Date.now() - data.ts > LEAD_LOCAL_TTL) {
      localStorage.removeItem(LEAD_LOCAL_KEY);
      return null;
    }
    return data;
  } catch (_) { return null; }
}

/* ── ID anónimo de visita — external_id para ViewContent/AddToCart/InitiateCheckout ──
   Estos 3 eventos se disparan ANTES de que el usuario llene el formulario, así que
   no hay teléfono/nombre disponibles todavía. Un ID aleatorio persistente por
   navegador (no PII, nunca se reusa como identificador visible) le da a Meta un
   external_id estable para emparejar esas visitas — mejora el match quality que
   Meta señaló como bajo. Se hashea con SHA-256 antes de salir del cliente, igual
   que el resto de los campos de user_data. */
const ANON_ID_KEY = '_dv_anon_id';

function getOrCreateAnonId() {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch (_) { return null; }
}

async function getExternalIdHashed() {
  const id = getOrCreateAnonId();
  if (!id) return null;
  return sha256Hex(id);
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
  const event_id  = genEventId('vc', product.slug);
  const client    = getClientData();
  const leadHashed = getLeadDataLocal();

  fbq('track', 'ViewContent', {
    content_name:  product.name,
    content_ids:   [product.slug],
    content_type:  'product',
    value:         product.price,
    currency:      'PYG',
  }, { eventID: event_id });

  getExternalIdHashed().catch(() => null).then(external_id_hashed => {
    sendCAPI({
      event_name:  'ViewContent',
      event_id,
      product,
      client,
      lead_hashed: leadHashed || undefined,
      external_id_hashed: external_id_hashed || undefined,
      num_items:   1,
    });
  });
};

DV.trackAddToCart = function (product, lead_hashed) {
  const event_id = genEventId('atc', product.slug);
  const client   = getClientData();

  fbq('track', 'AddToCart', {
    content_name:  product.name,
    content_ids:   [product.slug],
    content_type:  'product',
    value:         product.price,
    currency:      'PYG',
  }, { eventID: event_id });

  getExternalIdHashed().catch(() => null).then(external_id_hashed => {
    sendCAPI({
      event_name:  'AddToCart',
      event_id,
      product,
      client,
      lead_hashed: lead_hashed || undefined,
      external_id_hashed: external_id_hashed || undefined,
      num_items:   1,
    });
  });

  return event_id;
};

DV.trackInitiateCheckout = function (product, lead_hashed, qty) {
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

  getExternalIdHashed().catch(() => null).then(external_id_hashed => {
    sendCAPI({
      event_name:  'InitiateCheckout',
      event_id,
      product,
      lead_hashed: lead_hashed || undefined,
      external_id_hashed: external_id_hashed || undefined,
      client,
      num_items:   qty || 1,
    });
  });

  return event_id;
};

/* ── Attribution capture — localStorage con TTL 7 días + smart merge ── */
(function () {
  const ATTR_KEY = 'dv_attr';
  const ATTR_TTL = 7 * 24 * 60 * 60 * 1000;
  const params   = new URLSearchParams(location.search);
  const FIELDS   = [
    'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'campaign_id', 'adset_id', 'ad_id', 'campaign_name', 'adset_name', 'ad_name',
  ];

  function saveAttr(data) {
    try { localStorage.setItem(ATTR_KEY, JSON.stringify({ ...data, _ts: Date.now() })); } catch (_) {}
  }

  function loadAttr() {
    try {
      const raw = localStorage.getItem(ATTR_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj._ts && Date.now() - obj._ts > ATTR_TTL) { localStorage.removeItem(ATTR_KEY); return null; }
      const copy = Object.assign({}, obj);
      delete copy._ts;
      return copy;
    } catch (_) { return null; }
  }

  /* Migración única: sessionStorage → localStorage para usuarios con datos previos */
  try {
    const old = sessionStorage.getItem(ATTR_KEY);
    if (old && !localStorage.getItem(ATTR_KEY)) {
      saveAttr(JSON.parse(old));
      sessionStorage.removeItem(ATTR_KEY);
    }
  } catch (_) {}

  const hasTracking = FIELDS.some(f => params.get(f));

  try {
    if (hasTracking) {
      const incoming = { landing_path: location.pathname + location.search, referrer: document.referrer || '' };
      FIELDS.forEach(f => { const v = params.get(f); if (v) incoming[f] = v; });

      /* Smart merge: incoming sobreescribe solo los campos que trae.
         Los campos del existing que NO llegaron (ej. campaign_id de click previo)
         se preservan — evita perder attribution cuando el usuario regresa sin UTMs. */
      const existing = loadAttr() || {};
      const merged   = Object.assign({}, existing);
      Object.keys(incoming).forEach(function(k) { if (incoming[k]) merged[k] = incoming[k]; });
      saveAttr(merged);
    } else if (!loadAttr()) {
      saveAttr({ landing_path: location.pathname, referrer: document.referrer || '' });
    }
  } catch (_) {}
})();

function getAttribution() {
  try {
    const raw = localStorage.getItem('dv_attr');
    if (!raw) return {};
    const obj = JSON.parse(raw);
    delete obj._ts;
    return obj;
  } catch (_) { return {}; }
}

DV.getAttribution   = getAttribution;
DV.getOrCreateAnonId = getOrCreateAnonId;
DV.saveLeadDataLocal = saveLeadDataLocal;
DV.getLeadDataLocal  = getLeadDataLocal;
