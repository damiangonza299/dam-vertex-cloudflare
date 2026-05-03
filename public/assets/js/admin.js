/* =========================================================
   Dam Vertex — Admin Panel
   ========================================================= */

const IS_DELIVERY = new URLSearchParams(location.search).get('mode') === 'delivery';

/* ── Token persistence — 30 days ── */
const TOKEN_KEY  = IS_DELIVERY ? 'dv_delivery_token' : 'dv_admin_token';
const TOKEN_TS   = IS_DELIVERY ? 'dv_delivery_ts'    : 'dv_admin_ts';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function loadToken() {
  const ts = parseInt(localStorage.getItem(TOKEN_TS) || '0');
  if (Date.now() - ts > MAX_AGE_MS) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_TS);
    return '';
  }
  return localStorage.getItem(TOKEN_KEY) || '';
}

function saveToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(TOKEN_TS, String(Date.now()));
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_TS);
}

let AUTH_TOKEN       = loadToken();
let allLeads         = [];
let activeDateFilter = 'all';

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
if (IS_DELIVERY) {
  const h1 = document.querySelector('.admin-nav h1');
  if (h1) h1.textContent = 'DAM VERTEX — Modo Delivery';

  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) exportBtn.style.display = 'none';

  // 🔒 Bloquear edición en productos (solo visual)
  const observer = new MutationObserver(() => {
    const productInputs = document.querySelectorAll(
      '[data-tab-content="products"] input, [data-tab-content="products"] select, [data-tab-content="products"] textarea'
    );

    productInputs.forEach(el => {
      el.disabled = true;
    });

    const productButtons = document.querySelectorAll(
      '[data-tab-content="products"] button'
    );

    productButtons.forEach(btn => {
      const text = btn.textContent.toLowerCase();

      if (
        text.includes('guardar') ||
        text.includes('crear') ||
        text.includes('editar') ||
        text.includes('eliminar')
      ) {
        btn.style.display = 'none';
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
  const dp = document.getElementById('date-picker');
  if (dp) dp.value = new Date().toLocaleDateString('sv-SE');

  if (AUTH_TOKEN) {
    showPanel();
    loadLeads();
  } else {
    showLogin();
  }
});

/* ── Login ── */
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('panel-screen').style.display  = 'none';
}

function showPanel() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('panel-screen').style.display  = 'block';
}

document.getElementById('login-btn')?.addEventListener('click', async () => {
  const pw  = document.getElementById('login-password').value;
  const err = document.getElementById('login-err');
  if (!pw) return;

  const res = await fetch('/api/admin-leads', {
    headers: { 'Authorization': `Bearer ${pw}` },
  });

  if (res.ok) {
    AUTH_TOKEN = pw;
    saveToken(pw);
    showPanel();
    const data = await res.json();
    renderLeads(data.leads || []);
  } else {
    err.classList.add('visible');
    err.textContent = 'Contraseña incorrecta';
  }
});

document.getElementById('login-password')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-btn')?.click();
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
  clearToken();
  AUTH_TOKEN = '';
  location.reload();
});

/* ── Load leads ── */
async function loadLeads() {
  try {
    const res = await fetch('/api/admin-leads', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
    });
    if (res.status === 401) { clearToken(); location.reload(); return; }
    const data = await res.json();
    renderLeads(data.leads || []);
  } catch (_) {}
}

/* ── Render ── */
function renderLeads(leads) {
  allLeads = leads;
  updateStats(leads);
  applyFilters();
}

function updateStats(leads) {
  const pending   = leads.filter(l => l.status === 'pending').length;
  const purchased = leads.filter(l => l.status === 'purchased').length;
  const total     = leads.length;

  document.getElementById('stat-total').textContent     = total;
  document.getElementById('stat-pending').textContent   = pending;
  document.getElementById('stat-purchased').textContent = purchased;
}

function applyFilters() {
  const q       = (document.getElementById('search-input')?.value || '').toLowerCase();
  const product = document.getElementById('filter-product')?.value || '';
  const status  = document.getElementById('filter-status')?.value  || '';

  const todayStr = new Date().toLocaleDateString('sv-SE');
  const yestStr  = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE');

  const filtered = allLeads.filter(l => {
    const matchQ = !q
      || l.name?.toLowerCase().includes(q)
      || l.phone?.includes(q)
      || l.city?.toLowerCase().includes(q);
    const matchProd   = !product || l.product_name === product;
    const matchStatus = !status  || l.status === status;

    let matchDate = true;
    if (activeDateFilter !== 'all') {
      const leadDate = l.created_at
        ? new Date(l.created_at + 'Z').toLocaleDateString('sv-SE')
        : '';
      if (!leadDate) {
        matchDate = false;
      } else if (activeDateFilter === 'today') {
        matchDate = leadDate === todayStr;
      } else if (activeDateFilter === 'yesterday') {
        matchDate = leadDate === yestStr;
      } else {
        matchDate = leadDate === activeDateFilter;
      }
    }

    return matchQ && matchProd && matchStatus && matchDate;
  });

  renderTable(filtered);
}

function setDateFilter(val) {
  activeDateFilter = val;
  ['date-all', 'date-today', 'date-yesterday'].forEach(id => {
    const key = id.slice(5); // remove 'date-' prefix
    document.getElementById(id)?.classList.toggle('date-btn--active', val === key);
  });
  if (['all', 'today', 'yesterday'].includes(val)) {
    const dp = document.getElementById('date-picker');
    if (dp) dp.value = '';
  }
  applyFilters();
}

document.getElementById('search-input')?.addEventListener('input', applyFilters);
document.getElementById('filter-product')?.addEventListener('change', applyFilters);
document.getElementById('filter-status')?.addEventListener('change', applyFilters);
document.getElementById('refresh-btn')?.addEventListener('click', loadLeads);
document.getElementById('export-csv-btn')?.addEventListener('click', exportCSV);
document.querySelector('.admin-table-wrap')?.addEventListener('scroll', closeMenus);
document.getElementById('date-all')?.addEventListener('click', () => setDateFilter('all'));
document.getElementById('date-today')?.addEventListener('click', () => setDateFilter('today'));
document.getElementById('date-yesterday')?.addEventListener('click', () => setDateFilter('yesterday'));
document.getElementById('date-picker')?.addEventListener('change', e => { setDateFilter(e.target.value || 'all'); });

function abbrevProduct(name) {
  if (!name) return '—';
  if (name.includes('Cepillo')) return 'Cepillo';
  if (name.includes('Lentes'))  return 'Lentes';
  if (name.includes('Reloj'))   return 'Reloj';
  return name.length > 10 ? name.slice(0, 10) + '...' : name;
}

function buildActions(l) {
  const canConfirm = l.status !== 'purchased';

  if (IS_DELIVERY) {
    if (!canConfirm) return '<span class="act-done">&#10003;</span>';
    return `<button class="btn-confirm btn-icon" onclick="confirmPurchase(${l.id})" title="Confirmar pago">&#10003;</button>`;
  }

  const confirmBtn = canConfirm
    ? `<button class="btn-confirm btn-icon" onclick="confirmPurchase(${l.id})" title="Confirmar pago">&#10003;</button>`
    : '<span class="act-done">&#10003;</span>';

  const menuId = `menu-${l.id}`;
  return `<div class="actions-cell">
    ${confirmBtn}
    <button class="btn-menu" onclick="toggleMenu(event,this,'${menuId}')">&#8942;</button>
    <div class="action-menu" id="${menuId}">
      <button onclick="cancelLead(${l.id});closeMenus()">Cancelar pedido</button>
      <button class="danger" onclick="deleteLead(${l.id});closeMenus()">Eliminar</button>
    </div>
  </div>`;
}

function renderTable(leads) {
  const tbody = document.getElementById('leads-tbody');
  if (!tbody) return;

  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Sin resultados</td></tr>`;
    return;
  }

  const compact = window.innerWidth <= 700;

  tbody.innerHTML = leads.map((l, i) => `
    <tr data-id="${l.id}">
      <td class="col-num">${i + 1}</td>
      <td class="col-name" title="${esc(l.name)}">${shortName(l.name)}</td>
      <td class="col-phone">${esc(l.phone)}</td>
      <td class="col-city" title="${esc(l.city || '')}">${esc(l.city || '—')}</td>
      <td class="col-prod" title="${esc(l.product_name)}">${esc(abbrevProduct(l.product_name))}</td>
      <td class="col-val">${Number(l.value || 0).toLocaleString('es-PY')}</td>
      <td class="col-status"><span class="badge badge-${l.status}">${labelStatus(l.status)}</span></td>
      <td class="col-date">${fmtDateShort(l.created_at)}</td>
      <td class="col-actions">${buildActions(l)}</td>
    </tr>
  `).join('');
}

/* ── Overflow menu ── */
function toggleMenu(e, btn, menuId) {
  e.stopPropagation();
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const wasOpen = menu.classList.contains('open');
  closeMenus();
  if (!wasOpen) {
    const rect = btn.getBoundingClientRect();
    menu.style.top   = (rect.bottom + window.scrollY + 4) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.classList.add('open');
  }
}

function closeMenus() {
  document.querySelectorAll('.action-menu.open').forEach(m => m.classList.remove('open'));
}

document.addEventListener('click', closeMenus);

/* ── Confirm purchase ── */
async function confirmPurchase(id) {
  if (!confirm(`¿Confirmar compra para lead #${id}? Esto enviará el evento Purchase a Meta.`)) return;

  const row  = document.querySelector(`tr[data-id="${id}"]`);
  const lead = allLeads.find(l => l.id === id);
  if (row) row.style.opacity = '.5';

  try {
    /* Si el lead estaba cancelado, restaurar a pending primero */
    if (lead?.status === 'cancelled') {
      const patch = await fetch('/api/admin-leads', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
        body:    JSON.stringify({ id, status: 'pending' }),
      });
      if (!patch.ok) throw new Error('restore_failed');
    }

    const res  = await fetch('/api/confirm-purchase', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body:    JSON.stringify({ id }),
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      alert(`✓ Compra confirmada para ${data.name}.`);
      loadLeads();
    } else {
      alert('Error: ' + (data.error || 'desconocido'));
      if (row) row.style.opacity = '1';
    }
  } catch (_) {
    alert('Error de red');
    if (row) row.style.opacity = '1';
  }
}

/* ── Cancel lead ── */
async function cancelLead(id) {
  if (!confirm(`¿Cancelar lead #${id}?`)) return;

  try {
    const res  = await fetch('/api/admin-leads', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body:    JSON.stringify({ id, status: 'cancelled' }),
    });

    if (res.ok) {
      loadLeads();
    } else {
      const data = await res.json().catch(() => ({}));
      alert('Error al cancelar: ' + (data.error || res.status));
    }
  } catch (_) {
    alert('Error de red');
  }
}

/* ── Delete lead ── */
async function deleteLead(id) {
  if (!confirm(`¿Eliminar lead #${id}?`)) return;
  if (!confirm(`Confirmar: ¿eliminar definitivamente #${id}? Esta acción no se puede deshacer.`)) return;

  try {
    const res  = await fetch(`/api/admin-leads?id=${id}`, {
      method:  'DELETE',
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
    });

    if (res.ok) {
      loadLeads();
    } else {
      const data = await res.json().catch(() => ({}));
      alert('Error al eliminar: ' + (data.error || res.status));
    }
  } catch (_) {
    alert('Error de red');
  }
}

/* ── Export CSV ── */
function normalizePhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  let norm;
  if      (digits.startsWith('595')) norm = digits;
  else if (digits.startsWith('0'))   norm = '595' + digits.slice(1);
  else if (digits.startsWith('9'))   norm = '595' + digits;
  else return '';
  return /^5959\d{8}$/.test(norm) ? norm : '';
}

function exportCSV() {
  const leads = allLeads;
  if (!leads.length) { alert('No hay leads para exportar'); return; }

  const header = 'phone,normalized_phone,first_name,last_name,city,product,value,status,created_at';

  const rows = leads.map(l => {
    const parts     = (l.name || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName  = parts.slice(1).join(' ') || '';
    const normPhone = normalizePhone(l.phone);
    return [
      l.phone,
      normPhone,
      firstName,
      lastName,
      l.city || '',
      l.product_name,
      l.value || 0,
      l.status,
      l.created_at,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv  = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Formatters ── */
function fmtDateShort(s) {
  if (!s) return '—';
  const d      = new Date(s + 'Z');
  const local  = d.toLocaleDateString('sv-SE');
  const today  = new Date().toLocaleDateString('sv-SE');
  const yest   = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE');
  if (local === today) return 'Hoy';
  if (local === yest)  return 'Ayer';
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return d.getDate() + ' ' + months[d.getMonth()];
}

function fmtCompact(n) {
  const v = Number(n || 0);
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (v >= 1000)    return Math.round(v / 1000) + 'k';
  return String(v);
}
function fmt(n)    { return 'Gs. ' + Number(n || 0).toLocaleString('es-PY'); }
function esc(s)    { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function shortName(s) {
  const parts = (s || '').trim().split(/\s+/);
  if (parts.length <= 2) return esc(s);
  return esc(parts[0] + ' ' + parts[parts.length - 1]);
}
function fmtDate(s){ return s ? new Date(s + 'Z').toLocaleString('es-PY', { day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit' }) : '—'; }
function labelStatus(s, short = false) {
  if (short) return { pending: 'Pend.', purchased: 'Pagado', cancelled: 'Canc.' }[s] || s;
  return { pending: 'Pendiente', purchased: 'Comprado', cancelled: 'Cancelado' }[s] || s;
}

/* ── Admin tab navigation ── */
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.toggle('admin-tab--active', t.dataset.tab === tab);
  });
  const leadsSection    = document.getElementById('leads-section');
  const productsSection = document.getElementById('products-section');
  if (tab === 'leads') {
    if (leadsSection)    leadsSection.style.display    = '';
    if (productsSection) productsSection.style.display = 'none';
  } else {
    if (leadsSection)    leadsSection.style.display    = 'none';
    if (productsSection) productsSection.style.display = '';
    loadProducts();
  }
}

document.getElementById('refresh-products-btn')?.addEventListener('click', loadProducts);

/* ── Products / Stock management ── */
let allProducts = [];

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (grid) grid.innerHTML = '<p style="color:var(--muted);padding:20px 0">Cargando...</p>';
  try {
    const res = await fetch('/api/product-stock', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
    });
    const data = await res.json();
    allProducts = data.products || [];
    renderProducts();
  } catch (_) {
    if (grid) grid.innerHTML = '<p style="color:var(--red);padding:20px 0">Error al cargar productos</p>';
  }
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  if (!allProducts.length) {
    grid.innerHTML = '<p style="color:var(--muted);padding:20px 0">Sin productos configurados en la base de datos.<br>Ejecutá la migración: <code>wrangler d1 execute dam-vertex-leads --file=migrate.sql</code></p>';
    return;
  }

  grid.innerHTML = allProducts.map(p => {
    const stockBadge = p.stock_total === 0
      ? '<span class="badge badge-cancelled">Agotado</span>'
      : `<span class="badge badge-purchased">${p.stock_total} en stock</span>`;

    const variantRows = p.variants
      ? Object.entries(p.variants).map(([color, qty]) => `
          <div class="stock-row">
            <span class="stock-color">${esc(color)}</span>
            ${IS_DELIVERY
              ? `<span class="stock-qty">${qty}</span>`
              : `<input type="number" class="stock-input" min="0" value="${qty > 0 ? qty : ''}" placeholder="0"
                   data-slug="${esc(p.slug)}" data-variant="${esc(color)}"
                   onchange="updateVariantStock(this)">`
            }
          </div>`).join('')
      : '';

    const activeToggle = IS_DELIVERY
      ? `<span style="font-size:12px;color:var(--muted)">${p.active ? 'Activo' : 'Inactivo'}</span>`
      : `<label class="stock-active-toggle">
           <input type="checkbox" ${p.active ? 'checked' : ''}
             onchange="toggleProductActive('${esc(p.slug)}', this.checked)">
           <span>Producto activo</span>
         </label>`;

    return `
      <div class="product-card" id="pc-${esc(p.slug)}">
        <div class="product-card__header">
          <span class="product-card__name">${esc(p.name)}</span>
          ${stockBadge}
        </div>
        <div class="stock-row">
          <span class="stock-label">Stock total</span>
          ${IS_DELIVERY
            ? `<span class="stock-qty">${p.stock_total}</span>`
            : `<input type="number" class="stock-input" min="0" value="${p.stock_total > 0 ? p.stock_total : ''}" placeholder="0"
                 data-slug="${esc(p.slug)}" data-field="total"
                 onchange="updateTotalStock(this)">`
          }
        </div>
        ${p.variants ? `
          <div class="stock-variants">
            <span class="stock-section-label">Por color</span>
            ${variantRows}
          </div>` : ''}
        <div class="product-card__footer">
          ${activeToggle}
        </div>
      </div>`;
  }).join('');
}

async function updateTotalStock(input) {
  const slug  = input.dataset.slug;
  const value = Math.max(0, parseInt(input.value) || 0);
  input.value = value > 0 ? value : '';
  const prod  = allProducts.find(p => p.slug === slug);
  if (!prod) return;

  input.style.borderColor = '#fbbf24';
  try {
    const res  = await fetch('/api/product-stock', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body:    JSON.stringify({
        slug,
        name:          prod.name,
        stock_total:   value,
        variants_json: prod.variants ? JSON.stringify(prod.variants) : null,
        active:        prod.active,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      const i = allProducts.findIndex(p => p.slug === slug);
      if (i >= 0) allProducts[i] = data.product;
      updateProductBadge(slug, value);
      input.style.borderColor = '#4ade80';
      setTimeout(() => { input.style.borderColor = ''; }, 1200);
    } else {
      input.style.borderColor = '#f87171';
    }
  } catch (_) {
    input.style.borderColor = '#f87171';
  }
}

async function updateVariantStock(input) {
  const slug    = input.dataset.slug;
  const variant = input.dataset.variant;
  const value   = Math.max(0, parseInt(input.value) || 0);
  input.value   = value > 0 ? value : '';
  const prod    = allProducts.find(p => p.slug === slug);
  if (!prod || !prod.variants) return;

  const newVariants  = { ...prod.variants, [variant]: value };
  const newTotal     = Object.values(newVariants).reduce((s, v) => s + v, 0);

  input.style.borderColor = '#fbbf24';
  try {
    const res  = await fetch('/api/product-stock', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body:    JSON.stringify({
        slug,
        name:          prod.name,
        stock_total:   newTotal,
        variants_json: JSON.stringify(newVariants),
        active:        prod.active,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      const i = allProducts.findIndex(p => p.slug === slug);
      if (i >= 0) allProducts[i] = data.product;
      const totalInput = document.querySelector(`.stock-input[data-slug="${slug}"][data-field="total"]`);
      if (totalInput) { totalInput.value = newTotal > 0 ? newTotal : ''; }
      updateProductBadge(slug, newTotal);
      input.style.borderColor = '#4ade80';
      setTimeout(() => { input.style.borderColor = ''; }, 1200);
    } else {
      input.style.borderColor = '#f87171';
    }
  } catch (_) {
    input.style.borderColor = '#f87171';
  }
}

async function toggleProductActive(slug, active) {
  const prod = allProducts.find(p => p.slug === slug);
  if (!prod) return;
  try {
    const res  = await fetch('/api/product-stock', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body:    JSON.stringify({
        slug,
        name:          prod.name,
        stock_total:   prod.stock_total,
        variants_json: prod.variants ? JSON.stringify(prod.variants) : null,
        active:        active ? 1 : 0,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      const i = allProducts.findIndex(p => p.slug === slug);
      if (i >= 0) allProducts[i] = data.product;
    }
  } catch (_) {}
}

function updateProductBadge(slug, stockTotal) {
  const card  = document.getElementById(`pc-${slug}`);
  const badge = card?.querySelector('.product-card__header .badge');
  if (!badge) return;
  if (stockTotal === 0) { badge.className = 'badge badge-cancelled'; badge.textContent = 'Agotado'; }
  else { badge.className = 'badge badge-purchased'; badge.textContent = `${stockTotal} en stock`; }
}
