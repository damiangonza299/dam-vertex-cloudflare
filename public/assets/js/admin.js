/* =========================================================
   Dam Vertex â Admin Panel
   ========================================================= */

let AUTH_TOKEN = sessionStorage.getItem('dv_admin_token') || '';
let allLeads   = [];

/* ââ Bootstrap ââ */
document.addEventListener('DOMContentLoaded', () => {
  if (AUTH_TOKEN) {
    showPanel();
    loadLeads();
  } else {
    showLogin();
  }
});

/* ââ Login ââ */
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
    err.textContent = 'ContraseÃ±a incorrecta';
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

/* ââ Load leads ââ */
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

/* ââ Render ââ */
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
document.getElementById('export-csv-btn')?.addEventListener('click', exportCSV);

function renderTable(leads) {
  const tbody = document.getElementById('leads-tbody');
  if (!tbody) return;

  if (!leads.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">Sin resultados</td></tr>';
    return;
  }

  tbody.innerHTML = leads.map((l, i) => `
    <tr data-id="${l.id}">
      <td>${i + 1}</td>
      <td>${esc(l.name)}</td>
      <td>${esc(l.phone)}</td>
      <td>${esc(l.city || 'â')}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">${esc(l.product_name)}</td>
      <td>${fmt(l.value)}</td>
      <td><span class="badge badge-${l.status}">${labelStatus(l.status)}</span></td>
      <td>${fmtDate(l.created_at)}</td>
      <td>
        ${l.status === 'pending'
          ? `<button class="btn-confirm" onclick="confirmPurchase(${l.id})">Confirmar</button>
             <button class="btn-cancel"  onclick="cancelLead(${l.id})">Cancelar</button>`
          : `<button class="btn-confirm btn-disabled" disabled>Confirmar</button>
             <button class="btn-cancel btn-disabled"  disabled>Cancelar</button>`
        }
        <button class="btn-delete" onclick="deleteLead(${l.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

/* ââ Confirm purchase ââ */
async function confirmPurchase(id) {
  if (!confirm(`Â¿Confirmar compra para lead #${id}? Esto enviarÃ¡ el evento Purchase a Meta.`)) return;

  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (row) row.style.opacity = '.5';

  try {
    const res  = await fetch('/api/confirm-purchase', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      alert(`â Compra confirmada para ${data.name}. Purchase enviado a Meta.`);
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

/* ââ Cancel lead ââ */
async function cancelLead(id) {
  if (!confirm(`Â¿Cancelar lead #${id}?`)) return;

  try {
    const res  = await fetch('/api/admin-leads', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body: JSON.stringify({ id, status: 'cancelled' }),
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

/* ââ Delete lead ââ */
async function deleteLead(id) {
  if (!confirm(`Â¿Eliminar lead #${id} definitivamente? Esta acciÃ³n no se puede deshacer.`)) return;

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

/* ââ Export CSV ââ */
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
    const parts    = (l.name || '').trim().split(/\s+/);
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
  const blob = new Blob(['ï»¿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ââ Formatters ââ */
function fmt(n)    { return 'Gs. ' + Number(n || 0).toLocaleString('es-PY'); }
function esc(s)    { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtDate(s){ return s ? new Date(s + 'Z').toLocaleString('es-PY', { day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit' }) : 'â'; }
function labelStatus(s) {
  return { pending: 'Pendiente', purchased: 'Comprado', cancelled: 'Cancelado' }[s] || s;
}
