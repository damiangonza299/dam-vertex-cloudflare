/* =========================================================
   Dam Vertex — Form Handler + WhatsApp
   ========================================================= */

const WA_NUMBER = '595993471550';

function fmt(n) {
  return 'Gs. ' + Number(n).toLocaleString('es-PY');
}

function buildWAMsg(product, data, offerInfo) {
  const expressLine = data.express
    ? 'Envío: Express (+10.000 Gs)'
    : 'Envío: Estándar';
  const lines = [
    '¡Hola! Quiero hacer un pedido:',
    '',
    `*${product.name}*`,
    `Cantidad: ${offerInfo.qty} unidad${offerInfo.qty > 1 ? 'es' : ''}`,
    `Total: ${fmt(offerInfo.total)}`,
    '',
    `Nombre: ${data.name}`,
    `Teléfono: ${data.phone}`,
    `Ciudad: ${data.city || 'No especificado'}`,
    data.referencia ? `Referencia: ${data.referencia}` : '',
    `Método de pago: ${data.payment || 'No especificado'}`,
    expressLine,
    '',
    '¿Me confirmás disponibilidad para envío hoy?',
  ].filter(l => l !== '');
  return encodeURIComponent(lines.join('\n'));
}

function openWhatsApp(product, data, offerInfo) {
  const msg = buildWAMsg(product, data, offerInfo);
  const url = `https://wa.me/${WA_NUMBER}?text=${msg}`;
  window.location.href = url;
}

/* ── QualifiedLead tracking (evento adicional, no reemplaza existentes) ── */
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

/* ── Modal ── */
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

/* ── Form init ── */
window.DV = window.DV || {};

DV.initForm = function (product) {
  const overlay   = document.getElementById('order-modal');
  const modalForm = document.getElementById('modal-form');
  const success   = document.getElementById('modal-success');
  const submitBtn = document.getElementById('modal-submit-btn');
  const confirmCb = document.getElementById('m-confirm');
  const expressEl = document.getElementById('m-express');
  const upsellEl  = document.querySelector('.upsell-block');

  if (!overlay || !modalForm) return;

  /* Calcular precios de ofertas basados en el precio del producto */
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

  /* CTA buttons → abrir modal */
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

  /* Offer selection — JS fallback para :has() */
  document.querySelectorAll('.offer-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.offer-option').forEach(opt => opt.classList.remove('selected'));
      radio.closest('.offer-option').classList.add('selected');
    });
  });
  const initSelected = document.querySelector('.offer-option input[type="radio"]:checked');
  if (initSelected) initSelected.closest('.offer-option').classList.add('selected');

  /* Upsell — JS fallback */
  if (expressEl && upsellEl) {
    expressEl.addEventListener('change', () => {
      upsellEl.classList.toggle('checked', expressEl.checked);
    });
  }

  /* Checkbox confirmación → habilitar/deshabilitar botón final */
  if (confirmCb && submitBtn) {
    confirmCb.addEventListener('change', () => {
      submitBtn.disabled = !confirmCb.checked;
      document.querySelector('.confirm-intent')?.classList.toggle('checked', confirmCb.checked);
    });
  }

  /* Submit */
  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirmCb?.checked) return;
    if (!validateModalForm()) return;

    /* Leer oferta seleccionada */
    const selectedQty = parseInt(
      modalForm.querySelector('input[name="offer"]:checked')?.value || '1'
    );
    let totalPrice = p1price;
    if (selectedQty === 2) totalPrice = p2real;
    if (selectedQty === 3) totalPrice = p3real;

    const express      = expressEl?.checked || false;
    const expressTotal = express ? totalPrice + 10000 : totalPrice;

    const data = {
      name:       document.getElementById('m-name')?.value.trim() || '',
      phone:      document.getElementById('m-phone')?.value.trim() || '',
      city:       document.getElementById('m-city')?.value.trim() || '',
      referencia: document.getElementById('m-ref')?.value.trim() || '',
      payment:    document.getElementById('m-payment')?.value || '',
      express,
      product:    product.slug,
    };

    const offerInfo = { qty: selectedQty, total: expressTotal };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const client = typeof getClientData === 'function' ? getClientData() : {};

      /* 1 — Guardar lead */
      const res = await fetch('/api/leads', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          product_name: product.name,
          name:         data.name,
          phone:        data.phone,
          email:        '',
          city:         data.city,
          value:        expressTotal,
          currency:     'PYG',
          fbp:          client.fbp || '',
          fbc:          client.fbc || '',
          user_agent:   navigator.userAgent,
        }),
      });

      if (!res.ok) throw new Error('lead_error');

      /* 2 — InitiateCheckout */
      DV.trackInitiateCheckout(product, data);

      /* 3 — Contact */
      DV.trackContact(product, data);

      /* 4 — QualifiedLead */
      DV.trackQualifiedLead(product, data);

      /* 5 — Mostrar éxito */
      modalForm.style.display = 'none';
      success.classList.add('visible');

      /* 6 — Abrir WhatsApp con delay para que se renderice el mensaje */
      setTimeout(() => openWhatsApp(product, data, offerInfo), 400);

    } catch (_) {
      /* Si falla el lead igual disparamos tracking y abrimos WA */
      DV.trackInitiateCheckout(product, data);
      DV.trackContact(product, data);
      DV.trackQualifiedLead(product, data);
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
    showError(nameEl, 'Ingresá tu nombre'); ok = false;
  }
  if (!phone) {
    showError(phoneEl, 'El teléfono es obligatorio'); ok = false;
  } else if (!/^[0-9+\s\-]{6,16}$/.test(phone)) {
    showError(phoneEl, 'Teléfono inválido'); ok = false;
  }
  if (!cityEl?.value.trim()) {
    showError(cityEl, 'Ingresá tu ciudad'); ok = false;
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
