/* =========================================================
   _radar-scorer.js — DAM Product Radar
   Módulo compartido de scoring de oportunidad de producto.
   Importado por scan.js. NO es ruta de Cloudflare Pages.

   Scoring (0-100):
     A. Demanda comprobada  — 35 pts
     B. Fit Paraguay        — 25 pts
     C. Competencia PY      — 20 pts
     D. Logística           — 10 pts
     E. Margen potencial    — 10 pts
   ========================================================= */

const HIGH_FIT_CATEGORIES = [
  'accesorios', 'joyeria', 'reloj', 'pulsera', 'collar', 'anillo', 'aretes',
  'gafas', 'lentes', 'bolso', 'cartera',
  'belleza', 'cuidado personal', 'crema', 'serum', 'mascarilla', 'maquillaje',
  'salud', 'masajeador', 'cepillo', 'fitness',
  'gadget', 'electronica', 'funda', 'audifonos', 'cargador', 'lampara', 'led',
  'cocina', 'hogar', 'organizador',
  // English (AliExpress)
  'jewelry', 'accessories', 'watch', 'bracelet', 'necklace', 'ring', 'earring',
  'sunglasses', 'bag', 'purse',
  'beauty', 'skin care', 'serum', 'mask', 'makeup',
  'health', 'massager', 'toothbrush', 'hair',
  'gadget', 'electronics', 'case', 'earbuds', 'charger', 'lamp', 'light',
  'kitchen', 'home', 'organizer',
];

const LOW_FIT_CATEGORIES = [
  'mueble', 'sofa', 'colchon', 'refrigerador', 'heladera', 'lavadora',
  'electrodomestico', 'televisor', 'industrial', 'automotriz', 'neumatico',
  'alimento', 'perecedero', 'medicamento', 'farmaceutico',
  'furniture', 'mattress', 'refrigerator', 'washing machine', 'industrial',
  'automotive', 'tire', 'food', 'perishable', 'medicine', 'pharmaceutical',
];

const EASY_SHIP_KEYWORDS = [
  'pulsera', 'collar', 'anillo', 'reloj', 'gafas', 'lentes',
  'funda', 'cargador', 'audifonos', 'cable', 'clip',
  'brocha', 'crema', 'serum', 'mascarilla', 'pintura',
  'lampara', 'luz', 'sticker', 'tarjeta',
  // English
  'bracelet', 'necklace', 'ring', 'watch', 'sunglasses',
  'case', 'charger', 'earbuds', 'cable', 'clip',
  'brush', 'cream', 'serum', 'mask', 'nail',
  'lamp', 'light', 'sticker',
];

const HARD_SHIP_KEYWORDS = [
  'sofa', 'colchon', 'televisor', 'refrigerador', 'lavadora', 'mueble',
  'sofa', 'mattress', 'television', 'refrigerator', 'appliance', 'furniture',
];

const PY_PRICE_MIN_GS = 50_000;
const PY_PRICE_MAX_GS = 380_000;

export function scoreCandidate(candidate) {
  const { source = '', signals = {}, name = '', category = '' } = candidate;
  const bd = {};
  let total = 0;

  // ── A. Demanda comprobada (0-35) ──────────────────────────────────────────
  let demand = 0;

  if (source === 'meta_ads_library') {
    const spendHigh = Number(signals.spend_upper || signals.spend_lower || 0);
    const numAds    = Number(signals.num_ads || 1);
    // Spend en USD (Meta reporta en USD independiente del mercado)
    if (spendHigh >= 1000)     demand += 20;
    else if (spendHigh >= 500) demand += 15;
    else if (spendHigh >= 100) demand += 9;
    else if (spendHigh >= 50)  demand += 5;
    else                       demand += 2;

    if (numAds >= 15)      demand += 15;
    else if (numAds >= 8)  demand += 11;
    else if (numAds >= 4)  demand += 7;
    else if (numAds >= 2)  demand += 4;
    else                   demand += 1;

  } else if (source === 'aliexpress') {
    const orders = Number(signals.orders_30d || signals.volume || 0);
    if (orders >= 5000)      demand = 35;
    else if (orders >= 2000) demand = 28;
    else if (orders >= 1000) demand = 22;
    else if (orders >= 500)  demand = 15;
    else if (orders >= 100)  demand = 8;
    else                     demand = 2;

  } else if (source === 'double_signal') {
    const spendScore  = Math.min(18, Math.round(Number(signals.spend_upper || 0) / 60));
    const orderScore  = Math.min(17, Math.round(Number(signals.orders_30d  || 0) / 150));
    demand = Math.min(35, spendScore + orderScore + 8);
  }

  bd.demand = Math.min(35, Math.max(0, demand));
  total += bd.demand;

  // ── B. Fit Paraguay (0-25) ────────────────────────────────────────────────
  let fit = 0;
  const priceGs      = Number(signals.price_gs || 0);
  const categoryStr  = (category || signals.category || '').toLowerCase();
  const nameStr      = name.toLowerCase();
  const combinedText = `${categoryStr} ${nameStr}`;

  if (priceGs > 0) {
    if (priceGs >= PY_PRICE_MIN_GS && priceGs <= PY_PRICE_MAX_GS) fit += 15;
    else if (priceGs < PY_PRICE_MIN_GS)                           fit += 4;
    else                                                           fit += 2;
  } else {
    fit += 7; // precio desconocido → neutro favorable
  }

  const isHighFit = HIGH_FIT_CATEGORIES.some(c => combinedText.includes(c));
  const isLowFit  = LOW_FIT_CATEGORIES.some(c => combinedText.includes(c));
  if (isHighFit)      fit += 10;
  else if (isLowFit)  fit  = Math.max(0, fit - 10);
  else                fit  += 2;

  bd.fit_py = Math.min(25, Math.max(0, fit));
  total += bd.fit_py;

  // ── C. Competencia PY (0-20) ──────────────────────────────────────────────
  let comp = 0;
  const numAdv = Number(signals.num_advertisers || signals.num_ads || 1);

  if (source === 'meta_ads_library' || source === 'double_signal') {
    // Pocos anunciantes = oportunidad temprana
    if (numAdv === 1)       comp = 20;
    else if (numAdv <= 3)   comp = 16;
    else if (numAdv <= 7)   comp = 11;
    else if (numAdv <= 15)  comp = 6;
    else                    comp = 2;
  } else {
    // AliExpress: rating como proxy inverso de madurez del mercado
    const rating = Number(signals.rating || 4.0);
    if (rating >= 4.8)      comp = 6;  // muy establecido → alta competencia
    else if (rating >= 4.5) comp = 12;
    else if (rating >= 4.0) comp = 17;
    else                    comp = 20; // rating bajo = mercado poco maduro
  }

  bd.competition_py = Math.min(20, Math.max(0, comp));
  total += bd.competition_py;

  // ── D. Logística (0-10) ───────────────────────────────────────────────────
  let logi = 5;
  if (HARD_SHIP_KEYWORDS.some(k => nameStr.includes(k)))  logi = 0;
  else if (EASY_SHIP_KEYWORDS.some(k => nameStr.includes(k))) logi = 10;

  bd.logistics = Math.min(10, Math.max(0, logi));
  total += bd.logistics;

  // ── E. Margen potencial (0-10) ────────────────────────────────────────────
  let margin = 5;
  const priceUsd = Number(signals.price_usd || 0);
  const USD_TO_GS = 7600;

  if (priceUsd > 0 && priceGs > 0) {
    const costGs  = priceUsd * USD_TO_GS;
    const marginR = (priceGs - costGs) / priceGs;
    if (marginR >= 0.65)      margin = 10;
    else if (marginR >= 0.50) margin = 8;
    else if (marginR >= 0.35) margin = 5;
    else if (marginR >= 0.20) margin = 3;
    else                      margin = 1;
  }

  bd.margin = Math.min(10, Math.max(0, margin));
  total += bd.margin;

  // ── Resultado ─────────────────────────────────────────────────────────────
  const opportunity_score = Math.min(100, Math.max(0, total));

  let action_recommended;
  if (opportunity_score >= 80)      action_recommended = 'PEDIR_MUESTRA';
  else if (opportunity_score >= 70) action_recommended = 'INVESTIGAR_PROVEEDOR';
  else if (opportunity_score >= 60) action_recommended = 'ANALIZAR_COMPETENCIA';
  else                              action_recommended = 'MONITOREAR';

  return { opportunity_score, score_breakdown: bd, action_recommended };
}

export function normalizeProductName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function nameHash(str) {
  const normalized = normalizeProductName(str);
  const data = new TextEncoder().encode(normalized);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}
