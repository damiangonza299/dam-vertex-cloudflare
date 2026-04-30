/* =========================================================
   Dam Vertex — Admin Panel
   ========================================================= */

let AUTH_TOKEN = sessionStorage.getItem('dv_admin_token') || '';
let allLeads   = [];

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
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
    sessionStorage.setItem('dv_admin_token', pw);
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
  sessionStorage.removeItem('dv_admin_token');
  AUTH_TOKEN = '';
  location.reload();
});

/* ── Load leads ── */
async function loadLeads() {
  try {
    const res = await fetch('/api/admin-leads', {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
    });
    if (res.status === 401) { sessionStorage.removeItem('dv_admin_token'); location.reload(); return; }
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

  const filtered = allLeads.filter(l => {
    const matchQ = !q
      || l.name?.toLowerCase().includes(q)
      || l.phone?.includes(q)
      || l.city?.toLowerCase().includes(q);
    const matchProd   = !product || l.product_name === product;
    const matchStatus = !status  || l.status === status;
    return matchQ && matchProd && matchStatus;
  });

  renderTable(filtered);
}

document.getElementById('search-input')?.addEventListener('input', applyFilters);
document.getElementById('filter-product')?.addEventListener('change', applyFilters);
document.getElementById('filter-status')?.addEventListener('change', applyFilters);
document.getElementById('refresh-btn')?.addEventListener('click', loadLeads);

function renderTable(leads) {
  const tbody = document.getElementById('leads-tbody');
  if (!tbody) return;

  if (!leads.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Sin resultados</td></tr>';
    return;
  }

  tbody.innerHTML = leads.map(l => `
    <tr data-id="${l.id}">
      <td>${l.id}</td>
      <td>${esc(l.name)}</td>
      <td>${esc(l.phone)}</td>
      <td>${esc(l.city || '—')}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">${esc(l.product_name)}</td>
      <td>${fmt(l.value)}</td>
      <td><span class="badge badge-${l.status}">${labelStatus(l.status)}</span></td>
      <td>${fmtDate(l.created_at)}</td>
      <td>
        ${l.status === 'pending'
          ? `<button class="btn-confirm" onclick="confirmPurchase(${l.id})">Confirmar</button>
             <button class="btn-cancel"  onclick="cancelLead(${l.id})">Cancelar</button>`
          : `<button class="btn-confirm btn-disabled" disabled>Confirmar</button>`
        }
      </td>
    </tr>
  `).join('');
}

/* ── Confirm purchase ── */
async function confirmPurchase(id) {
  if (!confirm(`¿Confirmar compra para lead #${id}? Esto enviará el evento Purchase a Meta.`)) return;

  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (row) row.style.opacity = '.5';

  try {
    const res = await fetch('/api/confirm-purchase', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();

    if (res.ok && data.ok) {
      const lead = allLeads.find(l => l.id === id);
      if (lead) lead.status = 'purchased';
      applyFilters();
      updateStats(allLeads);
      alert(`✓ Compra confirmada para ${data.name}. Purchase enviado a Meta.`);
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
    const res = await fetch('/api/admin-leads', {
      method:  'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ id, status: 'cancelled' }),
    });

    if (res.ok) {
      const lead = allLeads.find(l => l.id === id);
      if (lead) lead.status = 'cancelled';
      applyFilters();
      updateStats(allLeads);
    } else {
      alert('Error al cancelar');
    }
  } catch (_) {
    alert('Error de red');
  }
}

/* ── Formatters ── */
function fmt(n)    { return 'Gs. ' + Number(n || 0).toLocaleString('es-PY'); }
function esc(s)    { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtDate(s){ return s ? new Date(s + 'Z').toLocaleString('es-PY', { day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit' }) : '—'; }
function labelStatus(s) {
  return { pending: 'Pendiente', purchased: 'Comprado', cancelled: 'Cancelado' }[s] || s;
}
