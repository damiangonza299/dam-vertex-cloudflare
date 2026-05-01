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
  const express   = data.express ? ' + EnvÃ­o Express' : '';
  const colorLine = offerInfo.colors?.length
    ? `Colores: ${offerInfo.colors.join(' + ')}`
    : null;
  const lines = [
    'Â¡Hola! Acabo de realizar un pedido en DAM VERTEX y quiero confirmar los detalles:',
    '',
    `Nombre: ${data.name}`,
    `Producto: ${product.name} (${qtyLabel})${express}`,
    ...(colorLine ? [colorLine] : []),
    `Total: ${fmt(offerInfo.total)}`,
    `DirecciÃ³n: ${data.referencia || 'No especificada'}`,
    `Ciudad: ${data.city || 'No especificada'}`,
    `WhatsApp: ${data.phone}`,
    `MÃ©todo de Pago: ${data.payment || 'No especificado'}`,
    '',
    'Â¿Pueden ayudarme a coordinar el envÃ­o?',
  ];
  return encodeURIComponent(lines.join('\n'));
}

function buildCustomOrderWAMsg(product, data, qty, total) {
  const lines = [
    'Â¡Hola! Acabo de realizar un pedido en DAM VERTEX:',
    '',
    `Nombre: ${data.name}`,
    `Producto: ${product.name}`,
    `Cantidad: ${qty} unidades`,
    `Total: ${fmt(total)}`,
    ...(!product.customNoVariants ? [`Colores/variantes: a coordinar por WhatsApp`] : []),
    `DirecciÃ³n: ${data.referencia || 'No especificada'}`,
    `Ciudad: ${data.city || 'No especificada'}`,
    `WhatsApp: ${data.phone}`,
    `MÃ©todo de Pago: ${data.payment || 'No especificado'}`,
    '',
    'Â¿Pueden confirmar el pedido?',
  ];
  return encodeURIComponent(lines.join('\n'));
}

function openWhatsApp(product, data, offerInfo) {
  const msg = buildWAMsg(product, data, offerInfo);
  window.location.href = `https://wa.me/${WA_NUMBER}?text=${msg}`;
}

/* ââ QualifiedLead tracking (evento adicional, no reemplaza existentes) ââ */
DV.trackQualifiedLead = function (product, lead) {
  const event_id = genEventId('ql', product.slug);
  const client   = getClientData();

  fbq('trackCustom', 'QualifiedLead', {
    content_name: product.name,
    content_ids:  [product.slug],
    value:        product.price,
    currency:     'PYG',
  }, { eventID: event_id });

  sendCAPI({
    event_name: 'QualifiedLead',
    event_id,
    product,
    lead,
    client,
  });
};

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
  document.querySelectorAll('[data-scroll-form]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      DV.trackAddToCart(product);
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

  function updateVariantSelectors() {
    const radio = document.querySelector('.offer-options input[name="offer"]:checked');
    const val   = radio?.value || '1';

    if (val === 'custom') {
      if (variantSection)     variantSection.style.display     = 'none';
      if (customOrderSection) customOrderSection.style.display = 'block';
      if (submitBtn)          submitBtn.textContent             = 'Hacer mi pedido por WhatsApp';

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
    if (submitBtn)          submitBtn.textContent             = 'Hacer mi pedido por WhatsApp';

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
        errEl.textContent = 'RevisÃ¡ tu nÃºmero de WhatsApp. PodÃ©s continuar, pero un nÃºmero real ayuda a coordinar el pedido.';
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
    };

    /* ââ Pedido personalizado (4+ unidades, 40% OFF) ââ */
    if (selectedVal === 'custom') {
      const rawQty     = parseInt(document.getElementById('m-custom-qty')?.value || '4');
      const customQty  = Math.max(4, isNaN(rawQty) ? 4 : rawQty);
      const customComp = product.price * customQty;
      const customTotal = Math.round(customComp * 0.60);

      submitBtn.disabled  = true;
      submitBtn.innerHTML = '<span class="spinner"></span>';

      try {
        const client = typeof getClientData === 'function' ? getClientData() : {};
        await fetch('/api/leads', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            product_name: product.name,
            name:         commonData.name,
            phone:        validPhone || rawPhone,
            email:        '',
            city:         commonData.city,
            value:        customTotal,
            currency:     'PYG',
            quantity:     customQty,
            fbp:          client.fbp || '',
            fbc:          client.fbc || '',
            user_agent:   navigator.userAgent,
          }),
        });
      } catch (_) {}

      /* Tracking con value y num_items correctos */
      const capiLead       = { ...commonData, phone: validPhone || '' };
      const customProduct  = { ...product, price: customTotal };
      DV.trackInitiateCheckout(customProduct, capiLead);
      DV.trackContact(product, capiLead);
      DV.trackQualifiedLead(customProduct, capiLead);

      const msg = buildCustomOrderWAMsg(product, commonData, customQty, customTotal);
      modalForm.style.display = 'none';
      success.classList.add('visible');
      setTimeout(() => { window.location.href = `https://wa.me/${WA_NUMBER}?text=${msg}`; }, 400);
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

    const data = { ...commonData, express, product: product.slug };
    const offerInfo = { qty: selectedQty, total: expressTotal, colors: colors.length ? colors : null };

    submitBtn.disabled  = true;
    submitBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const client = typeof getClientData === 'function' ? getClientData() : {};

      /* 1 â Guardar lead */
      const res = await fetch('/api/leads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          product_name: product.name,
          name:         data.name,
          phone:        validPhone || rawPhone,
          email:        '',
          city:         data.city,
          value:        expressTotal,
          currency:     'PYG',
          quantity:     selectedQty,
          fbp:          client.fbp || '',
          fbc:          client.fbc || '',
          user_agent:   navigator.userAgent,
        }),
      });

      if (!res.ok) throw new Error('lead_error');

      /* 2â4 â Tracking (telÃ©fono normalizado o vacÃ­o para CAPI) */
      const capiLead = { ...data, phone: validPhone || '' };
      DV.trackInitiateCheckout(product, capiLead);
      DV.trackContact(product, capiLead);
      DV.trackQualifiedLead(product, capiLead);

      /* 5 â Mostrar Ã©xito */
      modalForm.style.display = 'none';
      success.classList.add('visible');

      /* 6 â Abrir WhatsApp con delay */
      setTimeout(() => openWhatsApp(product, data, offerInfo), 400);

    } catch (_) {
      const capiLead = { ...data, phone: validPhone || '' };
      DV.trackInitiateCheckout(product, capiLead);
      DV.trackContact(product, capiLead);
      DV.trackQualifiedLead(product, capiLead);
      modalForm.style.display = 'none';
      success.classList.add('visible');
      setTimeout(() => openWhatsApp(product, data, offerInfo), 400);
    }
  });
};

function validateModalForm() {
  const nameEl  = document.getElementById('m-name');
  const phoneEl = document.getElementById('m-phone');
  const cityEl  = document.getElementById('m-city');
  const phone   = phoneEl?.value.trim() || '';
  let ok = true;

  clearModalErrors();

  if (!nameEl?.value.trim()) {
    showError(nameEl, 'IngresÃ¡ tu nombre'); ok = false;
  }
  if (!phone) {
    showError(phoneEl, 'El telÃ©fono es obligatorio'); ok = false;
  } else if (!/^[0-9+\s\-]{6,16}$/.test(phone)) {
    showError(phoneEl, 'TelÃ©fono invÃ¡lido'); ok = false;
  }
  if (!cityEl?.value.trim()) {
    showError(cityEl, 'IngresÃ¡ tu ciudad'); ok = false;
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
