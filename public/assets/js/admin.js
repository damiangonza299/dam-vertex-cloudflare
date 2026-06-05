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
  const manualSaleBtn = document.getElementById('manual-sale-btn');
  if (manualSaleBtn) manualSaleBtn.style.display = 'none';

  document.querySelectorAll('[data-tab="ads"], [data-tab="dashboard"], [data-tab="meta"], [data-tab="blocked"], [data-tab="insync"]').forEach(btn => {
    btn.style.display = 'none';
  });

  /* Mostrar tab Envíos en modo delivery */
  const shippingTabBtn = document.querySelector('[data-tab="shipping"]');
  if (shippingTabBtn) shippingTabBtn.style.display = '';

  /* Ocultar botón Envíos del filtro de fecha (solo para admin normal) */
  const shippingQuickBtn = document.getElementById('date-shipping-btn');
  if (shippingQuickBtn) shippingQuickBtn.style.display = 'none';

  initShippingPanel();

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
} else {
  initShippingPanel();
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
document.getElementById('manual-sale-btn')?.addEventListener('click', openManualSaleModal);
document.getElementById('manual-sale-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeManualSaleModal(); });
document.getElementById('msf-product')?.addEventListener('change', msfOnProductChange);

function abbrevProduct(name) {
  if (!name) return '—';
  if (name.includes('Combo') && name.includes('Reloj')) return 'Combo Reloj';
  if (name.includes('Cepillo')) return 'Cepillo';
  if (name.includes('Lentes'))  return 'Lentes';
  if (name.includes('Reloj'))   return 'Reloj';
  if (name.includes('Cadena') || name.includes('Apex')) return 'Apex';
  return name.length > 10 ? name.slice(0, 10) + '...' : name;
}

function fmtVariant(v) {
  if (!v) return '';
  try {
    const arr = JSON.parse(v);
    if (Array.isArray(arr)) return arr.join(' + ');
    return String(v);
  } catch (_) {
    return String(v);
  }
}

function fmtVariantCell(l) {
  const vt = fmtVariant(l.variant);
  if (!vt) return '';
  const isCombo = l.product_slug === 'combo-reloj-cadena' || (l.product_name || '').includes('Combo Reloj');
  const display = isCombo ? vt + ' + Cadena Apex' : vt;
  return '<br><span style="font-size:10px;color:rgba(255,255,255,.45)">' + esc(display) + '</span>';
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
      <button onclick="blockCustomer(${l.id});closeMenus()">Bloquear cliente</button>
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
<td class="col-city" title="${esc(l.location_city || l.city || '')}">${formatCity(l.location_city || l.city)}</td>
<td class="col-prod" title="${esc(l.product_name)}">${esc(abbrevProduct(l.product_name))} (${Number(l.quantity || 1)})${fmtVariantCell(l)}</td>
      <td class="col-val">${Number(l.value || 0).toLocaleString('es-PY')}</td>
      <td class="col-status"><span class="badge badge-${l.status}">${labelStatus(l.status)}</span>${buildSourceBadges(l)}</td>
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
    const MENU_H = 132;
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

function fmtShipDate(s) {
  if (!s) return '—';
  const today = getParaguayDateLocal();
  const yest  = getParaguayDateLocal(new Date(Date.now() - 86400000));
  if (s === today) return 'Hoy';
  if (s === yest)  return 'Ayer';
  const parts  = s.split('-');
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return d + ' ' + months[m - 1];
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
    .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\bparaguay\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!city) return '—';

  // Strip prefijo "LIT NNN " (referencias de ruta/zona, no nombre de ciudad)
  city = city.replace(/^lit\s+\d+\s*/, '').trim();
  if (!city) return '—';

  const aliases = [
    // Ciudades largas o nombres que ensucian mucho la tabla
    { match: 'pedro juan caballero', label: 'PJC' },
    { match: 'pedro juan', label: 'PJC' },
    { match: 'ciudad del este', label: 'CDE' },
    { match: 'fernando de la mora', label: 'FDO. de la Mora' },
    { match: 'angel toledo', label: 'FDO. de la Mora' },
    { match: 'presidente franco', label: 'Pte. Franco' },
    { match: 'coronel oviedo', label: 'Cnel. Oviedo' },
    { match: 'juan león mallorquín', label: 'J. L. Mallorquín' },
    { match: 'juan leon mallorquin', label: 'J. L. Mallorquín' },
    { match: 'j. augusto saldivar', label: 'J.A. Saldívar' },
    { match: 'j. augusto saldívar', label: 'J.A. Saldívar' },
    { match: 'j augusto saldivar', label: 'J.A. Saldívar' },
    { match: 'j augusto saldívar', label: 'J.A. Saldívar' },
    { match: 'juan augusto saldivar', label: 'J.A. Saldívar' },
    { match: 'juan augusto saldívar', label: 'J.A. Saldívar' },
    { match: 'tomas romero pereira', label: 'ATRP' },
    { match: 'tomás romero pereira', label: 'ATRP' },
    { match: 'san juan bautista', label: 'San Juan Bautista' },
    { match: 'San Pedro Del Ycuamandiyu', label: 'San Pedro' },
    { match: 'san pedro de ycuamandiyu', label: 'San Pedro' },
    { match: 'santa rosa del aguaray', label: 'Sta. Rosa Aguaray' },
    { match: 'santa rosa misiones', label: 'Santa Rosa' },
    { match: 'santa rosa del misiones', label: 'Santa Rosa' },
    { match: 'mariano roque alonso', label: 'M. R. Alonso' },
    { match: 'mcal estigarribia', label: 'Mcal. Estigarribia' },
    { match: 'mariscal estigarribia', label: 'Mcal. Estigarribia' },
    { match: 'san ignacio misiones', label: 'San Ignacio' },
    { match: 'san ignacio guazu', label: 'San Ignacio' },
    { match: 'san ignacio guazú', label: 'San Ignacio' },
    { match: 'yby yau', label: 'Yby Yaú' },
    { match: 'yby yaú', label: 'Yby Yaú' },
    { match: 'bella vista norte', label: 'Bella Vista N.' },
    { match: 'bella vista sur', label: 'Bella Vista S.' },
    { match: 'melgarejo independencia', label: 'Melgarejo-Inde.' },
    { match: 'carlos jovellanos', label: 'Carlos-Jove.' },
    { match: 'carslos jovellanos', label: 'Carlos-Jove.' },

    // Correcciones comunes, no abreviaciones agresivas
    { match: 'villa elisa', label: 'Villa Elisa' },
    { match: 'villalisa', label: 'Villa Elisa' },
    { match: 'lambare', label: 'Lambaré' },
    { match: 'capiata', label: 'Capiatá' },
    { match: 'asuncion', label: 'Asunción' },
    { match: 'plaza italia', label: 'Asunción' },
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
  const metaSection     = document.getElementById('meta-section');
  const insyncSection    = document.getElementById('insync-section');
  const blockedSection   = document.getElementById('blocked-section');
  const shippingSection  = document.getElementById('shipping-section');
  leadsSection    && (leadsSection.style.display    = tab === 'leads'     ? '' : 'none');
  productsSection && (productsSection.style.display = tab === 'products'  ? '' : 'none');
  dashSection     && (dashSection.style.display     = tab === 'dashboard' ? '' : 'none');
  adsSection      && (adsSection.style.display      = tab === 'ads'       ? '' : 'none');
  metaSection     && (metaSection.style.display     = tab === 'meta'      ? '' : 'none');
  insyncSection   && (insyncSection.style.display   = tab === 'insync'    ? '' : 'none');
  blockedSection  && (blockedSection.style.display  = tab === 'blocked'   ? '' : 'none');
  shippingSection && (shippingSection.style.display = tab === 'shipping'  ? '' : 'none');
  if (tab === 'products')  loadProducts();
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'ads')       renderAdsTable();
  if (tab === 'meta')      loadMetaReport();
  if (tab === 'insync')    loadInsyncReport();
  if (tab === 'blocked')   loadBlockedCustomers();
  if (tab === 'shipping')  loadShippingStats();
}

/* ── DAM inSync Report ── */
let insyncPeriod  = '24h';
let insyncLanding = 'all';

async function loadInsyncReport() {
  if (!AUTH_TOKEN) return;
  const tbody1   = document.getElementById('insync-cta-tbody');
  const tbody2   = document.getElementById('insync-sections-tbody');
  const lowVol   = document.getElementById('insync-low-volume');
  const insights = document.getElementById('insync-insights-list');

  const loading = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">Cargando…</td></tr>';
  if (tbody1) tbody1.innerHTML = loading.replace('5', '4');
  if (tbody2) tbody2.innerHTML = loading;

  try {
    const res  = await fetch(`/api/insync-report?period=${insyncPeriod}&landing=${insyncLanding}`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'error');


    /* Volume */
    const s = data.volume?.sessions || 0;
    setText('ikpi-sessions',    s);
    setText('ikpi-scroll50',    (data.attention?.scroll_funnel?.p50 || 0) + '%');
    setText('ikpi-scroll75',    (data.attention?.scroll_funnel?.p75 || 0) + '%');
    if (lowVol) lowVol.style.display = data.volume?.low_volume ? '' : 'none';

    /* Atención — top section */
    const topSec = (data.attention?.sections || []).filter(s => !s.low_volume && s.attention_score != null).sort((a, b) => b.attention_score - a.attention_score)[0];
    setText('ikpi-top-section', topSec ? topSec.name : '—');

    /* Conversión */
    const totalClicks = (data.conversion?.cta_funnel || []).reduce((acc, c) => acc + (c.clicks || 0), 0);
    const totalModals = (data.conversion?.cta_funnel || []).reduce((acc, c) => acc + (c.modal_opens || 0), 0);
    const topCta      = (data.conversion?.cta_funnel || [])[0];
    setText('ikpi-cta-clicks',   totalClicks);
    setText('ikpi-modal-rate',   totalClicks ? Math.round(totalModals / totalClicks * 100) + '%' : '—');
    setText('ikpi-form-submits', data.conversion?.form_submits || 0);
    setText('ikpi-top-cta',      topCta ? topCta.cta_type : '—');

    /* Revenue */
    const rev = data.revenue || {};
    setText('ikpi-attributed-leads', rev.attributed_leads || 0);
    setText('ikpi-purchased',        rev.purchased_sessions || 0);
    setText('ikpi-revenue',          rev.total_revenue_gs ? 'Gs. ' + Number(rev.total_revenue_gs).toLocaleString('es-PY') : (rev.low_volume ? '[insuf.]' : '—'));
    setText('ikpi-stock-errors',     data.errors?.stock_error || 0);

    /* CTA funnel table */
    if (tbody1) {
      const rows = data.conversion?.cta_funnel || [];
      tbody1.innerHTML = rows.length
        ? rows.map(r => `<tr>
            <td><strong>${esc(r.cta_type)}</strong></td>
            <td>${r.clicks}</td>
            <td>${r.modal_opens}</td>
            <td>${r.modal_open_rate}%</td>
          </tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted)">Sin datos en este período</td></tr>';
    }

    /* Sections table */
    if (tbody2) {
      const rows = data.attention?.sections || [];
      tbody2.innerHTML = rows.length
        ? rows.map(r => {
            const score = r.attention_score != null
              ? `<span class="insync-score ${r.attention_score >= 60 ? 'insync-score-high' : r.attention_score >= 35 ? 'insync-score-med' : 'insync-score-low'}">${r.attention_score}</span>`
              : `<span class="insync-score insync-score-null">[insuf.]</span>`;
            return `<tr>
              <td>${esc(r.name)}</td>
              <td>${r.views}</td>
              <td>${r.avg_time_s ? r.avg_time_s + 's' : '—'}</td>
              <td>${r.reach_pct}%</td>
              <td>${score}</td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">Sin datos de secciones</td></tr>';
    }

    /* Insights */
    if (insights) {
      const ins = data.insights || [];
      insights.innerHTML = ins.length
        ? ins.map(i => `<div class="insync-insight insync-insight-${i.type}"><strong>[${i.type}]</strong> ${esc(i.text)}</div>`).join('')
        : '<div style="color:rgba(255,255,255,.3);font-size:12px">Sin insights disponibles para este período.</div>';
    }

  } catch (err) {
    const errRow = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--red)">Error: ${err.message}</td></tr>`;
    if (tbody1) tbody1.innerHTML = errRow.replace('5', '4');
    if (tbody2) tbody2.innerHTML = errRow;
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

document.addEventListener('DOMContentLoaded', () => {
  /* inSync period buttons */
  document.querySelectorAll('[data-iperiod]').forEach(btn => {
    btn.addEventListener('click', () => {
      insyncPeriod = btn.dataset.iperiod;
      document.querySelectorAll('[data-iperiod]').forEach(b => b.classList.toggle('insync-period-btn--active', b === btn));
      loadInsyncReport();
    });
  });

  /* inSync landing buttons */
  document.querySelectorAll('[data-ilanding]').forEach(btn => {
    btn.addEventListener('click', () => {
      insyncLanding = btn.dataset.ilanding;
      document.querySelectorAll('[data-ilanding]').forEach(b => b.classList.toggle('insync-period-btn--active', b === btn));
      loadInsyncReport();
    });
  });

  /* inSync refresh */
  document.getElementById('insync-refresh-btn')?.addEventListener('click', loadInsyncReport);
});

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
  if (name.includes('Combo') && name.includes('Reloj')) return 'Reloj + Cadena Apex';
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

/* =========================================================
   Meta Ads Report
   ========================================================= */

let metaStatusFilter  = 'active'; // 'active' | 'all'
let metaDateFilter    = '7d';     // '7d' | '30d' | 'range'
let metaProductFilter = '';
let metaCachedData    = null;
let metaCachedKey     = null;

function getMetaDates() {
  const today = new Date().toISOString().split('T')[0];
  if (metaDateFilter === 'range') {
    const since = document.getElementById('meta-since-input')?.value || '';
    const until = document.getElementById('meta-until-input')?.value || today;
    return { since, until, valid: !!since };
  }
  const days  = metaDateFilter === '7d' ? 7 : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  return { since, until: today, valid: true };
}

document.getElementById('meta-controls')?.addEventListener('click', e => {
  const statusBtn = e.target.closest('[data-mstatus]');
  const dateBtn   = e.target.closest('[data-mdate]');

  if (statusBtn) {
    metaStatusFilter = statusBtn.dataset.mstatus;
    document.querySelectorAll('[data-mstatus]').forEach(b =>
      b.classList.toggle('meta-filter-btn--active', b.dataset.mstatus === metaStatusFilter));
    if (metaCachedData) renderMetaReport(metaCachedData);
    return;
  }

  if (dateBtn) {
    metaDateFilter = dateBtn.dataset.mdate;
    document.querySelectorAll('[data-mdate]').forEach(b =>
      b.classList.toggle('meta-filter-btn--active', b.dataset.mdate === metaDateFilter));
    const rangeRow = document.getElementById('meta-range-row');
    if (rangeRow) rangeRow.style.display = metaDateFilter === 'range' ? 'flex' : 'none';
    if (metaDateFilter !== 'range') loadMetaReport();
  }
});

document.getElementById('meta-prod-filter')?.addEventListener('change', e => {
  metaProductFilter = e.target.value;
  if (metaCachedData) renderMetaReport(metaCachedData);
});

document.getElementById('meta-range-apply')?.addEventListener('click', () => {
  const { valid } = getMetaDates();
  if (valid) loadMetaReport();
});

document.getElementById('refresh-meta-btn')?.addEventListener('click', () => {
  metaCachedData = null;
  metaCachedKey  = null;
  loadMetaReport();
});

document.getElementById('meta-alerts-toggle')?.addEventListener('click', () => {
  const alertsEl = document.getElementById('meta-alerts');
  const btn      = document.getElementById('meta-alerts-toggle');
  if (!alertsEl || !btn) return;
  const open = alertsEl.style.display !== 'none';
  alertsEl.style.display = open ? 'none' : '';
  btn.classList.toggle('meta-filter-btn--active', !open);
});

async function loadMetaReport() {
  const tbody    = document.getElementById('meta-tbody');
  const alertsEl = document.getElementById('meta-alerts');
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Cargando...</td></tr>`;
  if (alertsEl) alertsEl.innerHTML = '';

  const { since, until, valid } = getMetaDates();
  if (!valid) return;
  const cacheKey = `${since}|${until}`;

  if (metaCachedData && metaCachedKey === cacheKey) {
    renderMetaReport(metaCachedData);
    return;
  }

  try {
    const res = await fetch(`/api/meta/report?since=${since}&until=${until}`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
    });
    if (res.status === 401) { clearToken(); location.reload(); return; }
    const data = await res.json();
    if (data.ok) {
      metaCachedKey  = cacheKey;
      metaCachedData = data;
      renderMetaReport(data);
    } else {
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--red)">${esc(data.error || 'Error al cargar el reporte')}</td></tr>`;
    }
  } catch (_) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--red)">Error de red</td></tr>`;
  }
}

function renderMetaReport(data) {
  const tbody     = document.getElementById('meta-tbody');
  const alertsEl  = document.getElementById('meta-alerts');
  const noAttrEl  = document.getElementById('meta-no-attr');
  const toggleBtn = document.getElementById('meta-alerts-toggle');
  if (!tbody) return;

  let rows   = (data.rows   || []).slice();
  let alerts = (data.alerts || []).slice();

  /* ── Status filter ── */
  if (metaStatusFilter === 'active') {
    rows = rows.filter(r => {
      if (r.meta === null) return false;
      const es = r.meta.effective_status;
      if (es != null) return es === 'ACTIVE';
      return r.meta.spend_raw > 0; // fallback: no effective_status disponible
    });
  }

  /* ── Product filter ── */
  if (metaProductFilter) {
    const pf = metaProductFilter.toLowerCase();
    rows = rows.filter(r =>
      (r.product_name || '').toLowerCase().includes(pf) ||
      (r.campaign_name || '').toLowerCase().includes(pf)
    );
  }

  /* ── Sort: campañas ACTIVE primero, luego por gasto ── */
  rows.sort((a, b) => {
    const aA = a.meta?.effective_status === 'ACTIVE' ? 0 : 1;
    const bA = b.meta?.effective_status === 'ACTIVE' ? 0 : 1;
    if (aA !== bA) return aA - bA;
    return (b.meta?.spend_raw ?? 0) - (a.meta?.spend_raw ?? 0);
  });

  /* ── Alertas: filtrar por campañas visibles ── */
  const visibleNames = new Set(rows.map(r => r.campaign_name));
  if (metaStatusFilter === 'active' || metaProductFilter) {
    alerts = alerts.filter(a => Array.from(visibleNames).some(n => a.msg.startsWith(n)));
  }

  if (alertsEl) {
    const ALERT_ICONS = { ok: '✓', warn: '⚠', danger: '✕', info: 'ℹ' };
    alertsEl.innerHTML = alerts.map(a =>
      `<div class="meta-alert meta-alert-${a.level}">${ALERT_ICONS[a.level] || '·'} ${esc(a.msg)}</div>`
    ).join('');
  }
  if (toggleBtn) {
    toggleBtn.textContent = alerts.length > 0 ? `Alertas (${alerts.length})` : 'Alertas';
  }

  if (noAttrEl) {
    const noAttrLeads     = data.no_attribution_leads    ?? 0;
    const noAttrPurchased = data.unattributed_purchased  ?? 0;
    if (noAttrLeads > 0 || noAttrPurchased > 0) {
      noAttrEl.style.display = '';
      let msg = `${noAttrLeads} leads sin atribución en el período`;
      if (noAttrPurchased > 0) {
        msg += ` — de ellos, ${noAttrPurchased} están comprados pero no se pueden asignar a ninguna campaña específica.`;
      } else {
        msg += '.';
      }
      noAttrEl.textContent = msg;
    } else {
      noAttrEl.style.display = 'none';
    }
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--muted)">Sin campañas para los filtros seleccionados.</td></tr>`;
    return;
  }

  const QUALITY_CLASS = {
    COMPRADOR:      'COMPRADOR',
    CURIOSOS:       'CURIOSOS',
    QUEMANDO:       'QUEMANDO',
    META_OVERATRIB: 'OVERATRIB',
    SIN_ATRIB:      'NEUTRAL',
    NEUTRAL:        'NEUTRAL',
  };
  const QUALITY_LABEL = {
    COMPRADOR:      'COMPRADOR',
    CURIOSOS:       'CURIOSOS',
    QUEMANDO:       'QUEMANDO',
    META_OVERATRIB: 'SOBRE-ATRIB',
    SIN_ATRIB:      'SIN ATRIB',
    NEUTRAL:        'NEUTRAL',
  };

  tbody.innerHTML = rows.map(row => {
    const m = row.meta;
    const d = row.d1;

    const spend = m
      ? `<span style="white-space:nowrap">Gs.&nbsp;${Number(m.spend_raw).toLocaleString('es-PY')}</span>`
      : '—';

    const roasM = (m?.roas_meta !== null && m?.roas_meta !== undefined)
      ? `${m.roas_meta}×` : '—';

    const roasR = (row.roas_real !== null && row.roas_real !== undefined)
      ? `<strong>${row.roas_real}×</strong>` : '—';

    /* ROAS prod.: solo válido cuando el producto tiene UNA sola campaña activa.
       Si el producto es compartido entre campañas, roas_real_product = null (anulado en backend). */
    const roasProd = (row.roas_real_product !== null && row.roas_real_product !== undefined)
      ? `<span style="color:rgba(255,255,255,.45)" title="ROAS sobre total del producto — válido porque es la única campaña">${row.roas_real_product}×</span>`
      : (row.product?.shared
          ? `<span style="color:rgba(255,255,255,.2)" title="Producto compartido entre campañas — ROAS no atribuible a esta campaña">—</span>`
          : '—');

    /* Meta purchase count: lo que Ads Manager atribuye (puede diferir de Real atrib.) */
    const metaPurchases = m ? (m.purchase_count ?? 0) : '—';

    /* Real prod.: total compras del producto — mismo número en todas las campañas del mismo producto */
    const realProdTitle = row.product?.shared
      ? 'Total del producto — compartido entre varias campañas, no atribuible a esta sola'
      : 'Total compras reales del producto en el rango';
    const realProd = `<span title="${realProdTitle}">${row.product?.purchased ?? 0}</span>`;

    const qClass = QUALITY_CLASS[row.quality] || 'NEUTRAL';
    const qLabel = QUALITY_LABEL[row.quality] || row.quality;

    const name = row.campaign_name;
    const campCell = name.length > 22
      ? `<span title="${esc(name)}">${esc(name.slice(0, 22))}…</span>`
      : esc(name);

    const ctrStr = m?.ctr
      ? `<span style="display:block;font-size:10px;color:rgba(255,255,255,.35);margin-top:2px">${m.ctr}% CTR</span>`
      : '';

    return `<tr>
      <td style="max-width:180px">${campCell}${ctrStr}</td>
      <td>${spend}</td>
      <td style="text-align:center">${d.total_leads}</td>
      <td style="text-align:center;color:#60a5fa">${metaPurchases}</td>
      <td style="text-align:center;color:#4ade80;font-weight:600">${d.purchased}</td>
      <td style="text-align:center;color:#a78bfa">${realProd}</td>
      <td style="text-align:center">${roasM}</td>
      <td style="text-align:center">${roasR}</td>
      <td style="text-align:center">${roasProd}</td>
      <td><span class="meta-q meta-q-${qClass}">${qLabel}</span></td>
    </tr>`;
  }).join('');
}

/* ── Source/CAPI badge helpers ── */
function labelSource(s) {
  return { manual_whatsapp: 'Manual WA', meta_ads_manual: 'Manual Ads', referido: 'Referido', otro: 'Otro' }[s] || s;
}

function capiStatusStyle(s) {
  if (s === 'sent')  return 'background:rgba(74,222,128,.12);color:#4ade80';
  if (s === 'error') return 'background:rgba(248,113,113,.12);color:#f87171';
  return 'background:rgba(255,255,255,.06);color:rgba(255,255,255,.4)';
}

function buildSourceBadges(l) {
  if (!l.source_type) return '';
  return `<br><span style="display:inline-block;margin-top:3px;font-size:10px;padding:2px 7px;border-radius:3px;background:rgba(74,222,128,.12);color:#4ade80;font-weight:700">${labelSource(l.source_type)}</span>`;
}

function buildStockBadge(l) {
  if (!l.source_type) return '';
  if (l.stock_error)
    return `<br><span style="display:inline-block;margin-top:2px;font-size:9px;padding:1px 6px;border-radius:3px;background:rgba(248,113,113,.12);color:#f87171">STOCK ERR</span>`;
  if (l.stock_deducted)
    return `<br><span style="display:inline-block;margin-top:2px;font-size:9px;padding:1px 6px;border-radius:3px;background:rgba(74,222,128,.08);color:rgba(74,222,128,.7)">Stock ↓</span>`;
  return `<br><span style="display:inline-block;margin-top:2px;font-size:9px;padding:1px 6px;border-radius:3px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.3)">Sin deducir</span>`;
}

/* =========================================================
   Venta Manual WhatsApp — Modal
   ========================================================= */

const MANUAL_PRODUCTS = [
  { slug: 'cepillo',            name: 'Cepillo Eléctrico Recargable (4 Cabezales)' },
  { slug: 'lentes',             name: 'Lentes Anti Luz Azul Rojos' },
  { slug: 'reloj',              name: 'Reloj Blackout Minimal' },
  { slug: 'cadena',             name: 'Cadena Apex' },
  { slug: 'combo-reloj-cadena', name: 'Combo Reloj Blackout Minimal + Cadena Apex' },
];

let msfVariantNames = [];

function openManualSaleModal() {
  const modal = document.getElementById('manual-sale-modal');
  if (!modal) return;
  document.getElementById('msf-form')?.reset();
  msfVariantNames = [];
  const rowsEl = document.getElementById('msf-variant-rows');
  if (rowsEl) rowsEl.innerHTML = '';
  const varSection = document.getElementById('msf-variant-section');
  if (varSection) varSection.style.display = 'none';
  const qtySection = document.getElementById('msf-qty-section');
  if (qtySection) qtySection.style.display = 'block';
  const attrBody = document.getElementById('msf-attr-body');
  if (attrBody) attrBody.style.display = 'none';
  const errEl = document.getElementById('msf-error');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  modal.style.display = 'flex';
}

function closeManualSaleModal() {
  const modal = document.getElementById('manual-sale-modal');
  if (modal) modal.style.display = 'none';
}

function toggleMsfAttr() {
  const body = document.getElementById('msf-attr-body');
  if (!body) return;
  body.style.display = body.style.display === 'none' ? 'grid' : 'none';
}

function showMsfError(msg) {
  const errEl = document.getElementById('msf-error');
  if (!errEl) return;
  errEl.textContent = msg;
  errEl.style.display = 'block';
}

async function msfOnProductChange() {
  const slug       = document.getElementById('msf-product')?.value || '';
  const varSection = document.getElementById('msf-variant-section');
  const qtySection = document.getElementById('msf-qty-section');
  const rowsEl     = document.getElementById('msf-variant-rows');
  const addBtn     = document.getElementById('msf-add-variant-row');
  if (!varSection || !qtySection || !rowsEl) return;

  rowsEl.innerHTML = '';
  msfVariantNames  = [];

  if (!slug) {
    varSection.style.display = 'none';
    qtySection.style.display = 'block';
    return;
  }

  const fetchSlug = slug === 'combo-reloj-cadena' ? 'reloj' : slug;
  try {
    const res  = await fetch(`/api/product-stock?slug=${encodeURIComponent(fetchSlug)}`);
    const data = await res.json();
    const vars = data.product?.variants;
    if (vars && typeof vars === 'object' && !Array.isArray(vars)) {
      msfVariantNames = Object.keys(vars);
    }
  } catch (_) {}

  const isCombo = slug === 'combo-reloj-cadena';

  if (msfVariantNames.length) {
    varSection.style.display = 'block';
    qtySection.style.display = 'none';
    rowsEl.innerHTML = msfBuildVariantRowHTML(msfVariantNames, isCombo);
    if (addBtn) addBtn.style.display = isCombo ? 'none' : 'block';
  } else {
    varSection.style.display = 'none';
    qtySection.style.display = 'block';
    if (addBtn) addBtn.style.display = 'block';
  }
}

function msfBuildVariantRowHTML(names, isCombo) {
  const opts = names.map(n => `<option value="${n}">${n}</option>`).join('');
  const removeBtn = isCombo ? '' :
    `<button type="button" onclick="msfRemoveVariantRow(this)" title="Quitar" ` +
    `style="background:none;border:1px solid rgba(248,113,113,.3);color:#f87171;` +
    `border-radius:6px;cursor:pointer;font-size:18px;line-height:1;padding:0;` +
    `height:36px;width:32px;font-family:inherit;flex-shrink:0">×</button>`;
  return `<div class="msf-variant-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center">` +
    `<select class="msf-input msf-variant-select" style="flex:1;height:36px;padding:6px 10px">` +
    `<option value="">Seleccioná color…</option>${opts}</select>` +
    `<input type="number" class="msf-variant-qty msf-input" min="1" value="1" ` +
    `style="width:64px;text-align:center;flex-shrink:0"${isCombo ? ' readonly' : ''}>${removeBtn}</div>`;
}

function msfAddVariantRow() {
  const rowsEl = document.getElementById('msf-variant-rows');
  if (!rowsEl || !msfVariantNames.length) return;
  rowsEl.insertAdjacentHTML('beforeend', msfBuildVariantRowHTML(msfVariantNames, false));
}

function msfRemoveVariantRow(btn) {
  const rowsEl = document.getElementById('msf-variant-rows');
  if (rowsEl && rowsEl.querySelectorAll('.msf-variant-row').length <= 1) return;
  btn.closest('.msf-variant-row')?.remove();
}

function msfGetVariantData() {
  const varSection  = document.getElementById('msf-variant-section');
  const hasVariants = varSection && varSection.style.display !== 'none';

  if (!hasVariants) {
    return { variant: undefined, quantity: parseInt(document.getElementById('msf-quantity')?.value) || 1 };
  }

  const rows = document.querySelectorAll('#msf-variant-rows .msf-variant-row');
  const list = [];
  let totalQty = 0;
  rows.forEach(row => {
    const color = row.querySelector('.msf-variant-select')?.value || '';
    const qty   = Math.max(1, parseInt(row.querySelector('.msf-variant-qty')?.value) || 1);
    if (color) {
      for (let i = 0; i < qty; i++) list.push(color);
      totalQty += qty;
    }
  });
  return {
    variant:  list.length ? JSON.stringify(list) : undefined,
    quantity: totalQty || 1,
  };
}

async function submitManualSale(sendCapi, force) {
  const errEl = document.getElementById('msf-error');
  if (errEl) { errEl.style.display = 'none'; }

  const name          = document.getElementById('msf-name')?.value.trim();
  const phone         = document.getElementById('msf-phone')?.value.trim();
  const productSlug   = document.getElementById('msf-product')?.value;
  const { variant, quantity } = msfGetVariantData();
  const value         = parseFloat(document.getElementById('msf-value')?.value);
  const paymentMethod = document.getElementById('msf-payment')?.value;
  const city          = document.getElementById('msf-city')?.value.trim();
  const sourceType    = document.getElementById('msf-source')?.value;
  const observation   = document.getElementById('msf-observation')?.value.trim();
  const confirmed     = document.getElementById('msf-confirmed')?.checked;
  const deductStock   = document.getElementById('msf-deduct-stock')?.checked ?? true;
  const campaignId    = document.getElementById('msf-campaign-id')?.value.trim();
  const campaignName  = document.getElementById('msf-campaign-name')?.value.trim();
  const adsetId       = document.getElementById('msf-adset-id')?.value.trim();
  const adsetName     = document.getElementById('msf-adset-name')?.value.trim();
  const adId          = document.getElementById('msf-ad-id')?.value.trim();
  const adName        = document.getElementById('msf-ad-name')?.value.trim();

  if (!name)                             return showMsfError('Nombre requerido');
  if (!phone)                            return showMsfError('Teléfono requerido');
  if (!productSlug)                      return showMsfError('Seleccioná un producto');
  if (!value || isNaN(value) || value <= 0) return showMsfError('Valor total inválido');
  if (!paymentMethod)                    return showMsfError('Método de pago requerido');
  if (!sourceType)                       return showMsfError('Fuente requerida');
  if (sendCapi && !confirmed)            return showMsfError('Confirmá que la compra fue real y pagada para enviar a Meta');
  if (msfVariantNames.length && !variant) return showMsfError('Seleccioná al menos una variante');

  const productObj   = MANUAL_PRODUCTS.find(p => p.slug === productSlug);
  const product_name = productObj ? productObj.name : productSlug;

  const btnId = sendCapi ? 'msf-btn-capi' : 'msf-btn-save';
  const btn   = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const res = await fetch('/api/manual-whatsapp-sale', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body: JSON.stringify({
        name, phone, product_name, product_slug: productSlug,
        value, payment_method: paymentMethod,
        source_type: sourceType, confirmed, send_capi: sendCapi,
        force: !!force, deduct_stock: deductStock,
        quantity, variant: variant || undefined,
        city: city || undefined, observation: observation || undefined,
        campaign_id:   campaignId   || undefined,
        campaign_name: campaignName || undefined,
        adset_id:      adsetId      || undefined,
        adset_name:    adsetName    || undefined,
        ad_id:         adId         || undefined,
        ad_name:       adName       || undefined,
      }),
    });

    const data = await res.json();

    if (!data.ok && data.duplicate_warning) {
      const ids = (data.duplicate_ids || []).join(', ');
      const proceed = confirm(
        `Posible duplicado detectado.\n\nLead(s) #${ids} ya registrados con el mismo teléfono, producto y valor en las últimas 2 horas.\n\n¿Querés guardar igual?`
      );
      if (proceed) submitManualSale(sendCapi, true);
      return;
    }

    if (!data.ok) {
      showMsfError(data.error || 'Error desconocido');
      return;
    }

    let msg = `Venta #${data.sale_id} registrada.`;
    if (data.stock_deducted) {
      msg += '\nStock descontado correctamente.';
    } else if (data.stock_error) {
      msg += `\nStock NO descontado: ${data.stock_error}`;
    }
    if (sendCapi) {
      if (data.capi_status === 'sent') {
        msg += '\nPurchase enviado a Meta correctamente.';
      } else if (data.capi_status !== 'skipped') {
        msg += `\nCAPI: ${data.capi_status}`;
        if (data.capi_error) msg += `\n${data.capi_error.slice(0, 120)}`;
      }
    }
    alert(msg);
    closeManualSaleModal();
    loadLeads();

  } catch (_) {
    showMsfError('Error de red — verificá la conexión');
  } finally {
    if (btn) {
      btn.disabled    = false;
      btn.textContent = sendCapi ? 'Guardar + Enviar CAPI' : 'Solo guardar';
    }
  }
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

/* =========================================================
   Clientes Bloqueados
   ========================================================= */

let _pendingBlockLeadId = null;

/* Abre el modal de motivo de bloqueo */
function blockCustomer(id) {
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;
  _pendingBlockLeadId = id;

  const nameEl  = document.getElementById('block-modal-name');
  const phoneEl = document.getElementById('block-modal-phone');
  if (nameEl)  nameEl.textContent  = lead.name  || '—';
  if (phoneEl) phoneEl.textContent = lead.phone || '—';

  const reasonSel = document.getElementById('block-reason-select');
  const notesEl   = document.getElementById('block-notes');
  if (reasonSel) reasonSel.value = '';
  if (notesEl)   notesEl.value   = '';

  const errEl = document.getElementById('block-modal-err');
  if (errEl) errEl.style.display = 'none';

  const modal = document.getElementById('block-customer-modal');
  if (modal) modal.style.display = 'flex';
}

function closeBlockModal() {
  _pendingBlockLeadId = null;
  const modal = document.getElementById('block-customer-modal');
  if (modal) modal.style.display = 'none';
}

async function confirmBlock() {
  const id      = _pendingBlockLeadId;
  const reason  = document.getElementById('block-reason-select')?.value  || '';
  const notes   = document.getElementById('block-notes')?.value?.trim()  || '';
  const errEl   = document.getElementById('block-modal-err');
  const btn     = document.getElementById('block-confirm-btn');

  if (!reason) {
    if (errEl) { errEl.textContent = 'Seleccioná un motivo.'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btn) btn.disabled = true;

  try {
    const res  = await fetch('/api/blocked-customers', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body:    JSON.stringify({ lead_id: id, reason, notes }),
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      closeBlockModal();
      alert('Cliente bloqueado. No podrá enviar nuevos pedidos desde ese teléfono/dispositivo.');
    } else {
      if (errEl) { errEl.textContent = 'Error: ' + (data.error || 'desconocido'); errEl.style.display = 'block'; }
    }
  } catch (_) {
    if (errEl) { errEl.textContent = 'Error de red.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* Cargar y renderizar la lista de bloqueados */
async function loadBlockedCustomers() {
  const tbody = document.getElementById('blocked-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted)">Cargando…</td></tr>';

  try {
    const res  = await fetch('/api/blocked-customers', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'error');
    renderBlockedCustomers(data.blocks || []);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--red)">Error: ${esc(err.message)}</td></tr>`;
  }
}

function renderBlockedCustomers(blocks) {
  const tbody = document.getElementById('blocked-tbody');
  if (!tbody) return;

  if (!blocks.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Sin clientes bloqueados</td></tr>';
    return;
  }

  tbody.innerHTML = blocks.map(b => {
    const statusBadge = b.active
      ? '<span class="badge badge-cancelled">Bloqueado</span>'
      : '<span class="badge" style="background:rgba(255,255,255,.06);color:rgba(255,255,255,.35)">Desbloqueado</span>';

    const unblockBtn = b.active
      ? `<button onclick="unblockCustomer(${b.id})"
           style="background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);color:#4ade80;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;font-family:inherit">
           Desbloquear
         </button>`
      : '';

    return `<tr>
      <td>${esc(b.name || '—')}</td>
      <td>${esc(b.phone || '—')}</td>
      <td style="font-size:11px;color:rgba(255,255,255,.45)">${esc(b.reason || '—')}</td>
      <td>${statusBadge}</td>
      <td style="font-size:11px;color:rgba(255,255,255,.35)">${fmtDateShort(b.created_at)}</td>
      <td>${unblockBtn}</td>
    </tr>`;
  }).join('');
}

async function unblockCustomer(blockId) {
  if (!confirm('¿Desbloquear a este cliente? Podrá volver a enviar pedidos.')) return;

  try {
    const res  = await fetch(`/api/blocked-customers?id=${blockId}`, {
      method:  'DELETE',
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      loadBlockedCustomers();
    } else {
      alert('Error al desbloquear: ' + (data.error || res.status));
    }
  } catch (_) {
    alert('Error de red');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('block-customer-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBlockModal();
  });
  document.getElementById('block-refresh-btn')?.addEventListener('click', loadBlockedCustomers);
});

/* =========================================================
   Delivery — Panel de distribución de envíos
   ========================================================= */

let shippingDate    = getParaguayDateLocal();
let shippingShowAll = false;
let _shippingRows   = {};

function getParaguayDateLocal(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function initShippingPanel() {
  shippingDate    = getParaguayDateLocal();
  shippingShowAll = false;
  const todayStr  = shippingDate;
  const yestStr   = getParaguayDateLocal(new Date(Date.now() - 86400000));

  document.getElementById('ship-date-all')?.addEventListener('click', () => {
    shippingShowAll = true;
    document.getElementById('ship-date-all')?.classList.add('date-btn--active');
    document.getElementById('ship-date-today')?.classList.remove('date-btn--active');
    document.getElementById('ship-date-yesterday')?.classList.remove('date-btn--active');
    const dp = document.getElementById('ship-date-picker');
    if (dp) dp.value = '';
    loadShippingStats();
  });

  document.getElementById('ship-date-today')?.addEventListener('click', () => {
    shippingShowAll = false;
    shippingDate    = todayStr;
    document.getElementById('ship-date-today')?.classList.add('date-btn--active');
    document.getElementById('ship-date-yesterday')?.classList.remove('date-btn--active');
    document.getElementById('ship-date-all')?.classList.remove('date-btn--active');
    const dp = document.getElementById('ship-date-picker');
    if (dp) dp.value = '';
    loadShippingStats();
  });

  document.getElementById('ship-date-yesterday')?.addEventListener('click', () => {
    shippingShowAll = false;
    shippingDate    = yestStr;
    document.getElementById('ship-date-yesterday')?.classList.add('date-btn--active');
    document.getElementById('ship-date-today')?.classList.remove('date-btn--active');
    document.getElementById('ship-date-all')?.classList.remove('date-btn--active');
    const dp = document.getElementById('ship-date-picker');
    if (dp) dp.value = '';
    loadShippingStats();
  });

  document.getElementById('ship-date-picker')?.addEventListener('change', e => {
    if (e.target.value) {
      shippingShowAll = false;
      shippingDate    = e.target.value;
      document.getElementById('ship-date-today')?.classList.remove('date-btn--active');
      document.getElementById('ship-date-yesterday')?.classList.remove('date-btn--active');
      document.getElementById('ship-date-all')?.classList.remove('date-btn--active');
      loadShippingStats();
    }
  });
}

async function loadShippingStats() {
  const countEl  = document.getElementById('shipping-purchased-count');
  const statusEl = document.getElementById('shipping-status');
  if (countEl)  countEl.textContent = '…';
  if (statusEl) { statusEl.style.color = ''; statusEl.textContent = ''; }

  try {
    const res  = await fetch(`/api/delivery-shipping?date=${shippingDate}`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
    });
    const data = await res.json();
    if (data.ok) {
      if (countEl) countEl.textContent = data.purchasedCount;

      /* Pre-cargar inputs con historial del día si existe */
      if (data.history) {
        const h  = data.history;
        const di = document.getElementById('shipping-delivery-input');
        const ei = document.getElementById('shipping-encomienda-input');
        if (di) di.value = h.delivery_amount   > 0 ? h.delivery_amount   : '';
        if (ei) ei.value = h.encomienda_amount  > 0 ? h.encomienda_amount : '';
      } else {
        const di = document.getElementById('shipping-delivery-input');
        const ei = document.getElementById('shipping-encomienda-input');
        if (di) di.value = '';
        if (ei) ei.value = '';
      }

      updateShippingPerSale();
      renderShippingHistory(
        shippingShowAll
          ? (data.recentHistory || [])
          : (data.recentHistory || []).filter(r => r.date === shippingDate)
      );
    } else {
      if (countEl) countEl.textContent = '?';
    }
  } catch (_) {
    if (countEl) countEl.textContent = '?';
  }
}

function updateShippingPerSale() {
  const countEl     = document.getElementById('shipping-purchased-count');
  const perSaleEl   = document.getElementById('shipping-per-sale');
  const totalDisplay = document.getElementById('shipping-total-display');
  const delivery    = parseFloat(document.getElementById('shipping-delivery-input')?.value)   || 0;
  const encomienda  = parseFloat(document.getElementById('shipping-encomienda-input')?.value) || 0;
  const total       = delivery + encomienda;
  const count       = parseInt(countEl?.textContent) || 0;
  const perSale     = count > 0 && total > 0 ? Math.round(total / count) : 0;

  if (totalDisplay) totalDisplay.textContent = 'Gs. ' + total.toLocaleString('es-PY');
  if (perSaleEl) perSaleEl.textContent = count > 0 && total > 0
    ? 'Gs. ' + perSale.toLocaleString('es-PY')
    : '—';
}

function renderShippingHistory(rows) {
  _shippingRows = {};
  const container = document.getElementById('shipping-history-list');
  if (!container) return;
  const titleEl = document.getElementById('shipping-history-title');
  if (titleEl) titleEl.textContent = shippingShowAll ? 'Historial reciente' : 'Historial';
  if (!rows.length) {
    container.innerHTML = '<p style="padding:14px 8px;color:rgba(255,255,255,.25);text-align:center;font-size:11px;margin:0">Sin historial</p>';
    return;
  }
  const fmt = n => Number(n || 0).toLocaleString('es-PY');
  rows.forEach(r => { _shippingRows[r.date] = r; });
  container.innerHTML = rows.map(r => {
    const label = fmtShipDate(r.date);
    return `
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:12px 14px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;font-weight:700;color:#fff">${label}</span>
        <span style="font-size:14px;font-weight:700;color:#60a5fa">Gs. ${fmt(r.total_shipping)}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;font-size:11px;color:rgba(255,255,255,.5);margin-bottom:10px">
        <span>Delivery: ${r.delivery_amount > 0 ? 'Gs. ' + fmt(r.delivery_amount) : '—'}</span>
        <span>Comprados: ${r.purchased_count || 0}</span>
        <span>Encom./Bolt: ${r.encomienda_amount > 0 ? 'Gs. ' + fmt(r.encomienda_amount) : '—'}</span>
        <span>C/venta: ${r.per_sale > 0 ? 'Gs. ' + fmt(r.per_sale) : '—'}</span>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="editShippingRow('${r.date}')"
          style="flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.7);font-size:11px;padding:6px 10px;border-radius:6px;cursor:pointer;font-family:inherit">
          Editar
        </button>
        <button onclick="deleteShippingRow('${r.date}')"
          style="flex:1;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);color:#f87171;font-size:11px;padding:6px 10px;border-radius:6px;cursor:pointer;font-family:inherit">
          Eliminar
        </button>
      </div>
    </div>`;
  }).join('');
}

async function applyShipping() {
  const statusEl   = document.getElementById('shipping-status');
  const btn        = document.getElementById('shipping-apply-btn');
  const delivery   = Math.max(0, parseFloat(document.getElementById('shipping-delivery-input')?.value)   || 0);
  const encomienda = Math.max(0, parseFloat(document.getElementById('shipping-encomienda-input')?.value) || 0);
  const total      = delivery + encomienda;

  const totalFmt     = total.toLocaleString('es-PY');
  const deliveryFmt  = delivery.toLocaleString('es-PY');
  const encomiendaFmt = encomienda.toLocaleString('es-PY');

  const confirmed = confirm(
    total === 0
      ? `¿Eliminar costos de envío de todos los reportes del ${shippingDate}?`
      : `¿Distribuir Gs. ${totalFmt} entre las ventas del ${shippingDate}?\n\nDelivery: Gs. ${deliveryFmt}\nEncomienda: Gs. ${encomiendaFmt}`
  );
  if (!confirmed) return;

  if (btn) { btn.disabled = true; btn.textContent = 'Aplicando…'; }
  if (statusEl) { statusEl.style.color = ''; statusEl.textContent = ''; }

  try {
    const res = await fetch('/api/delivery-shipping', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body:    JSON.stringify({ date: shippingDate, deliveryAmount: delivery, encomiendaAmount: encomienda }),
    });
    const data = await res.json();

    if (data.ok) {
      const df    = data.damFinanzas || {};
      const count = df.count || 0;
      const msg   = count > 0
        ? `✓ Gs. ${totalFmt} distribuidos entre ${count} reportes en Dam Finanzas (Gs. ${(df.perSale || 0).toLocaleString('es-PY')} c/u).`
        : `✓ Sin reportes en Dam Finanzas para ${shippingDate} (${data.purchasedCount || 0} compra(s) en DAM Vertex).`;
      if (statusEl) { statusEl.style.color = '#4ade80'; statusEl.textContent = msg; }
      loadShippingStats();
    } else {
      if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = 'Error: ' + (data.error || 'desconocido'); }
    }
  } catch (_) {
    if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = 'Error de red. Verificá la conexión.'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Aplicar a reportes'; }
  }
}

function editShippingRow(date) {
  const r = _shippingRows[date];
  if (!r) return;
  shippingShowAll = false;
  document.getElementById('ship-date-all')?.classList.remove('date-btn--active');
  shippingDate = r.date;
  const di       = document.getElementById('shipping-delivery-input');
  const ei       = document.getElementById('shipping-encomienda-input');
  const todayStr = getParaguayDateLocal();
  const yestStr  = getParaguayDateLocal(new Date(Date.now() - 86400000));
  if (di) di.value = r.delivery_amount   > 0 ? r.delivery_amount   : '';
  if (ei) ei.value = r.encomienda_amount > 0 ? r.encomienda_amount : '';
  document.getElementById('ship-date-today')?.classList.toggle('date-btn--active', r.date === todayStr);
  document.getElementById('ship-date-yesterday')?.classList.toggle('date-btn--active', r.date === yestStr);
  const dp = document.getElementById('ship-date-picker');
  if (dp) dp.value = (r.date !== todayStr && r.date !== yestStr) ? r.date : '';
  updateShippingPerSale();
  document.getElementById('shipping-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteShippingRow(date) {
  const label     = fmtShipDate(date);
  const confirmed = confirm(`¿Eliminar costos de envío del ${label} (${date}) de todos los reportes en Dam Finanzas?`);
  if (!confirmed) return;
  const statusEl = document.getElementById('shipping-status');
  if (statusEl) { statusEl.style.color = ''; statusEl.textContent = 'Eliminando…'; }
  try {
    const res = await fetch('/api/delivery-shipping', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body:    JSON.stringify({ date, deliveryAmount: 0, encomiendaAmount: 0 }),
    });
    const data = await res.json();
    if (data.ok) {
      if (statusEl) { statusEl.style.color = '#4ade80'; statusEl.textContent = `✓ Costos de ${label} eliminados de Dam Finanzas.`; }
      loadShippingStats();
    } else {
      if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = 'Error: ' + (data.error || 'desconocido'); }
    }
  } catch (_) {
    if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = 'Error de red.'; }
  }
}
