/* =========================================================
   Dam Vertex â Form Handler + WhatsApp
   ========================================================= */

const WA_NUMBER = '595993471550';

/* iOS zoom prevention on focus */
document.addEventListener('focusin', function (e) {
  if (window.innerWidth < 768) {
    document.body.style.zoom = '1';
  }
});

function fmt(n) {
  return 'Gs. ' + Number(n).toLocaleString('es-PY');
}

/* Normaliza telÃ©fono Paraguay â 595XXXXXXXXX (12 dÃ­gitos).
   Retorna null si el nÃºmero no es un mÃ³vil Paraguay vÃ¡lido. */
function normalizeParaguayPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  let norm;
  if      (digits.startsWith('595')) norm = digits;
  else if (digits.startsWith('0'))   norm = '595' + digits.slice(1);
  else if (digits.startsWith('9'))   norm = '595' + digits;
  else return null;
  return /^5959\d{8}$/.test(norm) ? norm : null;
}

function buildWAMsg(product, data, offerInfo) {
  const qtyLabel  = `${offerInfo.qty} unidad${offerInfo.qty > 1 ? 'es' : ''}`;
  const express   = data.express ? ' + Envío Express' : '';
  const colorLine = offerInfo.colors?.length
    ? `Colores: ${offerInfo.colors.join(' + ')}`
    : null;
  const lines = [
    '¡Hola! Acabo de realizar un pedido en DAM VERTEX y quiero confirmar los detalles:',
    '',
    `Nombre: ${data.name}`,
    `Producto: ${product.name} (${qtyLabel})${express}`,
    ...(colorLine ? [colorLine] : []),
    `Total: ${fmt(offerInfo.total)}`,
    `Dirección: ${data.referencia || 'No especificada'}`,
    `Ciudad: ${data.city || 'No especificada'}`,
    ...(data.location_maps_url ? [`Ubicación exacta: ${data.location_maps_url}`] : []),
    `WhatsApp: ${data.phone}`,
    `Método de Pago: ${data.payment || 'No especificado'}`,
    '',
    '¿Pueden ayudarme a coordinar el envío?',
  ];
  return encodeURIComponent(lines.join('\n'));
}

function buildCustomOrderWAMsg(product, data, qty, total, colors) {
  const colorLine = colors?.length
    ? `Colores: ${colors.join(' + ')}`
    : (!product.customNoVariants ? 'Colores/variantes: a coordinar por WhatsApp' : null);

  const lines = [
    '¡Hola! Acabo de realizar un pedido en DAM VERTEX:',
    '',
    `Nombre: ${data.name}`,
    `Producto: ${product.name}`,
    `Cantidad: ${qty} unidades`,
    ...(colorLine ? [colorLine] : []),
    `Total: ${fmt(total)}`,
    `Dirección: ${data.referencia || 'No especificada'}`,
    `Ciudad: ${data.city || 'No especificada'}`,
    ...(data.location_maps_url ? [`Ubicación exacta: ${data.location_maps_url}`] : []),
    `WhatsApp: ${data.phone}`,
    `Método de Pago: ${data.payment || 'No especificado'}`,
    '',
    '¿Pueden confirmar el pedido?',
  ];
  return encodeURIComponent(lines.join('\n'));
}

/* ── Stock helpers ── */
async function checkProductStock(slug, qty, variant) {
  try {
    const res = await fetch(`/api/product-stock?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) return { ok: true };

    const data = await res.json();
    if (!data.ok || !data.product) return { ok: true };

    const p = data.product;

if (!p.active) return { ok: false, error: 'Producto no disponible' };

/* Combo 3: si no hay 3 unidades reales en stock total, mostrar mensaje total antes de validar colores */
if (qty === 3 && Array.isArray(variant) && Number(p.stock_total) < 3) {
  return {
    ok: false,
    error: `Solo nos quedan ${Number(p.stock_total)} unidades disponibles en stock.`
  };
}

if (variant && p.variants) {
  const selectedVariants = Array.isArray(variant) ? variant : [variant];

      const requestedByColor = {};
      selectedVariants.forEach(color => {
        if (!color) return;
        requestedByColor[color] = (requestedByColor[color] || 0) + 1;
      });

      for (const color in requestedByColor) {
        const stock = Number(p.variants[color]);

        if (Number.isFinite(stock) && stock === 0) {
          return { ok: false, error: `El color ${color} está agotado.` };
        }
      }

      for (const color in requestedByColor) {
        const requested = requestedByColor[color];
        const stock = Number(p.variants[color]);

        if (Number.isFinite(stock) && requested > stock) {
          const alternatives = [];

          for (const altColor in p.variants) {
            if (altColor === color) continue;

            const altStock = Number(p.variants[altColor]);
            if (Number.isFinite(altStock) && altStock > 0) {
              alternatives.push(`${altStock} unidad${altStock === 1 ? '' : 'es'} en ${altColor}`);
            }
          }

          let error = `Solo ${stock === 1 ? 'queda' : 'quedan'} ${stock} unidad${stock === 1 ? '' : 'es'} disponible${stock === 1 ? '' : 's'} en ${color}.`;

          if (alternatives.length) {
            error += ` Podés cambiar por ${alternatives.join(' y ')}.`;
          }

          return { ok: false, error };
        }
      }
    }

    if (p.stock_total === 0) return { ok: false, error: 'Producto agotado' };
    if (p.stock_total < qty) return { ok: false, error: `Solo quedan ${p.stock_total} unidades disponibles` };

    return { ok: true };
  } catch (_) {
    return { ok: true };
  }
}

function showStockError(msg) {
  let el = document.getElementById('dv-stock-error');
  if (!el) {
    el = document.createElement('div');
    el.id        = 'dv-stock-error';
    el.className = 'modal-stock-error';
    const form = document.getElementById('modal-form');
    if (form) form.insertBefore(el, form.firstChild);
  }
  el.textContent = msg;
  el.style.display = 'block';
}

function clearStockError() {
  const el = document.getElementById('dv-stock-error');
  if (el) el.style.display = 'none';
}

function openWhatsApp(product, data, offerInfo) {
  const msg = buildWAMsg(product, data, offerInfo);
  window.location.href = `https://wa.me/${WA_NUMBER}?text=${msg}`;
}


/* ââ Modal ââ */
function openModal() {
  const overlay = document.getElementById('order-modal');
  if (!overlay) return;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('order-modal');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

/* ââ Form init ââ */
window.DV = window.DV || {};

DV.initForm = function (product) {
  const overlay    = document.getElementById('order-modal');
  const modalForm  = document.getElementById('modal-form');
  const success    = document.getElementById('modal-success');
  const submitBtn  = document.getElementById('modal-submit-btn');
  const confirmCb  = document.getElementById('m-confirm');
  const expressEl  = document.getElementById('m-express');
  const upsellEl   = document.querySelector('.upsell-block');

  if (!overlay || !modalForm) return;
  DV.initCityPicker();
  if (typeof DV.initLocationPicker === 'function') {
    DV.initLocationPicker('m', window.DV_MAPS_KEY || '');
  }


  /* Verificar stock al cargar — deshabilita CTAs si agotado */
  fetch(`/api/product-stock?slug=${encodeURIComponent(product.slug)}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data?.ok || !data.product) return;
      const p = data.product;
      if (!p.active || p.stock_total === 0) {
        const label = !p.active ? 'Producto no disponible' : 'Agotado';
        document.querySelectorAll('[data-scroll-form]').forEach(btn => {
          btn.style.transition = 'none';
          if (btn.tagName === 'A') {
            btn.textContent = label;
            btn.style.opacity = '.4';
            btn.style.pointerEvents = 'none';
            btn.style.cursor = 'not-allowed';
            return;
          }
          /* Stop pulse on cta-ref arrow, update only text span */
          const arrow = btn.querySelector('.cta-ref-arrow');
          if (arrow) arrow.style.animation = 'none';
          const textSpan = btn.querySelector('span:not(.cta-ref-arrow)');
          if (textSpan && arrow) textSpan.textContent = label;
          else btn.textContent = label;
          btn.disabled = true;
          btn.style.opacity = '.5';
          btn.style.cursor = 'not-allowed';
        });
      }
    })
    .catch(() => {});

  const p1price   = product.price;
  const p2compare = product.price * 2;
  const p2real    = Math.round(product.price * 2 * 0.75);
  const p3compare = product.price * 3;
  const p3real    = Math.round(product.price * 3 * 0.65);

  const el1 = document.getElementById('offer-price-1');
  const ec2 = document.getElementById('offer-compare-2');
  const ep2 = document.getElementById('offer-price-2');
  const ec3 = document.getElementById('offer-compare-3');
  const ep3 = document.getElementById('offer-price-3');
  if (el1) el1.textContent = fmt(p1price);
  if (ec2) ec2.textContent = fmt(p2compare);
  if (ep2) ep2.textContent = fmt(p2real);
  if (ec3) ec3.textContent = fmt(p3compare);
  if (ep3) ep3.textContent = fmt(p3real);

  /* Pre-populate custom offer (4 units, 40% OFF) */
  const ccInit = document.getElementById('offer-compare-custom');
  if (ccInit) {
    const c4 = product.price * 4;
    const p4 = Math.round(c4 * 0.60);
    ccInit.textContent = fmt(c4);
    const cpInit = document.getElementById('offer-price-custom');
    const cdInit = document.getElementById('custom-compare-display');
    const pdInit = document.getElementById('custom-price-display');
    if (cpInit) cpInit.textContent = fmt(p4);
    if (cdInit) cdInit.textContent = fmt(c4);
    if (pdInit) pdInit.textContent = fmt(p4);
  }

  /* CTA buttons â abrir modal */
  let _atcFired = false;
  document.querySelectorAll('[data-scroll-form]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!_atcFired) {
        DV.trackAddToCart(product);
        _atcFired = true;
      }
      openModal();
    });
  });

  /* Cerrar modal */
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  /* Offer selection â JS fallback para :has() */
  document.querySelectorAll('.offer-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.offer-option').forEach(opt => opt.classList.remove('selected'));
      radio.closest('.offer-option').classList.add('selected');
    });
  });
  const initSelected = document.querySelector('.offer-option input[type="radio"]:checked');
  if (initSelected) initSelected.closest('.offer-option').classList.add('selected');

  /* Upsell â JS fallback */
  if (expressEl && upsellEl) {
    expressEl.addEventListener('change', () => {
      upsellEl.classList.toggle('checked', expressEl.checked);
    });
  }

  /* Checkbox confirmaciÃ³n */
  if (confirmCb) {
    confirmCb.addEventListener('change', () => {
      const block = document.querySelector('.confirm-intent');
      const msg   = document.querySelector('.confirm-error-msg');
      block?.classList.toggle('checked', confirmCb.checked);
      if (confirmCb.checked) {
        block?.classList.remove('error');
        if (msg) msg.classList.remove('visible');
      }
    });
  }

  /* ââ Variantes de color (cepillo) ââ */
  const variantSection     = document.getElementById('variant-section');
  const variantSelectors   = document.getElementById('variant-selectors');
  const customOrderSection = document.getElementById('custom-order-section');

  function refreshCustomPrices(qty) {
    const compare = product.price * qty;
    const final   = Math.round(compare * 0.60);
    const cc = document.getElementById('offer-compare-custom');
    const cp = document.getElementById('offer-price-custom');
    const cd = document.getElementById('custom-compare-display');
    const pd = document.getElementById('custom-price-display');
    if (cc) cc.textContent = fmt(compare);
    if (cp) cp.textContent = fmt(final);
    if (cd) cd.textContent = fmt(compare);
    if (pd) pd.textContent = fmt(final);
  }
function renderCustomVariantQty(qty) {
  const section = document.getElementById('custom-variant-section');
  const rows    = document.getElementById('custom-variant-rows');

  if (!section || !rows) return;

  if (!product.variants || product.customNoVariants) {
    section.style.display = 'none';
    rows.innerHTML = '';
    return;
  }

  section.style.display = 'block';

  rows.innerHTML = product.variants.options.map(color => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
      <span style="font-size:14px;color:#fff">${color}</span>
      <input
        type="number"
        class="custom-variant-qty"
        data-color="${color}"
        min="0"
        max="${qty}"
        value="0"
        inputmode="numeric"
        style="width:90px;background:#111;border:1px solid var(--border);color:#fff;border-radius:8px;padding:10px;text-align:center">
    </div>
  `).join('');
}

function getCustomVariantColors(customQty) {
  if (!product.variants || product.customNoVariants) {
    return { ok: true, colors: null };
  }

  const inputs = [...document.querySelectorAll('.custom-variant-qty')];
  const colors = [];
  let total = 0;

  inputs.forEach(input => {
    const color = input.dataset.color;
    const qty   = Math.max(0, parseInt(input.value || '0') || 0);

    total += qty;

    for (let i = 0; i < qty; i++) {
      colors.push(color);
    }
  });

  if (total !== customQty) {
    return {
      ok: false,
      error: `Elegí ${customQty} unidades en total. Ahora seleccionaste ${total}.`
    };
  }

  return { ok: true, colors };
}
  function updateVariantSelectors() {
    const radio = document.querySelector('.offer-options input[name="offer"]:checked');
    const val   = radio?.value || '1';

    if (val === 'custom') {
      if (variantSection)     variantSection.style.display     = 'none';
      if (customOrderSection) customOrderSection.style.display = 'block';
      if (submitBtn)          submitBtn.textContent             = 'Confirmar pedido por WhatsApp';

      const customQtyInput = document.getElementById('m-custom-qty');
      const minusBtn       = document.getElementById('m-custom-qty-minus');
      const plusBtn        = document.getElementById('m-custom-qty-plus');
      const qtyDisplay     = document.getElementById('m-custom-qty-display');

      function getQty() {
        return Math.max(4, parseInt(customQtyInput?.value || '4') || 4);
      }
function setQty(n) {
  const v = Math.max(4, n);
  if (customQtyInput) customQtyInput.value = v;
  if (qtyDisplay)     qtyDisplay.textContent = v;
  if (minusBtn)       minusBtn.disabled = v <= 4;
  refreshCustomPrices(v);
  renderCustomVariantQty(v);
}

      setQty(getQty());

      if (customQtyInput && !customQtyInput._dvListenerAttached) {
        customQtyInput._dvListenerAttached = true;
        if (plusBtn)  plusBtn.addEventListener('click',  () => setQty(getQty() + 1));
        if (minusBtn) minusBtn.addEventListener('click', () => { if (getQty() > 4) setQty(getQty() - 1); });
      }
      return;
    }

if (customOrderSection) customOrderSection.style.display = 'none';
const customVariantSection = document.getElementById('custom-variant-section');
if (customVariantSection) customVariantSection.style.display = 'none';
if (submitBtn)          submitBtn.textContent             = 'Confirmar pedido por WhatsApp';

    const qty = parseInt(val) || 1;
    if (!product.variants || !variantSection || !variantSelectors) return;

    variantSection.style.display = 'block';
    variantSelectors.innerHTML   = '';

    for (let i = 1; i <= qty; i++) {
      const group = document.createElement('div');
      group.className = 'form-group';
      if (i > 1) group.style.marginTop = '14px';
      group.innerHTML = `
        <label for="m-color-${i}">${qty === 1 ? 'Color' : `Unidad ${i}`}</label>
        <select id="m-color-${i}" name="color-${i}" class="admin-filter-select" style="width:100%">
          ${product.variants.options.map(o => `<option value="${o}">${o}</option>`).join('')}
        </select>
      `;
      variantSelectors.appendChild(group);
    }
  }

  if (product.variants || document.getElementById('custom-order-section')) {
    updateVariantSelectors();
    document.querySelectorAll('.offer-options input[name="offer"]').forEach(r => {
      r.addEventListener('change', updateVariantSelectors);
    });
  }

  /* ââ Submit ââ */
  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirmCb?.checked) {
      document.querySelector('.confirm-intent')?.classList.add('error');
      const msg = document.querySelector('.confirm-error-msg');
      if (msg) msg.classList.add('visible');
      return;
    }
    if (!validateModalForm()) return;

    /* NormalizaciÃ³n de telÃ©fono Paraguay (no bloquea el envÃ­o) */
    const rawPhone   = document.getElementById('m-phone')?.value.trim() || '';
    const validPhone = normalizeParaguayPhone(rawPhone);
    if (!validPhone) {
      const phoneEl = document.getElementById('m-phone');
      const errEl   = phoneEl?.closest('.form-group')?.querySelector('.form-error-msg');
      if (errEl) {
        errEl.textContent = 'Revisá tu número de WhatsApp. Podés continuar, pero un número real ayuda a coordinar el pedido.';
        errEl.classList.add('visible');
        errEl.style.color = '#f59e0b';
      }
    }

    const selectedRadio = document.querySelector('.offer-options input[name="offer"]:checked');
    const selectedVal   = selectedRadio?.value || '1';

    const commonData = {
      name:       document.getElementById('m-name')?.value.trim() || '',
      phone:      rawPhone,
      city:       document.getElementById('m-city')?.value.trim() || '',
      referencia: document.getElementById('m-ref')?.value.trim() || '',
      payment:    document.getElementById('m-payment')?.value || '',
      location_address:  document.getElementById('m-loc-address')?.value  || '',
      location_city:     document.getElementById('m-loc-city')?.value     || '',
      location_lat:      parseFloat(document.getElementById('m-loc-lat')?.value  || '') || null,
      location_lng:      parseFloat(document.getElementById('m-loc-lng')?.value  || '') || null,
      location_maps_url: document.getElementById('m-loc-maps-url')?.value || '',
      location_place_id: document.getElementById('m-loc-place-id')?.value || '',
    };

    /* ââ Pedido personalizado (4+ unidades, 40% OFF) ââ */
    if (selectedVal === 'custom') {
      const rawQty     = parseInt(document.getElementById('m-custom-qty')?.value || '4');
      const customQty  = Math.max(4, isNaN(rawQty) ? 4 : rawQty);
      const customComp = product.price * customQty;
      const customTotal = Math.round(customComp * 0.60);

/* Leer colores para 4+ si el producto tiene variantes */
const customVariantResult = getCustomVariantColors(customQty);
if (!customVariantResult.ok) {
  showStockError(customVariantResult.error);
  return;
}

const customColors = customVariantResult.colors;

/* Armar URL de WhatsApp antes del primer await — gesture context */
const customWaUrl    = `https://wa.me/${WA_NUMBER}?text=${buildCustomOrderWAMsg(product, commonData, customQty, customTotal, customColors)}`;
const customManualBtn = success?.querySelector('.btn-wa-manual');
if (customManualBtn) customManualBtn.href = customWaUrl;

      submitBtn.disabled  = true;
      submitBtn.innerHTML = '<span class="spinner"></span>';

/* Verificar stock */
const customStockCheck = await checkProductStock(product.slug, customQty, customColors);
if (!customStockCheck.ok) {
  showStockError(customStockCheck.error);
  submitBtn.disabled  = false;
  submitBtn.innerHTML = 'Confirmar pedido por WhatsApp';
  return;
}
clearStockError();

      try {
        const client = typeof getClientData === 'function' ? getClientData() : {};
        const attr   = typeof DV.getAttribution === 'function' ? DV.getAttribution() : {};
        const res = await fetch('/api/leads', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            ...attr,
            product_name:      product.name,
            product_slug:      product.slug,
            name:              commonData.name,
            phone:             validPhone || rawPhone,
            email:             '',
            city:              commonData.city,
            value:             customTotal,
            currency:          'PYG',
            quantity:          customQty,
            variant:           customColors?.length ? JSON.stringify(customColors) : null,
            fbp:               client.fbp || '',
            fbc:               client.fbc || '',
            user_agent:        navigator.userAgent,
            address:           commonData.referencia || null,
            payment_method:    commonData.payment    || null,
            location_address:  commonData.location_address  || null,
            location_city:     commonData.location_city     || null,
            location_lat:      commonData.location_lat      || null,
            location_lng:      commonData.location_lng      || null,
            location_maps_url: commonData.location_maps_url || null,
            location_place_id: commonData.location_place_id || null,
          }),
        });
        if (!res.ok) throw new Error('lead_error');
      } catch (err) {
        if (err?.message !== 'lead_error') console.error('LEAD_SAVE_ERROR', err?.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Confirmar pedido por WhatsApp';
        showStockError('Error al registrar el pedido. Intentá de nuevo.');
        return;
      }

      /* Tracking con value y num_items correctos */
      const capiLead       = { ...commonData, phone: validPhone || '' };
      const customProduct  = { ...product, price: customTotal };
      DV.trackInitiateCheckout(customProduct, capiLead, customQty);

      modalForm.style.display = 'none';
      success.classList.add('visible');
      window.location.href = customWaUrl;
      return;
    }

    /* ââ Pedido normal (1/2/3 unidades) ââ */
    const selectedQty = parseInt(selectedVal) || 1;
    let totalPrice = p1price;
    if (selectedQty === 2) totalPrice = p2real;
    if (selectedQty === 3) totalPrice = p3real;

    const express      = expressEl?.checked || false;
    const expressTotal = express ? totalPrice + 10000 : totalPrice;

    /* Leer colores si hay variantes */
    const colors = [];
    for (let i = 1; i <= selectedQty; i++) {
      const colorEl = document.getElementById(`m-color-${i}`);
      if (colorEl) colors.push(colorEl.value);
    }

/* Variante principal — mismo color en todas las unidades, o nulo si mixto */
const primaryVariant = colors.length > 0 && colors.every(c => c === colors[0]) ? colors[0] : null;

    const data = { ...commonData, express, product: product.slug };
    const offerInfo = { qty: selectedQty, total: expressTotal, colors: colors.length ? colors : null };

/* Armar URL de WhatsApp antes del primer await — gesture context */
const waUrl    = `https://wa.me/${WA_NUMBER}?text=${buildWAMsg(product, data, offerInfo)}`;
const manualBtn = success?.querySelector('.btn-wa-manual');
if (manualBtn) manualBtn.href = waUrl;

    submitBtn.disabled  = true;
    submitBtn.innerHTML = '<span class="spinner"></span>';

/* Verificar stock */
const stockVariant = colors.length > 1 ? colors : primaryVariant;
const stockCheck = await checkProductStock(product.slug, selectedQty, stockVariant);
if (!stockCheck.ok) {
  showStockError(stockCheck.error);
  submitBtn.disabled  = false;
  submitBtn.innerHTML = 'Confirmar pedido por WhatsApp';
  return;
}
clearStockError();

    try {
      const client = typeof getClientData === 'function' ? getClientData() : {};

      /* 1 â Guardar lead */
      const attr   = typeof DV.getAttribution === 'function' ? DV.getAttribution() : {};
      const res = await fetch('/api/leads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...attr,
          product_name:      product.name,
          product_slug:      product.slug,
          name:              data.name,
          phone:             validPhone || rawPhone,
          email:             '',
          city:              data.city,
          value:             expressTotal,
          currency:          'PYG',
          quantity:          selectedQty,
          variant:           colors.length ? JSON.stringify(colors) : null,
          fbp:               client.fbp || '',
          fbc:               client.fbc || '',
          user_agent:        navigator.userAgent,
          address:           data.referencia || null,
          payment_method:    data.payment    || null,
          location_address:  data.location_address  || null,
          location_city:     data.location_city     || null,
          location_lat:      data.location_lat      || null,
          location_lng:      data.location_lng      || null,
          location_maps_url: data.location_maps_url || null,
          location_place_id: data.location_place_id || null,
        }),
      });

      if (!res.ok) {
        console.error('LEAD_SAVE_ERROR', res.status);
        throw new Error('lead_error');
      }

      /* 2â4 â Tracking (telÃ©fono normalizado o vacÃ­o para CAPI) */
      const capiLead = { ...data, phone: validPhone || '' };
      const trackProduct = { ...product, price: expressTotal };
      DV.trackInitiateCheckout(trackProduct, capiLead, selectedQty);

      /* 5 â Mostrar Ã©xito */
      modalForm.style.display = 'none';
      success.classList.add('visible');

      /* 6 â Abrir WhatsApp con delay */
      window.location.href = waUrl;

    } catch (err) {
      if (err?.message !== 'lead_error') console.error('LEAD_SAVE_ERROR', err?.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Confirmar pedido por WhatsApp';
      showStockError('Error al registrar el pedido. Intentá de nuevo.');
    }
  });
};

/* ── City picker ── */
DV.initCityPicker = function () {
  const searchEl   = document.getElementById('m-city-search');
  const dropdownEl = document.getElementById('m-city-dropdown');
  const hiddenEl   = document.getElementById('m-city');
  const manualWrap = document.getElementById('city-manual-wrap');
  const manualEl   = document.getElementById('m-city-manual');
  const groupEl    = document.getElementById('city-group');

  if (!searchEl || !dropdownEl || !hiddenEl) return;
  if (searchEl._dvInit) return;
  searchEl._dvInit = true;

  const CITIES = [
    'Asunción','San Lorenzo','Luque','Fernando de la Mora','Capiatá',
    'Lambaré','Mariano Roque Alonso','Limpio','Ñemby','Villa Elisa',
    'Ciudad del Este','Encarnación',
    'Altos','Areguá','Ayolas','Caacupé','Caaguazú','Caazapá','Cambyretá',
    'Carapeguá','Concepción','Coronel Bogado','Coronel Oviedo','Curuguaty',
    'Eusebio Ayala','Filadelfia','Fuerte Olimpo','Guarambaré','Hernandarias',
    'Itá','Itauguá','J.A. Saldivar','Mariscal Estigarribia','Minga Guazú',
    'Nueva Italia','Paraguarí','Pedro Juan Caballero','Pilar','Piribebuy',
    'Presidente Franco','San Antonio','San Bernardino','San Juan Bautista',
    'San Pedro del Ycuamandyyú','Santa Rita','Salto del Guairá','Tobatí',
    'Vaquería','Villa Hayes','Villarrica','Ybycuí','Ypacaraí','Ypané',
  ];
  const STORAGE_KEY = 'dv_city';

  function clearCityError() {
    searchEl.classList.remove('error');
    if (manualEl) manualEl.classList.remove('error');
    const errEl = groupEl?.querySelector('.form-error-msg');
    if (errEl) errEl.classList.remove('visible');
  }

  function closeDropdown() {
    dropdownEl.innerHTML = '';
    dropdownEl.style.display = 'none';
  }

  function renderDropdown(matches) {
    dropdownEl.innerHTML = '';
    matches.forEach(city => {
      const el = document.createElement('div');
      el.className = 'city-option';
      el.textContent = city;
      el.addEventListener('mousedown', e => { e.preventDefault(); selectCity(city); });
      dropdownEl.appendChild(el);
    });
    const other = document.createElement('div');
    other.className = 'city-option city-option--other';
    other.textContent = 'Otra ciudad';
    other.addEventListener('mousedown', e => { e.preventDefault(); selectOther(); });
    dropdownEl.appendChild(other);
    dropdownEl.style.display = 'block';
  }

  function selectCity(city) {
    searchEl.value = city;
    hiddenEl.value = city;
    closeDropdown();
    if (manualWrap) manualWrap.style.display = 'none';
    if (manualEl)   manualEl.value = '';
    clearCityError();
    try { localStorage.setItem(STORAGE_KEY, city); } catch (_) {}
  }

  function selectOther() {
    searchEl.value = 'Otra ciudad';
    hiddenEl.value = '';
    closeDropdown();
    if (manualWrap) manualWrap.style.display = 'block';
    setTimeout(() => manualEl?.focus(), 50);
  }

  searchEl.addEventListener('focus', () => {
    const q = searchEl.value.trim().toLowerCase();
    renderDropdown(q ? CITIES.filter(c => c.toLowerCase().includes(q)) : CITIES.slice(0, 12));
  });

  searchEl.addEventListener('input', () => {
    clearCityError();
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { closeDropdown(); hiddenEl.value = ''; return; }
    renderDropdown(CITIES.filter(c => c.toLowerCase().includes(q)));
    if (!CITIES.some(c => c.toLowerCase() === q)) hiddenEl.value = '';
  });

  searchEl.addEventListener('blur', () => {
    setTimeout(closeDropdown, 200);
  });

  if (manualEl) {
    manualEl.addEventListener('input', () => {
      const v = manualEl.value.trim();
      hiddenEl.value = v.length >= 2 ? v : '';
      if (v.length >= 2) {
        try { localStorage.setItem(STORAGE_KEY, v); } catch (_) {}
      }
      clearCityError();
    });
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      if (CITIES.includes(saved)) {
        selectCity(saved);
      } else if (saved.length >= 2) {
        searchEl.value = 'Otra ciudad';
        hiddenEl.value = saved;
        if (manualWrap) manualWrap.style.display = 'block';
        if (manualEl)   manualEl.value = saved;
      }
    }
  } catch (_) {}
};

function validateModalForm() {
  const nameEl  = document.getElementById('m-name');
  const phoneEl = document.getElementById('m-phone');
  const cityEl  = document.getElementById('m-city');
  const phone   = phoneEl?.value.trim() || '';
  let ok = true;
  let firstError = null;

  clearModalErrors();

  if (!nameEl?.value.trim()) {
    showError(nameEl, 'Ingresá tu nombre'); ok = false;
    if (!firstError) firstError = nameEl;
  }
  if (!phone) {
    showError(phoneEl, 'El teléfono es obligatorio'); ok = false;
    if (!firstError) firstError = phoneEl;
  } else if (!/^[0-9+\s\-]{6,16}$/.test(phone)) {
    showError(phoneEl, 'Teléfono inválido'); ok = false;
    if (!firstError) firstError = phoneEl;
  }
  const citySearchEl   = document.getElementById('m-city-search');
  const cityManualWrap = document.getElementById('city-manual-wrap');
  const cityManualEl   = document.getElementById('m-city-manual');
  const isManualMode   = cityManualWrap && cityManualWrap.style.display !== 'none';

  if (isManualMode) {
    const v = cityManualEl?.value.trim() || '';
    if (v.length < 2) {
      showError(cityManualEl, v ? 'Escribí al menos 2 caracteres' : 'Escribí tu ciudad');
      ok = false;
      if (!firstError) firstError = cityManualEl;
    }
  } else if (!cityEl?.value) {
    showError(citySearchEl, 'Seleccioná tu ciudad');
    ok = false;
    if (!firstError) firstError = citySearchEl;
  }

  if (!ok && firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return ok;
}

function showError(input, msg) {
  if (!input) return;
  input.classList.add('error');
  const err = input.closest('.form-group')?.querySelector('.form-error-msg');
  if (err) { err.textContent = msg; err.classList.add('visible'); }
}

function clearModalErrors() {
  const form = document.getElementById('modal-form');
  if (!form) return;
  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  form.querySelectorAll('.form-error-msg.visible').forEach(el => el.classList.remove('visible'));
}
