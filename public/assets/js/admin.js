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

  document.querySelectorAll('[data-tab="ads"], [data-tab="dashboard"]').forEach(btn => {
    btn.style.display = 'none';
  });

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
  updateStats(filtered);
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
  if (name.includes('Cadena') || name.includes('Apex')) return 'Apex';
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
<td class="col-city" title="${esc(l.city || '')}">${formatCity(l.city)}</td>
<td class="col-prod" title="${esc(l.product_name)}">${esc(abbrevProduct(l.product_name))} (${Number(l.quantity || 1)})</td>
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
    const rect   = btn.getBoundingClientRect();
    const MENU_H = 88;
    const top    = (rect.bottom + MENU_H + 4 > window.innerHeight)
      ? rect.top - MENU_H - 4
      : rect.bottom + 4;
    menu.style.top   = top + 'px';
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
function formatCity(cityRaw) {
  if (!cityRaw) return '—';

  let city = String(cityRaw)
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\bparaguay\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!city) return '—';

  const aliases = [
    // Ciudades largas o nombres que ensucian mucho la tabla
    { match: 'pedro juan caballero', label: 'PJC' },
    { match: 'pedro juan', label: 'PJC' },
    { match: 'fernando de la mora', label: 'Fdo. de la Mora' },
    { match: 'presidente franco', label: 'Pte. Franco' },
    { match: 'coronel oviedo', label: 'Cnel. Oviedo' },
    { match: 'juan león mallorquín', label: 'J. L. Mallorquín' },
    { match: 'juan leon mallorquin', label: 'J. L. Mallorquín' },
    { match: 'san juan bautista', label: 'San Juan Bautista' },
    { match: 'San Pedro Del Ycuamandiyu', label: 'San Pedro' },
    { match: 'san pedro de ycuamandiyu', label: 'San Pedro' },
    { match: 'santa rosa del aguaray', label: 'Sta. Rosa Aguaray' },
    { match: 'mariano roque alonso', label: 'M. R. Alonso' },
    { match: 'mcal estigarribia', label: 'Mcal. Estigarribia' },
    { match: 'mariscal estigarribia', label: 'Mcal. Estigarribia' },
    { match: 'san ignacio guazu', label: 'San Ignacio' },
    { match: 'san ignacio guazú', label: 'San Ignacio' },
    { match: 'yby yau', label: 'Yby Yaú' },
    { match: 'yby yaú', label: 'Yby Yaú' },
    { match: 'bella vista norte', label: 'Bella Vista N.' },
    { match: 'bella vista sur', label: 'Bella Vista S.' },

    // Correcciones comunes, no abreviaciones agresivas
    { match: 'villa elisa', label: 'Villa Elisa' },
    { match: 'villalisa', label: 'Villa Elisa' },
    { match: 'lambare', label: 'Lambaré' },
    { match: 'capiata', label: 'Capiatá' },
    { match: 'asuncion', label: 'Asunción' },
    { match: 'caaguazu', label: 'Caaguazú' },
  ];

  const found = aliases.find(item => city.includes(item.match));
  if (found) return found.label;

  // Si escribió algo tipo "Villarrica zona centro", deja solo ciudad base si es largo.
  const noiseWords = ['zona', 'barrio', 'centro', 'km', 'ruta'];
  const parts = city.split(' ').filter(Boolean);
  const noiseIndex = parts.findIndex(w => noiseWords.includes(w));

  if (noiseIndex > 0) {
    city = parts.slice(0, noiseIndex).join(' ');
  }

  return city
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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
  const dashSection     = document.getElementById('dashboard-section');
  const adsSection      = document.getElementById('ads-section');
  leadsSection    && (leadsSection.style.display    = tab === 'leads'     ? '' : 'none');
  productsSection && (productsSection.style.display = tab === 'products'  ? '' : 'none');
  dashSection     && (dashSection.style.display     = tab === 'dashboard' ? '' : 'none');
  adsSection      && (adsSection.style.display      = tab === 'ads'       ? '' : 'none');
  if (tab === 'products')  loadProducts();
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'ads')       renderAdsTable();
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

/* =========================================================
   Dashboard
   ========================================================= */
let dashPeriod  = 'all';
let dashProduct = '';

function setDashPeriod(val) {
  dashPeriod = val;
  const map = { all: 'dash-date-all', today: 'dash-date-today', yesterday: 'dash-date-yesterday' };
  Object.entries(map).forEach(([p, id]) => {
    document.getElementById(id)?.classList.toggle('date-btn--active', p === val);
  });
  if (val in map) {
    const dp = document.getElementById('dash-date-picker');
    if (dp) dp.value = '';
  }
  renderDashboard();
}

document.getElementById('dash-date-all')?.addEventListener('click',       () => setDashPeriod('all'));
document.getElementById('dash-date-today')?.addEventListener('click',     () => setDashPeriod('today'));
document.getElementById('dash-date-yesterday')?.addEventListener('click', () => setDashPeriod('yesterday'));
document.getElementById('dash-date-picker')?.addEventListener('change', e => {
  const val = e.target.value;
  dashPeriod = val || 'all';
  const map = { all: 'dash-date-all', today: 'dash-date-today', yesterday: 'dash-date-yesterday' };
  Object.values(map).forEach(id => document.getElementById(id)?.classList.remove('date-btn--active'));
  if (!val) document.getElementById('dash-date-all')?.classList.add('date-btn--active');
  renderDashboard();
});

document.getElementById('dash-prod-select')?.addEventListener('change', e => {
  dashProduct = e.target.value;
  renderDashboard();
});

function getDashLeads(applyPeriod) {
  const todayStr = new Date().toLocaleDateString('sv-SE');
  const yestStr  = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE');
  const now      = new Date();
  return allLeads.filter(l => {
    if (dashProduct && l.product_name !== dashProduct) return false;
    if (!applyPeriod) return true;
    const ld = l.created_at ? new Date(l.created_at + 'Z').toLocaleDateString('sv-SE') : '';
    if (dashPeriod === 'today')     return ld === todayStr;
    if (dashPeriod === 'yesterday') return ld === yestStr;
    if (dashPeriod === '7d')    return ld >= new Date(Date.now() -  7 * 86400000).toLocaleDateString('sv-SE');
    if (dashPeriod === '30d')   return ld >= new Date(Date.now() - 30 * 86400000).toLocaleDateString('sv-SE');
    if (dashPeriod === 'month') {
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return ld.startsWith(ym);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dashPeriod)) return ld === dashPeriod;
    return true;
  });
}

function renderDashboard() {
  const leads      = getDashLeads(true);
  const chartLeads = getDashLeads(false);

  const purchased = leads.filter(l => l.status === 'purchased');
  const pending   = leads.filter(l => l.status === 'pending');
  const cancelled = leads.filter(l => l.status === 'cancelled');

  const revenue   = purchased.reduce((s, l) => s + (Number(l.value)    || 0), 0);
  const units     = purchased.reduce((s, l) => s + (Number(l.quantity) || 1), 0);
  const closeRate = leads.length > 0 ? (purchased.length / leads.length * 100) : 0;
  const avgTicket = purchased.length > 0 ? Math.round(revenue / purchased.length) : 0;

  const prodUnits = {};
  purchased.forEach(l => {
    const p = abbrevProduct(l.product_name);
    prodUnits[p] = (prodUnits[p] || 0) + (Number(l.quantity) || 1);
  });
  const bestProd = Object.entries(prodUnits).sort((a, b) => b[1] - a[1])[0];

  const kpiEl = document.getElementById('dash-kpis');
  if (kpiEl) kpiEl.innerHTML = `
    <div class="dash-kpi"><div class="dash-kpi__val dash-kpi__val--green">Gs.&nbsp;${revenue.toLocaleString('es-PY')}</div><div class="dash-kpi__label">Facturación confirmada</div></div>
    <div class="dash-kpi"><div class="dash-kpi__val">${leads.length}</div><div class="dash-kpi__label">Leads generados</div></div>
    <div class="dash-kpi"><div class="dash-kpi__val dash-kpi__val--green">${purchased.length}</div><div class="dash-kpi__label">Comprados</div></div>
    <div class="dash-kpi"><div class="dash-kpi__val dash-kpi__val--yellow">${pending.length}</div><div class="dash-kpi__label">Pendientes</div></div>
    <div class="dash-kpi"><div class="dash-kpi__val">${closeRate.toFixed(1)}%</div><div class="dash-kpi__label">Tasa de cierre</div></div>
    <div class="dash-kpi"><div class="dash-kpi__val">Gs.&nbsp;${avgTicket.toLocaleString('es-PY')}</div><div class="dash-kpi__label">Ticket promedio</div></div>
    <div class="dash-kpi"><div class="dash-kpi__val">${units}</div><div class="dash-kpi__label">Unidades vendidas</div></div>
    <div class="dash-kpi"><div class="dash-kpi__val dash-kpi__val--accent">${bestProd ? bestProd[0] : '—'}</div><div class="dash-kpi__label">Producto más vendido</div></div>
  `;

  renderDayBars(chartLeads);
  renderStatusBars(purchased.length, pending.length, cancelled.length);
  renderProductRanking(leads);
}

function renderDayBars(leads) {
  const el = document.getElementById('dash-bars-svg');
  if (!el) return;
  const DAYS = 30;
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const dayData = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d       = new Date(Date.now() - i * 86400000);
    const dateStr = d.toLocaleDateString('sv-SE');
    const rev     = leads
      .filter(l => l.status === 'purchased' && l.created_at
        && new Date(l.created_at + 'Z').toLocaleDateString('sv-SE') === dateStr)
      .reduce((s, l) => s + (Number(l.value) || 0), 0);
    dayData.push({ rev, d });
  }
  const maxRev = Math.max(...dayData.map(d => d.rev), 1);
  const W = 600, H = 110;
  const slotW = (W - 20) / DAYS;
  const barW  = Math.max(2, Math.floor(slotW) - 1);
  let svg = '';
  dayData.forEach((day, i) => {
    const barH = day.rev > 0 ? Math.max(3, Math.round(day.rev / maxRev * (H - 22))) : 1;
    const x    = 10 + i * slotW;
    const y    = H - 18 - barH;
    const fill = day.rev > 0 ? '#4ade80' : 'rgba(255,255,255,.06)';
    svg += `<rect x="${x.toFixed(1)}" y="${y}" width="${barW}" height="${barH}" rx="2" fill="${fill}"/>`;
    if (i === 0 || day.d.getDate() === 1 || i === DAYS - 1) {
      svg += `<text x="${(x + barW / 2).toFixed(1)}" y="${H - 1}" text-anchor="middle" font-size="7" fill="rgba(255,255,255,.3)">${day.d.getDate()} ${months[day.d.getMonth()]}</text>`;
    }
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;overflow:visible">${svg}</svg>`;
}

function renderStatusBars(purchased, pending, cancelled) {
  const el = document.getElementById('dash-status-bars');
  if (!el) return;
  const total = purchased + pending + cancelled;
  if (!total) {
    el.innerHTML = '<p style="font-size:13px;color:rgba(255,255,255,.3);text-align:center;padding:24px 0">Sin datos para este período</p>';
    return;
  }
  const pct = v => Math.round(v / total * 100);
  const rows = [
    ['Comprados',  purchased, '#4ade80'],
    ['Pendientes', pending,   '#fbbf24'],
    ...(cancelled ? [['Cancelados', cancelled, '#f87171']] : []),
  ];
  el.innerHTML = rows.map(([label, val, color]) => `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="color:${color}">${label}</span>
        <span style="color:rgba(255,255,255,.5)">${val} &middot; ${pct(val)}%</span>
      </div>
      <div style="height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct(val)}%;background:${color};border-radius:3px"></div>
      </div>
    </div>`).join('');
}

/* =========================================================
   Ads Attribution Tab
   ========================================================= */
let adsStatusFilter  = '';
let adsAttrFilter    = 'with';
let adsProductFilter = '';

function formatProductShortName(name) {
  if (!name) return '—';
  if (name.includes('Cadena') || name.includes('Apex')) return 'Apex';
  if (name.includes('Cepillo')) return 'Cepillo';
  if (name.includes('Lentes'))  return 'Lentes';
  if (name.includes('Reloj'))   return 'Reloj';
  return name.length > 12 ? name.slice(0, 12) + '…' : name;
}

/*
 * Para que Anuncio y Campaña muestren nombres reales, configurar en Meta Ads:
 * URL parameters →
 *   utm_source=meta
 *   &utm_campaign={{campaign.name}}
 *   &utm_content={{ad.name}}
 *   &campaign_id={{campaign.id}}
 *   &adset_id={{adset.id}}
 *   &ad_id={{ad.id}}
 *   &campaign_name={{campaign.name}}
 *   &adset_name={{adset.name}}
 *   &ad_name={{ad.name}}
 */

function isNumericId(v) {
  return !!v && /^\d{6,}$/.test(String(v).trim());
}

function cleanAdLabel(l) {
  if (l.ad_name && !isNumericId(l.ad_name))       return l.ad_name;
  if (l.utm_content && !isNumericId(l.utm_content)) return l.utm_content;
  if (l.ad_id)                                      return l.ad_id;
  return '—';
}

function cleanCampaignLabel(l) {
  if (l.campaign_name && !isNumericId(l.campaign_name)) return l.campaign_name;
  if (l.utm_campaign  && !isNumericId(l.utm_campaign))  return l.utm_campaign;
  if (l.campaign_id)                                     return l.campaign_id;
  return '—';
}

function hasAttribution(l) {
  return !!(l.ad_name || l.ad_id || l.utm_content ||
            l.campaign_name || l.campaign_id || l.utm_campaign || l.fbclid);
}

function adsFilterChange() {
  adsStatusFilter  = document.getElementById('ads-filter-status')?.value || '';
  adsAttrFilter    = document.getElementById('ads-filter-attr')?.value ?? 'with';
  adsProductFilter = document.getElementById('ads-filter-prod')?.value  || '';
  renderAdsTable();
}

function renderAdsTable() {
  const tbody = document.getElementById('ads-tbody');
  if (!tbody) return;

  let filtered = allLeads.slice();
  if (adsStatusFilter)             filtered = filtered.filter(l => l.status === adsStatusFilter);
  if (adsAttrFilter === 'with')    filtered = filtered.filter(l =>  hasAttribution(l));
  if (adsAttrFilter === 'without') filtered = filtered.filter(l => !hasAttribution(l));
  if (adsProductFilter)            filtered = filtered.filter(l => formatProductShortName(l.product_name) === adsProductFilter);

  if (!filtered.length) {
    const msg = adsAttrFilter === 'with'
      ? 'Todavía no hay pedidos con datos de anuncio. Probá entrando desde una URL con UTMs o desde un anuncio activo.'
      : 'Sin leads para los filtros seleccionados.';
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px 20px;color:var(--muted);line-height:1.6;font-size:13px">${msg}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(l => {
    const adLabel       = cleanAdLabel(l);
    const campaignLabel = cleanCampaignLabel(l);
    return `<tr>
      <td>${esc(shortName(l.name))}</td>
      <td>${esc(formatProductShortName(l.product_name))}</td>
      <td><span class="ads-ellipsis" title="${esc(adLabel)}">${esc(adLabel)}</span></td>
      <td><span class="ads-ellipsis" title="${esc(campaignLabel)}">${esc(campaignLabel)}</span></td>
    </tr>`;
  }).join('');
}

function renderProductRanking(leads) {
  const el = document.getElementById('dash-ranking');
  if (!el) return;
  const prodNames = ['Cepillo', 'Lentes', 'Reloj', 'Apex'];
  const map = {};
  leads.filter(l => l.status === 'purchased').forEach(l => {
    const k = abbrevProduct(l.product_name);
    if (!map[k]) map[k] = { units: 0, revenue: 0 };
    map[k].units   += Number(l.quantity) || 1;
    map[k].revenue += Number(l.value)    || 0;
  });
  const rows = prodNames
    .map(n => ({ name: n, ...(map[n] || { units: 0, revenue: 0 }) }))
    .sort((a, b) => b.units - a.units);
  const maxU = Math.max(...rows.map(r => r.units), 1);
  el.innerHTML = rows.map(r => `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="color:#fff;font-weight:600">${r.name}</span>
        <span style="color:rgba(255,255,255,.4)">${r.units} uds</span>
      </div>
      <div style="height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.round(r.units / maxU * 100)}%;background:#3b82f6;border-radius:3px"></div>
      </div>
      <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:2px">Gs. ${r.revenue.toLocaleString('es-PY')}</div>
    </div>`).join('');
}
